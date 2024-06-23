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
								name_localizations: { "zh-TW": "自動簽到" },
								value: "autoDaily"
							},
							{
								name: "autonotify",
								name_localizations: { "zh-TW": "自動通知" },
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
				.addStringOption(option =>
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
								name_localizations: { "zh-TW": "全部" },
								value: "all"
							},
							{
								name: "autodaily",
								name_localizations: { "zh-TW": "自動簽到" },
								value: "autoDaily"
							},
							{
								name: "autonotify",
								name_localizations: { "zh-TW": "自動通知" },
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
		) {
			return interaction.reply({
				embeds: [
					createEmbed(
						tr("admin_NoPermission"),
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
						"#E76161"
					)
				],
				ephemeral: true
			});
		}

		const cmd = interaction.options.getSubcommand();
		switch (cmd) {
			case "remove":
				await handleRemove(interaction, tr, db);
				break;
			case "move":
				await handleMove(interaction, tr, db);
				break;
		}
	}
};

const createEmbed = (title, thumbnail, color, description = "") => {
	const embed = new EmbedBuilder()
		.setThumbnail(thumbnail)
		.setColor(color)
		.setTitle(title);
	if (description) embed.setDescription(description);

	return embed;
};

const handleRemove = async (interaction, tr, db) => {
	const user = interaction.options.getUser("user");
	const userid = user ? user.id : interaction.options.getString("userid");
	const feature = interaction.options.getString("feature");
	const datas = await db.get(feature);
	const data = Object.keys(datas);

	if (!userid) {
		return interaction.reply({
			embeds: [
				createEmbed(
					tr("admin_RemoveFail"),
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
					"#E76161"
				)
			],
			ephemeral: true
		});
	}

	if (!data.includes(userid)) {
		return interaction.reply({
			embeds: [
				createEmbed(
					tr("admin_RemoveFail"),
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
					"#E76161",
					tr("admin_UserNotSet", { user: `<@${userid}>` })
				)
			],
			ephemeral: true
		});
	}

	const userData = datas[userid];
	if (
		!interaction.guild.channels.cache.some(
			channel => channel.id === userData.channelId
		)
	) {
		return interaction.reply({
			embeds: [
				createEmbed(
					tr("admin_RemoveFail"),
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
					"#E76161",
					tr("admin_RemoveFailUserOtherServer", {
						user: `<@${userid}>`
					})
				)
			],
			ephemeral: true
		});
	}

	interaction.reply({
		embeds: [
			createEmbed(
				tr("admin_RemoveSuccess"),
				"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png",
				"#F6F1F1",
				tr("admin_RemoveSuccessMessage", {
					user: `<@${userid}>`,
					channel: `<#${userData.channelId}>`
				})
			)
		],
		ephemeral: true
	});
	await db.delete(`${feature}.${userid}`);
};

const handleMove = async (interaction, tr, db) => {
	const channel = interaction.options.getChannel("channel");
	const feature = interaction.options.getString("feature");

	if (
		!interaction.guild.members.me
			.permissionsIn(channel)
			.has(PermissionsBitField.Flags.SendMessages)
	) {
		return interaction.reply({
			embeds: [
				createEmbed(
					tr("admin_MoveFail"),
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
					"#E76161",
					tr("admin_MoveNoPermission", {
						channel: `<#${channel.id}>`
					})
				)
			],
			ephemeral: true
		});
	}

	if (
		[
			ChannelType.GuildText,
			ChannelType.PrivateThread,
			ChannelType.PublicThread,
			ChannelType.GuildVoice
		].includes(channel.type)
	) {
		await interaction.deferReply({ ephemeral: true });

		const keywords =
			feature === "all" ? ["autoDaily", "autoNotify"] : [feature];
		const datas = await fetchData(db, keywords);

		const matchUsers = findMatchedUsers(
			datas,
			interaction.guild.channels.cache
		);

		await updateUsersChannel(datas, matchUsers, keywords, channel.id, db);

		interaction.editReply({
			embeds: [
				createEmbed(
					tr("admin_MoveSuccess"),
					"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png",
					"#F6F1F1",
					tr("admin_MoveSuccessMessage", {
						count: matchUsers.length,
						channel: `<#${channel.id}>`
					})
				)
			]
		});
	} else {
		return interaction.reply({
			embeds: [
				createEmbed(
					tr("admin_MoveFail"),
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png",
					"#E76161",
					tr("admin_MoveFailMessage", { channel: `<#${channel.id}>` })
				)
			],
			ephemeral: true
		});
	}
};

const fetchData = async (db, keywords) => {
	const [autoDailyData, autoNotifyData] = await Promise.all([
		db.get("autoDaily"),
		db.get("autoNotify")
	]);

	return {
		autoDaily: autoDailyData,
		autoNotify: autoNotifyData
	};
};

const findMatchedUsers = (datas, channelsCache) => {
	const serverChannelIds = channelsCache.map(channel => channel.id);

	return Object.keys(datas).reduce((acc, keyword) => {
		const matchedUsers = Object.keys(datas[keyword]).filter(userId =>
			serverChannelIds.includes(datas[keyword][userId].channelId)
		);
		return acc.concat(matchedUsers);
	}, []);
};

const updateUsersChannel = async (
	datas,
	matchUsers,
	keywords,
	channelId,
	db
) => {
	for (const userId of matchUsers) {
		for (const keyword of keywords) {
			const userData = datas[keyword][userId];
			if (userData) {
				userData.channelId = channelId;
				await db.set(`${keyword}.${userId}`, userData);
			}
		}
	}
};
