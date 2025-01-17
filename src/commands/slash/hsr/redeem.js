import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import {
	failedReply,
	getRedeemCodes,
	getRandomColor,
	getUserHSRData,
	getUserUid
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
				.setName("redeemall")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "兌換全部"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
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
			const accountIndex = interaction.options.getString("account") || 0;
			const codes = await getRedeemCodes();
			const uid = await getUserUid(interaction.user.id, accountIndex);
			const userRedeemedCodes =
				(await db.get(`${uid}.redeemedCodes`)) || [];

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
		} else if (subcommand == "redeemall") {
			const accountIndex = interaction.options.getString("account") || 0;
			const targetUser =
				interaction.options.getUser("user") || interaction.user;

			const hsr = await getUserHSRData(
				interaction,
				tr,
				targetUser.id,
				accountIndex
			);
			if (!hsr) return;

			const uid = await getUserUid(targetUser.id, accountIndex);
			const codes = await getRedeemCodes();
			let userRedeemedCodes =
				(await db.get(`${uid}.redeemedCodes`)) || [];

			const noRedeemedCodes = codes.filter(
				code => !userRedeemedCodes.includes(code.code)
			);

			for (let i = 0; i < noRedeemedCodes.length; i++) {
				const code = noRedeemedCodes[i];
				try {
					// 更新進度訊息，加入已處理的兌換結果
					const processedResults = noRedeemedCodes
						.slice(0, i)
						.map(c => {
							if (c.status === "success")
								return `✅ ${c.code} (${tr("redeem_Success")})`;
							if (c.status === "already")
								return `ℹ️ ${c.code} (${tr("redeem_Already")})`;
							if (c.status === "invalid")
								return `⚠️ ${c.code} (${tr("redeem_Invalid")})`;
							if (c.status === "failed")
								return `❌ ${c.code} (${tr("redeem_Failed")})`;
							return `⏳ ${c.code} (${tr("redeem_Processing")})`;
						})
						.join("\n");

					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(getRandomColor())
								.setTitle(
									`${tr("redeem_Redeeming")} ${code.code}`
								)
								.setDescription(
									tr("redeem_ProcessingDesc", {
										noRedeemedCodes:
											noRedeemedCodes.length - i,
										seconds:
											(noRedeemedCodes.length - i) * 3
									}) +
										"\n\n" +
										(processedResults
											? `${tr("redeem_Processed")}:\n${processedResults}`
											: "")
								)
								.setThumbnail(
									"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
								)
						],
						ephemeral: true
					});

					const res = await hsr.redeem.claim(code.code);
					if (res.retcode == 0 || res.message == "OK") {
						code.status = "success"; // 標記為兌換成功
						if (!userRedeemedCodes.includes(code.code))
							userRedeemedCodes.push(code.code);
					} else if (res.retcode == -2017 || res.retcode == -2018) {
						code.status = "already"; // 標記為已兌換過
						if (!userRedeemedCodes.includes(code.code))
							userRedeemedCodes.push(code.code);
					} else if (res.retcode == -2001 || res.retcode == -2006) {
						code.status = "invalid"; // 標記為無效
						if (!userRedeemedCodes.includes(code.code))
							userRedeemedCodes.push(code.code);
					}

					userRedeemedCodes = Array.from(new Set(userRedeemedCodes));
					await db.set(`${uid}.redeemedCodes`, userRedeemedCodes);
					await new Promise(resolve => setTimeout(resolve, 3000));
				} catch (e) {
					code.status = "failed"; // 標記為兌換失敗
					failedReply(interaction, e.message);
				}
			}

			// 最終結果顯示
			const results = {
				success: noRedeemedCodes.filter(c => c.status === "success"),
				already: noRedeemedCodes.filter(c => c.status === "already"),
				invalid: noRedeemedCodes.filter(c => c.status === "invalid"),
				failed: noRedeemedCodes.filter(c => c.status === "failed")
			};

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor())
						.setTitle(tr("redeem_SuccessDesc"))
						.setDescription(
							results.success
								.map(
									code =>
										`✅ **${code.code}** (${tr("redeem_Success")})`
								)
								.join("\n") +
								(results.already.length
									? "\n" +
										results.already
											.map(
												code =>
													`ℹ️ **${code.code}** (${tr("redeem_Already")})`
											)
											.join("\n")
									: "") +
								(results.invalid.length
									? "\n" +
										results.invalid
											.map(
												code =>
													`⚠️ **${code.code}** (${tr("redeem_Invalid")})`
											)
											.join("\n")
									: "") +
								(results.failed.length
									? "\n" +
										results.failed
											.map(
												code =>
													`❌ **${code.code}** (${tr("redeem_Failed")})`
											)
											.join("\n")
									: "") +
								`\n### ${tr("redeem_RedeemStats")}\n` +
								`✅ ${tr("redeem_Success")}: ${results.success.length}\n` +
								`ℹ️ ${tr("redeem_Already")}: ${results.already.length}\n` +
								`⚠️ ${tr("redeem_Invalid")}: ${results.invalid.length}\n` +
								`❌ ${tr("redeem_Failed")}: ${results.failed.length}`
						)
						.setThumbnail(
							"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
						)
				]
			});
		} else if (subcommand == "redeem") {
			const code = interaction.options.getString("code");
			const accountIndex = interaction.options.getString("account") || 0;
			const targetUser =
				interaction.options.getUser("user") || interaction.user;

			const hsr = await getUserHSRData(
				interaction,
				tr,
				targetUser.id,
				accountIndex
			);
			if (!hsr) return;

			const uid = await getUserUid(targetUser.id, accountIndex);
			let userRedeemedCodes =
				(await db.get(`${uid}.redeemedCodes`)) || [];

			try {
				const res = await hsr.redeem.claim(code);
				if (res.retcode == 0 || res.message == "OK") {
					if (!userRedeemedCodes.includes(code))
						userRedeemedCodes.push(code);
					userRedeemedCodes = Array.from(new Set(userRedeemedCodes));
					await db.set(`${uid}.redeemedCodes`, userRedeemedCodes);

					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(getRandomColor())
								.setTitle(tr("redeem_SuccessDesc"))
								.setThumbnail(
									"https://static.wikia.nocookie.net/houkai-star-rail/images/d/d9/Item_Stellar_Jade.png/revision/latest?cb=20230722074903"
								)
						],
						ephemeral: true
					});
				} else if (res.retcode == -2017) {
					if (!userRedeemedCodes.includes(code))
						userRedeemedCodes.push(code);
					userRedeemedCodes = Array.from(new Set(userRedeemedCodes));
					await db.set(`${uid}.redeemedCodes`, userRedeemedCodes);
					failedReply(interaction, res.message);
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
