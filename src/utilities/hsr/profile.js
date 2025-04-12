import { client } from "../../index.js";
import {
	requestPlayerData,
	drawInQueueReply,
	getRandomColor,
	requestPlayerActivity
} from "../utilities.js";
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

const loadImageAsync = async url => {
	try {
		if (!loadImageAsync.cache) loadImageAsync.cache = new Map();

		if (loadImageAsync.cache.has(url)) {
			return loadImageAsync.cache.get(url);
		}

		const image = await loadImage(url);
		loadImageAsync.cache.set(url, image);
		return image;
	} catch {
		const defaultUrl = `${image_Header}icon/character/None.png`;
		if (!loadImageAsync.cache.has(defaultUrl)) {
			const defaultImage = await loadImage(defaultUrl);
			loadImageAsync.cache.set(defaultUrl, defaultImage);
		}
		return loadImageAsync.cache.get(defaultUrl);
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

async function handleProfileDraw(interaction, tr, user, uid) {
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
			const { status, playerData } = await requestPlayerData(
				uid,
				interaction
			);
			const { activityStatus, playerActivity } =
				await requestPlayerActivity(uid, interaction);

			if (status !== 200) {
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(
								tr("profile_UidNotFound", { uid: `\`${uid}\`` })
							)
							.setColor("#E76161")
							.setThumbnail(
								"https://media.discordapp.net/attachments/1231256542419095623/1246728242052989053/Trailblazer_female.png"
							)
					],
					fetchReply: true
				});
			}

			saveLeaderboard(playerData);

			const requestEndTime = Date.now();
			const characters = playerData.characters;
			const drawStartTime = Date.now();

			const imageBuffer = await drawMainImage(
				tr,
				playerData,
				playerActivity
			);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `MainPage_${playerData.player.uid}.png`
			});

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: user.username,
							iconURL: user.displayAvatarURL({
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
								characters.map((character, i) => {
									return {
										emoji: emoji[
											character.element.id.toLowerCase()
										],
										label: `${character.name}`,
										value: `${playerData.player.uid}-${user.id}-${i}`
									};
								})
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

		const bg = allImages[0];
		const avatar = allImages[1];
		const charImages = allImages.slice(2, 2 + visibleCharacters.length);
		const playerActivityIcons = allImages.slice(
			2 + visibleCharacters.length
		);

		ctx.drawImage(bg, 0, 0, 1920, 1080);

		ctx.drawImage(avatar, 896, 70, 128, 128);

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
			ctx.drawImage(data.image, data.x, 460, 187, 256);
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
			recordIcon &&
				ctx.drawImage(recordIcon, minIconX, 880 + index * 40, 40, 40);
		});

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error(`MainPage Error: ${error}`);
		return null;
	}
}

async function drawCharacterImage(tr, playerData, character) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		const imagePaths = [
			"./src/assets/image/warp/bg.jpg",
			`./src/assets/image/${character.element.icon.toLowerCase()}`,
			`./src/assets/image/${character.path.icon.toLowerCase()}`,
			`./src/assets/image/icon/deco/Star${character.rarity == 5 ? "5" : "4"}.png`,
			image_Header + character.portrait
		];

		const relicImagePaths = character.relics.map(
			relic => image_Header + relic.icon
		);
		imagePaths.push(...relicImagePaths);

		const [bg, element, path, star, characterImage, ...relicImages] =
			await Promise.all(imagePaths.map(loadImageAsync));

		ctx.drawImage(bg, 0, 0, 1920, 1080);

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

		ctx.drawImage(element, 50, 50, 64, 64);

		ctx.drawImage(path, 50, 120, 64, 64);

		setupFont(28, true);
		ctx.fillText(character.path.name, 130, 165);

		ctx.drawImage(star, 50, 185, 160, 32);

		setupFont(26, true);
		ctx.textAlign = "center";
		ctx.fillText(`${tr("Eidolon", { rank: character.rank })}`, 280, 255);

		setupFont(28, true);
		ctx.fillText(
			`${tr("level")} ${character.level} / ${20 + character.promotion * 10}`,
			280,
			295
		);

		const allAttributes = [...character.attributes, ...character.additions];
		const attributesWithAdditions = allAttributes
			.filter(attribute => attribute.field)
			.reduce((acc, attribute) => {
				if (acc[attribute.field])
					acc[attribute.field].value += attribute.value;
				else acc[attribute.field] = { ...attribute };

				if (attribute.value < 10 && attribute.field != "spd")
					acc[attribute.field].display =
						(acc[attribute.field].value * 100).toFixed(1) + "%";
				else
					acc[attribute.field].display =
						`${Math.floor(acc[attribute.field].value)}`;

				return acc;
			}, {});

		const result = Object.values(attributesWithAdditions);
		for (let i = 0; i < result.length; i++) {
			const attributeImage = await loadImageAsync(
				`./src/assets/image/${result[i].icon}`
			);
			ctx.drawImage(attributeImage, 50, 300 + i * 45, 48, 48);

			setupFont(24, true);
			ctx.textAlign = "left";
			ctx.fillText(`${result[i].name}`, 105, 333 + i * 45);

			setupFont(24, true);
			ctx.textAlign = "right";
			ctx.fillText(`${result[i].display}`, 500, 333 + i * 45);
		}

		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(50, 333 + result.length * 45 - 20);
		ctx.lineTo(500, 333 + result.length * 45 - 20);
		ctx.stroke();

		if (character.light_cone?.preview) {
			const light_cone = await loadImageAsync(
				image_Header + character.light_cone.preview
			);
			ctx.drawImage(light_cone, 45, result.length * 45 + 330, 256, 300);
		}

		if (character.light_cone?.name) {
			ctx.textAlign = "left";
			setupFont(28, true);
			ctx.fillText(
				`${character.light_cone.name}`,
				300,
				333 + result.length * 45 + 120
			);
			setupFont(22, true);
			ctx.fillStyle = "#DCC491";
			setupFont(22, true);
			ctx.fillText(
				`${tr("lightConeLevel_Format", { rank: character.light_cone.rank })}`,
				300,
				333 + result.length * 45 + 160
			);
			setupFont(22);
			ctx.fillStyle = "white";
			setupFont(22);
			ctx.fillText(
				`${tr("level")} ${character.light_cone.level} / ${20 + character.light_cone.promotion * 10}`,
				300,
				333 + result.length * 45 + 200
			);
		}

		ctx.drawImage(characterImage, 500, 0, 768, 768);

		const skillPromises = character.skills
			.map((skill, i) => {
				if (i != 4 && i <= 5) {
					return loadImageAsync(image_Header + skill.icon).then(
						skillImage => ({
							skillImage,
							type_text: skill.type_text,
							level: skill.level
						})
					);
				}
				return null;
			})
			.filter(Boolean);

		const skills = await Promise.all(skillPromises);

		skills.forEach((skill, index) => {
			ctx.drawImage(skill.skillImage, 630 + index * 90, 760, 80, 80);
			ctx.textAlign = "center";
			setupFont(18, true);
			ctx.fillText(`${skill.type_text}`, 670 + index * 90, 870);
			setupFont(16, true);
			ctx.fillText(
				`${tr("level")} ${skill.level}`,
				670 + index * 90,
				890
			);
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

		const relics = character.relics;
		const relicsScore = await getRelicsScore(character);

		const relicRenderData = await Promise.all(
			relics.map(async (relic, i) => {
				const subAffixIcons = await Promise.all(
					relic.sub_affix.map(subAff =>
						loadImageAsync(`./src/assets/image/${subAff.icon}`)
					)
				);

				const mainAffixIcon = await loadImageAsync(
					`./src/assets/image/${relic.main_affix.icon}`
				);
				const rarityIcon = await loadImageAsync(
					`./src/assets/image/icon/deco/Star${relic.rarity == 5 ? "5" : "4"}.png`
				);

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

			ctx.drawImage(icons.main, x + 10, y + 20, 96, 96);
			ctx.drawImage(icons.rarity, x + 15, y + 115, 83.78, 16.75);

			setupFont(20, true);
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`+${relic.level}`, x + 55, y + 150);

			const mainAff = relic.main_affix.weight;
			ctx.drawImage(icons.mainAffix, x + 100, y + 15, 40, 40);
			ctx.fillStyle =
				mainAff >= 0.75
					? "#F3B664"
					: mainAff > 0
						? "#FFFFFF"
						: "#B6BBC4";
			ctx.textAlign = "left";

			let lineHeight = 24;
			let text = `${relic.main_affix.name}`;

			let lines, words;
			let hasLineBreak = false;
			if (containsChinese(text)) {
				let maxCharsPerLine = 4;
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
			ctx.fillText(`${relic.main_affix.display}`, x + 320, y + 43);

			let affixYStart = hasLineBreak ? 75 : 53;
			const maxWidth = 100;
			const initialFontSize = 18;

			relic.sub_affix.forEach((subAffix, subIndex) => {
				ctx.drawImage(
					icons.subAffixes[subIndex],
					x + 103,
					y + affixYStart + subIndex * 32,
					32,
					32
				);

				let fontSize = initialFontSize;
				setupFont(fontSize, true);

				const weight = subAffix.weight;
				const color =
					weight >= 0.75
						? "#F3B664"
						: weight > 0
							? "#FFFFFF"
							: "#B6BBC4";
				ctx.fillStyle = color;
				ctx.textAlign = "left";

				const text = subAffix.name;
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
					`${subAffix.display}`,
					x + 320,
					y + affixYStart + 25 + subIndex * 32
				);

				setupFont(16, true);
				ctx.textAlign = "center";
				ctx.fillText(
					">".repeat(subAffix.count - 1 || 0),
					x + 237,
					y + affixYStart + 25 + subIndex * 32
				);
			});

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

		ctx.textAlign = "left";
		ctx.fillStyle = "white";
		setupFont(36, true);

		const centerX = 1480;

		if (relicsScore) {
			const scoreText = tr("RelicGrade", {
				grade: `${relicsScore.totalScore}`
			});

			const scoreWidth = ctx.measureText(scoreText).width;

			const startX =
				centerX -
				(scoreWidth +
					ctx.measureText(relicsScore.totalGrade.grade).width) /
					2;

			ctx.fillText(scoreText, startX, 830);

			ctx.fillStyle = `${relicsScore.totalGrade.color}`;
			ctx.fillText(
				relicsScore.totalGrade.grade,
				startX + scoreWidth + 10,
				830
			);
		} else {
			ctx.textAlign = "center";
			ctx.fillText(tr("RelicNoScore"), centerX, 830);
		}

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error("Error generating image:", error);
	}
}

function clearImageCache() {
	if (loadImageAsync.cache) {
		loadImageAsync.cache.clear();
	}
}

export {
	handleProfileDraw,
	drawMainImage,
	drawCharacterImage,
	clearImageCache
};
