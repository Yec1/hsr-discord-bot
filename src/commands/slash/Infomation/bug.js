import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder
} from "discord.js";
import { client } from "../../../index.js";
const emoji = client.emoji;

export default {
	data: new SlashCommandBuilder()
		.setName("support")
		.setDescription(
			"Encountered a bug or want to offer a suggestion? Use this command!"
		)
		.setNameLocalizations({
			"zh-TW": "協助",
			ja: "support"
		})
		.setDescriptionLocalizations({
			"zh-TW": "遇到錯誤或想提供建議? 使用這個命令!",
			ja: "undefined"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		await interaction.reply({
			embeds: [
				new EmbedBuilder().setConfig().setDescription(
					`
                    ${emoji.verify} ${tr("support")}
                    `
				)
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel(tr("support_server"))
						.setURL("https://discord.gg/tGQCdQZUqR")
						.setStyle(5)
				)
			]
		});
	}
};
