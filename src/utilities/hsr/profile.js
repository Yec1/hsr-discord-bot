import { client } from "../../index.js";
import {
	requestPlayerData,
	drawInQueueReply,
	getRandomColor
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
		return await loadImage(url);
	} catch {
		return await loadImage(`${image_Header}icon/element/None.png`);
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
			score: relicScore.totalScore
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

		if (
			existingEntryIndex !== -1 &&
			playerEntry.score > leaderboardData.score[existingEntryIndex].score
		)
			leaderboardData.score[existingEntryIndex].score = playerEntry.score;
		else if (existingEntryIndex === -1)
			leaderboardData.score.push(playerEntry);

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

			const imageBuffer = await drawMainImage(tr, playerData);
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

async function drawMainImage(tr, playerData) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		// Load images concurrently
		const [bg, avatar, ...charImages] = await Promise.all([
			loadImageAsync("./src/assets/image/warp/bg.jpg"),
			loadImageAsync(`${image_Header}${playerData.player.avatar.icon}`),
			...playerData.characters.map(char =>
				loadImageAsync(`${image_Header}${char.preview}`)
			)
		]);

		// Background
		ctx.drawImage(bg, 0, 0, 1920, 1080);

		// Avatar
		ctx.drawImage(avatar, 896, 70, 128, 128);

		// Name
		ctx.font = "bold 40px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, 960, 260);

		// UID
		ctx.font = "24px 'URW DIN Arabic', Arial, sans-serif'";
		ctx.fillStyle = "lightgray";
		ctx.fillText(playerData.player.uid, 960, 300);

		// Levels
		ctx.font = "bold 30px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "white";
		ctx.fillText(tr("profile_TrailblazeLevel"), 720, 355);
		ctx.fillText(tr("profile_EquilibriumLevel"), 1200, 355);
		ctx.font = "32px 'URW DIN Arabic', Arial, sans-serif'";
		ctx.fillText(`${playerData.player.level}`, 720, 400);
		ctx.fillText(`${playerData.player.world_level}`, 1200, 400);

		// Line1
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(560, 435);
		ctx.lineTo(1360, 435);
		ctx.stroke();

		// Characters
		const width =
			(920 + (playerData.characters.length - 4) * 230) /
			playerData.characters.length;
		playerData.characters.forEach((char, i) => {
			const x =
				520 - (playerData.characters.length - 4) * 115 + i * width;
			const y = 716;
			const charImage = charImages[i];

			ctx.drawImage(charImage, x, 460, 187, 256);

			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + 56);
			ctx.quadraticCurveTo(x, y + 76, x + 20, y + 76);
			ctx.lineTo(x + 167, y + 76);
			ctx.quadraticCurveTo(x + 187, y + 76, x + 187, y + 56);
			ctx.lineTo(x + 187, y);
			ctx.closePath();
			ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
			ctx.fill();

			ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
			ctx.fillStyle = char.pos <= 2 ? "#FFD89C" : "white";
			ctx.fillText(char.name, x + 93, y + 35);
			ctx.font = "20px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
			ctx.fillText(
				tr("level_Format", { level: char.level }),
				x + 93,
				y + 65
			);
		});

		// Line2
		ctx.beginPath();
		ctx.moveTo(560, 817);
		ctx.lineTo(1360, 817);
		ctx.stroke();

		// Records
		ctx.font = "bold 30px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "white";
		ctx.fillText(tr("profile_Records"), 960, 860);

		// Record details
		const memoryData = playerData.player.space_info.memory_data || {};
		const chaosLevel = memoryData.chaos_level ?? "0";
		const chaosIdStartsWith2 = `${memoryData.chaos_id}`.startsWith("2");
		const chaosMaxLevel = chaosIdStartsWith2 ? "4" : "12";

		const records = [
			{
				label: tr("profile_CharactersCount"),
				value: `${playerData.player.space_info.avatar_count}`
			},
			{
				label: tr("profile_AchievementsCount"),
				value: `${playerData.player.space_info.achievement_count}`
			},
			{
				label: tr("profile_MemoryLevel"),
				value: `${memoryData.level ?? "0"}/21`
			},
			{
				label: chaosIdStartsWith2
					? tr("profile_PureFictionLevel")
					: tr("profile_MemoryLevel"),
				value: `${chaosLevel}/${chaosMaxLevel}`
			}
		];

		records.forEach((record, index) => {
			ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif'";
			ctx.textAlign = "left";
			ctx.fillText(record.label, 720, 900 + index * 40);
			ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif'";
			ctx.textAlign = "right";
			ctx.fillText(record.value, 1200, 900 + index * 40);
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

		// Load images concurrently
		const imagePaths = [
			"./src/assets/image/warp/bg.jpg",
			`./src/assets/image/${character.element.icon.toLowerCase()}`,
			`./src/assets/image/${character.path.icon.toLowerCase()}`,
			`./src/assets/image/icon/deco/Star${character.rarity == 5 ? "5" : "4"}.png`,
			image_Header + character.portrait,
			...character.relics.map(relic => image_Header + relic.icon)
		];
		const [bg, element, path, star, characterImage, ...relicImages] =
			await Promise.all(imagePaths.map(loadImageAsync));

		// BG
		ctx.drawImage(bg, 0, 0, 1920, 1080);

		// Name
		const maxWidth = 200;
		let fontSize = 44;
		ctx.fillStyle = "white";
		ctx.textAlign = "left";

		const tempCanvas = createCanvas(1920, 1080);
		const tempCtx = tempCanvas.getContext("2d");
		tempCtx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif' `;
		let textWidth = tempCtx.measureText(character.name).width;

		while (textWidth > maxWidth && fontSize > 30) {
			fontSize -= 2;
			tempCtx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif' `;
			textWidth = tempCtx.measureText(character.name).width;
		}

		ctx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif' `;
		ctx.fillText(character.name, 120, 100);

		// Element
		ctx.drawImage(element, 50, 50, 64, 64);

		// Path
		ctx.drawImage(path, 50, 120, 64, 64);

		// Path Name
		ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillText(character.path.name, 130, 165);

		// Star
		ctx.drawImage(star, 50, 185, 160, 32);

		// Eidolon
		ctx.font = "bold 26px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.textAlign = "center";
		ctx.fillText(`${tr("Eidolon", { rank: character.rank })}`, 280, 255);

		// Level
		ctx.fillText(
			`${tr("level")} ${character.level} / ${20 + character.promotion * 10}`,
			280,
			295
		);

		// Attributes
		const allAttributes = [...character.attributes, ...character.additions];
		const attributesWithAdditions = allAttributes.reduce(
			(acc, attribute) => {
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
			},
			{}
		);

		const result = Object.values(attributesWithAdditions);
		for (let i = 0; i < result.length; i++) {
			const attributeImage = await loadImageAsync(
				`./src/assets/image/${result[i].icon}`
			);
			ctx.drawImage(attributeImage, 50, 300 + i * 45, 48, 48);

			ctx.font = "bold 24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.textAlign = "left";
			ctx.fillText(`${result[i].name}`, 105, 333 + i * 45);

			ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.textAlign = "right";
			ctx.fillText(`${result[i].display}`, 500, 333 + i * 45);
		}

		// Line1
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(50, 333 + result.length * 45 - 20);
		ctx.lineTo(500, 333 + result.length * 45 - 20);
		ctx.stroke();

		// Light Cone
		if (character.light_cone?.preview) {
			const light_cone = await loadImageAsync(
				image_Header + character.light_cone.preview
			);
			ctx.drawImage(light_cone, 45, result.length * 45 + 330, 256, 300);
		}

		if (character.light_cone?.name) {
			ctx.textAlign = "left";
			ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillText(
				`${character.light_cone.name}`,
				300,
				333 + result.length * 45 + 120
			);
			ctx.font = "bold 22px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "#DCC491";
			ctx.fillText(
				`${tr("lightConeLevel_Format", { rank: character.light_cone.rank })}`,
				300,
				333 + result.length * 45 + 160
			);
			ctx.fillStyle = "white";
			ctx.fillText(
				`${tr("level")} ${character.light_cone.level} / ${20 + character.light_cone.promotion * 10}`,
				300,
				333 + result.length * 45 + 200
			);
		}

		// Character Image
		ctx.drawImage(characterImage, 500, 0, 768, 768);

		// Traces
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
			ctx.font = "bold 18px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillText(`${skill.type_text}`, 670 + index * 90, 870);
			ctx.font = "bold 16px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillText(
				`${tr("level")} ${skill.level}`,
				670 + index * 90,
				890
			);
		});

		// Line2
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(650, 920);
		ctx.lineTo(1030, 920);
		ctx.stroke();

		// Name
		ctx.font = "bold 32px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillText(playerData.player.nickname, 840, 970);

		// uid
		ctx.font = "26px 'URW DIN Arabic', Arial, sans-serif' ";
		ctx.fillStyle = "lightgray";
		ctx.fillText(playerData.player.uid, 840, 1010);

		// Relics
		const relics = character.relics;
		const relicsScore = await getRelicsScore(character);
		const relicPromises = relics.map(async relic => {
			const images = await Promise.all([
				loadImageAsync(image_Header + relic.icon),
				loadImageAsync(
					`./src/assets/image/icon/deco/Star${relic.rarity == 5 ? "5" : "4"}.png`
				),
				loadImageAsync(`./src/assets/image/${relic.main_affix.icon}`),
				...relic.sub_affix.map(subAff =>
					loadImageAsync(`./src/assets/image/${subAff.icon}`)
				)
			]);
			return {
				...relic,
				images
			};
		});

		const loadedRelics = await Promise.all(relicPromises);

		let width = 335,
			height = 220,
			radius = 10,
			padding = 20;

		loadedRelics.forEach((relic, i) => {
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

			// Relic Icon
			ctx.drawImage(relic.images[0], x + 10, y + 20, 96, 96);
			ctx.drawImage(relic.images[1], x + 15, y + 115, 83.78, 16.75);

			// Relic Level
			ctx.font = "bold 20px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`+${relics[i].level}`, x + 55, y + 150);

			// Relic Main Stat
			const mainAff = relics[i].main_affix.weight;
			ctx.drawImage(relic.images[2], x + 100, y + 15, 40, 40);
			ctx.font = "bold 18px 'YaHei', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle =
				mainAff >= 0.75
					? "#F3B664"
					: mainAff > 0
						? "#FFFFFF"
						: "#B6BBC4"; //"#EAB308"; // #FFFFFF
			ctx.textAlign = "left";

			let lineHeight = 24;
			let text = `${relics[i].main_affix.name}`;

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
			ctx.font = "bold 20px 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillText(`${relics[i].main_affix.display}`, x + 320, y + 43);

			let affixYStart = hasLineBreak ? 75 : 53;
			const maxWidth = 100;
			const initialFontSize = 18;

			// Relic Sub Stats
			relic.sub_affix.forEach((subAffix, subIndex) => {
				ctx.drawImage(
					relic.images[subIndex + 3],
					x + 103,
					y + affixYStart + subIndex * 32,
					32,
					32
				);

				let fontSize = initialFontSize;
				ctx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif`;

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
					ctx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
					textWidth = ctx.measureText(text).width;
				}

				ctx.fillText(
					text,
					x + 137,
					y + affixYStart + 23 + subIndex * 32
				);

				ctx.textAlign = "right";
				ctx.font = `bold 20px 'URW DIN Arabic', Arial, sans-serif`;
				ctx.fillText(
					`${subAffix.display}`,
					x + 320,
					y + affixYStart + 25 + subIndex * 32
				);

				ctx.font = `bold 16px 'URW DIN Arabic', Arial, sans-serif`;
				ctx.textAlign = "center";
				ctx.fillText(
					">".repeat(subAffix.count - 1 || 0),
					x + 237,
					y + affixYStart + 25 + subIndex * 32
				);
			});

			// Score
			if (relicsScore) {
				ctx.font = "bold 22px 'URW DIN Arabic', Arial, sans-serif' ";
				ctx.fillStyle = `${relicsScore[i].grade.color}`;
				ctx.textAlign = "center";
				ctx.fillText(
					`${relicsScore[i].scoreN} - ${relicsScore[i].grade.grade}`,
					x + 55,
					y + 190
				);
			}
		});

		ctx.textAlign = "center";
		ctx.fillStyle = "white";
		ctx.font = `bold 36px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
		if (relicsScore) {
			ctx.fillText(
				tr("RelicGrade", {
					grade: `${relicsScore.totalScore}`
				}),
				1480,
				830
			);
			ctx.fillStyle = `${relicsScore.totalGrade.color}`;
			ctx.fillText(
				relicsScore.totalGrade.grade,
				1480 +
					ctx.measureText(
						tr("RelicGrade", {
							grade: `${relicsScore.totalScore}`
						})
					).width -
					155,
				832
			);
		} else {
			ctx.fillText(tr("RelicNoScore"), 1480, 830);
		}

		return canvas.toBuffer("image/png");
	} catch (error) {
		console.error("Error generating image:", error);
	}
}

export { handleProfileDraw, drawMainImage, drawCharacterImage };
