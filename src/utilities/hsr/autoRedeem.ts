import { client, cluster, database } from "@/index.js";
import { Client, EmbedBuilder } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserLang,
	getRedeemCodes,
	autoRefreshCookie
} from "@/utilities/index.js";
import { buildHSRRedeemCard } from "@/utilities/canvas/redeemCard.js";

// Constants
const CONFIG = {
	TAIPEI_TIMEZONE: "Asia/Taipei",
	API_TIMEOUT: 10000,
	REDEEM_DELAY: 3000,
	ACCOUNT_DELAY: 5000,
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
	codeResults: Array<{ code: string; rewards?: string; status: "success" | "already_claimed" | "invalid" | "failed" }>;
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
		const lastAttempt = await this.db.get(
			`${uid}.lastCookieRefreshAttempt`
		);
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
					cookie: account.cookie,
					"x-rpc-signgame": "hkrpg",
					"x-rpc-app_id": "c9oqaq3s3gu8",
					"x-rpc-client_type": "4"
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
				tokenInvalid: [
					CONFIG.ERROR_CODES.COOKIE_EXPIRED_VERIFY,
					-1071
				].includes(result.retcode)
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
		codeResults: Array<{ code: string; rewards?: string; status: "success" | "already_claimed" | "invalid" | "failed" }>;
		stats: {
			success: number;
			alreadyClaimed: number;
			invalid: number;
			failed: number;
		};
		hasResults: boolean;
	} {
		const description: string[] = [];
		const codeResults: Array<{ code: string; rewards?: string; status: "success" | "already_claimed" | "invalid" | "failed" }> = [];
		const stats = { success: 0, alreadyClaimed: 0, invalid: 0, failed: 0 };

		results.forEach(result => {
			const { code, status } = result;
			if (status.success) {
				description.push(
					`✅**${code.code}** - (${tr("redeem_Success")})`
				);
				codeResults.push({ code: code.code, rewards: (code as any).rewards, status: "success" });
				stats.success++;
			} else if (status.alreadyClaimed) {
				// 已兌換：默默跳過不推送通知（已加入 redeemedCodes，下次不會再試）
				stats.alreadyClaimed++;
			} else if (status.invalid) {
				description.push(
					`❌ **${code.code}** - (${tr("redeem_Invalid")})`
				);
				codeResults.push({ code: code.code, rewards: (code as any).rewards, status: "invalid" });
				stats.invalid++;
			} else {
				// 失敗類型（如 Cookie 待刷新、風控）不廣播至頻道
				stats.failed++;
			}
		});

		return {
			description: description.join("\n"),
			codeResults,
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

		const isCookieExpired = await this.db.get(
			`${account.uid}.cookieExpired`
		);
		if (isCookieExpired) {
			// 若之前已確認無法自動刷新（需人工介入），直接跳過
			const needsManualUpdate = await this.db.get(`${account.uid}.needsCookieUpdate`);
			if (needsManualUpdate) {
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					codeResults: [],
					hasSuccess: false,
					hasResults: false
				};
			}

			const shouldRetry = await this.shouldRetryCookieRefresh(
				account.uid
			);
			if (!shouldRetry) {
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					codeResults: [],
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
					codeResults: [],
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
					codeResults: [],
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
				description: `✅ ${tr("redeem_Already")}: ${codes.length} 個禮包碼已全部兌換完畢`,
				codeResults: [],
				hasSuccess: false,
				hasResults: false
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
				this.logger.warn(
					`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 已失效（-100），標記待自動刷新並跳過`
				);
				return {
					uid: account.uid,
					nickname: accountNickname,
					description: "",
					codeResults: [],
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
						codeResults: [],
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

		await this.db.set(`${account.uid}.redeemedCodes`, [...redeemedCodeSet]);

		const { description, codeResults, stats, hasResults } = this.formatResults(
			results,
			tr
		);

		Object.entries(stats).forEach(([key, value]) => {
			this.stats[key as keyof AutoRedeemStats] += value;
		});

		return {
			uid: account.uid,
			nickname:
				accountNickname || account.nickname || String(account.uid),
			description,
			codeResults,
			hasSuccess: stats.success > 0,
			hasResults
		};
	}

	async sendRedeemMessage(
		channelId: string,
		data: {
			tr: (key: string, params?: any) => string;
			tag: string;
			accounts: Array<{ uid: string; codes: Array<{ code: string; rewards?: string; status: "success" | "already_claimed" | "invalid" | "failed" }> }>;
			hasSuccess: boolean;
		}
	): Promise<void> {
		let cardFile: { buffer: string; name: string } | null = null;
		try {
			const buf = await buildHSRRedeemCard({ accounts: data.accounts });
			cardFile = { buffer: buf.toString("base64"), name: "redeem-hsr.png" };
		} catch (e) {
			this.logger.error(`Redeem canvas card 生成失敗: ${e}`);
		}

		try {
			await cluster.broadcastEval(
				async (c: any, { channelId, content, cardFile }: any) => {
					const channel = c.channels.cache.get(channelId);
					if (!channel) return;
					const { AttachmentBuilder } = await import("discord.js");
					if (cardFile) {
						const file = new AttachmentBuilder(
							Buffer.from(cardFile.buffer, "base64"),
							{ name: cardFile.name }
						);
						await channel.send({ content: content || undefined, files: [file] });
					}
				},
				{
					context: { channelId, content: data.tag || "", cardFile },
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
		this.logger.info("========== 兌換碼統計 ==========");
		this.logger.info(`時間: ${nowTime}:00`);
		this.logger.info(`總處理數: ${this.stats.total} 個禮包碼`);
		this.logger.success(`兌換成功: ${this.stats.success} 個`);
		this.logger.info(`已兌換過: ${this.stats.alreadyClaimed} 個`);
		this.logger.warn(`無效碼數: ${this.stats.invalid} 個`);
		this.logger.error(`兌換失敗: ${this.stats.failed} 個`);

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
		(system as any).logger.warn("沒有找到需要自動兌換的用戶資料");
		return;
	}

	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	(system as any).logger.info("========== 自動兌換開始 ==========");
	(system as any).logger.info(`當前時間: ${currentHour}:00`);
	(system as any).logger.info(
		`需要處理的用戶數: ${Object.keys(redeemData).length}`
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
						`用戶 ${userId} 沒有已設置的帳號資料`
					);
					continue;
				}

				(system as any).logger.info(
					`用戶 ${userId} 有 ${accounts.length} 個帳號需要處理`
				);

				// 預先嘗試刷新已標記失效的 Cookie
				for (let i = 0; i < accounts.length; i++) {
					const account = accounts[i];
					if (!account || !account.uid || !account.cookie) continue;

					const isCookieExpired = await (system as any).db.get(
						`${account.uid}.cookieExpired`
					);
					if (!isCookieExpired) continue;

					// 若之前已確認無法自動刷新（需人工介入），跳過
					const needsManualUpdate = await (system as any).db.get(
						`${account.uid}.needsCookieUpdate`
					);
					if (needsManualUpdate) continue;

					const shouldRetry = await system.shouldRetryCookieRefresh(
						account.uid
					);
					if (!shouldRetry) continue;

					await system.markCookieRefreshAttempt(account.uid);
					await autoRefreshCookie(userId, i, account.cookie);
				}

			const successfulResults: ProcessAccountResult[] = [];
			for (let index = 0; index < accounts.length; index++) {
				const account = accounts[index];
				if (!account || !account.uid || !account.cookie) {
					(system as any).logger.warn(
						`用戶 ${userId} 的帳號 #${index} 設置無效`
					);
					continue;
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
							`用戶 ${userId} 帳號 #${index} 處理完畢: ${result.description}`
						);
						successfulResults.push(result);
					}
				} catch (error) {
					(system as any).logger.error(
						`使用者 ${userId} 的帳號 #${index} 處理失敗: ${(error as any).message}`
					);
					system.stats.failed++;
				}

				if (index < accounts.length - 1) {
					await system.sleep(CONFIG.ACCOUNT_DELAY);
				}
			}

				const visibleResults = successfulResults.filter(
					result =>
						result.hasResults && Boolean(result.description?.trim())
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

					const accounts = visibleResults.map(result => ({
						uid: result.uid,
						codes: result.codeResults || [],
					}));

					await system.sendRedeemMessage(channelId, {
						tr,
						tag,
						accounts,
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
			`處理完畢: ${processedUsers} 個用戶，${processedAccounts} 個帳號`
		);
		await system.updateStatistics(currentHour);
	} catch (error) {
		(system as any).logger.error("自動兌換流程中發生錯誤");
		(system as any).logger.error((error as any).message);
	}
	(system as any).logger.info("========== 自動兌換結束 ==========");
}
