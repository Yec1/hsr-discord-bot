import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with Pong!")
		.setNameLocalizations({
			"zh-TW": "延遲",
			ja: "ピン"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看機器人延遲",
			ja: "ボットのレイテンシを測定"
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
				new EmbedBuilder()
					.setConfig()
					.setDescription(
						"```ini\n[ " +
							tr("latency") +
							` ] :: ${
								Date.now() - interaction.createdTimestamp
							}ms\`\`\``
					)
			]
		});
	}
};
