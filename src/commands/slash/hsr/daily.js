import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import {
	getRandomColor,
	getUserHSRData
} from "../../../utilities/utilities.js";

const timeChoices = Array.from({ length: 24 }, (_, i) => ({
	name: i + 1 < 10 ? `0${i + 1}` : `${i + 1}`,
	value: `${i + 1}`
}));

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
				.addChoices(...timeChoices)
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
		const haveAccount = await db.get(`${interaction.user.id}.account`);
		if (!haveAccount) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("daily_NonAccount"))
						.setDescription(tr("daily_NonAccountDesc"))
				]
			});
		}

		const user = interaction.options.getUser("user") ?? interaction.user;
		const auto = interaction.options.getString("autosign");
		const time = interaction.options.getString("time");
		const tag = interaction.options.getString("tag");

		if (auto === "off") {
			await db.delete(`autoDaily.${interaction.user.id}`);
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("autoDaily_Off"))
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
						)
				]
			});
		} else if (time || tag || auto === "on") {
			await db.set(`autoDaily.${interaction.user.id}`, {
				channelId: interaction.channel.id,
				time: time || "12",
				tag: tag || false
			});

			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#A2CDB0")
						.setTitle(tr("autoDaily_On"))
						.setDescription(
							tr("autoDaily_Time", {
								time: time ? "`" + time + ":00`" : "`12:00`"
							}) +
								"\n" +
								tr("autoDaily_Tag", {
									z:
										tag === "true"
											? "`" + tr("True") + "`"
											: "`" + tr("False") + "`"
								})
						)
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
						)
				]
			});
		}

		const hsr = await getUserHSRData(interaction, tr, user.id);
		if (!hsr) return;

		const info = await hsr.daily.info();
		const reward = await hsr.daily.reward();
		const rewards = await hsr.daily.rewards();
		const todaySign = rewards.awards[info.total_sign_day - 1];
		const tmrSign = rewards.awards[info.total_sign_day];
		const res = await hsr.daily.claim();

		if (res.code === -5003 || res.info.is_sign)
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("daily_Failed")} ${tr("daily_Signed")}`)
				]
			});

		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(getRandomColor())
					.setTitle(tr("daily_SignSuccess"))
					.setThumbnail(todaySign?.icon)
					.setDescription(
						`${tr("daily_Description", { a: `\`${todaySign?.name}x${todaySign?.cnt}\`` })}${info.month_last_day ? "" : `\n\n${tr("daily_DescriptionTmr", { b: `\`${tmrSign?.name}x${tmrSign?.cnt}\`` })}`}`
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
		});
	}
};
