import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder
} from "discord.js";
import { getSFWImage } from "waifu.pics-wrapper";

export default {
	data: new SlashCommandBuilder()
		.setName("pictures")
		.setDescription("Get some pictures")
		.setNameLocalizations({
			"zh-TW": "圖片",
			ja: "イメージ"
		})
		.setDescriptionLocalizations({
			"zh-TW": "召喚一些圖片",
			ja: "いくつかのイメージを呼び出す"
		})
		.addStringOption(option =>
			option
				.setName("category")
				.setDescription("Pictures category")
				.setNameLocalizations({
					"zh-TW": "類型",
					ja: "タイプ"
				})
				.setDescriptionLocalizations({
					"zh-TW": "圖片的類型",
					ja: "イメージのタイプ"
				})
				.setRequired(true)
				.addChoices(
					{
						name: "waifu",
						name_localizations: {
							"zh-TW": "老婆",
							ja: "ワイフ"
						},
						value: "waifu"
					},
					{
						name: "neko",
						name_localizations: {
							"zh-TW": "貓娘",
							ja: "猫娘"
						},
						value: "neko"
					}
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		const image = await getSFWImage(
			interaction.options.getString("category")
		);
		await interaction.reply({
			embeds: [new EmbedBuilder().setConfig().setImage(image)],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel(tr("user_Full_Image")) //完整圖片
						.setEmoji("🖼️")
						.setURL(image)
						.setStyle(5)
				)
			]
		});
	}
};
