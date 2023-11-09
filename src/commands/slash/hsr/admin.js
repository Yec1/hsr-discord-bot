import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ChannelType,
	PermissionsBitField
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("admin")
		.setDescription("Server administrator settings")
		.setNameLocalizations({
			"zh-TW": "管理員"
		})
		.setDescriptionLocalizations({
			"zh-TW": "伺服器管理員的設定"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("remove")
				.setDescription(
					"Remove notifications from a user's messages in a channel"
				)
				.setNameLocalizations({
					"zh-TW": "刪除"
				})
				.setDescriptionLocalizations({
					"zh-TW": "刪除使用者在頻道中的訊息通知"
				})
				.addStringOption(option =>
					option
						.setName("feature")
						.setDescription(
							"Select the features you want to remove user from"
						)
						.setNameLocalizations({
							"zh-TW": "功能"
						})
						.setDescriptionLocalizations({
							"zh-TW": "選擇要刪除使用者的功能"
						})
						.setRequired(true)
						.addChoices(
							{
								name: "autodaily",
								name_localizations: {
									"zh-TW": "自動簽到"
								},
								value: "autoDaily"
							},
							{
								name: "autonotify",
								name_localizations: {
									"zh-TW": "自動通知"
								},
								value: "autoNotify"
							}
						)
				)
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("Select user to remove")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setDescriptionLocalizations({
							"zh-TW": "選擇要刪除的使用者"
						})
						.setRequired(false)
				)
				.addIntegerOption(option =>
					option
						.setName("userid")
						.setDescription("Enter the user ID you want to delete")
						.setNameLocalizations({
							"zh-TW": "使用者id"
						})
						.setDescriptionLocalizations({
							"zh-TW": "輸入要刪除的使用者ID"
						})
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("move")
				.setDescription("Change the channel for message notifications")
				.setNameLocalizations({
					"zh-TW": "移動"
				})
				.setDescriptionLocalizations({
					"zh-TW": "更改訊息通知的頻道"
				})
				.addStringOption(option =>
					option
						.setName("feature")
						.setDescription("Select features to move")
						.setNameLocalizations({
							"zh-TW": "功能"
						})
						.setDescriptionLocalizations({
							"zh-TW": "選擇移動的功能"
						})
						.setRequired(true)
						.addChoices(
							{
								name: "all",
								name_localizations: {
									"zh-TW": "全部"
								},
								value: "all"
							},
							{
								name: "autodaily",
								name_localizations: {
									"zh-TW": "自動簽到"
								},
								value: "autoDaily"
							},
							{
								name: "autonotify",
								name_localizations: {
									"zh-TW": "自動通知"
								},
								value: "autoNotify"
							}
						)
				)
				.addChannelOption(option =>
					option
						.setName("channel")
						.setDescription("Select channel to remove")
						.setNameLocalizations({
							"zh-TW": "頻道"
						})
						.setDescriptionLocalizations({
							"zh-TW": "選擇要移動至哪個頻道"
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
	async execute(client, interaction, args, tr, db, emoji) {
		if (
			!interaction.member.permissions.has(
				PermissionsBitField.Flags.ManageGuild
			)
		)
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setConfig("#E76161")
						.setTitle(`${tr("admin_noPer")}`)
				],
				ephemeral: true
			});

		const cmd = interaction.options.getSubcommand();
		if (cmd == "remove") {
			const user = interaction.options.getUser("user");
			const userid = user
				? user.id
				: interaction.options.getString("userid");
			const feature = interaction.options.getString("feature");
			const datas = await db.get(feature);
			const data = Object.keys(datas);

			if (!userid)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setConfig("#E76161")
							.setTitle(`${tr("admin_removeFail")}`)
					],
					ephemeral: true
				});

			if (!data.includes(userid))
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setConfig("#E76161")
							.setTitle(`${tr("admin_removeFail")}`)
							.setDescription(
								`${tr("admin_noUserSet", {
									z: `<@${userid}>`
								})}`
							)
					],
					ephemeral: true
				});

			const userData = datas[userid];
			if (
				!interaction.guild.channels.cache.some(
					channel => channel.id === userData.channelId
				)
			)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setConfig("#E76161")
							.setTitle(`${tr("admin_removeFail")}`)
							.setDescription(
								`${tr("admin_removeFailed", {
									z: `<@${userid}>`
								})}`
							)
					],
					ephemeral: true
				});

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setConfig("#F6F1F1")
						.setTitle(`${tr("admin_removeSus")}`)
						.setDescription(
							`${tr("admin_removeSusMsg", {
								z: `<@${userid}>`,
								c: `<#${userData.channelId}>`
							})}`
						)
				],
				ephemeral: true
			});
			await db.delete(`${feature}.${userid}`);
		} else if (cmd == "move") {
			const channel = interaction.options.getChannel("channel");
			const feature = interaction.options.getString("feature");

			if (
				!interaction.guild.members.me
					.permissionsIn(channel)
					.has(PermissionsBitField.Flags.SendMessages)
			)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setConfig("#E76161")
							.setTitle(`${tr("admin_moveFail")}`)
							.setDescription(
								`${tr("admin_moveNoPer", {
									z: `<#${channel.id}>`
								})}`
							)
					],
					ephemeral: true
				});

			if (
				channel.type == ChannelType.GuildText ||
				channel.type == ChannelType.PrivateThread ||
				channel.type == ChannelType.PublicThread ||
				channel.type == ChannelType.GuildVoice
			) {
				await interaction.deferReply({ ephemeral: true });

				const keywords =
					feature === "all" ? ["autoDaily", "autoNotify"] : [feature];
				const datas = {};

				const [autoDailyData, autoNotifyData] = await Promise.all([
					db.get("autoDaily"),
					db.get("autoNotify")
				]);

				datas.autoDaily = autoDailyData;
				datas.autoNotify = autoNotifyData;

				const matchUsers = [];
				const serverChannelIds = interaction.guild.channels.cache.map(
					channel => channel.id
				);

				for (const keyword of keywords) {
					if (Array.isArray(datas[keyword])) {
						const matchedUsers = Object.keys(datas[keyword]).filter(
							userId =>
								serverChannelIds.includes(
									datas[keyword][userId].channelId
								)
						);
						matchUsers.push(...matchedUsers);
					} else {
						const matchedUsers = Object.keys(datas[keyword]).filter(
							userId =>
								serverChannelIds.includes(
									datas[keyword][userId].channelId
								)
						);
						matchUsers.push(...matchedUsers);
					}
				}

				for (const userId of matchUsers) {
					for (const keyword of keywords) {
						const userData = datas[keyword][userId];
						if (userData) {
							userData.channelId = channel.id;
							await db.set(`${keyword}.${userId}`, userData);
						}
					}
				}

				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
							)
							.setConfig("#F6F1F1")
							.setTitle(`${tr("admin_moveSus")}`)
							.setDescription(
								`${tr("admin_moveSusMsg", {
									c: `${matchUsers.length}`,
									z: `<#${channel.id}>`
								})}`
							)
					]
				});
			} else
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setConfig("#E76161")
							.setTitle(`${tr("admin_moveFail")}`)
							.setDescription(
								`${tr("admin_moveFailed", {
									z: `<#${channel.id}>`
								})}`
							)
					],
					ephemeral: true
				});
		}
	}
};
