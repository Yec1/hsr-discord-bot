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
			this.logger.error(
				`Failed to get user preferences for ${userId}: ${error.message}`
			);
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
			this.logger.warn(`Missing cookie or UID for user ${userId}`);
			return null;
		}

		const hsr = new HonkaiStarRail({
			uid,
			cookie,
			lang: this.getLanguage(tr.locale)
		});

		let userRedeemedCodes =
			(await this.db.get(`${uid}.redeemedCodes`)) || [];
		const unredeemedCodes = codes.filter(
			code => !userRedeemedCodes.includes(code.code)
		);

		if (!unredeemedCodes.length) return null;

		const results = [];
		for (const code of unredeemedCodes) {
			try {
				const res = await this.redeemCode(hsr, code.code);
				const result = await this.handleRedeemResult(
					code.code,
					res,
					userRedeemedCodes,
					uid,
					tr
				);
				results.push({ code: code.code, ...result });
				await new Promise(resolve =>
					setTimeout(resolve, CONFIG.REDEEM_DELAY)
				);
			} catch (error) {
				this.logger.error(
					`Failed to redeem code ${code.code} for ${uid}: ${error.message}`
				);
				results.push({
					code: code.code,
					status: "failed",
					message: error.message
				});
			}
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
			`Completed ${currentHour}:00 auto redemption: ` +
				`${this.stats.total} total, ${this.stats.success} successful, ` +
				`${this.stats.already} already claimed, ${this.stats.failed} failed`
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
		system.logger.error(`Auto redemption failed: ${error.message}`);
	}
}
