
import { client, cluster, database } from "@/index.js";
import { QuickDB } from "quick.db";
import { EmbedBuilder, WebhookClient, Client, AttachmentBuilder } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "@yeci226/hoyoapi";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	autoRefreshCookie
} from "@/utilities/index.js";
import { loadConfig } from "@/utilities/core/config.js";
import {
	buildHSRDailyCard,
	HSRDailyCardPayload
} from "@/utilities/canvas/dailyCard.js";

interface Config {
	API_TIMEOUT: number;
	WEBHOOK_RETRIES: number;
	DEFAULT_LANGUAGE: string;
}

interface LanguageMapping {
	[key: string]: LanguageEnum;
}

interface Stats {
	total: number;
	success: number;
	failed: number;
	signed: number;
	skipped: number;
}

interface AutoDailyOptions {
	manualHours?: number[];
	label?: string;
	all?: boolean;
	force?: boolean;
	initiatedBy?: string;
}

interface DailyData {
	[key: string]: {
		channelId: string;
		tag: string;
		time?: string;
	};
}

interface Account {
	cookie: string;
	uid: string;
}

interface SignResult {
	code: number;
	info: {
		is_sign: boolean;
	};
}

interface MessageData {
	content: string;
	embeds: EmbedBuilder[];
}

const config = loadConfig();
const CONFIG: Config = {
	API_TIMEOUT: 10000,
	WEBHOOK_RETRIES: 3,
	DEFAULT_LANGUAGE: "en"
};

const LANGUAGE_MAPPING: LanguageMapping = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	vi: LanguageEnum.VIETNAMESE,
	jp: LanguageEnum.JAPANESE,
	kr: LanguageEnum.KOREAN,
	fr: LanguageEnum.FRENCH,
	default: LanguageEnum.ENGLISH
};

class AutoDailySignSystem {
	private client: Client;
	private db: QuickDB;
	private webhook: WebhookClient;
	private logger: Logger;
	private stats: Stats;

	constructor(client: Client, webhookUrl: string) {
		this.client = client;
		this.db = database;
		this.webhook = new WebhookClient({ url: webhookUrl });
		this.logger = new Logger("自動簽到");
		this.stats = { total: 0, success: 0, failed: 0, signed: 0, skipped: 0 };
	}

	logStart(label: string, initiatedBy?: string): void {
		const message = `${label} 自動簽到`;
		if (initiatedBy) {
			this.logger.command(`手動觸發者 ${initiatedBy}，開始 ${message}`);
		} else {
			this.logger.success(`開始 ${message}`);
		}
	}

	async initialize(): Promise<void> {
		if (!this.webhook?.url) {
			throw new Error("無效的 webhook 配置");
		}
	}

	getLanguage(locale: string): LanguageEnum {
		return (LANGUAGE_MAPPING[locale] ||
			LANGUAGE_MAPPING.default ||
			LanguageEnum.ENGLISH) as any;
	}

	// 檢查是否為可跳過的錯誤
	isSkippableError(errorMessage: string): boolean {
		const skipPatterns = [
			"尚未登入",
			"尚未登录",
			"Not logged in",
			"未登入",
			"未登录",
			"登入失敗",
			"登录失败",
			"Login failed",
			"Cookie 已過期",
			"Cookie 已过期",
			"Cookie expired",
			"無效的 Cookie",
			"无效的 Cookie",
			"Invalid cookie"
		];

		return skipPatterns.some(pattern =>
			errorMessage.toLowerCase().includes(pattern.toLowerCase())
		);
	}

	getBackfillHours(currentHour: number, signedHour: number[]): number[] {
		const backfillHours = [];
		for (let i = 0; i < currentHour; i++) {
			if (!signedHour.includes(i)) {
				backfillHours.push(i);
			}
		}
		return backfillHours;
	}

	async processDailySign(
		userId: string,
		dailyData: DailyData
	): Promise<boolean> {
		const accounts = await this.db.get(`${userId}.account`);
		if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
			return false;
		}

		const userLang = (await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
		const tr = createTranslator(userLang);
		const channelId = dailyData[userId]?.channelId || "";
		const tag = dailyData[userId]?.tag === "true" ? `<@${userId}>` : "";

		const successBefore = this.stats.success + this.stats.signed;

		for (
			let accountIndex = 0;
			accountIndex < accounts.length;
			accountIndex++
		) {
			try {
				const cookie = await getUserCookie(userId, accountIndex);
				const uid = await getUserUid(userId, accountIndex);

				if (!cookie || !uid) {
					this.stats.skipped++;
					continue;
				}

				await this.performSignIn(
					{ cookie, uid },
					userLang,
					userId,
					channelId,
					tag,
					tr,
					accountIndex
				);
			} catch (error) {
				const errorMessage = (error as Error).message;

				if (this.isSkippableError(errorMessage)) {
					this.stats.skipped++;
				} else {
					this.stats.failed++;
				}
			}
		}

		return this.stats.success + this.stats.signed > successBefore;
	}

	async getDiscordNickname(userId: string): Promise<string> {
		try {
			const user = await this.client.users.fetch(userId);
			return user.displayName || user.username || "開拓者";
		} catch {
			return "開拓者";
		}
	}

	async performSignIn(
		account: Account,
		userLang: string,
		userId: string,
		channelId: string,
		tag: string,
		tr: any,
		accountIndex: number
	): Promise<void> {
		this.stats.total++;

		const hsr = new HonkaiStarRail({
			uid: parseInt(account.uid),
			cookie: account.cookie,
			lang: this.getLanguage(userLang)
		});

		const nickname = await this.getDiscordNickname(userId);

		try {
			const [info, reward, rewards] = (await Promise.all([
				hsr.daily.info(),
				hsr.daily.reward(),
				hsr.daily.rewards()
			])) as any;

			const result = (await hsr.daily.claim()) as SignResult;

			if (result.code === -5003 || result.info.is_sign === true) {
				this.stats.signed++;
				// 每天只通知一次「已簽到」
				const today = new Date().toISOString().slice(0, 10);
				const deduKey = `lastNotifiedDate:${userId}:${accountIndex}`;
				const lastNotified = await database.get(deduKey);
				if (lastNotified !== today) {
					await database.set(deduKey, today);
					const signedDays = info.total_sign_day;
					const idx = Math.max(0, info.total_sign_day - 1);
					const todaySign = rewards.awards[idx] || rewards.awards[0];
					const mkReward = (r: any) => ({
						name: r?.name || "",
						count: r?.cnt ?? 1,
						...(r?.icon ? { icon: r.icon as string } : {})
					});
					await this.sendSuccessMessage(
						channelId,
						{
							uid: account.uid,
							nickname,
							status: "already_signed",
							totalDays: signedDays,
							month: reward.month,
							signCntMissed: info.sign_cnt_missed,
							todayReward: mkReward(todaySign),
							nextRewards: [
								rewards.awards[idx + 1] || rewards.awards[0],
								rewards.awards[idx + 2] || rewards.awards[0],
								rewards.awards[idx + 3] || rewards.awards[0],
							].map(mkReward) as [any, any, any],
						},
						tag,
						userId
					);
				}
				return;
			}

			// total_sign_day is the count BEFORE claiming; after claim it's +1
			const signedDays = info.total_sign_day + 1;
			const idx = info.total_sign_day; // 0-based index of today (pre-claim)
			const ystSign = rewards.awards[idx - 1];
			const todaySign = rewards.awards[idx] || rewards.awards[0];
			const nextSigns = [
				rewards.awards[idx + 1] || rewards.awards[0],
				rewards.awards[idx + 2] || rewards.awards[0],
				rewards.awards[idx + 3] || rewards.awards[0]
			];
			const mkReward = (r: any) => ({
				name: r?.name || "",
				count: r?.cnt ?? 1,
				...(r?.icon ? { icon: r.icon as string } : {})
			});

			this.stats.success++;

			await this.sendSuccessMessage(
				channelId,
				{
					uid: account.uid,
					nickname,
					status: "success",
					totalDays: signedDays,
					month: reward.month,
					signCntMissed: info.sign_cnt_missed,
					...(ystSign
						? {
								yesterdayReward: {
									...mkReward(ystSign),
									claimed: idx > 0
								}
							}
						: {}),
					todayReward: mkReward(todaySign),
					nextRewards: [
						mkReward(nextSigns[0]),
						mkReward(nextSigns[1]),
						mkReward(nextSigns[2])
					],
					labelMonthCumulativeDays: tr(
						"card_MonthCumulativeDays"
					).replace("<month>", String(reward.month)),
					labelMissedDays: tr("card_MissedDays"),
					labelDays: [
						tr("card_Yesterday"),
						tr("card_Today"),
						tr("card_Tomorrow"),
						tr("card_DayAfterTomorrow"),
						tr("card_TwoDaysAfterTomorrow")
					],
					labelClaimed: tr("card_Claimed"),
					labelMissed: tr("card_Missed"),
					labelCheckedIn: tr("card_CheckedIn")
				},
				tag,
				userId
			);
		} catch (error: any) {
			let errorMessage = error.message || "";
			const code = error.code ?? error.retcode;

			// 如果是 Cookie 相關錯誤，嘗試刷新一次
			if (code === 10001 || this.isSkippableError(errorMessage)) {
				const refreshResult = await autoRefreshCookie(
					userId,
					accountIndex,
					account.cookie
				);

				if (refreshResult.success) {
					const newCookie =
						refreshResult.newCookie ||
						(await getUserCookie(userId, accountIndex)) ||
						account.cookie;

					// 重試一次
					const retryHsr = new HonkaiStarRail({
						uid: parseInt(account.uid),
						cookie: newCookie,
						lang: this.getLanguage(userLang)
					});

					try {
						const [info, reward, rewards] = (await Promise.all([
							retryHsr.daily.info(),
							retryHsr.daily.reward(),
							retryHsr.daily.rewards()
						])) as any;

						const result =
							(await retryHsr.daily.claim()) as SignResult;

						if (
							result.code === -5003 ||
							result.info.is_sign === true
						) {
							this.stats.signed++;
							return;
						}

						// total_sign_day is the count BEFORE claiming; after claim it's +1
						const signedDays = info.total_sign_day + 1;
						const idx = info.total_sign_day; // 0-based index of today (pre-claim)
						const ystSign = rewards.awards[idx - 1];
						const todaySign =
							rewards.awards[idx] || rewards.awards[0];
						const nextSigns = [
							rewards.awards[idx + 1] || rewards.awards[0],
							rewards.awards[idx + 2] || rewards.awards[0],
							rewards.awards[idx + 3] || rewards.awards[0]
						];
						const mkReward = (r: any) => ({
							name: r?.name || "",
							count: r?.cnt ?? 1,
							...(r?.icon ? { icon: r.icon as string } : {})
						});

						this.stats.success++;

						await this.sendSuccessMessage(
							channelId,
							{
								uid: account.uid,
								nickname,
								status: "success",
								totalDays: signedDays,
								month: reward.month,
								signCntMissed: info.sign_cnt_missed,
								...(ystSign
									? {
											yesterdayReward: {
												...mkReward(ystSign),
												claimed: idx > 0
											}
										}
									: {}),
								todayReward: mkReward(todaySign),
								nextRewards: [
									mkReward(nextSigns[0]),
									mkReward(nextSigns[1]),
									mkReward(nextSigns[2])
								],
								labelMonthCumulativeDays: tr(
									"card_MonthCumulativeDays"
								).replace("<month>", String(reward.month)),
								labelMissedDays: tr("card_MissedDays"),
								labelDays: [
									tr("card_Yesterday"),
									tr("card_Today"),
									tr("card_Tomorrow"),
									tr("card_DayAfterTomorrow"),
									tr("card_TwoDaysAfterTomorrow")
								],
					labelClaimed: tr("card_Claimed"),
						labelMissed: tr("card_Missed"),
						labelCheckedIn: tr("card_CheckedIn")
					},
					tag,
					userId
				);
				return;
					} catch (retryError: any) {
						errorMessage = retryError.message;
					}
				}
			}

			const isTokenError = this.isSkippableError(errorMessage);

			if (isTokenError) {
				this.logger.warn(
					`[用戶 ${userId}] 帳號 #${accountIndex} Token 已過期，靜默跳過`
				);
				throw new Error(errorMessage);
			}

			await this.sendErrorMessage(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(`${tr("Auto")}${tr("daily_Failed")}`)
						.setDescription(`- \`${account.uid}\`: ${errorMessage}`)
				]
			}, userId);

			throw new Error(`API 錯誤: ${errorMessage}`);
		}
	}

	async sendSuccessMessage(
		channelId: string,
		cardData: HSRDailyCardPayload,
		content: string,
		userId?: string
	): Promise<void> {
		let cardFile: { buffer: string; name: string } | null = null;
		try {
			const buf = await buildHSRDailyCard(cardData);
			cardFile = {
				buffer: buf.toString("base64"),
				name: "daily-hsr.png"
			};
		} catch (e) {
			this.logger.error(`Daily canvas card 生成失敗: ${e}`);
		}

		const payload = cardFile
			? { ...(content && { content }) }
			: (() => {
					const statusText = cardData.status === "already_signed" ? "（今日已簽到）" : "（簽到成功）";
					return {
						content: [content, `${cardData.nickname} ${statusText} 第 ${cardData.totalDays} 天`]
							.filter(Boolean)
							.join("\n")
					};
				})();
		const sendToChannel = async (cid: string, msgPayload: any) => {
			const ch = await client.channels.fetch(cid) as any;
			await ch.send(msgPayload);
		};
		const sendToDm = async (uid: string, msgPayload: any) => {
			const user = await client.users.fetch(uid);
			const dm = await user.createDM();
			await dm.send(msgPayload);
		};

		const msgPayload = cardFile
			? {
				...(payload as object),
				files: [new AttachmentBuilder(Buffer.from(cardFile.buffer, "base64"), { name: cardFile.name })],
			}
			: payload;

		try {
			await sendToChannel(channelId, msgPayload);
		} catch (channelError) {
			this.logger.error(
				`發送訊息至頻道 ${channelId} 時發生錯誤，嘗試 DM: ${(channelError as any)?.stack ?? channelError}`
			);
			if (userId) {
				try {
					await sendToDm(userId, msgPayload);
				} catch (dmError) {
					this.logger.error(
						`DM fallback 發送失敗 (userId: ${userId}): ${(dmError as any)?.stack ?? dmError}`
					);
				}
			}
		}
	}

	async sendErrorMessage(
		channelId: string,
		messageData: MessageData,
		userId?: string
	): Promise<void> {
		const restPayload: { content?: string; embeds?: object[] } = {};
		const msgContent = typeof messageData.content === "string" ? messageData.content : undefined;
		if (msgContent) restPayload.content = msgContent;
		if (Array.isArray((messageData as any).embeds)) restPayload.embeds = (messageData as any).embeds;

		const sendToChannel = async (cid: string, msgPayload: any) => {
			const ch = await client.channels.fetch(cid) as any;
			await ch.send(msgPayload);
		};
		const sendToDm = async (uid: string, msgPayload: any) => {
			const user = await client.users.fetch(uid);
			const dm = await user.createDM();
			await dm.send(msgPayload);
		};

		try {
			await sendToChannel(channelId, restPayload);
		} catch (channelError) {
			this.logger.error(
				`發送錯誤訊息至頻道 ${channelId} 時發生錯誤，嘗試 DM: ${(channelError as any)?.stack ?? channelError}`
			);
			if (userId) {
				try {
					await sendToDm(userId, restPayload);
				} catch (dmError) {
					this.logger.error(
						`DM fallback 發送失敗 (userId: ${userId}): ${(dmError as any)?.stack ?? dmError}`
					);
				}
			}
		}
	}

	async updateStatistics(startTime: number, label: string): Promise<void> {
		const endTime = Date.now();
		const duration = (endTime - startTime) / 1000;
		const averageTime =
			this.stats.total > 0 ? duration / this.stats.total : 0;

		this.logger.success(
			`已完成 ${label} 自動簽到: ${this.stats.total} 總數, ` +
				`${this.stats.success} 成功, ${this.stats.signed} 已簽到, ` +
				`${this.stats.skipped} 跳過, ${this.stats.failed} 失敗`
		);

		const statsEmbed = new EmbedBuilder()
			.setColor("#F2BE22")
			.setTitle(`${label} 自動簽到統計`)
			.setTimestamp()
			.addFields(this.buildStatsFields(duration, averageTime));

		await this.webhook.send({ embeds: [statsEmbed] });
	}

	buildStatsFields(duration: number, averageTime: number) {
		return [
			{
				name: `總數: \`${this.stats.total}\``,
				value: "\u200b",
				inline: false
			},
			{
				name: `成功: \`${this.stats.success}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `已簽到: \`${this.stats.signed}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `跳過: \`${this.stats.skipped}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `失敗: \`${this.stats.failed}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `總時間: \`${duration.toFixed(3)}\` 秒`,
				value: "\u200b",
				inline: true
			},
			{
				name: `平均時間: \`${averageTime.toFixed(3)}\` 秒`,
				value: "\u200b",
				inline: true
			}
		];
	}

	getStats(): Stats {
		return { ...this.stats };
	}
}

export default async function autoDailySign(
	options: AutoDailyOptions = {}
): Promise<Stats> {
	const system = new AutoDailySignSystem(client, config.LOGWEBHOOK);
	await system.initialize();

	const normalizedManualHours =
		options.manualHours
			?.map(hour => Number(hour))
			.filter(
				hour => Number.isInteger(hour) && hour >= 0 && hour <= 23
			) ?? [];
	const manualMode = Boolean(options.all) || normalizedManualHours.length > 0;

	const dailyData = (await (system as any).db.get("autoDaily")) as DailyData;
	const hasDailyData =
		dailyData && Object.keys(dailyData).length > 0 ? true : false;

	const getHourInTimezone = (timeZone: string): number => {
		const parts = new Intl.DateTimeFormat("en-GB", {
			timeZone,
			hour: "2-digit",
			hour12: false
		}).formatToParts(new Date());
		const hourStr = parts.find(p => p.type === "hour")?.value || "00";
		return parseInt(hourStr, 10);
	};

	const getDateKeyInTimezone = (timeZone: string): string => {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit"
		}).formatToParts(new Date());
		const y = parts.find(p => p.type === "year")?.value || "0000";
		const m = parts.find(p => p.type === "month")?.value || "01";
		const d = parts.find(p => p.type === "day")?.value || "01";
		return `${y}-${m}-${d}`;
	};

	const normalizeTimeZone = (tz?: string): string => {
		if (typeof tz === "string" && tz.includes("/")) return tz;
		return "Asia/Taipei";
	};

	const taipeiHour = getHourInTimezone("Asia/Taipei");
	const defaultLabel = `${taipeiHour.toString().padStart(2, "0")}:00`;
	const label = options.label || defaultLabel;
	const startTime = Date.now();

	if (!hasDailyData) {
		if (manualMode) {
			system.logStart(label, options.initiatedBy);
			await system.updateStatistics(startTime, label);
		}
		return system.getStats();
	}

	system.logStart(label, options.initiatedBy);

	for (const userId of Object.keys(dailyData)) {
		const userCfg = dailyData[userId] || ({} as any);
		const scheduledTimeStr = userCfg.time || "13";
		const parsedTime = parseInt(scheduledTimeStr, 10);
		const scheduledTime = Number.isNaN(parsedTime) ? 13 : parsedTime;
		const timeZone = normalizeTimeZone((userCfg as any).timeZone);

		const userHour = getHourInTimezone(timeZone);
		const userDateKey = getDateKeyInTimezone(timeZone);

		const lastSignedDateKey = await (system as any).db.get(
			`lastSignedDate:${userId}`
		);
		const signedToday = lastSignedDateKey === userDateKey;

		const shouldProcessManual =
			Boolean(options.all) ||
			normalizedManualHours.includes(scheduledTime);
		const shouldProcessAuto =
			!manualMode &&
			Number.isFinite(scheduledTime) &&
			userHour >= scheduledTime;

		if (manualMode) {
			if (!shouldProcessManual) {
				continue;
			}
		} else if (!shouldProcessAuto) {
			continue;
		}

		if (!manualMode) {
			if (signedToday && !options.force) {
				continue;
			}
		}

		try {
			const processed = await system.processDailySign(userId, dailyData);
			if (processed) {
				await (system as any).db.set(
					`lastSignedDate:${userId}`,
					userDateKey
				);
			}
		} catch (error) {
			(system as any).logger.error(
				`處理用戶 ${userId} 時發生錯誤: ${(error as Error).message}`
			);
		}
	}

	await system.updateStatistics(startTime, label);
	return system.getStats();
}
