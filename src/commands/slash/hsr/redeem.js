import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import {
	failedReply,
	getRedeemCodes,
	getRandomColor,
	getUserHSRData
} from "../../../utilities/utilities.js";

export default {
	data: new SlashCommandBuilder()
		.setName("codes")
		.setDescription("Redeem codes for rewards")
		.setNameLocalizations({
			"zh-TW": "兌換碼"
		})
		.setDescriptionLocalizations({
			"zh-TW": "兌換代碼獲取獎勵"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("list")
				.setDescription("Check available codes")
				.setNameLocalizations({
					"zh-TW": "列表"
				})
				.setDescriptionLocalizations({
					"zh-TW": "查看當前可用兌換碼"
				})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("redeem")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "兌換"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.addStringOption(option =>
					option
						.setName("code")
						.setDescription("Enter the code to redeem")
						.setNameLocalizations({
							"zh-TW": "禮包碼"
						})
						.setDescriptionLocalizations({
							"zh-TW": "在這裡輸入要兌換的禮包碼"
						})
						.setRequired(true)
				)
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("Help other user redeem code")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setDescriptionLocalizations({
							"zh-TW": "幫其他使用者兌換代碼"
						})
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("autoredeem")
				.setDescription(
					"Automatic when theres available codes, messages will be sent wherever command used!"
				)
				.setNameLocalizations({
					"zh-TW": "自動兌換"
				})
				.setDescriptionLocalizations({
					"zh-TW": "自動兌換代碼，訊息會在使用指令的地方自動發送！"
				})
				.addStringOption(option =>
					option
						.setName("enable")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "開啟"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(true)
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
				.addStringOption(option =>
					option
						.setName("tag")
						.setDescription(
							"Whether mark in the automatic redeem, turn on this also turn on the automatic redeem"
						)
						.setNameLocalizations({
							"zh-TW": "標註"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"是否在自動兌換中標註，開啟這個也相當於開啟了自動兌換"
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
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db) {
		const subcommand = interaction.options.getSubcommand();
		await interaction.deferReply({ ephemeral: true });

		if (subcommand == "list") {
			const codes = await getRedeemCodes();
			const userRedeemedCodes =
				(await db.get(`${interaction.user.id}.redeemedCodes`)) || [];

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTimestamp()
						.setColor(getRandomColor())
						.setTitle("當前可用兌換碼")
						.setFooter({
							text: "使用機器人兌換過的禮包碼才會顯示已兌換"
						})
						.setDescription(
							`${codes
								.map((code, index) => {
									const redeemed = userRedeemedCodes.includes(
										code.code
									);
									return `${index}. ${code.code} ${redeemed ? "`✅已兌換`" : "`❌未兌換`"}`;
								})
								.join("\n")}`
						)
				],
				ephemeral: true
			});
		} else if (subcommand == "redeem") {
			const code = interaction.options.getString("code");
			const targetUser =
				interaction.options.getUser("user") || interaction.user;

			const hsr = await getUserHSRData(interaction, tr, targetUser.id);
			if (!hsr) return;

			try {
				const res = await hsr.redeem.claim(code);
				console.log(res);
				if (res.retcode == 0) {
					const codesList = await getRedeemCodes();
					const matchCode = codesList.find(c => c.code == code);
					const userRedeemedCodes =
						(await db.get(`${targetUser.id}.redeemedCodes`)) || [];
					userRedeemedCodes.push(code);
					await db.set(
						`${targetUser.id}.redeemedCodes`,
						userRedeemedCodes
					);

					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(getRandomColor())
								.setTitle(tr("redeem_Success"))
								.setThumbnail(matchCode.rewards[0].icon || "")
								.setDescription(
									matchCode.rewards
										.map((reward, index) => {
											return `${index}. \`${tr(reward.reward)}${
												reward.count != null
													? ` x${reward.count}`
													: ""
											}\``;
										})
										.join("\n")
								)
						],
						ephemeral: true
					});
				} else {
					failedReply(interaction, res.message);
				}
			} catch (e) {
				failedReply(interaction, e.message);
			}
		} else if (subcommand == "autoredeem") {
			const hsr = await getUserHSRData(
				interaction,
				tr,
				interaction.user.id
			);
			if (!hsr) return;
			const userAccount = await db.get(`${interaction.user.id}.account`);
			if (
				!userAccount[0].cookie.includes("cookie_token_v2") &&
				!userAccount[0].cookie.includes("account_mid_v2")
			) {
				return failedReply(interaction, tr("redeen_NoCookie"));
			}

			const enable = interaction.options.getString("enable");
			const tag = interaction.options.getString("tag") || false;

			if (enable == "on") {
				await db.set(`autoRedeem.${interaction.user.id}`, {
					channelId: interaction.channel.id,
					tag: tag || false
				});

				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#A2CDB0")
							.setTitle(tr("autoRedeem_On"))
							.setDescription(
								tr("autoRedeem_Tag", {
									z:
										tag === "true"
											? "`" + tr("True") + "`"
											: "`" + tr("False") + "`"
								})
							)
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
							)
					]
				});
			} else {
				await db.delete(`autoRedeem.${interaction.user.id}`);
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("autoDaily_Off"))
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
							)
					]
				});
			}
		}
	}
};
