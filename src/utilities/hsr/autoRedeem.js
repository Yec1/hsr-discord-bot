import { client } from "../../index.js";
import { EmbedBuilder } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { Logger } from "../core/logger.js";
import { i18nMixin } from "../core/i18n.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor,
	getRedeemCodes
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
	vi: LanguageEnum.VIETNAMESE,
	jp: LanguageEnum.JAPANESE,
	kr: LanguageEnum.KOREAN,
	fr: LanguageEnum.FRENCH,
	default: LanguageEnum.ENGLISH
};

class AutoRedeemSystem {
	constructor(client) {
		this.client = client;
		this.db = client.db;
		this.logger = new Logger("AutoRedeem");
		this.stats = {
			total: 0,
			success: 0,
			failed: 0
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
			this.logger.error(
				`Failed to get user preferences for ${userId}: ${error.message}`
			);
			return {
				userLang: CONFIG.DEFAULT_LANGUAGE,
				accounts: []
			};
		}
	}

	async processRedemption(userId, redeemData, codesList) {
		const { userLang, accounts } = await this.getUserPreferences(userId);
		if (!accounts?.length) return;

		const channelId = redeemData[userId].channelId;
		const tag = redeemData[userId].tag === "true" ? `<@${userId}>` : "";
		const tr = i18nMixin(userLang);

		const accountPromises = accounts.map(async (account, index) => {
			const cookie = await getUserCookie(userId, index);
			const uid = await getUserUid(userId, index);
			const redeemedCodes =
				(await this.db.get(`${uid}.redeemedCodes`)) || [];

			if (!cookie || !uid) return;

			try {
				await this.redeemCodesForAccount(
					account,
					codesList,
					redeemedCodes,
					{
						userId,
						channelId,
						tag,
						tr,
						userLang
					}
				);
			} catch (error) {
				console.log(error);
				this.logger.error(
					`Failed to process account ${uid}: ${error.message}`
				);
				this.stats.failed++;
			}
		});

		await Promise.allSettled(accountPromises);
	}

	async redeemCodesForAccount(
		account,
		codesList,
		userRedeemedCodes,
		context
	) {
		this.stats.total++;

		const unredeemedCodes = codesList.filter(
			code => !userRedeemedCodes.includes(code.code)
		);

		if (!unredeemedCodes.length) return;

		const hsr = new HonkaiStarRail({
			uid: account.uid,
			cookie: account.cookie,
			lang: this.getLanguage(context.userLang)
		});

		const results = {
			success: [],
			alreadyClaimed: [],
			invalid: [],
			failed: []
		};

		const description = [
			`<@${context.userId}> - ${account.nickname ? `- ${account.nickname}` : ""} (${account.uid})`
		];

		for (const code of unredeemedCodes) {
			try {
				const result = await this.attemptCodeRedeem(
					hsr,
					code.code,
					CONFIG.MAX_RETRIES
				);

				if (result.success) {
					results.success.push(code);
					userRedeemedCodes.push(code.code);
					description.push(
						`✅ **${code.code}** - (${context.tr("redeem_Success")})`
					);
				} else {
					if (
						result.retcode === CONFIG.ERROR_CODES.ALREADY_CLAIMED ||
						result.retcode === CONFIG.ERROR_CODES.CODE_CLAIMED
					) {
						results.alreadyClaimed.push(code);
						userRedeemedCodes.push(code.code);
						description.push(
							`ℹ️ **${code.code}** - (${context.tr("redeem_Already")})`
						);
					} else if (
						[
							CONFIG.ERROR_CODES.CODE_INVALID,
							CONFIG.ERROR_CODES.CODE_EXPIRED
						].includes(result.retcode)
					) {
						results.invalid.push(code);
						userRedeemedCodes.push(code.code);
						description.push(
							`⚠️ **${code.code}** - (${context.tr("redeem_Invalid")})`
						);
					} else {
						results.failed.push(code);
						this.stats.failed++;
						description.push(
							`❌ **${code.code}** - (${context.tr("redeem_Failed")})`
						);
					}
				}

				await this.sleep(CONFIG.REDEEM_DELAY);
			} catch (error) {
				results.failed.push(code);
				this.stats.failed++;
				this.logger.error(
					`Failed to redeem code ${code.code}: ${error.message}`
				);
				description.push(`❌ **${code.code}** - ${error.message}`);
			}
		}

		await this.updateUserRedeemedCodes(account.uid, userRedeemedCodes);

		if (results.success.length > 0) {
			this.stats.success++;
		}

		// 加入統計資訊
		if (unredeemedCodes.length > 0) {
			description.push(`\n### ${context.tr("redeem_RedeemStats")}`);
			description.push(
				`✅ ${context.tr("redeem_Success")}: ${results.success.length}`
			);
			description.push(
				`ℹ️ ${context.tr("redeem_Already")}: ${results.alreadyClaimed.length}`
			);
			description.push(
				`⚠️ ${context.tr("redeem_Invalid")}: ${results.invalid.length}`
			);
			description.push(
				`❌ ${context.tr("redeem_Failed")}: ${results.failed.length}`
			);
		}

		if (results.success.length > 0) {
			// 有成功兌換的才發送訊息
			await this.sendRedeemSuccessMessage(context.channelId, {
				tag: context.tag,
				tr: context.tr,
				description: description.join("\n")
			});
		}
	}

	async attemptCodeRedeem(hsr, code, retries = 3) {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				const res = await hsr.redeem.claim(code);

				if (res.retcode === 0 || res.message === "OK") {
					return { success: true };
				}

				return {
					success: false,
					retcode: res.retcode,
					message: res.message || "Unknown error"
				};
			} catch (error) {
				if (attempt === retries - 1) {
					return {
						success: false,
						failed: true,
						message: error.message
					};
				}
				await this.sleep(1000 * (attempt + 1));
			}
		}
	}

	async updateUserRedeemedCodes(uid, codes) {
		try {
			const uniqueCodes = [...new Set(codes)];
			await this.db.set(`${uid}.redeemedCodes`, uniqueCodes);
		} catch (error) {
			this.logger.error(
				`Failed to update redeemed codes for ${uid}: ${error.message}`
			);
		}
	}

	async sendRedeemSuccessMessage(channelId, data) {
		const embed = new EmbedBuilder()
			.setColor(getRandomColor())
			.setTitle(data.tr("Auto") + data.tr("redeem_SuccessDesc"))
			.setThumbnail(
				"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
			)
			.setDescription(data.description)
			.setTimestamp(); // 加入時間戳記

		const content = data.tag ?? "";

		try {
			await this.client.cluster.broadcastEval(
				async (c, { channelId, content, embeds }) => {
					const channel = c.channels.cache.get(channelId);
					if (channel) {
						await channel.send({ content, embeds });
					}
				},
				{
					context: {
						channelId,
						content: content,
						embeds: [embed]
					},
					timeout: CONFIG.API_TIMEOUT
				}
			);
		} catch (error) {
			this.logger.error(
				`Failed to send success message to channel ${channelId}: ${error.message}`
			);
		}
	}

	async updateStatistics(nowTime) {
		this.logger.success(
			`Completed ${nowTime}:00 auto redemption: ${this.stats.total} total, ` +
				`${this.stats.success} successful, ${this.stats.failed} failed`
		);
	}
}

export default async function autoRedeem() {
	const system = new AutoRedeemSystem(client);

	const redeemData = await system.db.get("autoRedeem");
	if (!redeemData) return;

	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	system.logger.info(`Starting ${currentHour}:00 auto redemption`);

	try {
		const codesList = await getRedeemCodes();

		for (const userId of Object.keys(redeemData)) {
			try {
				await system.processRedemption(userId, redeemData, codesList);
			} catch (error) {
				system.logger.error(
					`Error processing user ${userId}: ${error.message}`
				);
			}
		}

		await system.updateStatistics(currentHour);
	} catch (error) {
		system.logger.error(`Auto redemption failed: ${error.message}`);
	}
}
