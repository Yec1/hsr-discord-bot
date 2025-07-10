import { client } from "../../index.js";
import { EmbedBuilder, WebhookClient } from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "@yeci226/hoyoapi";
import Logger from "../core/logger.js";
import { i18nMixin } from "../core/i18n.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor
} from "../utilities.js";

// Constants remain the same
const CONFIG = {
	TAIPEI_TIMEZONE: "Asia/Taipei",
	API_TIMEOUT: 10000,
	WEBHOOK_RETRIES: 3,
	DEFAULT_LANGUAGE: "en"
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

class AutoDailySignSystem {
	constructor(client, webhookUrl) {
		this.client = client;
		this.db = client.db;
		this.webhook = new WebhookClient({ url: webhookUrl });
		this.logger = new Logger("自動簽到");
		this.stats = { total: 0, success: 0, failed: 0, signed: 0, skipped: 0 };
	}

	async initialize() {
		if (!this.webhook?.url) {
			throw new Error("無效的 webhook 配置");
		}
	}

	getLanguage(locale) {
		return LANGUAGE_MAPPING[locale] || LANGUAGE_MAPPING.default;
	}

	// 檢查是否為可跳過的錯誤
	isSkippableError(errorMessage) {
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

	async processDailySign(userId, dailyData) {
		const accounts = await this.db.get(`${userId}.account`);
		if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
			return;
		}

		const userLang = (await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
		const tr = i18nMixin(userLang);
		const channelId = dailyData[userId].channelId;
		const tag = dailyData[userId].tag === "true" ? `<@${userId}>` : "";

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
					this.logger.info(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 缺少 Cookie 或 UID，跳過處理`
					);
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
				const errorMessage = error.message;

				if (this.isSkippableError(errorMessage)) {
					this.logger.info(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 跳過處理: ${errorMessage}`
					);
					this.stats.skipped++;
				} else {
					this.logger.error(
						`[用戶 ${userId}] [帳號 #${accountIndex}] 簽到失敗: ${errorMessage}`
					);
					this.stats.failed++;
				}
			}
		}
	}

	async performSignIn(
		account,
		userLang,
		userId,
		channelId,
		tag,
		tr,
		accountIndex
	) {
		this.stats.total++;

		const hsr = new HonkaiStarRail({
			cookie: account.cookie,
			lang: this.getLanguage(userLang)
		});

		try {
			// Get all required information first
			const [info, reward, rewards] = await Promise.all([
				hsr.daily.info(),
				hsr.daily.reward(),
				hsr.daily.rewards()
			]);

			// Perform the claim
			const result = await hsr.daily.claim();

			if (result.code === -5003 || result.info.is_sign === true) {
				this.stats.signed++;
				this.logger.info(
					`[用戶 ${userId}] [帳號 #${accountIndex}] 已經簽到過了`
				);
				return;
			}

			// Get sign info for today and tomorrow
			const todaySign =
				rewards.awards[info.total_sign_day] || rewards.awards[0];
			const tmrSign =
				rewards.awards[info.total_sign_day + 1] || rewards.awards[1];

			this.stats.success++;
			this.logger.success(
				`[用戶 ${userId}] [帳號 #${accountIndex}] 簽到成功`
			);

			await this.sendSuccessMessage(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor())
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
			const errorMessage = error.message;

			if (this.isSkippableError(errorMessage)) {
				throw new Error(errorMessage); // 重新拋出，讓上層處理
			} else {
				throw new Error(`API 錯誤: ${errorMessage}`);
			}
		}
	}

	async sendSuccessMessage(channelId, messageData) {
		try {
			await this.client.cluster.broadcastEval(
				async (c, context) => {
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
				`發送訊息至頻道 ${channelId} 時發生錯誤: ${error.message}`
			);
		}
	}

	// Statistics methods remain the same...
	async updateStatistics(startTime, currentHour) {
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

	buildStatsFields(duration, averageTime) {
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

export default async function autoDailySign() {
	const system = new AutoDailySignSystem(client, process.env.LOGWEBHOOK);
	await system.initialize();

	const dailyData = await system.db.get("autoDaily");
	if (!dailyData) return;

	const currentHour = new Date().toLocaleString("en-US", {
		timeZone: CONFIG.TAIPEI_TIMEZONE,
		hour: "numeric",
		hour12: false
	});

	const startTime = Date.now();
	system.logger.success(`開始 ${currentHour}:00 自動簽到`);

	for (const userId of Object.keys(dailyData)) {
		const scheduledTime = dailyData[userId]?.time || "13";

		if (parseInt(scheduledTime) === parseInt(currentHour)) {
			try {
				await system.processDailySign(userId, dailyData);
			} catch (error) {
				system.logger.error(
					`處理用戶 ${userId} 時發生錯誤: ${error.message}`
				);
			}
		}
	}

	await system.updateStatistics(startTime, currentHour);
}
