import { client } from "../../index.js";
import { EmbedBuilder } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
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

// 統一配置
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
		CODE_EXPIRED: -2006,
		COOKIE_INVALID: -1071,
		SYSTEM_BUSY: -1048
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
			failed: 0,
			already: 0
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
			return {
				userLang: CONFIG.DEFAULT_LANGUAGE,
				accounts: []
			};
		}
	}

	async handleRedeemResult(code, res, userRedeemedCodes, uid, tr) {
		let status = "failed";
		let message = "";

		switch (res.retcode) {
			case 0:
			case res.message === "OK":
				status = "success";
				message = tr("redeem_Success");
				this.stats.success++;
				break;
			case CONFIG.ERROR_CODES.ALREADY_CLAIMED:
			case CONFIG.ERROR_CODES.CODE_CLAIMED:
				status = "already";
				message = tr("redeem_Already");
				this.stats.already++;
				break;
			case CONFIG.ERROR_CODES.CODE_INVALID:
			case CONFIG.ERROR_CODES.CODE_EXPIRED:
				status = "invalid";
				message = tr("redeem_Invalid");
				break;
			case CONFIG.ERROR_CODES.COOKIE_INVALID:
				throw new Error(tr("redeem_CookieTokenInvalid"));
			case CONFIG.ERROR_CODES.SYSTEM_BUSY:
				throw new Error(tr("redeem_SystemBusy"));
			default:
				status = "failed";
				message = tr("redeem_Failed");
				this.stats.failed++;
		}

		if (status !== "failed" && !userRedeemedCodes.includes(code)) {
			userRedeemedCodes.push(code);
			await this.db.set(
				`${uid}.redeemedCodes`,
				Array.from(new Set(userRedeemedCodes))
			);
		}

		return { status, message };
	}

	async redeemCode(hsr, code, retries = CONFIG.MAX_RETRIES) {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				const res = await hsr.redeem.claim(code);
				return res;
			} catch (error) {
				if (attempt === retries - 1) throw error;
				await new Promise(resolve =>
					setTimeout(resolve, 1000 * (attempt + 1))
				);
			}
		}
	}

	async processAccount(userId, accountIndex, codes, tr) {
		const cookie = await getUserCookie(userId, accountIndex);
		const uid = await getUserUid(userId, accountIndex);

		if (!cookie || !uid) {
			this.logger.warn(`使用者 ${userId} 缺少 Cookie 或 UID `);
			return null;
		}

		const hsr = new HonkaiStarRail({
			uid,
			cookie,
			lang: this.getLanguage(tr.locale)
		});

		let userRedeemedCodes =
			(await this.db.get(`${uid}.redeemedCodes`)) || [];
		const unRedeemedCodes = codes.filter(
			code => !userRedeemedCodes.includes(code.code)
		);

		if (!unRedeemedCodes.length) {
			this.logger.info(
				`使用者 ${userId} 的帳號 #${accountIndex} 沒有未兌換的禮包碼，略過...`
			);
			return null;
		}
		this.logger.info(
			`使用者 ${userId} 的帳號 #${accountIndex} 有 ${unRedeemedCodes.length} 個未標記兌換的禮包碼，開始嘗試兌換...`
		);

		const results = [];
		let hasSuccessfulRedeem = false;

		for (const code of unRedeemedCodes) {
			try {
				this.logger.info(
					`• 使用者 ${userId} 的帳號 #${accountIndex} 正在嘗試兌換禮包碼 ${code.code}...`
				);
				const res = await this.redeemCode(hsr, code.code);
				const result = await this.handleRedeemResult(
					code.code,
					res,
					userRedeemedCodes,
					uid,
					tr
				);

				if (result.status === "success") hasSuccessfulRedeem = true;

				results.push({ code: code.code, ...result });
				await new Promise(resolve =>
					setTimeout(resolve, CONFIG.REDEEM_DELAY)
				);
			} catch (error) {
				this.logger.error(
					`兌換禮包碼 ${code.code} 失敗: ${error.message}`
				);
				results.push({
					code: code.code,
					status: "failed",
					message: error.message
				});
			}
		}

		if (hasSuccessfulRedeem) {
			try {
				await updateCookie(userId, accountIndex, hsr.cookie);
				this.logger.info(
					`使用者 ${userId} 的帳號 #${accountIndex} 成功兌換 ${results.filter(r => r.status === "success").length} 個禮包碼並更新 Cookie`
				);
			} catch (error) {
				this.logger.error(
					`使用者 ${userId} 的帳號 #${accountIndex} 更新 Cookie 失敗: ${error.message}`
				);
			}
		} else {
			this.logger.info(
				`使用者 ${userId} 的帳號 #${accountIndex} 沒有成功兌換任何禮包碼，略過...`
			);
		}

		return { uid, results };
	}

	async sendRedeemMessage(channelId, content, results, tr) {
		if (!results.some(r => r.status === "success")) return;

		const embed = new EmbedBuilder()
			.setColor(getRandomColor())
			.setTitle(tr("Auto") + tr("redeem_SuccessDesc"))
			.setDescription(this.formatResults(results, tr))
			.setThumbnail(
				"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
			)
			.setTimestamp();

		try {
			await this.client.cluster.broadcastEval(
				async (c, { channelId, content, embed }) => {
					const channel = c.channels.cache.get(channelId);
					if (channel) {
						await channel.send({ content, embeds: [embed] });
					}
				},
				{
					context: { channelId, content, embed },
					timeout: CONFIG.API_TIMEOUT
				}
			);
		} catch (error) {
			this.logger.error(
				`Failed to send message to channel ${channelId}: ${error.message}`
			);
		}
	}

	formatResults(results, tr) {
		const groups = {
			success: results.filter(r => r.status === "success"),
			already: results.filter(r => r.status === "already"),
			invalid: results.filter(r => r.status === "invalid"),
			failed: results.filter(r => r.status === "failed")
		};

		return [
			...groups.success.map(r => `✅ **${r.code}** (${r.message})`),
			...groups.already.map(r => `ℹ️ **${r.code}** (${r.message})`),
			...groups.invalid.map(r => `⚠️ **${r.code}** (${r.message})`),
			...groups.failed.map(r => `❌ **${r.code}** (${r.message})`),
			`\n### ${tr("redeem_RedeemStats")}`,
			`✅ ${tr("redeem_Success")}: ${groups.success.length}`,
			`ℹ️ ${tr("redeem_Already")}: ${groups.already.length}`,
			`⚠️ ${tr("redeem_Invalid")}: ${groups.invalid.length}`,
			`❌ ${tr("redeem_Failed")}: ${groups.failed.length}`
		].join("\n");
	}

	async updateStatistics(currentHour) {
		this.logger.success(
			`${currentHour}:00 自動兌換已完成: ` +
				`${this.stats.total} 總數, ${this.stats.success} 成功, ` +
				`${this.stats.already} 已領取, ${this.stats.failed} 失敗`
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

	system.logger.info(`正在進行 ${currentHour}:00 自動兌換`);

	try {
		const codes = await getRedeemCodes();

		for (const [userId, data] of Object.entries(redeemData)) {
			const userLang = await getUserLang(userId);
			const tr = i18nMixin(userLang);
			const accounts = await system.db.get(`${userId}.account`);

			if (!accounts?.length) continue;

			for (let i = 0; i < accounts.length; i++) {
				const result = await system.processAccount(
					userId,
					i,
					codes,
					tr
				);

				if (result) {
					const tag = data.tag === "true" ? `<@${userId}>` : "";
					await system.sendRedeemMessage(
						data.channelId,
						tag,
						result.results,
						tr
					);
				}
			}
		}

		await system.updateStatistics(currentHour);
	} catch (error) {
		system.logger.error(`自動兌換失敗: ${error.message}`);
	}
}
