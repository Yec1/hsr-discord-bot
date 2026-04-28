import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { failedReply, getUserCookie, getUserUid } from "@/utilities/index.js";
import { handleProfileDraw } from "@/utilities/hsr/profile.js";
import type { TranslationFunction } from "@/types/index.js";

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
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	) {
		const user = interaction.options.getUser("user") || interaction.user;
		const accountIndex = interaction.options.getString("account") || "0";
		const isSearchUid = interaction.options.getInteger("uid") ?? false;
		const uid =
			isSearchUid || (await getUserUid(user.id, parseInt(accountIndex)));

		const allCharacters = isSearchUid
			? false
			: (interaction.options.getBoolean("allcharacters") ??
				(uid && (await getUserCookie(user.id, parseInt(accountIndex)))
					? true
					: false));

		if (!uid && user.id == interaction.user.id)
			return failedReply(
				interaction,
				tr("profile_UidNotSet"),
				tr("profile_UidNotSetDesc")
			);

		await interaction.deferReply();

		await handleProfileDraw(
			interaction,
			tr,
			user,
			(uid || "").toString(),
			allCharacters,
			parseInt(accountIndex)
		);
	}
};
