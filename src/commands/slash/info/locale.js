import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { i18nMixin, toI18nLang } from "../../../services/i18n.js";

export default {
	data: new SlashCommandBuilder()
		.setName("locale")
		.setDescription("Set the language displayed by the bot")
		.setNameLocalizations({
			"zh-TW": "語言"
		})
		.setDescriptionLocalizations({
			"zh-TW": "設定機器人所顯示的語言"
		})
		.addStringOption(option =>
			option
				.setName("locale")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "語言"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(true)
				.addChoices(
					{
						name: "en",
						name_localizations: {
							"zh-TW": "英文"
						},
						value: "en"
					},
					{
						name: "tw",
						name_localizations: {
							"zh-TW": "中文(台灣)"
						},
						value: "tw"
					},
					{
						name: "cn",
						name_localizations: {
							"zh-TW": "中文(中國)"
						},
						value: "cn"
					}
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db) {
		const locale = interaction.options.getString("locale");

		await db.set(`${interaction.user.id}.locale`, locale);

		const newTr = i18nMixin(
			(await db?.has(`${interaction.user.id}.locale`))
				? await db?.get(`${interaction.user.id}.locale`)
				: toI18nLang(interaction.locale) || "en"
		);

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setConfig("#FFD1DA")
					.setTitle(
						newTr("newLocale", {
							z: locale
						})
					)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			],
			ephemeral: true
		});
	}
};
