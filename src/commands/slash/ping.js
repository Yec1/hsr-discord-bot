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
			"zh-TW": "延遲"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看機器人延遲"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setDescription(
						`\`\`\`ini\n[ Latency ] :: ${
							Date.now() - interaction.createdTimestamp
						}ms\`\`\``
					)
			]
		});
	}
};
