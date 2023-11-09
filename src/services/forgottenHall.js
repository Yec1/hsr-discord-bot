import { join } from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { i18nMixin, toI18nLang } from "./i18n.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

GlobalFonts.registerFromPath(
	join("..", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(join("..", "assets", "Hanyi.ttf"), "Hanyi");

const imageURL =
	"https://act.hoyolab.com/app/community-game-records-sea/images/";

async function indexImage(uid, res, floor, interaction) {
	const tr = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	const canvas = createCanvas(1920, 1080);
	const ctx = canvas.getContext("2d");
	const background = await loadImage(
		imageURL + "abyss_review_bg@pc.faecaa6c.png"
	);
	ctx.drawImage(background, 0, 0, 1920, 1080);

	// Title
	ctx.font =
		"bold 38px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "#FFC870";
	ctx.textAlign = "center";
	ctx.fillText(`${tr("forgottenHall_title")}`, canvas.width / 2, 125);

	// Box1
	const backgroundColor = "rgba(58,8,18,.4)";
	const borderColor = "hsla(0,0%,100%,.4)";
	const borderWidth = 1;

	const box1X = 91;
	const box1Y = 175;
	const box1Width = 1738;
	const box1Height = 144;

	ctx.fillStyle = backgroundColor;
	ctx.fillRect(box1X, box1Y, box1Width, box1Height);

	ctx.strokeStyle = borderColor;
	ctx.lineWidth = borderWidth;
	ctx.strokeRect(box1X, box1Y, box1Width, box1Height);

	const lineX = box1X + (92.39 / 632) * box1Width;
	const lineY = box1Y;
	const lineHeight = box1Height;

	ctx.beginPath();
	ctx.moveTo(lineX, lineY);
	ctx.lineTo(lineX, lineY + lineHeight);
	ctx.stroke();

	const star = await loadImage(imageURL + "star.ae36cf68.png");
	ctx.drawImage(star, 150, 220, 54, 54);

	// Box1 StarNum
	ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(`X ${res.star_num}`, 250, 263);

	// Box1 Floor
	ctx.font = "31px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	ctx.fillText(
		`${tr("forgottenHall_level")}:  ${res.max_floor.replace(
			/<\/?[^>]+(>|$)/g,
			""
		)}`,
		425,
		230
	);

	// Box1 BattleNum
	ctx.font = "31px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "left";
	ctx.fillText(`${tr("forgottenHall_battle")}:  ${res.battle_num}`, 425, 285);

	// Box2
	const borderRadius = 120;
	const bg2Width = 1735;
	const bg2Height = 496;
	const background2 = await loadImage(
		imageURL + "abyss_floor_bg@pc.eb063907.png"
	);

	const box2X = canvas.width / 2 - bg2Width / 2;
	const box2Y = canvas.height / 2 - bg2Height / 2 + 100;

	ctx.beginPath();
	ctx.moveTo(box2X, box2Y);
	ctx.lineTo(box2X + bg2Width - borderRadius, box2Y);
	ctx.quadraticCurveTo(
		box2X + bg2Width,
		box2Y,
		box2X + bg2Width,
		box2Y + borderRadius
	);
	ctx.lineTo(box2X + bg2Width, box2Y + bg2Height);
	ctx.lineTo(box2X, box2Y + bg2Height);
	ctx.lineTo(box2X, box2Y);
	ctx.closePath();

	ctx.fillStyle = backgroundColor;
	ctx.fill();

	ctx.save();
	ctx.clip();
	ctx.drawImage(background2, box2X, box2Y, bg2Width, bg2Height);
	ctx.fillStyle = "rgba(0,0,0,.5)";
	ctx.fillRect(box2X, box2Y, bg2Width, 150);
	ctx.restore();

	ctx.strokeStyle = borderColor;
	ctx.lineWidth = borderWidth;
	ctx.stroke();

	// Box2 name
	ctx.font = "42px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	ctx.fillText(`${floor.name.replace(/<\/?[^>]+(>|$)/g, "")}`, 200, 460);

	// Box2 round_num
	ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "hsla(0,0%,100%,.7)";
	ctx.textAlign = "left";
	ctx.fillText(
		`${tr("forgottenHall_useRound")}:  ${floor.round_num}`,
		200,
		515
	);

	// Box2 star_num
	for (let i = 0; i < floor.star_num; i++)
		ctx.drawImage(star, 1650 - (i * 68 - 3), 435, 68, 68);

	// Box2 node_1 name
	ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	ctx.fillText(
		`${tr("forgottenHall_teamSetup", {
			z: "1"
		})}`,
		200,
		600
	);

	// Box2 node_1 challenge_time
	const time = floor.node_1.challenge_time;
	ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "hsla(0,0%,100%,.7)";
	ctx.textAlign = "left";
	ctx.fillText(
		`${time.year}/${time.month}/${time.day} ${time.hour}:${time.minute}`,
		200 +
			ctx.measureText(`${tr("forgottenHall_teamSetup", { z: "1" })}`)
				.width +
			25,
		600
	);

	// Box2 node_1 avatars
	for (let i = 0; i < floor.node_1.avatars.length; i++) {
		const character = floor.node_1.avatars[i];
		const x = 200 + i * (750 / floor.node_1.avatars.length);
		const y = 650;
		const width = 148;
		const height = 180;

		// Avatar Rarirt BG
		const bg = await loadImage(
			character.rarity == 4
				? imageURL + "character_r_4.24f329b7.png"
				: imageURL + "character_r_5.99d42eb7.png"
		);
		ctx.drawImage(bg, x, y, width, height);

		// Avatar
		const avatar = await loadImage(character.icon);
		ctx.drawImage(avatar, x, y, width, height);

		// Avatar Level BG
		ctx.fillStyle = "black";
		ctx.fillRect(x, y + height - 3 - 31, width, 31);

		// Avatar Level
		ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(
			`${tr("level2", {
				z: `${character.level}`
			})}`,
			x + 74,
			y + height - 7
		);

		// Avatar Element BG
		ctx.beginPath();
		ctx.arc(x + 30, y + 25, 15, 0, 2 * Math.PI);
		ctx.fillStyle = "rgba(0,0,0,.4)";
		ctx.fill();

		// Avatar Element
		let element = imageURL;
		switch (character.element) {
			case "quantum":
				element += "quantum.b713b931.png";
				break;
			case "wind":
				element += "wind.c5b8b8e4.png";
				break;
			case "lightning":
				element += "lightning.1abc9e9c.png";
				break;
			case "fire":
				element += "fire.6c8ad63b.png";
				break;
			case "physical":
				element += "physical.84146aac.png";
				break;
			case "ice":
				element += "ice.7569a93b.png";
				break;
			case "imaginary":
				element += "imaginary.268f4a72.png";
				break;
		}
		const elementImage = await loadImage(element);
		ctx.drawImage(elementImage, x + 16, y + 11, 27, 27);

		// Rank
		if (floor.node_1.avatars[i].rank != 0) {
			const color = "rgba(0, 0, 0, 0.5)";
			const borderRadiusTopLeft = 0;
			const borderRadiusTopRight = 37;
			const borderRadiusBottomLeft = 20;
			const borderRadiusBottomRight = 0;
			const Rwidth = 40;
			const Rheight = 50;

			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x + 110 + borderRadiusTopLeft, y);
			ctx.lineTo(x + 110 + Rwidth - borderRadiusTopRight, y);
			ctx.quadraticCurveTo(
				x + 110 + Rwidth,
				y,
				x + 110 + Rwidth,
				y + borderRadiusTopRight
			);
			ctx.lineTo(x + 110 + Rwidth, y + Rheight - borderRadiusBottomRight);
			ctx.quadraticCurveTo(
				x + 110 + Rwidth,
				y + Rheight,
				x + 110 + Rwidth - borderRadiusBottomRight,
				y + Rheight
			);
			ctx.lineTo(x + 110 + borderRadiusBottomLeft, y + Rheight);
			ctx.quadraticCurveTo(
				x + 110,
				y + Rheight,
				x + 110,
				y + Rheight - borderRadiusBottomLeft
			);
			ctx.lineTo(x + 110, y + borderRadiusTopLeft);
			ctx.quadraticCurveTo(x + 110, y, x + 110 + borderRadiusTopLeft, y);
			ctx.closePath();
			ctx.fill();

			ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`${floor.node_1.avatars[i].rank}`, x + 130, y + 35);
		}
	}

	// Box2 node_2 name
	ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	ctx.fillText(
		`${tr("forgottenHall_teamSetup", {
			z: "2"
		})}`,
		1025,
		600
	);

	// Box2 node_2 challenge_time
	const time2 = floor.node_2.challenge_time;
	ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "hsla(0,0%,100%,.7)";
	ctx.textAlign = "left";
	ctx.fillText(
		`${time2.year}/${time2.month}/${time2.day} ${time2.hour}:${time2.minute}`,
		1025 +
			ctx.measureText(`${tr("forgottenHall_teamSetup", { z: "2" })}`)
				.width +
			25,
		600
	);

	// Box2 node_2 avatars
	for (let i = 0; i < floor.node_2.avatars.length; i++) {
		const character = floor.node_2.avatars[i];
		const x = 1025 + i * (750 / floor.node_2.avatars.length);
		const y = 650;
		const width = 148;
		const height = 180;

		// Avatar Rarirt BG
		const bg = await loadImage(
			character.rarity == 4
				? imageURL + "character_r_4.24f329b7.png"
				: imageURL + "character_r_5.99d42eb7.png"
		);
		ctx.drawImage(bg, x, y, width, height);

		// Avatar
		const avatar = await loadImage(character.icon);
		ctx.drawImage(avatar, x, y, width, height);

		// Avatar Level BG
		ctx.fillStyle = "black";
		ctx.fillRect(x, y + height - 3 - 31, width, 31);

		// Avatar Level
		ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(
			`${tr("level2", {
				z: `${character.level}`
			})}`,
			x + 74,
			y + height - 7
		);

		// Avatar Element BG
		ctx.beginPath();
		ctx.arc(x + 30, y + 25, 15, 0, 2 * Math.PI);
		ctx.fillStyle = "rgba(0,0,0,.4)";
		ctx.fill();

		// Avatar Element
		let element = imageURL;
		switch (character.element) {
			case "quantum":
				element += "quantum.b713b931.png";
				break;
			case "wind":
				element += "wind.c5b8b8e4.png";
				break;
			case "lightning":
				element += "lightning.1abc9e9c.png";
				break;
			case "fire":
				element += "fire.6c8ad63b.png";
				break;
			case "physical":
				element += "physical.84146aac.png";
				break;
			case "ice":
				element += "ice.7569a93b.png";
				break;
			case "imaginary":
				element += "imaginary.268f4a72.png";
				break;
		}
		const elementImage = await loadImage(element);
		ctx.drawImage(elementImage, x + 16, y + 11, 27, 27);

		// Rank
		if (floor.node_2.avatars[i].rank != 0) {
			const color = "rgba(0, 0, 0, 0.5)";
			const borderRadiusTopLeft = 0;
			const borderRadiusTopRight = 37;
			const borderRadiusBottomLeft = 20;
			const borderRadiusBottomRight = 0;
			const Rwidth = 40;
			const Rheight = 50;

			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x + 110 + borderRadiusTopLeft, y);
			ctx.lineTo(x + 110 + Rwidth - borderRadiusTopRight, y);
			ctx.quadraticCurveTo(
				x + 110 + Rwidth,
				y,
				x + 110 + Rwidth,
				y + borderRadiusTopRight
			);
			ctx.lineTo(x + 110 + Rwidth, y + Rheight - borderRadiusBottomRight);
			ctx.quadraticCurveTo(
				x + 110 + Rwidth,
				y + Rheight,
				x + 110 + Rwidth - borderRadiusBottomRight,
				y + Rheight
			);
			ctx.lineTo(x + 110 + borderRadiusBottomLeft, y + Rheight);
			ctx.quadraticCurveTo(
				x + 110,
				y + Rheight,
				x + 110,
				y + Rheight - borderRadiusBottomLeft
			);
			ctx.lineTo(x + 110, y + borderRadiusTopLeft);
			ctx.quadraticCurveTo(x + 110, y, x + 110 + borderRadiusTopLeft, y);
			ctx.closePath();
			ctx.fill();

			ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(`${floor.node_2.avatars[i].rank}`, x + 130, y + 35);
		}
	}

	// Time
	const beginTime = res.begin_time;
	const endTime = res.end_time;
	ctx.font = "26px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
	ctx.fillStyle = "hsla(0,0%,50%,.7)";
	ctx.textAlign = "left";
	ctx.fillText(
		`${tr("forgottenHall_timeFooter")}: ${beginTime.year}/${
			beginTime.month
		}/${beginTime.day} - ${endTime.year}/${endTime.month}/${
			endTime.day
		} • ${uid}`,
		7,
		canvas.height - 13
	);

	return canvas.toBuffer("image/png");
}

export { indexImage };
