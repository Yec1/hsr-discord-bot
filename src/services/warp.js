import { EmbedBuilder } from "discord.js";
import { i18nMixin, toI18nLang } from "./i18n.js";
import { baseWeapons } from "./Constants.js";
import { join } from "path";
import axios from "axios";
import { client } from "../index.js";
import {
	getRateUpFive,
	getRateUpFour,
	getPoolFiveChar,
	getPoolFiveWeap,
	getPoolFourChar,
	getPoolFourWeap
} from "./parseJSON.js";
import trans from "../assets/translations.json" assert { type: "json" };
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
const db = client.db;

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "Hanyi.ttf"),
	"Hanyi"
);

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

const sleep = time => new Promise(res => setTimeout(res, time));

async function loadImageAsync(url) {
	try {
		return await loadImage(url);
	} catch {
		return await loadImage(image_Header + "icon/element/None.png");
	}
}

async function fetchWarpData(query, id, endId) {
	query.set("gacha_type", id);
	query.set("end_id", endId);

	return axios
		.get(
			"https://api-os-takumi.mihoyo.com/common/gacha_record/api/getGachaLog?" +
				query
		)
		.then(response => response.data);
}

async function warpLog(input, interaction) {
	const tr = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	const type = {
		character: tr("warp_typeCharacter"),
		light_cone: tr("warp_typeLightcone"),
		regular: tr("warp_typeRegular")
	};

	const takumiQuery = new URLSearchParams({
		authkey_ver: 1,
		sign_type: 2,
		game_biz: "hkrpg_global",
		lang: "en",
		authkey: "",
		region: "",
		gacha_type: 0,
		size: 20,
		end_id: 0
	});

	const queryParams = new URLSearchParams(input);
	const authkey = queryParams.get("authkey");
	let region = queryParams.get("region");
	const lastId = queryParams.get("end_id");
	const gachaTypes = { character: 11, light_cone: 12, regular: 1 };

	if (authkey) {
		const query = takumiQuery;
		query.set("authkey", authkey);

		const warps = [];

		for (const [gachaType, id] of Object.entries(gachaTypes)) {
			const res = await fetchWarpData(query, id, 0);
			if (!region) region = res.region;
			query.set("region", region);

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(
							tr("warp_loading", {
								a: type[gachaType]
							})
						)
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});

			let last_id = 0;
			const tempWarps = [];

			while (true) {
				const warpData = await fetchWarpData(query, id, last_id);

				if (warpData && warpData.data) {
					const listLength = warpData.data.list.length - 1;

					if (listLength < 0) break;

					for (const warp of warpData.data.list) {
						if (warp.id == lastId) break;
						tempWarps.push({
							id: warp.item_id,
							name: warp.name.toLowerCase().replaceAll(" ", "_"),
							type: warp.item_type
								.toLowerCase()
								.replaceAll(" ", "_"),
							time: warp.time,
							rank: warp.rank_type
						});
					}

					last_id = warpData.data.list[listLength].id;
					await sleep(500);
				} else break;
			}

			warps.push({
				type: gachaType,
				size: tempWarps.length,
				data: tempWarps
			});
		}

		const list = {
			character: { total: 0, average: 0, pity: 0, data: [] },
			light_cone: { total: 0, average: 0, pity: 0, data: [] },
			regular: { total: 0, average: 0, pity: 0, data: [] }
		};

		for (const warp of warps) {
			const { type: warpType, data: warpData } = warp;
			let total = 0;
			let count = 0;

			for (const index of warpData.reverse()) {
				total++;
				if (index.rank === "5") {
					list[warpType].data.push({
						id: index.id,
						type: index.type,
						name: index.name,
						count: count + 1
					});
					count = 0;
				} else {
					count++;
				}
			}

			const { data } = list[warpType];
			data.reverse();
			list[warpType].pity = count;
			list[warpType].average = data.length
				? parseFloat(
						(
							data.reduce((acc, i) => acc + i.count, 0) /
							data.length
						).toFixed(2)
					)
				: 0;
			list[warpType].total = total;
		}

		return list;
	}
}

const randItem = pool => pool[Math.floor(Math.random() * pool.length)];

const chanceFive = (currentPity, maxPity, softPity, baseRate) => {
	if (currentPity < softPity - 1) return baseRate;
	else {
		const maxVal = 1;
		const steps = maxPity - softPity - 1;
		const currentStep = currentPity - softPity;
		const maxValueReached =
			currentStep >= steps
				? maxVal
				: baseRate + (maxVal - baseRate) * (currentStep / steps);
		return maxValueReached;
	}
};

const chanceFour = (currentPity, baseRate) => {
	return currentPity < 9 ? baseRate : 1;
};

async function warp(vers, type, interaction) {
	const userdb = `${interaction.user.id}.sim`;
	const banner = await db.get(`${userdb}`);
	const warpChance = Math.random();
	const rateUpChance = type === "char" ? banner.rateup : banner.rateup + 0.25;
	const rateUp = Math.random() < rateUpChance ? true : false;
	const char = Math.random() < 0.5;
	let warpItem;
	if (
		warpChance <
		chanceFive(banner.pityFive, banner.max, banner.soft, banner.chance)
	) {
		await db.set(`${userdb}.pityFive`, "0");
		await db.set(`${userdb}.pityFour`, parseInt(banner.pityFour) + 1);
		if (type !== "standard") {
			if (rateUp || banner.guaranteeFive == "true") {
				await db.set(`${userdb}.guaranteeFive`, "false");
				warpItem = randItem(getRateUpFive(vers, type));
			} else {
				warpItem =
					type === "weap"
						? randItem(getPoolFiveWeap(vers, type))
						: randItem(getPoolFiveChar(vers, type));
				await db.set(`${userdb}.guaranteeFive`, "true");
			}
		} else {
			if (type === "standard") {
				if (char) warpItem = randItem(getPoolFiveChar(vers, type));
				else warpItem = randItem(getPoolFiveWeap(vers, type));
			} else warpItem = randItem(getPoolFiveChar(vers, type));
		}
	} else if (warpChance < chanceFour(banner.pityFour, 0.051)) {
		await db.set(`${userdb}.pityFive`, parseInt(banner.pityFive) + 1);
		await db.set(`${userdb}.pityFour`, "0");
		if (type !== "standard") {
			if (rateUp || banner.guaranteeFour == "true") {
				await db.set(`${userdb}.guaranteeFour`, "false");
				warpItem = randItem(getRateUpFour(vers, type));
			} else {
				await db.set(`${userdb}.guaranteeFour`, "true");
				if (char) warpItem = randItem(getPoolFourChar(vers, type));
				else warpItem = randItem(getPoolFourWeap(vers, type));
			}
		} else {
			if (char) warpItem = randItem(getPoolFourChar(vers, type));
			else warpItem = randItem(getPoolFourWeap(vers, type));
		}
	} else {
		await db.set(`${userdb}.pityFive`, parseInt(banner.pityFive) + 1);
		await db.set(`${userdb}.pityFour`, parseInt(banner.pityFour) + 1);
		warpItem = randItem(baseWeapons);
	}

	return warpItem;
}

async function createImage(id, warpResults) {
	const canvas = createCanvas(1920, 1080);
	const ctx = canvas.getContext("2d");
	const background = await loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-result.webp"
	);
	ctx.drawImage(background, 0, 0, 1920, 1080);

	if (warpResults.length == 10) {
		const data = await db.get(`${id}.sim`);
		const ring = await loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/rings.webp"
		);
		ctx.drawImage(ring, -200, -300, 550, 550);

		const positions = [
			// Line 1
			{ x: 180, y: 400 },
			{ x: 700, y: 310 },
			{ x: 1220, y: 240 },
			// Line 2
			{ x: 180, y: 700 },
			{ x: 700, y: 620 },
			{ x: 1220, y: 540 },
			{ x: 1740, y: 460 },
			// Line 3
			{ x: 700, y: 910 },
			{ x: 1220, y: 840 },
			{ x: 1740, y: 750 }
		];

		const degrees = -9;
		const radians = (Math.PI / 180) * degrees;
		let Num = 0;
		const dataBank = (data && data.dataBank) || {};

		for (const item of warpResults) {
			const id = item.id;
			Num++;
			const image = await loadImageAsync(
				`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-results/${item.name}.webp`
			);

			ctx.save();
			ctx.translate(positions[Num - 1].x, positions[Num - 1].y);
			ctx.rotate(radians);

			if (item.rarity == 5) {
				const fivestarbg = await loadImageAsync(
					`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-results/five-back.webp`
				);
				ctx.drawImage(fivestarbg, -image.width / 2, -image.height / 2);
			}

			ctx.drawImage(image, -image.width / 2, -image.height / 2);

			if (item.element)
				if (!(id in dataBank)) {
					const newicon = await loadImageAsync(
						`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/new.webp`
					);
					ctx.drawImage(
						newicon,
						-image.width / 2 + 380,
						-image.height / 2 + 20
					);
					dataBank[id] = item.element ? dataBank[id] + 1 || 0 : 0;
				} else {
					dataBank[id] = item.element ? dataBank[id] + 1 || 0 : 0;
					const width = 80;
					const height = 80;

					let xOffset = -image.width / 2 + 20;
					let yOffset = -image.height / 2 + 155;

					const starlightbg = await loadImage(
						"https://act.hoyolab.com/app/community-game-records-sea/images/character_r_5.99d42eb7.png"
					);
					ctx.drawImage(starlightbg, xOffset, yOffset, width, height);

					const cornerRadius = 20;
					ctx.lineWidth = 5;
					ctx.strokeStyle = "white";
					ctx.beginPath();
					ctx.moveTo(xOffset, yOffset);
					ctx.lineTo(xOffset, height + yOffset);
					ctx.lineTo(width + xOffset, height + yOffset);
					ctx.lineTo(width + xOffset, cornerRadius + yOffset);
					ctx.arcTo(
						width + xOffset,
						yOffset,
						xOffset,
						yOffset,
						cornerRadius
					);
					ctx.closePath();
					ctx.stroke();

					const starlight = await loadImage(
						"./src/assets/image/warp/undying-starlight.png"
					);
					ctx.drawImage(starlight, xOffset + 8, yOffset + 8, 64, 64);

					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					ctx.fillRect(xOffset + 4, yOffset + 58, 73, 20);

					ctx.font = "20px 'URW DIN Arabic', Arial, sans-serif' ";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(
						`x${
							item.rarity == 4
								? dataBank[id] < 7
									? "8"
									: "20"
								: dataBank[id] < 7
									? "20"
									: "100"
						}`,
						xOffset + 40,
						yOffset + 75
					);

					if (dataBank[id] < 7) {
						xOffset = -image.width / 2 + 120;

						const eidolonbg = await loadImage(
							item.rarity == 4
								? "https://act.hoyolab.com/app/community-game-records-sea/images/character_r_4.24f329b7.png"
								: "https://act.hoyolab.com/app/community-game-records-sea/images/character_r_5.99d42eb7.png"
						);
						ctx.drawImage(
							eidolonbg,
							xOffset,
							yOffset,
							width,
							height
						);

						const cornerRadius = 20;
						ctx.lineWidth = 5;
						ctx.strokeStyle = "white";
						ctx.beginPath();
						ctx.moveTo(xOffset, yOffset);
						ctx.lineTo(xOffset, height + yOffset);
						ctx.lineTo(width + xOffset, height + yOffset);
						ctx.lineTo(width + xOffset, cornerRadius + yOffset);
						ctx.arcTo(
							width + xOffset,
							yOffset,
							xOffset,
							yOffset,
							cornerRadius
						);
						ctx.closePath();
						ctx.stroke();

						const eidolon = await loadImage(
							item.rarity == 4
								? "./src/assets/image/warp/eidolon-4star.png"
								: "./src/assets/image/warp/eidolon-5star.png"
						);
						ctx.drawImage(
							eidolon,
							xOffset + 8,
							yOffset + 8,
							64,
							64
						);

						ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
						ctx.fillRect(xOffset + 4, yOffset + 58, 73, 20);

						ctx.font = "20px 'URW DIN Arabic', Arial, sans-serif' ";
						ctx.fillStyle = "white";
						ctx.textAlign = "center";
						ctx.fillText("x1", xOffset + 40, yOffset + 75);
					}
				}

			dataBank[id] = Math.min(dataBank[id], 6);
			ctx.restore();
		}

		await db.set(`${id}.sim.dataBank`, dataBank);
	}

	if (warpResults.length === 1) {
		const degrees = 8;
		const radians = (Math.PI / 180) * degrees;
		ctx.save();
		ctx.translate(background.width / 2, background.height / 2);

		const item = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/splash/${warpResults[0].name}.webp`
		);
		const star = await loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/star.webp"
		);
		const Path = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/path-${warpResults[0].path
				.toLowerCase()
				.replace(/\s+/g, "-")}.webp`
		);

		if (warpResults[0].element == "") {
			const back = await loadImageAsync(
				"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/glass-back.webp"
			);
			const front = await loadImageAsync(
				"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/glass-front.webp"
			);

			ctx.rotate(radians);
			ctx.drawImage(back, -67 + 50, -237.5 + 40, 334, 475);
			ctx.drawImage(item, -67 + 25, -237.5, 334, 475);
			ctx.drawImage(front, -67, -237.5 + -25, 334, 475);

			ctx.rotate(-radians);
			// Back
			const gradient = ctx.createLinearGradient(0, 0, 290, 0);
			gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
			gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient;
			ctx.translate(-item.width / 2 - 150, -item.height / 2 + 300);
			ctx.fillRect(0, 0, 290, 100);

			ctx.translate(item.width / 2 + 400, item.height / 2 + 30);

			// Name
			ctx.font = "34px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.fillText(
				trans[warpResults[0].name]["en"],
				-item.width / 2 - 308,
				-item.height / 2 + 20
			);

			// Path
			ctx.drawImage(
				Path,
				-item.width / 2 - 400,
				-item.height / 2 - 30,
				90,
				90
			);

			// Stars
			for (let i = 1; i <= warpResults[0].rarity; i++) {
				ctx.drawImage(
					star,
					-item.width / 2 - 330 + i * 22,
					-item.height / 2 + 35,
					22,
					22
				);
			}
		} else {
			const element = await loadImageAsync(
				`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/elem-${warpResults[0].element.toLowerCase()}.webp`
			);
			ctx.drawImage(item, -item.width / 2, -item.height / 2);

			// Back
			const gradient = ctx.createLinearGradient(0, 0, 234, 0);
			gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
			gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient;
			ctx.translate(-element.width / 2 - 400, -element.height / 2 - 30);
			ctx.fillRect(0, 0, 248, 90);

			ctx.translate(element.width / 2 + 400, element.height / 2 + 30);

			// Name
			ctx.font = "34px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.fillText(
				trans[warpResults[0].name]["en"],
				-element.width / 2 - 308,
				-element.height / 2 + 20
			);

			// Element
			ctx.drawImage(
				element,
				-element.width / 2 - 400,
				-element.height / 2 - 30,
				90,
				90
			);

			// Stars
			for (let i = 1; i <= warpResults[0].rarity; i++) {
				ctx.drawImage(
					star,
					-element.width / 2 - 330 + i * 22,
					-element.height / 2 + 30,
					22,
					22
				);
			}

			// Back2
			const gradient2 = ctx.createLinearGradient(0, 0, 234, 0);
			gradient2.addColorStop(0, "rgba(0, 0, 0, 0.5)");
			gradient2.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient2;
			ctx.translate(-element.width / 2 - 370, -element.height / 2 + 62);
			ctx.fillRect(0, 0, 192, 40);

			// Path
			ctx.drawImage(
				Path,
				-element.width / 2 + 30,
				-element.height / 2 + 27,
				50,
				50
			);

			// Path
			ctx.font = "28px 'URW DIN Arabic'";
			ctx.fillStyle = "white";
			ctx.fillText(
				trans[warpResults[0].path.toLowerCase().replace(/\s+/g, "-")][
					"en"
				],
				-element.width / 2 + 80,
				-element.height / 2 + 62
			);
		}

		ctx.restore();
	}

	return canvas.toBuffer("image/png");
}

async function warpLogImage(interaction, datas, title) {
	try {
		const tr = i18nMixin(
			(await db?.has(`${interaction.user.id}.locale`))
				? await db?.get(`${interaction.user.id}.locale`)
				: toI18nLang(interaction.locale) || "en"
		);

		const canvas = createCanvas(1370, 900);
		const ctx = canvas.getContext("2d");

		const bg = await loadImageAsync("./src/assets/image/warp/warpbg.jpg");
		ctx.drawImage(bg, 0, 0, 1920, 1080);

		// Draw Icon
		const drawIcon = await loadImageAsync(
			image_Header + "icon/sign/DrawcardIcon.png"
		);
		ctx.drawImage(drawIcon, 50, 22.5, 64, 64);

		// Draw Text
		ctx.font =
			"48px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#F1C376";
		ctx.textAlign = "left";
		ctx.fillText(`${title} ${tr("warplog_title")}`, 130, 70);

		// // Player Name
		// ctx.font =
		//   "64px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		// ctx.fillStyle = "#FFFFFF";
		// ctx.textAlign = "left";
		// ctx.fillText("玩家名稱", 55, 160);

		// Texts
		// Count
		ctx.font =
			"bold 24px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_count")}`, 55, 250);

		ctx.font =
			"bold 24px ' URW DIN Arabic', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		ctx.fillText(`${datas.total}`, 400, 252.5);

		ctx.drawImage(
			await loadImageAsync(image_Header + "icon/item/102.png"),
			410,
			225,
			36,
			36
		);

		// Count Cost
		ctx.font =
			"bold 24px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_cost")}`, 55, 300);

		ctx.font =
			"bold 24px ' URW DIN Arabic', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		ctx.fillText(`${datas.total * 160}`, 400, 302.5);

		ctx.drawImage(
			await loadImageAsync(image_Header + "icon/item/900001.png"),
			410,
			275,
			36,
			36
		);

		// 5 Star Count
		ctx.font =
			"bold 24px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_5count")}`, 55, 350);

		ctx.font =
			"bold 24px ' URW DIN Arabic', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		ctx.fillText(`${datas?.data.length}`, 400, 352.5);

		// 5 Star Average
		ctx.font =
			"bold 24px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_5countaverage")}`, 55, 400);

		ctx.font =
			"bold 24px ' URW DIN Arabic', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		ctx.fillText(`${datas.average}`, 400, 402.5);

		// Draw History Icon
		const star = await loadImageAsync(
			image_Header + "icon/deco/StarBig.png"
		);
		ctx.drawImage(star, 530, 103, 60, 60);

		// Draw History Text
		ctx.font =
			"38px 'Hanyi', URW DIN Arabic, URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_react")}`, 600, 145);

		// Draw History
		datas.data.slice(0, 23);
		// datas.data.reverse();
		datas.data.unshift({
			count: datas.pity
		});

		for (let y = 0; y < Math.ceil(datas?.data.length / 5); y++) {
			for (let x = 0; x < 5; x++) {
				if (y * 5 + x < datas.data.length) {
					const res = datas.data[y * 5 + x];
					const progress = res.count;
					const centerX = 600 + x * 150;
					const centerY = 250 + y * 130;
					const radius = 55;
					const lineWidth = 8;
					const startAngle = -Math.PI / 2;
					const endAngle =
						startAngle + (progress / 100) * (2 * Math.PI);

					// Progress BG
					ctx.beginPath();
					ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
					ctx.lineWidth = lineWidth;
					ctx.strokeStyle = "#000000";
					ctx.stroke();

					// Progress
					const progressColor = [
						{ threshold: 50, color: "#9DF1DF" },
						{ threshold: 70, color: "#FFBB5C" },
						{ threshold: 100, color: "#FF6969" }
					];
					let color = "#000000";

					for (const {
						threshold,
						color: colorValue
					} of progressColor)
						if (progress <= threshold) {
							color = colorValue;
							break;
						}

					ctx.beginPath();
					ctx.arc(centerX, centerY, radius, startAngle, endAngle);
					ctx.lineWidth = lineWidth;
					ctx.strokeStyle = color;
					ctx.lineCap = "round";
					ctx.stroke();

					// Character
					const id = res.id;
					const type = res.type;
					ctx.globalCompositeOperation = "source-over";
					const image = await loadImageAsync(
						image_Header +
							(x + y == 0
								? "icon/element/None.png"
								: `icon/${
										type == "light_cone"
											? "light_cone"
											: "avatar"
									}/${id}.png`)
					);
					const imageWidth = 2 * (radius - lineWidth);
					const imageHeight = 2 * (radius - lineWidth);
					const imageX = centerX - imageWidth / 2;
					const imageY = centerY - imageHeight / 2;

					ctx.drawImage(
						image,
						imageX,
						imageY,
						imageWidth,
						imageHeight
					);

					// Count
					const rectWidth = 60;
					const rectHeight = 30;
					const rectX = 610 + x * 150;
					const rectY = 270 + y * 130;
					const cornerRadius = 17.5;

					ctx.fillStyle = "#FFFFFF";
					ctx.beginPath();
					ctx.moveTo(rectX + cornerRadius, rectY);
					ctx.lineTo(rectX + rectWidth - cornerRadius, rectY);
					ctx.quadraticCurveTo(
						rectX + rectWidth,
						rectY,
						rectX + rectWidth,
						rectY + cornerRadius
					);
					ctx.lineTo(
						rectX + rectWidth,
						rectY + rectHeight - cornerRadius
					);
					ctx.quadraticCurveTo(
						rectX + rectWidth,
						rectY + rectHeight,
						rectX + rectWidth - cornerRadius,
						rectY + rectHeight
					);
					ctx.lineTo(rectX + cornerRadius, rectY + rectHeight);
					ctx.quadraticCurveTo(
						rectX,
						rectY + rectHeight,
						rectX,
						rectY + rectHeight - cornerRadius
					);
					ctx.lineTo(rectX, rectY + cornerRadius);
					ctx.quadraticCurveTo(
						rectX,
						rectY,
						rectX + cornerRadius,
						rectY
					);
					ctx.fill();

					// Count Text
					ctx.font =
						"bold 20px 'URW DIN Arabic', URW DIN Arabic, Arial, sans-serif' ";
					ctx.fillStyle = "#000000";
					ctx.textAlign = "center";
					ctx.fillText(`${progress}`, rectX + 30, rectY + 22.5);
				}
			}
		}

		return canvas.toBuffer("image/png");
	} catch (e) {
		return null;
	}
}

export { warpLog, warp, createImage, warpLogImage };
