import { client } from "../../index.js";
import { EmbedBuilder } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "@yeci226/hoyoapi";
import Logger from "../core/logger.js";
import { i18nMixin } from "../core/i18n.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor,
	getRedeemCodes,
	updateCookie
} from "../utilities.js";

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

const LANGUAGE_MAPPING = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	default: LanguageEnum.ENGLISH
};

class AutoRedeemSystem {
	constructor(client) {
		this.client = client;
		this.db = client.db;
		this.logger = new Logger("自動兌換");
		this.stats = {
			total: 0,
			success: 0,
			failed: 0,
			alreadyClaimed: 0,
			invalid: 0
		};
	}

	getLanguage(locale) {
		return LANGUAGE_MAPPING[locale] || LANGUAGE_MAPPING.default;
	}

	async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async getUserPreferences(userId) {
		try {
			const userLang =
				(await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
			const accounts = await this.db.get(`${userId}.account`);
			return { userLang, accounts };
		} catch (error) {
			this.logger.error(`獲取使用者偏好設定失敗: ${error.message}`);
			return { userLang: CONFIG.DEFAULT_LANGUAGE, accounts: [] };
		}
	}

	async withRetry(operation, maxRetries = 3) {
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
	}

	async processCode(hsr, code, userRedeemedCodes, uid) {
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
			return { code, status: { failed: true }, message: error.message };
		}
	}

	formatResults(results, tr) {
		const description = [];
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

	async processAccount(account, codes, context) {
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
			uid: account.uid,
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
					`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 刷新失敗: ${error.message}`
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

		const results = [];
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
					`[用戶 ${userId}] [帳號 #${accountIndex}] 兌換出錯: ${code.code} - ${error.message}`
				);
			}
		}

		// 更新Cookie的邏輯：無論是否有成功兌換，都定期更新Cookie
		try {
			if (hasSuccessfulRedeem || shouldRefreshCookie) {
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
				`[用戶 ${userId}] [帳號 #${accountIndex}] Cookie 更新失敗: ${error.message}`
			);
		}

		await this.db.set(`${account.uid}.redeemedCodes`, [
			...new Set(userRedeemedCodes)
		]);

		const { description, stats } = this.formatResults(results, tr);

		Object.entries(stats).forEach(([key, value]) => {
			this.stats[key] += value;
		});

		return {
			uid: account.uid,
			nickname: accountNickname,
			description,
			hasSuccess: stats.success > 0
		};
	}

	async sendRedeemMessage(channelId, data) {
		const embed = new EmbedBuilder()
			.setColor(getRandomColor())
			.setTitle(data.tr("Auto") + data.tr("redeem_SuccessDesc"))
			.setDescription(data.description)
			.setThumbnail(
				"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
			)
			.setTimestamp();

		try {
			await this.client.cluster.broadcastEval(
				async (c, { channelId, content, embed }) => {
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
				`發送訊息至頻道 ${channelId} 時發生錯誤: ${error.message}`
			);
		}
	}

	async updateStatistics(nowTime) {
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

export default async function autoRedeem() {
	const system = new AutoRedeemSystem(client);

	const redeemData = await system.db.get("autoRedeem");
	if (!redeemData) {
		system.logger.warn("沒有找到需要自動兌換的用戶數據");
		return;
	}

	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	system.logger.info("========== 開始自動兌換 ==========");
	system.logger.info(`執行時間: ${currentHour}:00`);
	system.logger.info(`需要處理的用戶數量: ${Object.keys(redeemData).length}`);

	try {
		const codesList = await getRedeemCodes();
		system.logger.info(`已獲取 ${codesList.length} 個禮包碼`);

		let processedUsers = 0;
		let processedAccounts = 0;

		for (const userId of Object.keys(redeemData)) {
			try {
				system.logger.info(`開始處理用戶 ${userId}`);
				const { userLang, accounts } =
					await system.getUserPreferences(userId);

				if (!accounts?.length) {
					system.logger.warn(`用戶 ${userId} 沒有有效的帳號配置`);
					continue;
				}

				system.logger.info(
					`用戶 ${userId} 有 ${accounts.length} 個帳號需要處理`
				);

				const accountPromises = accounts.map(async (account, index) => {
					if (!account || !account.uid || !account.cookie) {
						system.logger.warn(
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
								tr: i18nMixin(userLang),
								accountIndex: index,
								accountNickname: account.nickname
							}
						);

						if (result) {
							system.logger.info(
								`用戶 ${userId} 帳號 #${index} 處理完成: ${result.description}`
							);
						}

						return result;
					} catch (error) {
						system.logger.error(
							`使用者 ${userId} 的帳號 #${index} 處理失敗: ${error.message}`
						);
						system.stats.failed++;
						return null;
					}
				});

				const results = await Promise.allSettled(accountPromises);
				const successfulResults = results
					.filter(
						result => result.status === "fulfilled" && result.value
					)
					.map(result => result.value);

				// 如果有成功的兑换，发送消息
				if (successfulResults.some(result => result.hasSuccess)) {
					const channelId = redeemData[userId].channelId;
					const tag =
						redeemData[userId].tag === "true" ? `<@${userId}>` : "";
					const tr = i18nMixin(userLang);

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
				system.logger.error(
					`處理用戶 ${userId} 時發生錯誤: ${error.message}`
				);
			}
		}

		system.logger.info(
			`處理完成: ${processedUsers} 個用戶，${processedAccounts} 個帳號`
		);
		await system.updateStatistics(currentHour);
	} catch (error) {
		system.logger.error("自動兌換過程中發生錯誤:");
		system.logger.error(error.message);
	}
	system.logger.info("========== 自動兌換結束 ==========");
}
