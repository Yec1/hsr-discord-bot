import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	MessageFlags
} from "discord.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import { getRandomColor } from "@/utilities/index.js";
import type { TranslationFunction } from "@/types/index.js";
import { database } from "@/index.js";

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
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	) {
		const locale = interaction.options.getString("locale");

		await database.set(`${interaction.user.id}.locale`, locale);

		const newTr = createTranslator(
			((await database.get(`${interaction.user.id}.locale`)) as any) ||
				createTranslator(interaction.locale) ||
				"tw"
		);

		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(getRandomColor() as any)
					.setTitle(
						newTr("NewLocale", {
							locale:
								locale === "en"
									? "English"
									: locale === "tw"
										? "中文(台灣)"
										: "中文(中國)"
						})
					)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			],
			flags: MessageFlags.Ephemeral
		});
	}
};
