import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { handleForgottenHallDraw } from "../../../utilities/hsr/forgottenhall.js";
import {
	getUserHSRData,
	getRandomColor
} from "../../../utilities/utilities.js";
import { EmbedBuilder } from "discord.js";

const modeMap = {
	shadow: 3,
	story: 2
};
const timeMap = {
	end: 2
};

export default {
	data: new SlashCommandBuilder()
		.setName("forgottenhall")
		.setDescription("View memories in Forgotten Hall")
		.setNameLocalizations({
			"zh-TW": "忘卻之庭紀錄"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看忘卻之庭的回憶紀錄"
		})
		.addStringOption(option =>
			option
				.setName("mode")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "模式"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(true)
				.addChoices(
					{
						name: "Memory of Chaos",
						name_localizations: {
							"zh-TW": "渾沌回憶"
						},
						value: "normal"
					},
					{
						name: "Pure Fiction",
						name_localizations: {
							"zh-TW": "虛構敘事"
						},
						value: "story"
					},
					{
						name: "Apocalyptic Shadow",
						name_localizations: {
							"zh-TW": "末日幻影"
						},
						value: "shadow"
					}
				)
		)
		.addStringOption(option =>
			option
				.setName("time")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "時間"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(false)
				.addChoices(
					{
						name: "Live",
						name_localizations: {
							"zh-TW": "本期"
						},
						value: "live"
					},
					{
						name: "End",
						name_localizations: {
							"zh-TW": "上期"
						},
						value: "end"
					}
				)
		)
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
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const targetUser =
			interaction.options.getUser("user") || interaction.user;
		const mode = modeMap[interaction.options.getString("mode")] || 1;
		const time = timeMap[interaction.options.getString("time")] || 1;

		const hsr = await getUserHSRData(interaction, tr, targetUser.id);
		if (hsr == null) return;

		await interaction.deferReply();
		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("Searching"))
					.setColor(getRandomColor())
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
					)
			],
			fetchReply: true
		});

		handleForgottenHallDraw(interaction, tr, targetUser, mode, time, hsr);
	}
};
