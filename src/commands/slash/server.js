/* eslint-disable no-mixed-spaces-and-tabs */
import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ChannelType
} from "discord.js";
import moment from "moment";

export default {
	data: new SlashCommandBuilder()
		.setName("server")
		.setDescription("Get info of server")
		.setNameLocalizations({
			"zh-TW": "伺服器信息",
			ja: "undefined"
		})
		.setDescriptionLocalizations({
			"zh-TW": "獲得伺服器的信息",
			ja: "undefined"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("info")
				.setDescription("Get servers info")
				.setNameLocalizations({
					"zh-TW": "資訊"
				})
				.setDescriptionLocalizations({
					"zh-TW": "獲得伺服器資訊"
				})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("settings")
				.setDescription("Change bot in servers settings")
				.setNameLocalizations({
					"zh-TW": "設定"
				})
				.setDescriptionLocalizations({
					"zh-TW": "更改機器人在伺服器的設定"
				})
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		const member = interaction.guild.members.cache.get(args[1]);
		if (args[0] == "info") {
			const filterLevels = {
				DISABLED: tr("disabled"),
				MEMBERS_WITHOUT_ROLES: tr("filter_NoRole"),
				ALL_MEMBERS: tr("filter_Everyone")
			};

			const verificationLevels = {
				NONE: tr("none"),
				LOW: tr("verify_Low"),
				MEDIUM: tr("verify_Medium"),
				HIGH: "(╯°□°）╯︵ ┻━┻",
				VERY_HIGH: "┻━┻ ﾐヽ(ಠ益ಠ)ノ彡┻━┻"
			};

			const regions = {
				brazil: ":flag_br: " + tr("br"),
				europe: ":flag_eu: " + tr("eu"),
				hongkong: ":flag_hk: " + tr("hk"),
				india: ":flag_in: " + tr("in"),
				japan: ":flag_jp: " + tr("jp"),
				russia: ":flag_ru: " + tr("ru"),
				singapore: ":flag_sg: " + tr("sg"),
				southafrica: ":flag_za: " + tr("za"),
				sydeny: ":flag_au: " + tr("au"),
				"us-central": ":flag_us: " + tr("us-c"),
				"us-east": ":flag_us: " + tr("us-e"),
				"us-west": ":flag_us: " + tr("us-w"),
				"us-south": ":flag_us: " + tr("us-s")
			};

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
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("server_Info")) //伺服器資訊
						.setThumbnail(
							interaction.guild.iconURL({ dynamic: true })
						)
						.addField(
							tr("server_General"), //一般
							`**▶ ${tr("server_Name")}: \`${
								interaction.guild.name
							}\`
                            ▶ ID: \`${interaction.guild.id}\`
                            ▶ ${tr("server_Owner")}: <@${
								interaction.guild.ownerId
							}>
                            ▶ ${tr("server_Region")}: \`${
								regions[interaction.guild.region] ||
								tr("server_Unknown_Region")
							}\`
                            ▶ ${tr("server_Tier")}: \`${
								interaction.guild.premiumTier
									? `${tr("server_Tier_Lvl")} ${
											interaction.guild.premiumTier
									  }`
									: tr("none")
							}\`
                            ▶ ${tr("server_Filter_Lvl")}: \`${
								filterLevels[
									interaction.guild.explicitContentFilter
								]
							}\`
                            ▶ ${tr("server_Verification_Lvl")}: \`${
								verificationLevels[
									interaction.guild.verificationLevel
								]
							}\`
                            ▶ ${tr("server_Time_Created")}: <t:${moment(
								interaction.guild.createdAt
							).unix()}:F> <t:${moment(
								interaction.guild.createdAt
							).unix()}:R>
                        **`,
							false
						)
						.addField(
							tr("server_Statistics"), //狀態
							`**▶ ${tr("server_Role_Count")}: \`${roles.length}\`
                            ▶ ${tr("server_Emoji_Count")}: \`${emojis.size}\`
                            > ${tr("Regular_Emoji")}: \`${
								emojis.filter(emoji => !emoji.animated).size
							}\`
                            > ${tr("Animated_Emoji")}: \`${
								emojis.filter(emoji => emoji.animated).size
							}\`
                            ▶ ${tr("server_Member_Count")}: \`${
								interaction.guild.memberCount
							}\`
                            > ${tr("server_Member_Human")}: \`${
								members.filter(member => !member.user.bot).size
							}\`
                            > ${tr("server_Member_Bot")}: \`${
								members.filter(member => member.user.bot).size
							}\`
                            ▶ ${tr("server_Channel_Count")}: \`${text + voice}\`
                            > ${tr("server_Text_Channel")}: \`${text}\`
                            > ${tr("server_Voice_Channel")}: \`${voice}\`
                            ▶ ${tr("server_Boost_Count")}: \`${
								interaction.guild.premiumSubscriptionCount ||
								"0"
							}\`
                        **`,
							false
						)
					// .addField(
					//     tr("server_Presence"), //線上
					//     `**▶ ${tr('server_Online')}: \`${members.filter(member => member.presence.status === 'online').size}\`
					//         ▶ ${tr('server_Idle')}: \`${members.filter(member => member.presence.status === 'idle').size}\`
					//         ▶ ${tr('server_DnD')}: \`${members.filter(member => member.presence.status === 'dnd').size}\`
					//         ▶ ${tr('server_Offline')}: \`${members.filter(member => member.presence.status === 'offline').size}\`
					//     **`
					// )
				]
			});
		} else {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(tr("Cmd_ComingSoon"))
				]
			});
		}
	}
};
