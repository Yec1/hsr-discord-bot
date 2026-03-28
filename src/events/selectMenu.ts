import { client, database } from "../index.js";
import {
	Events,
	ActionRowBuilder,
	AttachmentBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	Interaction,
	StringSelectMenuInteraction,
	MessageFlags
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
	getUserGameInfo,
	getFriendlyErrorMessage
} from "../utilities/index.js";
import { getSelectMenu } from "../utilities/hsr/selectmenu.js";
import { createTranslator, toI18nLang } from "../utilities/core/i18n.js";
import {
	loadPathsData,
	loadElementsData,
	buildPathMap
} from "../utilities/hsr/jsonManager.js";
import Queue from "queue";

const drawQueue = new Queue({ autostart: true });
const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
	if (!interaction.isStringSelectMenu()) return;

	const { locale, customId, values } = interaction;
	const userLocale = await getUserLang(interaction.user.id);
	const tr = createTranslator(userLocale || toI18nLang(locale) || "en");

	if (
		!customId.startsWith("account") &&
		!customId.startsWith("leaderboard") &&
		!customId.startsWith("profile_SelectCharacter") &&
		!customId.startsWith("profile_Filter") &&
		!customId.startsWith("news") &&
		!customId.startsWith("guide") &&
		customId !== "forgottenHall_Floor"
	)
		await interaction.update({}).catch(() => {});
	if (customId.startsWith("guide") && values[0])
		handleGuide(interaction, tr, values[0]);
	if (customId.startsWith("news") && values[0])
		handleNews(interaction, tr, values[0]);
	if (customId.startsWith("leaderboard") && values[0])
		handleLeaderboard(interaction, tr, values[0]);
	if (customId.startsWith("account") && values[0])
		handleAccountAction(interaction, tr, customId, values[0]);
	if (customId === "account_AddAccount") {
		await interaction.showModal(
			new ModalBuilder()
				.setCustomId("account_SetUserIDModal")
				.setTitle(tr("account_SetUserID"))
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(
						new TextInputBuilder()
							.setCustomId("account_SetUserIDModalField")
							.setLabel(tr("account_SetUserIDDesc"))
							.setPlaceholder("e.g. 809279679")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
							.setMinLength(9)
							.setMaxLength(10)
					)
				)
		);
		return;
	}
	if (customId == "forgottenHall_Floor" && values[0])
		handleForgottenHall(interaction, tr, values[0]);
	if (customId.startsWith("profile_SelectCharacter") && values[0])
		handleSelectCharacter(interaction, tr, values[0]);
	if (customId.startsWith("profile_Filter")) {
		const [_, userId, accountIndex] = customId.split("-");
		if (userId && accountIndex) {
			handleProfileFilter(
				interaction,
				tr,
				userId,
				parseInt(accountIndex),
				values
			);
		}
	}
});

// 基本類型定義
interface Character {
	id: string;
	name: string;
	level: number;
	rank: number;
	rarity: number;
	icon: string;
	preview?: string;
	portrait?: string;
	image?: string;
	element:
		| {
				id: string;
				icon: string;
				color: string;
		  }
		| string;
	path?:
		| {
				id: string;
				name: string;
				icon: string;
		  }
		| string;
	base_type?: number;
	attributes?: Attribute[];
	additions?: Attribute[];
	properties?: Property[];
	relics?: Relic[];
	ornaments?: Relic[];
	light_cone?: LightCone;
	equip?: LightCone;
	skills?: Skill[];
	servant_detail?: {
		servant_skills: ServantSkill[];
	};
}

interface Attribute {
	field: string;
	value: number;
	display?: string;
	name?: string;
	icon?: string;
	final?: string | number;
	base?: string | number;
	add?: string | number;
}

interface Property {
	property_type: number;
	base: string;
	add: string;
	final: string;
}

interface Relic {
	id: string;
	name: string;
	level: number;
	rarity: number;
	icon: string;
	main_affix?: {
		name: string;
		display: string;
		value: string;
		weight: number;
		icon: string;
		propertyName?: string;
	};
	main_property?: {
		property_type: number;
		value: string;
	};
	sub_affix?: SubAffix[];
	properties?: SubAffix[];
}

interface SubAffix {
	display: string;
	value: string;
	weight: number;
	icon: string;
	property_type: number;
	propertyName?: string;
	count?: number;
	times?: number;
}

interface LightCone {
	id: string;
	name: string;
	level: number;
	rank: number;
	icon: string;
}

interface Skill {
	point_type: number;
	item_url?: string;
	icon: string;
	type_text?: string;
	remake?: string;
	level: number;
}

interface ServantSkill {
	item_url?: string;
	icon: string;
	remake: string;
	level: number;
}

interface PlayerData {
	player: {
		nickname: string;
		uid: string;
		level: number;
		world_level?: number;
		avatar: { icon: string };
		space_info?: {
			avatar_count: number;
			achievement_count: number;
		};
	};
	characters: Character[];
}

interface GameInfo {
	nickname: string;
	uid: string;
	level: number;
}

interface LeaderboardData {
	id: string;
	score: Array<{
		nickname: string;
		uid: string;
		score: number;
		avatar: string;
	}>;
	element: {
		color: string;
	};
	icon: string;
}

interface NewsData {
	data: {
		list: Array<{
			post: {
				post_id: string;
				subject: string;
				created_at: number;
			};
		}>;
	};
}

interface PostData {
	post: {
		post: {
			subject: string;
			content: string;
			created_at: number;
			post_id?: string;
		};
		user: {
			avatar_url?: string;
			nickname?: string;
			uid: string;
		};
		image_list: Array<{ url: string }>;
		cover_list: Array<{ url: string }>;
	};
}

interface FilterInfo {
	sortType?: string;
	filters: string[];
}

async function getPathNameByBaseType(
	baseType: number | undefined
): Promise<string> {
	// 這裡使用 'en' locale 建立 pathMap，因為篩選邏輯內部使用的是英文名稱（如 destruction, hunt）
	const pathMap = await buildPathMap("en");
	return pathMap[baseType || 0] || "";
}

async function filterAndSortCharacters(
	characters: Character[],
	filters: string[]
): Promise<Character[]> {
	if (filters.length === 0) return characters;

	const elementFilters = filters.filter(sel =>
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

	const pathFilters = filters.filter(sel =>
		[
			"destruction",
			"hunt",
			"erudition",
			"harmony",
			"nihility",
			"preservation",
			"abundance",
			"remembrance",
			"elation"
		].includes(sel)
	);

	let result: Character[] = [];
	const pathMap = await buildPathMap("en");

	// 如果同時選擇了屬性和命途，找同時符合的角色
	if (elementFilters.length > 0 && pathFilters.length > 0) {
		for (const element of elementFilters) {
			for (const path of pathFilters) {
				result = result.concat(
					characters.filter(
						c =>
							c.element === element &&
							pathMap[c.base_type || 0] === path
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
					characters.filter(c => pathMap[c.base_type || 0] === path)
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
	interaction: StringSelectMenuInteraction,
	tr: any,
	userId: string,
	accountIndex: number,
	selected: string[]
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	try {
		const requestStartTime = Date.now();
		const locale = interaction.locale;
		const userLocale = await getUserLang(interaction.user.id);
		// 取得原始角色資料
		const hsr = await getUserHSRData(
			interaction,
			tr,
			userId || "",
			accountIndex
		);
		if (!hsr) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription("無法取得角色資料")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
			return;
		}

		const data = await hsr.record.records();
		const userCookie = await getUserCookie(userId, accountIndex);
		if (!userCookie) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription("無法取得Cookie資料")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
			return;
		}
		let gameInfo: { uid: string; nickname: string; level: number };
		try {
			gameInfo = await getUserGameInfo(userCookie);
		} catch (e) {
			console.warn(
				"[SelectMenu] getUserGameInfo failed, using fallback:",
				(e as Error).message
			);
			gameInfo = {
				uid: String(hsr.uid || ""),
				nickname: (data as any)?.role?.nickname || String(hsr.uid || ""),
				level: (data as any)?.role?.level || 0
			};
		}
		const allCharacters = data.avatar_list;
		const playerData: PlayerData = {
			player: {
				nickname: gameInfo.nickname,
				uid: gameInfo.uid,
				level: gameInfo.level,
				avatar: { icon: (data as any).cur_head_icon_url || "" }
			},
			characters: allCharacters as any
		};

		// 判斷是否有排序選項
		let sortType: string | null = null;
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
		let sortedCharacters = await filterAndSortCharacters(
			allCharacters as unknown as Character[],
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
		const filterInfo: FilterInfo = {
			filters: filterSelected
		};
		if (sortType) {
			filterInfo.sortType = sortType;
		}

		// 重新繪圖
		const imageBuffer = await drawAllCharactersImage(
			tr,
			playerData as any,
			sortedCharacters as any,
			filterInfo
		);

		if (!imageBuffer) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription("無法生成圖片")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
			return;
		}

		const drawEndTime = Date.now();
		const image = new AttachmentBuilder(imageBuffer, {
			name: `AllCharacters_${playerData.player.uid}.webp`
		});

		const selectMenus = createChunkedSelectMenus(
			sortedCharacters.map((character, i) => {
				// 安全地获取元素ID
				const elementId =
					typeof character.element === "string"
						? character.element
						: character.element?.id || "physical";
				const elementKey = (elementId as string).toLowerCase();

				return {
					emoji: (emoji as any)[elementKey] || emoji.physical,
					label: `${character.name}`,
					value: `${playerData.player.uid}-${userId}-${i}`
				};
			}),
			tr("profile_SelectCharacter"),
			"profile_SelectCharacter"
		);

		// 獲取動態命途與屬性數據
		const pathsData = await loadPathsData(
			userLocale || toI18nLang(locale) || "en"
		);
		const elementsData = await loadElementsData(
			userLocale || toI18nLang(locale) || "en"
		);

		// 篩選選單
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
			}
		];

		// 動態添加屬性選項
		if (elementsData) {
			Object.values(elementsData).forEach((el: any) => {
				const elId = el.id.toLowerCase();
				filterOptions.push({
					label: tr(`element_${elId}`) || el.name,
					value: elId,
					emoji: (emoji as any)[elId] || emoji.physical
				});
			});
		} else {
			// 回退
			[
				"physical",
				"ice",
				"fire",
				"lightning",
				"wind",
				"quantum",
				"imaginary"
			].forEach(id => {
				filterOptions.push({
					label: tr(`element_${id}`),
					value: id,
					emoji: (emoji as any)[id] || emoji.physical
				});
			});
		}

		// 動態添加命途選項
		if (pathsData) {
			Object.values(pathsData).forEach((path: any) => {
				const pathId = path.id.toLowerCase();
				filterOptions.push({
					label: tr(`path_${pathId}`) || path.name,
					value: pathId,
					emoji: (emoji as any)[pathId] || (emoji as any).destruction
				});
			});
		} else {
			// 回退
			[
				"destruction",
				"harmony",
				"erudition",
				"hunt",
				"preservation",
				"nihility",
				"abundance",
				"remembrance"
			].forEach(id => {
				filterOptions.push({
					label: tr(`path_${id}`),
					value: id,
					emoji: (emoji as any)[id] || (emoji as any).destruction
				});
			});
		}

		const filterMenu = new StringSelectMenuBuilder()
			.setCustomId(`profile_Filter-${userId}-${accountIndex}`)
			.setPlaceholder(tr("profile_FilterPlaceholder"))
			.setMinValues(1)
			.setMaxValues(filterOptions.length)
			.addOptions(filterOptions);

		await interaction.editReply({
			content: "",
			embeds: [],
			components: [
				...selectMenus.map(menu =>
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						menu
					)
				),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					filterMenu
				)
			],
			files: [image]
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
			]
		});
	}
}

async function handleNews(
	interaction: StringSelectMenuInteraction,
	tr: any,
	value: string
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	if (interaction.customId == "news_type") {
		const type = value;
		const newsData: NewsData = await getNewsList(
			interaction.locale.toLowerCase(),
			type
		);

		await interaction.editReply({
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
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
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
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
			]
		});
		return;
	} else if (interaction.customId == "news_post") {
		const postId = value;
		const postData: PostData = await getPostFull(
			interaction.locale.toLowerCase(),
			postId
		);
		const { post, user, image_list, cover_list } = postData.post;
		const content = await parsePostContent(post.content);
		const date = new Date(post.created_at * 1000);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(getRandomColor() as any)
					.setAuthor({
						iconURL: user.avatar_url ?? "",
						name: user.nickname ?? "",
						url: `https://www.hoyolab.com/accountCenter?id=${user.uid}`
					})
					.setTitle(post.subject ?? tr("None"))
					.setURL(
						`https://www.hoyolab.com/article/${post.post_id || ""}`
					)
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
					.setImage(image_list[0]?.url ?? cover_list[0]?.url ?? null)
			]
		});
		return;
	}
}

async function handleLeaderboard(
	interaction: StringSelectMenuInteraction,
	tr: any,
	value: string
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	const id = value;
	const leaderboardData: LeaderboardData = (await database.get(
		`LeaderBoard.${id}`
	)) ?? {
		id: "",
		score: [],
		element: { color: "" },
		icon: ""
	};
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
	const selectMenus = await getSelectMenu(
		interaction as any,
		tr,
		"leaderboard"
	);
	const embedTitle = `${emoji.crown} \`${firstPlace?.nickname || ""}\` ${
		firstPlace?.uid || ""
	} • ${tr("leaderboard_Score", {
		z: `${firstPlace?.score || 0}`
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
				.setColor(leaderboardData.element.color as any)
				.setAuthor({
					iconURL: firstPlace?.avatar.startsWith("http")
						? firstPlace.avatar
						: `${image_Header}/${firstPlace?.avatar || ""}`,
					name: `${tr("leaderboard_Title", {
						z: `${
							localeJson[leaderboardData.id]?.name == "{NICKNAME}"
								? `${tr("MainCharacter")}`
								: localeJson[leaderboardData.id]?.name || ""
						}`
					})}`
				})
				.setThumbnail(
					leaderboardData.icon.startsWith("http")
						? leaderboardData.icon
						: `${image_Header}/${leaderboardData.icon}`
				)
				.setTitle(embedTitle)
				.addFields({
					name: `\u200b`,
					value: "\u200b",
					inline: false
				})
				.setDescription(embedDescription)
		],
		components: selectMenus.map(selectMenu => {
			return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				selectMenu
			);
		})
	});
}

async function handleGuide(
	interaction: StringSelectMenuInteraction,
	tr: any,
	value: string
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
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
	const selectMenus = await getSelectMenu(interaction as any, tr, "guide");
	try {
		await axios.get(
			`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`
		);
	} catch (e) {
		await interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						`${tr("guide_NonImage", {
							z: localeJson[id]?.name || ""
						})}`
					)
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
			],
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	const image = new AttachmentBuilder(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/guide/Nwflower/character_overview/${id}.png`,
		{
			name: `${id}.png`
		}
	);

	interaction.editReply({
		embeds: [],
		files: [image],
		components: selectMenus.map(selectMenu => {
			return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				selectMenu
			);
		})
	});
}

async function handleAccountAction(
	interaction: StringSelectMenuInteraction,
	tr: any,
	customId: string,
	value: string
): Promise<void> {
	const account = await database.get(`${interaction.user.id}.account`);
	if (!account) {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(`${tr("account_nonAcc")}`)
			],
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	if (customId == "account_EditAccountSelect") {
		const accountIndex = value;
		const accountData = account[parseInt(accountIndex || "0")];

		const userAccountCookie = accountData?.cookie || "";
		const cookieInput = new TextInputBuilder()
			.setCustomId("cookie")
			.setLabel("Cookie")
			.setPlaceholder(
				"ltoken_v2=...; ltuid_v2=...; cookie_token_v2=...; account_mid_v2=..."
			)
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true)
			.setMinLength(1)
			.setMaxLength(4000);

		if (userAccountCookie) cookieInput.setValue(userAccountCookie);

		await interaction.showModal(
			new ModalBuilder()
				.setCustomId(`cookie_set-${accountIndex}`)
				.setTitle(tr("account_SetUserCookie"))
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(
						cookieInput
					)
				)
		);
		return;
	} else if (customId == "account_DeleteAccountSelect") {
		await interaction.update({}).catch(() => {});
		const accountIndex = value;
		const accounts =
			(await database.get(`${interaction.user.id}.account`)) ?? "";
		const uid = accounts[parseInt(accountIndex)]?.uid || "";

		if (accounts.length <= 1)
			await database.delete(`${interaction.user.id}.account`);
		else {
			accounts.splice(parseInt(accountIndex), 1);
			await database.set(`${interaction.user.id}.account`, accounts);
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
			components: []
		});
		return;
	}
}

async function handleForgottenHall(
	interaction: StringSelectMenuInteraction,
	tr: any,
	value: string
) {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	const drawTask = async () => {
		try {
			const [userId, mode, time, i] = value.split("-");

			const hsr = await getUserHSRData(interaction, tr, userId || "", 0);
			if (!hsr) {
				interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("DrawError"))
							.setDescription("無法取得遊戲資料")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
				return;
			}

			const requestStartTime = Date.now();
			const res = await hsr.record.forgottenHall(
				parseInt(mode || "0"),
				parseInt(time || "0")
			);

			if (res.has_data == false) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("forgottenHall_NonData"))
							.setDescription(tr("forgottenHall_NonDataDesc"))
					]
				});
				return;
			}

			const floor = res.all_floor_detail[parseInt(i || "0")];
			const requestEndTime = Date.now();
			const drawStartTime = Date.now();

			const imageBuffer = await drawFloorImage(
				tr,
				hsr.uid?.toString() || "",
				res as any,
				parseInt(mode || "0"),
				floor
			);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `${floor?.maze_id || "floor"}.webp`
			});

			const commonParams = { s: `${floor?.star_num || 0}` };

			interaction.editReply({
				content: "",

				embeds: [],
				files: [image],
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("forgottenHall_SelectFloor"))
							.setCustomId("forgottenHall_Floor")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								res.all_floor_detail.map(
									(floor: any, i: number) => {
										const floorScore = (node: any) =>
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
												parseInt(mode || "0") === 3
													? tr(
															"forgottenHall_FloorFormat3",
															{
																...commonParams,
																z: `${totalScore}`
															}
														)
													: parseInt(mode || "0") ===
														  2
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
									}
								)
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
				]
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction as any,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}

async function handleSelectCharacter(
	interaction: StringSelectMenuInteraction,
	tr: any,
	value: string
) {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	const drawTask = async () => {
		try {
			const requestStartTime = Date.now();
			let [uid, userId, accountIndex, allCharacters, characterId] =
				value.split("-");
			const allCharactersBool = allCharacters == "true" ? true : false;

			// 獲取用戶語言
			const userLang = (await getUserLang(userId || "")) || "tw";

			let playerData: PlayerData | null = null;
			let playerActivity = null;
			let character: Character | null = null;
			let characters: Character[] | null = null;

			if (allCharactersBool) {
				const hsr = await getUserHSRData(
					interaction,
					tr,
					userId || "",
					parseInt(accountIndex || "0")
				);

				if (!hsr) {
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(tr("DrawError"))
								.setDescription(
									"無法取得遊戲資料，請檢查帳號設定"
								)
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						]
					});
					return;
				}

				characters = (await hsr.record.characters()) as any;
				const data = await hsr.record.records();
				let gameInfo: { uid: string; nickname: string; level: number };
				try {
					gameInfo = await getUserGameInfo(hsr.cookie as any);
				} catch (e) {
					console.warn(
						"[SelectMenu] getUserGameInfo failed, using fallback:",
						(e as Error).message
					);
					gameInfo = {
						uid: String(hsr.uid || uid || ""),
						nickname: (data as any)?.role?.nickname || String(hsr.uid || uid || ""),
						level: (data as any)?.role?.level || 0
					};
				}

				playerData = {
					player: {
						nickname: gameInfo.nickname,
						uid: gameInfo.uid,
						level: gameInfo.level,
						avatar: { icon: (data as any).cur_head_icon_url || "" }
					},
					characters: characters || []
				};

				if (!characters || characters.length === 0) {
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(tr("DrawError"))
								.setDescription("無法取得角色資料")
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						]
					});
					return;
				}

				character =
					characters.find(character => character.id == characterId) ||
					null;
			} else {
				const {
					status: reqPlayerDataStatus,
					playerData: reqPlayerData
				} = await requestPlayerData(uid || "", interaction);
				const {
					status: reqPlayerActivityStatus,
					playerActivity: reqPlayerActivity
				} = await requestPlayerActivity(uid || "", interaction);

				if (reqPlayerDataStatus == 400) {
					const friendlyDetail = getFriendlyErrorMessage(
						reqPlayerData.detail,
						tr
					);
					const friendlyMessage = getFriendlyErrorMessage(
						reqPlayerData.message,
						tr
					);

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(friendlyDetail)
								.setDescription(`\`${friendlyMessage}\``)
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						]
					});
					return;
				}

				if (reqPlayerDataStatus !== 200 || !reqPlayerData) {
					await interaction.editReply({
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
						]
					});
					return;
				}

				playerData = reqPlayerData;
				characters = reqPlayerData.characters;
				character =
					characters?.find(
						character => character.id == characterId
					) || null;
				playerActivity = reqPlayerActivity;
			}

			const requestEndTime = Date.now();

			// 檢查 playerData 是否為 null
			if (!playerData) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("DrawError"))
							.setDescription("無法取得玩家資料")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
				return;
			}

			// 檢查 character 是否為 null（當選擇特定角色時）
			if (characterId !== "main" && !character) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("DrawError"))
							.setDescription("無法找到指定角色")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
				return;
			}

			const drawStartTime = Date.now();
			const imageBuffer =
				characterId == "main"
					? allCharactersBool
						? await drawAllCharactersImage(
								tr,
								playerData as any,
								(characters || []) as any
							)
						: await drawMainImage(
								tr,
								playerData as any,
								playerActivity
							)
					: character
						? await drawCharacterImage(
								tr,
								playerData as any,
								character as any,
								allCharactersBool,
								userLang
							)
						: null;
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));
			const drawEndTime = Date.now();

			const image = new AttachmentBuilder(imageBuffer, {
				name: `CharacterPage_${playerData.player.uid}.webp`
			});

			const selectMenus = createChunkedSelectMenus(
				characterId === "main"
					? (characters || []).map(character => {
							// 安全地获取元素ID
							const elementId = allCharactersBool
								? character.element
								: typeof character.element === "string"
									? character.element
									: character.element?.id || "physical";
							const elementKey = (
								elementId as string
							).toLowerCase();

							return {
								emoji:
									(emoji as any)[elementKey] ||
									emoji.physical,
								label: `${character.name}`,
								value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-${character.id}`
							};
						})
					: [
							{
								emoji: (emoji as any).avatarIcon,
								label: tr("MainPage"),
								value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-main`
							},
							...(characters || []).map(character => {
								// 安全地获取元素ID
								const elementId = allCharactersBool
									? character.element
									: typeof character.element === "string"
										? character.element
										: character.element?.id || "physical";
								const elementKey = (
									elementId as string
								).toLowerCase();

								return {
									emoji:
										(emoji as any)[elementKey] ||
										emoji.physical,
									label: character.name,
									value: `${playerData.player.uid}-${userId}-${accountIndex}-${allCharacters}-${character.id}`
								};
							})
						],
				tr("profile_SelectCharacter"),
				"profile_SelectCharacter"
			);

			interaction.editReply({
				content: "",

				embeds: [],
				components: [
					...selectMenus.map(menu =>
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							menu
						)
					)
				],
				files: [image]
			});
		} catch (error) {
			console.error("Error in drawTask:", error);
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("profile_DrawError"))
						.setDescription(
							`\`${error instanceof Error ? error.message : String(error)}\``
						)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction as any,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}
