import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	MessageFlags
} from "discord.js";
import { getRandomColor, getUserHSRData } from "@/utilities/index.js";
import { database } from "@/index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("automimo")
		.setDescription("Automatically complete Mimo tasks and claim points")
		.setNameLocalizations({
			"zh-TW": "自動mimo",
			"en-US": "automimo"
		})
		.setDescriptionLocalizations({
			"zh-TW": "自動完成 Mimo 任務、領取積分並兌換星瓊",
			"en-US": "Automatically complete Mimo tasks and claim points"
		})
		.addStringOption(option =>
			option
				.setName("enable")
				.setDescription("Enable or disable automatic Mimo tasks")
				.setNameLocalizations({
					"zh-TW": "開啟",
					"en-US": "enable"
				})
				.setRequired(true)
				.addChoices(
					{
						name: "On",
						name_localizations: { "zh-TW": "開啟", "en-US": "On" },
						value: "on"
					},
					{
						name: "Off",
						name_localizations: { "zh-TW": "關閉", "en-US": "Off" },
						value: "off"
					}
				)
		)
		.addStringOption(option =>
			option
				.setName("tag")
				.setDescription("Whether to mention you in the notification")
				.setNameLocalizations({
					"zh-TW": "標註",
					"en-US": "tag"
				})
				.setRequired(false)
				.addChoices(
					{
						name: "On",
						name_localizations: { "zh-TW": "開啟", "en-US": "On" },
						value: "true"
					},
					{
						name: "Off",
						name_localizations: { "zh-TW": "關閉", "en-US": "Off" },
						value: "false"
					}
				)
		),

	async execute(interaction: ChatInputCommandInteraction, tr: any) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const enable = interaction.options.getString("enable");
		const tag = interaction.options.getString("tag") || "false";

		if (enable === "on") {
			// 檢查是否有有效的 Cookie
			const hsr = await getUserHSRData(interaction, tr, interaction.user.id, 0);
			if (!hsr) return;

			await database.set(`autoMimo.${interaction.user.id}`, {
				channelId: interaction.channelId,
				tag: tag
			});

			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#A2CDB0")
						.setTitle(`✅ ${tr("automimo_On")}`)
						.setDescription(
							tr("automimo_Desc", {
								z: tag === "true" ? tr("True") : tr("False")
							})
						)
						.setThumbnail(
							"https://img-os-static.hoyolab.com/communityWeb/upload/79893d56b06e901a1829e0066b6c0388.png"
						)
				]
			});
		} else {
			await database.delete(`autoMimo.${interaction.user.id}`);
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(`❌ ${tr("automimo_Off")}`)
						.setThumbnail(
							"https://img-os-static.hoyolab.com/communityWeb/upload/79893d56b06e901a1829e0066b6c0388.png"
						)
				]
			});
		}
	}
};
