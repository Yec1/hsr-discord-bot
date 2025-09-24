import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	TextInputBuilder,
	TextInputStyle,
	ModalBuilder,
	ButtonStyle,
	AttachmentBuilder,
	ComponentType,
	MessageFlags
} from "discord.js";
import { getRarity, getPath, getElement } from "@/utilities/hsr/parseJSON.js";
import { warp, createImage } from "@/utilities/hsr/warp.js";
import ms from "ms";
import { CommandCooldown } from "discord-command-cooldown";
import { getRandomColor } from "@/utilities/index.js";
import type { TranslationFunction } from "@/types/index.js";
import { database } from "@/index.js";

const warpSimCD = new CommandCooldown("warpSimCD", ms("5s"));

interface RarityToUrl {
	[key: number]: {
		standard: {
			url: string;
			time: number;
		};
		event: {
			url: string;
			time: number;
		};
	};
}

const rarityToUrl: RarityToUrl = {
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

interface WarpResult {
	id: string;
	name: string;
	type: string;
	rarity: number;
	path: string;
	element: string;
}

interface SimDB {
	pityFive?: number;
	soft?: number;
	max?: number;
	chance?: number;
	rateup?: number;
	guaranteeFive?: string;
}

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
						.setRequired(true)
						.setAutocomplete(true)
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
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	): Promise<void> {
		const cmd = interaction.options.getSubcommand();

		if (cmd == "simulator-setting") {
			const guarantee =
				interaction.options.getString("guarantee-setting");
			let simdb: SimDB | null =
				(await database.get(`${interaction.user.id}.sim`)) || null;

			if (!guarantee) {
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("simulator-set")
						.setTitle(tr("warp_SimSetTitle"))
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_pityFive")
									.setLabel(tr("Current"))
									.setValue(`${simdb?.pityFive || "0"}`)
									.setPlaceholder("0")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							) as any,
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_soft")
									.setLabel(tr("Soft"))
									.setValue(`${simdb?.soft || "75"}`)
									.setPlaceholder("75")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_max")
									.setLabel(tr("Max"))
									.setValue(`${simdb?.max || "90"}`)
									.setPlaceholder("90")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(3)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_chance")
									.setLabel(tr("Chance"))
									.setValue(`${simdb?.chance || "0.006"}`)
									.setPlaceholder("0.006")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(5)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("simset_rateup")
									.setLabel(tr("Rateup"))
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

			await database.set(
				`${interaction.user.id}.sim.guaranteeFive`,
				guarantee
			);
			simdb = (await database.get(`${interaction.user.id}.sim`)) || null;

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor("#F6F1F1")
						.setTitle(tr("warp_SimSetSus"))
						.setThumbnail(interaction.user.displayAvatarURL())
						.addFields(
							{
								name: tr("Current"),
								value: `${simdb?.pityFive || "0"}`,
								inline: true
							},
							{
								name: tr("Soft"),
								value: `${simdb?.soft || "75"}`,
								inline: true
							},
							{
								name: tr("Max"),
								value: `${simdb?.max || "90"}`,
								inline: true
							},
							{
								name: tr("Chance"),
								value: `${(simdb?.chance || 0.006) * 100}%`,
								inline: true
							},
							{
								name: tr("Rateup"),
								value: `${(simdb?.rateup || 0.5) * 100}%`,
								inline: true
							},
							{
								name: tr("Guarantee"),
								value:
									simdb?.guaranteeFive == "true"
										? tr("True")
										: tr("False"),
								inline: true
							}
						)
				],
				flags: MessageFlags.Ephemeral
			});
		}

		if (cmd == "simulator") {
			const userCD = await warpSimCD.getUser(interaction.user.id);
			if (userCD)
				await interaction.reply({
					embeds: [
						new EmbedBuilder().setColor("#E76161").setTitle(
							tr("waitFormat1", {
								time: (userCD.msLeft / 1000).toFixed(2)
							})
						)
					],
					flags: MessageFlags.Ephemeral
				});

			await warpSimCD.addUser(interaction.user.id);
			await interaction.deferReply();
			const version = interaction.options.getString("version");
			const type = interaction.options.getString("type");
			let timeStr = interaction.options.getString("time");
			let video = "";
			const time = timeStr == "one" ? 1 : 10;

			if (!(await database.has(`${interaction.user.id}.sim`)))
				await database.set(`${interaction.user.id}.sim`, {
					soft: 75,
					max: 90,
					chance: 0.006,
					rateup: 0.5,
					pityFive: 0,
					pityFour: 0,
					guaranteeFive: "false",
					guaranteeFour: "false"
				});

			let warpResults: WarpResult[] = [];

			for (let i = 0; i < time; i++) {
				const res = await warp(version || "", type || "", interaction);
				warpResults.push({
					id: res.toLowerCase().replace(/[- .]/g, ""),
					name: res,
					type: type || "",
					rarity: getRarity(res) || 0,
					path: getPath(res) || "",
					element: getElement(res)
				});
			}

			const imageBuffer = await createImage(
				interaction.user.id,
				warpResults
			);
			const image = new AttachmentBuilder(imageBuffer, {
				name: "result.webp"
			});

			let videoTime = 12000;

			let maxRarity = 0;
			for (const item of warpResults)
				if (item.rarity > maxRarity) maxRarity = item.rarity;

			const ImageType = type === "standard" ? "standard" : "event";
			video = rarityToUrl[maxRarity]?.[ImageType]?.url || "";
			videoTime = rarityToUrl[maxRarity]?.[ImageType]?.time || 12000;

			const resMessage = await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setFooter({ text: tr("warp_SimFooter") })
						.setImage(video)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId("warp_skip")
							.setLabel(tr("warp_Skip"))
							.setStyle(ButtonStyle.Secondary)
					) as any
				]
			});

			const data = await database.get(`${interaction.user.id}.sim`);
			const filter = (i: any) =>
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
					collector.stop();
				}
			});

			collector.on("end", async () => {
				interaction.editReply({
					embeds: [],
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setDisabled(true)
								.setCustomId("sim_version")
								.setLabel(`${version}`)
								.setStyle(ButtonStyle.Success),
							new ButtonBuilder()
								.setDisabled(true)
								.setCustomId("sim_pityFive")
								.setLabel(
									tr("warp_Pity", {
										z: data.pityFive
									})
								)
								.setStyle(ButtonStyle.Secondary)
						) as any
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
							.setColor(getRandomColor() as any)
							.setImage(
								"https://media.discordapp.net/attachments/1057244827688910850/1120365039803707412/warp.gif"
							)
							.setTitle(tr("warp_HowToGet"))
							.setDescription(
								tr("warp_HowToGetDesc", {
									z: `\`\`\`powershell\n[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; Invoke-Expression (New-Object Net.WebClient).DownloadString("https://gist.githubusercontent.com/Star-Rail-Station/2512df54c4f35d399cc9abbde665e8f0/raw/get_warp_link_os.ps1")\n\`\`\``
								})
							)
					]
				});

			if (type == "query")
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("warp_query")
						.setTitle(tr("warp_Title"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("warpUrl")
									.setLabel(tr("warp_Input"))
									.setPlaceholder("URL")
									.setStyle(TextInputStyle.Paragraph)
									.setRequired(true)
									.setMinLength(50)
									.setMaxLength(4000)
							) as any
						)
				);
		}
	}
};
