import {
	parseEmoji,
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { emojiParser } from "../../services/parser.js";

export default {
	data: new SlashCommandBuilder()
		.setName("emoji")
		.setDescription("Show large emoji")
		.setNameLocalizations({
			"zh-TW": "放大表符",
			ja: "undefined"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看放大的表情符號",
			ja: "undefined"
		})
		.addStringOption(string =>
			string
				.setName("emoji")
				.setDescription("Put emojis here")
				.setNameLocalizations({
					"zh-TW": "表情符號",
					ja: "undefined"
				})
				.setDescriptionLocalizations({
					"zh-TW": "在這放入表情符號",
					ja: "undefined"
				})
				.setRequired(true)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		let [emoji] = emojiParser(args[0]);
		if (emoji) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setImage(emoji.url + "?size=4096")
				]
			});
		} else {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(tr("emojiErr")) //我沒有找到這個表情符號
				],
				ephemeral: true
			});
			return;
		}
	}
};
