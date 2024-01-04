import { writeFileSync } from "fs";
import axios from "axios";
import { join } from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
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
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "Cinzel.ttf"),
	"Cinzel"
);

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

function convertToRoman(num) {
	const romanNumerals = ["I", "II", "III", "IV", "V"];
	return romanNumerals[num - 1];
}

async function loadImageAsync(url) {
	try {
		return await loadImage(url);
	} catch {
		return await loadImage(image_Header + "icon/element/None.png");
	}
}

async function draw(id) {
	const hsr = new HonkaiStarRail({
		cookie:
			(await db.has(`${id}.account`)) &&
			(await db.get(`${id}.account`))[0].cookie
				? (await db.get(`${id}.account`))[0].cookie
				: await db.get(`${id}.cookie`),
		lang: LanguageEnum.TRADIIONAL_CHINESE,
		uid:
			(await db.has(`${id}.account`)) &&
			(await db.get(`${id}.account`))[0].uid
				? (await db.get(`${id}.account`))[0].uid
				: await db.get(`${id}.uid`)
	});

	const characters = await hsr.record.characters();
	const playerData = await player(hsr.uid);
	const canvas = createCanvas(1080, 350 + characters.length * 100);
	const ctx = canvas.getContext("2d");

	// BackGround
	const bgImage = await loadImageAsync("./src/assets/image/warp/bg.jpg");

	const scaleWidth = canvas.width / bgImage.width;
	const scaleHeight = canvas.height / bgImage.height;
	const scale = Math.max(scaleWidth, scaleHeight);
	const offsetX = (canvas.width - bgImage.width * scale) / 2;
	const offsetY = (canvas.height - bgImage.height * scale) / 2;

	ctx.drawImage(
		bgImage,
		offsetX,
		offsetY,
		bgImage.width * scale,
		bgImage.height * scale
	);

	// Player Profile
	if (!playerData.detail) {
		// Avatar
		const playerAvatar = await loadImageAsync(
			image_Header + playerData.player.avatar.icon
		);
		ctx.drawImage(playerAvatar, 480, 30, 128, 128);

		// Name
		ctx.textAlign = "center";
		ctx.fillStyle = "white";
		ctx.font = `bold 36px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
		ctx.fillText(playerData.player.nickname, 540, 205);

		// UID
		ctx.fillStyle = "lightgray";
		ctx.font = "26px 'URW DIN Arabic', Arial, sans-serif' ";
		ctx.fillText(playerData.player.uid, 540, 245);
	}

	let width = 1000,
		height = 60,
		characterRadius = 20,
		padding = 20;

	// Title
	let x = 40,
		y = 270;

	ctx.beginPath();
	ctx.moveTo(x + characterRadius, y);
	ctx.lineTo(x + width - characterRadius, y);
	ctx.arc(
		x + width - characterRadius,
		y + characterRadius,
		characterRadius,
		1.5 * Math.PI,
		2 * Math.PI
	);
	ctx.lineTo(x + width, y + height);
	ctx.lineTo(x, y + height);
	ctx.lineTo(x, y + characterRadius);
	ctx.arc(
		x + characterRadius,
		y + characterRadius,
		characterRadius,
		Math.PI,
		1.5 * Math.PI
	);
	ctx.closePath();

	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	ctx.fill();

	ctx.textAlign = "left";
	ctx.fillStyle = "white";
	ctx.font = `bold 24px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
	ctx.fillText("角色", 70 + x, 310);
	ctx.fillText("等級", 250 + x, 310);
	ctx.fillText("星魂", 350 + x, 310);
	ctx.fillText("遺器", 580 + x, 310);
	ctx.fillText("光錐", 810 + x, 310);
	ctx.fillText("疊影", 910 + x, 310);

	// Characters
	height = 80;
	characterRadius = 10;
	for (let i = 0; i < characters.length; i++) {
		const character = characters[i];
		// BackGround
		let x = 40,
			y = 320 + i * (height + padding) + padding;

		ctx.beginPath();
		ctx.moveTo(x + characterRadius, y);
		ctx.lineTo(x + width - characterRadius, y);
		ctx.arc(
			x + width - characterRadius,
			y + characterRadius,
			characterRadius,
			1.5 * Math.PI,
			2 * Math.PI
		);
		ctx.lineTo(x + width, y + height - characterRadius);
		ctx.arc(
			x + width - characterRadius,
			y + height - characterRadius,
			characterRadius,
			0,
			0.5 * Math.PI
		);
		ctx.lineTo(x + characterRadius, y + height);
		ctx.arc(
			x + characterRadius,
			y + height - characterRadius,
			characterRadius,
			0.5 * Math.PI,
			Math.PI
		);
		ctx.lineTo(x, y + characterRadius);
		ctx.arc(
			x + characterRadius,
			y + characterRadius,
			characterRadius,
			Math.PI,
			1.5 * Math.PI
		);
		ctx.closePath();

		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fill();

		// Character
		// Avatar
		const characterAvatar = await loadImageAsync(character.icon);
		const radius = 32;

		ctx.save();
		ctx.beginPath();
		ctx.arc(45 + x, 40 + y, radius, 0, 2 * Math.PI);
		ctx.clip();
		ctx.drawImage(
			characterAvatar,
			45 + x - radius,
			40 + y - radius,
			radius * 2,
			radius * 2
		);
		ctx.restore();

		// Element
		const elementImage = await loadImageAsync(
			`./src/assets/image/element/${character.element}.png`
		);
		ctx.drawImage(elementImage, 80 + x, 20 + y, 40, 40);

		// Name
		ctx.textAlign = "left";
		ctx.fillStyle = "white";
		ctx.font = `bold 24px 'YaHei', URW DIN Arabic, Arial, sans-serif`;
		ctx.fillText(character.name, 125 + x, 50 + y);

		// Level
		ctx.font = "bold 26px 'URW DIN Arabic', Arial, sans-serif' ";
		ctx.fillText(`${character.level}`, 260 + x, 50 + y);

		// Eidolon
		ctx.fillText(`${character.rank}`, 365 + x, 50 + y);

		// Relic
		async function drawItems(items, x, y, offsetX, ctx) {
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				const itemImage = await loadImageAsync(item.icon);
				ctx.drawImage(itemImage, offsetX + x + i * 57, 15 + y, 55, 55);
			}
		}

		await drawItems(character.relics, x, y, 430, ctx);
		await drawItems(character.ornaments, x, y, 658, ctx);

		// Light Cone
		const lightcone = character.equip;
		if (lightcone) {
			const lightconeImage = await loadImageAsync(lightcone.icon);
			ctx.drawImage(lightconeImage, 795 + x, 5 + y, 72, 72);

			// Eidolon
			ctx.font =
				"bold 26px 'Cinzel', URW DIN Arabic, Arial, sans-serif' ";
			ctx.textAlign = "center";
			const lightconeRank = lightcone.rank;
			ctx.fillText(`${convertToRoman(lightconeRank)}`, 935 + x, 50 + y);
		}
	}

	writeFileSync("result.png", canvas.toBuffer("image/png"));
	console.log("Image generaterd");
}

await db.set(`283946584461410305.account`, [
	{
		uid: "809279679",
		cookie: "_MHYUUID=2322f04c-9a7c-4b02-8dae-e17f414c68db; G_ENABLED_IDPS=google; DEVICEFP_SEED_ID=54d474961c24b712; DEVICEFP_SEED_TIME=1672910669378; ltoken=Te9Zl50043XTb8AEufgeqnqboTYPwlFBwBPIXTkL; ltuid=335281049; account_id=335281049; account_mid_v2=1lyqqlvnog_hy; account_id_v2=335281049; mi18nLang=zh-tw; DEVICEFP=38d7eff5136a6; HYV_LOGIN_PLATFORM_LIFECYCLE_ID={%22value%22:%221ebc4b7f-fae7-4ef6-a3c2-48af89d8a55c%22}; HYV_LOGIN_PLATFORM_OPTIONAL_AGREEMENT={%22content%22:[]}; HYV_LOGIN_PLATFORM_LOAD_TIMEOUT={}; HYV_LOGIN_PLATFORM_TRACKING_MAP={}"
	}
]);
draw("283946584461410305");

async function player(uid, interaction) {
	return await axios
		.get(
			`https://api.mihomo.me/sr_info_parsed/${uid}${
				(await db?.has(`${interaction?.user.id}.locale`))
					? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
						? "?lang=cht"
						: "?lang=en"
					: interaction
						? interaction.locale == "zh-TW"
							? "?lang=cht"
							: "?lang=en"
						: "?lang=cht"
			}`
		)
		.then(response => response.data);
}
