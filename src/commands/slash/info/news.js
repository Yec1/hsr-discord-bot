import {
	CommandInteraction,
	SlashCommandBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";

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
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		await interaction.reply({
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(`${tr("news_seltype")}`)
						.setCustomId("news_type")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{
								label: `${tr("news_notice")}`,
								emoji: "🔔",
								value: "1"
							},
							{
								label: `${tr("news_events")}`,
								emoji: "🔥",
								value: "2"
							},
							{
								label: `${tr("news_info")}`,
								emoji: "🗞️",
								value: "3"
							}
						)
				)
			]
		});
	}
};
