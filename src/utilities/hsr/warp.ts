import { EmbedBuilder } from "discord.js";
import { baseWeapons } from "./constants.js";
import { join } from "path";
import axios from "axios";
import { database } from "@/index.js";
import {
	getRateUpFive,
	getRateUpFour,
	getPoolFiveChar,
	getPoolFiveWeap,
	getPoolFourChar,
	getPoolFourWeap
} from "./parseJSON.js";
import { getRandomColor } from "../index.js";
import trans from "@/assets/translations.json" with { type: "json" };
import {
	createCanvas,
	loadImage,
	GlobalFonts,
	Canvas,
	Image
} from "@napi-rs/canvas";

// 类型定义
interface WarpItem {
	id: string;
	name: string;
	type: string;
	time: string;
	rank: string;
	count?: number;
}

interface WarpData {
	type: string;
	size: number;
	data: WarpItem[];
}

interface WarpList {
	total: number;
	average: number;
	pity: number;
	data: WarpItem[];
}

interface WarpHistory {
	character: WarpList;
	light_cone: WarpList;
	regular: WarpList;
	collaboration_character: WarpList;
	collaboration_light_cone: WarpList;
}

interface WarpResult {
	id: string;
	name: string;
	type: string;
	rarity: number;
	element: string;
	path: string;
}

interface BannerData {
	pityFive: number;
	pityFour: number;
	max: number;
	soft: number;
	chance: number;
	rateup: number;
	guaranteeFive: string;
	guaranteeFour: string;
	dataBank?: Record<string, number>;
}

interface DataBank {
	[key: string]: number;
}

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "RPG_CN.ttf"),
	"Hanyi"
);

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

const sleep = (time: number): Promise<void> =>
	new Promise(res => setTimeout(res, time));

// 圖片緩存機制
const warpImageCache = new Map<string, Canvas | Image>();
const warpImageLoadPromises = new Map<string, Promise<Canvas | Image>>();

async function loadImageAsync(url: string): Promise<Canvas | Image> {
	// 檢查緩存
	if (warpImageCache.has(url)) {
		return warpImageCache.get(url)!;
	}

	// 防止重複加載
	if (warpImageLoadPromises.has(url)) {
		return await warpImageLoadPromises.get(url)!;
	}

	// 創建加載 Promise
	const loadPromise = (async () => {
		try {
			const image = await loadImage(url);
			warpImageCache.set(url, image);
			return image;
		} catch {
			// 創建一個簡單的空白圖片作為最後的備用方案
			const canvas = createCanvas(64, 64);
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "#333333";
			ctx.fillRect(0, 0, 64, 64);
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "12px 'URW DIN Arabic'";
			ctx.textAlign = "center";
			ctx.fillText("加載失敗", 32, 32);
			warpImageCache.set(url, canvas);
			return canvas;
		}
	})();

	warpImageLoadPromises.set(url, loadPromise);

	// 30秒後清理 Promise 緩存
	setTimeout(() => {
		warpImageLoadPromises.delete(url);
	}, 30000);

	return await loadPromise;
}

// 清理 warp 圖片緩存
function clearWarpImageCache(): void {
	warpImageCache.clear();
	warpImageLoadPromises.clear();
	console.log("[Warp Image Cache] All warp image caches cleared");
}

// 定期清理 warp 圖片緩存
function setupWarpImageCacheCleanup(): void {
	setInterval(
		() => {
			let clearedCount = 0;
			for (const [url, promise] of warpImageLoadPromises.entries()) {
				clearedCount++;
				promise
					.then(image => {
						if (image instanceof Canvas) {
							warpImageCache.delete(url);
						}
					})
					.catch(error => {
						console.error(
							`[Warp Image Cache] Error clearing cache for ${url}:`,
							error
						);
					});
			}

			if (clearedCount > 0) {
				console.log(
					`[Warp Image Cache] Cleaned ${clearedCount} cached promises`
				);
			}
		},
		5 * 60 * 1000
	); // 每5分鐘清理一次
}

async function fetchWarpData(
	query: URLSearchParams,
	id: number,
	endId: number
): Promise<any> {
	query.set("gacha_type", id.toString());
	query.set("end_id", endId.toString());

	let gachaURLPath = "getGachaLog";
	if (id === 21 || id === 22) {
		gachaURLPath = "getLdGachaLog";
	}

	const url = `https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/${gachaURLPath}?${query}`;

	return axios
		.get(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
			}
		})
		.then(response => response.data);
}

async function warpLog(
	input: string,
	interaction: any,
	tr: any
): Promise<WarpHistory | undefined> {
	const type: Record<string, string> = {
		character: tr("warp_TypeCharacter"),
		light_cone: tr("warp_TypeLightcone"),
		regular: tr("warp_TypeRegular"),
		collaboration_character: tr("warp_TypeCollaborationCharacter"),
		collaboration_light_cone: tr("warp_TypeCollaborationLightcone")
	};

	const takumiQuery = new URLSearchParams({
		authkey_ver: "1",
		sign_type: "2",
		game_biz: "hkrpg_global",
		lang: "en",
		authkey: "",
		region: "",
		gacha_type: "0",
		size: "20",
		end_id: "0"
	});

	const queryParams = new URLSearchParams(input);
	const authkey = queryParams.get("authkey");
	let region = queryParams.get("region");
	const lastId = queryParams.get("end_id");
	const gachaTypes: Record<string, number> = {
		collaboration_character: 21,
		collaboration_light_cone: 22,
		character: 11,
		light_cone: 12,
		regular: 1
	};

	if (authkey) {
		const query = takumiQuery;
		query.set("authkey", authkey);

		const warps: WarpData[] = [];

		for (const [gachaType, id] of Object.entries(gachaTypes)) {
			const res = await fetchWarpData(query, id, 0);
			if (!region) region = res.region;
			if (region) query.set("region", region);

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor() as any)
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
			const tempWarps: WarpItem[] = [];

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

			await sleep(1000);
		}

		const list: WarpHistory = {
			character: { total: 0, average: 0, pity: 0, data: [] },
			light_cone: { total: 0, average: 0, pity: 0, data: [] },
			regular: { total: 0, average: 0, pity: 0, data: [] },
			collaboration_character: {
				total: 0,
				average: 0,
				pity: 0,
				data: []
			},
			collaboration_light_cone: {
				total: 0,
				average: 0,
				pity: 0,
				data: []
			}
		};

		for (const warp of warps) {
			const { type: warpType, data: warpData } = warp;
			let total = 0;
			let count = 0;

			for (const index of warpData.reverse()) {
				total++;
				if (index.rank === "5") {
					list[warpType as keyof WarpHistory].data.push({
						id: index.id,
						type: index.type,
						name: index.name,
						time: index.time,
						rank: index.rank,
						count: count + 1
					});
					count = 0;
				} else {
					count++;
				}
			}

			const { data } = list[warpType as keyof WarpHistory];
			data.reverse();
			list[warpType as keyof WarpHistory].pity = count;
			list[warpType as keyof WarpHistory].average = data.length
				? parseFloat(
						(
							data.reduce((acc, i) => acc + (i.count || 0), 0) /
							data.length
						).toFixed(2)
					)
				: 0;
			list[warpType as keyof WarpHistory].total = total;
		}

		try {
			await saveWarpHistory(interaction.user.id, list);
		} catch (error) {
			console.error("保存抽卡历史记录失败:", error);
		}

		return list;
	}

	// 如果没有 authkey，返回 undefined
	return undefined;
}

const randItem = <T>(pool: T[]): T => {
	const item = pool[Math.floor(Math.random() * pool.length)];
	if (item === undefined) {
		throw new Error("Pool is empty or contains undefined items");
	}
	return item;
};

const chanceFive = (
	currentPity: number,
	maxPity: number,
	softPity: number,
	baseRate: number
): number => {
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

const chanceFour = (currentPity: number, baseRate: number): number => {
	return currentPity < 9 ? baseRate : 1;
};

async function warp(
	vers: string,
	type: string,
	interaction: any
): Promise<any> {
	const userdb = `${interaction.user.id}.sim`;
	const banner: BannerData | null = await database.get(userdb);

	if (!banner) {
		throw new Error("Banner data not found");
	}

	const warpChance = Math.random();
	const rateUpChance = type === "char" ? banner.rateup : banner.rateup + 0.25;
	const rateUp = Math.random() < rateUpChance;
	const char = Math.random() < 0.5;

	let warpItem: any;

	// Helper function to handle banner updates
	const updateBanner = async (
		pityFive: number,
		pityFour: number,
		guaranteeFive: string | null = null,
		guaranteeFour: string | null = null
	): Promise<void> => {
		await database.set(`${userdb}.pityFive`, pityFive);
		await database.set(`${userdb}.pityFour`, pityFour);
		if (guaranteeFive !== null)
			await database.set(`${userdb}.guaranteeFive`, guaranteeFive);
		if (guaranteeFour !== null)
			await database.set(`${userdb}.guaranteeFour`, guaranteeFour);
	};

	// Handle five-star warp
	if (
		warpChance <
		chanceFive(banner.pityFive, banner.max, banner.soft, banner.chance)
	) {
		await updateBanner(0, parseInt(banner.pityFour.toString()) + 1);

		if (type !== "standard") {
			if (rateUp || banner.guaranteeFive === "true") {
				warpItem = randItem(getRateUpFive(vers, type));
				await updateBanner(
					0,
					parseInt(banner.pityFour.toString()) + 1,
					"false"
				);
			} else {
				warpItem = randItem(
					type === "weap"
						? getPoolFiveWeap(vers, type)
						: getPoolFiveChar(vers, type)
				);
				await updateBanner(
					0,
					parseInt(banner.pityFour.toString()) + 1,
					"true"
				);
			}
		} else {
			warpItem = char
				? randItem(getPoolFiveChar(vers, type))
				: randItem(getPoolFiveWeap(vers, type));
		}
	}
	// Handle four-star warp
	else if (warpChance < chanceFour(banner.pityFour, 0.051)) {
		await updateBanner(parseInt(banner.pityFive.toString()) + 1, 0);

		if (type !== "standard") {
			if (rateUp || banner.guaranteeFour === "true") {
				warpItem = randItem(getRateUpFour(vers, type));
				await updateBanner(
					parseInt(banner.pityFive.toString()) + 1,
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
					parseInt(banner.pityFive.toString()) + 1,
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
			parseInt(banner.pityFive.toString()) + 1,
			parseInt(banner.pityFour.toString()) + 1
		);
		warpItem = randItem(baseWeapons);
	}

	return warpItem;
}

async function createImage(
	id: string,
	warpResults: WarpResult[]
): Promise<Buffer> {
	const canvas = createCanvas(1920, 1080);
	const ctx = canvas.getContext("2d");

	// 優化圖片加載：並行加載所有圖片
	const imagePromises = [
		loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-result.webp"
		),
		loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/rings.webp"
		),
		loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/warp-results/five-back.webp"
		),
		loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/new.webp"
		),
		loadImage(
			"https://act.hoyolab.com/app/community-game-records-sea/images/character_r_5.99d42eb7.png"
		),
		loadImage("./src/assets/image/warp/eidolon-4star.png"),
		loadImage("./src/assets/image/warp/eidolon-5star.png"),
		loadImage("./src/assets/image/warp/undying-starlight.png"),
		loadImageAsync(
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/star.webp"
		)
	];

	const [
		background,
		ring,
		fivestarbg,
		newIcon,
		starlightbg,
		eidolon4Star,
		eidolon5Star,
		starlight,
		star
	] = await Promise.all(imagePromises);

	if (background) {
		ctx.drawImage(background, 0, 0, 1920, 1080);
	}

	if (warpResults.length === 10) {
		const data = await database.get(`${id}.sim`);

		if (ring) {
			ctx.drawImage(ring, -200, -300, 550, 550);
		}

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
		const dataBank: DataBank = (data && data.dataBank) || {};

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

			if (!image) continue; // 跳过未定义的图像

			// 检查 positions 数组边界
			if (Num - 1 >= positions.length) continue;

			ctx.save();
			ctx.translate(
				positions[Num - 1]?.x || 0,
				positions[Num - 1]?.y || 0
			);
			ctx.rotate(radians);

			if (item.rarity == 5 && fivestarbg) {
				ctx.drawImage(fivestarbg, -image.width / 2, -image.height / 2);
			}

			ctx.drawImage(image, -image.width / 2, -image.height / 2);

			if (item.element) {
				if (!(itemID in dataBank)) {
					if (newIcon) {
						ctx.drawImage(
							newIcon,
							-image.width / 2 + 380,
							-image.height / 2 + 20
						);
					}
					dataBank[itemID] = 1;
				} else {
					dataBank[itemID] = (dataBank[itemID] || 0) + 1;
					const width = 80;
					const height = 80;

					let xOffset = -image.width / 2 + 20;
					let yOffset = -image.height / 2 + 155;

					if (starlightbg) {
						ctx.drawImage(
							starlightbg,
							xOffset,
							yOffset,
							width,
							height
						);
					}

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

					if (starlight) {
						ctx.drawImage(
							starlight,
							xOffset + 8,
							yOffset + 8,
							64,
							64
						);
					}

					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					ctx.fillRect(xOffset + 4, yOffset + 58, 73, 20);

					ctx.font = "20px 'URW DIN Arabic', Arial, sans-serif' ";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(
						`x${item.rarity == 4 ? ((dataBank[itemID] || 0) < 7 ? "8" : "20") : (dataBank[itemID] || 0) < 7 ? "20" : "100"}`,
						xOffset + 40,
						yOffset + 75
					);

					if ((dataBank[itemID] || 0) < 7) {
						xOffset = -image.width / 2 + 120;

						const eidolonbg =
							item.rarity == 4 ? eidolon4Star : eidolon5Star;
						if (eidolonbg) {
							ctx.drawImage(
								eidolonbg,
								xOffset,
								yOffset,
								width,
								height
							);
						}

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
						if (eidolon) {
							ctx.drawImage(
								eidolon,
								xOffset + 8,
								yOffset + 8,
								64,
								64
							);
						}

						ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
						ctx.fillRect(xOffset + 4, yOffset + 58, 73, 20);

						ctx.font = "20px 'URW DIN Arabic', Arial, sans-serif' ";
						ctx.fillStyle = "white";
						ctx.textAlign = "center";
						ctx.fillText("x1", xOffset + 40, yOffset + 75);
					}
				}
			}

			dataBank[itemID] = Math.min(dataBank[itemID] || 0, 6);
			ctx.restore();
		}

		await database.set(`${id}.sim.dataBank`, dataBank);
	}

	if (warpResults.length === 1) {
		// 检查 warpResults[0] 是否存在
		if (!warpResults[0]) {
			throw new Error("No warp results found");
		}

		const degrees = 8;
		const radians = (Math.PI / 180) * degrees;
		const item = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/splash/${warpResults[0].name}.webp`
		);
		// star 已經在之前的 Promise.all 中加載了
		const Path = await loadImageAsync(
			`https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/path-${warpResults[0].path.toLowerCase().replace(/\s+/g, "-")}.webp`
		);

		ctx.save();
		if (background) {
			ctx.translate(background.width / 2, background.height / 2);
		}

		if (warpResults[0].element == "") {
			const back = await loadImageAsync(
				"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/glass-back.webp"
			);
			const front = await loadImageAsync(
				"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/main/public/assets/glass-front.webp"
			);

			ctx.rotate(radians);
			if (back) ctx.drawImage(back, -67 + 50, -237.5 + 40, 334, 475);
			ctx.drawImage(item, -67 + 25, -237.5, 334, 475);
			if (front) ctx.drawImage(front, -67, -237.5 + -25, 334, 475);

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
				(trans as any)[warpResults[0].name]?.["en"] ||
					warpResults[0].name,
				-item.width / 2 - 308,
				-item.height / 2 + 20
			);

			if (Path) {
				ctx.drawImage(
					Path,
					-item.width / 2 - 400,
					-item.height / 2 - 30,
					90,
					90
				);
			}

			for (let i = 1; i <= warpResults[0].rarity; i++) {
				if (star) {
					ctx.drawImage(
						star,
						-item.width / 2 - 330 + i * 22,
						-item.height / 2 + 35,
						22,
						22
					);
				}
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
				(trans as any)[warpResults[0].name]?.["en"] ||
					warpResults[0].name,
				-element.width / 2 - 308,
				-element.height / 2 + 20
			);

			if (element) {
				ctx.drawImage(
					element,
					-element.width / 2 - 400,
					-element.height / 2 - 30,
					90,
					90
				);
			}

			for (let i = 1; i <= warpResults[0].rarity; i++) {
				if (star) {
					ctx.drawImage(
						star,
						-element.width / 2 - 330 + i * 22,
						-element.height / 2 + 30,
						22,
						22
					);
				}
			}

			const gradient2 = ctx.createLinearGradient(0, 0, 234, 0);
			gradient2.addColorStop(0, "rgba(0, 0, 0, 0.5)");
			gradient2.addColorStop(1, "rgba(0, 0, 0, 0)");

			ctx.fillStyle = gradient2;
			ctx.translate(-element.width / 2 - 370, -element.height / 2 + 62);
			ctx.fillRect(0, 0, 192, 40);

			if (Path) {
				ctx.drawImage(
					Path,
					-element.width / 2 + 30,
					-element.height / 2 + 27,
					50,
					50
				);
			}

			ctx.font = "28px 'URW DIN Arabic'";
			ctx.fillStyle = "white";
			ctx.fillText(
				(trans as any)[
					warpResults[0].path.toLowerCase().replace(/\s+/g, "-")
				]?.["en"] || warpResults[0].path,
				-element.width / 2 + 80,
				-element.height / 2 + 62
			);
		}

		ctx.restore();
	}

	return canvas.toBuffer("image/png");
}

async function warpLogImage(
	tr: any,
	datas: any,
	title: string,
	userId?: string
): Promise<Buffer> {
	try {
		// 如果有用户ID，尝试获取合并后的历史记录
		let mergedData = datas;

		if (userId) {
			try {
				const savedHistory = await getWarpHistory(userId);
				if (savedHistory && savedHistory[title.toLowerCase()]) {
					const savedTypeData = savedHistory[title.toLowerCase()];
					const currentTypeData = datas;

					// 合并数据，使用时间戳去重
					const mergedItems = new Map();

					// 先添加已保存的数据
					if (savedTypeData.data && savedTypeData.data.length > 0) {
						savedTypeData.data.forEach((item: any) => {
							const key = `${item.id}_${item.time}`;
							mergedItems.set(key, item);
						});
					}

					// 再添加当前的新数据（会覆盖重复的）
					if (
						currentTypeData.data &&
						currentTypeData.data.length > 0
					) {
						currentTypeData.data.forEach((item: any) => {
							const key = `${item.id}_${item.time}`;
							mergedItems.set(key, item);
						});
					}

					// 转换为数组并按时间排序
					const mergedDataArray = Array.from(
						mergedItems.values()
					).sort((a: any, b: any) => {
						const timeA = new Date(a.time).getTime();
						const timeB = new Date(b.time).getTime();
						return timeB - timeA;
					});

					// 重新计算统计信息
					let total = mergedDataArray.length;
					let count = 0;
					const counts: number[] = [];

					// 从最新的数据开始计算保底
					for (let i = mergedDataArray.length - 1; i >= 0; i--) {
						const item = mergedDataArray[i];
						count++;
						if (item.rank === "5") {
							counts.push(count);
							count = 0;
						}
					}

					const pity = count;
					const average =
						counts.length > 0
							? parseFloat(
									(
										counts.reduce(
											(acc, val) => acc + val,
											0
										) / counts.length
									).toFixed(2)
								)
							: 0;

					// 创建合并后的数据结构
					mergedData = {
						...currentTypeData,
						data: mergedDataArray,
						total: total,
						pity: pity,
						average: average
					};

					console.log(
						`[WarpLogImage] 用户 ${userId} 的 ${title} 记录已合并，总计 ${total} 条记录`
					);
				}
			} catch (error) {
				console.error(
					`[WarpLogImage] 获取用户 ${userId} 的历史记录失败:`,
					error
				);
				// 如果获取失败，继续使用原始数据
			}
		}

		// 检查数据是否有效
		if (!mergedData || !mergedData.data) {
			throw new Error(tr("draw_InvalidData"));
		}

		// 限制处理的数据量，避免过多的渲染操作
		const maxItems = 23;
		const historyData = [...mergedData.data.slice(0, maxItems)];
		historyData.unshift({ count: mergedData.pity });

		// ... existing code for canvas creation and rendering ...
		// 创建画布 - 使用更小的尺寸以提高性能
		const canvas = createCanvas(1370, 900);
		const ctx = canvas.getContext("2d");

		// 使用离屏渲染缓存常用元素
		const circleCache = new Map();
		const rectCache = new Map();

		// 预加载所有图像资源，避免渲染过程中的等待
		const imagePromises = [
			// 背景和UI元素
			loadImageAsync("./src/assets/image/warp/bg.jpg").catch(() => null),
			loadImageAsync(image_Header + "icon/sign/DrawcardIcon.png"),
			loadImageAsync(image_Header + "icon/deco/StarBig.png"),
			loadImageAsync(image_Header + "icon/item/102.png"),
			loadImageAsync(image_Header + "icon/item/900001.png"),
			// 预加载角色/光锥图像
			...historyData.map((res: any, index: number) => {
				if (index === 0)
					return loadImageAsync(
						image_Header + "icon/character/None.png"
					);
				if (!res.id || !res.type) return Promise.resolve(null);
				const imagePath = `icon/${res.type == "light_cone" ? "light_cone" : "avatar"}/${res.id}.png`;
				return loadImageAsync(image_Header + imagePath);
			})
		];

		// 并行加载所有图像
		const [bg, drawIcon, star, item102, item900001, ...characterImages] =
			await Promise.all(imagePromises);

		// 绘制背景
		if (bg) {
			ctx.drawImage(bg, 0, 0, 1920, 1080);
		} else {
			// 创建一个简单的背景
			ctx.fillStyle = "#1A1A2E";
			ctx.fillRect(0, 0, 1370, 900);
		}

		// 绘制标题区域
		if (drawIcon) {
			ctx.drawImage(drawIcon, 50, 22.5, 64, 64);
		}
		ctx.font = "48px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#F1C376";
		ctx.textAlign = "left";
		ctx.fillText(`${title} ${tr("warplog_Title")}`, 130, 70);

		// 绘制统计信息 - 使用批处理减少状态切换
		const statItems = [
			{
				label: tr("warplog_Count"),
				value: `${mergedData.total}`,
				y: 250,
				icon: item102
			},
			{
				label: tr("warplog_Cost"),
				value: `${mergedData.total * 160}`,
				y: 300,
				icon: item900001
			},
			{
				label: tr("warplog_5Count"),
				value: `${mergedData?.data.length}`,
				y: 350
			},
			{
				label: tr("warplog_5CountAverage"),
				value: `${mergedData.average}`,
				y: 400
			}
		];

		// 批量绘制标签
		ctx.font = "bold 24px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		for (const item of statItems) {
			ctx.fillText(item.label, 55, item.y);
		}

		// 批量绘制值
		ctx.font = "bold 24px 'URW DIN Arabic', Arial, sans-serif'";
		ctx.fillStyle = "#80B3FF";
		ctx.textAlign = "right";
		for (const item of statItems) {
			ctx.fillText(item.value, 400, item.y + 2.5);
		}

		// 绘制图标
		for (const item of statItems) {
			if (item.icon) {
				ctx.drawImage(item.icon, 410, item.y - 25, 36, 36);
			}
		}

		// 绘制历史记录标题
		if (star) {
			ctx.drawImage(star, 530, 103, 60, 60);
		}
		ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif'";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(`${tr("warplog_React")}`, 600, 145);

		// 创建进度条颜色映射函数
		const getProgressColor = (progress: number): string => {
			if (progress <= 50) return "#9DF1DF";
			if (progress <= 70) return "#FFBB5C";
			return "#FF6969";
		};

		// 预先计算布局
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

		// 创建圆形进度条缓存函数
		const getCircleCanvas = (
			progress: number,
			radius: number,
			lineWidth: number
		): Canvas => {
			const cacheKey = `${progress}-${radius}-${lineWidth}`;
			if (circleCache.has(cacheKey)) return circleCache.get(cacheKey);

			const size = (radius + lineWidth) * 2;
			const circleCanvas = createCanvas(size, size);
			const circleCtx = circleCanvas.getContext("2d");

			const centerX = size / 2;
			const centerY = size / 2;
			const startAngle = -Math.PI / 2;
			const endAngle = startAngle + (progress / 100) * (2 * Math.PI);

			// 绘制背景
			circleCtx.beginPath();
			circleCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			circleCtx.lineWidth = lineWidth;
			circleCtx.strokeStyle = "#000000";
			circleCtx.stroke();

			// 绘制进度
			circleCtx.beginPath();
			circleCtx.arc(centerX, centerY, radius, startAngle, endAngle);
			circleCtx.lineWidth = lineWidth;
			circleCtx.strokeStyle = getProgressColor(progress);
			circleCtx.lineCap = "round";
			circleCtx.stroke();

			circleCache.set(cacheKey, circleCanvas);
			return circleCanvas;
		};

		// 创建矩形计数框缓存函数
		const getRectCanvas = (): Canvas => {
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

		// 批量绘制历史记录
		const radius = 55;
		const lineWidth = 8;
		const rectCanvas = getRectCanvas();

		// 使用requestAnimationFrame模拟的批处理渲染
		for (let i = 0; i < historyData.length; i++) {
			try {
				const res = historyData[i];
				if (!res) continue;

				const progress = res.count || 0;
				const layoutItem = layout[i];
				if (!layoutItem) continue;

				const { centerX, centerY, rectX, rectY } = layoutItem;

				// 绘制进度圆
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

				// 绘制角色/光锥图像
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

				// 绘制计数框
				ctx.drawImage(rectCanvas, rectX, rectY);

				// 绘制计数文本
				ctx.font = "bold 20px 'URW DIN Arabic', Arial, sans-serif'";
				ctx.fillStyle = "#000000";
				ctx.textAlign = "center";
				ctx.fillText(`${progress}`, rectX + 30, rectY + 22.5);
			} catch {
				// 静默处理错误，继续下一个项目
				continue;
			}
		}

		// 清理缓存
		circleCache.clear();
		rectCache.clear();

		// 返回结果
		const result = canvas.toBuffer("image/png");
		if (!result) {
			throw new Error(tr("draw_CanvasError"));
		}
		return result;
	} catch (e) {
		throw new Error(tr("draw_Error") + ": " + (e as Error).message);
	}
}

/**
 * 保存用戶抽卡紀錄到資料庫
 * @param {string} userId - 用戶ID
 * @param {Object} warpData - 抽卡資料
 */
async function saveWarpHistory(
	userId: string,
	warpData: WarpHistory
): Promise<WarpHistory> {
	try {
		// 獲取現有記錄
		const existingData = (await database.get(`${userId}.warpHistory`)) || {
			character: { total: 0, data: [], lastUpdated: 0 },
			light_cone: { total: 0, data: [], lastUpdated: 0 },
			regular: { total: 0, data: [], lastUpdated: 0 },
			lastUpdated: 0
		};

		// 合併新資料，使用時間戳進行去重
		for (const type of ["character", "light_cone", "regular"]) {
			if (
				warpData[type as keyof WarpHistory] &&
				warpData[type as keyof WarpHistory].data
			) {
				const newItems = warpData[type as keyof WarpHistory].data;
				const existingItems = existingData[type].data || [];

				// 創建現有資料的查找映射，使用 item_id + time 作為唯一鍵
				const existingMap = new Map();
				existingItems.forEach((item: WarpItem) => {
					const key = `${item.id}_${item.time}`;
					existingMap.set(key, item);
				});

				// 過濾出真正的新資料
				const trulyNewItems = newItems.filter((newItem: WarpItem) => {
					const key = `${newItem.id}_${newItem.time}`;
					return !existingMap.has(key);
				});

				// 合併資料，新資料放在前面（時間更近）
				existingData[type].data = [...trulyNewItems, ...existingItems];

				// 按時間排序，最新的在前面
				existingData[type].data.sort((a: WarpItem, b: WarpItem) => {
					const timeA = new Date(a.time).getTime();
					const timeB = new Date(b.time).getTime();
					return timeB - timeA;
				});

				// 更新總數和統計信息
				existingData[type].total = existingData[type].data.length;

				// 重新計算平均值和保底計數
				if (existingData[type].data.length > 0) {
					let count = 0;
					const counts: number[] = [];

					// 從最新的資料開始計算保底
					for (
						let i = existingData[type].data.length - 1;
						i >= 0;
						i--
					) {
						const item = existingData[type].data[i];
						count++;
						if (item.rank === "5") {
							counts.push(count);
							count = 0;
						}
					}

					// 當前保底計數
					existingData[type].pity = count;

					// 計算平均保底
					existingData[type].average =
						counts.length > 0
							? parseFloat(
									(
										counts.reduce(
											(acc, val) => acc + val,
											0
										) / counts.length
									).toFixed(2)
								)
							: 0;
				}

				// 記錄該類型資料的最後更新時間
				existingData[type].lastUpdated = Date.now();
			}
		}

		// 更新整體最後更新時間
		existingData.lastUpdated = Date.now();

		// 保存到資料庫
		await database.set(`${userId}.warpHistory`, existingData);

		console.log(
			`[Warp History] 用戶 ${userId} 的抽卡紀錄已更新，新增 ${warpData.character?.data?.length || 0} 條角色記錄，${warpData.light_cone?.data?.length || 0} 條光錐記錄`
		);

		return existingData;
	} catch (error) {
		console.error("保存抽卡紀錄失敗:", error);
		throw error;
	}
}

/**
 * 獲取用戶抽卡紀錄
 * @param {string} userId - 用戶ID
 * @param {string} type - 記錄類型 (character, light_cone, regular)
 * @returns {Object} 抽卡紀錄
 */
async function getWarpHistory(
	userId: string,
	type: string | null = null
): Promise<any> {
	try {
		const history = await database.get(`${userId}.warpHistory`);
		if (!history) return null;

		if (type && history[type]) {
			return history[type];
		}

		return history;
	} catch (error) {
		console.error("獲取抽卡紀錄失敗:", error);
		return null;
	}
}

/**
 * 導入用戶抽卡紀錄
 * @param {string} userId - 用戶ID
 * @param {Object} importedData - 要導入的抽卡紀錄資料
 * @returns {Object} 導入的抽卡紀錄
 */
async function importWarpHistory(
	userId: string,
	importedData: any
): Promise<any> {
	try {
		// 驗證資料格式
		if (
			!importedData.character ||
			!importedData.light_cone ||
			!importedData.regular
		) {
			throw new Error("無效的抽卡紀錄格式");
		}

		// 保存到資料庫
		await database.set(`${userId}.warpHistory`, importedData);

		return importedData;
	} catch (error) {
		console.error("導入抽卡紀錄失敗:", error);
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
	importWarpHistory,
	setupWarpImageCacheCleanup,
	clearWarpImageCache
};
