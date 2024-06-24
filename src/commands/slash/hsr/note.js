import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import {
	getUserHSRData,
	getRandomColor
} from "../../../utilities/utilities.js";
import { handleNoteDraw } from "../../../utilities/hsr/note.js";

export default {
	data: new SlashCommandBuilder()
		.setName("note")
		.setDescription("View current stamina and expedition progress")
		.setNameLocalizations({
			"zh-TW": "即時便箋"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看當前體力和委託進度"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("check")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "查看"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setRequired(false)
				)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const subCommand = interaction.options.getSubcommand();
		if (subCommand == "check") {
			const targetUser =
				interaction.options.getUser("user") || interaction.user;

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
				components: [],
				fetchReply: true
			});

			handleNoteDraw(interaction, tr, hsr);
		}
	}
};
