import { client, cluster, database } from "@/index.js";
import { QuickDB } from "quick.db";
import { EmbedBuilder, WebhookClient, Client } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "@yeci226/hoyoapi";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor
} from "@/utilities/index.js";
import { loadConfig } from "@/utilities/core/config.js";

interface Config {
	TAIPEI_TIMEZONE: string;
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

interface SignInfo {
	total_sign_day: number;
	sign_cnt_missed: number;
	month_last_day: boolean;
}

interface SignReward {
	month: string;
}

interface SignRewards {
	awards: Array<{
		name: string;
		cnt: number;
		icon: string;
	}>;
}

interface MessageData {
	content: string;
	embeds: EmbedBuilder[];
}

interface Context {
	channelId: string;
	messageData: MessageData;
}

const config = loadConfig();

// Constants remain the same
const CONFIG: Config = {
	TAIPEI_TIMEZONE: "Asia/Taipei",
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
			"Not logged in",
			"未登入",
			"登入失敗",
			"Login failed",
			"Cookie 已過期",
			"Cookie expired",
			"無效的 Cookie",
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
	): Promise<void> {
		const accounts = await this.db.get(`${userId}.account`);
		if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
			return;
		}

		const userLang = (await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
		const tr = createTranslator(userLang);
		const channelId = dailyData[userId]?.channelId || "";
		const tag = dailyData[userId]?.tag === "true" ? `<@${userId}>` : "";

		// Process each account sequentially instead of concurrently
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
			cookie: account.cookie,
			lang: this.getLanguage(userLang)
		});

		try {
			// Get all required information first
			const [info, reward, rewards] = (await Promise.all([
				hsr.daily.info(),
				hsr.daily.reward(),
				hsr.daily.rewards()
			])) as any;

			// Perform the claim
			const result = (await hsr.daily.claim()) as SignResult;

			if (result.code === -5003 || result.info.is_sign === true) {
				this.stats.signed++;
				return;
			}

			// Get sign info for today and tomorrow
			const todaySign =
				rewards.awards[info.total_sign_day] || rewards.awards[0];
			const tmrSign =
				rewards.awards[info.total_sign_day + 1] || rewards.awards[1];

			this.stats.success++;

			await this.sendSuccessMessage(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor() as any)
						.setTitle(
							`${account.uid} ${tr("Auto")}${tr("daily_SignSuccess")}`
						)
						.setThumbnail(todaySign?.icon)
						.setDescription(
							`${tr("daily_Description", {
								a: `\`${todaySign?.name}x${todaySign?.cnt}\``
							})}${
								info.month_last_day
									? ""
									: `\n\n<@${userId}> ${tr(
											"daily_DescriptionTmr",
											{
												b: `\`${tmrSign?.name}x${tmrSign?.cnt}\``
											}
										)}`
							}`
						)
						.addFields(
							{
								name: `${reward.month} ${tr("daily_Month")}`,
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_SignedDay", {
									z: `\`${info.total_sign_day}\``
								}),
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_MissedDay", {
									z: `\`${info.sign_cnt_missed}\``
								}),
								value: "\u200b",
								inline: true
							}
						)
				]
			});
		} catch (error) {
			const errorMessage = (error as Error).message;

			if (this.isSkippableError(errorMessage)) {
				throw new Error(errorMessage); // 重新拋出，讓上層處理
			} else {
				throw new Error(`API 錯誤: ${errorMessage}`);
			}
		}
	}

	async sendSuccessMessage(
		channelId: string,
		messageData: MessageData
	): Promise<void> {
		try {
			await cluster.broadcastEval(
				async (c: any, context: any) => {
					const channel = c.channels.cache.get(context.channelId);
					if (channel) {
						await channel.send(context.messageData).catch(() => {});
					}
				},
				{
					context: { channelId, messageData },
					timeout: CONFIG.API_TIMEOUT
				}
			);
		} catch (error) {
			this.logger.error(
				`發送訊息至頻道 ${channelId} 時發生錯誤: ${(error as Error).message}`
			);
		}
	}

	// Statistics methods remain the same...
	async updateStatistics(
		startTime: number,
		currentHour: string
	): Promise<void> {
		const endTime = Date.now();
		const duration = (endTime - startTime) / 1000;
		const averageTime =
			this.stats.total > 0 ? duration / this.stats.total : 0;

		this.logger.success(
			`已完成 ${currentHour}:00 自動簽到: ${this.stats.total} 總數, ` +
				`${this.stats.success} 成功, ${this.stats.signed} 已簽到, ` +
				`${this.stats.skipped} 跳過, ${this.stats.failed} 失敗`
		);

		const statsEmbed = new EmbedBuilder()
			.setColor("#F2BE22")
			.setTitle(`${currentHour}:00 自動簽到統計`)
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
}

export default async function autoDailySign(): Promise<void> {
	const system = new AutoDailySignSystem(client, config.LOGWEBHOOK);
	await system.initialize();

	const dailyData = (await (system as any).db.get("autoDaily")) as DailyData;
	if (!dailyData) return;

	let currentDate = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		dateStyle: "full"
	});
	currentDate = currentDate.split(",")[0] || "";
	const lastDate = await (system as any).db.get("lastDate");
	if (currentDate !== lastDate) {
		await (system as any).db.set("lastDate", currentDate);
		await (system as any).db.delete("signedHour");
	}

	const signedHour = (await (system as any).db.get("signedHour")) || [];
	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	const startTime = Date.now();
	(system as any).logger.success(`開始 ${currentHour}:00 自動簽到`);

	for (const userId of Object.keys(dailyData)) {
		const scheduledTime = dailyData[userId]?.time || "13";

		if (parseInt(scheduledTime) === parseInt(currentHour)) {
			try {
				await system.processDailySign(userId, dailyData);
			} catch (error) {
				(system as any).logger.error(
					`處理用戶 ${userId} 時發生錯誤: ${(error as Error).message}`
				);
			}
		}
	}
	await (system as any).db.push("signedHour", parseInt(currentHour));

	const backfillHours = system.getBackfillHours(
		parseInt(currentHour),
		signedHour
	);

	if (backfillHours.length !== 0) {
		for (const hour of backfillHours) {
			if (hour === parseInt(currentHour)) continue;
			const usersToProcess = Object.keys(dailyData).filter(userId => {
				const scheduledTime = dailyData[userId]?.time || "13";
				return parseInt(scheduledTime) === parseInt(hour.toString());
			});
			if (usersToProcess.length === 0) continue;
			(system as any).logger.info(
				`${hour}:00 時段需要補簽，共 ${usersToProcess.length} 個用戶需要補簽`
			);

			for (const userId of usersToProcess) {
				try {
					await system.processDailySign(userId, dailyData);
				} catch (error) {
					(system as any).logger.error(
						`補簽用戶 ${userId} 時發生錯誤: ${(error as Error).message}`
					);
				}
			}

			await (system as any).db.push("signedHour", hour);
		}
	}

	await system.updateStatistics(startTime, currentHour);
}
