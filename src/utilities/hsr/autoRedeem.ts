import { client, cluster, database } from "@/index.js";
import { Client, EmbedBuilder } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserLang,
	getRandomColor,
	getRedeemCodes,
	autoRefreshCookie
} from "@/utilities/index.js";

// Constants
const CONFIG = {
	TAIPEI_TIMEZONE: "Asia/Taipei",
	API_TIMEOUT: 10000,
	REDEEM_DELAY: 3000,
	COOKIE_REFRESH_RETRY_INTERVAL: 6 * 60 * 60 * 1000,
	DEFAULT_LANGUAGE: "en",
	ERROR_CODES: {
		ALREADY_CLAIMED: -2017,
		CODE_CLAIMED: -2018,
		CODE_INVALID: -2001,
		CODE_EXPIRED: -2006,
		COOKIE_EXPIRED_VERIFY: -100,
		RISK_CONTROL_BLOCKED: -502
	}
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
		riskBlocked: boolean;
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
	hasResults: boolean;
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


	async shouldRetryCookieRefresh(uid: string): Promise<boolean> {
		const lastAttempt = await this.db.get(`${uid}.lastCookieRefreshAttempt`);
		if (!lastAttempt) return true;
		const elapsed = Date.now() - Number(lastAttempt);
		return elapsed >= CONFIG.COOKIE_REFRESH_RETRY_INTERVAL;
	}

	async markCookieRefreshAttempt(uid: string): Promise<void> {
		await this.db.set(`${uid}.lastCookieRefreshAttempt`, Date.now());
	}

	async processCode(
		code: RedeemCode,
		account: Account,
		userId: string
	): Promise<RedeemResult> {
		try {
			const uid = account.uid;
			let region = "prod_official_asia";
			if (uid.startsWith("6")) region = "prod_official_usa";
			else if (uid.startsWith("7")) region = "prod_official_eur";
			else if (uid.startsWith("8")) region = "prod_official_asia";
			else if (uid.startsWith("9")) region = "prod_official_cht";

			const url =
				"https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk";
			const params = new URLSearchParams({
				uid: String(uid),
				region,
				lang: "zh-tw",
				cdkey: code.code,
				game_biz: "hkrpg_global",
				t: String(Date.now())
			});

			const response = await fetch(`${url}?${params.toString()}`, {
				method: "POST",
				headers: {
					cookie: account.cookie
				}
			});

			const result = (await response.json()) as any;

			const status = {
				success: result.retcode === 0 || result.message === "OK",
				alreadyClaimed: [
					CONFIG.ERROR_CODES.ALREADY_CLAIMED,
					CONFIG.ERROR_CODES.CODE_CLAIMED
				].includes(result.retcode),
				invalid: [
					CONFIG.ERROR_CODES.CODE_INVALID,
					CONFIG.ERROR_CODES.CODE_EXPIRED,
					-2003
				].includes(result.retcode),
				riskBlocked:
					result.retcode === CONFIG.ERROR_CODES.RISK_CONTROL_BLOCKED,
				tokenInvalid: [CONFIG.ERROR_CODES.COOKIE_EXPIRED_VERIFY, -1071].includes(
					result.retcode
				)
			};

			if (status.tokenInvalid) {
				await this.db.set(`${account.uid}.cookieExpired`, true);
			}

			return { code, status, message: result.message };
		} catch (error) {
			return {
				code,
				status: {
					success: false,
					alreadyClaimed: false,
					invalid: false,
					riskBlocked: false,
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
		hasResults: boolean;
	} {
		const description: string[] = [];
		const stats = { success: 0, alreadyClaimed: 0, invalid: 0, failed: 0 };

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
				// 失敗類型（包含 Cookie 待刷新、風控等）不推播到頻道
				stats.failed++;
			}
		});

		return {
			description: description.join("\n"),
			stats,
			hasResults: description.length > 0
		};
	}

	async processAccount(
		account: Account,
		codes: RedeemCode[],
		context: ProcessAccountContext
	): Promise<ProcessAccountResult | null> {
		const { userId, userLang, tr, accountIndex, accountNickname } = context;

		const isCookieExpired = await this.db.get(`${account.uid}.cookieExpired`);
		if (isCookieExpired) {
			const shouldRetry = await this.shouldRetryCookieRefresh(account.uid);
			if (!shouldRetry) {
				this.logger.info(
					`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 刷新冷卻中，跳過本次刷新嘗試`
				);
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					hasSuccess: false,
					hasResults: false
				};
			}

			await this.markCookieRefreshAttempt(account.uid);
			const refreshResult = await autoRefreshCookie(
				userId,
				accountIndex,
				account.cookie
			);

			if (!refreshResult.success) {
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					hasSuccess: false,
					hasResults: false
				};
			}

			const refreshedAccounts = await this.db.get(`${userId}.account`);
			if (!refreshedAccounts?.[accountIndex]) {
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					hasSuccess: false,
					hasResults: false
				};
			}

			account = refreshedAccounts[accountIndex];
		}

		const userRedeemedCodes: string[] =
			(await this.db.get(`${account.uid}.redeemedCodes`)) || [];
		const redeemedCodeSet = new Set(userRedeemedCodes);
		const unRedeemedCodes = codes.filter(
			code => !redeemedCodeSet.has(code.code)
		);

		if (!unRedeemedCodes || unRedeemedCodes.length === 0) {
			return {
				uid: account.uid,
				nickname: accountNickname,
				description: `ℹ️ ${tr("redeem_Already")}: ${codes.length} 個禮包碼已全部兌換`,
				hasSuccess: false,
				hasResults: true
			};
		}

		const results: RedeemResult[] = [];

		for (const code of unRedeemedCodes) {
			try {
				this.stats.total++;
				const result = await this.processCode(code, account, userId);

				if (
					result.status &&
					!result.status.failed &&
					(result.status.success ||
						result.status.alreadyClaimed ||
						result.status.invalid)
				) {
					redeemedCodeSet.add(code.code);
				}

				if (!result.status.tokenInvalid) {
					await this.db.delete(`${account.uid}.cookieExpired`);
				}

				if (result.status.tokenInvalid) {
					await this.db.set(`${account.uid}.cookieExpired`, true);
					return {
						uid: account.uid,
						nickname: accountNickname,
						description: "",
						hasSuccess: false,
						hasResults: false
					};
				}

				if (result.status.riskBlocked) {
					await this.db.delete(`${account.uid}.cookieExpired`);
					return {
						uid: account.uid,
						nickname: accountNickname,
						description: "",
						hasSuccess: false,
						hasResults: false
					};
				}

				results.push(result);
				await this.sleep(CONFIG.REDEEM_DELAY);
			} catch (error) {
				this.logger.error(
					`[用戶 ${userId}] [帳號 #${accountIndex}] 兌換出錯: ${code.code} - ${(error as any).message}`
				);
			}
		}

		await this.db.set(`${account.uid}.redeemedCodes`, [
			...redeemedCodeSet
		]);

		const { description, stats, hasResults } = this.formatResults(results, tr);

		Object.entries(stats).forEach(([key, value]) => {
			this.stats[key as keyof AutoRedeemStats] += value;
		});

		return {
			uid: account.uid,
			nickname: accountNickname || account.nickname || String(account.uid),
			description,
			hasSuccess: stats.success > 0,
			hasResults
		};
	}

	async sendRedeemMessage(
		channelId: string,
		data: {
			tr: (key: string, params?: any) => string;
			tag: string;
			description: string;
			hasSuccess: boolean;
		}
	): Promise<void> {
		const embed = new EmbedBuilder()
			.setColor(getRandomColor() as any)
			.setTitle(
				data.hasSuccess
					? data.tr("Auto") + data.tr("redeem_SuccessDesc")
					: data.tr("Auto") + data.tr("redeem_RedeemStats")
			)
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

				// 預檢查：先嘗試刷新已標記過期的 Cookie
				for (let i = 0; i < accounts.length; i++) {
					const account = accounts[i];
					if (!account || !account.uid || !account.cookie) continue;

					const isCookieExpired = await (system as any).db.get(
						`${account.uid}.cookieExpired`
					);
					if (!isCookieExpired) continue;

					const shouldRetry = await system.shouldRetryCookieRefresh(
						account.uid
					);
					if (!shouldRetry) continue;

					await system.markCookieRefreshAttempt(account.uid);
					await autoRefreshCookie(userId, i, account.cookie);
				}

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

				const visibleResults = successfulResults.filter(
					result => result.hasResults && Boolean(result.description?.trim())
				);

				if (visibleResults.length > 0) {
					const channelId = redeemData[userId]?.channelId || "";
					const tag =
						redeemData[userId]?.tag === "true"
							? `<@${userId}>`
							: "";
					const tr = createTranslator(userLang);
					const hasSuccess = visibleResults.some(
						result => result.hasSuccess
					);

					const description = visibleResults
						.map(
							result =>
								`## ${result.nickname || result.uid} (${result.uid})\n${result.description}`
						)
						.join("\n\n");

					await system.sendRedeemMessage(channelId, {
						tr,
						tag,
						description,
						hasSuccess
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
