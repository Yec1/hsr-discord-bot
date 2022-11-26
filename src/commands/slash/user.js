import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder
} from "discord.js";
import { client } from "../../index.js";
import banner from "discord-banner";
banner(client.config.token, {
	cacheTime: 60 * 60 * 1000
});
import { getUserBanner } from "discord-banner";

export default {
	data: new SlashCommandBuilder()
		.setName("user")
		.setDescription("Get info of a selected user")
		.setNameLocalizations({
			"zh-TW": "用戶信息",
			"ja": "ユーザー情報"
		})
		.setDescriptionLocalizations({
			"zh-TW": "獲得用戶的信息",
			"ja": "ユーザーの情報を取得する"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("avatar")
				.setDescription("Get users avatar")
				.setNameLocalizations({
					"zh-TW": "頭貼"
				})
				.setDescriptionLocalizations({
					"zh-TW": "獲得用戶的頭貼"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("User who you want to get avatar")
						.setNameLocalizations({
							"zh-TW": "用戶"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想查看頭貼的用戶"
						})
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("banner")
				.setDescription("Get a user's banner or their accent color.")
				.setNameLocalizations({
					"zh-TW": "橫幅"
				})
				.setDescriptionLocalizations({
					"zh-TW": "獲得用戶的橫幅或橫幅顏色"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("User who you want to get avatar")
						.setNameLocalizations({
							"zh-TW": "用戶"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想查看封面的用戶"
						})
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("info")
				.setDescription("Get user info")
				.setNameLocalizations({
					"zh-TW": "查看用戶的信息"
				})
				.setDescriptionLocalizations({
					"zh-TW": "查看用戶的信息"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("User who you want to get info on")
						.setNameLocalizations({
							"zh-TW": "用戶"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想查看用戶信息的用戶"
						})
						.setRequired(true)
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args) {
		const member = interaction.guild.members.cache.get(args[1]);
		if (args[0] == "avatar") {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setImage(
							member.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})
						)
						.setConfig()
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setLabel("完整圖片")
							.setEmoji("🖼️")
							.setURL(
								member.user.displayAvatarURL({
									size: 4096,
									dynamic: true
								})
							)
							.setStyle(5)
					)
				]
			});
		} else if (args[0] == "banner") {
			const data = await getUserBanner(args[1]);
			const banner =
				data.url ||
				`https://serux.pro/rendercolour?hex=${
					(data.banner_color || data.color).replace("#", "") ||
					"ffffff"
				}&height=200&width=512`;
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`Color: ${
								data.banner_color || data.color || "none"
							}`
						)
						.setImage(banner)
						.setConfig()
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setLabel("完整圖片")
							.setEmoji("🖼️")
							.setURL(banner)
							.setStyle(5)
					)
				]
			});
		} else {
			await interaction.editReply({
				content: "功能未開放。"
			});
		}
	}
};
