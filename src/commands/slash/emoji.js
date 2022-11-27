import {
  parseEmoji,
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";

import { parse } from 'twemoji-parser'

export default {
	data: new SlashCommandBuilder()
		.setName("emoji")
		.setDescription("Show large emoji")
		.setNameLocalizations({
			"zh-TW": "放大表符",
			"ja": 'undefined'
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看放大的表情符號",
			"ja": 'undefined'
		})
		.addStringOption(string =>
			string
				.setName('emoji')
				.setDescription('Put emoji here')
				.setNameLocalizations({
					"zh-TW": "表情符號",
					"ja": 'undefined'
				})
				.setDescriptionLocalizations({
					"zh-TW": "在這放入表情符號",
					"ja": 'undefined'
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
		const emoji = interaction.options.getString('emoji')
		let customemoji = parseEmoji(emoji);
		if (customemoji.id) {
			const Link = `https://cdn.discordapp.com/emojis/${
				customemoji.id}.${customemoji.animated ? "gif" : "png"}?size=4096`;
			await interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setImage(Link)
				]
			});
		}
		let CheckEmoji = parse(emoji, { assetType: "png" });
		if (!CheckEmoji[0]) {
			await interaction.editReply({ embeds: [
					new EmbedBuilder()         
						.setConfig()         
						.setDescription(tr("emojiErr")) //我沒有找到這個表情符號
				], 
				ephemeral: true 
			});
			return;
		}
		await interaction.editReply({ embeds: [
				new EmbedBuilder()
					.setConfig()
					.setDescription(tr('emojiPublic')) //你可以在不加入伺服器的情況下使用此表情符號
			], 
			ephemeral: true 
		});
	}
};
