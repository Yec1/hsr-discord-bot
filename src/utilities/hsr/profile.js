import { client } from "../../index.js";
import {
	requestPlayerData,
	drawInQueueReply,
	getRandomColor,
	requestPlayerActivity,
	getUserHSRData,
	getUserGameInfo
} from "../utilities.js";
import { createChunkedSelectMenus } from "./selectmenu.js";
import { join } from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import {
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import { getRelicsScore } from "./relics.js";
import emoji from "../../assets/emoji.js";
import Queue from "queue";
const db = client.db;

const drawQueue = new Queue({ autostart: true });

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

const pathMap = {
	1: "destruction", // 毀滅
	2: "hunt", // 巡獵
	3: "erudition", // 智識
	4: "harmony", // 同諧
	5: "nihility", // 虛無
	6: "preservation", // 存護
	7: "abundance", // 豐饒
	8: "remembrance" // 記憶
};

export const propertyMap = {
	1: "MaxHP",
	2: "Attack",
	3: "Defence",
	4: "Speed",
	5: "CriticalChance",
	6: "CriticalDamage",
	7: "HealRatio",
	// 8: ""
	9: "EnergyRecovery",
	10: "StatusProbability",
	11: "StatusResistance",
	12: "PhysicalAddedRatio",
	14: "FireAddedRatio",
	16: "IceAddedRatio",
	18: "ThunderAddedRatio",
	20: "WindAddedRatio",
	22: "QuantumAddedRatio",
	24: "ImaginaryAddedRatio",
	27: "MaxHP", // 小生命
	29: "Attack", // 小攻擊
	31: "Defence", // 小防禦
	32: "MaxHP", // 大生命
	33: "Attack", // 大攻擊
	34: "Defence", // 大防禦
	51: "Speed",
	52: "CriticalChance",
	53: "CriticalDamage",
	54: "EnergyRecovery",
	55: "HealRatio",
	56: "StatusProbability",
	57: "StatusResistance",
	58: "BreakUp",
	59: "BreakUp"
};

const loadImageAsync = async (url, fallbackUrl = null) => {
	try {
		if (!loadImageAsync.cache) loadImageAsync.cache = new Map();

		if (loadImageAsync.cache.has(url)) {
			const cachedImage = loadImageAsync.cache.get(url);
			return {
				image: cachedImage,
				usedFallback: false
			};
		}

		const image = await loadImage(url);
		loadImageAsync.cache.set(url, image);
		return { image, usedFallback: false };
	} catch (error) {
		console.warn(`Failed to load image: ${url}`, error.message);

		// 如果有备选URL，尝试加载备选图片
		if (fallbackUrl) {
			try {
				if (!loadImageAsync.cache.has(fallbackUrl)) {
					const fallbackImage = await loadImage(fallbackUrl);
					loadImageAsync.cache.set(fallbackUrl, fallbackImage);
				}
				return {
					image: loadImageAsync.cache.get(fallbackUrl),
					usedFallback: true
				};
			} catch (fallbackError) {
				console.warn(
					`Failed to load fallback image: ${fallbackUrl}`,
					fallbackError.message
				);
			}
		}

		// 使用本地默認圖片
		const defaultUrl = "./src/assets/image/icon/property/iconAttack.png";
		try {
			if (!loadImageAsync.cache.has(defaultUrl)) {
				const defaultImage = await loadImage(defaultUrl);
				loadImageAsync.cache.set(defaultUrl, defaultImage);
			}
			return {
				image: loadImageAsync.cache.get(defaultUrl),
				usedFallback: false
			};
		} catch (defaultError) {
			console.error(
				`Failed to load default image: ${defaultUrl}`,
				defaultError.message
			);
			// 如果連默認圖片都無法載入，創建一個簡單的空白圖片
			const canvas = createCanvas(64, 64);
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "#666";
			ctx.fillRect(0, 0, 64, 64);
			const fallbackImage = await loadImage(canvas.toBuffer());
			loadImageAsync.cache.set(defaultUrl, fallbackImage);
			return {
				image: fallbackImage,
				usedFallback: false
			};
		}
	}
};

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "YaHei.ttf"),
	"YaHei"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "Cinzel.ttf"),
	"Cinzel"
);

function containsChinese(text) {
	return /[\u4e00-\u9fa5]/.test(text);
}

// 渲染屬性列表的輔助函數
async function renderAttributesList(ctx, attributes, startX, startY, spacing) {
	// 過濾掉 0/0%/0.0%/0.00%/0.0/0 的屬性
	const filtered = attributes.filter(attribute => {
		const v = attribute.display ?? attribute.value ?? attribute.final;
		if (typeof v === "string") {
			return !/^0(\.0+)?%?$/.test(v.trim());
		} else if (typeof v === "number") {
			return v !== 0;
		}
		return true;
	});
	for (let i = 0; i < filtered.length; i++) {
		const attribute = filtered[i];
		const y = startY + i * spacing;

		// 載入並繪製屬性圖標
		const attributeImageResult = await loadImageAsync(
			`./src/assets/image/${attribute.icon}`
		);
		if (attributeImageResult && attributeImageResult.image) {
			ctx.drawImage(attributeImageResult.image, startX, y, 48, 48);
		}

		// 繪製屬性名稱
		ctx.font = "bold 24px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.textAlign = "left";
		ctx.fillText(attribute.name, startX + 55, y + 33);

		// 繪製屬性數值
		ctx.font = "bold 24px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.textAlign = "right";
		ctx.fillText(
			`${attribute.display || attribute.value || attribute.final}`,
			startX + 450,
			y + 33
		);
	}
}

// 繪製分隔線的輔助函數
function drawSeparatorLine(ctx, startX, endX, y) {
	ctx.strokeStyle = "#fff";
	ctx.beginPath();
	ctx.moveTo(startX, y);
	ctx.lineTo(endX, y);
	ctx.stroke();
}

async function saveLeaderboard(playerData) {
	const leaderboard = (await db.get("LeaderBoard")) || {};

	for (let i = 0; i < playerData.characters.length; i++) {
		const character = playerData.characters[i];
		const relicScore = await getRelicsScore(character);
		const leaderboardData = leaderboard[character.id] || {};

		const playerEntry = {
			uid: playerData.player.uid,
			nickname: playerData.player.nickname,
			avatar: playerData.player.avatar.icon,
			score: relicScore?.totalScore || 0
		};

		if (!leaderboardData.id) {
			leaderboardData.id = character.id;
			leaderboardData.icon = character.icon;
			leaderboardData.element = {
				id: character.element.id,
				color: character.element.color
			};
			leaderboardData.score = [];
		}

		const existingEntryIndex = leaderboardData.score.findIndex(
			entry => entry.uid === playerEntry.uid
		);

		if (existingEntryIndex !== -1) {
			if (
				playerEntry.score >
				leaderboardData.score[existingEntryIndex].score
			) {
				leaderboardData.score[existingEntryIndex].score =
					playerEntry.score;
			}
			leaderboardData.score[existingEntryIndex].nickname =
				playerEntry.nickname;
			leaderboardData.score[existingEntryIndex].avatar =
				playerEntry.avatar;
		} else {
			leaderboardData.score.push(playerEntry);
		}

		leaderboardData.score.sort((a, b) => b.score - a.score);
		leaderboardData.score.splice(10);

		leaderboard[character.id] = leaderboardData;
	}

	await db.set("LeaderBoard", leaderboard);
}

async function handleProfileDraw(
	interaction,
	tr,
	user,
	uid,
	allCharacters = false,
	accountIndex = 0
) {
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
				fetchReply: true
			});

			const requestStartTime = Date.now();

			// 如果目標玩家已經綁定帳號 使用hoyoapi 獲取資料
			let playerData = null;
			let playerActivity = null;
			let characters = null;
			if (allCharacters) {
				const hsr = await getUserHSRData(
					interaction,
					tr,
					user.id,
					accountIndex
				);

				if (!hsr) {
					return interaction.editReply({
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
						],
						fetchReply: true
					});
				}

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

				characters = data.avatar_list;
			} else {
				const {
					status: reqPlayerDataStatus,
					playerData: reqPlayerData
				} = await requestPlayerData(uid, interaction);
				const {
					status: reqPlayerActivityStatus,
					playerActivity: reqPlayerActivity
				} = await requestPlayerActivity(uid, interaction);

				if (reqPlayerDataStatus !== 200) {
					return interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle(
									tr("profile_UidNotFound", {
										uid: `\`${uid}\``
									})
								)
								.setColor("#E76161")
								.setThumbnail(
									"https://media.discordapp.net/attachments/1231256542419095623/1246728242052989053/Trailblazer_female.png"
								)
						],
						fetchReply: true
					});
				}

				saveLeaderboard(reqPlayerData);
				characters = reqPlayerData.characters;
				playerActivity = reqPlayerActivity;
				playerData = reqPlayerData;
			}

			const requestEndTime = Date.now();
			const drawStartTime = Date.now();
			let imageBuffer = null;
			if (allCharacters) {
				// 預設按五星優先排序
				const defaultSortedCharacters = characters.sort((a, b) => {
					// 先按五星優先排序
					if (a.rarity !== b.rarity) {
						return b.rarity - a.rarity;
					}
					// 再按等級排序
					return b.level - a.level;
				});

				imageBuffer = await drawAllCharactersImage(
					tr,
					playerData,
					defaultSortedCharacters
				);
			} else {
				imageBuffer = await drawMainImage(
					tr,
					playerData,
					playerActivity
				);
			}
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `MainPage_${playerData.player.uid}.png`
			});

			const selectMenus = createChunkedSelectMenus(
				characters.map(character => ({
					emoji: allCharacters
						? emoji[character.element.toLowerCase()]
						: emoji[character.element.id.toLowerCase()],
					label: `${character.name}`,
					value: `${playerData.player.uid}-${user.id}-${accountIndex}-${allCharacters}-${character.id}`
				})),
				tr("profile_SelectCharacter"),
				"profile_SelectCharacter"
			);

			const filterOptions = [
				{
					label: tr("profile_FilterNone"),
					value: "no_filter",
					emoji: "❌"
				},
				// 排序
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
				// 屬性
				{
					label: tr("element_physical"),
					value: "physical",
					emoji: emoji["physical"]
				},
				{ label: tr("element_ice"), value: "ice", emoji: emoji["ice"] },
				{
					label: tr("element_fire"),
					value: "fire",
					emoji: emoji["fire"]
				},
				{
					label: tr("element_lightning"),
					value: "lightning",
					emoji: emoji["lightning"]
				},
				{
					label: tr("element_wind"),
					value: "wind",
					emoji: emoji["wind"]
				},
				{
					label: tr("element_quantum"),
					value: "quantum",
					emoji: emoji["quantum"]
				},
				{
					label: tr("element_imaginary"),
					value: "imaginary",
					emoji: emoji["imaginary"]
				},
				// 命途
				{
					label: tr("path_destruction"),
					value: "destruction",
					emoji: emoji["destruction"]
				},
				{
					label: tr("path_harmony"),
					value: "harmony",
					emoji: emoji["harmony"]
				},
				{
					label: tr("path_erudition"),
					value: "erudition",
					emoji: emoji["erudition"]
				},
				{ label: tr("path_hunt"), value: "hunt", emoji: emoji["hunt"] },
				{
					label: tr("path_preservation"),
					value: "preservation",
					emoji: emoji["preservation"]
				},
				{
					label: tr("path_nihility"),
					value: "nihility",
					emoji: emoji["nihility"]
				},
				{
					label: tr("path_abundance"),
					value: "abundance",
					emoji: emoji["abundance"]
				},
				{
					label: tr("path_remembrance"),
					value: "remembrance",
					emoji: emoji["remembrance"]
				}
			];

			const filterMenu = new StringSelectMenuBuilder()
				.setCustomId(`profile_Filter-${user.id}-${accountIndex}`)
				.setPlaceholder(tr("profile_FilterPlaceholder"))
				.setMinValues(1)
				.setMaxValues(filterOptions.length)
				.addOptions(filterOptions);

			const components = [
				...selectMenus.map(menu =>
					new ActionRowBuilder().addComponents(menu)
				),
				allCharacters
					? new ActionRowBuilder().addComponents(filterMenu)
					: null
			];

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
				components: components,
				files: [image]
			});
		} catch (error) {
			console.error(error);
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

async function drawMainImage(tr, playerData, playerActivity) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		const imageUrls = [
			"./src/assets/image/warp/bg.jpg",
			`${image_Header}${playerData.player.avatar.icon}`
		];

		const visibleCharacters = playerData.characters.slice(
			0,
			Math.min(playerData.characters.length, 8)
		);
		imageUrls.push(
			...visibleCharacters.map(char => `${image_Header}${char.preview}`)
		);

		const visibleActivities = playerActivity?.info?.slice(0, 5) || [];
		imageUrls.push(
			...visibleActivities.map(
				activity => `${image_Header}${activity.content.icon}`
			)
		);

		const allImages = await Promise.all(imageUrls.map(loadImageAsync));

		const bg = allImages[0]?.image;
		const avatar = allImages[1]?.image;
		const charImages = allImages
			.slice(2, 2 + visibleCharacters.length)
			.map(img => img?.image);
		const playerActivityIcons = allImages
			.slice(2 + visibleCharacters.length)
			.map(img => img?.image);

		if (bg) {
			ctx.drawImage(bg, 0, 0, 1920, 1080);
		}

		if (avatar) {
			ctx.drawImage(avatar, 896, 70, 128, 128);
		}

		const setupMainFont = (size, isBold = false) => {
			ctx.font = `${isBold ? "bold " : ""}${size}px 'YaHei', 'URW DIN Arabic', Arial, sans-serif`;
		};

		const setupNumberFont = (size, isBold = false) => {
			ctx.font = `${isBold ? "bold " : ""}${size}px 'URW DIN Arabic', Arial, sans-serif`;
		};

		setupMainFont(40, true);
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, 960, 260);

		setupNumberFont(24);
		ctx.fillStyle = "lightgray";
		ctx.fillText(playerData.player.uid, 960, 300);

		const xRange = {
			start: 610,
			end: 1300
		};

		const profileStatsData = [
			{
				labelText: tr("profile_TrailblazeLevel"),
				valueText: `${playerData.player.level}`
			},
			{
				labelText: tr("profile_EquilibriumLevel"),
				valueText: `${playerData.player.world_level}`
			},
			{
				labelText: tr("profile_CharactersCount"),
				valueText: `${playerData.player.space_info.avatar_count}`
			},
			{
				labelText: tr("profile_AchievementsCount"),
				valueText: `${playerData.player.space_info.achievement_count}`
			}
		];

		function calculatePositions(statsData, xRange) {
			const count = statsData.length;

			if (count === 1) {
				const centerX = (xRange.start + xRange.end) / 2;
				return [
					{
						labelX: centerX,
						labelY: 355,
						valueX: centerX,
						valueY: 400
					}
				];
			}

			const totalWidth = xRange.end - xRange.start;
			const spacing = totalWidth / (count - 1);

			return statsData.map((stat, index) => {
				const x = xRange.start + spacing * index;
				return {
					...stat,
					labelX: x,
					labelY: 355,
					valueX: x,
					valueY: 400
				};
			});
		}

		const profileStats = calculatePositions(profileStatsData, xRange);
		ctx.fillStyle = "white";

		profileStats.forEach(stat => {
			setupMainFont(30, true);
			ctx.fillText(stat.labelText, stat.labelX, stat.labelY);
		});

		profileStats.forEach(stat => {
			setupNumberFont(32);
			ctx.fillText(stat.valueText, stat.valueX, stat.valueY);
		});

		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(560, 435);
		ctx.lineTo(1360, 435);
		ctx.stroke();

		const width =
			(920 + (playerData.characters.length - 4) * 230) /
			playerData.characters.length;

		const characterRenderData = visibleCharacters.map((char, i) => {
			const x =
				520 - (playerData.characters.length - 4) * 115 + i * width;
			const y = 716;
			return { char, x, y, image: charImages[i] };
		});

		characterRenderData.forEach(data => {
			if (data.image) {
				ctx.drawImage(data.image, data.x, 460, 187, 256);
			}
		});

		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		characterRenderData.forEach(data => {
			const { x, y } = data;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + 56);
			ctx.quadraticCurveTo(x, y + 76, x + 20, y + 76);
			ctx.lineTo(x + 167, y + 76);
			ctx.quadraticCurveTo(x + 187, y + 76, x + 187, y + 56);
			ctx.lineTo(x + 187, y);
			ctx.closePath();
			ctx.fill();
		});

		setupMainFont(28, true);
		characterRenderData.forEach(data => {
			const { char, x, y } = data;
			ctx.fillStyle = char.pos <= 2 ? "#FFD89C" : "white";
			ctx.fillText(char.name, x + 93, y + 35);
		});

		setupMainFont(20);
		characterRenderData.forEach(data => {
			const { char, x, y } = data;
			ctx.fillText(
				tr("level_Format", { level: char.level }),
				x + 93,
				y + 65
			);
		});

		// Line2
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(560, 817);
		ctx.lineTo(1360, 817);
		ctx.stroke();

		// Records
		ctx.font = "bold 30px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "white";
		ctx.fillText(tr("profile_Records"), 960, 860);

		const records = [];
		const chaosRecords = playerActivity?.info || [];

		records?.forEach((record, index) => {
			ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
			ctx.textAlign = "left";
			ctx.fillText(record.label, 720, 900 + index * 40);
			ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif'";
			ctx.textAlign = "right";
			ctx.fillText(record.value, 1200, 900 + index * 40);
		});

		const iconPositions = chaosRecords?.map(record => {
			const recordTextWidth = ctx.measureText(record.text).width;
			return 980 - recordTextWidth / 2;
		});

		const minIconX = Math.min(...iconPositions);

		chaosRecords?.forEach((record, index) => {
			ctx.textAlign = "center";
			ctx.font = "bold 24px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
			ctx.fillText(record.text, 980, 910 + index * 40);

			const recordIcon = playerActivityIcons[index];
			if (recordIcon) {
				ctx.drawImage(recordIcon, minIconX, 880 + index * 40, 40, 40);
			}
		});

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error(`MainPage Error: ${error}`);
		return null;
	}
}

async function drawCharacterImage(
	tr,
	playerData,
	character,
	isAllCharacter = false
) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		if (isAllCharacter) {
		}

		const characterElementIcon =
			character.element.icon?.toLowerCase() ||
			`element/${character.element}.png`;
		const characterPathIcon =
			character.path?.icon.toLowerCase() ||
			`icon/path/${pathMap[character.base_type]}.png`;

		const imagePaths = [
			"./src/assets/image/warp/bg.jpg",
			`./src/assets/image/${characterElementIcon}`,
			`./src/assets/image/${characterPathIcon}`,
			`./src/assets/image/icon/deco/Star${character.rarity == 5 ? "5" : "4"}.png`
		];

		const allRelics = [
			...(character.relics || []),
			...(character.ornaments || [])
		];

		const relicImagePaths = allRelics.map(relic =>
			isAllCharacter ? relic.icon : image_Header + relic.icon
		);

		imagePaths.push(...relicImagePaths);

		// 加载基础图片
		const imageResults = await Promise.all(imagePaths.map(loadImageAsync));
		const [bg, element, path, star, ...relicImages] = imageResults.map(
			result => result?.image
		);

		// 单独处理角色图片，支持备选方案
		const characterImageUrl = character?.portrait
			? image_Header + character.portrait
			: `${image_Header}/image/character_portrait/${character.id}.png`;
		const characterFallbackUrl = character?.image || null;

		const characterImageResult = await loadImageAsync(
			characterImageUrl,
			characterFallbackUrl
		);

		if (bg) {
			ctx.drawImage(bg, 0, 0, 1920, 1080);
		}

		if (characterImageResult.image) {
			if (characterImageResult.usedFallback) {
				ctx.drawImage(
					characterImageResult.image,
					600,
					-50,
					characterImageResult.image.width / 1.5,
					characterImageResult.image.height / 1.5
				);
			} else {
				ctx.drawImage(characterImageResult.image, 475, 0, 768, 768);
			}
		}

		const setupFont = (
			size,
			isBold = false,
			fontFamily = "'YaHei', 'URW DIN Arabic', Arial, sans-serif'"
		) => {
			ctx.font = `${isBold ? "bold " : ""}${size}px ${fontFamily}`;
		};

		const maxWidth = 200;
		let minFontSize = 30;
		let maxFontSize = 44;
		let fontSize = maxFontSize;

		ctx.fillStyle = "white";
		ctx.textAlign = "left";

		while (maxFontSize - minFontSize > 1) {
			fontSize = Math.floor((minFontSize + maxFontSize) / 2);
			setupFont(fontSize, true);
			const textWidth = ctx.measureText(character.name).width;

			if (textWidth > maxWidth) {
				maxFontSize = fontSize;
			} else {
				minFontSize = fontSize;
			}
		}

		setupFont(minFontSize, true);
		ctx.fillText(character.name, 120, 100);
		if (element) {
			ctx.drawImage(element, 50, 50, 64, 64);
		}
		if (path) {
			ctx.drawImage(path, 50, 120, 64, 64);
		}

		setupFont(28, true);
		ctx.fillText(
			character.path?.name || tr(`path_${pathMap[character.base_type]}`),
			130,
			165
		);

		if (star) {
			ctx.drawImage(star, 50, 185, 160, 32);
		}

		ctx.textAlign = "center";

		setupFont(26, true);
		ctx.fillStyle = "#DCC491";
		ctx.fillText(
			`${tr("Eidolon", {
				rank: character.rank
			})}`,
			210,
			270
		);
		ctx.fillStyle = "white";

		setupFont(28, true);
		ctx.fillText(
			`${tr("level")} ${character.level}`,
			210 +
				ctx.measureText(
					`${tr("Eidolon", {
						rank: character.rank
					})}`
				).width +
				20,
			270
		);

		let result = [];
		if (character.attributes) {
			// 合併基礎屬性和額外屬性
			const allAttributes = [
				...character.attributes,
				...character.additions
			];

			// 處理屬性數據，合併相同字段並格式化顯示值
			const attributesWithAdditions = allAttributes
				.filter(attribute => attribute.field)
				.reduce((acc, attribute) => {
					const field = attribute.field;

					if (acc[field]) {
						acc[field].value += attribute.value;
					} else {
						acc[field] = { ...attribute };
					}

					// 格式化顯示值：小於10且非速度屬性顯示百分比，其他顯示整數
					const isPercentage =
						attribute.value < 10 && field !== "spd";
					acc[field].display = isPercentage
						? `${(acc[field].value * 100).toFixed(1)}%`
						: `${Math.floor(acc[field].value)}`;

					return acc;
				}, {});

			result = Object.values(attributesWithAdditions);
		} else {
			result = character.properties.map(property => ({
				name: tr(`property_${propertyMap[property.property_type]}`),
				value: property.final,
				icon: `icon/property/icon${propertyMap[property.property_type]}.png`
			}));
		}

		// 屬性渲染前：
		const filteredAttributes = result.filter(attribute => {
			const v = attribute.display ?? attribute.value ?? attribute.final;
			if (typeof v === "string") {
				return !/^0(\.0+)?%?$/.test(v.trim());
			} else if (typeof v === "number") {
				return v !== 0;
			}
			return true;
		});
		// 上分隔線
		const attrTopY = 315;
		drawSeparatorLine(ctx, 50, 500, attrTopY);
		// 屬性列表
		await renderAttributesList(ctx, filteredAttributes, 50, 340, 45);
		// 下分隔線動態位置
		const attrBottomY = 373 + filteredAttributes.length * 45;
		drawSeparatorLine(ctx, 50, 500, attrBottomY);

		// relics 區塊對齊
		const relics_left_x = 1170;
		const relics_right_x = 1170 + 335 * 2 + 20; // 1860
		const relics_width = relics_right_x - relics_left_x; // 690
		const relics_top_y = 60;
		const relics_height = 220;
		const relics_padding = 20;
		const relics_row_count = Math.ceil((allRelics.length || 0) / 2);
		const relics_bottom_y =
			relics_top_y + relics_row_count * (relics_height + relics_padding);
		const light_cone_gap_top = 5; // 上方間隔

		if (character.light_cone || character.equip) {
			const light_cone_base_x = relics_left_x;
			const light_cone_base_y = relics_bottom_y + light_cone_gap_top;
			const light_cone_width = relics_width;
			const light_cone_height = 280; // 保持原本高度
			const radius = 10;

			// 繪製 lightcone 背景
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(light_cone_base_x + radius, light_cone_base_y);
			ctx.arcTo(
				light_cone_base_x + light_cone_width,
				light_cone_base_y,
				light_cone_base_x + light_cone_width,
				light_cone_base_y + light_cone_height,
				radius
			);
			ctx.arcTo(
				light_cone_base_x + light_cone_width,
				light_cone_base_y + light_cone_height,
				light_cone_base_x,
				light_cone_base_y + light_cone_height,
				radius
			);
			ctx.arcTo(
				light_cone_base_x,
				light_cone_base_y + light_cone_height,
				light_cone_base_x,
				light_cone_base_y,
				radius
			);
			ctx.arcTo(
				light_cone_base_x,
				light_cone_base_y,
				light_cone_base_x + light_cone_width,
				light_cone_base_y,
				radius
			);
			ctx.closePath();
			ctx.clip();
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = "#000";
			ctx.fillRect(
				light_cone_base_x,
				light_cone_base_y,
				light_cone_width,
				light_cone_height
			);
			ctx.restore();
			ctx.globalAlpha = 1;

			const light_coneResult = await loadImageAsync(
				character.equip?.icon ||
					`${image_Header}/icon/light_cone/${character.light_cone?.id}.png`
			);
			const light_cone = light_coneResult?.image;
			// 圖片靠左
			if (light_cone) {
				ctx.drawImage(
					light_cone,
					light_cone_base_x + 50,
					light_cone_base_y + 10,
					128 * 1.25,
					128 * 1.25
				);
			}

			// 文字靠右區域內左側
			ctx.textAlign = "left";
			setupFont(28, true);
			ctx.fillText(
				`${character.light_cone?.name || character.equip?.name}`,
				light_cone_base_x + 30,
				light_cone_base_y + 200
			);

			setupFont(24, true);

			ctx.fillStyle = "white";
			ctx.fillText(
				`${tr("level")} ${character.light_cone?.level || character.equip?.level} ${
					character.light_cone?.promotion
						? `/ ${20 + character.light_cone.promotion * 10}`
						: ""
				}`,
				light_cone_base_x + 30,
				light_cone_base_y + 240
			);
			ctx.fillStyle = "#DCC491";
			ctx.fillText(
				`${tr("lightConeLevel_Format", {
					rank: character.light_cone?.rank || character.equip?.rank
				})}`,
				light_cone_base_x +
					30 +
					ctx.measureText(
						`${tr("level")} ${character.light_cone?.level || character.equip?.level} ${
							character.light_cone?.promotion
								? `/ ${20 + character.light_cone.promotion * 10}`
								: ""
						}`
					).width +
					15,
				light_cone_base_y + 240
			);
			ctx.fillStyle = "white";

			const lightConeEffectData = await fetch(
				image_Header + "index_min/cht/light_cone_ranks.json"
			);
			const lightConeEffect = await lightConeEffectData.json();
			const currentLightConeEffect =
				lightConeEffect[character.light_cone?.id] ||
				lightConeEffect[character.equip?.id];

			if (currentLightConeEffect) {
				const rank =
					character.light_cone?.rank || character.equip?.rank || 1;
				const params = currentLightConeEffect.params[rank - 1];

				if (params) {
					// 創建帶有特殊標記的文本，用於後續顏色處理
					let fixedEffectDesc = currentLightConeEffect.desc
						.replace(/#(\d+)\[i\]/g, (match, p1) => {
							const paramIndex = parseInt(p1) - 1;
							const param = params[paramIndex];
							if (param !== undefined) {
								if (param < 1) {
									const percentage = (param * 100).toFixed(1);
									const displayValue = percentage.endsWith(
										".0"
									)
										? percentage.slice(0, -2)
										: percentage;
									return `[GOLD]${displayValue}%[/GOLD]`;
								} else {
									return `[GOLD]${param}[/GOLD]`;
								}
							}
							return match;
						})
						.replace(/#(\d+)\[f1\]/g, (match, p1) => {
							const paramIndex = parseInt(p1) - 1;
							const param = params[paramIndex];
							if (param !== undefined) {
								const percentage = (param * 100).toFixed(1);
								const displayValue = percentage.endsWith(".0")
									? percentage.slice(0, -2)
									: percentage;
								return `[GOLD]${displayValue}%[/GOLD]`;
							}
							return match;
						});
					// 修正 %% 問題
					fixedEffectDesc = fixedEffectDesc.replace(
						/\[\/GOLD\]%/g,
						"[/GOLD]"
					);

					setupFont(22, true);
					const maxWidth = light_cone_width - 285;
					const lineHeight = 28;
					const segments = parseSegments(fixedEffectDesc);
					const lines = wrapSegments(segments, maxWidth, ctx);
					const totalHeight = lines.length * lineHeight;
					const blockHeight = light_cone_height - 20;
					let currentY =
						light_cone_base_y +
						(blockHeight - totalHeight) / 2 +
						35;
					drawColoredTextLines(
						lines,
						light_cone_base_x + 268,
						currentY,
						lineHeight,
						ctx,
						light_cone_base_y + light_cone_height + 20
					);
				}
			}
		}
		ctx.fillStyle = "white";

		const skillPromises = character.skills
			.map((skill, i) => {
				if (i != 4 && i <= 5) {
					return loadImageAsync(
						skill.item_url || image_Header + skill.icon
					).then(skillImageResult => ({
						skillImage: skillImageResult?.image,
						type_text: skill.type_text || skill.remake,
						level: skill.level
					}));
				}
				return null;
			})
			.filter(Boolean);

		const skills = await Promise.all(skillPromises);

		skills.forEach((skill, index) => {
			if (skill.skillImage) {
				ctx.drawImage(skill.skillImage, 630 + index * 90, 760, 80, 80);
			}
			ctx.textAlign = "center";
			setupFont(18, true);
			ctx.fillText(`${skill.type_text}`, 670 + index * 90, 870);
			setupFont(16, true);
			// 技能等級顏色判斷
			let skillColor = "white";
			if (character.rank >= 3 && (index === 0 || index === 2)) {
				skillColor = "#DCC491";
			}
			if (character.rank >= 5 && (index === 1 || index === 3)) {
				skillColor = "#DCC491";
			}
			ctx.fillStyle = skillColor;
			ctx.fillText(
				`${tr("level")} ${skill.level}`,
				670 + index * 90,
				890
			);
			ctx.fillStyle = "white";
		});

		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(650, 920);
		ctx.lineTo(1030, 920);
		ctx.stroke();

		setupFont(32, true);
		ctx.fillText(playerData.player.nickname, 840, 970);

		setupFont(26);
		ctx.fillStyle = "lightgray";
		ctx.fillText(playerData.player.uid, 840, 1010);

		const relicsScore = await getRelicsScore(character);
		const relicRenderData = await Promise.all(
			allRelics.map(async (relic, i) => {
				// 處理子屬性圖標
				const subAffixIconResults = await Promise.all(
					(relic.sub_affix || relic.properties || []).map(subAff =>
						loadImageAsync(
							`./src/assets/image/${subAff.icon || `icon/property/icon${propertyMap[subAff.property_type]}.png`}`
						)
					)
				);
				const subAffixIcons = subAffixIconResults.map(
					result => result?.image
				);

				// 處理主屬性圖標
				const mainAffixIconResult = await loadImageAsync(
					`./src/assets/image/${relic.main_affix?.icon || `icon/property/icon${propertyMap[relic.main_property?.property_type]}.png`}`
				);

				const rarityIconResult = await loadImageAsync(
					`./src/assets/image/icon/deco/Star${relic.rarity == 5 ? "5" : "4"}.png`
				);
				const mainAffixIcon = mainAffixIconResult?.image;
				const rarityIcon = rarityIconResult?.image;

				return {
					relic,
					index: i,
					icons: {
						main: relicImages[i],
						rarity: rarityIcon,
						mainAffix: mainAffixIcon,
						subAffixes: subAffixIcons
					},
					score: relicsScore ? relicsScore[i] : null
				};
			})
		);

		const width = 335,
			height = 220,
			radius = 10,
			padding = 20;

		relicRenderData.forEach(data => {
			const { relic, index: i, icons, score } = data;

			let row = Math.floor(i / 2);
			let column = i % 2;
			let x = 1170 + column * (width + padding);
			let y = 60 + row * (height + padding);

			ctx.save();
			ctx.beginPath();
			ctx.moveTo(x + radius, y);
			ctx.arcTo(x + width, y, x + width, y + height, radius);
			ctx.arcTo(x + width, y + height, x, y + height, radius);
			ctx.arcTo(x, y + height, x, y, radius);
			ctx.arcTo(x, y, x + width, y, radius);
			ctx.closePath();
			ctx.clip();
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = "#000";
			ctx.fillRect(x, y, width, height);
			ctx.restore();
			ctx.globalAlpha = 1;

			if (icons.main) {
				ctx.drawImage(icons.main, x + 10, y + 20, 96, 96);
			}
			if (icons.rarity) {
				ctx.drawImage(icons.rarity, x + 15, y + 115, 83.78, 16.75);
			}

			setupFont(20, true);
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`+${relic.level}`, x + 55, y + 150);

			const mainAff = relic.main_affix?.weight || 0;
			if (icons.mainAffix) {
				ctx.drawImage(icons.mainAffix, x + 100, y + 15, 40, 40);
			}
			ctx.fillStyle =
				mainAff >= 0.75
					? "#F3B664"
					: mainAff > 0
						? "#FFFFFF"
						: "#B6BBC4";
			ctx.textAlign = "left";

			let lineHeight = 24;
			let text =
				relic.main_affix?.name ||
				tr(
					`property_${relic.main_affix?.propertyName || propertyMap[relic.main_property?.property_type]}`
				);
			if (typeof text !== "string") text = "";

			let lines, words;
			let hasLineBreak = false;
			if (containsChinese(text)) {
				let maxCharsPerLine = 5;
				lines = Math.ceil(text.length / maxCharsPerLine);
				words = Array.from(text);
				for (let j = 0; j < lines; j++) {
					let lineText = words
						.slice(j * maxCharsPerLine, (j + 1) * maxCharsPerLine)
						.join("");
					ctx.fillText(lineText, x + 140, y + 41 + j * lineHeight);
					if (j > 0) hasLineBreak = true;
				}
			} else {
				words = text.split(" ");
				let lineText = "";
				let lineCount = 0;
				let wordCount = 0;
				for (let i = 0; i < words.length; i++) {
					if (words[i].length > 8) {
						if (lineText) {
							ctx.fillText(
								lineText,
								x + 140,
								y + 41 + lineCount * lineHeight
							);
							lineCount++;
						}
						ctx.fillText(
							words[i],
							x + 140,
							y + 41 + lineCount * lineHeight
						);
						lineCount++;
						lineText = "";
						wordCount = 0;
					} else if (
						wordCount < 2 &&
						lineText.length + words[i].length <= 8
					) {
						lineText += (wordCount > 0 ? " " : "") + words[i];
						wordCount++;
					} else {
						ctx.fillText(
							lineText,
							x + 140,
							y + 41 + lineCount * lineHeight
						);
						lineCount++;
						lineText = words[i];
						wordCount = 1;
					}
					if (lineCount > 0) hasLineBreak = true;
				}
				if (lineText)
					ctx.fillText(
						lineText,
						x + 140,
						y + 41 + lineCount * lineHeight
					);
			}

			ctx.textAlign = "right";
			setupFont(20, true);
			ctx.fillText(
				`${relic.main_affix?.display || relic.main_affix?.value || relic.main_property?.value}`,
				x + 320,
				y + 43
			);

			let affixYStart = hasLineBreak ? 75 : 53;
			const maxWidth = 100;
			const initialFontSize = 18;

			(relic.sub_affix || relic.properties || []).forEach(
				(subAffix, subIndex) => {
					if (icons.subAffixes[subIndex]) {
						ctx.drawImage(
							icons.subAffixes[subIndex],
							x + 103,
							y + affixYStart + subIndex * 32,
							32,
							32
						);
					}

					let fontSize = initialFontSize;
					setupFont(fontSize, true);

					const weight = subAffix.weight || 0;
					const color =
						weight >= 0.75
							? "#F3B664"
							: weight > 0
								? "#FFFFFF"
								: "#B6BBC4";
					ctx.fillStyle = color;
					ctx.textAlign = "left";

					const text =
						subAffix.name ||
						tr(
							`property_${subAffix.propertyName || propertyMap[subAffix.property_type]}`
						);
					let textWidth = ctx.measureText(text).width;

					while (textWidth > maxWidth && fontSize > 16) {
						fontSize -= 1;
						setupFont(fontSize, true);
						textWidth = ctx.measureText(text).width;
					}

					ctx.fillText(
						text,
						x + 137,
						y + affixYStart + 23 + subIndex * 32
					);

					ctx.textAlign = "right";
					setupFont(20, true);
					ctx.fillText(
						`${subAffix.display || subAffix.value}`,
						x + 320,
						y + affixYStart + 25 + subIndex * 32
					);

					// 疊層顯示優化
					const count = subAffix.count ?? subAffix.times - 1;
					if (count >= 1) {
						ctx.font =
							"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
						ctx.textAlign = "center";
						ctx.fillText(
							`+${count}`,
							x + 230,
							y + affixYStart + 23 + subIndex * 32
						);
					}
				}
			);

			if (score) {
				setupFont(22, true);
				ctx.fillStyle = `${score.grade.color}`;
				ctx.textAlign = "center";
				ctx.fillText(
					`${score.scoreN} - ${score.grade.grade}`,
					x + 55,
					y + 190
				);
			}
		});

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error("Error generating image:", error);
		return null;
	}
}

async function drawAllCharactersImage(
	tr,
	playerData,
	characters,
	filterInfo = null
) {
	try {
		const canvasWidth = 1920;
		const cardsPerRow = 6;
		const totalRows = Math.ceil(characters.length / cardsPerRow);
		const cardHeight = 100;
		const cardGap = 10;
		const baseY = 230;
		const canvasHeight = baseY + totalRows * (cardHeight + cardGap) + 40;
		const canvas = createCanvas(canvasWidth, canvasHeight);
		const ctx = canvas.getContext("2d");

		// 背景
		const bgResult = await loadImageAsync("./src/assets/image/warp/bg.jpg");
		const bg = bgResult?.image;
		if (bg) {
			ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
		}

		// 左上角頭像
		const avatarResult = await loadImageAsync(
			playerData.player.avatar.icon
		);
		const avatar = avatarResult?.image;
		if (avatar) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(110, 110, 70, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(avatar, 40, 40, 140, 140);
			ctx.restore();
		}

		// 文字資訊
		ctx.textAlign = "left";
		ctx.fillStyle = "white";
		ctx.font = "bold 40px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillText(playerData.player.nickname, 200, 90);
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillText(`UID ${playerData.player.uid}`, 200, 135);
		ctx.fillText(
			`${tr("profile_TrailblazeLevel")} ${playerData.player.level}  ${tr("profile_CharactersCount")} ${characters.length}`,
			200,
			175
		);

		// 分隔線
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(40, 200);
		ctx.lineTo(700, 200);
		ctx.stroke();

		// 顯示篩選和排序狀態
		if (
			filterInfo &&
			(filterInfo.filters.length > 0 || filterInfo.sortType)
		) {
			ctx.textAlign = "left";
			ctx.fillStyle = "rgba(255,255,255,0.8)";
			ctx.font = "bold 20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";

			let statusText = "※ ";
			if (filterInfo.sortType) {
				if (filterInfo.sortType === "sort_level") {
					statusText += tr("profile_SortByLevel");
				} else if (filterInfo.sortType === "sort_eidolon") {
					statusText += tr("profile_SortByEidolon");
				}
			}

			if (filterInfo.filters.length > 0) {
				if (statusText) statusText += " | ";
				const filterLabelMap = {
					physical: tr("element_physical"),
					ice: tr("element_ice"),
					fire: tr("element_fire"),
					lightning: tr("element_lightning"),
					wind: tr("element_wind"),
					quantum: tr("element_quantum"),
					imaginary: tr("element_imaginary"),
					destruction: tr("path_destruction"),
					harmony: tr("path_harmony"),
					erudition: tr("path_erudition"),
					hunt: tr("path_hunt"),
					preservation: tr("path_preservation"),
					nihility: tr("path_nihility"),
					abundance: tr("path_abundance"),
					remembrance: tr("path_remembrance")
				};
				statusText += filterInfo.filters
					.map(f => filterLabelMap[f] || f)
					.join(" / ");
			}

			ctx.fillText(statusText, 720, 205);
		}

		// 角色卡片區域
		const cardWidth = 300;
		const baseX = 20;

		for (let i = 0; i < characters.length; i++) {
			const char = characters[i];
			const col = i % cardsPerRow;
			const row = Math.floor(i / cardsPerRow);
			const x = baseX + col * (cardWidth + cardGap);
			const y = baseY + row * (cardHeight + cardGap);

			// 卡片底色
			ctx.save();
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = "#222";
			ctx.fillRect(x, y, cardWidth, cardHeight);
			ctx.restore();

			// 角色頭像（圓形）
			const iconCenterX = x + 20 + 36;
			const iconCenterY = y + cardHeight / 2;
			const charIconResult = await loadImageAsync(char.icon);
			const charIcon = charIconResult?.image;
			ctx.save();
			ctx.beginPath();
			ctx.arc(iconCenterX, iconCenterY, 36, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			const scale = Math.max((2 * 36) / 168, (2 * 36) / 188);
			const drawW = 168 * scale;
			const drawH = 188 * scale;
			if (charIcon) {
				ctx.drawImage(
					charIcon,
					iconCenterX - drawW / 2,
					iconCenterY - drawH / 2,
					drawW,
					drawH
				);
			}
			ctx.restore();

			// 中間上方：命途icon、屬性icon（加大尺寸）
			const elementIconResult = await loadImageAsync(
				`./src/assets/image/element/${char.element.toLowerCase()}.png`
			);
			const elementIcon = elementIconResult?.image;
			let pathIconPath = null;
			if (char.base_type) {
				const pathName = pathMap[char.base_type] || "none";
				pathIconPath = `./src/assets/image/icon/path/${pathName}.png`;
			} else if (char.path) {
				pathIconPath = `./src/assets/image/icon/path/${char.path.toLowerCase()}.png`;
			} else {
				pathIconPath = `./src/assets/image/icon/path/none.png`;
			}
			const pathIconResult = await loadImageAsync(pathIconPath);
			const pathIcon = pathIconResult?.image;
			if (pathIcon) {
				ctx.drawImage(pathIcon, x + 110, y + 12, 44, 44);
			}
			if (elementIcon) {
				ctx.drawImage(elementIcon, x + 164, y + 12, 44, 44);
			}

			// 中間下方：等級、命座（下移，增加間隔）
			ctx.font = "bold 22px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillStyle = "#fff";
			ctx.textAlign = "left";
			ctx.fillText(`Lv.${char.level}`, x + 110, y + 85);
			ctx.fillStyle = "#DCC491";
			ctx.fillText(`E${char.rank ?? 0}`, x + 175, y + 85);

			// 右側分隔線
			ctx.save();
			ctx.strokeStyle = "rgba(255,255,255,0.3)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(x + cardWidth - 70, y + 10);
			ctx.lineTo(x + cardWidth - 70, y + cardHeight - 10);
			ctx.stroke();
			ctx.restore();

			// 右側武器icon和等級
			if (char.equip && char.equip.icon) {
				const lcIconResult = await loadImageAsync(char.equip.icon);
				const lcIcon = lcIconResult?.image;
				if (lcIcon) {
					ctx.drawImage(
						lcIcon,
						x + cardWidth - 62.5,
						y + 12.5,
						57.5,
						57.5
					);
				}
				ctx.font =
					"bold 18px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
				ctx.fillStyle = "#fff";
				ctx.textAlign = "center";
				ctx.fillText(
					`Lv.${char.equip.level ?? ""}`,
					x + cardWidth - 35,
					y + 85
				);
			}
		}

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error("Error generating all characters image:", error);
		return null;
	}
}

function clearImageCache() {
	if (loadImageAsync.cache) {
		loadImageAsync.cache.clear();
	}
}

function parseSegments(text) {
	const result = [];
	let lastIndex = 0;
	let regex = /\[GOLD\](.*?)\[\/GOLD\]/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			result.push({
				text: text.slice(lastIndex, match.index),
				color: "white"
			});
		}
		result.push({ text: match[1], color: "#DCC491" });
		lastIndex = regex.lastIndex;
	}
	if (lastIndex < text.length) {
		result.push({ text: text.slice(lastIndex), color: "white" });
	}
	return result;
}

function wrapSegments(segments, maxWidth, ctx) {
	const lines = [];
	let currentLine = [];
	let currentLineWidth = 0;
	for (const seg of segments) {
		let segText = seg.text;
		let segColor = seg.color;
		while (segText.length > 0) {
			let fitLength = segText.length;
			let subText = segText;
			// 若本段加上去會超過寬度，則嘗試裁切
			while (
				ctx.measureText(subText).width + currentLineWidth > maxWidth &&
				fitLength > 1
			) {
				fitLength--;
				subText = segText.slice(0, fitLength);
			}
			if (
				ctx.measureText(subText).width + currentLineWidth > maxWidth &&
				currentLine.length > 0
			) {
				// 當前行已滿，換行
				lines.push(currentLine);
				currentLine = [];
				currentLineWidth = 0;
				continue;
			}
			currentLine.push({ text: subText, color: segColor });
			currentLineWidth += ctx.measureText(subText).width;
			segText = segText.slice(fitLength);
			if (segText.length > 0) {
				// 剩下的內容換行
				lines.push(currentLine);
				currentLine = [];
				currentLineWidth = 0;
			}
		}
	}
	if (currentLine.length > 0) lines.push(currentLine);
	return lines;
}

function drawColoredTextLines(lines, x, y, lineHeight, ctx, maxY) {
	for (let i = 0; i < lines.length; i++) {
		if (typeof maxY === "number" && y + lineHeight > maxY) {
			// 超出高度，最後一行加 ...
			const lastLine = lines[i - 1];
			if (lastLine) {
				// 在最後一個 segment 後加 ...
				if (lastLine.length > 0) {
					lastLine[lastLine.length - 1].text += "...";
				} else {
					lastLine.push({ text: "...", color: "white" });
				}
				// 重繪最後一行
				let currentX = x;
				for (const seg of lastLine) {
					ctx.fillStyle = seg.color;
					ctx.fillText(seg.text, currentX, y - lineHeight);
					currentX += ctx.measureText(seg.text).width;
				}
			}
			break;
		}
		let currentX = x;
		for (const seg of lines[i]) {
			ctx.fillStyle = seg.color;
			ctx.fillText(seg.text, currentX, y);
			currentX += ctx.measureText(seg.text).width;
		}
		y += lineHeight;
	}
}

export {
	handleProfileDraw,
	drawMainImage,
	drawCharacterImage,
	drawAllCharactersImage,
	clearImageCache
};
