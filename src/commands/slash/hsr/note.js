import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import {
	getUserHSRData,
	getRandomColor
} from "../../../utilities/utilities.js";
import { handleNoteDraw } from "../../../utilities/hsr/note.js";

export default {
	data: new SlashCommandBuilder()
		.setName("note")
		.setDescription("View current stamina and expedition progress")
		.setNameLocalizations({
			"zh-TW": "即時便箋"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看當前體力和委託進度"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("autonotify")
				.setDescription(
					"Automatic notification of stamina limit or expedition"
				)
				.setNameLocalizations({
					"zh-TW": "自動通知"
				})
				.setDescriptionLocalizations({
					"zh-TW":
						"自動通知體力額度或者委託，訊息會在使用指令的地方自動發送！"
				})
				.addStringOption(option =>
					option
						.setName("autonotify")
						.setDescription(
							"Automatic notification of stamina limit or expedition"
						)
						.setNameLocalizations({
							"zh-TW": "自動通知"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"自動通知體力額度或者委託，訊息會在使用指令的地方自動發送！"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "on"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "off"
							}
						)
				)
				.addIntegerOption(option =>
					option
						.setName("stamina")
						.setDescription(
							"Detect once every hour whether the current stamina is greater than the set value"
						)
						.setNameLocalizations({
							"zh-TW": "體力通知"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"每個小時偵測一次當前體力是否大於設置的值，大於則通知"
						})
						.setRequired(false)
						.setMaxValue(240)
						.setMinValue(0)
				)
				.addStringOption(option =>
					option
						.setName("expedition")
						.setDescription(
							"Whether to notify when the expedition can be claimed"
						)
						.setNameLocalizations({
							"zh-TW": "委託通知"
						})
						.setDescriptionLocalizations({
							"zh-TW": "委託可領取時是否通知"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "true"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "false"
							}
						)
				)
				.addStringOption(option =>
					option
						.setName("tag")
						.setDescription(
							"Whether mark in the automatic check-in, turn on this also turn on the automatic check-in"
						)
						.setNameLocalizations({
							"zh-TW": "標註"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"是否在自動通知中標註，開啟這個也相當於開啟了自動通知"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "true"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "false"
							}
						)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("check")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "查看"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setRequired(false)
				)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const subCommand = interaction.options.getSubcommand();
		if (subCommand == "check") {
			const targetUser =
				interaction.options.getUser("user") || interaction.user;

			const hsr = await getUserHSRData(interaction, tr, targetUser.id);
			if (hsr == null) return;

			await interaction.deferReply();
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor())
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				],
				components: [],
				fetchReply: true
			});

			handleNoteDraw(interaction, tr, hsr);
		}
	}
};
