import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import type { TranslationFunction } from "@/types/index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("news")
		.setDescription("Get the latest news from the offical")
		.setNameLocalizations({
			"zh-TW": "新聞"
		})
		.setDescriptionLocalizations({
			"zh-TW": "從官方獲取最新消息"
		}),
	/**
	 *
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	) {
		interaction.reply({
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("news_SelectType"))
						.setCustomId("news_type")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{
								label: tr("news_Notice"),
								emoji: "🔔",
								value: "1"
							},
							{
								label: tr("news_Events"),
								emoji: "🔥",
								value: "2"
							},
							{
								label: tr("news_Info"),
								emoji: "🗞️",
								value: "3"
							}
						)
				)
			]
		});
	}
};
