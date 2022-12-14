/* eslint-disable no-mixed-spaces-and-tabs */
import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ChannelType,
	ActionRowBuilder,
	ButtonBuilder,
	ComponentType
} from "discord.js";
import moment from "moment";
import { client } from "../../../index.js";
const emoji = client.emoji;

export default {
	data: new SlashCommandBuilder()
		.setName("server")
		.setDescription("Get info of server")
		.setNameLocalizations({
			"zh-TW": "伺服器信息",
			ja: "サーバー"
		})
		.setDescriptionLocalizations({
			"zh-TW": "獲得伺服器的信息",
			ja: "サーバー情報を取得"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("info")
				.setDescription("Get servers info")
				.setNameLocalizations({
					"zh-TW": "資訊",
					ja: "情報"
				})
				.setDescriptionLocalizations({
					"zh-TW": "獲得伺服器資訊",
					ja: "サーバー情報を取得"
				})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("settings")
				.setDescription("Change bot in servers settings")
				.setNameLocalizations({
					"zh-TW": "設定",
					ja: "設定"
				})
				.setDescriptionLocalizations({
					"zh-TW": "更改機器人在伺服器的設定",
					ja: "ボットを設定する"
				})
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		if (args[0] == "info") {
			const roles = interaction.guild.roles.cache
				.sort((a, b) => b.position - a.position)
				.map(role => role.toString());
			const members = interaction.guild.members.cache;
			const channels = interaction.guild.channels.cache;
			const emojis = interaction.guild.emojis.cache;
			const text = channels.filter(
				channel => channel.type === ChannelType.GuildText
			).size;
			const voice = channels.filter(
				channel => channel.type === ChannelType.GuildVoice
			).size;

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId("server_switch")
					.setLabel(tr("infoSwitch")) //切換
					.setStyle(2)
			);
			const row2 = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId("server_switch")
					.setLabel(tr("infoSwitch")) //切換
					.setStyle(2),
				new ButtonBuilder()
					.setCustomId("server_refresh")
					.setLabel(tr("infoRefresh")) //刷新
					.setEmoji("🔄")
					.setStyle(1)
			);

			var curPage = 1;
			const page1 = new EmbedBuilder()
				.setConfig()
				.setTitle(tr("server_Info") + " - " + tr("server_General")) //伺服器資訊
				.setThumbnail(
					interaction.guild.iconURL({
						size: 4096,
						dynamic: true
					})
				)
				.addField(
					tr("server_Name"),
					` \`${interaction.guild.name}\` `,
					true
				)
				.addField(
					tr("server_Owner"),
					`<@${interaction.guild.ownerId}>`,
					true
				)

				.addField(
					tr("server_Tier"),
					interaction.guild.premiumTier
						? `${tr("server_Tier_Lvl")} ${
								interaction.guild.premiumTier
						  }`
						: ` \`${tr("none")}\` `,
					true
				)
				.addField(
					tr("server_Time_Created"),
					`<t:${moment(
						interaction.guild.createdAt
					).unix()}:F> <t:${moment(
						interaction.guild.createdAt
					).unix()}:R>`,
					false
				);

			const page2 = new EmbedBuilder()
				.setConfig()
				.setTitle(tr("server_Info") + " - " + tr("server_Statistics")) //伺服器資訊
				.setThumbnail(
					interaction.guild.iconURL({
						size: 4096,
						dynamic: true
					})
				)
				.addField(
					tr("server_Emoji_Count"),
					` \`${emojis.size}\`\n${emoji.line1}${tr(
						"Regular_Emoji"
					)} \`${emojis.filter(emoji => !emoji.animated).size}\`\n${
						emoji.line2
					}${tr("Animated_Emoji")} \`${
						emojis.filter(emoji => emoji.animated).size
					}\``,
					true
				)
				.addField(
					tr("server_Member_Count"),
					` \`${interaction.guild.memberCount}\`\n${emoji.line1}${tr(
						"server_Member_Human"
					)} \`${
						members.filter(member => !member.user.bot).size
					}\`\n${emoji.line2}${tr("server_Member_Bot")} \`${
						members.filter(member => member.user.bot).size
					}\``,
					true
				)
				.addField(
					tr("server_Channel_Count"),
					` \`${text + voice}\`\n${emoji.line1}${tr(
						"server_Text_Channel"
					)} \`${text}\`\n${emoji.line2}${tr(
						"server_Voice_Channel"
					)} \`${voice}\``,
					true
				)
				.addField(
					tr("server_Role_Count"),
					` \`${roles.length}\` `,
					true
				)
				.addField(
					tr("server_Boost_Count"),
					` \`${
						interaction.guild.premiumSubscriptionCount || "0"
					}\` `,
					true
				);
			var page3;
			// eslint-disable-next-line no-inner-declarations
			function refresh(i) {
				page3 = new EmbedBuilder()
					.setConfig()
					.setTitle(tr("server_Info") + " - " + tr("server_Other")) //伺服器資訊
					.setThumbnail(
						i.guild.iconURL({
							size: 4096,
							dynamic: true
						})
					)
					.addField(
						emoji.online + tr("server_Online"),
						` \`${
							members.filter(
								member => member.presence?.status === "online"
							).size
						}\` `,
						true
					)
					.addField(
						emoji.idle + tr("server_Idle"),
						` \`${
							members.filter(
								member => member.presence?.status === "idle"
							).size
						}\` `,
						true
					)
					.addField(
						emoji.dnd + tr("server_DnD"),
						` \`${
							members.filter(
								member => member.presence?.status === "dnd"
							).size
						}\` `,
						true
					)
					.addField(
						emoji.offline + tr("server_Offline"),
						` \`${
							members.filter(
								member =>
									!member.presence ||
									member.presence?.status == "offline"
							).size
						}\` `,
						true
					);
			}
			refresh(interaction);

			const resp = await interaction.reply({
				embeds: [page1],
				components: [row]
			});

			const filter = i => true;

			const collector = resp.createMessageComponentCollector({
				filter,
				componentType: ComponentType.Button
			});

			collector.on("collect", interaction => {
				if (!interaction.isButton()) return;
				if (interaction.customId === "server_switch") {
					refresh(interaction);
					let pages = [page1, page2, page3];
					if (++curPage > pages.length) curPage = 1;
					if (curPage === 3) {
						return interaction.message.edit({
							embeds: [pages[curPage - 1]],
							components: [row2]
						});
					} else {
						return interaction.message.edit({
							embeds: [pages[curPage - 1]],
							components: [row]
						});
					}
				}
				if (interaction.customId === "server_refresh") {
					refresh(interaction);
					return interaction.message.edit({
						embeds: [page3],
						components: [row2]
					});
				}
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
