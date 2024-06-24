import { client } from "../index.js";
import { EmbedBuilder, WebhookClient } from "discord.js";
import { Logger } from "../utilities/core/logger.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor
} from "../utilities/utilities.js";
import { i18nMixin } from "../utilities/core/i18n.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";

const webhook = new WebhookClient({ url: process.env.LOGWEBHOOK });
const db = client.db;
let success, failed, signed, total;

export default async function autoDailySign() {
	const dailyData = await db.get("autoDaily");
	const autoDaily = Object.keys(dailyData);

	// Initialize the variables
	const nowTime = new Date().toLocaleString("en-US", {
		timeZone: "Asia/Taipei",
		hour: "numeric",
		hour12: false
	});
	const startTime = Date.now();
	total = 0;
	signed = 0;
	failed = 0;
	success = 0;

	// Loop through the autoDaily array
	new Logger("自動執行").success(`已開始 ${nowTime} 點自動簽到`);
	for (const id of autoDaily) {
		const time = dailyData[id]?.time ? dailyData[id].time : "13";

		if (parseInt(time) == nowTime) {
			const accounts = await db.get(`${id}.account`);
			for (const account of accounts) {
				let accountIndex = 0;
				if (
					getUserCookie(id, accountIndex) &&
					getUserUid(id, accountIndex)
				)
					await dailySign(dailyData, id, account.uid, account.cookie);
				accountIndex++;
			}
		}
	}

	// End
	UpdateStatistics(total, startTime, success, failed, signed, nowTime);
}

async function dailySign(dailyData, userId, uid, cookie) {
	total++;
	const locale = await getUserLang(userId);
	const tr = i18nMixin(toI18nLang(locale) || "en");
	const channelId = dailyData[userId].channelId;
	const tag = dailyData[userId].tag === "true" ? "<@" + id + ">" : "";
	let channel;

	try {
		channel = await client.channels.fetch(channelId);
	} catch (e) {}

	try {
		const hsr = new HonkaiStarRail({
			cookie,
			lang:
				locale === "tw" || interaction.locale === "zh-TW"
					? LanguageEnum.TRADIIONAL_CHINESE
					: LanguageEnum.ENGLISH
		});

		const info = await hsr.daily.info();
		const reward = await hsr.daily.reward();
		const rewards = await hsr.daily.rewards();
		const todaySign = rewards.awards[info.total_sign_day - 1];
		const tmrSign = rewards.awards[info.total_sign_day];
		const res = await hsr.daily.claim();

		if (res.code === -5003 || res.info.is_sign === true) {
			signed++;
		} else {
			success++;
			sendMessage(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor())
						.setTitle(
							uid + " " + tr("Auto") + tr("daily_SignSuccess")
						)
						.setThumbnail(todaySign?.icon)
						.setDescription(
							`${tr("daily_Description", { a: `\`${todaySign?.name}x${todaySign?.cnt}\`` })}${info.month_last_day ? "" : `\n\n<@${id}> ${tr("daily_DescriptionTmr", { b: `\`${tmrSign?.name}x${tmrSign?.cnt}\`` })}`}`
						)
						.addFields(
							{
								name: `${reward.month} ${tr("daily_Month")}`,
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_SignedDay", {
									z: "`" + info.total_sign_day + "`"
								}),
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_MissedDay", {
									z: "`" + info.sign_cnt_missed + "`"
								}),
								value: "\u200b",
								inline: true
							}
						)
				]
			}).catch(() => {});
		}
	} catch (error) {
		failed++;
	}
}

async function sendMessage(channelId, embed) {
	try {
		await client.cluster.broadcastEval(
			async (c, context) => {
				const channel = c.channels.cache.get(context.channelId);
				channel.send(context.embed).catch(() => {});
			},
			{
				context: { channelId: channelId, embed: embed },
				timeout: 10e3
			}
		);
	} catch (e) {}
}

function UpdateStatistics(total, startTime, success, failed, signed, nowTime) {
	const endTime = Date.now();
	const average_time = parseFloat(
		((endTime - startTime) / (total > 0 ? total : 1) / 1000).toFixed(3)
	);

	new Logger("自動執行").success(
		`已結束 ${nowTime} 點自動簽到，簽到 ${success}/${total} 人`
	);

	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setColor("#F2BE22")
				.setTitle(`${nowTime} 點自動簽到`)
				.setTimestamp()
				.addFields(
					{
						name: `簽到總人數 \`${total}\` 人`,
						value: "\u200b",
						inline: false
					},
					{
						name: `簽到成功人數 \`${success}\` 人`,
						value: "\u200b",
						inline: true
					},
					{
						name: `已簽到導致失敗人數 \`${signed}\` 人`,
						value: "\u200b",
						inline: true
					},
					{
						name: `簽到失敗人數 \`${failed}\` 人`,
						value: "\u200b",
						inline: true
					},
					{
						name: `花費時間 \`${parseFloat(
							((endTime - startTime) / 1000).toFixed(3)
						)}\` 秒`,
						value: "\u200b",
						inline: true
					},
					{
						name: `平均時間 \`${average_time}\` 秒`,
						value: "\u200b",
						inline: true
					}
				)
		]
	});
}
