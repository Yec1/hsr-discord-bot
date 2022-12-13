import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder
} from "discord.js";
import { client } from "../../../index.js";
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
			"zh-TW": "用戶資訊",
			ja: "ユーザー情報"
		})
		.setDescriptionLocalizations({
			"zh-TW": "獲得用戶的資訊",
			ja: "ユーザーの情報を取得"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("avatar")
				.setDescription("Get users avatar")
				.setNameLocalizations({
					"zh-TW": "頭貼",
					ja: "アイコン"
				})
				.setDescriptionLocalizations({
					"zh-TW": "獲得用戶的頭貼",
					ja: "ユーザーアイコンを返事する"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("User who you want to get avatar")
						.setNameLocalizations({
							"zh-TW": "用戶",
							ja: "ユーザー"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想查看頭貼的用戶",
							ja: "ユーザーを入力して"
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
					"zh-TW": "資訊"
				})
				.setDescriptionLocalizations({
					"zh-TW": "查看用戶的資訊"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("User who you want to get info on")
						.setNameLocalizations({
							"zh-TW": "用戶"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想查看用戶資訊的用戶"
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
	async execute(client, interaction, args, tr) {
		const member = interaction.guild.members.cache.get(args[1]);
		if (args[0] == "avatar") {
			await interaction.reply({
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
							.setLabel(tr("user_Full_Image")) //完整圖片
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
			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`color: ${
								data.banner_color || data.color || "none"
							}`
						)
						.setImage(banner)
						.setConfig()
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setLabel(tr("user_Full_Image")) //完整圖片
							.setEmoji("🖼️")
							.setURL(banner)
							.setStyle(5)
					)
				]
			});
		} else if (args[0] == "info") {
			const member = interaction.guild.members.cache.get(args[1]);
			const statuses = {
				online: client.emoji.online,
				dnd: client.emoji.dnd,
				idle: client.emoji.idle,
				offline: client.emoji.offline,
			};
			const flags = {
				"": " ",
				"DISCORD_EMPLOYEE": client.emoji.staff,
				"DISCORD_PARTNER": client.emoji.partner,
				"BUGHUNTER_LEVEL_1": client.emoji.bughunter1,
				"BUGHUNTER_LEVEL_2": client.emoji.bughunter2,
				"HYPESQUAD_EVENTS": client.emoji.hypesquadevents,
				"HypeSquadOnlineHouse1": client.emoji.hypesquadbrilliance,
				"HypeSquadOnlineHouse2": client.emoji.hypesquadbravery,
				"HypeSquadOnlineHouse3": client.emoji.hypesquadbalance,
				"EARLY_SUPPORTER": client.emoji.earlysupporter,
				"TEAM_USER": client.emoji.hypesquadbalance,
				"VERIFIED_BOT": client.emoji.verify,
				"EARLY_VERIFIED_DEVELOPER": client.emoji.botdev,
				"ActiveDeveloper": client.emoji.activedeveloper
			};			

			console.log(member.user.flags.toArray())

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setThumbnail(member.user.displayAvatarURL({
							size: 4096,
							dynamic: true
						}))
						.addField("Tag", member.user.tag, true)
						.addField("ID", member.user.id, true)
						.addField("Nick", member.nickname === null ? tr("none") : member.nickname, true)
						.addField("Status", member.presence ? statuses[member.presence.status] : client.emoji.offline, true)
						// .addField("Badge", flags[member.user.flags.toArray()], true)
				]
			});
		} else {
			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(tr("Cmd_ComingSoon"))
				]
			});
		}
	}
};
