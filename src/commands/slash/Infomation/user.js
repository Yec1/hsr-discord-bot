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
import moment from "moment";
const emoji = client.emoji;

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
				online: emoji.online,
				dnd: emoji.dnd,
				idle: emoji.idle,
				offline: emoji.offline
			};
			const flags = {
				Staff: emoji.staff,
				CertifiedModerator: emoji.certifiedmod,
				Partner: emoji.partner,
				BugHunterLevel1: emoji.bughunter1,
				BugHunterLevel2: emoji.bughunter2,
				Hypesquad: emoji.hypesquadevents,
				HypeSquadOnlineHouse1: emoji.hypesquadbrilliance,
				HypeSquadOnlineHouse2: emoji.hypesquadbravery,
				HypeSquadOnlineHouse3: emoji.hypesquadbalance,
				PremiumEarlySupporter: emoji.earlysupporter,
				TeamPseudoUser: emoji.hypesquadbalance,
				VerifiedBot: emoji.verify,
				VerifiedDeveloper: emoji.botdev,
				ActiveDeveloper: emoji.activedeveloper
			};
			const userFlags = (await member.user.fetchFlags()).toArray();

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(member.user.username + tr("user_header"))
						.setThumbnail(
							member.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})
						)
						.addField(
							tr("user_tag"),
							` \`${member.user.tag}\` `,
							true
						)
						.addField("ID", ` \`${member.user.id}\` `, true)
						.addField(
							tr("user_nick"),
							!member.nickname
								? ` \`${tr("none")}\` `
								: ` \`${member.nickname}\` `,
							true
						)
						.addField(
							tr("user_badge"),
							userFlags.map(flag => flags[flag]).join(" ") ||
								tr("none"),
							true
						)
						.addField(
							tr("user_status"),
							member.presence
								? statuses[member.presence.status]
								: emoji.offline,
							true
						)
						.addField(
							tr("user_createdate"),
							`<t:${moment(member.user.createdAt).unix()}:F>`,
							false
						)
						.addField(
							tr("user_joindate"),
							`<t:${moment(member.joinedAt).unix()}:F>`,
							true
						)
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
