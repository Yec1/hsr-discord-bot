import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import {
	failedReply,
	getUserCookie,
	getUserUid
} from "../../../utilities/utilities.js";
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
		.addBooleanOption(option =>
			option
				.setName("allcharacters")
				.setDescription("Show all characters (need bind account)")
				.setNameLocalizations({
					"zh-TW": "展示全部角色"
				})
				.setDescriptionLocalizations({
					"zh-TW": "展示全部角色 (需要綁定帳號)"
				})
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName("account")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "帳號"
				})
				.setRequired(false)
				.setAutocomplete(true)
		)
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
		const accountIndex = interaction.options.getString("account") || 0;
		const isSearchUid = interaction.options.getInteger("uid") ?? false;
		const uid = isSearchUid || (await getUserUid(user.id, accountIndex));

		const allCharacters = isSearchUid
			? false
			: (interaction.options.getBoolean("allcharacters") ??
				(uid && (await getUserCookie(user.id, accountIndex))
					? true
					: false));

		if (!uid && user.id == interaction.user.id)
			return failedReply(
				interaction,
				tr("profile_UidNotSet"),
				tr("profile_UidNotSetDesc")
			);

		await interaction.deferReply();

		handleProfileDraw(
			interaction,
			tr,
			user,
			uid,
			allCharacters,
			accountIndex
		);
	}
};
