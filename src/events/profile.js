import { client } from "../index.js";
import emoji from "../assets/emoji.js";
import {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	Events,
	AttachmentBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { i18nMixin, toI18nLang } from "../services/i18n.js";
import { player, getNews } from "../services/request.js";
import { charPage, mainPage, loadCharacters } from "../services/profile.js";
import { QuickDB } from "quick.db";
import axios from "axios";
import Queue from "queue";

const db = new QuickDB();
const drawQueue = new Queue({ autostart: true });

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isStringSelectMenu()) return;

	const tr = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	if (interaction.customId === "profile_characters") {
		await interaction.update({ fetchReply: true });

		const [uid, i, userId] = interaction.values[0].split("-");
		const playerData = await player(uid, interaction);

		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_imageLoading"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1126170338850504704/a_08824a3a9df7a4c9acfc3c7777be4034.gif"
					)
			],
			components: [],
			ephemeral: true
		});

		await handleDrawRequest(i, userId, playerData, interaction);

		async function handleDrawRequest(i, userId, playerData, interaction) {
			const drawTask = async () => {
				try {
					const characters =
						(await loadCharacters(playerData.player.uid)) ||
						playerData.characters;

					const imageBuffer =
						i == "main"
							? await mainPage(playerData, interaction)
							: await charPage(
									characters,
									playerData,
									i,
									interaction
							  );
					const image = new AttachmentBuilder(imageBuffer, {
						name: `${playerData.player.uid}.png`
					});

					i == "main"
						? replyOrfollowUp(interaction, {
								embeds: [],
								components: [
									new ActionRowBuilder().addComponents(
										new StringSelectMenuBuilder()
											.setPlaceholder(
												tr("profile_character")
											)
											.setCustomId("profile_characters")
											.setMinValues(1)
											.setMaxValues(1)
											.addOptions(
												characters.map(
													(character, i) => {
														return {
															emoji: emoji[
																character.element.id.toLowerCase()
															],
															label: `${character.name}`,
															value: `${playerData.player.uid}-${i}-${userId}`
														};
													}
												)
											)
									)
								],
								files: [image]
						  })
						: replyOrfollowUp(interaction, {
								embeds: [],
								components: [
									new ActionRowBuilder().addComponents(
										new StringSelectMenuBuilder()
											.setPlaceholder(
												tr("profile_character")
											)
											.setCustomId("profile_characters")
											.setMinValues(1)
											.setMaxValues(1)
											.addOptions(
												{
													emoji: emoji.avatarIcon,
													label: `${tr(
														"profile_main"
													)}`,
													value: `${playerData.player.uid}-main-${userId}`
												},
												...characters.map(
													(character, i) => {
														return {
															emoji: emoji[
																character.element.id.toLowerCase()
															],
															label: `${character.name}`,
															value: `${playerData.player.uid}-${i}-${userId}`
														};
													}
												)
											)
									)
								],
								files: [image]
						  });
				} catch (error) {
					replyOrfollowUp(interaction, {
						embeds: [
							new EmbedBuilder()
								.setConfig()
								.setTitle(
									`製圖失敗，請稍後再試！\n${tr(
										"err_code"
									)}${error}`
								)
								.setThumbnail(
									"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
								)
						]
					});
				}
			};

			drawQueue.push(drawTask);

			if (drawQueue.length != 1)
				replyOrfollowUp(interaction, {
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setTitle(
								`${tr("draw_wait", {
									z: drawQueue.length
								})}`
							)
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
							)
					]
				});
		}
	} else if (interaction.customId == "news_type") {
		await interaction.deferUpdate();
		const type = interaction.values[0];
		const newsData = await getNews(interaction.locale.toLowerCase(), type);

		return await interaction.message.edit({
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(`${tr("news_selpost")}`)
						.setCustomId("news_post")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							newsData.data.list.map((data, i) => {
								const date = new Date(
									data.post.created_at * 1000
								);
								return {
									label: `${
										data.post.subject.length < 100
											? data.post.subject
											: data.post.subject
													.slice(0, 97)
													.concat("...")
									}`,
									description: `${date.getUTCFullYear()} ${tr(
										"year"
									)} ${date.getUTCMonth() + 1} ${tr(
										"month"
									)} ${date.getUTCDate()} ${tr("day")}`,
									value: `${type}-${i}`
								};
							})
						)
				),
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(`${tr("news_seltype")}`)
						.setCustomId("news_type")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{
								label: `${tr("news_notice")}`,
								emoji: "🔔",
								value: "1"
							},
							{
								label: `${tr("news_events")}`,
								emoji: "🔥",
								value: "2"
							},
							{
								label: `${tr("news_info")}`,
								emoji: "🗞️",
								value: "3"
							}
						)
				)
			]
		});
	} else if (interaction.customId == "news_post") {
		await interaction.deferUpdate();
		const [type, index] = interaction.values[0].split("-");
		const newsData = await getNews(interaction.locale.toLowerCase(), type);
		const data = newsData.data.list[index];

		return await interaction.message.edit({
			embeds: [
				new EmbedBuilder()
					.setAuthor({
						iconURL: data.user.avatar_url ?? "",
						name: data.user.nickname ?? ""
					})
					.setTitle(`${data.post.subject ?? `${tr("none")}`}`)
					.setURL(
						`https://www.hoyolab.com/article/${data.post.post_id}`
					)
					.setDescription(
						`${
							data.post.content.length < 2000
								? data.post.content
								: data.post.content
										.slice(0, 1997)
										.concat("...") ?? `${tr("none")}`
						}`
					)
					.setImage(data.image_list[0].url ?? "")
			]
		});
	} else if (interaction.customId.startsWith("characters")) {
		await interaction.update({ fetchReply: true });
		const [id, i] = interaction.values[0].split("-");

		try {
			const hsr = new HonkaiStarRail({
				cookie: (await db.get(`${id}.account`))[0].cookie
					? (await db.get(`${id}.account`))[0].cookie
					: await db.get(`${id}.cookie`),
				lang: (await db?.has(`${interaction.user.id}.locale`))
					? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
						? LanguageEnum.TRADIIONAL_CHINESE
						: LanguageEnum.ENGLISH
					: interaction.locale == "zh-TW"
					  ? LanguageEnum.TRADIIONAL_CHINESE
					  : LanguageEnum.ENGLISH,
				uid: (await db.get(`${id}.account`))[0].uid
					? (await db.get(`${id}.account`))[0].uid
					: await db.get(`${id}.uid`)
			});

			const playerData = await player(
				(await db.get(`${id}.account`))[0].uid
					? (await db.get(`${id}.account`))[0].uid
					: await db.get(`${id}.uid`),
				interaction
			);
			const characters = await hsr.record.characters();
			const character = characters[i];
			const relicsValue =
				character.relics.length > 0
					? character.relics
							.map(
								relic =>
									`\`${relic.rarity}\`${emoji.yellowStar} ${
										relic.name
									} • ${tr("level")} ${relic.level}`
							)
							.join("\n")
					: "";

			const ornamentsValue =
				character.ornaments.length > 0
					? character.ornaments
							.map(
								relic =>
									`\`${relic.rarity}\`${emoji.yellowStar} ${
										relic.name
									} • ${tr("level")} ${relic.level}`
							)
							.join("\n")
					: "";

			replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig("#213555")
						.setTitle(
							`${character.name} ${emoji[character.element]}`
						)
						.setThumbnail(character.icon || "")
						.setAuthor({
							name:
								playerData.player.nickname +
								" - " +
								playerData.player.uid,
							iconURL:
								image_Header +
								"/" +
								playerData.player.avatar.icon
						})
						.addFields(
							{
								name: `${tr("level")} ${character.level}`,
								value: "\u200b",
								inline: true
							},
							{
								name: tr("eidolon", {
									z: character.rank
								}),
								value: "\u200b",
								inline: true
							},
							{
								name: `${tr("lightcone")}`,
								value: character.equip
									? `${emoji.dot}${character.equip.name}\n${
											emoji.line1
									  }${tr("lightconeLevel", {
											z: `\`${character.equip.rank}\``
									  })}\n${emoji.line2}${tr("level")} \`${
											character.equip.level
									  }\``
									: `\`${tr("none")}\``,
								inline: false
							},
							{
								name: tr("relics"),
								value: `${
									relicsValue && ornamentsValue
										? `${relicsValue}\n${ornamentsValue}`
										: relicsValue ||
										  ornamentsValue ||
										  `\`${tr("none")}\``
								}`,
								inline: false
							}
						)
				]
			});
		} catch (e) {
			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("cookie_failed")}`)
						.setDescription(
							`${tr("cookie_failedDesc")}\n\n${tr(
								"err_code"
							)}${e}`
						)
				],
				ephemeral: true
			});
		}
	} else if (interaction.customId.startsWith("leaderboard")) {
		await interaction.update({ fetchReply: true });
		const id = interaction.values[0];
		const leaderboardData = (await db.get(`LeaderBoard.${id}`)) ?? [];
		const firstPlace = leaderboardData.score[0];

		const locale = (await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en";

		const responses = await axios.get(
			`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
				locale == "tw" ? "cht" : "en"
			}/characters.json`
		);
		const localeJson = responses.data;

		const AllleaderboardData = (await db.get("LeaderBoard")) || [];

		const allCharacterOptions = Object.values(AllleaderboardData).map(
			character => {
				return {
					emoji: emoji[character.element.id.toLowerCase()],
					label: `${
						localeJson[character.id].name == "{NICKNAME}"
							? `${tr("mainCharacter")}`
							: localeJson[character.id].name
					}`,
					value: `${character.id}`
				};
			}
		);

		const chunkSize = 25;
		const startIndexes = Array.from(
			{ length: Math.ceil(allCharacterOptions.length / chunkSize) },
			(_, index) => index * chunkSize + 1
		);

		const characterOptionChunks = Array.from(
			{ length: startIndexes.length },
			(_, index) => {
				const start = startIndexes[index] - 1;
				const end = Math.min(
					start + chunkSize,
					allCharacterOptions.length
				);
				return allCharacterOptions.slice(start, end);
			}
		);

		const selectMenus = characterOptionChunks.map((optionsChunk, index) => {
			const startIndex = startIndexes[index];
			const endIndex = Math.min(
				startIndex + chunkSize - 1,
				allCharacterOptions.length
			);

			return new StringSelectMenuBuilder()
				.setPlaceholder(
					`${tr("leaderboard_character")} ${tr(
						"character_placeholder",
						{
							s: startIndex,
							e: endIndex
						}
					)}`
				)
				.setCustomId(`leaderboard-${index}`)
				.setMinValues(1)
				.setMaxValues(1)
				.addOptions(optionsChunk);
		});

		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setAuthor({
						iconURL: `${image_Header}/${leaderboardData.score[0].avatar}`,
						name: `${tr("leaderboard_title", {
							z: `${
								localeJson[leaderboardData.id].name ==
								"{NICKNAME}"
									? `${tr("mainCharacter")}`
									: localeJson[leaderboardData.id].name
							}`
						})}`
					})
					.setFooter({ text: `${tr("leaderboard_footer")}` })
					.setThumbnail(`${image_Header}/${leaderboardData.icon}`)
					.setTitle(
						`${emoji.crown} \`${firstPlace.nickname}\` ${
							firstPlace.uid
						} • ${tr("leaderboard_score", {
							z: `${firstPlace.score}`
						})}`
					)
					.addFields({
						name: `\u200b`,
						value: "\u200b",
						inline: false
					})
					.setDescription(
						leaderboardData.score.length > 1
							? leaderboardData.score
									.slice(1)
									.map((item, i) => {
										return `**${i + 2}.** \`${
											item.nickname
										}\` ${item.uid} • ${tr(
											"leaderboard_score",
											{
												z: `${item.score}`
											}
										)}`;
									})
									.join("\n")
							: tr("none")
					)
			],
			components: selectMenus.map(selectMenu => {
				return new ActionRowBuilder().addComponents(selectMenu);
			})
		});
	} else if (interaction.customId.startsWith("guide")) {
		await interaction.update({ fetchReply: true });
		const id = interaction.values[0];

		const locale = (await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en";

		const responses = await axios.get(
			`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
				locale == "tw" ? "cht" : "en"
			}/characters.json`
		);
		const localeJson = responses.data;

		const leaderboardData = (await db.get("LeaderBoard")) || [];

		const allCharacterOptions = Object.values(leaderboardData).map(
			character => {
				return {
					emoji: emoji[character.element.id.toLowerCase()],
					label: `${
						localeJson[character.id].name == "{NICKNAME}"
							? `${tr("mainCharacter")}`
							: localeJson[character.id].name
					}`,
					value: `${character.id}`
				};
			}
		);

		const chunkSize = 25;
		const startIndexes = Array.from(
			{ length: Math.ceil(allCharacterOptions.length / chunkSize) },
			(_, index) => index * chunkSize + 1
		);

		const characterOptionChunks = Array.from(
			{ length: startIndexes.length },
			(_, index) => {
				const start = startIndexes[index] - 1;
				const end = Math.min(
					start + chunkSize,
					allCharacterOptions.length
				);
				return allCharacterOptions.slice(start, end);
			}
		);

		const selectMenus = characterOptionChunks.map((optionsChunk, index) => {
			const startIndex = startIndexes[index];
			const endIndex = Math.min(
				startIndex + chunkSize - 1,
				allCharacterOptions.length
			);

			return new StringSelectMenuBuilder()
				.setPlaceholder(
					`${tr("guide_character")} ${tr("character_placeholder", {
						s: startIndex,
						e: endIndex
					})}`
				)
				.setCustomId(`guide-${index}`)
				.setMinValues(1)
				.setMaxValues(1)
				.addOptions(optionsChunk);
		});

		try {
			await axios.get(
				`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`
			);
		} catch (e) {
			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setTitle(
							`${tr("guide_noImage", {
								z: localeJson[id].name
							})}`
						)
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				ephemeral: true
			});
		}

		replyOrfollowUp(interaction, {
			files: [
				new AttachmentBuilder(
					`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`
				)
			],
			components: selectMenus.map(selectMenu => {
				return new ActionRowBuilder().addComponents(selectMenu);
			})
		});
	}
});
