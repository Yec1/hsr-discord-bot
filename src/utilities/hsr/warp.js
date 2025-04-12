import { EmbedBuilder } from "discord.js";
import { baseWeapons } from "./Constants.js";
import { join } from "path";
import axios from "axios";
import { client } from "../../index.js";
import {
	getRateUpFive,
	getRateUpFour,
	getPoolFiveChar,
	getPoolFiveWeap,
	getPoolFourChar,
	getPoolFourWeap
} from "./parseJSON.js";
import { getRandomColor } from "../utilities.js";
import trans from "../../assets/translations.json" with { type: "json" };
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs/promises";
const db = client.db;

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "zh-tw.ttf"),
	"Hanyi"
);

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

const sleep = time => new Promise(res => setTimeout(res, time));

async function loadImageAsync(url) {
	try {
		return await loadImage(url);
	} catch {
		// 创建一个简单的空白图片作为最后的备用方案
		const canvas = createCanvas(64, 64);
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#333333";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#FFFFFF";
		ctx.font = "12px 'URW DIN Arabic'";
		ctx.textAlign = "center";
		ctx.fillText("加載失敗", 32, 32);
		return canvas;
	}
}

async function fetchWarpData(query, id, endId) {
	query.set("gacha_type", id);
	query.set("end_id", endId);

	return axios
		.get(
			"https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?" +
				query,
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
				}
			}
		)
		.then(response => response.data);
}

async function warpLog(input, interaction, tr) {
	const type = {
		character: tr("warp_TypeCharacter"),
		light_cone: tr("warp_TypeLightcone"),
		regular: tr("warp_TypeRegular")
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

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor())
						.setTitle(
							tr("warp_Loading", {
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

		try {
			// 保存抽卡历史记录
			await saveWarpHistory(interaction.user.id, list);
		} catch (error) {
			console.error("保存抽卡历史记录失败:", error);
			// 不中断主流程，继续返回结果
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
	const banner = await db.get(userdb);
	const warpChance = Math.random();
	const rateUpChance = type === "char" ? banner.rateup : banner.rateup + 0.25;
	const rateUp = Math.random() < rateUpChance;
	const char = Math.random() < 0.5;

	let warpItem;

	// Helper function to handle banner updates
	const updateBanner = async (
		pityFive,
		pityFour,
		guaranteeFive = null,
		guaranteeFour = null
	) => {
		await db.set(`${userdb}.pityFive`, pityFive);
		await db.set(`${userdb}.pityFour`, pityFour);
		if (guaranteeFive !== null)
			await db.set(`${userdb}.guaranteeFive`, guaranteeFive);
		if (guaranteeFour !== null)
			await db.set(`${userdb}.guaranteeFour`, guaranteeFour);
	};

	// Handle five-star warp
	if (
		warpChance <
		chanceFive(banner.pityFive, banner.max, banner.soft, banner.chance)
	) {
		await updateBanner(0, parseInt(banner.pityFour) + 1);

		if (type !== "standard") {
			if (rateUp || banner.guaranteeFive === "true") {
				warpItem = randItem(getRateUpFive(vers, type));
				await updateBanner(0, parseInt(banner.pityFour) + 1, "false");
			} else {
				warpItem = randItem(
					type === "weap"
						? getPoolFiveWeap(vers, type)
						: getPoolFiveChar(vers, type)
				);
				await updateBanner(0, parseInt(banner.pityFour) + 1, "true");
			}
		} else {
			warpItem = char
				? randItem(getPoolFiveChar(vers, type))
				: randItem(getPoolFiveWeap(vers, type));
		}
	}
	// Handle four-star warp
	else if (warpChance < chanceFour(banner.pityFour, 0.051)) {
		await updateBanner(parseInt(banner.pityFive) + 1, 0);

		if (type !== "standard") {
			if (rateUp || banner.guaranteeFour === "true") {
				warpItem = randItem(getRateUpFour(vers, type));
				await updateBanner(
					parseInt(banner.pityFive) + 1,
					0,
					null,
					"false"
				);
			} else {
				warpItem = randItem(
					char
						? getPoolFourChar(vers, type)
						: getPoolFourWeap(vers, type)
				);
				await updateBanner(
					parseInt(banner.pityFive) + 1,
					0,
					null,
					"true"
				);
			}
		} else {
			warpItem = char
				? randItem(getPoolFourChar(vers, type))
				: randItem(getPoolFourWeap(vers, type));
		}
	}
	// Handle base weapons
	else {
		await updateBanner(
			parseInt(banner.pityFive) + 1,
			parseInt(banner.pityFour) + 1
		);
		warpItem = randItem(baseWeapons);
	}

	return warpItem;
}

async function createImage(id, warpResults) {
	const canvas = createCanvas(1920, 1080);
	const ctx = canvas.getContext("2d");

	// 提前加載不變的圖像
	const backgroundPromise = loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-result.webp"
	);
	const ringPromise = loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/rings.webp"
	);
	const fivestarbgPromise = loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-results/five-back.webp"
	);
	const newIconPromise = loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/new.webp"
	);
	const starlightbgPromise = loadImage(
		"https://act.hoyolab.com/app/community-game-records-sea/images/character_r_5.99d42eb7.png"
	);
	const eidolon4StarPromise = loadImage(
		"./src/assets/image/warp/eidolon-4star.png"
	);
	const eidolon5StarPromise = loadImage(
		"./src/assets/image/warp/eidolon-5star.png"
	);
	const starlightPromise = loadImage(
		"./src/assets/image/warp/undying-starlight.png"
	);
	const starPromise = loadImageAsync(
		"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/star.webp"
	);

	const background = await backgroundPromise;
	ctx.drawImage(background, 0, 0, 1920, 1080);

	if (warpResults.length === 10) {
		const [
			data,
			ring,
			fivestarbg,
			newIcon,
			starlightbg,
			eidolon4Star,
			eidolon5Star,
			starlight
		] = await Promise.all([
			db.get(`${id}.sim`),
			ringPromise,
			fivestarbgPromise,
			newIconPromise,
			starlightbgPromise,
			eidolon4StarPromise,
			eidolon5StarPromise,
			starlightPromise
		]);

		ctx.drawImage(ring, -200, -300, 550, 550);

		const positions = [
			{ x: 180, y: 400 },
			{ x: 700, y: 310 },
			{ x: 1220, y: 240 },
			{ x: 180, y: 700 },
			{ x: 700, y: 620 },
			{ x: 1220, y: 540 },
			{ x: 1740, y: 460 },
			{ x: 700, y: 910 },
			{ x: 1220, y: 840 },
			{ x: 1740, y: 750 }
		];

		const radians = (Math.PI / 180) * -9;
		let Num = 0;
		const dataBank = (data && data.dataBank) || {};

		// 並行加載所有必要的圖像
		const imagesPromise = warpResults.map(item =>
			loadImageAsync(
				`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-results/${item.name}.webp`
			)
		);
		const images = await Promise.all(imagesPromise);

		for (const [index, item] of warpResults.entries()) {
			Num++;
			const image = images[index];
			const itemID = item.id;

			ctx.save();
			ctx.translate(positions[Num - 1].x, positions[Num - 1].y);
			ctx.rotate(radians);

			if (item.rarity == 5) {
				ctx.drawImage(fivestarbg, -image.width / 2, -image.height / 2);
			}

			ctx.drawImage(image, -image.width / 2, -image.height / 2);

			if (item.element) {
				if (!(itemID in dataBank)) {
					ctx.drawImage(
						newIcon,
						-image.width / 2 + 380,
						-image.height / 2 + 20
					);
					dataBank[itemID] = 1;
				} else {
					dataBank[itemID]++;
					const width = 80;
					const height = 80;

					let xOffset = -image.width / 2 + 20;
					let yOffset = -image.height / 2 + 155;

					ctx.drawImage(starlightbg, xOffset, yOffset, width, height);

					const cornerRadius = 20;
					ctx.lineWidth = 5;
					ctx.strokeStyle = "#E0E0E0";
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

					ctx.drawImage(starlight, xOffset + 8, yOffset + 8, 64, 64);

					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					ctx.fillRect(xOffset + 4, yOffset + 58, 73, 20);

					ctx.font = "20px 'URW DIN Arabic', Arial, sans-serif' ";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(
						`x${item.rarity == 4 ? (dataBank[itemID] < 7 ? "8" : "20") : dataBank[itemID] < 7 ? "20" : "100"}`,
						xOffset + 40,
						yOffset + 75
					);

					if (dataBank[itemID] < 7) {
						xOffset = -image.width / 2 + 120;

						const eidolonbg =
							item.rarity == 4 ? eidolon4Star : eidolon5Star;
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

						const eidolon =
							item.rarity == 4 ? eidolon4Star : eidolon5Star;
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
			}

			dataBank[itemID] = Math.min(dataBank[itemID], 6);
			ctx.restore();
		}

		await db.set(`${id}.sim.dataBank`, dataBank);
	}

	if (warpResults.length === 1) {
		const degrees = 8;
		const radians = (Math.PI / 180) * degrees;
		const item = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/splash/${warpResults[0].name}.webp`
		);
		const star = await starPromise;
		const Path = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/path-${warpResults[0].path.toLowerCase().replace(/\s+/g, "-")}.webp`
		);

		ctx.save();
		ctx.translate(background.width / 2, background.height / 2);

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

			const gradient = ctx.createLinearGradient(0, 0, 290, 0);
			gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
			gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient;
			ctx.translate(-item.width / 2 - 150, -item.height / 2 + 300);
			ctx.fillRect(0, 0, 290, 100);

			ctx.translate(item.width / 2 + 400, item.height / 2 + 30);

			ctx.font = "34px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.fillText(
				trans[warpResults[0].name]["en"],
				-item.width / 2 - 308,
				-item.height / 2 + 20
			);

			ctx.drawImage(
				Path,
				-item.width / 2 - 400,
				-item.height / 2 - 30,
				90,
				90
			);

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

			const gradient = ctx.createLinearGradient(0, 0, 234, 0);
			gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
			gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
			gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient;
			ctx.translate(-element.width / 2 - 400, -element.height / 2 - 30);
			ctx.fillRect(0, 0, 248, 90);

			ctx.translate(element.width / 2 + 400, element.height / 2 + 30);

			ctx.font = "34px 'URW DIN Arabic', Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.fillText(
				trans[warpResults[0].name]["en"],
				-element.width / 2 - 308,
				-element.height / 2 + 20
			);

			ctx.drawImage(
				element,
				-element.width / 2 - 400,
				-element.height / 2 - 30,
				90,
				90
			);

			for (let i = 1; i <= warpResults[0].rarity; i++) {
				ctx.drawImage(
					star,
					-element.width / 2 - 330 + i * 22,
					-element.height / 2 + 30,
					22,
					22
				);
			}

			const gradient2 = ctx.createLinearGradient(0, 0, 234, 0);
			gradient2.addColorStop(0, "rgba(0, 0, 0, 0.5)");
			gradient2.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient2;
			ctx.translate(-element.width / 2 - 370, -element.height / 2 + 62);
			ctx.fillRect(0, 0, 192, 40);

			ctx.drawImage(
				Path,
				-element.width / 2 + 30,
				-element.height / 2 + 27,
				50,
				50
			);

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

async function warpLogImage(tr, datas, title) {
	try {
		// 檢查數據是否有效
		if (!datas || !datas.data) {
			throw new Error(tr("draw_InvalidData"));
		}

		// 限制處理的數據量，避免過多的渲染操作
		const maxItems = 23;
		const historyData = [...datas.data.slice(0, maxItems)];
		historyData.unshift({ count: datas.pity });

		// 創建畫布 - 使用更小的尺寸以提高性能
		const canvas = createCanvas(1370, 900);
		const ctx = canvas.getContext("2d");

		// 使用離屏渲染緩存常用元素
		const circleCache = new Map();
		const rectCache = new Map();

		// 預加載所有圖像資源，避免渲染過程中的等待
		const imagePromises = [
			// 背景和UI元素
			loadImageAsync("./src/assets/image/warp/warpbg.jpg").catch(
				() => null
			),
			loadImageAsync(image_Header + "icon/sign/DrawcardIcon.png"),
			loadImageAsync(image_Header + "icon/deco/StarBig.png"),
			loadImageAsync(image_Header + "icon/item/102.png"),
			loadImageAsync(image_Header + "icon/item/900001.png"),
			// 預加載角色/光錐圖像
			...historyData.map((res, index) => {
				if (index === 0)
					return loadImageAsync(
						image_Header + "icon/character/None.png"
					);
				if (!res.id || !res.type) return Promise.resolve(null);
				const imagePath = `icon/${res.type == "light_cone" ? "light_cone" : "avatar"}/${res.id}.png`;
				return loadImageAsync(image_Header + imagePath);
			})
		];

		// 並行加載所有圖像
		const [bg, drawIcon, star, item102, item900001, ...characterImages] =
			await Promise.all(imagePromises);

		// 繪製背景
		if (bg) {
			ctx.drawImage(bg, 0, 0, 1920, 1080);
		} else {
			// 創建一個簡單的背景
			ctx.fillStyle = "#1A1A2E";
			ctx.fillRect(0, 0, 1370, 900);
		}

		// 繪製標題區域
		ctx.drawImage(drawIcon, 50, 22.5, 64, 64);
		ctx.font = "48px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#F1C376";
		ctx.textAlign = "left";
		ctx.fillText(`${title} ${tr("warplog_Title")}`, 130, 70);

		// 繪製統計信息 - 使用批處理減少狀態切換
		const statItems = [
			{
				label: tr("warplog_Count"),
				value: `${datas.total}`,
				y: 250,
				icon: item102
			},
			{
				label: tr("warplog_Cost"),
				value: `${datas.total * 160}`,
				y: 300,
				icon: item900001
			},
			{
				label: tr("warplog_5Count"),
				value: `${datas?.data.length}`,
				y: 350
			},
			{
				label: tr("warplog_5CountAverage"),
				value: `${datas.average}`,
				y: 400
			}
		];

		// 批量繪製標籤
		ctx.font = "bold 24px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		for (const item of statItems) {
			ctx.fillText(item.label, 55, item.y);
		}

		// 批量繪製值
		ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif'";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		for (const item of statItems) {
			ctx.fillText(item.value, 400, item.y + 2.5);
		}

		// 繪製圖標
		for (const item of statItems) {
			if (item.icon) {
				ctx.drawImage(item.icon, 410, item.y - 25, 36, 36);
			}
		}

		// 繪製歷史記錄標題
		ctx.drawImage(star, 530, 103, 60, 60);
		ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_React")}`, 600, 145);

		// 創建進度條顏色映射函數
		const getProgressColor = progress => {
			if (progress <= 50) return "#9DF1DF";
			if (progress <= 70) return "#FFBB5C";
			return "#FF6969";
		};

		// 預先計算佈局
		const layout = [];
		for (let i = 0; i < historyData.length; i++) {
			const y = Math.floor(i / 5);
			const x = i % 5;
			const centerX = 600 + x * 150;
			const centerY = 250 + y * 130;

			layout.push({
				centerX,
				centerY,
				rectX: 610 + x * 150,
				rectY: 270 + y * 130
			});
		}

		// 創建圓形進度條緩存函數
		const getCircleCanvas = (progress, radius, lineWidth) => {
			const cacheKey = `${progress}-${radius}-${lineWidth}`;
			if (circleCache.has(cacheKey)) return circleCache.get(cacheKey);

			const size = (radius + lineWidth) * 2;
			const circleCanvas = createCanvas(size, size);
			const circleCtx = circleCanvas.getContext("2d");

			const centerX = size / 2;
			const centerY = size / 2;
			const startAngle = -Math.PI / 2;
			const endAngle = startAngle + (progress / 100) * (2 * Math.PI);

			// 繪製背景
			circleCtx.beginPath();
			circleCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			circleCtx.lineWidth = lineWidth;
			circleCtx.strokeStyle = "#000000";
			circleCtx.stroke();

			// 繪製進度
			circleCtx.beginPath();
			circleCtx.arc(centerX, centerY, radius, startAngle, endAngle);
			circleCtx.lineWidth = lineWidth;
			circleCtx.strokeStyle = getProgressColor(progress);
			circleCtx.lineCap = "round";
			circleCtx.stroke();

			circleCache.set(cacheKey, circleCanvas);
			return circleCanvas;
		};

		// 創建矩形計數框緩存函數
		const getRectCanvas = () => {
			if (rectCache.has("default")) return rectCache.get("default");

			const rectWidth = 60;
			const rectHeight = 30;
			const cornerRadius = 17.5;

			const rectCanvas = createCanvas(rectWidth, rectHeight);
			const rectCtx = rectCanvas.getContext("2d");

			rectCtx.fillStyle = "#FFFFFF";
			rectCtx.beginPath();
			rectCtx.moveTo(cornerRadius, 0);
			rectCtx.lineTo(rectWidth - cornerRadius, 0);
			rectCtx.quadraticCurveTo(rectWidth, 0, rectWidth, cornerRadius);
			rectCtx.lineTo(rectWidth, rectHeight - cornerRadius);
			rectCtx.quadraticCurveTo(
				rectWidth,
				rectHeight,
				rectWidth - cornerRadius,
				rectHeight
			);
			rectCtx.lineTo(cornerRadius, rectHeight);
			rectCtx.quadraticCurveTo(
				0,
				rectHeight,
				0,
				rectHeight - cornerRadius
			);
			rectCtx.lineTo(0, cornerRadius);
			rectCtx.quadraticCurveTo(0, 0, cornerRadius, 0);
			rectCtx.fill();

			rectCache.set("default", rectCanvas);
			return rectCanvas;
		};

		// 批量繪製歷史記錄
		const radius = 55;
		const lineWidth = 8;
		const rectCanvas = getRectCanvas();

		// 使用requestAnimationFrame模擬的批處理渲染
		for (let i = 0; i < historyData.length; i++) {
			try {
				const res = historyData[i];
				if (!res) continue;

				const progress = res.count;
				const { centerX, centerY, rectX, rectY } = layout[i];

				// 繪製進度圓
				const circleCanvas = getCircleCanvas(
					progress,
					radius,
					lineWidth
				);
				ctx.drawImage(
					circleCanvas,
					centerX - circleCanvas.width / 2,
					centerY - circleCanvas.height / 2
				);

				// 繪製角色/光錐圖像
				const image = characterImages[i];
				if (image) {
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
				}

				// 繪製計數框
				ctx.drawImage(rectCanvas, rectX, rectY);

				// 繪製計數文本
				ctx.font = "bold 20px 'URW DIN Arabic', Arial, sans-serif'";
				ctx.fillStyle = "#000000";
				ctx.textAlign = "center";
				ctx.fillText(`${progress}`, rectX + 30, rectY + 22.5);
			} catch {
				// 靜默處理錯誤，繼續下一個項目
				continue;
			}
		}

		// 清理緩存
		circleCache.clear();
		rectCache.clear();

		// 返回結果
		const result = canvas.toBuffer("image/png");
		if (!result) {
			throw new Error(tr("draw_CanvasError"));
		}
		return result;
	} catch (e) {
		throw new Error(tr("draw_Error") + ": " + e.message);
	}
}

/**
 * 保存用户抽卡记录到数据库
 * @param {string} userId - 用户ID
 * @param {Object} warpData - 抽卡数据
 */
async function saveWarpHistory(userId, warpData) {
	try {
		// 获取现有记录
		const existingData = (await db.get(`${userId}.warpHistory`)) || {
			character: { total: 0, data: [] },
			light_cone: { total: 0, data: [] },
			regular: { total: 0, data: [] },
			lastUpdated: 0
		};

		// 合并新数据
		for (const type of ["character", "light_cone", "regular"]) {
			if (warpData[type] && warpData[type].data) {
				// 检查是否有新数据
				const newItems = warpData[type].data.filter(newItem => {
					// 检查此物品是否已存在于历史记录中
					return !existingData[type].data.some(
						existingItem =>
							existingItem.id === newItem.id &&
							existingItem.time === newItem.time
					);
				});

				// 添加新数据
				existingData[type].data = [
					...newItems,
					...existingData[type].data
				];
				existingData[type].total =
					warpData[type].total || existingData[type].total;

				// 重新计算平均值
				if (existingData[type].data.length > 0) {
					existingData[type].average = parseFloat(
						(
							existingData[type].data.reduce(
								(acc, i) => acc + i.count,
								0
							) / existingData[type].data.length
						).toFixed(2)
					);
				}

				// 更新当前保底计数
				existingData[type].pity =
					warpData[type].pity || existingData[type].pity;
			}
		}

		// 更新时间戳
		existingData.lastUpdated = Date.now();

		// 保存到数据库
		await db.set(`${userId}.warpHistory`, existingData);

		return existingData;
	} catch (error) {
		console.error("保存抽卡历史记录失败:", error);
		throw error;
	}
}

/**
 * 获取用户抽卡历史记录
 * @param {string} userId - 用户ID
 * @param {string} type - 记录类型 (character, light_cone, regular)
 * @returns {Object} 抽卡历史记录
 */
async function getWarpHistory(userId, type = null) {
	try {
		const history = await db.get(`${userId}.warpHistory`);
		if (!history) return null;

		if (type && history[type]) {
			return history[type];
		}

		return history;
	} catch (error) {
		console.error("获取抽卡历史记录失败:", error);
		return null;
	}
}

/**
 * 导出用户抽卡历史记录
 * @param {string} userId - 用户ID
 * @returns {Object} 历史记录数据
 */
async function exportWarpHistory(userId) {
	try {
		const history = await getWarpHistory(userId);
		if (!history) throw new Error("没有找到抽卡历史记录");
		return history;
	} catch (error) {
		console.error("导出抽卡历史记录失败:", error);
		throw error;
	}
}

/**
 * 导入用户抽卡历史记录
 * @param {string} userId - 用户ID
 * @param {Object} importedData - 要导入的历史记录数据
 * @returns {Object} 导入的历史记录
 */
async function importWarpHistory(userId, importedData) {
	try {
		// 验证数据格式
		if (
			!importedData.character ||
			!importedData.light_cone ||
			!importedData.regular
		) {
			throw new Error("无效的抽卡历史记录格式");
		}

		// 保存到数据库
		await db.set(`${userId}.warpHistory`, importedData);

		return importedData;
	} catch (error) {
		console.error("导入抽卡历史记录失败:", error);
		throw error;
	}
}

export {
	warpLog,
	warp,
	createImage,
	warpLogImage,
	saveWarpHistory,
	getWarpHistory,
	exportWarpHistory,
	importWarpHistory
};
