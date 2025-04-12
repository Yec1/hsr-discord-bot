import { drawInQueueReply } from "../utilities.js";
import {
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { join } from "path";
import { Logger } from "../core/logger.js";
import Queue from "queue";

const drawQueue = new Queue({ autostart: true });

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "zh-tw.ttf"),
	"Hanyi"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "zh-tw.ttf"),
	"PingFang"
);

const imageCache = new Map();

async function preloadImages() {
	try {
		const imagesToPreload = [
			"./src/assets/image/forgottenhall/normalbg.png",
			"./src/assets/image/forgottenhall/storybg.png",
			"./src/assets/image/forgottenhall/knightbg.png",
			"./src/assets/image/forgottenhall/normalbg2.png",
			"./src/assets/image/forgottenhall/storybg2.png",
			"./src/assets/image/forgottenhall/knightbg2.png",
			"./src/assets/image/forgottenhall/star.png",
			"./src/assets/image/forgottenhall/character4star.png",
			"./src/assets/image/forgottenhall/character5star.png",
			"./src/assets/image/forgottenhall/knightBossNode.png"
		];

		for (const path of imagesToPreload) {
			if (!imageCache.has(path)) {
				const image = await loadImage(path);
				imageCache.set(path, image);
			}
		}
	} catch (error) {
		new Logger("分片").error(`預加載圖像失敗: ${error}`);
	}
}

preloadImages();

async function getCachedImage(path) {
	if (!imageCache.has(path)) {
		try {
			const image = await loadImage(path);
			imageCache.set(path, image);
			return image;
		} catch (error) {
			new Logger("分片").error(`加載圖像失敗 ${path}: ${error}`);
			return null;
		}
	}
	return imageCache.get(path);
}

async function handleForgottenHallDraw(interaction, tr, user, mode, time, hsr) {
	const drawTask = async () => {
		try {
			const requestStartTime = Date.now();
			const res = await hsr.record.forgottenHall(mode, time);

			if (res.has_data == false || !res)
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("forgottenHall_NonData"))
							.setDescription(tr("forgottenHall_NonDataDesc"))
					],
					ephemeral: true
				});

			const floor = res.all_floor_detail[0];
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
											mode === 3
												? tr(
														"forgottenHall_FloorFormat3",
														{
															...commonParams,
															z: `${totalScore}`
														}
													)
												: mode === 2
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

										value: `${user.id}-${mode}-${time}-${i}`
									};
								})
							)
					)
				]
			});
		} catch (error) {
			console.log(error);
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

function drawRoundedRect(
	ctx,
	x,
	y,
	width,
	height,
	radius,
	fill = true,
	stroke = false
) {
	let radiusTopLeft = radius;
	let radiusTopRight = radius;
	let radiusBottomRight = radius;
	let radiusBottomLeft = radius;

	if (Array.isArray(radius)) {
		radiusTopLeft = radius[0] || 0;
		radiusTopRight = radius[1] || 0;
		radiusBottomRight = radius[2] || 0;
		radiusBottomLeft = radius[3] || 0;
	}

	ctx.beginPath();
	ctx.moveTo(x + radiusTopLeft, y);
	ctx.lineTo(x + width - radiusTopRight, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radiusTopRight);
	ctx.lineTo(x + width, y + height - radiusBottomRight);
	ctx.quadraticCurveTo(
		x + width,
		y + height,
		x + width - radiusBottomRight,
		y + height
	);
	ctx.lineTo(x + radiusBottomLeft, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radiusBottomLeft);
	ctx.lineTo(x, y + radiusTopLeft);
	ctx.quadraticCurveTo(x, y, x + radiusTopLeft, y);
	ctx.closePath();

	if (fill) {
		ctx.fill();
	}

	if (stroke) {
		ctx.stroke();
	}
}

async function drawFloorImage(tr, uid, res, mode, floor) {
	try {
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		const bgPath = `./src/assets/image/forgottenhall/${
			mode == 3
				? "knightbg.png"
				: mode == 2
					? "storybg.png"
					: "normalbg.png"
		}`;
		const background = await getCachedImage(bgPath);
		ctx.drawImage(background, 0, 0, 1920, 1080);

		const backgroundColor =
			mode == 3
				? "rgb(190,119,255,.4)"
				: mode == 2
					? "rgb(14, 21, 39,.4)"
					: "rgba(58,8,18,.4)";
		const borderColor = "hsla(0,0%,100%,.4)";
		const borderWidth = 1;

		ctx.font = "bold 38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFC870";
		ctx.textAlign = "center";
		ctx.fillText(
			tr("forgottenHall_Mode" + mode) + tr("forgottenHall_Title"),
			canvas.width / 2,
			125
		);

		const box1X = 91;
		const box1Y = 175;
		const box1Width = 1738;
		const box1Height = 144;

		ctx.fillStyle = mode == 3 ? "rgba(0, 0, 0, .45)" : backgroundColor;
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

		const star = await getCachedImage(
			"./src/assets/image/forgottenhall/star.png"
		);
		ctx.drawImage(star, 150, 220, 54, 54);

		ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(`X ${res.star_num}`, 253, 263);

		ctx.font = "bold 31px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(
			`${tr("forgottenHall_Level")}:  ${floor.name.replace(
				/<\/?[^>]+(>|$)/g,
				""
			)}`,
			425,
			230
		);

		ctx.font = "31px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "left";
		ctx.fillText(
			`${tr("forgottenHall_Battle")}:  ${res.battle_num}`,
			425,
			285
		);

		if (mode == 3) {
			ctx.fillStyle = mode == 3 ? "rgba(0, 0, 0, .45)" : backgroundColor;
			ctx.fillRect(box1X, box1Y + 165, box1Width, box1Height - 50);

			ctx.strokeStyle = borderColor;
			ctx.lineWidth = borderWidth;
			ctx.strokeRect(box1X, box1Y + 165, box1Width, box1Height - 50);

			const lineX = box1X + box1Width / 2;
			const lineY = box1Y + 165;
			const lineHeight = box1Height - 50;

			ctx.beginPath();
			ctx.moveTo(lineX, lineY);
			ctx.lineTo(lineX, lineY + lineHeight);
			ctx.stroke();

			const bossBg = await getCachedImage(
				`./src/assets/image/forgottenhall/knightBossNode.png`
			);

			const upperBoss = await getCachedImage(
				res.groups[0].upper_boss.icon
			);
			const lowerBoss = await getCachedImage(
				res.groups[0].lower_boss.icon
			);

			for (let i = 1; i <= 2; i++) {
				ctx.font =
					"bold 24px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "left";
				ctx.fillText(
					`${tr("forgottenHall_TeamSetup", {
						z: i.toString()
					})}`,
					i == 1 ? box1X + 20 : box1X + box1Width / 2 + 20,
					lineY + 40
				);

				ctx.fillText(
					`${i == 1 ? res.groups[0].upper_boss.name_mi18n : res.groups[0].lower_boss.name_mi18n}`,
					i == 1 ? box1X + 20 : box1X + box1Width / 2 + 20,
					lineY + 75
				);
			}

			ctx.drawImage(
				bossBg,
				box1X + box1Width / 2 - 180,
				lineY + 2,
				174.6,
				90
			);
			ctx.drawImage(
				bossBg,
				box1X + box1Width - 180,
				lineY + 2,
				174.6,
				90
			);
			ctx.drawImage(
				upperBoss,
				box1X + box1Width / 2 - 110,
				lineY + 7,
				80,
				80
			);
			ctx.drawImage(
				lowerBoss,
				box1X + box1Width - 110,
				lineY + 7,
				80,
				80
			);
		}

		const borderRadius = 60;
		const bg2Width = 1735;
		const bg2Height = mode == 2 || mode == 3 ? 546 : 496;
		const bg2Path = `./src/assets/image/forgottenhall/${
			mode == 3
				? "knightbg2.png"
				: mode == 2
					? "storybg2.png"
					: "normalbg2.png"
		}`;
		const background2 = await getCachedImage(bg2Path);

		const box2X = canvas.width / 2 - bg2Width / 2;
		const box2Y =
			canvas.height / 2 -
			bg2Height / 2 +
			(mode == 3 ? 190 : mode == 2 ? 125 : 100);

		ctx.fillStyle = backgroundColor;
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			borderRadius,
			true,
			false
		);

		ctx.save();
		ctx.beginPath();
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			borderRadius,
			false,
			false
		);
		ctx.clip();
		ctx.drawImage(background2, box2X, box2Y, bg2Width, bg2Height);
		ctx.fillStyle = "rgba(0,0,0,.5)";
		ctx.fillRect(box2X, box2Y, bg2Width, 150);
		ctx.restore();

		ctx.strokeStyle = borderColor;
		ctx.lineWidth = borderWidth;
		ctx.beginPath();
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			borderRadius,
			false,
			true
		);

		ctx.font = "bold 42px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(
			`${floor.name.replace(/<\/?[^>]+(>|$)/g, "")}`,
			200,
			mode == 3 ? 460 + 65 : 460
		);

		ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "hsla(0,0%,100%,.7)";
		ctx.textAlign = "left";

		if (mode == 2) {
			const forgottenHallUseRoundText = `${tr(
				"forgottenHall_UseRound"
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
				`${tr("TotalScore")}`,
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
					ctx.measureText(`${tr("TotalScore")}`).width +
					90,
				forgottenHallUseRoundY + 1.5
			);
		} else if (mode == 3) {
			ctx.fillStyle = "hsla(0,0%,100%,.7)";
			ctx.fillText(`${tr("TotalScore")}`, 200, 515 + 65);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${
					parseInt(floor.node_1.score) + parseInt(floor.node_2.score)
				}`,
				200 + ctx.measureText(tr("TotalScore")).width + 40,
				515 + 1.5 + 65
			);
		} else {
			ctx.fillText(
				`${tr("forgottenHall_UseRound")}:  ${floor.round_num}`,
				200,
				515
			);
		}

		for (let i = 0; i < floor.star_num; i++)
			ctx.drawImage(
				star,
				1650 - (i * 68 - 3),
				mode == 3 ? 435 + 65 : 435,
				68,
				68
			);

		const char4StarBg = await getCachedImage(
			"./src/assets/image/forgottenhall/character4star.png"
		);
		const char5StarBg = await getCachedImage(
			"./src/assets/image/forgottenhall/character5star.png"
		);

		const elementIcons = new Map();

		for (let i = 1; i <= 2; i++) {
			const x = i == 1 ? 200 : 1025;
			const y = mode == 3 ? 600 + 65 : 600;
			const node = floor[`node_${i}`];

			ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(
				`${tr("forgottenHall_TeamSetup", {
					z: i.toString()
				})}`,
				x,
				y
			);

			if (mode == 2 || mode == 3) {
				ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "hsla(0,0%,100%,.7)";
				ctx.textAlign = "left";
				ctx.fillText(
					`${tr("Score")}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_TeamSetup", {
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
							`${tr("forgottenHall_TeamSetup", {
								z: i.toString()
							})}`
						).width +
						ctx.measureText(`${tr("Score")}`).width +
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
							`${tr("forgottenHall_TeamSetup", {
								z: i.toString()
							})}`
						).width +
						25,
					y
				);
			}

			const avatarPromises = node.avatars.map(character =>
				getCachedImage(character.icon)
			);
			const avatarImages = await Promise.all(avatarPromises);

			for (let j = 0; j < node.avatars.length; j++) {
				const character = node.avatars[j];
				const avatarX = x + j * (750 / node.avatars.length);
				const avatarY = mode == 3 ? 630 + 65 : 630;
				const avatarWidth = 148;
				const avatarHeight = 180;

				const bg = character.rarity == 4 ? char4StarBg : char5StarBg;
				ctx.drawImage(bg, avatarX, avatarY, avatarWidth, avatarHeight);

				const avatar = avatarImages[j];
				ctx.drawImage(
					avatar,
					avatarX,
					avatarY,
					avatarWidth,
					avatarHeight
				);

				ctx.fillStyle = "hsla(0,0%,0%,.9)";
				ctx.fillRect(
					avatarX,
					avatarY + avatarHeight - 3 - 31,
					avatarWidth,
					31
				);

				ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(
					`${tr("level_Format", {
						level: `${character.level}`
					})}`,
					avatarX + 74,
					avatarY + avatarHeight - 7
				);

				ctx.beginPath();
				ctx.arc(avatarX + 30, avatarY + 25, 15, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				if (!elementIcons.has(character.element)) {
					const elementImage = await getCachedImage(
						`./src/assets/image/element/${character.element}.png`
					);
					elementIcons.set(character.element, elementImage);
				}
				const elementImage = elementIcons.get(character.element);
				ctx.drawImage(elementImage, avatarX + 16, avatarY + 11, 27, 27);

				if (character.rank != 0) {
					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					const rankX = avatarX + 110;
					const rankY = avatarY;
					const rankWidth = 40;
					const rankHeight = 50;

					ctx.beginPath();
					ctx.moveTo(rankX, rankY);
					ctx.lineTo(rankX + rankWidth - 37, rankY);
					ctx.quadraticCurveTo(
						rankX + rankWidth,
						rankY,
						rankX + rankWidth,
						rankY + 37
					);
					ctx.lineTo(rankX + rankWidth, rankY + rankHeight);
					ctx.lineTo(rankX + 20, rankY + rankHeight);
					ctx.quadraticCurveTo(
						rankX,
						rankY + rankHeight,
						rankX,
						rankY + rankHeight - 20
					);
					ctx.lineTo(rankX, rankY);
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

			if (mode == 2 || mode == 3) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
				ctx.fillRect(x, y + 240, 710, 70);

				ctx.textAlign = "left";
				ctx.fillStyle = "rgb(249, 200, 126)";
				ctx.fillText(
					tr(mode == 2 ? "Cacophony" : "Finality"),
					x + 20,
					y + 285
				);

				ctx.beginPath();
				ctx.arc(x + 215, y + 274, 28, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				if (node.buff) {
					const buffImage = await getCachedImage(node.buff.icon);
					ctx.drawImage(buffImage, x + 187.5, y + 245, 56, 56);

					ctx.fillStyle = "lightgray";
					ctx.fillText(`${node.buff.name_mi18n}`, x + 257.5, y + 285);
				}
			}
		}

		const beginTime = res?.begin_time ?? res.groups[0].begin_time;
		const endTime = res?.end_time ?? res.groups[0].end_time;
		const schedule_id = res?.schedule_id ?? res.groups[0].schedule_id;
		ctx.font = "bold 26px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "hsla(0,0%,50%,.7)";
		ctx.textAlign = "left";
		ctx.fillText(
			`#${schedule_id} ${tr("forgottenHall_TimeFooter")}: ${
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

export { handleForgottenHallDraw, drawFloorImage };
