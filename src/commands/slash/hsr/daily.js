import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";

export default {
	data: new SlashCommandBuilder()
		.setName("daily")
		.setDescription("Daily check-in")
		.setNameLocalizations({
			"zh-TW": "每日簽到"
		})
		.setDescriptionLocalizations({
			"zh-TW": "領取每日簽到獎勵"
		})
		.addUserOption(option =>
			option
				.setName("user")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "使用者"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName("autosign")
				.setDescription(
					"Automatic check-in at 10am every morning, messages will be sent wherever command used!"
				)
				.setNameLocalizations({
					"zh-TW": "自動簽到"
				})
				.setDescriptionLocalizations({
					"zh-TW": "每天自動簽到，訊息會在使用指令的地方自動發送！"
				})
				.setRequired(false)
				.addChoices(
					{
						name: "On",
						name_localizations: {
							"zh-TW": "開啟"
						},
						value: "on"
					},
					{
						name: "Off",
						name_localizations: {
							"zh-TW": "關閉"
						},
						value: "off"
					}
				)
		)
		.addStringOption(option =>
			option
				.setName("time")
				.setDescription("Automatic check-in time")
				.setNameLocalizations({
					"zh-TW": "簽到時間"
				})
				.setDescriptionLocalizations({
					"zh-TW": "自動簽到的時間"
				})
				.setRequired(false)
				.addChoices(
					{
						name: "01",
						value: "1"
					},
					{
						name: "02",
						value: "2"
					},
					{
						name: "03",
						value: "3"
					},
					{
						name: "04",
						value: "4"
					},

					{
						name: "05",
						value: "5"
					},
					{
						name: "06",
						value: "6"
					},

					{
						name: "07",
						value: "7"
					},
					{
						name: "08",
						value: "8"
					},
					{
						name: "09",
						value: "9"
					},
					{
						name: "10",
						value: "10"
					},
					{
						name: "11",
						value: "11"
					},
					{
						name: "12",
						value: "12"
					},
					{
						name: "13",
						value: "13"
					},
					{
						name: "14",
						value: "14"
					},
					{
						name: "15",
						value: "15"
					},
					{
						name: "16",
						value: "16"
					},
					{
						name: "17",
						value: "17"
					},
					{
						name: "18",
						value: "18"
					},
					{
						name: "19",
						value: "19"
					},
					{
						name: "20",
						value: "20"
					},
					{
						name: "21",
						value: "21"
					},
					{
						name: "22",
						value: "22"
					},
					{
						name: "23",
						value: "23"
					},
					{
						name: "24",
						value: "24"
					}
				)
		)
		.addStringOption(option =>
			option
				.setName("tag")
				.setDescription(
					"Whether mark in the automatic check-in, turn on this also turn on the automatic check-in"
				)
				.setNameLocalizations({
					"zh-TW": "標註"
				})
				.setDescriptionLocalizations({
					"zh-TW":
						"是否在自動簽到中標註，開啟這個也相當於開啟了自動簽到"
				})
				.setRequired(false)
				.addChoices(
					{
						name: "On",
						name_localizations: {
							"zh-TW": "開啟"
						},
						value: "true"
					},
					{
						name: "Off",
						name_localizations: {
							"zh-TW": "關閉"
						},
						value: "false"
					}
				)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await interaction.deferReply({ ephemeral: true });

		const user = interaction.options.getUser("user") ?? interaction.user;
		try {
			const auto = interaction.options.getString("autosign");
			const time = interaction.options.getString("time");
			const tag = interaction.options.getString("tag");

			if (auto == "off") {
				await db.delete(`autoDaily.${interaction.user.id}`);
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setTitle(tr("autoDaily_off"))
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
							)
					]
				});
			}

			if (time || tag || auto == "on") {
				if (
					!(
						(await db.has(`${interaction.user.id}.account`)) &&
						(await db.get(`${interaction.user.id}.account`))[0]
							.cookie
					)
				)
					return await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setConfig("#E76161")
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(`${tr("cookie_failed")}`)
								.setDescription(`${tr("cookie_failedDesc")}`)
						]
					});

				await db.set(`autoDaily.${interaction.user.id}`, {
					channelId: interaction.channel.id,
					time: time ? time : "12",
					tag: tag ? tag : false
				});

				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#A2CDB0")
							.setTitle(tr("autoDaily_on"))
							.setDescription(
								`${tr("autoDaily_time", {
									z: time ? `\`${time}:00\`` : "`12:00`"
								})}\n${tr("autoDaily_tag", {
									z:
										tag == "true"
											? `\`${tr("true")}\``
											: `\`${tr("false")}\``
								})}`
							)
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
							)
					]
				});
			}

			const hsr = new HonkaiStarRail({
				cookie:
					(await db.has(`${user.id}.account`)) &&
					(await db.get(`${user.id}.account`))[0].cookie
						? (await db.get(`${user.id}.account`))[0].cookie
						: await db.get(`${user.id}.cookie`),
				lang: (await db?.has(`${interaction.user.id}.locale`))
					? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
						? LanguageEnum.TRADIIONAL_CHINESE
						: LanguageEnum.ENGLISH
					: interaction.locale == "zh-TW"
					  ? LanguageEnum.TRADIIONAL_CHINESE
					  : LanguageEnum.ENGLISH
			});

			const info = await hsr.daily.info();
			const reward = await hsr.daily.reward();
			const rewards = await hsr.daily.rewards();
			const todaySign =
				rewards.awards[
					info.month_last_day != true
						? info.total_sign_day
						: info.total_sign_day - 1
				];
			const tmrSign =
				rewards.awards[
					info.month_last_day != true
						? info.total_sign_day + 1
						: info.total_sign_day
				];
			const res = await hsr.daily.claim();

			if (res.code == -5003 || res.info.is_sign == true)
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(
								`${tr("daily_failed")} ${tr("daily_signed")}`
							)
					]
				});

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("daily_sign"))
						.setThumbnail(todaySign?.icon)
						.setDescription(
							`${tr("daily_desc", {
								a: `\`${todaySign?.name}x${todaySign?.cnt}\``
							})}${
								info.month_last_day != true
									? `\n\n${tr("daily_desc2", {
											b: `\`${tmrSign?.name}x${tmrSign?.cnt}\``
									  })}`
									: ""
							}`
						)
						.addFields(
							{
								name: `${reward.month} ${tr("daily_month")}`,
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_signedDay", {
									z:
										info.month_last_day != true
											? info.total_sign_day + 1
											: info.total_sign_day
								}),
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_missedDay", {
									z: info.sign_cnt_missed
								}),
								value: "\u200b",
								inline: true
							}
						)
				]
			});
		} catch (e) {
			return await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(
							`${tr("daily_failed")} ${tr("cookie_failed")}`
						)
						.setDescription(
							`<@${user.id}>\n\n${tr(
								"cookie_failedDesc"
							)}\n\n${tr("err_code")}${e}`
						)
				]
			});
		}
	}
};
