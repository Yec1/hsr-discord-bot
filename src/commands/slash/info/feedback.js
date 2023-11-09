import {
	CommandInteraction,
	SlashCommandBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("feedback")
		.setDescription("You can provide suggestions or ideas for bot here!")
		.setNameLocalizations({
			"zh-TW": "反饋"
		})
		.setDescriptionLocalizations({
			"zh-TW": "您可以在這裡提供對於機器人的建議或者想法！"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db) {
		await interaction.showModal(
			new ModalBuilder()
				.setCustomId("feedback")
				.setTitle(tr("feedback_Title"))
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setLabel(tr("feedback_Label"))
							.setCustomId("suggest")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
					)
				)
		);
	}
};
