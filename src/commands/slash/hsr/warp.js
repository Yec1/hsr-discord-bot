import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType
} from "discord.js";
import { getRarity, getPath, getElement } from "../../../services/parseJSON.js";
import { warp, createImage } from "../../../services/warp.js";
import ms from "ms";
import { CommandCooldown } from "discord-command-cooldown";
const warpSimCD = new CommandCooldown("warpSimCD", ms("10s"));

export default {
	data: new SlashCommandBuilder()
		.setName("warp")
		.setDescription("...")
		.setNameLocalizations({
			"zh-TW": "躍遷"
		})
		.setDescriptionLocalizations({
			"zh-TW": "..."
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("simulator")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "模擬"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.addStringOption(option =>
					option
						.setName("version")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "版本"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(true)
						.addChoices(
							{
								name: "1.0.1 - Seele",
								name_localizations: {
									"zh-TW": "1.0.1 - 希兒"
								},
								value: "1.0.1"
							},
							{
								name: "1.0.2 - Jing-Yuan",
								name_localizations: {
									"zh-TW": "1.0.2 - 景元"
								},
								value: "1.0.2"
							},
							{
								name: "1.1.1 - Silver-Wolf",
								name_localizations: {
									"zh-TW": "1.1.1 - 銀狼"
								},
								value: "1.1.1"
							},
							{
								name: "1.1.2 - LuoCha",
								name_localizations: {
									"zh-TW": "1.1.2 - 羅剎"
								},
								value: "1.1.2"
							},
							{
								name: "1.2.1 - Blade",
								name_localizations: {
									"zh-TW": "1.2.1 - 刃"
								},
								value: "1.2.1"
							},
							{
								name: "1.2.2 - Kafka",
								name_localizations: {
									"zh-TW": "1.2.2 - 卡芙卡"
								},
								value: "1.2.2"
							},
							{
								name: "1.3.1 - Imbibitor Lunae",
								name_localizations: {
									"zh-TW": "1.3.1 - 丹恆・飲月"
								},
								value: "1.3.1"
							},
							{
								name: "1.3.2 - Fu Xuan",
								name_localizations: {
									"zh-TW": "1.3.2 - 符玄"
								},
								value: "1.3.2"
							},
							{
								name: "1.4.1 - Jing Liu",
								name_localizations: {
									"zh-TW": "1.4.1 - 鏡流"
								},
								value: "1.4.1"
							},
							{
								name: "1.4.2 - Topaz & Numdy",
								name_localizations: {
									"zh-TW": "1.4.2 - 托帕&賬賬"
								},
								value: "1.4.2"
							},
							{
								name: "1.5.1 - HuoHuo",
								name_localizations: {
									"zh-TW": "1.5.1 - 霍霍"
								},
								value: "1.5.1"
							},
							{
								name: "1.5.2 - Argenti",
								name_localizations: {
									"zh-TW": "1.5.2 - 銀枝"
								},
								value: "1.5.2"
							},
							{
								name: "1.6.1 - Ruan Mei",
								name_localizations: {
									"zh-TW": "1.6.1 - 阮梅"
								},
								value: "1.6.1"
							},
							{
								name: "1.6.2 - Dr. Ratio",
								name_localizations: {
									"zh-TW": "1.6.2 - 真理醫生"
								},
								value: "1.6.2"
							},
							{
								name: "2.0.1 - Black Swan",
								name_localizations: {
									"zh-TW": "2.0.1 - 黑天鵝"
								},
								value: "2.0.1"
							},
							{
								name: "2.0.2 - Sparkle",
								name_localizations: {
									"zh-TW": "2.0.2 - 花火"
								},
								value: "2.0.2"
							},
							{
								name: "2.1.1 - Acheron",
								name_localizations: {
									"zh-TW": "2.1.1 - 黃泉"
								},
								value: "2.1.1"
							},
							{
								name: "2.1.2 - Aventurine",
								name_localizations: {
									"zh-TW": "2.1.2 - 砂金"
								},
								value: "2.1.2"
							},
							{
								name: "2.2.1 - Robin",
								name_localizations: {
									"zh-TW": "2.2.1 - 知更鳥"
								},
								value: "2.2.1"
							},
							{
								name: "2.2.2 - Boothill",
								name_localizations: {
									"zh-TW": "2.2.2 - 波提歐"
								},
								value: "2.2.2"
							}
						)
				)
				.addStringOption(option =>
					option
						.setName("type")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "池"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(true)
						.addChoices(
							{
								name: "character",
								name_localizations: {
									"zh-TW": "限定角色池"
								},
								value: "char"
							},
							{
								name: "lightcone",
								name_localizations: {
									"zh-TW": "限定光錐池"
								},
								value: "weap"
							},
							{
								name: "standard",
								name_localizations: {
									"zh-TW": "常駐池"
								},
								value: "standard"
							}
						)
				)
				.addStringOption(option =>
					option
						.setName("time")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "次數"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(true)
						.addChoices(
							{
								name: "warp1",
								name_localizations: {
									"zh-TW": "單抽"
								},
								value: "one"
							},
							{
								name: "warp10",
								name_localizations: {
									"zh-TW": "十抽"
								},
								value: "ten"
							}
						)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("simulator-setting")
				.setDescription("Set settings for simulated transitions")
				.setNameLocalizations({
					"zh-TW": "模擬設定"
				})
				.setDescriptionLocalizations({
					"zh-TW": "設定模擬躍遷的設定"
				})
				.addStringOption(option =>
					option
						.setName("guarantee-setting")
						.setDescription(
							"Set next five-star is a small guarantee or a big guarantee"
						)
						.setNameLocalizations({
							"zh-TW": "保底設定"
						})
						.setDescriptionLocalizations({
							"zh-TW": "設定下一個五星是小保底還是大保底"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "Small Guarantee",
								name_localizations: {
									"zh-TW": "小保底"
								},
								value: "false"
							},
							{
								name: "Big Guarantee",
								name_localizations: {
									"zh-TW": "大保底"
								},
								value: "true"
							}
						)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("log")
				.setDescription(
					"Currently only supports the PC side, if you find other ways you can use it"
				)
				.setNameLocalizations({
					"zh-TW": "紀錄"
				})
				.setDescriptionLocalizations({
					"zh-TW":
						"目前僅支持電腦端，若您有發現可以的其他方式也可以使用"
				})
				.addStringOption(option =>
					option
						.setName("options")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "選項"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(true)
						.addChoices(
							{
								name: "How to get url",
								name_localizations: {
									"zh-TW": "如何取得躍遷紀錄連結"
								},
								value: "how"
							},
							{
								name: "Query warp records",
								name_localizations: {
									"zh-TW": "查詢躍遷紀錄"
								},
								value: "query"
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
	async execute(client, interaction, args, tr, db, emoji) {
		const cmd = interaction.options.getSubcommand();

		if (cmd == "simulator-setting") {
			const guarantee =
				interaction.options.getString("guarantee-setting");
			let simdb = await db.get(`${interaction.user.id}.sim`);

			if (!guarantee) {
				return await interaction.showModal(
					new ModalBuilder()
						.setCustomId("simulator-set")
						.setTitle(tr("warp_simSetTitle"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_pityFive")
									.setLabel(tr("current"))
									.setValue(`${simdb?.pityFive || "0"}`)
									.setPlaceholder("0")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_soft")
									.setLabel(tr("soft"))
									.setValue(`${simdb?.soft || "75"}`)
									.setPlaceholder("75")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_max")
									.setLabel(tr("max"))
									.setValue(`${simdb?.max || "90"}`)
									.setPlaceholder("90")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_chance")
									.setLabel(tr("chance"))
									.setValue(`${simdb?.chance || "0.006"}`)
									.setPlaceholder("0.006")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(5)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_rateup")
									.setLabel(tr("rateup"))
									.setValue(`${simdb?.rateup || "0.5"}`)
									.setPlaceholder("0.5")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(5)
							)
						)
				);
			}

			await db.set(`${interaction.user.id}.sim.guaranteeFive`, guarantee);
			simdb = await db.get(`${interaction.user.id}.sim`);

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("warp_simSetSus"))
						.setThumbnail(interaction.user.displayAvatarURL())
						.addFields(
							{
								name: tr("current"),
								value: `${simdb?.pityFive || "0"}`,
								inline: true
							},
							{
								name: tr("soft"),
								value: `${simdb?.soft || "75"}`,
								inline: true
							},
							{
								name: tr("max"),
								value: `${simdb?.max || "90"}`,
								inline: true
							},
							{
								name: tr("chance"),
								value: `${simdb?.chance * 100 || "0.6"}%`,
								inline: true
							},
							{
								name: tr("rateup"),
								value: `${simdb?.rateup * 100 || "50"}%`,
								inline: true
							},
							{
								name: tr("guarantee"),
								value:
									simdb?.guaranteeFive == "true"
										? tr("true")
										: tr("false"),
								inline: true
							}
						)
				],
				ephemeral: true
			});
		}

		if (cmd == "simulator") {
			const userCD = await warpSimCD.getUser(interaction.user.id);
			if (userCD)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder().setConfig("#E76161").setTitle(
							tr("wait", {
								time: (userCD.msLeft / 1000).toFixed(2)
							})
						)
					],
					ephemeral: true
				});

			await warpSimCD.addUser(interaction.user.id);
			await interaction.deferReply();
			const version = interaction.options.getString("version");
			const type = interaction.options.getString("type");
			let time = interaction.options.getString("time");
			let video = "";
			time = time == "one" ? 1 : 10;

			if (await db.has(`${interaction.user.id}.simulator`))
				await db.delete(`${interaction.user.id}.simulator`);

			if (!(await db.has(`${interaction.user.id}.sim`)))
				await db.set(`${interaction.user.id}.sim`, {
					soft: 75,
					max: 90,
					chance: 0.006,
					rateup: 0.5,
					pityFive: 0,
					pityFour: 0,
					guaranteeFive: "false",
					guaranteeFour: "false"
				});

			let warpResults = [];
			for (let i = 0; i < time; i++) {
				const res = await warp(version, type, interaction);
				warpResults.push({
					id: res.toLowerCase().replace(/[- .]/g, ""),
					name: res,
					rarity: getRarity(res),
					path: getPath(res),
					element: getElement(res)
				});
			}

			const imageBuffer = await createImage(
				interaction.user.id,
				warpResults
			);
			const image = new AttachmentBuilder(imageBuffer, {
				name: "result.png"
			});

			let videoTime = 12000;
			const rarityToUrl = {
				3: {
					standard: {
						url: "https://media.discordapp.net/attachments/1057244827688910850/1121718032440496178/normal-three.gif",
						time: 12000
					},
					event: {
						url: "https://cdn.discordapp.com/attachments/1057244827688910850/1121719455211323432/event-three.gif",
						time: 12000
					}
				},
				4: {
					standard: {
						url: "https://media.discordapp.net/attachments/1057244827688910850/1121717847907909683/normal-four.gif",
						time: 12000
					},
					event: {
						url: "https://cdn.discordapp.com/attachments/1057244827688910850/1121124317028163614/event-four_1.gif",
						time: 12000
					}
				},
				5: {
					standard: {
						url: "https://media.discordapp.net/attachments/1057244827688910850/1121716982807547974/normal-five.gif",
						time: 12500
					},
					event: {
						url: "https://media.discordapp.net/attachments/1057244827688910850/1121124667642630244/event-five_1.gif",
						time: 12500
					}
				}
			};

			let maxRarity = 0;
			for (const item of warpResults)
				if (item.rarity > maxRarity) maxRarity = item.rarity;

			const ImageType = type === "standard" ? "standard" : "event";
			video = rarityToUrl[maxRarity][ImageType].url;
			videoTime = rarityToUrl[maxRarity][ImageType].time;

			const resMessage = await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig(null, tr("warp_SimFooter"))
						.setImage(video)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId("warp_skip")
							.setLabel(`${tr("warp_skip")}`)
							.setStyle(ButtonStyle.Secondary)
					)
				]
			});

			// const name = warpResults
			//   .map(({ name, rarity, path, element }) => {
			//     return `${rarity}${
			//       rarity >= 4 ? emoji.yellowStar : emoji.whiteStar
			//     } ${emoji[path]} ${element ? emoji[element] + " " : ""}${
			//       trans[name][interaction.locale == "zh-TW" ? "zh" : "en"]
			//     }`;
			//   })
			//   .join("\n");

			const data = await db.get(`${interaction.user.id}.sim`);

			// const average = data.OwnFive
			// 	? parseFloat((data.total / data.OwnFive).toFixed(2))
			// 	: 0;
			// const sentenceMap = {
			// 	0: {
			// 		reply: tr("warp_0"),
			// 		btnType: ButtonStyle.Success
			// 	},
			// 	30: {
			// 		reply: tr("warp_30"),
			// 		btnType: ButtonStyle.Success
			// 	},
			// 	50: {
			// 		reply: tr("warp_50"),
			// 		btnType: ButtonStyle.Primary
			// 	},
			// 	60: {
			// 		reply: tr("warp_60"),
			// 		btnType: ButtonStyle.Secondary
			// 	},
			// 	80: {
			// 		reply: tr("warp_80"),
			// 		btnType: ButtonStyle.Danger
			// 	}
			// };

			// let sentence = "\u200b";
			// let btnType = ButtonStyle.Secondary;
			// const keys = Object.keys(sentenceMap)
			// 	.map(Number)
			// 	.sort((a, b) => b - a);
			// for (const key of keys) {
			// 	if (average > key) {
			// 		sentence = sentenceMap[key].reply;
			// 		btnType = sentenceMap[key].btnType;
			// 		break;
			// 	}
			// }

			const filter = i =>
				i.customId === "warp_skip" && i.user.id === interaction.user.id;

			const collector = resMessage.createMessageComponentCollector({
				filter,
				time: videoTime,
				componentType: ComponentType.Button
			});

			collector.on("collect", async interaction => {
				if (!interaction.isButton()) return;
				if (interaction.customId == "warp_skip") {
					await interaction.deferUpdate().catch(() => {});
					// if (
					// 	(await db.has(`${interaction.user.id}.vote`)) &&
					// 	new Date().getUTCDate() ==
					// 		(await db.get(`${interaction.user.id}.vote`))
					// )
					collector.stop();
					// else
					// 	return interaction.followUp({
					// 		embeds: [
					// 			new EmbedBuilder()
					// 				.setConfig("#E76161")
					// 				.setThumbnail(
					// 					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					// 				)
					// 				.setTitle(tr("vote_Msg"))
					// 		],
					// 		components: [
					// 			new ActionRowBuilder().addComponents(
					// 				new ButtonBuilder()
					// 					.setEmoji("🎈")
					// 					.setURL(
					// 						"https://discordservers.tw/bots/895191125512581171"
					// 					)
					// 					.setLabel(tr("vote"))
					// 					.setStyle(ButtonStyle.Link)
					// 			)
					// 		],
					// 		ephemeral: true,
					// 		fetchReply: true
					// 	});
				}
			});

			collector.on("end", async () => {
				await interaction.editReply({
					embeds: [],
					// embeds: [
					//   new EmbedBuilder()
					//	   .setConfig()
					//     .setAuthor({
					//       name: interaction.user.username,
					//       iconURL: interaction.user.displayAvatarURL({
					//         size: 4096,
					//         dynamic: true,
					//       }),
					//     })
					//     .setTitle(
					//       `${emoji.DrawcardIcon} ${getTitle(
					//         LATESTVERS,
					//         type,
					//         interaction.locale == "zh-TW" ? "zh" : "en"
					//       )}`
					//     )
					//     .setDescription(name)
					//     .addFields(
					//       {
					//         name: ``,
					//         value: "\u200b",
					//         inline: true,
					//       },
					//       {
					//         name: tr("warp_pity", {
					//           z: data.pityFive,
					//         }),
					//         value: "\u200b",
					//         inline: true,
					//       },
					//       {
					//         name: tr("warp_pityFour", {
					//           z: data.pityFour,
					//         }),
					//         value: "\u200b",
					//         inline: true,
					//       },
					//       {
					//         name:
					//           average == 0
					//             ? tr("warp_nonAverage")
					//             : tr("warp_average", {
					//                 z: average,
					//               }),
					//         value: sentence,
					//         inline: true,
					//       }
					//     ),
					// ],
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setDisabled(true)
								.setCustomId("sim_version")
								.setLabel(`${version}`)
								.setStyle(ButtonStyle.Success),
							// new ButtonBuilder()
							// 	.setDisabled(true)
							// 	.setCustomId("sim_total")
							// 	.setEmoji(emoji.s900001)
							// 	.setLabel(
							// 		`${data.total * 160} • ${tr("total")} ${
							// 			data.total
							// 		} ${tr("warp")}`
							// 	)
							// 	.setStyle(ButtonStyle.Secondary),
							new ButtonBuilder()
								.setDisabled(true)
								.setCustomId("sim_pityFive")
								.setLabel(
									tr("warp_pity", {
										z: data.pityFive
									})
								)
								.setStyle(ButtonStyle.Secondary)
							// 	new ButtonBuilder()
							// 		.setDisabled(true)
							// 		.setCustomId("sim_average")
							// 		.setLabel(
							// 			average == 0
							// 				? tr("warp_nonAverage")
							// 				: tr("warp_average", {
							// 						z: average
							// 				  })
							// 		)
							// 		.setStyle(ButtonStyle.Secondary),
							// 	new ButtonBuilder()
							// 		.setDisabled(true)
							// 		.setCustomId("sim_sentence")
							// 		.setLabel(sentence)
							// 		.setStyle(btnType)
						)
					],
					files: [image]
				});
			});
		}

		if (cmd == "log") {
			const type = interaction.options.getString("options");
			if (type == "how")
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setImage(
								"https://media.discordapp.net/attachments/1057244827688910850/1120365039803707412/warp.gif"
							)
							.setTitle(tr("warp_how"))
							.setDescription(
								tr("warp_howDesc", {
									z: `\`\`\`powershell\n[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; Invoke-Expression (New-Object Net.WebClient).DownloadString("https://gist.githubusercontent.com/Star-Rail-Station/2512df54c4f35d399cc9abbde665e8f0/raw/get_warp_link_os.ps1")\n\`\`\``
								})
							)
					],
					ephemeral: true
				});

			if (type == "query")
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("warp_query")
						.setTitle(tr("warp_title"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("warpUrl")
									.setLabel(tr("warp_input"))
									.setPlaceholder("URL")
									.setStyle(TextInputStyle.Paragraph)
									.setRequired(true)
									.setMinLength(50)
									.setMaxLength(4000)
							)
						)
				);
		}
	}
};
