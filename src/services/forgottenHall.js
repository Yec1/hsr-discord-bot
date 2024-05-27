import { join } from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { Logger } from "../services/logger.js";
import { client } from "../index.js";
const db = client.db;

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "Hanyi.ttf"),
	"Hanyi"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "PingFang-SC-Regular.ttf"),
	"PingFang"
);

async function indexImage(uid, res, mode, floor, tr) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");
		const background = await loadImage(
			`./src/assets/image/forgottenhall/${
				mode == 2 ? "storybg.png" : "normalbg.png"
			}`
		);
		ctx.drawImage(background, 0, 0, 1920, 1080);

		// Title
		ctx.font =
			"bold 38px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFC870";
		ctx.textAlign = "center";
		ctx.fillText(`${tr("forgottenHall_title")}`, canvas.width / 2, 125);

		// Box1
		const backgroundColor =
			mode == 2 ? "rgb(14, 21, 39,.4)" : "rgba(58,8,18,.4)";
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

		const star = await loadImage(
			"./src/assets/image/forgottenhall/star.png"
		);
		ctx.drawImage(star, 150, 220, 54, 54);

		// Box1 StarNum
		ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(`X ${res.star_num}`, 253, 263);

		// Box1 Floor
		ctx.font = "bold 31px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
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
		ctx.fillText(
			`${tr("forgottenHall_battle")}:  ${res.battle_num}`,
			425,
			285
		);

		// Box2
		const borderRadius = 120;
		const bg2Width = 1735;
		const bg2Height = mode == 2 ? 546 : 496;
		const background2 = await loadImage(
			`./src/assets/image/forgottenhall/${
				mode == 2 ? "storybg2.png" : "normalbg2.png"
			}`
		);

		const box2X = canvas.width / 2 - bg2Width / 2;
		const box2Y =
			canvas.height / 2 - bg2Height / 2 + (mode == 2 ? 125 : 100);

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
		ctx.font = "bold 42px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(`${floor.name.replace(/<\/?[^>]+(>|$)/g, "")}`, 200, 460);

		// Box2 round_num
		ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "hsla(0,0%,100%,.7)";
		ctx.textAlign = "left";

		if (mode == 2) {
			const forgottenHallUseRoundText = `${tr(
				"forgottenHall_useRound"
			)}:`;
			const forgottenHallUseRoundX = 200;
			const forgottenHallUseRoundY = 515;

			ctx.fillText(
				forgottenHallUseRoundText,
				forgottenHallUseRoundX,
				forgottenHallUseRoundY
			);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${floor.round_num}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					30,
				forgottenHallUseRoundY + 1.5
			);

			ctx.fillStyle = "hsla(0,0%,100%,.7)";
			ctx.fillText(
				`${tr("totalScore")}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					ctx.measureText(`${floor.round_num}`).width +
					60,
				forgottenHallUseRoundY
			);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${
					parseInt(floor.node_1.score) + parseInt(floor.node_2.score)
				}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					ctx.measureText(`${floor.round_num}`).width +
					ctx.measureText(`${tr("totalScore")}`).width +
					90,
				forgottenHallUseRoundY + 1.5
			);
		} else {
			ctx.fillText(
				`${tr("forgottenHall_useRound")}:  ${floor.round_num}`,
				200,
				515
			);
		}

		// Box2 star_num
		for (let i = 0; i < floor.star_num; i++)
			ctx.drawImage(star, 1650 - (i * 68 - 3), 435, 68, 68);

		// Box2 node_avatars
		for (let i = 1; i <= 2; i++) {
			const x = i == 1 ? 200 : 1025;
			const y = 600;
			const node = floor[`node_${i}`];

			// Box2 node_name
			ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(
				`${tr("forgottenHall_teamSetup", {
					z: i.toString()
				})}`,
				x,
				y
			);

			// Box2 node_challenge_time
			if (mode == 2) {
				ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "hsla(0,0%,100%,.7)";
				ctx.textAlign = "left";
				ctx.fillText(
					`${tr("score")}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_teamSetup", {
								z: i.toString()
							})}`
						).width +
						25,
					y
				);

				ctx.fillStyle = "rgb(249, 200, 126)";
				ctx.fillText(
					`${node.score}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_teamSetup", {
								z: i.toString()
							})}`
						).width +
						ctx.measureText(`${tr("score")}`).width +
						40,
					y + 1.5
				);
			} else {
				const time = node.challenge_time;
				ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "hsla(0,0%,100%,.7)";
				ctx.textAlign = "left";
				ctx.fillText(
					`${time.year}/${time.month}/${time.day} ${time.hour}:${time.minute}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_teamSetup", {
								z: i.toString()
							})}`
						).width +
						25,
					y
				);
			}

			// Box2 node_avatars
			for (let i = 0; i < node.avatars.length; i++) {
				const character = node.avatars[i];
				const avatarX = x + i * (750 / node.avatars.length);
				const avatarY = 630;
				const avatarWidth = 148;
				const avatarHeight = 180;

				// Avatar Rarity BG
				const bg = await loadImage(
					`./src/assets/image/forgottenhall/${
						character.rarity == 4
							? "character4star.png"
							: "character5star.png"
					}`
				);
				ctx.drawImage(bg, avatarX, avatarY, avatarWidth, avatarHeight);

				// Avatar
				const avatar = await loadImage(character.icon);
				ctx.drawImage(
					avatar,
					avatarX,
					avatarY,
					avatarWidth,
					avatarHeight
				);

				// Avatar Level BG
				ctx.fillStyle = "hsla(0,0%,0%,.9)";
				ctx.fillRect(
					avatarX,
					avatarY + avatarHeight - 3 - 31,
					avatarWidth,
					31
				);

				// Avatar Level
				ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(
					`${tr("level2", {
						z: `${character.level}`
					})}`,
					avatarX + 74,
					avatarY + avatarHeight - 7
				);

				// Avatar Element BG
				ctx.beginPath();
				ctx.arc(avatarX + 30, avatarY + 25, 15, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				// Avatar Element
				const elementImage = await loadImage(
					`./src/assets/image/element/${character.element}.png`
				);
				ctx.drawImage(elementImage, avatarX + 16, avatarY + 11, 27, 27);

				// Rank
				if (character.rank != 0) {
					const color = "rgba(0, 0, 0, 0.5)";
					const borderRadiusTopLeft = 0;
					const borderRadiusTopRight = 37;
					const borderRadiusBottomLeft = 20;
					const borderRadiusBottomRight = 0;
					const Rwidth = 40;
					const Rheight = 50;

					ctx.fillStyle = color;
					ctx.beginPath();
					ctx.moveTo(avatarX + 110 + borderRadiusTopLeft, avatarY);
					ctx.lineTo(
						avatarX + 110 + Rwidth - borderRadiusTopRight,
						avatarY
					);
					ctx.quadraticCurveTo(
						avatarX + 110 + Rwidth,
						avatarY,
						avatarX + 110 + Rwidth,
						avatarY + borderRadiusTopRight
					);
					ctx.lineTo(
						avatarX + 110 + Rwidth,
						avatarY + Rheight - borderRadiusBottomRight
					);
					ctx.quadraticCurveTo(
						avatarX + 110 + Rwidth,
						avatarY + Rheight,
						avatarX + 110 + Rwidth - borderRadiusBottomRight,
						avatarY + Rheight
					);
					ctx.lineTo(
						avatarX + 110 + borderRadiusBottomLeft,
						avatarY + Rheight
					);
					ctx.quadraticCurveTo(
						avatarX + 110,
						avatarY + Rheight,
						avatarX + 110,
						avatarY + Rheight - borderRadiusBottomLeft
					);
					ctx.lineTo(avatarX + 110, avatarY + borderRadiusTopLeft);
					ctx.quadraticCurveTo(
						avatarX + 110,
						avatarY,
						avatarX + 110 + borderRadiusTopLeft,
						avatarY
					);
					ctx.closePath();
					ctx.fill();

					ctx.font =
						"28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(
						`${character.rank}`,
						avatarX + 130,
						avatarY + 35
					);
				}
			}

			// Box3 Buff
			if (mode == 2) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
				ctx.fillRect(x, y + 240, 710, 70);

				ctx.textAlign = "left";
				ctx.fillStyle = "rgb(249, 200, 126)";
				ctx.fillText(`${tr("cacophony")}`, x + 20, y + 285);

				ctx.beginPath();
				ctx.arc(x + 235, y + 274, 28, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				if (node.buff) {
					const buffImage = await loadImage(node.buff.icon);
					ctx.drawImage(buffImage, x + 207.5, y + 245, 56, 56);

					ctx.fillStyle = "lightgray";
					ctx.fillText(`${node.buff.name_mi18n}`, x + 277.5, y + 285);
				}
			}
		}

		// Time
		const beginTime = res?.begin_time ?? res.groups[0].begin_time;
		const endTime = res?.end_time ?? res.groups[0].end_time;
		const schedule_id = res?.schedule_id ?? res.groups[0].schedule_id;
		ctx.font = "bold 26px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "hsla(0,0%,50%,.7)";
		ctx.textAlign = "left";
		ctx.fillText(
			`#${schedule_id} ${tr("forgottenHall_timeFooter")}: ${
				beginTime.year
			}/${beginTime.month}/${beginTime.day} - ${endTime.year}/${
				endTime.month
			}/${endTime.day} • ${uid}`,
			7,
			canvas.height - 13
		);

		return canvas.toBuffer("image/png");
	} catch (e) {
		new Logger("分片").error(`ForgottenHall Error: ${e}`);
		return null;
	}
}

export { indexImage };
