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
import { createChunkedSelectMenus } from "../utilities/hsr/selectmenu.js";
import {
	drawMainImage,
	drawCharacterImage,
	drawAllCharactersImage
} from "../utilities/hsr/profile.js";

function getPathNameByBaseType(baseType) {
	const pathMap = {
		1: "destruction",
		2: "hunt",
		3: "erudition",
		4: "harmony",
		5: "nihility",
		6: "preservation",
		7: "abundance",
		8: "remembrance"
	};
	return pathMap[baseType] || "";
}
import {
	getRandomColor,
	drawInQueueReply,
	requestPlayerData,
	getUserHSRData,
	getUserLang,
	getNewsList,
	getPostFull,
	parsePostContent,
	requestPlayerActivity,
	getUserCookie,
	getUserGameInfo
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
	if (customId.startsWith("profile_SelectCharacter"))
		handleSelectCharacter(interaction, tr, values[0]);
	if (customId.startsWith("profile_Filter")) {
		const [_, userId, accountIndex] = customId.split("-");
		handleProfileFilter(interaction, tr, userId, accountIndex, values);
	}
});

function filterAndSortCharacters(characters, selected) {
	// 如果沒有選擇任何篩選條件，返回所有角色
	if (selected.length === 0) {
		return characters;
	}

	// 分離屬性和命途選項
	const elementFilters = selected.filter(sel =>
		[
			"physical",
			"ice",
			"fire",
			"lightning",
			"wind",
			"quantum",
			"imaginary"
		].includes(sel)
	);
	const pathFilters = selected.filter(sel =>
		[
			"destruction",
			"harmony",
			"erudition",
			"hunt",
			"preservation",
			"nihility",
			"abundance",
			"remembrance"
		].includes(sel)
	);

	let result = [];

	// 如果同時選擇了屬性和命途，找同時符合的角色
	if (elementFilters.length > 0 && pathFilters.length > 0) {
		for (const element of elementFilters) {
			for (const path of pathFilters) {
				result = result.concat(
					characters.filter(
						c =>
							c.element === element &&
							getPathNameByBaseType(c.base_type) === path
					)
				);
			}
		}
	} else {
		// 只選擇了屬性
		if (elementFilters.length > 0) {
			for (const element of elementFilters) {
				result = result.concat(
					characters.filter(c => c.element === element)
				);
			}
		}

		// 只選擇了命途
		if (pathFilters.length > 0) {
			for (const path of pathFilters) {
				result = result.concat(
					characters.filter(
						c => getPathNameByBaseType(c.base_type) === path
					)
				);
			}
		}
	}

	// 去重
	return result.filter(
		(c, i, arr) => arr.findIndex(cc => cc.id === c.id) === i
	);
}

async function handleProfileFilter(
	interaction,
	tr,
	userId,
	accountIndex,
	selected
) {
	try {
		const requestStartTime = Date.now();
		// 取得原始角色資料
		const hsr = await getUserHSRData(interaction, tr, userId, accountIndex);
		if (!hsr) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription("無法取得角色資料")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				fetchReply: true
			});
		}

		const data = await hsr.record.records();
		const userCookie = await getUserCookie(userId, accountIndex);
		const gameInfo = await getUserGameInfo(userCookie);
		const playerData = {
			player: {
				nickname: gameInfo.nickname,
				uid: gameInfo.uid,
				level: gameInfo.level,
				avatar: { icon: data.cur_head_icon_url }
			}
		};

		const allCharacters = data.avatar_list;

		// 判斷是否有排序選項
		let sortType = null;
		let filterSelected = selected.filter(v => {
			if (v === "sort_level" || v === "sort_eidolon") {
				sortType = v;
				return false;
			}
			return true;
		});

		// "無篩選" 選項，若選擇則重置為預設
		if (filterSelected.includes("no_filter")) {
			filterSelected = [];
		}

		// 排序與篩選
		let sortedCharacters = filterAndSortCharacters(
			allCharacters,
			filterSelected
		);

		// 排序
		if (sortType === "sort_level") {
			sortedCharacters = sortedCharacters.sort((a, b) => {
				// 先按五星優先排序
				if (a.rarity !== b.rarity) {
					return b.rarity - a.rarity;
				}
				// 再按等級排序
				return b.level - a.level;
			});
		} else if (sortType === "sort_eidolon") {
			sortedCharacters = sortedCharacters.sort((a, b) => {
				// 先按五星優先排序
				if (a.rarity !== b.rarity) {
					return b.rarity - a.rarity;
				}
				// 再按命座排序
				return (b.rank ?? 0) - (a.rank ?? 0);
			});
		} else {
			// 如果沒有選擇排序，預設按五星優先排序
			sortedCharacters = sortedCharacters.sort((a, b) => {
				// 先按五星優先排序
				if (a.rarity !== b.rarity) {
					return b.rarity - a.rarity;
				}
				// 再按等級排序
				return b.level - a.level;
			});
		}

		const requestEndTime = Date.now();
		const drawStartTime = Date.now();

		// 準備篩選信息
		const filterInfo = {
			sortType: sortType,
			filters: filterSelected
		};

		// 重新繪圖
		const imageBuffer = await drawAllCharactersImage(
			tr,
			playerData,
			sortedCharacters,
			filterInfo
		);

		if (!imageBuffer) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription("無法生成圖片")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				fetchReply: true
			});
		}

		const drawEndTime = Date.now();
		const image = new AttachmentBuilder(imageBuffer, {
			name: `AllCharacters_${playerData.player.uid}.png`
		});

		const selectMenus = createChunkedSelectMenus(
			sortedCharacters.map((character, i) => ({
				emoji: allCharacters
					? emoji[character.element.toLowerCase()]
					: emoji[character.element.id.toLowerCase()],
				label: `${character.name}`,
				value: `${playerData.player.uid}-${userId}-${i}`
			})),
			tr("profile_SelectCharacter"),
			"profile_SelectCharacter"
		);

		// 篩選選單，第一個選項為「無篩選」
		const filterOptions = [
			{
				label: tr("profile_FilterNone"),
				value: "no_filter",
				emoji: "❌"
			},
			{
				label: tr("profile_SortByLevel"),
				value: "sort_level",
				emoji: "🔢"
			},
			{
				label: tr("profile_SortByEidolon"),
				value: "sort_eidolon",
				emoji: "⭐"
			},
			{
				label: tr("element_physical"),
				value: "physical",
				emoji: emoji.physical
			},
			{ label: tr("element_ice"), value: "ice", emoji: emoji.ice },
			{
				label: tr("element_fire"),
				value: "fire",
				emoji: emoji.fire
			},
			{
				label: tr("element_lightning"),
				value: "lightning",
				emoji: emoji.lightning
			},
			{
				label: tr("element_wind"),
				value: "wind",
				emoji: emoji.wind
			},
			{
				label: tr("element_quantum"),
				value: "quantum",
				emoji: emoji.quantum
			},
			{
				label: tr("element_imaginary"),
				value: "imaginary",
				emoji: emoji.imaginary
			},
			{
				label: tr("path_destruction"),
				value: "destruction",
				emoji: emoji.destruction
			},
			{
				label: tr("path_harmony"),
				value: "harmony",
				emoji: emoji.harmony
			},
			{
				label: tr("path_erudition"),
				value: "erudition",
				emoji: emoji.erudition
			},
			{ label: tr("path_hunt"), value: "hunt", emoji: emoji.hunt },
			{
				label: tr("path_preservation"),
				value: "preservation",
				emoji: emoji.preservation
			},
			{
				label: tr("path_nihility"),
				value: "nihility",
				emoji: emoji.nihility
			},
			{
				label: tr("path_abundance"),
				value: "abundance",
				emoji: emoji.abundance
			},
			{
				label: tr("path_remembrance"),
				value: "remembrance",
				emoji: emoji.remembrance
			}
		];

		const filterMenu = new StringSelectMenuBuilder()
			.setCustomId(`profile_Filter-${userId}-${accountIndex}`)
			.setPlaceholder(tr("profile_FilterPlaceholder"))
			.setMinValues(1)
			.setMaxValues(filterOptions.length)
			.addOptions(filterOptions);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
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
				...selectMenus.map(menu =>
					new ActionRowBuilder().addComponents(menu)
				),
				new ActionRowBuilder().addComponents(filterMenu)
			],
			files: [image],
			fetchReply: true
		});
	} catch (error) {
		console.error("handleProfileFilter error:", error);
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
}

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
							: (content.slice(0, 4096 - 3).concat("...") ??
									tr("None"))
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
						.setPlaceholder(tr("account_SelectAccountEdit"))
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
			const userAccountCookie = accountData.cookie;
			const cookieObject = {
				ltoken: "",
				ltuid: "",
				cookieToken: "",
				accountMid: ""
			};

			const keyMap = {
				ltoken_v2: "ltoken",
				ltuid_v2: "ltuid",
				cookie_token_v2: "cookieToken",
				account_mid_v2: "accountMid"
			};

			userAccountCookie.split("; ").reduce((obj, cookie) => {
				const [key, value] = cookie.split("=");
				if (key in keyMap) {
					obj[keyMap[key]] = value;
				}
				return obj;
			}, cookieObject);

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
								.setValue(cookieObject.ltoken || "")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(0)
								.setMaxLength(1000)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("ltuid")
								.setLabel("ltuid_v2")
								.setPlaceholder("30...")
								.setValue(cookieObject.ltuid || "")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(0)
								.setMaxLength(30)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("cookieToken")
								.setLabel(
									tr("Optional") + " " + "cookie_token_v2"
								)
								.setPlaceholder("v2_...")
								.setValue(cookieObject.cookieToken || "")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(0)
								.setMaxLength(1000)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("accountMid")
								.setLabel(
									tr("Optional") + " " + "account_mid_v2"
								)
								.setPlaceholder("1lyq...")
								.setValue(cookieObject.accountMid || "")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(0)
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
		const userAccountCookie = account[accountIndex].cookie;
		const cookieObject = {
			ltoken: "",
			ltuid: "",
			cookieToken: "",
			accountMid: ""
		};

		const keyMap = {
			ltoken_v2: "ltoken",
			ltuid_v2: "ltuid",
			cookie_token_v2: "cookieToken",
			account_mid_v2: "accountMid"
		};

		userAccountCookie.split("; ").reduce((obj, cookie) => {
			const [key, value] = cookie.split("=");
			if (key in keyMap) {
				obj[keyMap[key]] = value;
			}
			return obj;
		}, cookieObject);

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
							.setValue(cookieObject.ltoken || "")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(0)
							.setMaxLength(1000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("ltuid")
							.setLabel("ltuid_v2")
							.setPlaceholder("30...")
							.setValue(cookieObject.ltuid || "")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(0)
							.setMaxLength(30)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("cookieToken")
							.setLabel(tr("Optional") + " " + "cookie_token_v2")
							.setPlaceholder("v2_...")
							.setValue(cookieObject.cookieToken || "")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(0)
							.setMaxLength(1000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("accountMid")
							.setLabel(tr("Optional") + " " + "account_mid_v2")
							.setPlaceholder("1lyq...")
							.setValue(cookieObject.accountMid || "")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(0)
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
			let [uid, userId, accountIndex, allCharacters, characterId] =
				value.split("-");
			allCharacters = allCharacters == "true" ? true : false;
			let playerData = null;
			let playerActivity = null;
			let characters = null;

			if (allCharacters) {
				const hsr = await getUserHSRData(
					interaction,
					tr,
					userId,
					accountIndex
				);
				characters = await hsr.record.characters();
				const data = await hsr.record.records();
				const gameInfo = await getUserGameInfo(hsr.cookie);

				playerData = {
					player: {
						nickname: gameInfo.nickname,
						uid: gameInfo.uid,
						level: gameInfo.level,
						avatar: { icon: data.cur_head_icon_url }
					}
				};
			} else {
				const { status, playerData } = await requestPlayerData(
					uid,
					interaction
				);
				const { status: activityStatus, playerActivity } =
					await requestPlayerActivity(uid, interaction);

				if (status !== 200 || !playerData) {
					return interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(
									tr("profile_UidNotFound", {
										uid: `\`${uid}\``
									})
								)
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						],
						fetchReply: true
					});
				}

				characters = playerData.characters;
				playerActivity = playerActivity;
			}

			const character = characters.find(
				character => character.id == characterId
			);

			const requestEndTime = Date.now();

			const drawStartTime = Date.now();
			const imageBuffer =
				characterId == "main"
					? allCharacters
						? await drawAllCharactersImage(
								tr,
								playerData,
								characters
							)
						: await drawMainImage(tr, playerData, playerActivity)
					: await drawCharacterImage(
							tr,
							playerData,
							character,
							allCharacters
						);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));
			const drawEndTime = Date.now();

			const image = new AttachmentBuilder(imageBuffer, {
				name: `CharacterPage_${playerData.player.uid}.png`
			});

			const selectMenus = createChunkedSelectMenus(
				characterId === "main"
					? characters.map(character => ({
							emoji: allCharacters
								? emoji[character.element.toLowerCase()]
								: emoji[character.element.id.toLowerCase()],
							label: `${character.name}`,
							value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-${character.id}`
						}))
					: [
							{
								emoji: emoji.avatarIcon,
								label: tr("MainPage"),
								value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-main`
							},
							...characters.map(character => ({
								emoji: allCharacters
									? emoji[character.element.toLowerCase()]
									: emoji[character.element.id.toLowerCase()],
								label: character.name,
								value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-${character.id}`
							}))
						],
				tr("profile_SelectCharacter"),
				"profile_SelectCharacter"
			);

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
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
					...selectMenus.map(menu =>
						new ActionRowBuilder().addComponents(menu)
					)
				],
				files: [image]
			});
		} catch (error) {
			console.log(error);
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
