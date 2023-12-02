import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { getRelicsScore } from "./relics.js";
import { join } from "path";
import { i18nMixin, toI18nLang } from "./i18n.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "YaHei.ttf"),
	"YaHei"
);

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

async function saveCharacters(playerData) {
	const existingCharacters =
		(await db.get(`profile.${playerData.player.uid}.characters`)) || [];

	const characterMap = new Map(
		existingCharacters.map(character => [character.id, character])
	);

	for (const character of playerData.characters)
		characterMap.set(character.id, character);

	const updatedCharacters = Array.from(characterMap.values());
	if (updatedCharacters.length > 7)
		updatedCharacters.splice(0, updatedCharacters.length - 7);

	await db.set(
		`profile.${playerData.player.uid}.characters`,
		updatedCharacters
	);
}

async function loadCharacters(uid) {
	const allCharacters = (await db.get(`profile.${uid}.characters`)) || [];
	return allCharacters;
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

async function loadImageAsync(url) {
	try {
		return await loadImage(url);
	} catch {
		return await loadImage(image_Header + "icon/element/None.png");
	}
}

async function mainPage(playerData, interaction) {
	try {
		const tr = i18nMixin(
			(await db?.has(`${interaction.user.id}.locale`))
				? await db?.get(`${interaction.user.id}.locale`)
				: toI18nLang(interaction.locale) || "en"
		);
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		// BG
		const bg = await loadImageAsync("./src/assets/bg.jpg");
		ctx.drawImage(bg, 0, 0, 1920, 1080);

		// Avatar
		const avatar = await loadImageAsync(
			image_Header + playerData.player.avatar.icon
		);
		ctx.drawImage(avatar, 896, 70, 128, 128);

		// Name
		ctx.font = "bold 44px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, 960, 260);

		// uid
		ctx.font = "24px 'URW DIN Arabic', Arial, sans-serif' ";
		ctx.fillStyle = "lightgray";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.uid, 960, 300);

		// Level
		ctx.font = "bold 30px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(tr("profile_tLevel"), 720, 355);
		ctx.fillText(tr("profile_qLevel"), 1200, 355);

		ctx.font = "32px 'URW DIN Arabic' , Arial, sans-serif' ";
		ctx.fillText(`${playerData.player.level}`, 720, 400);
		ctx.fillText(`${playerData.player.world_level}`, 1200, 400);

		// Line1
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(560, 435);
		ctx.lineTo(1360, 435);
		ctx.stroke();

		// Characters
		const width = 920 / playerData.characters.length;
		for (let i = 0; i < playerData.characters.length; i++) {
			const x = 520 + i * width;
			const y = 460 + 256;
			const Width = 187;
			const Height = 76;

			const charimage = await loadImageAsync(
				image_Header + playerData.characters[i].preview
			);
			ctx.drawImage(charimage, x, 460, 187, 256);

			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + Height - 20);
			ctx.quadraticCurveTo(x, y + Height, x + 20, y + Height);
			ctx.lineTo(x + Width - 20, y + Height);
			ctx.quadraticCurveTo(
				x + Width,
				y + Height,
				x + Width,
				y + Height - 20
			);
			ctx.lineTo(x + Width, y);
			ctx.lineTo(x, y);
			ctx.closePath();
			ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
			ctx.fill();

			ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = i == 0 ? "#FFD89C" : "white";
			ctx.textAlign = "center";
			ctx.fillText(`${playerData.characters[i].name}`, x + 93, y + 35);
			ctx.font = "20px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillText(
				`${tr("level2", {
					z: playerData.characters[i].level
				})}`,
				x + 93,
				y + 65
			);
		}

		// Line2
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(560, 817);
		ctx.lineTo(1360, 817);
		ctx.stroke();

		// Records
		ctx.font = "bold 30px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(tr("profile_record"), 960, 860);

		ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.textAlign = "left";
		ctx.fillText(tr("profile_characters"), 720, 900);
		ctx.font = "bold 24px 'URW DIN Arabic' , Arial, sans-serif' ";
		ctx.textAlign = "right";
		ctx.fillText(`${playerData.player.space_info.avatar_count}`, 1200, 900);

		ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.textAlign = "left";
		ctx.fillText(tr("profile_achievement"), 720, 940);
		ctx.font = "bold 24px 'URW DIN Arabic' , Arial, sans-serif' ";
		ctx.textAlign = "right";
		ctx.fillText(
			`${playerData.player.space_info.achievement_count}`,
			1200,
			940
		);

		ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("profile_memory")}`, 720, 980);
		ctx.font = "bold 24px 'URW DIN Arabic' , Arial, sans-serif' ";
		ctx.textAlign = "right";
		ctx.fillText(
			`${playerData.player.space_info.memory_data.chaos_level}/21`,
			1200,
			980
		);

		ctx.font = "24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("profile_memoryOfChaos")}`, 720, 1020);
		ctx.font = "bold 24px 'URW DIN Arabic' , Arial, sans-serif' ";
		ctx.textAlign = "right";
		ctx.fillText(
			`${playerData.player.space_info.memory_data.level}/10`,
			1200,
			1020
		);

		return canvas.toBuffer("image/png");
	} catch (e) {
		return null;
	}
}

async function charPage(characters, playerData, num, interaction) {
	try {
		const tr = i18nMixin(
			(await db?.has(`${interaction.user.id}.locale`))
				? await db?.get(`${interaction.user.id}.locale`)
				: toI18nLang(interaction.locale) || "en"
		);
		const character = characters[num];
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");
		// BG
		const bg = await loadImageAsync("./src/assets/bg.jpg");
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
		ctx.fillText(character.name, 50, 100);

		// Element
		const element = await loadImageAsync(
			image_Header + character.element.icon
		);
		ctx.drawImage(
			element,
			50 + ctx.measureText(character.name).width + 20,
			55,
			64,
			64
		);

		// Path
		const path = await loadImageAsync(image_Header + character.path.icon);
		ctx.drawImage(path, 50, 120, 64, 64);

		// Path Name
		ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(character.path.name, 130, 165);

		// Star
		const star = await loadImageAsync(
			image_Header +
				`icon/deco/Star${character.rarity == 5 ? "5" : "4"}.png`
		);
		ctx.drawImage(star, 50, 185, 160, 32);

		// Eidolon
		ctx.font = "bold 26px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(
			`${tr("eidolon", {
				z: character.rank
			})}`,
			280,
			255
		);

		// Level
		ctx.font = "bold 26px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(
			`${tr("level")} ${character.level} / ${
				20 + character.promotion * 10
			}`,
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
					acc[attribute.field].display = `${Math.floor(
						acc[attribute.field].value
					)}`;

				return acc;
			},
			{}
		);

		const result = Object.values(attributesWithAdditions);
		for (let i = 0; i < result.length; i++) {
			// Image
			const attributeImage = await loadImageAsync(
				image_Header + result[i].icon
			);
			ctx.drawImage(attributeImage, 50, 300 + i * 45, 48, 48);

			// Name
			ctx.font = "bold 24px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(`${result[i].name}`, 105, 333 + i * 45);

			// Value
			ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
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
			// LC Name
			ctx.font = "bold 28px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(
				`${character.light_cone.name}`,
				300,
				333 + result.length * 45 + 120
			);
			ctx.font = "bold 22px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "#DCC491";
			ctx.textAlign = "left";
			ctx.fillText(
				`${tr("lightconeLevel", {
					z: character.light_cone.rank
				})}`,
				300,
				333 + result.length * 45 + 160
			);
			ctx.fillStyle = "white";
			ctx.fillText(
				`${tr("level")} ${character.light_cone.level} / ${
					20 + character.light_cone.promotion * 10
				}`,
				300,
				333 + result.length * 45 + 200
			);
		}

		// Character Image
		const characterImage = await loadImageAsync(
			image_Header + character.portrait
		);
		ctx.drawImage(characterImage, 500, 0, 768, 768);

		// Traces
		let xOffset = 0;
		for (let i = 0; i <= 5; i++) {
			if (i != 4) {
				const skillImage = await loadImageAsync(
					image_Header + character.skills[i].icon
				);
				ctx.drawImage(skillImage, 630 + xOffset * 90, 760, 80, 80);

				ctx.font =
					"bold 18px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(
					`${character.skills[i].type_text}`,
					670 + xOffset * 90,
					870
				);
				ctx.font =
					"bold 16px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillText(
					`${tr("level")} ${character.skills[i].level}`,
					670 + xOffset * 90,
					890
				);
				xOffset++;
			}
		}

		// Line2
		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(650, 920);
		ctx.lineTo(1030, 920);
		ctx.stroke();

		// Name
		ctx.font = "bold 32px 'YaHei', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, 840, 970);

		// uid
		ctx.font = "26px 'URW DIN Arabic', Arial, sans-serif' ";
		ctx.fillStyle = "lightgray";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.uid, 840, 1010);

		// Relics
		const relics = await getRelicsScore(character);
		let width = 335,
			height = 220,
			radius = 10,
			padding = 20;

		for (let i = 0; i < relics.length; i++) {
			let row = Math.floor(i / 2);
			let column = i % 2;
			let x = 1180 + column * (width + padding) + padding,
				y = 50 + row * (height + padding) + padding;

			ctx.beginPath();
			ctx.moveTo(x + radius, y);
			ctx.lineTo(x + width - radius, y);
			ctx.arc(
				x + width - radius,
				y + radius,
				radius,
				1.5 * Math.PI,
				2 * Math.PI
			);
			ctx.lineTo(x + width, y + height - radius);
			ctx.arc(
				x + width - radius,
				y + height - radius,
				radius,
				0,
				0.5 * Math.PI
			);
			ctx.lineTo(x + radius, y + height);
			ctx.arc(
				x + radius,
				y + height - radius,
				radius,
				0.5 * Math.PI,
				Math.PI
			);
			ctx.lineTo(x, y + radius);
			ctx.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
			ctx.closePath();

			ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
			ctx.fill();

			const relicImage = await loadImageAsync(
				image_Header + relics[i].icon
			);
			ctx.drawImage(relicImage, x + 10, y + 20, 96, 96);

			const relicStar = await loadImageAsync(
				image_Header +
					`icon/deco/Star${relics[i].rarity == 5 ? "5" : "4"}.png`
			);
			ctx.drawImage(relicStar, x + 15, y + 115, 83.78, 16.75);

			ctx.font = "bold 20px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`+${relics[i].level}`, x + 55, y + 150);

			ctx.font = "bold 22px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = `${relics[i].grade.color}`;
			ctx.textAlign = "center";
			ctx.fillText(
				`${relics[i].scoreN} - ${relics[i].grade.grade}`,
				x + 55,
				y + 190
			);

			const mainAff = relics[i].main_affix.weight;
			const mainAffImage = await loadImageAsync(
				image_Header + relics[i].main_affix.icon
			);
			ctx.drawImage(mainAffImage, x + 100, y + 15, 40, 40);

			ctx.font = "bold 18px 'YaHei', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle =
				mainAff >= 0.75
					? "#F3B664"
					: mainAff > 0
					  ? "#FFFFFF"
					  : "#B6BBC4"; //"#EAB308"; // #FFFFFF
			ctx.textAlign = "left";

			function containsChinese(text) {
				return /[\u4e00-\u9fa5]/.test(text);
			}

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

			for (let j = 0; j < relics[i].sub_affix.length; j++) {
				const subAff = relics[i].sub_affix[j];
				const subAffImage = await loadImageAsync(
					image_Header + subAff.icon
				);
				ctx.drawImage(
					subAffImage,
					x + 103,
					y + affixYStart + j * 32,
					32,
					32
				);

				let fontSize = initialFontSize;
				ctx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif`;

				const weight = subAff.weight;
				const color =
					weight >= 0.75
						? "#F3B664"
						: weight > 0
						  ? "#FFFFFF"
						  : "#B6BBC4";
				ctx.fillStyle = color;
				ctx.textAlign = "left";

				const text = subAff.name;
				let textWidth = ctx.measureText(text).width;

				while (textWidth > maxWidth && fontSize > 16) {
					fontSize -= 1;
					ctx.font = `bold ${fontSize}px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
					textWidth = ctx.measureText(text).width;
				}

				ctx.fillText(text, x + 137, y + affixYStart + 23 + j * 32);

				ctx.textAlign = "right";
				ctx.font = `bold 20px 'URW DIN Arabic', Arial, sans-serif`;
				ctx.fillText(
					`${subAff.display}`,
					x + 320,
					y + affixYStart + 25 + j * 32
				);

				ctx.textAlign = "center";
				ctx.fillText(
					">".repeat(subAff.count - 1 || 0),
					x + 225,
					y + affixYStart + 25 + j * 32
				);
			}
		}

		ctx.textAlign = "center";
		ctx.fillStyle = "white";
		ctx.font = `bold 36px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
		ctx.fillText(
			`${tr("relic", {
				s: `${relics.totalScore}`
			})}`,
			1480,
			830
		);
		ctx.fillStyle = `${relics.totalGrade.color}`;
		ctx.fillText(
			`${relics.totalGrade.grade}`,
			(await db?.has(`${interaction.user.id}.locale`))
				? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
					? 1685
					: 1720
				: interaction.locale == "zh-TW"
				  ? 1685
				  : 1720,
			830
		);

		return canvas.toBuffer("image/png");
	} catch (e) {
		console.log(e);
		return null;
	}
}

export { saveCharacters, loadCharacters, saveLeaderboard, mainPage, charPage };
