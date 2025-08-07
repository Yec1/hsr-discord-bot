import { client, cluster, database } from "@/index.js";
import { Client, EmbedBuilder } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "@yeci226/hoyoapi";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserLang,
	getRandomColor,
	getRedeemCodes,
	updateCookie
} from "@/utilities/index.js";

// Constants
const CONFIG = {
	TAIPEI_TIMEZONE: "Asia/Taipei",
	API_TIMEOUT: 10000,
	REDEEM_DELAY: 3000,
	MAX_RETRIES: 3,
	DEFAULT_LANGUAGE: "en",
	ERROR_CODES: {
		ALREADY_CLAIMED: -2017,
		CODE_CLAIMED: -2018,
		CODE_INVALID: -2001,
		CODE_EXPIRED: -2006
	}
};

const LANGUAGE_MAPPING: { [key: string]: LanguageEnum } = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	default: LanguageEnum.ENGLISH
};

interface RedeemCode {
	code: string;
	status?: string;
	message?: string;
}

interface RedeemResult {
	code: RedeemCode;
	status: {
		success: boolean;
		alreadyClaimed: boolean;
		invalid: boolean;
		tokenInvalid: boolean;
		failed?: boolean;
	};
	message: string;
}

interface Account {
	uid: string;
	cookie: string;
	nickname?: string;
}

interface ProcessAccountContext {
	userId: string;
	userLang: string;
	tr: (key: string, params?: any) => string;
	accountIndex: number;
	accountNickname: string;
}

interface ProcessAccountResult {
	uid: string;
	nickname: string;
	description: string;
	hasSuccess: boolean;
}

interface AutoRedeemStats {
	total: number;
	success: number;
	failed: number;
	alreadyClaimed: number;
	invalid: number;
}

interface RedeemData {
	channelId: string;
	tag: string | boolean;
}

class AutoRedeemSystem {
	private client: Client;
	private db: any;
	private logger: Logger;
	public stats: AutoRedeemStats;

	constructor(client: Client) {
		this.client = client;
		this.db = database;
		this.logger = new Logger("自動兌換");
		this.stats = {
			total: 0,
			success: 0,
			failed: 0,
			alreadyClaimed: 0,
			invalid: 0
		};
	}

	getLanguage(locale: string): LanguageEnum {
		return (LANGUAGE_MAPPING[locale] || LANGUAGE_MAPPING.default) as any;
	}

	async sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async getUserPreferences(userId: string): Promise<{
		userLang: string;
		accounts: Account[];
	}> {
		try {
			const userLang =
				(await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
			const accounts = await this.db.get(`${userId}.account`);
			return { userLang, accounts };
		} catch (error) {
			this.logger.error(
				`獲取使用者偏好設定失敗: ${(error as any).message}`
			);
			return { userLang: CONFIG.DEFAULT_LANGUAGE, accounts: [] };
		}
	}

	async withRetry<T>(
		operation: () => Promise<T>,
		maxRetries = 3
	): Promise<T> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				if (attempt === maxRetries) throw error;
				await new Promise(resolve =>
					setTimeout(resolve, 1000 * attempt)
				);
			}
		}
		throw new Error("Max retries exceeded");
	}

	async processCode(
		hsr: HonkaiStarRail,
		code: RedeemCode,
		userRedeemedCodes: string[],
		uid: string
	): Promise<RedeemResult> {
		try {
			const result = await this.withRetry(() =>
				hsr.redeem.claim(code.code)
			);

			const status = {
				success: result.retcode === 0 || result.message === "OK",
				alreadyClaimed: [
					CONFIG.ERROR_CODES.ALREADY_CLAIMED,
					CONFIG.ERROR_CODES.CODE_CLAIMED
				].includes(result.retcode),
				invalid: [
					CONFIG.ERROR_CODES.CODE_INVALID,
					CONFIG.ERROR_CODES.CODE_EXPIRED
				].includes(result.retcode),
				tokenInvalid: result.retcode === -1071
			};

			if (status.success || status.alreadyClaimed || status.invalid) {
				userRedeemedCodes.push(code.code);
			}

			if (status.tokenInvalid) {
				await this.db.set(`${uid}.cookieExpired`, true);
			}

			return { code, status, message: result.message };
		} catch (error) {
			return {
				code,
				status: {
					success: false,
					alreadyClaimed: false,
					invalid: false,
					tokenInvalid: false,
					failed: true
				},
				message: (error as any).message
			};
		}
	}

	formatResults(
		results: RedeemResult[],
		tr: (key: string, params?: any) => string
	): {
		description: string;
		stats: {
			success: number;
			alreadyClaimed: number;
			invalid: number;
			failed: number;
		};
	} {
		const description: string[] = [];
		const stats = { success: 0, alreadyClaimed: 0, invalid: 0, failed: 0 };

		// 如果没有结果，返回默认描述
		if (!results || results.length === 0) {
			return {
				description: `ℹ️ 沒有需要兌換的禮包碼`,
				stats
			};
		}

		results.forEach(result => {
			const { code, status } = result;
			if (status.success) {
				description.push(
					`✅ **${code.code}** - (${tr("redeem_Success")})`
				);
				stats.success++;
			} else if (status.alreadyClaimed) {
				description.push(
					`ℹ️ **${code.code}** - (${tr("redeem_Already")})`
				);
				stats.alreadyClaimed++;
			} else if (status.invalid) {
				description.push(
					`⚠️ **${code.code}** - (${tr("redeem_Invalid")})`
				);
				stats.invalid++;
			} else {
				description.push(
					`❌ **${code.code}** - (${tr("redeem_Failed")})`
				);
				stats.failed++;
			}
		});

		if (description.length > 0) {
			description.push(`\n### ${tr("redeem_RedeemStats")}`);
			description.push(`✅ ${tr("redeem_Success")}: ${stats.success}`);
			description.push(
				`ℹ️ ${tr("redeem_Already")}: ${stats.alreadyClaimed}`
			);
			description.push(`⚠️ ${tr("redeem_Invalid")}: ${stats.invalid}`);
			description.push(`❌ ${tr("redeem_Failed")}: ${stats.failed}`);
		}

		return { description: description.join("\n"), stats };
	}

	async processAccount(
		account: Account,
		codes: RedeemCode[],
		context: ProcessAccountContext
	): Promise<ProcessAccountResult | null> {
		const { userId, userLang, tr, accountIndex, accountNickname } = context;

		const isCookieExpired = await this.db.get(
			`${account.uid}.cookieExpired`
		);
		if (isCookieExpired) {
			this.logger.info(
				`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 已標記為過期，跳過處理`
			);
			return null;
		}

		const hsr = new HonkaiStarRail({
			uid: parseInt(account.uid),
			cookie: account.cookie,
			lang: this.getLanguage(userLang)
		});

		let userRedeemedCodes =
			(await this.db.get(`${account.uid}.redeemedCodes`)) || [];
		const unRedeemedCodes = codes.filter(
			code => !userRedeemedCodes.includes(code.code)
		);

		this.logger.info(
			`[用戶 ${userId}] [帳號 #${accountIndex}] 檢查到 ${codes.length} 個禮包碼，其中 ${unRedeemedCodes.length} 個未兌換`
		);

		// 檢查是否需要更新Cookie（無論是否有未兌換的禮包碼）
		const lastCookieRefresh =
			(await this.db.get(`${account.uid}.lastCookieRefresh`)) || 0;
		const currentTime = Date.now();
		const oneDayInMs = 24 * 60 * 60 * 1000; // 24小时的毫秒数
		const shouldRefreshCookie =
			currentTime - lastCookieRefresh >= oneDayInMs;

		if (!unRedeemedCodes || unRedeemedCodes.length === 0) {
			try {
				// 如果距离上次刷新已经过了24小时，则刷新Cookie
				if (shouldRefreshCookie) {
					// 確保 account.cookie 是字符串類型
					if (!account.cookie || typeof account.cookie !== "string") {
						this.logger.error(
							`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 格式無效: ${typeof account.cookie}`
						);
						return null;
					}

					await updateCookie(userId, accountIndex, account.cookie);
					await this.db.set(
						`${account.uid}.lastCookieRefresh`,
						currentTime
					);
					this.logger.success(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 沒有未兌換的禮包碼，已刷新Cookie以防止過期`
					);
				} else {
					this.logger.info(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 沒有未兌換的禮包碼，且Cookie最近已刷新，跳過`
					);
				}
			} catch (error) {
				this.logger.error(
					`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 刷新失敗: ${(error as any).message}`
				);
			}
			return {
				uid: account.uid,
				nickname: accountNickname,
				description: `ℹ️ ${tr("redeem_Already")}: ${codes.length} 個禮包碼已全部兌換`,
				hasSuccess: false
			};
		}

		this.logger.info(
			`[用戶 ${userId}] [帳號 #${accountIndex}] 發現 ${unRedeemedCodes.length} 個未兌換的禮包碼，開始兌換`
		);

		const results: RedeemResult[] = [];
		let hasSuccessfulRedeem = false;

		for (const code of unRedeemedCodes) {
			try {
				this.stats.total++;
				this.logger.info(
					`[用戶 ${userId}] [帳號 #${accountIndex}] 正在兌換: ${code.code}`
				);
				const result = await this.processCode(
					hsr,
					code,
					userRedeemedCodes,
					account.uid
				);
				if (result.status.tokenInvalid) {
					this.logger.warn(
						`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 已過期，跳過兌換流程`
					);
					await this.db.set(`${account.uid}.cookieExpired`, true);
					return {
						uid: account.uid,
						nickname: accountNickname,
						description: `❌ Cookie 已過期，無法兌換禮包碼`,
						hasSuccess: false
					};
				}

				if (result.status.success) {
					this.logger.success(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 兌換成功: ${code.code}`
					);
					hasSuccessfulRedeem = true;
				} else if (result.status.alreadyClaimed) {
					this.logger.info(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 已經兌換過: ${code.code}`
					);
				} else if (result.status.invalid) {
					this.logger.warn(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 無效的禮包碼: ${code.code}`
					);
				} else {
					this.logger.error(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 兌換失敗: ${code.code} - ${result.message}`
					);
					await this.db.set(`${account.uid}.cookieExpired`, true);
				}

				results.push(result);
				await new Promise(resolve =>
					setTimeout(resolve, CONFIG.REDEEM_DELAY)
				);
			} catch (error) {
				this.logger.error(
					`[用戶 ${userId}] [帳號 #${accountIndex}] 兌換出錯: ${code.code} - ${(error as any).message}`
				);
			}
		}

		// 更新Cookie的邏輯：無論是否有成功兌換，都定期更新Cookie
		try {
			if (hasSuccessfulRedeem || shouldRefreshCookie) {
				// 確保 account.cookie 是字符串類型
				if (!account.cookie || typeof account.cookie !== "string") {
					this.logger.error(
						`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 格式無效: ${typeof account.cookie}`
					);
					return null;
				}

				await updateCookie(userId, accountIndex, account.cookie);
				await this.db.set(
					`${account.uid}.lastCookieRefresh`,
					currentTime
				);
				this.logger.success(
					`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 更新成功`
				);
			}
		} catch (error) {
			this.logger.error(
				`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 更新失敗: ${(error as any).message}`
			);
		}

		await this.db.set(`${account.uid}.redeemedCodes`, [
			...new Set(userRedeemedCodes)
		]);

		const { description, stats } = this.formatResults(results, tr);

		Object.entries(stats).forEach(([key, value]) => {
			this.stats[key as keyof AutoRedeemStats] += value;
		});

		return {
			uid: account.uid,
			nickname: accountNickname,
			description,
			hasSuccess: stats.success > 0
		};
	}

	async sendRedeemMessage(
		channelId: string,
		data: {
			tr: (key: string, params?: any) => string;
			tag: string;
			description: string;
		}
	): Promise<void> {
		const embed = new EmbedBuilder()
			.setColor(getRandomColor() as any)
			.setTitle(data.tr("Auto") + data.tr("redeem_SuccessDesc"))
			.setDescription(data.description)
			.setThumbnail(
				"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
			)
			.setTimestamp();

		try {
			await cluster.broadcastEval(
				async (c: any, { channelId, content, embed }: any) => {
					const channel = c.channels.cache.get(channelId);
					if (channel)
						await channel.send({ content, embeds: [embed] });
				},
				{
					context: { channelId, content: data.tag || "", embed },
					timeout: CONFIG.API_TIMEOUT
				}
			);
		} catch (error) {
			this.logger.error(
				`發送訊息至頻道 ${channelId} 時發生錯誤: ${(error as any).message}`
			);
		}
	}

	async updateStatistics(nowTime: string): Promise<void> {
		this.logger.info("========== 自動兌換統計 ==========");
		this.logger.info(`時間: ${nowTime}:00`);
		this.logger.info(`總計處理: ${this.stats.total} 個禮包碼`);
		this.logger.success(`成功兌換: ${this.stats.success} 個`);
		this.logger.info(`已兌換過: ${this.stats.alreadyClaimed} 個`);
		this.logger.warn(`無效代碼: ${this.stats.invalid} 個`);
		this.logger.error(`兌換失敗: ${this.stats.failed} 個`);

		// 如果没有处理任何礼包码，说明可能所有用户都已经兑换过了
		if (this.stats.total === 0) {
			this.logger.info(
				"所有用戶的禮包碼都已兌換完畢，或沒有有效的兌換碼"
			);
		}

		this.logger.info("================================");
	}
}

export default async function autoRedeem(): Promise<void> {
	const system = new AutoRedeemSystem(client as Client);

	const redeemData: { [key: string]: RedeemData } = await (
		system as any
	).db.get("autoRedeem");
	if (!redeemData) {
		(system as any).logger.warn("沒有找到需要自動兌換的用戶數據");
		return;
	}

	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	(system as any).logger.info("========== 開始自動兌換 ==========");
	(system as any).logger.info(`執行時間: ${currentHour}:00`);
	(system as any).logger.info(
		`需要處理的用戶數量: ${Object.keys(redeemData).length}`
	);

	try {
		const codesList = await getRedeemCodes();
		(system as any).logger.info(`已獲取 ${codesList.length} 個禮包碼`);

		let processedUsers = 0;
		let processedAccounts = 0;

		for (const userId of Object.keys(redeemData)) {
			try {
				(system as any).logger.info(`開始處理用戶 ${userId}`);
				const { userLang, accounts } =
					await system.getUserPreferences(userId);

				if (!accounts?.length) {
					(system as any).logger.warn(
						`用戶 ${userId} 沒有有效的帳號配置`
					);
					continue;
				}

				(system as any).logger.info(
					`用戶 ${userId} 有 ${accounts.length} 個帳號需要處理`
				);

				const accountPromises = accounts.map(
					async (account: Account, index: number) => {
						if (!account || !account.uid || !account.cookie) {
							(system as any).logger.warn(
								`用戶 ${userId} 的帳號 #${index} 配置無效`
							);
							return null;
						}

						try {
							processedAccounts++;
							const result = await system.processAccount(
								account,
								codesList,
								{
									userId,
									userLang,
									tr: createTranslator(userLang),
									accountIndex: index,
									accountNickname:
										account.nickname || `Account #${index}`
								}
							);

							if (result) {
								(system as any).logger.info(
									`用戶 ${userId} 帳號 #${index} 處理完成: ${result.description}`
								);
							}

							return result;
						} catch (error) {
							(system as any).logger.error(
								`使用者 ${userId} 的帳號 #${index} 處理失敗: ${(error as any).message}`
							);
							system.stats.failed++;
							return null;
						}
					}
				);

				const results = await Promise.allSettled(accountPromises);
				const successfulResults = results
					.filter(
						result => result.status === "fulfilled" && result.value
					)
					.map(
						result =>
							(
								result as PromiseFulfilledResult<ProcessAccountResult>
							).value
					);

				// 如果有成功的兑换，发送消息
				if (successfulResults.some(result => result.hasSuccess)) {
					const channelId = redeemData[userId]?.channelId || "";
					const tag =
						redeemData[userId]?.tag === "true"
							? `<@${userId}>`
							: "";
					const tr = createTranslator(userLang);

					const description = successfulResults
						.filter(result => result.hasSuccess)
						.map(result => result.description)
						.join("\n\n");

					await system.sendRedeemMessage(channelId, {
						tr,
						tag,
						description
					});
				}

				processedUsers++;
			} catch (error) {
				(system as any).logger.error(
					`處理用戶 ${userId} 時發生錯誤: ${(error as any).message}`
				);
			}
		}

		(system as any).logger.info(
			`處理完成: ${processedUsers} 個用戶，${processedAccounts} 個帳號`
		);
		await system.updateStatistics(currentHour);
	} catch (error) {
		(system as any).logger.error("自動兌換過程中發生錯誤:");
		(system as any).logger.error((error as any).message);
	}
	(system as any).logger.info("========== 自動兌換結束 ==========");
}
