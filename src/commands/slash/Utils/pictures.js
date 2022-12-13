import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder
} from "discord.js";
import nekoclient from "nekos.life";
const neko = new nekoclient();

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
		const category = interaction.options.getString("category");
		var image2;
		if (category === "waifu") image2 = await neko.waifu();
		else if (category === "neko") image2 = await neko.neko();
		await interaction.reply({
			embeds: [new EmbedBuilder().setConfig().setImage(image2.url)],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel(tr("user_Full_Image")) //完整圖片
						.setEmoji("🖼️")
						.setURL(image2.url)
						.setStyle(5)
				)
			]
		});
	}
};
