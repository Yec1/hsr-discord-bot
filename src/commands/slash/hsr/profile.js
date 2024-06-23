import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { failedReply, getUserUid } from "../../../utilities/utilities.js";
import { handleProfileDraw } from "../../../utilities/hsr/profile.js";

export default {
	data: new SlashCommandBuilder()
		.setName("profile")
		.setDescription("Query a player's profile")
		.setNameLocalizations({
			"zh-TW": "個人簡介"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查詢玩家的個人簡介"
		})
		.addIntegerOption(option =>
			option
				.setName("uid")
				.setDescription("In-game ID")
				.setNameLocalizations({
					"zh-TW": "uid"
				})
				.setDescriptionLocalizations({
					"zh-TW": "遊戲內的ID"
				})
				.setRequired(false)
		)
		.addUserOption(option =>
			option
				.setName("user")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "使用者"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(false)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		const user = interaction.options.getUser("user") || interaction.user;
		const uid =
			interaction.options.getInteger("uid") ??
			(await getUserUid(user.id));

		if (!uid && user.id == interaction.user.id)
			return failedReply(
				interaction,
				tr("profile_UidNotSet"),
				tr("profile_UidNotSetDesc")
			);

		await interaction.deferReply();

		handleProfileDraw(interaction, tr, user, uid);
	}
};
