import { client } from "../index.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { EmbedBuilder, WebhookClient } from "discord.js";
import { i18nMixin } from "../services/i18n.js";
import moment from "moment-timezone";
import emoji from "../assets/emoji.js";
import { staminaColor } from "../services/request.js";
import { Logger } from "../services/logger.js";

const webhook = new WebhookClient({ url: process.env.LOGWEBHOOK });
const db = client.db;

let sus, fail, total, remove, removeInvaild;

export default async function notifyCheck() {
	const notify = await db.get("autoNotify");
	const autoNotify = Object.keys(notify);

	// Log
	const nowTime = new Date().toLocaleString("en-US", {
		timeZone: "Asia/Taipei",
		hour: "numeric",
		hour12: false
	});
	const start_time = Date.now();
	remove = [];
	removeInvaild = [];
	sus = 0;
	fail = 0;
	total = 0;

	// Start
	new Logger("自動執行").info(`已開始 ${nowTime} 點自動通知`);
	for (const i of autoNotify) {
		const id = i;
		if (
			(await db?.has(`${id}.account`)) &&
			(await db?.get(`${id}.account`))[0].uid &&
			(await db?.get(`${id}.account`))[0].cookie
		) {
			const accounts = await db?.get(`${id}.account`);
			let n = 0;
			for (const account of accounts) {
				const uid = account.uid;
				const cookie = account.cookie;
				await notifySend(notify, i, uid, cookie, n != 0 ? true : false);
				n++;
			}
		} else {
			await notifySend(
				notify,
				i,
				await db?.get(`${id}.uid`),
				await db?.get(`${id}.cookie`)
			);
		}
	}

	await db.set("autoNotify", notify);
	await Promise.all(remove.map(id => db.delete(`autoNotify.${id}`)));
	await Promise.all(
		removeInvaild.map(id => db.delete(`autoNotify.${id}.invaild`))
	);

	UpdateStatistics(total, start_time, sus, fail, nowTime);
}

async function notifySend(notify, id, uid, cookie, mutiAcc) {
	total++;
	const locale = (await db?.has(`${id}.locale`))
		? await db?.get(`${id}.locale`)
		: "tw";
	const tr = i18nMixin(locale);

	const channelId = notify[id].channelId;
	const tag = notify[id].tag === "true" ? `<@${id}>` : "";
	const userdb = await db?.get(`autoNotify.${id}`);
	const userMaxStamina = userdb?.stamina ? userdb.stamina : 170;

	try {
		const hsr = new HonkaiStarRail({
			cookie: cookie,
			lang: (await db?.has(`${id}.locale`))
				? (await db?.get(`${id}.locale`)) === "en"
					? LanguageEnum.ENGLISH
					: LanguageEnum.TRADIIONAL_CHINESE
				: LanguageEnum.TRADIIONAL_CHINESE,
			uid: uid
		});

		const res = await hsr.record.note();
		let title = tr("autoNote_title");

		if (res.current_stamina >= userMaxStamina)
			title += ` ${tr("notify_staminaMax")}`;

		let isTitleAdded = false;
		let expeditionNotify = false;

		if (userdb.expedition === "true")
			for (let expedition of res.expeditions) {
				if (expedition.remaining_time === 0 && !isTitleAdded) {
					title += ` ${tr("notify_expeditionMax")}`;
					isTitleAdded = true;
					expeditionNotify = true;
				}
			}

		if (
			res.current_stamina >= userMaxStamina ||
			(userdb.expedition === "true" && expeditionNotify === true)
		) {
			sus++;

			if (notify[id]?.invaild) removeInvaild.push(id);

			send(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setColor(staminaColor(res.current_stamina))
						.setTitle(title)
						.setDescription(`<@${id}>`)
						.setAuthor({
							name: `${tr("notify_title")} - ${hsr.uid}`,
							iconURL:
								"https://media.discordapp.net/attachments/1057244827688910850/1121043103831293992/NoviceBookIcon.png"
						})
						.addFields(
							{
								name: `${emoji.stamina} ${tr(
									"notify_stamina"
								)} ${res.current_stamina} / ${
									res.max_stamina
								} ** ** ${tr("notify_re")} ${
									res.stamina_recover_time <= 0
										? `\`${tr("notify_reAll")}\``
										: `<t:${
												moment(new Date()).unix() +
												res.stamina_recover_time
											}:R>`
								}`,
								value: "\u200b",
								inline: false
							},
							{
								name: `${emoji.reserve_stamina} ${tr(
									"notify_staminaBack"
								)} ${res.current_reserve_stamina} / 2400`,
								value: "\u200b",
								inline: false
							},
							{
								name: `${emoji.daily} ${tr("notify_daily")} ${
									res.current_train_score
								} / ${res.max_train_score} ** ** ${tr(
									"notify_end"
								)} ${`<t:${moment(
									new Date(
										new Date().setDate(
											new Date().getDate() + 1
										)
									).setHours(4, 0, 0, 0)
								).unix()}:R>`}`,
								value: "\u200b",
								inline: false
							},
							{
								name: `${emoji.rogue} ${tr("notify_rogue")} ${
									res.current_rogue_score
								} / ${res.max_rogue_score}`,
								value: "\u200b",
								inline: false
							},
							{
								name: `${emoji.cocoon} ${tr("notify_cocoon")} ${
									res.weekly_cocoon_cnt
								} / ${res.weekly_cocoon_limit}`,
								value: "\u200b",
								inline: false
							},
							{
								name: `${emoji.epedition} ${tr(
									"notify_epedition"
								)} ${res.accepted_epedition_num} / ${
									res.total_expedition_num
								}`,
								value:
									res.expeditions.length !== 0
										? res.expeditions
												.map(expedition => {
													return `• **${
														expedition.name
													}**：${
														expedition.remaining_time <=
														0
															? `\`${tr(
																	"notify_claim"
																)}\``
															: `<t:${
																	moment(
																		new Date()
																	).unix() +
																	expedition.remaining_time
																}:R>`
													}`;
												})
												.join("\n")
										: "\u200b",
								inline: false
							}
						)
				]
			}).catch(() => {});
		}
	} catch (e) {
		if (mutiAcc == true && cookie) {
			fail++;
			notify[id]?.invaild
				? notify[id].invaild++
				: (notify[id].invaild = 1);

			if (notify[id]?.invaild > 47) remove.push(id);

			const userdb = (await db?.has(`${id}.account`))
				? (await db?.get(`${id}.account`))[0]
				: await db?.get(`${id}`);

			const desc = [
				userdb?.cookie ? "" : tr("cookie_failedDesc"),
				userdb?.uid ? "" : tr("uid_failedDesc")
			]
				.filter(Boolean)
				.join("\n");

			send(channelId, {
				content: tag,
				embeds: [
					new EmbedBuilder()
						.setConfig(
							"#E76161",
							`${tr("auto_Fail", {
								z: notify[id]?.invaild,
								max: 48
							})}`
						)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("autoNote_title")} - ${uid}`)
						.setDescription(
							`<@${id}> ${tr("notify_failed")}\n\n${desc}\n${tr(
								"err_code"
							)}**${e.message}**`
						)
				]
			});
		}
	}
}

function UpdateStatistics(total, start_time, sus, fail, nowTime) {
	const end_time = Date.now();
	const average_time = parseFloat(
		((end_time - start_time) / (total > 0 ? total : 1) / 1000).toFixed(3)
	);

	new Logger("自動執行").info(
		`已結束 ${nowTime} 點自動通知，通知 ${sus}/${total} 人`
	);
	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setColor("#C4D7B2")
				.setTitle("自動通知")
				.setTimestamp()
				.addFields(
					{
						name: `通知總人數 \`${total}\` 人`,
						value: "\u200b",
						inline: false
					},
					{
						name: `已通知人數 \`${sus}\` 人`,
						value: "\u200b",
						inline: true
					},
					{
						name: `無效人數 \`${fail}\` 人`,
						value: "\u200b",
						inline: true
					},
					{
						name: `花費時間 \`${parseFloat(
							((end_time - start_time) / 1000).toFixed(3)
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

async function send(channelId, embed) {
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
