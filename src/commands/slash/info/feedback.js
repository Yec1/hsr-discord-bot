import {
	CommandInteraction,
	SlashCommandBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";
import ms from "ms";
import { CommandCooldown } from "discord-command-cooldown";
const FeedbackCD = new CommandCooldown("FeedbackCD", ms("12h"));

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
		const userCD = await FeedbackCD.getUser(interaction.user.id);
		if (userCD)
			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder().setConfig("#E76161").setTitle(
						tr("wait", {
							time: (userCD.msLeft / 1000).toFixed(2)
						})
					)
				],
				ephemeral: true
			});

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
