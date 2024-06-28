import { client } from "../index.js";
import {
	Events,
	ActionRowBuilder,
	AttachmentBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";
import axios from "axios";
import emoji from "../assets/emoji.js";
import { drawFloorImage } from "../utilities/hsr/forgottenhall.js";
import { drawMainImage, drawCharacterImage } from "../utilities/hsr/profile.js";
import {
	getRandomColor,
	drawInQueueReply,
	requestPlayerData,
	getUserHSRData,
	getUserLang,
	getNewsList,
	getPostFull,
	parsePostContent
} from "../utilities/utilities.js";
import { getSelectMenu } from "../utilities/hsr/selectmenu.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";
import Queue from "queue";

const db = client.db;
const drawQueue = new Queue({ autostart: true });
const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isStringSelectMenu()) return;

	const { locale, customId, values } = interaction;
	const userLocale = await getUserLang(interaction.user.id);
	const tr = i18nMixin(userLocale || toI18nLang(locale) || "en");

	if (!customId.startsWith("account"))
		await interaction.update({ fetchReply: true }).catch(() => {});
	if (customId.startsWith("guide")) handleGuide(interaction, tr, values[0]);
	if (customId.startsWith("news")) handleNews(interaction, tr, values[0]);
	if (customId.startsWith("leaderboard"))
		handleLeaderboard(interaction, tr, values[0]);
	if (customId.startsWith("account"))
		handleAccountAction(interaction, tr, customId, values[0]);
	if (customId == "forgottenHall_Floor")
		handleForgottenHall(interaction, tr, values[0]);
	if (customId == "profile_SelectCharacter")
		handleSelectCharacter(interaction, tr, values[0]);
});

async function handleNews(interaction, tr, value) {
	if (interaction.customId == "news_type") {
		const type = value;
		const newsData = await getNewsList(
			interaction.locale.toLowerCase(),
			type
		);

		return interaction.editReply({
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("news_SelectPost"))
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
									description:
										date.getUTCFullYear() +
										tr("Year") +
										(date.getUTCMonth() + 1) +
										tr("Month") +
										date.getUTCDate() +
										tr("Day"),
									value: `${data.post.post_id}`
								};
							})
						)
				),
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("news_SelectType"))
						.setCustomId("news_type")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{
								label: tr("news_Notice"),
								emoji: "🔔",
								value: "1"
							},
							{
								label: tr("news_Events"),
								emoji: "🔥",
								value: "2"
							},
							{
								label: tr("news_Info"),
								emoji: "🗞️",
								value: "3"
							}
						)
				)
			],
			fetchReply: true
		});
	} else if (interaction.customId == "news_post") {
		const postId = value;
		const postData = await getPostFull(
			interaction.locale.toLowerCase(),
			postId
		);
		const { post, user, image_list, cover_list } = postData.post;
		const content = await parsePostContent(post.content);
		const date = new Date(post.created_at * 1000);

		return interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(getRandomColor())
					.setAuthor({
						iconURL: user.avatar_url ?? "",
						name: user.nickname ?? "",
						url: `https://www.hoyolab.com/accountCenter?id=${user.uid}`
					})
					.setTitle(post.subject ?? tr("None"))
					.setURL(`https://www.hoyolab.com/article/${post.post_id}`)
					.setDescription(
						content.length < 4096
							? content
							: content.slice(0, 4096 - 3).concat("...") ??
									tr("None")
					)
					.setFooter({
						text:
							date.getUTCFullYear() +
							tr("Year") +
							(date.getUTCMonth() + 1) +
							tr("Month") +
							date.getUTCDate() +
							tr("Day")
					})
					.setImage(image_list[0]?.url ?? cover_list[0]?.url)
			],
			fetchReply: true
		});
	}
}

async function handleGuide(interaction, tr, value) {
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

	const id = value;
	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";

	const responses = await axios.get(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
			locale == "tw" ? "cht" : "en"
		}/characters.json`
	);
	const localeJson = responses.data;
	const selectMenus = await getSelectMenu(interaction, tr, "guide");
	try {
		await axios.get(
			`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`
		);
	} catch (e) {
		return interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						`${tr("guide_NonImage", {
							z: localeJson[id].name
						})}`
					)
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
			],
			ephemeral: true
		});
	}

	const image = new AttachmentBuilder(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`,
		{
			name: `${id}.png`
		}
	);

	interaction.editReply({
		embeds: [new EmbedBuilder().setImage(`attachment://${image.name}`)],
		files: [image],
		components: selectMenus.map(selectMenu => {
			return new ActionRowBuilder().addComponents(selectMenu);
		})
	});
}

async function handleLeaderboard(interaction, tr, value) {
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

	const id = value;
	const leaderboardData = (await db.get(`LeaderBoard.${id}`)) ?? [];
	const firstPlace = leaderboardData.score[0];

	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";

	const responses = await axios.get(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
			locale == "tw" ? "cht" : "en"
		}/characters.json`
	);

	const localeJson = responses.data;
	const selectMenus = await getSelectMenu(interaction, tr, "leaderboard");
	const embedTitle = `${emoji.crown} \`${firstPlace.nickname}\` ${
		firstPlace.uid
	} • ${tr("leaderboard_Score", {
		z: `${firstPlace.score}`
	})}`;
	const embedDescription =
		leaderboardData.score.length > 1
			? leaderboardData.score
					.slice(1)
					.map((item, i) => {
						return `**${i + 2}.** \`${
							item.nickname
						}\` ${item.uid} • ${tr("leaderboard_Score", {
							z: `${item.score}`
						})}`;
					})
					.join("\n")
			: "`" + tr("None") + "`";

	interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor(leaderboardData.element.color)
				.setAuthor({
					iconURL: `${image_Header}/${leaderboardData.score[0].avatar}`,
					name: `${tr("leaderboard_Title", {
						z: `${
							localeJson[leaderboardData.id].name == "{NICKNAME}"
								? `${tr("MainCharacter")}`
								: localeJson[leaderboardData.id].name
						}`
					})}`
				})
				.setThumbnail(`${image_Header}/${leaderboardData.icon}`)
				.setTitle(embedTitle)
				.addFields({
					name: `\u200b`,
					value: "\u200b",
					inline: false
				})
				.setDescription(embedDescription)
		],
		components: selectMenus.map(selectMenu => {
			return new ActionRowBuilder().addComponents(selectMenu);
		})
	});
}

async function handleAccountAction(interaction, tr, customId, value) {
	const account = await db.get(`${interaction.user.id}.account`);
	if (!account)
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(`${tr("account_nonAcc")}`)
			],
			ephemeral: true
		});

	if (customId == "account_EditAccountSelect") {
		await interaction.update({ fetchReply: true }).catch(() => {});
		const accountIndex = value;
		interaction.editReply({
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("account_selectEdit"))
						.setCustomId("account_EditAccountSelectType")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{
								label: "UID",
								value: `uid-${accountIndex}`
							},
							{
								label: "Cookie",
								value: `cookie-${accountIndex}`
							}
						)
				)
			],
			fetchReply: true,
			ephemeral: true
		});
		return;
	} else if (customId == "account_EditAccountSelectType") {
		const [type, accountIndex] = value.split("-");
		const accountData = account[accountIndex];

		if (type == "uid") {
			await interaction.showModal(
				new ModalBuilder()
					.setCustomId(`accountEdit-${accountIndex}`)
					.setTitle(tr("account_SetUserID"))
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("uid")
								.setLabel(tr("account_SetUserIDDesc"))
								.setValue(accountData.uid || "")
								.setPlaceholder("e.g. 809279679")
								.setStyle(TextInputStyle.Short)
								.setRequired(true)
								.setMinLength(9)
								.setMaxLength(10)
						)
					)
			);
		} else if (type == "cookie") {
			await interaction.showModal(
				new ModalBuilder()
					.setCustomId(`cookie_set-${accountIndex}`)
					.setTitle(tr("account_SetUserCookie"))
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("ltoken")
								.setLabel("ltoken_2")
								.setPlaceholder("v2_...")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(10)
								.setMaxLength(1000)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("ltuid")
								.setLabel("ltuid_v2")
								.setPlaceholder("30...")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(1)
								.setMaxLength(30)
						)
					)
			);
		}
	} else if (interaction.customId == "account_DeleteAccountSelect") {
		await interaction.update({ fetchReply: true }).catch(() => {});
		const accountIndex = value;
		const accounts = (await db.get(`${interaction.user.id}.account`)) ?? "";
		const uid = accounts[accountIndex].uid;

		if (accounts.length <= 1)
			await db.delete(`${interaction.user.id}.account`);
		else {
			accounts.splice(accountIndex, 1);
			await db.set(`${interaction.user.id}.account`, accounts);
		}

		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(`${tr("account_DeletedSuccess")} \`${uid}\``)
			],
			components: [],
			ephemeral: true
		});
		return;
	} else if (interaction.customId == "account_SetUserCookieSelect") {
		const accountIndex = value;

		await interaction.showModal(
			new ModalBuilder()
				.setCustomId(`cookie_set-${accountIndex}`)
				.setTitle(tr("account_SetUserCookie"))
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("ltoken")
							.setLabel("ltoken_2")
							.setPlaceholder("v2_...")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(10)
							.setMaxLength(1000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("ltuid")
							.setLabel("ltuid_v2")
							.setPlaceholder("30...")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(1)
							.setMaxLength(30)
					)
				)
		);
	}
}

async function handleForgottenHall(interaction, tr, value) {
	const drawTask = async () => {
		try {
			const [userId, mode, time, i] = value.split("-");

			const hsr = await getUserHSRData(interaction, tr, userId);
			if (!hsr) return;

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

			const requestStartTime = Date.now();
			const res = await hsr.record.forgottenHall(
				parseInt(mode),
				parseInt(time)
			);

			if (res.has_data == false)
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("forgottenHall_NonData"))
							.setDescription(tr("forgottenHall_NonDataDesc"))
					],
					ephemeral: true
				});

			const floor = res.all_floor_detail[i];
			const requestEndTime = Date.now();
			const drawStartTime = Date.now();

			const imageBuffer = await drawFloorImage(
				tr,
				hsr.uid,
				res,
				mode,
				floor
			);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `${floor.maze_id}.png`
			});

			const commonParams = { s: `${floor.star_num}` };

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: interaction.user.username,
							iconURL: interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})
						})
						.setImage(`attachment://${image.name}`)
						.setFooter({
							text: tr("CostTime", {
								requestTime: (
									(requestEndTime - requestStartTime) /
									1000
								).toFixed(2),
								drawTime: (
									(drawEndTime - drawStartTime) /
									1000
								).toFixed(2)
							})
						})
				],
				files: [image],
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("forgottenHall_SelectFloor"))
							.setCustomId("forgottenHall_Floor")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								res.all_floor_detail.map((floor, i) => {
									const floorScore = node =>
										parseInt(node?.score) || 0;
									const totalScore =
										floorScore(floor.node_1) +
										floorScore(floor.node_2);
									return {
										label: `${floor.name.replace(
											/<\/?[^>]+(>|$)/g,
											""
										)}`,
										description:
											parseInt(mode) === 3
												? tr(
														"forgottenHall_FloorFormat3",
														{
															...commonParams,
															z: `${totalScore}`
														}
													)
												: parseInt(mode) === 2
													? tr(
															"forgottenHall_FloorFormat2",
															{
																...commonParams,
																r: `${floor.round_num}`,
																z: `${totalScore}`
															}
														)
													: tr(
															"forgottenHall_FloorFormat1",
															{
																...commonParams,
																r: `${floor.round_num}`
															}
														),

										value: `${userId}-${mode}-${time}-${i}`
									};
								})
							)
					)
				]
			});
		} catch (error) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription(`\`${error}\``)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				fetchReply: true
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}

async function handleSelectCharacter(interaction, tr, value) {
	const drawTask = async () => {
		try {
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

			const requestStartTime = Date.now();
			const [uid, userId, i] = value.split("-");
			const { status, playerData } = await requestPlayerData(
				uid,
				interaction
			);
			const requestEndTime = Date.now();
			const characters =
				// (await loadCharacters(playerData.player.uid)) ||
				playerData.characters;

			const drawStartTime = Date.now();
			const imageBuffer =
				i == "main"
					? await drawMainImage(tr, playerData)
					: await drawCharacterImage(tr, playerData, characters[i]);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));
			const drawEndTime = Date.now();

			const image = new AttachmentBuilder(imageBuffer, {
				name: `CharacterPage_${playerData.player.uid}.png`
			});

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: interaction.user.username,
							iconURL: interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})
						})
						.setImage(`attachment://${image.name}`)
						.setFooter({
							text: tr("CostTime", {
								requestTime: (
									(requestEndTime - requestStartTime) /
									1000
								).toFixed(2),
								drawTime: (
									(drawEndTime - drawStartTime) /
									1000
								).toFixed(2)
							})
						})
				],
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("profile_SelectCharacter"))
							.setCustomId("profile_SelectCharacter")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								i === "main"
									? characters.map((character, index) => ({
											emoji: emoji[
												character.element.id.toLowerCase()
											],
											label: character.name,
											value: `${playerData.player.uid}-${userId}-${index}`
										}))
									: [
											{
												emoji: emoji.avatarIcon,
												label: tr("MainPage"),
												value: `${playerData.player.uid}-${userId}-main`
											},
											...characters.map(
												(character, index) => ({
													emoji: emoji[
														character.element.id.toLowerCase()
													],
													label: character.name,
													value: `${playerData.player.uid}-${userId}-${index}`
												})
											)
										]
							)
					)
				],
				files: [image]
			});
		} catch (error) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("profile_DrawError"))
						.setDescription(`\`${error}\``)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				fetchReply: true
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}
