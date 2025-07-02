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
		this.logger = new Logger("AutoDailySign");
		this.stats = { total: 0, success: 0, failed: 0, signed: 0 };
	}

	async initialize() {
		if (!this.webhook?.url) {
			throw new Error("Invalid webhook configuration");
		}
	}

	getLanguage(locale) {
		return LANGUAGE_MAPPING[locale] || LANGUAGE_MAPPING.default;
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

				if (!cookie || !uid) continue;

				await this.performSignIn(
					{ cookie, uid },
					userLang,
					userId,
					channelId,
					tag,
					tr
				);
			} catch (error) {
				this.logger.error(
					`Sign-in failed for user ${userId} account ${accountIndex}: ${error.message}`
				);
				this.stats.failed++;
			}
		}
	}

	async performSignIn(account, userLang, userId, channelId, tag, tr) {
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
			throw new Error(`API Error: ${error.message}`);
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
				`Failed to send message to channel ${channelId}: ${error.message}`
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
			`Completed ${currentHour}:00 auto sign-in: ${this.stats.total} total, ` +
				`${this.stats.success} successful, ${this.stats.signed} already signed, ` +
				`${this.stats.failed} failed`
		);

		const statsEmbed = new EmbedBuilder()
			.setColor("#F2BE22")
			.setTitle(`${currentHour}:00 Auto Sign-in Stats`)
			.setTimestamp()
			.addFields(this.buildStatsFields(duration, averageTime));

		await this.webhook.send({ embeds: [statsEmbed] });
	}

	buildStatsFields(duration, averageTime) {
		return [
			{
				name: `Total Users: \`${this.stats.total}\``,
				value: "\u200b",
				inline: false
			},
			{
				name: `Successful: \`${this.stats.success}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `Already Signed: \`${this.stats.signed}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `Failed: \`${this.stats.failed}\``,
				value: "\u200b",
				inline: true
			},
			{
				name: `Total Duration: \`${duration.toFixed(3)}\` seconds`,
				value: "\u200b",
				inline: true
			},
			{
				name: `Average Time: \`${averageTime.toFixed(3)}\` seconds`,
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
	system.logger.success(`Starting ${currentHour}:00 auto sign-in`);

	for (const userId of Object.keys(dailyData)) {
		const scheduledTime = dailyData[userId]?.time || "13";

		if (parseInt(scheduledTime) === parseInt(currentHour)) {
			try {
				await system.processDailySign(userId, dailyData);
			} catch (error) {
				system.logger.error(
					`Error processing user ${userId}: ${error.message}`
				);
			}
		}
	}

	await system.updateStatistics(startTime, currentHour);
}
