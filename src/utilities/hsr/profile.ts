import { database } from "../../index.js";
import { getUserBg, getTodayBg } from "./wallpaperManager.js";
import {
	requestPlayerData,
	drawInQueueReply,
	getRandomColor,
	requestPlayerActivity,
	getUserHSRData,
	getUserGameInfo,
	getUserCookie,
	getFriendlyErrorMessage
} from "../index.js";

// 異常仲裁輪次記錄接口
interface AnomalyRoundRecord {
	roundNum: number;
	expireTime: number;
}

// 異常仲裁徽章記錄接口
interface AnomalyRankRecord {
	mazeId: number;
	groupName: string;
	rankIcon: string;
	rankIconType: string;
	expireTime: number;
	challengeTime: number; // 挑戰時間戳
}

const ANOMALY_BADGE_AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

function toUnixTimestamp(
	time?: {
		year?: number;
		month?: number;
		day?: number;
		hour?: number;
		minute?: number;
	} | null
): number {
	if (!time?.year || !time?.month || !time?.day) return 0;
	const date = new Date(
		time.year,
		time.month - 1,
		time.day,
		time.hour || 0,
		time.minute || 0
	);
	return Math.floor(date.getTime() / 1000);
}

async function tryAutoSyncCurrentAnomalyBadge(
	interaction: any,
	tr: any,
	user: any,
	uid: string,
	accountIndex: number
): Promise<void> {
	if (!uid) return;

	const nowSec = Math.floor(Date.now() / 1000);
	const nowMs = Date.now();
	const recordsKey = `${uid}.anomalyRankIcon`;
	const roundKey = `${uid}.anomalyRoundNum`;
	const syncAtKey = `${uid}.anomalyBadgeAutoSyncAt`;

	// 永久保留所有歷史徽章，不以 expireTime 過濾
	const existingRecords =
		((await database.get(recordsKey)) as AnomalyRankRecord[]) || [];

	// 節流：6 小時內不重複同步（但仍不清除舊記錄）
	const lastSyncAt = (await database.get(syncAtKey)) as number | null;
	if (
		typeof lastSyncAt === "number" &&
		nowMs - lastSyncAt < ANOMALY_BADGE_AUTO_SYNC_INTERVAL_MS
	) {
		return;
	}

	await database.set(syncAtKey, nowMs);

	try {
		const hsr = await getUserHSRData(
			interaction,
			tr,
			user.id,
			accountIndex,
			{ suppressErrorReply: true }
		);

		if (!hsr) return;

		const anomalyRes = (await hsr.record.forgottenHall(
			4 as any,
			1 as any
		)) as any;
		const challengePeakRecords = anomalyRes?.challenge_peak_records;

		if (
			!Array.isArray(challengePeakRecords) ||
			!challengePeakRecords.length
		) {
			return;
		}

		// 遍歷所有期，全部 upsert 進去（永久保留）
		const upsertRecords = [...existingRecords];

		for (const record of challengePeakRecords) {
			if (!record?.boss_record?.has_challenge_record) continue;

			const expireTime = toUnixTimestamp(record.group?.end_time);
			const rankIcon = record?.boss_record?.challenge_peak_rank_icon;
			if (!rankIcon) continue;

			const rankRecord: AnomalyRankRecord = {
				mazeId: record?.boss_info?.maze_id || 0,
				groupName: record?.group?.name_mi18n || "",
				rankIcon,
				rankIconType:
					record?.boss_record?.challenge_peak_rank_icon_type || "",
				expireTime: expireTime || 0,
				challengeTime: toUnixTimestamp(
					record?.boss_record?.challenge_time
				)
			};

			const existingIndex = upsertRecords.findIndex(
				r => r.mazeId === rankRecord.mazeId
			);

			if (existingIndex >= 0) {
				console.log(`[Profile] Sync: Updating mazeId ${rankRecord.mazeId} (${rankRecord.groupName})`);
				upsertRecords[existingIndex] = rankRecord;
			} else {
				console.log(`[Profile] Sync: Adding mazeId ${rankRecord.mazeId} (${rankRecord.groupName})`);
				upsertRecords.push(rankRecord);
			}

			// 同時更新最新一期的 roundNum（用於顯示仲裁輪次圖標）
			if (expireTime > nowSec) {
				const roundNum = record?.boss_record?.round_num;
				if (typeof roundNum === "number") {
					await database.set(roundKey, { roundNum, expireTime } as AnomalyRoundRecord);
				}
			}
		}

		await database.set(recordsKey, upsertRecords);
		console.log(`[Profile] Sync done: ${upsertRecords.length} badge(s) stored for UID ${uid}`);
	} catch (error) {
		console.warn("[Profile] Auto sync anomaly badge failed:", error);
	}
}

// 獲取異常仲裁圖標路徑
function getAnomalyIconPath(roundNum: number): string | null {
	if (roundNum === 0) return "./src/assets/image/226004.png";
	if (roundNum >= 1 && roundNum <= 2) return "./src/assets/image/226003.png";
	if (roundNum >= 3 && roundNum <= 4) return "./src/assets/image/226002.png";
	if (roundNum >= 5 && roundNum <= 6) return "./src/assets/image/226001.png";
	return null; // 6以上不使用
}
import { createChunkedSelectMenus, createPagedSelectMenu } from "./selectmenu.js";
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
import axios from "axios";
import { writeFile, mkdir, access } from "fs/promises";
import { existsSync } from "fs";
import {
	loadLightConeData,
	buildPathMap,
	loadPathsData,
	loadElementsData
} from "./jsonManager.js";

// 類型定義
interface PlayerData {
	player: {
		nickname: string;
		uid: string;
		level: number;
		world_level?: number;
		avatar: { icon: string };
		space_info?: {
			avatar_count: number;
			achievement_count: number;
		};
	};
	characters: Character[];
}

interface Character {
	id: string;
	name: string;
	level: number;
	rank: number;
	rank_icons?: string[];
	rarity: number;
	icon: string;
	preview?: string;
	portrait?: string;
	image?: string;
	element:
		| {
				id: string;
				icon: string;
				color: string;
		  }
		| string;
	path?:
		| {
				id: string;
				name: string;
				icon: string;
		  }
		| string;
	base_type?: number;
	attributes?: Attribute[];
	additions?: Attribute[];
	properties?: Property[];
	relics?: Relic[];
	ornaments?: Relic[];
	light_cone?: LightCone;
	equip?: LightCone;
	skills?: Skill[];
	skill_trees?: SkillTree[];
	servant_detail?: {
		servant_skills: ServantSkill[];
	};
}

interface Attribute {
	field: string;
	value: number;
	display?: string;
	name?: string;
	icon?: string;
	final?: string | number;
	base?: string | number;
	add?: string | number;
}

interface Property {
	property_type: number;
	base: string;
	add: string;
	final: string;
	icon?: string;
	name?: string;
}

interface Relic {
	id: string;
	name: string;
	level: number;
	rarity: number;
	icon: string;
	main_affix?: {
		name: string;
		display: string;
		value: string;
		weight: number;
		icon: string;
		propertyName?: string;
	};
	main_property?: {
		property_type: number;
		value: string;
	};
	sub_affix?: SubAffix[];
	properties?: SubAffix[];
}

interface SubAffix {
	name: string;
	display: string;
	value: string;
	weight: number;
	icon: string;
	property_type: number;
	propertyName?: string;
	count?: number;
	times?: number;
}

interface LightCone {
	id: string;
	name: string;
	level: number;
	rank: number;
	icon: string;
}

interface Skill {
	id?: string;
	point_type: number;
	item_url?: string;
	icon: string;
	type?: string;
	type_text?: string;
	remake?: string;
	level: number;
}

interface SkillTree {
	id: string;
	level: number;
	anchor: string;
	max_level: number;
	icon: string;
	parent: string | null;
}

interface ServantSkill {
	item_url?: string;
	icon: string;
	remake: string;
	level: number;
}

interface PlayerActivity {
	info: ActivityInfo[];
}

interface ActivityInfo {
	content: {
		icon: string;
	};
	text: string;
}

interface LeaderboardEntry {
	uid: string;
	nickname: string;
	avatar: string;
	score: number;
	lastUpdated: number;
	characterLevel: number;
	characterRank: number;
	previousScore?: number;
	scoreImproved?: boolean;
}

interface LeaderboardData {
	id: string;
	icon: string;
	element: {
		id: string;
		color: string;
	};
	score: LeaderboardEntry[];
	stats: {
		totalParticipants: number;
		averageScore: string;
		highestScore: number;
		lastUpdated: number;
	};
	lastUpdated: number;
}

interface Leaderboard {
	[characterId: string]: LeaderboardData;
}

interface FilterInfo {
	filters: string[];
	sortType?: string;
}

interface ImageResult {
	image: any;
	usedFallback: boolean;
}

interface RelicScore {
	totalScore: string;
	totalGrade: {
		grade: string;
		color: string;
	};
	[i: number]: {
		scoreN: number;
		grade: {
			grade: string;
			color: string;
		};
	};
}

interface TextSegment {
	text: string;
	color: string;
}

const db = database;

const DRAW_QUEUE_MAX = 50;
const drawQueue = new Queue({ autostart: true, concurrency: 1 });
// 移除預設 error handler（它會呼叫 end() 停止整個 queue）
// 改為只記錄錯誤，讓 queue 繼續執行後續任務
drawQueue.removeEventListener("error", (drawQueue as any)._errorHandler);
drawQueue.addEventListener("error", (evt: any) => {
	console.error("[DrawQueue] Task error (queue continues):", evt?.detail?.error);
});

const image_Header =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master";

// 圖片下載配置
const IMAGE_DOWNLOAD_CONFIG = {
	character_portrait: {
		remoteBase: `${image_Header}/image/character_portrait/`,
		localDir: "./src/assets/image/character_portrait",
		extension: ".png"
	}
};

// 圖片下載緩存
const imageDownloadCache = new Map<string, Promise<string | null>>();

// 確保目錄存在
async function ensureImageDir(localDir: string): Promise<void> {
	try {
		await access(localDir);
	} catch {
		await mkdir(localDir, { recursive: true });
		console.log(`[Image Download] Created directory: ${localDir}`);
	}
}

// 通用圖片下載函數
async function downloadImage(
	imageType: keyof typeof IMAGE_DOWNLOAD_CONFIG,
	imageId: string
): Promise<string | null> {
	const config = IMAGE_DOWNLOAD_CONFIG[imageType];
	const remoteUrl = `${config.remoteBase}${imageId}${config.extension}`;
	const localPath = `${config.localDir}/${imageId}${config.extension}`;
	const cacheKey = `${imageType}:${imageId}`;

	// 檢查緩存
	if (imageDownloadCache.has(cacheKey)) {
		return await imageDownloadCache.get(cacheKey)!;
	}

	// 檢查本地文件是否已存在
	if (existsSync(localPath)) {
		return localPath;
	}

	// 創建下載 Promise
	const downloadPromise = (async () => {
		try {
			// 確保目錄存在
			await ensureImageDir(config.localDir);

			// 下載圖片
			console.log(
				`[Image Download] Downloading ${imageType}: ${imageId}`
			);
			const response = await axios.get(remoteUrl, {
				responseType: "arraybuffer",
				timeout: 10000
			});

			// 保存到本地
			await writeFile(localPath, response.data);
			console.log(`[Image Download] Downloaded ${imageType}: ${imageId}`);

			return localPath;
		} catch (error) {
			console.warn(
				`[Image Download] Failed to download ${imageType}:${imageId}`,
				error
			);
			return null;
		}
	})();

	// 緩存 Promise
	imageDownloadCache.set(cacheKey, downloadPromise);

	// 30秒後清理緩存
	setTimeout(() => {
		imageDownloadCache.delete(cacheKey);
	}, 30000).unref();

	return await downloadPromise;
}

// 批量下載圖片
async function downloadImages(
	imageType: keyof typeof IMAGE_DOWNLOAD_CONFIG,
	imageIds: string[]
): Promise<void> {
	const downloadPromises = imageIds.map(async imageId => {
		try {
			await downloadImage(imageType, imageId);
		} catch (error) {
			console.warn(
				`[Image Download] Failed to download ${imageType}:${imageId}`,
				error
			);
		}
	});

	// 並行下載，但限制並發數以避免過度負載
	const batchSize = 5;
	for (let i = 0; i < downloadPromises.length; i += batchSize) {
		const batch = downloadPromises.slice(i, i + batchSize);
		await Promise.allSettled(batch);
	}
}

// 下載角色頭像 (使用通用函數)
async function downloadCharacterPortrait(
	characterId: string
): Promise<string | null> {
	return await downloadImage("character_portrait", characterId);
}

// 批量下載角色頭像 (使用通用函數)
async function downloadCharacterPortraits(
	characters: Character[]
): Promise<void> {
	const characterIds = characters.map(char => char.id);
	await downloadImages("character_portrait", characterIds);
}

// 處理角色皮膚圖片
async function handleCharacterSkin(character: Character): Promise<string> {
	// const localSkinPath = `./src/assets/image/character_skin/${character.id}.webp`;

	// // 如果本地已有皮膚圖片，直接返回
	// if (existsSync(localSkinPath)) {
	// 	return localSkinPath;
	// }

	try {
		// [註解] 因為 hakush.in 已失效，暫時停用自動下載皮膚邏輯
		/*
		// 請求角色皮膚數據
		const response = await fetch(
			`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cn/characters.json`
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		const skinData = data.Skin;

		if (!skinData || typeof skinData !== "object") {
			throw new Error("Invalid skin data format");
		}

		// 獲取皮膚ID
		const skinId = Object.keys(skinData)[0];
		if (!skinId) {
			throw new Error(`No skin ID found for character ${character.id}`);
		}

		// 構建皮膚圖片URL
		const skinImageUrl = `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/image/character_skin/${skinId}.png`;

		// 下載並保存皮膚圖片
		const skinResponse = await fetch(skinImageUrl);
		if (!skinResponse.ok) {
			throw new Error(
				`Failed to download skin image: HTTP ${skinResponse.status}`
			);
		}

		const skinImageBuffer = await skinResponse.arrayBuffer();
		await writeFile(localSkinPath, Buffer.from(skinImageBuffer));

		return localSkinPath;
		*/
		return character?.image || "";
	} catch (error) {
		console.warn(
			`[Skin Handler] Failed to process skin for ${character.id}:`,
			error
		);
		return character?.image || "";
	}
}

// 處理角色頭像圖片
async function handleCharacterPortrait(
	character: Character,
	imageHeader: string
): Promise<{ imageUrl: string; fallbackUrl: string | null }> {
	const localPortraitPath = `./src/assets/image/character_portrait/${character.id}.png`;

	// 優先使用本地頭像
	if (existsSync(localPortraitPath)) {
		return { imageUrl: localPortraitPath, fallbackUrl: null };
	}

	// 使用portrait字段
	if (character?.portrait) {
		const imageUrl = imageHeader + "/" + character.portrait;
		const fallbackUrl = character?.image || null;

		// 異步下載角色頭像（不阻塞圖片繪製）
		downloadCharacterPortrait(character.id).catch(error => {
			console.warn(
				`[Character Portrait] Background download failed for ${character.id}:`,
				error
			);
		});

		return { imageUrl, fallbackUrl };
	}

	// 使用標準角色頭像路徑
	const imageUrl = `${imageHeader}/image/character_portrait/${character.id}.png`;
	const fallbackUrl = character?.image || null;

	// 異步下載角色頭像（不阻塞圖片繪製）
	downloadCharacterPortrait(character.id).catch(error => {
		console.warn(
			`[Character Portrait] Background download failed for ${character.id}:`,
			error
		);
	});

	return { imageUrl, fallbackUrl };
}

// 動態 pathMap：從 StarRailRes paths.json 建立，自動支持新命途
const FALLBACK_PATH_MAP: Record<number, string> = {
	1: "destruction",
	2: "the hunt",
	3: "erudition",
	4: "harmony",
	5: "nihility",
	6: "preservation",
	7: "abundance",
	8: "remembrance",
	9: "elation"
};
let _cachedPathMap: Record<number, string> | null = null;
async function getPathMap(): Promise<Record<number, string>> {
	if (_cachedPathMap) return _cachedPathMap;
	try {
		const dynamicMap = await buildPathMap("en");
		if (Object.keys(dynamicMap).length > 0) {
			_cachedPathMap = dynamicMap;
			return dynamicMap;
		}
	} catch (e) {
		console.warn(
			"[Profile] Failed to load dynamic pathMap, using fallback",
			e
		);
	}
	_cachedPathMap = FALLBACK_PATH_MAP;
	return FALLBACK_PATH_MAP;
}

export const propertyMap: { [key: number]: string } = {
	1: "MaxHP",
	2: "Attack",
	3: "Defence",
	4: "Speed",
	5: "CriticalChance",
	6: "CriticalDamage",
	7: "HealRatio",
	// 8: ""
	9: "EnergyRecovery",
	10: "StatusProbability",
	11: "StatusResistance",
	12: "PhysicalAddedRatio",
	14: "FireAddedRatio",
	16: "IceAddedRatio",
	18: "ThunderAddedRatio",
	20: "WindAddedRatio",
	22: "QuantumAddedRatio",
	24: "ImaginaryAddedRatio",
	27: "MaxHP", // 小生命
	29: "Attack", // 小攻擊
	31: "Defence", // 小防禦
	32: "MaxHP", // 大生命
	33: "Attack", // 大攻擊
	34: "Defence", // 大防禦
	51: "Speed",
	52: "CriticalChance",
	53: "CriticalDamage",
	54: "EnergyRecovery",
	55: "HealRatio",
	56: "StatusProbability",
	57: "StatusResistance",
	58: "BreakUp",
	59: "BreakUp",
	// 歡愉 (Elation) DMG Added Ratio — added in a later patch; HoYoLAB does not
	// supply name/icon for this type, so we map it here.
	// Icon file: iconJoy.png; translation key: property_Joy
	71: "Joy"
};

// 為 loadImageAsync 添加 cache 屬性
interface LoadImageAsyncFunction {
	(url: string, fallbackUrl?: string | null): Promise<ImageResult>;
	cache?: Map<string, any>;
}

const MAX_CACHE_SIZE = 20; // 最大快取數量

export function clearImageCache(): void {
	if (loadImageAsync.cache) {
		loadImageAsync.cache.clear();
	}
}

const MIHOMO_CDN_BASE = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
const EIDOLON_ICON_SIZE = 48;
const EIDOLON_ICON_GAP = 6;
/** Total width occupied by all 6 eidolon icons + gaps */
export const EIDOLON_BLOCK_WIDTH = 6 * EIDOLON_ICON_SIZE + 5 * EIDOLON_ICON_GAP; // 318

/**
 * Draws 6 eidolon icons horizontally.
 * Unlocked icons (index < unlockedCount) get a white circular border.
 * Locked icons get a semi-transparent black overlay.
 *
 * @param ctx        Canvas 2D context
 * @param rankIcons  character.rank_icons (6-element array of relative paths)
 * @param unlockedCount  character.rank (0–6)
 * @param x          Left edge of first icon
 * @param baselineY  Text baseline used by surrounding code (icons are vertically centred here)
 */
async function drawEidolonIcons(
	ctx: any,
	rankIcons: string[],
	unlockedCount: number,
	centerX: number,
	centerY: number
): Promise<void> {
	const size = EIDOLON_ICON_SIZE;
	const gap = EIDOLON_ICON_GAP;
	// Calculate left edge so icons are centred on centerX
	const x = centerX - EIDOLON_BLOCK_WIDTH / 2;
	const top = centerY - size / 2;

	for (let i = 0; i < 6; i++) {
		const iconX = x + i * (size + gap);
		const iconY = top;
		const cx = iconX + size / 2;
		const cy = iconY + size / 2;
		const r = size / 2;

		// Load icon from CDN — rankIcons[i] may be a full URL (HoYoLAB path)
		// or a relative path (mihomo path); only prepend the CDN base for relative paths.
		const rawIcon = rankIcons[i];
		const iconPath = rawIcon
			? rawIcon.startsWith("http")
				? rawIcon
				: `${MIHOMO_CDN_BASE}${rawIcon}`
			: null;

		const iconResult = iconPath ? await loadImageAsync(iconPath) : null;

		ctx.save();

		// Clip to circle
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.clip();

		if (iconResult?.image) {
			ctx.drawImage(iconResult.image, iconX, iconY, size, size);
		} else {
			// Grey placeholder circle when image fails to load
			ctx.fillStyle = "rgba(100,100,100,0.8)";
			ctx.fillRect(iconX, iconY, size, size);
		}

		// Locked overlay + lock icon
		if (i >= unlockedCount) {
			ctx.fillStyle = "rgba(0,0,0,0.55)";
			ctx.fillRect(iconX, iconY, size, size);
		}

		ctx.restore();

		// White border for unlocked icons (drawn outside clip so border isn't cut)
		if (i < unlockedCount) {
			ctx.save();
			ctx.strokeStyle = "rgba(255,255,255,0.9)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}

		// Lock icon drawn on top for locked icons
		if (i >= unlockedCount) {
			ctx.save();
			const lw = size * 0.28; // lock body width
			const lh = size * 0.22; // lock body height
			const lx = cx - lw / 2;
			const ly = cy - lh * 0.1; // slightly below centre
			const shackleW = lw * 0.55;
			const shackleH = lh * 1.1;
			const shackleX = cx - shackleW / 2;
			const shackleY = ly - shackleH;

			ctx.strokeStyle = "rgba(255,255,255,0.85)";
			ctx.fillStyle = "rgba(255,255,255,0.85)";
			ctx.lineWidth = size * 0.07;
			ctx.lineCap = "round";

			// Shackle (U-shape arc)
			ctx.beginPath();
			ctx.arc(
				cx,
				shackleY + shackleH * 0.55,
				shackleW / 2,
				Math.PI,
				0
			);
			ctx.stroke();

			// Lock body (rounded rect)
			const br = size * 0.06;
			ctx.beginPath();
			ctx.moveTo(lx + br, ly);
			ctx.lineTo(lx + lw - br, ly);
			ctx.arcTo(lx + lw, ly, lx + lw, ly + br, br);
			ctx.lineTo(lx + lw, ly + lh - br);
			ctx.arcTo(lx + lw, ly + lh, lx + lw - br, ly + lh, br);
			ctx.lineTo(lx + br, ly + lh);
			ctx.arcTo(lx, ly + lh, lx, ly + lh - br, br);
			ctx.lineTo(lx, ly + br);
			ctx.arcTo(lx, ly, lx + br, ly, br);
			ctx.closePath();
			ctx.fill();

			ctx.restore();
		}
	}
}

const loadImageAsync: LoadImageAsyncFunction = async (
	url: string,
	fallbackUrl: string | null = null
): Promise<ImageResult> => {
	try {
		if (!loadImageAsync.cache) loadImageAsync.cache = new Map();

		// 檢查快取
		if (loadImageAsync.cache!.has(url)) {
			const cachedImage = loadImageAsync.cache!.get(url);
			// 提升快取優先級 (LRU-like behavior for Map)
			loadImageAsync.cache!.delete(url);
			loadImageAsync.cache!.set(url, cachedImage);
			return {
				image: cachedImage,
				usedFallback: false
			};
		}

		// 下載前檢查快取大小
		if (loadImageAsync.cache!.size >= MAX_CACHE_SIZE) {
			// 刪除最舊的快取 (第一個鍵)
			const firstKey = loadImageAsync.cache!.keys().next().value;
			if (firstKey) loadImageAsync.cache!.delete(firstKey);
		}

		// 並行檢查 fallback 快取
		let fallbackCached = null;
		if (fallbackUrl && loadImageAsync.cache!.has(fallbackUrl)) {
			fallbackCached = loadImageAsync.cache!.get(fallbackUrl);
		}

		// 嘗試載入主圖片
		try {
			// 檢查URL是否有效
			if (!url || url.trim() === "") {
				throw new Error("Invalid URL");
			}

			// 對遠端 URL，先用 axios 下載成 Buffer 再傳給 loadImage
			// 避免 @napi-rs/canvas 的 native HTTP client 在雲端伺服器上被 GitHub CDN RST
			let imageSource: string | Buffer = url;
			if (url.startsWith("http://") || url.startsWith("https://")) {
				const response = await axios.get(url, {
					responseType: "arraybuffer",
					timeout: 15000
				});
				imageSource = Buffer.from(response.data);
			}

			const image = await loadImage(imageSource);
			loadImageAsync.cache!.set(url, image);
			return { image, usedFallback: false };
		} catch (error) {
			// 如果主圖片載入失敗，使用快取的 fallback 或嘗試載入 fallback
			if (fallbackCached) {
				return {
					image: fallbackCached,
					usedFallback: true
				};
			}

			if (fallbackUrl && fallbackUrl.trim() !== "") {
				try {
					if (!loadImageAsync.cache!.has(fallbackUrl)) {
						let fallbackSource: string | Buffer = fallbackUrl;
						if (fallbackUrl.startsWith("http://") || fallbackUrl.startsWith("https://")) {
							const fbResponse = await axios.get(fallbackUrl, {
								responseType: "arraybuffer",
								timeout: 15000
							});
							fallbackSource = Buffer.from(fbResponse.data);
						}
						const fallbackImage = await loadImage(fallbackSource);
						loadImageAsync.cache!.set(fallbackUrl, fallbackImage);
					}
					return {
						image: loadImageAsync.cache!.get(fallbackUrl),
						usedFallback: true
					};
				} catch (fallbackError) {
					console.warn(
						`Failed to load fallback image: ${fallbackUrl}`,
						(fallbackError as Error).message
					);
				}
			}

			// 使用本地預設圖片
			const defaultUrl =
				"./src/assets/image/icon/property/iconAttack.png";
			try {
				if (!loadImageAsync.cache!.has(defaultUrl)) {
					const defaultImage = await loadImage(defaultUrl);
					loadImageAsync.cache!.set(defaultUrl, defaultImage);
				}
				return {
					image: loadImageAsync.cache!.get(defaultUrl),
					usedFallback: false
				};
			} catch (defaultError) {
				console.error(
					`Failed to load default image: ${defaultUrl}`,
					(defaultError as Error).message
				);
				// 如果連預設圖片都無法載入，創建一個簡單的空白圖片
				const canvas = createCanvas(64, 64);
				const ctx = canvas.getContext("2d");
				ctx.fillStyle = "#666";
				ctx.fillRect(0, 0, 64, 64);
				const fallbackImage = await loadImage(
					canvas.toBuffer("image/webp")
				);
				loadImageAsync.cache!.set(defaultUrl, fallbackImage);
				return {
					image: fallbackImage,
					usedFallback: false
				};
			}
		}
	} catch (error) {
		console.error(`Unexpected error in loadImageAsync: ${url}`, error);
		// 創建簡單的空白圖片作為最後的備用方案
		const canvas = createCanvas(64, 64);
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#666";
		ctx.fillRect(0, 0, 64, 64);
		const fallbackImage = await loadImage(canvas.toBuffer("image/webp"));
		return {
			image: fallbackImage,
			usedFallback: false
		};
	}
};

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "RPG_CN.ttf"),
	"YaHei"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "Cinzel.ttf"),
	"Cinzel"
);

function containsChinese(text: string): boolean {
	return /[\u4e00-\u9fa5]/.test(text);
}

// 渲染屬性列表的輔助函數
async function renderAttributesList(
	ctx: any,
	attributes: Attribute[],
	startX: number,
	startY: number,
	spacing: number,
	effectiveSet?: Set<string>
): Promise<void> {
	// 過濾掉 0/0%/0.0%/0.00%/0.0/0 的屬性
	const filtered = attributes.filter(attribute => {
		const v = attribute.display ?? attribute.value ?? attribute.final;
		if (typeof v === "string") {
			return !/^0(\.0+)?%?$/.test(v.trim());
		} else if (typeof v === "number") {
			return v !== 0;
		}
		return true;
	});
	for (let i = 0; i < filtered.length; i++) {
		const attribute = filtered[i];
		if (!attribute) continue;

		const y = startY + i * spacing;

		// 判斷是否為有效詞條屬性 (用金色標示)
		const isEffective =
			effectiveSet &&
			attribute.icon &&
			[...effectiveSet].some(key =>
				attribute.icon!.toLowerCase().includes(key.toLowerCase())
			);

		// 載入並繪製屬性圖標
		const attributeImageResult = await loadImageAsync(
			`./src/assets/image/${attribute.icon?.replace("Icon", "icon")}`
		);
		if (attributeImageResult && attributeImageResult.image) {
			ctx.drawImage(attributeImageResult.image, startX, y, 48, 48);
		}

		// 繪製屬性名稱
		setupFont(ctx, 24, true);
		ctx.textAlign = "left";
		ctx.fillStyle = isEffective ? "#F3C96B" : "white";
		ctx.fillText(attribute.name || "", startX + 55, y + 34);

		// base/add 顯示
		if (
			attribute.base !== undefined &&
			attribute.add !== undefined &&
			attribute.add !== 0 &&
			attribute.add !== "0.0%"
		) {
			setupFont(ctx, 16, true);
			ctx.textAlign = "right";
			ctx.fillStyle = isEffective ? "#F3C96B" : "white";
			ctx.fillText(`${attribute.base}`, startX + 350, y + 22);
			ctx.fillStyle = "#B0CFFF"; // 藍色
			ctx.fillText(
				`${attribute.add && Number(attribute.add) > 0 ? "+" : ""}${attribute.add || 0}`,
				startX + 350,
				y + 42
			);
		}

		// final 顯示在右側
		setupFont(ctx, 24, true);
		ctx.textAlign = "right";
		ctx.fillStyle = isEffective ? "#F3C96B" : "white";
		ctx.fillText(
			`${attribute.display || attribute.value || attribute.final}`,
			startX + 450,
			y + 33
		);
	}
}

function setupFont(
	ctx: any,
	size: number,
	isBold: boolean = false,
	fontFamily: string = "'YaHei', 'URW DIN Arabic', Arial, sans-serif'"
): void {
	ctx.font = `${isBold ? "bold " : ""}${size}px ${fontFamily}`;
}

// 繪製分隔線的輔助函數
function drawSeparatorLine(
	ctx: any,
	startX: number,
	endX: number,
	y: number
): void {
	ctx.strokeStyle = "#fff";
	ctx.beginPath();
	ctx.moveTo(startX, y);
	ctx.lineTo(endX, y);
	ctx.stroke();
}

async function saveLeaderboard(
	playerData: PlayerData
): Promise<{ updatedCharacters: string[]; totalScore: number }> {
	const leaderboard: Leaderboard = (await database.get("LeaderBoard")) || {};
	const playerUid = playerData.player.uid;
	const playerNickname = playerData.player.nickname;
	const playerAvatar = playerData.player.avatar.icon;
	const currentTimestamp = Date.now();

	// 批量處理所有角色，提高效率
	const characterUpdates: string[] = [];

	// 並行處理所有角色的評分計算，提高效率
	const characterPromises = playerData.characters.map(async character => {
		if (!character) return null;

		try {
			const relicScore = await getRelicsScore(character);
			if (!relicScore) return null; // 跳過沒有評分的角色

			return { character, relicScore };
		} catch (error) {
			console.error(
				`[Leaderboard] Error calculating score for character ${character.id}:`,
				error
			);
			return null;
		}
	});

	const characterResults = await Promise.all(characterPromises);

	for (const result of characterResults) {
		if (!result) continue;
		const { character, relicScore } = result;

		let leaderboardData = leaderboard[character.id];

		// 初始化角色數據（如果不存在）
		if (!leaderboardData) {
			leaderboardData = {
				id: character.id,
				icon: character.icon,
				element: {
					id:
						typeof character.element === "string"
							? character.element
							: character.element?.id || "physical",
					color:
						typeof character.element === "string"
							? "#8B7355"
							: character.element?.color || "#8B7355"
				},
				score: [],
				stats: {
					totalParticipants: 0,
					averageScore: "0",
					highestScore: 0,
					lastUpdated: currentTimestamp
				},
				lastUpdated: currentTimestamp
			};
		}

		// 創建玩家記錄
		const playerEntry: LeaderboardEntry = {
			uid: playerUid,
			nickname: playerNickname,
			avatar: playerAvatar,
			score: parseFloat(relicScore.totalScore) || 0,
			lastUpdated: currentTimestamp,
			characterLevel: character.level || 0,
			characterRank: character.rank || 0
		};

		// 查找現有記錄
		const existingEntryIndex = leaderboardData.score.findIndex(
			entry => entry.uid === playerUid
		);

		// 更新或添加記錄
		if (existingEntryIndex !== -1) {
			const existingEntry = leaderboardData.score[existingEntryIndex];

			if (existingEntry) {
				// 只有當新分數更高時才更新
				if (playerEntry.score > existingEntry.score) {
					leaderboardData.score[existingEntryIndex] = {
						...existingEntry,
						...playerEntry,
						previousScore: existingEntry.score,
						scoreImproved: true
					};
				} else {
					// 更新其他信息但不改變分數
					leaderboardData.score[existingEntryIndex] = {
						...existingEntry,
						nickname: playerNickname,
						avatar: playerAvatar,
						lastUpdated: currentTimestamp,
						characterLevel: character.level || 0,
						characterRank: character.rank || 0
					};
				}
			}
		} else {
			leaderboardData.score.push(playerEntry);
		}

		// 排序並限制前10名
		leaderboardData.score.sort((a, b) => b.score - a.score);
		leaderboardData.score.splice(10);

		// 更新角色統計信息
		leaderboardData.stats = {
			totalParticipants: leaderboardData.score.length,
			averageScore:
				leaderboardData.score.length > 0
					? (
							leaderboardData.score.reduce(
								(sum, entry) => sum + entry.score,
								0
							) / leaderboardData.score.length
						).toFixed(1)
					: "0",
			highestScore:
				leaderboardData.score.length > 0
					? leaderboardData.score[0]?.score || 0
					: 0,
			lastUpdated: currentTimestamp
		};

		leaderboard[character.id] = leaderboardData;
		characterUpdates.push(character.id);
	}

	// 批量保存到數據庫
	await database.set("LeaderBoard", leaderboard);

	// 記錄更新日誌
	console.log(
		`[Leaderboard] Updated ${characterUpdates.length} characters for player ${playerUid} (${playerNickname})`
	);

	return {
		updatedCharacters: characterUpdates,
		totalScore: characterUpdates.length
	};
}

/**
 * 清理和維護排行榜數據
 * @param daysToKeep - 保留多少天內的數據
 * @param maxEntriesPerCharacter - 每個角色最多保留多少條記錄
 */
async function maintainLeaderboard(
	daysToKeep: number = 30,
	maxEntriesPerCharacter: number = 10
): Promise<{
	cleanedCharacters: number;
	removedEntries: number;
	totalCharacters: number;
}> {
	try {
		const leaderboard: Leaderboard =
			(await database.get("LeaderBoard")) || {};
		const currentTime = Date.now();
		const cutoffTime = currentTime - daysToKeep * 24 * 60 * 60 * 1000;

		let cleanedCharacters = 0;
		let removedEntries = 0;

		for (const [characterId, characterData] of Object.entries(
			leaderboard
		)) {
			if (!characterData.score || !Array.isArray(characterData.score)) {
				continue;
			}

			const originalLength = characterData.score.length;

			// 過濾掉過期的記錄
			characterData.score = characterData.score.filter(entry => {
				const entryTime = entry.lastUpdated || 0;
				return entryTime > cutoffTime;
			});

			// 限制每個角色的記錄數量
			if (characterData.score.length > maxEntriesPerCharacter) {
				characterData.score = characterData.score
					.sort((a, b) => b.score - a.score)
					.slice(0, maxEntriesPerCharacter);
			}

			// 重新排序
			characterData.score.sort((a, b) => b.score - a.score);

			// 更新統計信息
			characterData.stats = {
				totalParticipants: characterData.score.length,
				averageScore:
					characterData.score.length > 0
						? (
								characterData.score.reduce(
									(sum, entry) => sum + entry.score,
									0
								) / characterData.score.length
							).toFixed(1)
						: "0",
				highestScore:
					characterData.score.length > 0
						? characterData.score[0]?.score || 0
						: 0,
				lastUpdated: currentTime
			};

			// 如果沒有有效記錄，刪除整個角色
			if (characterData.score.length === 0) {
				delete leaderboard[characterId];
				cleanedCharacters++;
			} else {
				removedEntries += originalLength - characterData.score.length;
			}
		}

		// 保存清理後的數據
		await db.set("LeaderBoard", leaderboard);

		console.log(
			`[Leaderboard Maintenance] Cleaned ${cleanedCharacters} characters, removed ${removedEntries} expired entries`
		);

		return {
			cleanedCharacters,
			removedEntries,
			totalCharacters: Object.keys(leaderboard).length
		};
	} catch (error) {
		console.error("[Leaderboard Maintenance] Error:", error);
		throw error;
	}
}

/**
 * 獲取排行榜統計信息
 */
async function getLeaderboardStats(): Promise<{
	totalCharacters: number;
	totalParticipants: number;
	recentUpdates: number;
	topScores: Array<{
		characterId: string;
		characterName: string;
		highestScore: number;
		participantCount: number;
	}>;
} | null> {
	try {
		const leaderboard: Leaderboard =
			(await database.get("LeaderBoard")) || {};
		const stats = {
			totalCharacters: Object.keys(leaderboard).length,
			totalParticipants: 0,
			recentUpdates: 0,
			topScores: [] as Array<{
				characterId: string;
				characterName: string;
				highestScore: number;
				participantCount: number;
			}>
		};

		const currentTime = Date.now();
		const oneDayAgo = currentTime - 24 * 60 * 60 * 1000;

		for (const [characterId, characterData] of Object.entries(
			leaderboard
		)) {
			if (characterData.score && Array.isArray(characterData.score)) {
				stats.totalParticipants += characterData.score.length;

				// 統計最近24小時的更新
				const recentUpdates = characterData.score.filter(
					entry => (entry.lastUpdated || 0) > oneDayAgo
				).length;
				stats.recentUpdates += recentUpdates;

				// 收集最高分
				if (characterData.score.length > 0) {
					stats.topScores.push({
						characterId,
						characterName: characterData.id,
						highestScore: characterData.score[0]?.score || 0,
						participantCount: characterData.score.length
					});
				}
			}
		}

		// 按最高分排序
		stats.topScores.sort((a, b) => b.highestScore - a.highestScore);
		stats.topScores = stats.topScores.slice(0, 10);

		return stats;
	} catch (error) {
		console.error("[Leaderboard Stats] Error:", error);
		return null;
	}
}

async function handleProfileDraw(
	interaction: any,
	tr: any,
	user: any,
	uid: string,
	allCharacters: boolean = false,
	accountIndex: number = 0
): Promise<void> {
	// 预加载常用图片以提高性能
	await preloadCommonImages();

	const drawTask = async () => {
		try {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor() as any)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				]
			}).catch(() => {});

			await tryAutoSyncCurrentAnomalyBadge(
				interaction,
				tr,
				user,
				uid,
				accountIndex
			);

			// 如果目標玩家已經綁定帳號 使用hoyoapi 獲取資料
			let playerData: PlayerData | null = null;
			let playerActivity: PlayerActivity | null = null;
			let characters: Character[] | null = null;
			let useAllCharacters = allCharacters;
			let cookieExpiredFallbackNotice = false;
			if (useAllCharacters) {
				const hsr = await getUserHSRData(
					interaction,
					tr,
					user.id,
					accountIndex,
					{ suppressErrorReply: true }
				);

				if (!hsr) {
					const needsCookieUpdate = await database.get(
						`${uid}.needsCookieUpdate`
					);
					cookieExpiredFallbackNotice = Boolean(needsCookieUpdate);
					useAllCharacters = false;
				} else {
					const data = await hsr.record.records();
					let gameInfo: { uid: string; nickname: string; level: number };
				try {
					const cookieStr = await getUserCookie(user.id, accountIndex) ?? "";
					gameInfo = await getUserGameInfo(cookieStr);
				} catch (e) {
					console.warn(
						"[Profile] getUserGameInfo failed, using fallback:",
							(e as Error).message
						);
						gameInfo = {
							uid: String(hsr.uid || uid),
							nickname: (data as any)?.role?.nickname || uid,
							level: (data as any)?.role?.level || 0
						};
					}
					playerData = {
						player: {
							nickname: gameInfo.nickname,
							uid: gameInfo.uid,
							level: gameInfo.level,
							avatar: { icon: (data as any).cur_head_icon_url }
						},
						characters: []
					};

				// 獲取完整的角色數據，包括 relics 和 ornaments
				characters = (await hsr.record.characters()) as any;
				// HoYoLAB returns `ranks[]` (each with .icon) instead of `rank_icons`.
				// Inject rank_icons so drawEidolonIcons() works the same as the UID path.
				if (Array.isArray(characters)) {
					for (const c of characters as any[]) {
						if (!c.rank_icons && Array.isArray(c.ranks) && c.ranks.length >= 6) {
							c.rank_icons = [...c.ranks]
								.sort((a: any, b: any) => a.pos - b.pos)
								.map((r: any) => r.icon);
						}
					}
				}

					// 為 saveLeaderboard 準備完整的 playerData
					const fullPlayerData: PlayerData = {
						player: {
							nickname: gameInfo.nickname,
							uid: gameInfo.uid,
							level: gameInfo.level,
							avatar: { icon: (data as any).cur_head_icon_url }
						},
						characters: characters || []
					};

					// 異步計算並保存 relic score，不阻塞圖片繪製
					saveLeaderboard(fullPlayerData).catch(error => {
						console.error(
							"[Leaderboard] Error updating leaderboard:",
							error
						);
					});

					// 異步批量下載角色頭像，不阻塞圖片繪製
					if (characters && characters.length > 0) {
						// 下載角色頭像
						downloadCharacterPortraits(characters).catch(error => {
							console.warn(
								"[Character Portrait] Background download failed:",
								error
							);
						});

						// 註解掉遺器圖片下載
						// const relicIds = characters
						// 	.flatMap((char: Character) => [
						// 		...(char.relics || []).map(
						// 			(relic: Relic) => relic.id
						// 		),
						// 		...(char.ornaments || []).map(
						// 			(ornament: Relic) => ornament.id
						// 		)
						// 	])
						// 	.filter(
						// 		(id: string, index: number, arr: string[]) =>
						// 			arr.indexOf(id) === index
						// 	); // 去重

						// if (relicIds.length > 0) {
						// 	downloadImages("relic", relicIds).catch(error => {
						// 		console.warn(
						// 			"[Relic Images] Background download failed:",
						// 			error
						// 		);
						// 	});
						// }
					}
				}
			}

			if (!useAllCharacters) {
				const {
					status: reqPlayerDataStatus,
					playerData: reqPlayerData
				} = await requestPlayerData(uid, interaction);
				const {
					status: reqPlayerActivityStatus,
					playerActivity: reqPlayerActivity
				} = await requestPlayerActivity(uid, interaction);

				if (reqPlayerDataStatus == 400) {
					const friendlyDetail = getFriendlyErrorMessage(
						reqPlayerData.detail,
						tr
					);
					const friendlyMessage = getFriendlyErrorMessage(
						reqPlayerData.message,
						tr
					);

					return interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(friendlyDetail)
								.setDescription(`\`${friendlyMessage}\``)
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						],
						withResponse: true
					});
				}

				if (reqPlayerDataStatus !== 200 || !reqPlayerData) {
					return interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor("#E76161")
								.setTitle(
									tr("profile_UidNotFound", {
										uid: `\`${uid}\``
									})
								)
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
						],
						withResponse: true
					});
				}

				// 異步計算並保存 relic score，不阻塞圖片繪製
				saveLeaderboard(reqPlayerData).catch(error => {
					console.error(
						"[Leaderboard] Error updating leaderboard:",
						error
					);
				});

				// 異步批量下載角色頭像，不阻塞圖片繪製
				if (
					reqPlayerData.characters &&
					reqPlayerData.characters.length > 0
				) {
					// 下載角色頭像
					downloadCharacterPortraits(reqPlayerData.characters).catch(
						error => {
							console.warn(
								"[Character Portrait] Background download failed:",
								error
							);
						}
					);

					// 註解掉遺器圖片下載
					// const relicIds = reqPlayerData.characters
					// 	.flatMap((char: Character) => [
					// 		...(char.relics || []).map(
					// 			(relic: Relic) => relic.id
					// 		),
					// 		...(char.ornaments || []).map(
					// 			(ornament: Relic) => ornament.id
					// 		)
					// 	])
					// 	.filter(
					// 		(id: string, index: number, arr: string[]) =>
					// 			arr.indexOf(id) === index
					// 	); // 去重

					// if (relicIds.length > 0) {
					// 	downloadImages("relic", relicIds).catch(error => {
					// 		console.warn(
					// 			"[Relic Images] Background download failed:",
					// 			error
					// 		);
					// 	});
					// }
				}

				characters = reqPlayerData.characters;
				playerActivity = reqPlayerActivity;
				playerData = reqPlayerData;
			}

		const requestEndTime = Date.now();
		const drawStartTime = Date.now();
		let imageBuffer: Buffer | null = null;
		// Get user's preferred background
		const bgPath = await getUserBg(user.id);
		if (useAllCharacters && characters) {
				// 預設按五星優先排序
				const defaultSortedCharacters = characters.sort((a, b) => {
					// 先按五星優先排序
					if (a.rarity !== b.rarity) {
						return b.rarity - a.rarity;
					}
					// 再按等級排序
					return b.level - a.level;
				});

			imageBuffer = await drawAllCharactersImage(
				tr,
				playerData!,
				defaultSortedCharacters,
				null,
				bgPath
			);
			} else if (playerData) {
			imageBuffer = await drawMainImage(
				tr,
				playerData,
				playerActivity,
				bgPath
			);
			}
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `MainPage_${playerData?.player.uid}.webp`
			});

			if (!characters) throw new Error("No characters data");

			const charOptions = characters.map(character => {
				// 安全地获取元素ID
				let elementId: string;
				if (useAllCharacters) {
					// 对于 allCharacters 模式，element 可能是字符串
					elementId =
						typeof character.element === "string"
							? character.element
							: character.element?.id || "physical";
				} else {
					elementId =
						(typeof character.element === "object"
							? character.element?.id
							: character.element) || "physical";
				}

				// 确保 elementId 是有效的字符串
				const elementKey =
					elementId && typeof elementId === "string"
						? elementId.toLowerCase()
						: "physical";

				return {
					emoji: (emoji as any)[elementKey] || emoji.physical,
					label: `${character.name}`,
					value: `${playerData?.player.uid}-${user.id}-${accountIndex}-${useAllCharacters}-${character.id}`
				};
			});

			const charMenu = createPagedSelectMenu(
				charOptions,
				0,
				"profile_SelectCharacter",
				tr("profile_SelectCharacter"),
				`${playerData?.player.uid}:${user.id}:${accountIndex}:${useAllCharacters}`
			);

			const filterOptions = [
				{
					label: tr("profile_FilterNone"),
					value: "no_filter",
					emoji: "❌"
				},
				// 排序
				{
					label: tr("profile_SortByLevel"),
					value: "sort_level",
					emoji: "🔢"
				},
				{
					label: tr("profile_SortByEidolon"),
					value: "sort_eidolon",
					emoji: "⭐"
				},
				// 屬性
				{
					label: tr("element_physical"),
					value: "physical",
					emoji: emoji["physical"]
				},
				{ label: tr("element_ice"), value: "ice", emoji: emoji["ice"] },
				{
					label: tr("element_fire"),
					value: "fire",
					emoji: emoji["fire"]
				},
				{
					label: tr("element_lightning"),
					value: "lightning",
					emoji: emoji["lightning"]
				},
				{
					label: tr("element_wind"),
					value: "wind",
					emoji: emoji["wind"]
				},
				{
					label: tr("element_quantum"),
					value: "quantum",
					emoji: emoji["quantum"]
				},
				{
					label: tr("element_imaginary"),
					value: "imaginary",
					emoji: emoji["imaginary"]
				},
				// 命途
				{
					label: tr("path_destruction"),
					value: "destruction",
					emoji: emoji["destruction"]
				},
				{
					label: tr("path_harmony"),
					value: "harmony",
					emoji: emoji["harmony"]
				},
				{
					label: tr("path_erudition"),
					value: "erudition",
					emoji: emoji["erudition"]
				},
				{ label: tr("path_hunt"), value: "hunt", emoji: emoji["hunt"] },
				{
					label: tr("path_preservation"),
					value: "preservation",
					emoji: emoji["preservation"]
				},
				{
					label: tr("path_nihility"),
					value: "nihility",
					emoji: emoji["nihility"]
				},
				{
					label: tr("path_abundance"),
					value: "abundance",
					emoji: emoji["abundance"]
				},
				{
					label: tr("path_remembrance"),
					value: "remembrance",
					emoji: emoji["remembrance"]
				},
				{
					label: tr("path_elation"),
					value: "elation",
					emoji: emoji["elation"]
				}
			];

			const filterMenu = new StringSelectMenuBuilder()
				.setCustomId(`profile_Filter-${user.id}-${accountIndex}`)
				.setPlaceholder(tr("profile_FilterPlaceholder"))
				.setMinValues(1)
				.setMaxValues(filterOptions.length)
				.addOptions(filterOptions);

			const components = [
				new ActionRowBuilder().addComponents(charMenu),
				...(useAllCharacters
					? [new ActionRowBuilder().addComponents(filterMenu)]
					: [])
			];

			// 上傳圖片，加入 retry 避免 Discord connection reset
			const uploadWithRetry = async (retries = 3): Promise<void> => {
				for (let attempt = 1; attempt <= retries; attempt++) {
					try {
						await interaction.editReply({
							content: cookieExpiredFallbackNotice
								? tr("profile_CookieExpiredFallbackToUid")
								: "",
							embeds: [],
							components: components,
							files: [image]
						});
						return;
					} catch (uploadError: any) {
						const isSocketError =
							uploadError?.code === "UND_ERR_SOCKET" ||
							uploadError?.message?.includes("other side closed") ||
							uploadError?.message?.includes("socket hang up");
						if (isSocketError && attempt < retries) {
							console.warn(
								`[Profile] Upload attempt ${attempt} failed (socket error), retrying...`
							);
							await new Promise(res => setTimeout(res, 1000 * attempt));
							continue;
						}
						throw uploadError;
					}
				}
			};
			await uploadWithRetry();
		} catch (error) {
			console.error(error);
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription(`\`${error}\``)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			}).catch(() => {});
		}
	};

	if (drawQueue.length >= DRAW_QUEUE_MAX) {
		await interaction.editReply({ content: "⚠️ 繪製佇列已滿，請稍後再試。" }).catch(() => {});
		return;
	}
	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}

// ── helpers for drawMainImage ──────────────────────────────────────────────
function drawRoundRect(
	ctx: any,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function fillGlass(
	ctx: any,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	alpha = 0.45
) {
	ctx.save();
	drawRoundRect(ctx, x, y, w, h, r);
	ctx.clip();
	ctx.fillStyle = `rgba(10, 10, 20, ${alpha})`;
	ctx.fillRect(x, y, w, h);
	ctx.restore();
	ctx.save();
	drawRoundRect(ctx, x, y, w, h, r);
	ctx.strokeStyle = "rgba(255,255,255,0.12)";
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();
}

async function drawMainImage(
	tr: any,
	playerData: PlayerData,
	playerActivity: PlayerActivity | null,
	bgPath?: string
): Promise<Buffer | null> {
	try {
		const W = 1920, H = 1080;
		const canvas = createCanvas(W, H);
		const ctx = canvas.getContext("2d");

		const mf = (size: number, bold = false) => {
			ctx.font = `${bold ? "bold " : ""}${size}px 'YaHei','URW DIN Arabic',Arial,sans-serif`;
		};

		// ── 1. Background ────────────────────────────────────────────────────
		const bgResult = await loadImageAsync(bgPath ?? await getTodayBg());
		if (bgResult?.image) {
			ctx.drawImage(bgResult.image, 0, 0, W, H);
		} else {
			ctx.fillStyle = "#0d1117";
			ctx.fillRect(0, 0, W, H);
		}
		// dark overlay
		ctx.fillStyle = "rgba(0,0,0,0.55)";
		ctx.fillRect(0, 0, W, H);

		// ── 2. Fetch extra images in parallel ────────────────────────────────
		const allChars = playerData.characters.slice(0, 8);
		const supportChars = allChars.slice(0, 3);
		const companionChars = allChars.slice(3, 8);
		const activities = playerActivity?.info?.slice(0, 5) || [];

		const [avatarResult, ...restImages] = await Promise.all([
			loadImageAsync(`${image_Header}/${playerData.player.avatar.icon}`),
			...allChars.map(c => loadImageAsync(`${image_Header}/${c.preview}`)),
			...activities.map(a => loadImageAsync(`${image_Header}/${a.content.icon}`))
		]);
		const charImgs = restImages.slice(0, allChars.length).map(r => r?.image);
		const activityIcons = restImages.slice(allChars.length).map(r => r?.image);

		// ── 3. Left panel ────────────────────────────────────────────────────
		const LP = { x: 28, y: 28, w: 460, h: H - 56, r: 16 };
		fillGlass(ctx, LP.x, LP.y, LP.w, LP.h, LP.r, 0.5);

		// Avatar circle
		const avatarCX = LP.x + LP.w / 2;
		const avatarCY = LP.y + 110;
		const avatarR = 80;
		if (avatarResult?.image) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(
				avatarResult.image,
				avatarCX - avatarR,
				avatarCY - avatarR,
				avatarR * 2,
				avatarR * 2
			);
			ctx.restore();
		}
		// avatar ring
		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarCX, avatarCY, avatarR + 3, 0, Math.PI * 2);
		ctx.strokeStyle = "#D4AF37";
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.restore();

		// Anomaly icon overlay
		const anomalyRecord = (await database.get(
			`${playerData.player.uid}.anomalyRoundNum`
		)) as AnomalyRoundRecord | null;
		if (anomalyRecord && Date.now() / 1000 < anomalyRecord.expireTime) {
			const iconPath = getAnomalyIconPath(anomalyRecord.roundNum);
			if (iconPath) {
				const anomalyIcon = await loadImage(iconPath);
				if (anomalyIcon) {
					const iSize = avatarR * 2 * 1.1;
					ctx.drawImage(
						anomalyIcon,
						avatarCX - avatarR - iSize * 0.05,
						avatarCY - avatarR - iSize * 0.05,
						iSize,
						iSize
					);
				}
			}
		}

		// Nickname
		mf(36, true);
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, avatarCX, avatarCY + avatarR + 42);

		// UID
		mf(22);
		ctx.fillStyle = "rgba(255,255,255,0.6)";
		ctx.fillText(
			`UID  ${playerData.player.uid}`,
			avatarCX,
			avatarCY + avatarR + 70
		);

		// Anomaly rank badges
		const anomalyRankRecords = (await database.get(
			`${playerData.player.uid}.anomalyRankIcon`
		)) as AnomalyRankRecord[] | null;
		if (anomalyRankRecords && anomalyRankRecords.length > 0) {
			anomalyRankRecords.sort((a, b) => b.challengeTime - a.challengeTime);
			const badges = anomalyRankRecords.slice(0, 5);
			const badgeSz = 36;
			const totalBW = badges.length * badgeSz + (badges.length - 1) * 6;
			let bx = avatarCX - totalBW / 2;
			const by = avatarCY + avatarR + 82;
			for (const record of badges) {
				try {
					let src: string | Buffer = record.rankIcon;
					if (record.rankIcon?.startsWith("http")) {
						const resp = await axios.get(record.rankIcon, {
							responseType: "arraybuffer",
							timeout: 10000
						});
						src = Buffer.from(resp.data);
					}
					const bi = await loadImage(src);
					if (bi) ctx.drawImage(bi, bx, by, badgeSz, badgeSz);
				} catch { /* skip */ }
				bx += badgeSz + 6;
			}
		}

		// Divider
		const divY1 = avatarCY + avatarR + 105;
		ctx.strokeStyle = "rgba(255,255,255,0.2)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(LP.x + 24, divY1);
		ctx.lineTo(LP.x + LP.w - 24, divY1);
		ctx.stroke();

		// Stats grid (2×2)
		const stats = [
			{ label: tr("profile_TrailblazeLevel"),  value: `${playerData.player.level}` },
			{ label: tr("profile_EquilibriumLevel"),  value: `${playerData.player.world_level ?? "-"}` },
			{ label: tr("profile_CharactersCount"),   value: `${playerData.player.space_info?.avatar_count ?? "-"}` },
			{ label: tr("profile_AchievementsCount"), value: `${playerData.player.space_info?.achievement_count ?? "-"}` }
		];
		const gX0 = LP.x + 30, gY0 = divY1 + 22;
		const gColW = (LP.w - 60) / 2, gRowH = 80;
		stats.forEach((s, i) => {
			const col = i % 2, row = Math.floor(i / 2);
			const sx = gX0 + col * gColW + gColW / 2;
			const sy = gY0 + row * gRowH;
			mf(32, true);
			ctx.fillStyle = "#FFFFFF";
			ctx.textAlign = "center";
			ctx.fillText(s.value, sx, sy + 34);
			mf(18);
			ctx.fillStyle = "rgba(255,255,255,0.55)";
			ctx.fillText(s.label, sx, sy + 56);
		});

		// Divider 2
		const divY2 = gY0 + 2 * gRowH + 14;
		ctx.strokeStyle = "rgba(255,255,255,0.2)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(LP.x + 24, divY2);
		ctx.lineTo(LP.x + LP.w - 24, divY2);
		ctx.stroke();

		// Activity list
		if (activities.length > 0) {
			mf(22, true);
			ctx.fillStyle = "#D4AF37";
			ctx.textAlign = "left";
			ctx.fillText(tr("profile_Records"), LP.x + 30, divY2 + 28);

			activities.forEach((act, i) => {
				const ay = divY2 + 52 + i * 48;
				const icon = activityIcons[i];
				if (icon) ctx.drawImage(icon, LP.x + 30, ay - 26, 34, 34);
				mf(20);
				ctx.fillStyle = "rgba(255,255,255,0.85)";
				ctx.textAlign = "left";
				// Truncate long text
				let txt = act.text;
				const maxW = LP.w - 90;
				while (ctx.measureText(txt).width > maxW && txt.length > 4) {
					txt = txt.slice(0, -1);
				}
				if (txt !== act.text) txt += "…";
				ctx.fillText(txt, LP.x + 72, ay + 4);
			});
		}

		// ── 4. Right panel ──────────────────────────────────────────────────
		const RP = { x: 510, y: 28 };

		// -- Support characters (top 3, larger) --
		const suppLabel = tr("profile_SupportCharacters") ?? "支援角色";
		mf(24, true);
		ctx.fillStyle = "#D4AF37";
		ctx.textAlign = "left";
		ctx.fillText(suppLabel, RP.x, RP.y + 28);

		const suppCardW = 420, suppCardH = 490, suppGap = 20;
		const suppTotalW = supportChars.length * suppCardW + (supportChars.length - 1) * suppGap;
		const suppStartX = RP.x + ((W - RP.x - 28) - suppTotalW) / 2;

		for (let i = 0; i < supportChars.length; i++) {
			const char = supportChars[i]!;
			const cx = suppStartX + i * (suppCardW + suppGap);
			const cy = RP.y + 40;

			// card glass
			fillGlass(ctx, cx, cy, suppCardW, suppCardH, 12, 0.38);

			// character preview
			const img = charImgs[i];
			if (img) {
				// clip to card
				ctx.save();
				drawRoundRect(ctx, cx, cy, suppCardW, suppCardH, 12);
				ctx.clip();
				// scale to fill upper ~80% of card, anchor bottom
				const srcAR = img.width / img.height;
				const dstH = suppCardH;
				const dstW = dstH * srcAR;
				const dx = cx + (suppCardW - dstW) / 2;
				ctx.drawImage(img, dx, cy - suppCardH * 0.05, dstW, dstH);
				ctx.restore();
			}

			// bottom info bar
			const barH = 70;
			ctx.save();
			drawRoundRect(ctx, cx, cy + suppCardH - barH, suppCardW, barH, 12);
			ctx.clip();
			ctx.fillStyle = "rgba(0,0,0,0.65)";
			ctx.fillRect(cx, cy + suppCardH - barH, suppCardW, barH);
			ctx.restore();

			mf(26, true);
			ctx.fillStyle = "#FFD89C";
			ctx.textAlign = "center";
			ctx.fillText(char.name, cx + suppCardW / 2, cy + suppCardH - barH + 28);
			mf(20);
			ctx.fillStyle = "rgba(255,255,255,0.75)";
			ctx.fillText(
				`Lv.${char.level}  ✦${char.rank}`,
				cx + suppCardW / 2,
				cy + suppCardH - barH + 52
			);
		}

		// -- Companion characters (bottom 5, smaller) --
		const compY = RP.y + 40 + suppCardH + 24;
		const compLabel = tr("profile_CompanionCharacters") ?? "星海同行";
		mf(24, true);
		ctx.fillStyle = "#D4AF37";
		ctx.textAlign = "left";
		ctx.fillText(compLabel, RP.x, compY - 6);

		const compCardW = 245, compCardH = 310, compGap = 18;
		const compTotalW = companionChars.length * compCardW + (companionChars.length - 1) * compGap;
		const compStartX = RP.x + ((W - RP.x - 28) - compTotalW) / 2;

		for (let i = 0; i < companionChars.length; i++) {
			const char = companionChars[i]!;
			const cx = compStartX + i * (compCardW + compGap);
			const cy = compY + 4;

			fillGlass(ctx, cx, cy, compCardW, compCardH, 10, 0.38);

			const img = charImgs[3 + i];
			if (img) {
				ctx.save();
				drawRoundRect(ctx, cx, cy, compCardW, compCardH, 10);
				ctx.clip();
				const srcAR = img.width / img.height;
				const dstH = compCardH;
				const dstW = dstH * srcAR;
				const dx = cx + (compCardW - dstW) / 2;
				ctx.drawImage(img, dx, cy - compCardH * 0.05, dstW, dstH);
				ctx.restore();
			}

			const barH = 54;
			ctx.save();
			drawRoundRect(ctx, cx, cy + compCardH - barH, compCardW, barH, 10);
			ctx.clip();
			ctx.fillStyle = "rgba(0,0,0,0.65)";
			ctx.fillRect(cx, cy + compCardH - barH, compCardW, barH);
			ctx.restore();

			mf(20, true);
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText(char.name, cx + compCardW / 2, cy + compCardH - barH + 22);
			mf(16);
			ctx.fillStyle = "rgba(255,255,255,0.7)";
			ctx.fillText(
				`Lv.${char.level}  ✦${char.rank}`,
				cx + compCardW / 2,
				cy + compCardH - barH + 42
			);
		}

		return canvas.toBuffer("image/webp");
	} catch (error) {
		console.error(`MainPage Error: ${error}`);
		return null;
	}
}

async function drawCharacterImage(
	tr: any,
	playerData: PlayerData,
	character: Character,
	isAllCharacter: boolean = false,
	userLang: string = "en",
	bgPath?: string
): Promise<Buffer | null> {
	try {
		// 验证输入参数
		if (!character || !character.id) {
			console.warn(
				"Invalid character data provided to drawCharacterImage"
			);
			return null;
		}
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext("2d");

		// 优化图片路径构建
		const characterElementIcon =
			(typeof character.element === "object" &&
				character.element?.icon?.toLowerCase()) ||
			`element/${(typeof character.element === "object" ? character.element?.id : character.element) || "physical"}.png`;
		const pathMapper: Record<string, string> = {
			warrior: "destruction",
			rogue: "hunt",
			mage: "erudition",
			priest: "abundance",
			shaman: "harmony",
			warlock: "nihility",
			knight: "preservation",
			memory: "remembrance",
			elation: "elation"
		};
		const rawPathId = (
			typeof character.path === "string"
				? character.path
				: character.path?.id ||
					(await getPathMap())[character.base_type || 0] ||
					"none"
		).toLowerCase();
		const normalizedPathId = pathMapper[rawPathId] || rawPathId;
		// HoYoLAB: path=undefined → rawPathId="" → normalizedPathId=""
		// fallback 到 base_type 對應的命途名稱
		const resolvedPathId = normalizedPathId ||
			(await getPathMap())[character.base_type || 0] ||
			"none";
		const characterPathIcon = isAllCharacter
			? `icon/path/${resolvedPathId}Small.png`
			: (typeof character.path === "object" &&
					character.path?.icon?.toLowerCase()) ||
				`icon/path/${(await getPathMap())[character.base_type || 0]}.png`;

		// 减少基础图片加载数量
		const imagePaths = [
			bgPath ?? await getTodayBg(),
			`./src/assets/image/${characterElementIcon}`,
			`./src/assets/image/${characterPathIcon}`,
			`./src/assets/image/icon/deco/Star${character.rarity == 5 ? "5" : "4"}.png`
		];

		// 限制圣遗物图片数量以提高性能

		// 修改聖遺物處理邏輯，確保始終顯示 6 個槽位
		const allRelics: (any | null)[] = [null, null, null, null, null, null];

		// 試著將遺器按部位映射到 0-5
		(character.relics || []).forEach(relic => {
			const pos = (relic as any).pos || (relic as any).type;
			// 1-4 是常規遺器 (HEAD, HAND, BODY, FOOT)
			// 5-6 是位面飾品 (PLANAR_SPHERE, LINK_ROPE)
			if (typeof pos === "number" && pos >= 1 && pos <= 6) {
				allRelics[pos - 1] = relic;
			} else if (typeof pos === "string") {
				const map: Record<string, number> = {
					HEAD: 0,
					HAND: 1,
					BODY: 2,
					FOOT: 3,
					OBJECT: 4,
					NECK: 5,
					PLANAR_SPHERE: 4,
					LINK_ROPE: 5
				};
				const p = pos.toUpperCase();
				if (map[p] !== undefined) allRelics[map[p]] = relic;
			}
		});

		// 試著將飾品映射到 4-5
		(character.ornaments || []).forEach(ornament => {
			const pos = (ornament as any).pos || (ornament as any).type;
			// 兼容不同的 pos 定義：
			// 1. pos 1, 2 用於獨立的 ornaments 數組 (相對位置) -> 映射到 4, 5
			// 2. pos 5, 6 用於全局 relics 定義 (絕對位置) -> 映射到 4, 5
			if (typeof pos === "number") {
				if (pos >= 1 && pos <= 2) {
					allRelics[pos + 3] = ornament;
				} else if (pos === 5 || pos === 6) {
					allRelics[pos - 1] = ornament;
				}
			} else if (typeof pos === "string") {
				const map: Record<string, number> = {
					OBJECT: 4,
					NECK: 5,
					PLANAR_SPHERE: 4,
					LINK_ROPE: 5
				};
				const p = pos.toUpperCase();
				if (map[p] !== undefined) allRelics[map[p]] = ornament;
			}
		});

		// 備用邏輯：如果映射全失敗，按原本順序填充
		if (allRelics.every(r => r === null)) {
			(character.relics || [])
				.slice(0, 4)
				.forEach((r, i) => (allRelics[i] = r));
			(character.ornaments || [])
				.slice(0, 2)
				.forEach((r, i) => (allRelics[i + 4] = r));
		}

		const relicImagePaths = allRelics.map(relic =>
			relic
				? isAllCharacter
					? relic.icon
					: image_Header + "/" + relic.icon
				: null
		);

		imagePaths.push(...relicImagePaths.filter(p => p !== null));

		// 使用优化的图片加载函数
		const imagePromises = imagePaths.map(async url => {
			try {
				return await loadImageOptimized(url);
			} catch (error) {
				console.warn(`Failed to load image: ${url}`, error);
				return null;
			}
		});

		const imageResults = await Promise.all(imagePromises);
		const [bg, element, path, star, ...relicImagesFromPaths] = imageResults;

		// 將下載到的聖遺物圖片重新映射回 allRelics 對應的位置
		const relicImages: (any | null)[] = [
			null,
			null,
			null,
			null,
			null,
			null
		];
		let pathIdx = 0;
		allRelics.forEach((relic, i) => {
			if (relic) {
				relicImages[i] = relicImagesFromPaths[pathIdx++];
			}
		});

		// 優化角色圖片加載 - 優先使用本地文件
		let characterImageUrl: string;
		let characterFallbackUrl: string | null = null;
		const isSkinImage = character?.image?.includes("skin");
		if (isSkinImage) {
			characterImageUrl = await handleCharacterSkin(character);
		} else {
			const portraitResult = await handleCharacterPortrait(
				character,
				image_Header
			);
			characterImageUrl = portraitResult.imageUrl;
			characterFallbackUrl = portraitResult.fallbackUrl;
		}

		let characterImageResult = null;
		try {
			characterImageResult = await loadImageOptimized(
				characterImageUrl,
				characterFallbackUrl
			);
		} catch (error) {
			console.warn(
				`Failed to load character image: ${characterImageUrl}`,
				error
			);
		}

		// 绘制背景
		ctx.drawImage(bg, 0, 0, 1920, 1080);

		// 绘制角色图片 - 根据图片类型调整显示方式
		if (characterImageResult) {
			const originalWidth = characterImageResult.width;
			const originalHeight = characterImageResult.height;
			const aspectRatio = originalWidth / originalHeight;

			if (aspectRatio > 0.8) {
				const scaledWidth = 768 * aspectRatio;
				ctx.drawImage(characterImageResult, 475, 0, scaledWidth, 768);
			} else {
				const size = 0.8;
				const scaledHeight = (768 * size) / aspectRatio;
				const xOffset = 475 + 768 * ((1 - size) / 2);
				ctx.drawImage(
					characterImageResult,
					xOffset,
					-220,
					768 * size,
					scaledHeight
				);
			}
		}

		// 优化字体大小计算
		const maxWidth = 200;
		let fontSize = 44;

		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		setupFont(ctx, fontSize, true);

		// 快速字体大小调整
		while (fontSize > 30) {
			const textWidth = ctx.measureText(character.name).width;
			if (textWidth <= maxWidth) break;
			fontSize--;
			setupFont(ctx, fontSize, true);
		}

		ctx.fillText(character.name, 120, 99);

		// 绘制等级（跟在名字后面）
		const nameWidth = ctx.measureText(character.name).width;
		setupFont(ctx, 28, false);
		ctx.fillStyle = "rgba(255,255,255,0.75)";
		ctx.fillText(
			`${tr("level")} ${character.level}`,
			120 + nameWidth + 10,
			99
		);
		ctx.fillStyle = "white";

		// 绘制元素图标（row 1, 與名字對齊）
		if (element) {
			ctx.drawImage(element, 50, 56, 56, 56);
		}

		// 绘制星级 (row 2)
		if (star) {
			ctx.drawImage(star, 50, 120, 160, 32);
		}

		// 绘制命途图标 + 名称 (row 3)
		if (path) {
			ctx.drawImage(path, 50, 162, 52, 52);
		}
		setupFont(ctx, 28, true);
		ctx.fillText(
			(typeof character.path === "object"
				? character.path?.name
				: (() => {
					const raw = (character.path as string) || "";
					const mapped = pathMapper[raw.toLowerCase()] || raw;
					if (!mapped) return undefined;
					const key = mapped.charAt(0).toUpperCase() + mapped.slice(1);
					return tr(`path_${key}`);
				})()) ||
				tr(`path_${(await getPathMap())[character.base_type || 0]}`),
			112,
			196
		);

		ctx.textAlign = "left";

		// 绘制命座图标（置中於左側面板 centerX=210）
		const PANEL_CENTER_X = 270;
		const EIDOLON_CENTER_Y = 260;
		if (character.rank_icons && character.rank_icons.length >= 6) {
			await drawEidolonIcons(ctx, character.rank_icons, character.rank, PANEL_CENTER_X, EIDOLON_CENTER_Y);
		} else {
			// Fallback: original text if rank_icons not available
			setupFont(ctx, 26, true);
			ctx.fillStyle = "#DCC491";
			ctx.textAlign = "center";
			ctx.fillText(
				`${tr("Eidolon", { rank: character.rank })}`,
				PANEL_CENTER_X,
				EIDOLON_CENTER_Y
			);
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
		}

		// 优化属性渲染
		let result = [];
		if (character.attributes) {
			// 合併基礎屬性和額外屬性
			const allAttributes = [
				...character.attributes,
				...(character.additions || [])
			];

			// 處理屬性數據，合併相同字段並格式化顯示值
			const percentFields = [
				"crit_rate",
				"crit_dmg",
				"heal_ratio",
				"status_prob",
				"status_res",
				"energy_recovery",
				"break_dmg"
			];
			const attributesWithAdditions = allAttributes
				.filter(attribute => attribute.field)
				.reduce((acc: { [key: string]: Attribute }, attribute) => {
					const field = attribute.field;

					if (acc[field]) {
						acc[field].value += attribute.value;
					} else {
						acc[field] = { ...attribute };
					}

					// 修正百分比屬性顯示
					const isPercentField = percentFields.includes(field);
					if (isPercentField) {
						acc[field].display =
							`${(acc[field].value * 100).toFixed(1)}%`;
					} else {
						const isPercentage =
							attribute.value < 1 && field !== "spd";
						acc[field].display = isPercentage
							? `${(acc[field].value * 100).toFixed(1)}%`
							: `${Math.floor(acc[field].value)}`;
					}

					return acc;
				}, {});

			// mihomo attributes[] 的 hp/atk/def/spd 名稱帶有「基礎」前綴，
			// 但合併後顯示的是加成後的總量，應去掉「基礎」改用完整名稱。
			const fieldNameOverride: Record<string, string> = {
				hp:  tr("property_MaxHP"),
				atk: tr("property_Attack"),
				def: tr("property_Defence"),
				spd: tr("property_Speed")
			};
			for (const field of Object.keys(fieldNameOverride)) {
				if (attributesWithAdditions[field] && fieldNameOverride[field]) {
					(attributesWithAdditions[field] as Attribute).name = fieldNameOverride[field] as string;
				}
			}

			result = Object.values(attributesWithAdditions);
		} else {
			result = (character.properties || []).map(property => {
				// 優先使用 API 提供的 icon（支援 elation_dmg / Joy 等新屬性）
				const iconFile = property.icon
					? property.icon
					: `icon/property/icon${propertyMap[property.property_type]}.png`;
				// 優先使用 API 提供的 name（支援歡愉傷等新屬性名稱）
				const name = property.name
					? property.name
					: tr(`property_${propertyMap[property.property_type]}`);
				return {
					name,
					base: property.base,
					add: property.add,
					final: property.final,
					icon: iconFile
				};
			});
		}

		// 屬性渲染前：
		const filteredAttributes = (result as Attribute[]).filter(attribute => {
			const v = attribute.display ?? attribute.value ?? attribute.final;
			if (typeof v === "string") {
				return !/^0(\.0+)?%?$/.test(v.trim());
			} else if (typeof v === "number") {
				return v !== 0;
			}
			return true;
		});
		// 上分隔線
		const attrTopY = 315;
		drawSeparatorLine(ctx, 50, 500, attrTopY);
		// 屬性列表 (relicsScore 在此提前取得，以便傳遞有效詞條集合)
		const relicsScore = await getRelicsScore(character);
		await renderAttributesList(ctx, filteredAttributes, 50, 340, 45, relicsScore?.effectivePropertyNames);
		// 下分隔線動態位置
		const attrBottomY = 373 + filteredAttributes.length * 45;
		drawSeparatorLine(ctx, 50, 500, attrBottomY);

		// 有效副屬性命中統計面板
		let effectivePanelBottomY = attrBottomY; // 預設：沒有面板時底部就是分隔線
		if (relicsScore && relicsScore.effectiveStats.size > 0) {
			const panelX = 50;
			const panelY = attrBottomY + 12;
			const panelW = 450;
			const chipIconSize = 26;

			// 圓形總計徽章 (右側)
			const badgeR = 30;
			const badgeCX = panelX + panelW - badgeR - 2;
			const badgeCY = panelY + 36;
			// chip 列表可用右邊界：徽章左側留 10px 間距
			const chipRightLimit = badgeCX - badgeR - 10;

			// 標題
			setupFont(ctx, 18, true);
			ctx.textAlign = "left";
			ctx.fillStyle = "rgba(255,255,255,0.55)";
			ctx.fillText(tr("profile_EffectiveStatsTitle"), panelX, panelY + 16);

			ctx.save();
			ctx.beginPath();
			ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
			ctx.strokeStyle = "#F3C96B";
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();
			setupFont(ctx, 22, true);
			ctx.textAlign = "center";
			ctx.fillStyle = "#F3C96B";
			ctx.textBaseline = "middle";
			const statsTotalRolls = [...relicsScore.effectiveStats.values()].reduce((s, v) => s + v.rolls, 0);
			ctx.fillText(`${statsTotalRolls}`, badgeCX, badgeCY - 4);
			setupFont(ctx, 12, false);
			ctx.fillStyle = "rgba(255,255,255,0.6)";
			ctx.fillText(tr("profile_EffectiveStatsTotal"), badgeCX, badgeCY + 14);
			ctx.textBaseline = "alphabetic";

			// 屬性 chip 多行排列
			const chipStartX = panelX;
			const chipLineHeight = chipIconSize + 6;
			const chipSpacing = 8;
			let chipX = chipStartX;
			let chipRow = 0;
			const stats = [...relicsScore.effectiveStats.entries()];
			for (const [iconKey, stat] of stats) {
				// 預先計算此 chip 的寬度
				let localName = (tr as any)(`property_${iconKey}`) || stat.name;
				if (typeof localName === "string") {
					localName = localName
						.replace(/Critical Damage/gi, "Crit DMG")
						.replace(/Critical Rate/gi, "Crit Rate")
						.replace(/Break Effect/gi, "Break")
						.replace(/Effect Hit Rate/gi, "EHR")
						.replace(/Effect RES/gi, "RES")
						.replace(/Outgoing Healing/gi, "Healing")
						.replace(/Energy Regen Rate/gi, "Energy")
						.replace(/ DMG Boost$/gi, " DMG");
				}
				setupFont(ctx, 17, true);
				const rollsStr = `${stat.rolls}`;
				const chipW = chipIconSize + 2 + ctx.measureText(localName).width + 2 + ctx.measureText(rollsStr).width + chipSpacing;

				// 若超出右邊界則換行（只在第一行，不超過2行）
				if (chipRow === 0 && chipX + chipW > chipRightLimit) {
					chipRow = 1;
					chipX = chipStartX;
				}

				const chipY = panelY + 28 + chipRow * chipLineHeight;

				// icon
				const iconResult = await loadImageAsync(`./src/assets/image/${stat.icon}`);
				if (iconResult?.image) {
					ctx.drawImage(iconResult.image, chipX, chipY, chipIconSize, chipIconSize);
				}
				chipX += chipIconSize + 2;

				ctx.textAlign = "left";
				ctx.fillStyle = "#F3C96B";
				ctx.fillText(localName, chipX, chipY + chipIconSize - 4);
				chipX += ctx.measureText(localName).width + 2;

				ctx.fillStyle = "white";
				ctx.fillText(rollsStr, chipX, chipY + chipIconSize - 4);
				chipX += ctx.measureText(rollsStr).width + chipSpacing;
			}

			// 面板實際底部
			const lastChipY = panelY + 28 + chipRow * chipLineHeight;
			effectivePanelBottomY = lastChipY + chipIconSize;
		}

		// relics 區塊對齊
		const relics_left_x = 1210;
		const relics_right_x = 1210 + 335 * 2 + 20; // 1860
		const relics_width = relics_right_x - relics_left_x; // 690
		const relics_top_y = 60;
		const relics_height = 220;
		const relics_padding = 20;
		const relics_row_count = Math.ceil((allRelics.length || 0) / 2);
		const relics_bottom_y =
			relics_top_y + relics_row_count * (relics_height + relics_padding);
		const light_cone_gap_top = 5; // 上方間隔

		// 始終繪製光錐框
		{
			const light_cone_base_x = relics_left_x;
			const light_cone_base_y = relics_bottom_y + light_cone_gap_top;
			const light_cone_width = relics_width;
			const light_cone_height = 280;
			const radius = 10;

			// 繪製 lightcone 背景
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(light_cone_base_x + radius, light_cone_base_y);
			ctx.arcTo(
				light_cone_base_x + light_cone_width,
				light_cone_base_y,
				light_cone_base_x + light_cone_width,
				light_cone_base_y + light_cone_height,
				radius
			);
			ctx.arcTo(
				light_cone_base_x + light_cone_width,
				light_cone_base_y + light_cone_height,
				light_cone_base_x,
				light_cone_base_y + light_cone_height,
				radius
			);
			ctx.arcTo(
				light_cone_base_x,
				light_cone_base_y + light_cone_height,
				light_cone_base_x,
				light_cone_base_y,
				radius
			);
			ctx.arcTo(
				light_cone_base_x,
				light_cone_base_y,
				light_cone_base_x + light_cone_width,
				light_cone_base_y,
				radius
			);
			ctx.closePath();
			ctx.clip();
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = "#000";
			ctx.fillRect(
				light_cone_base_x,
				light_cone_base_y,
				light_cone_width,
				light_cone_height
			);
			ctx.restore();
			ctx.globalAlpha = 1;

			const hasLightCone = !!(character.light_cone || character.equip);

			if (hasLightCone) {
				const light_coneResult = await loadImageAsync(
					character.equip?.icon ||
						`${image_Header}/icon/light_cone/${character.light_cone?.id}.png`
				);
				const light_cone = light_coneResult?.image;
				// 圖片靠左
				if (light_cone) {
					ctx.drawImage(
						light_cone,
						light_cone_base_x + 50,
						light_cone_base_y + 10,
						128 * 1.25,
						128 * 1.25
					);
				}

				// 文字靠右區域內左側
				ctx.textAlign = "left";
				let lcName = `${character.light_cone?.name || character.equip?.name || ""}`;
				let nameFont = 28;
				setupFont(ctx, nameFont, true);
				const maxNameWidth = 268 - 40;
				while (ctx.measureText(lcName).width > maxNameWidth && nameFont > 14) {
					nameFont -= 1;
					setupFont(ctx, nameFont, true);
				}
				ctx.fillText(
					lcName,
					light_cone_base_x + 30,
					light_cone_base_y + 200
				);

				setupFont(ctx, 24, true);

				const romanize = (rank: number) => {
					const roman = ["I", "II", "III", "IV", "V"];
					return roman[rank - 1];
				};
				const rankText =
					userLang == "en"
						? romanize(
								character.light_cone?.rank ||
									character.equip?.rank ||
									1
							)
						: character.light_cone?.rank ||
							character.equip?.rank ||
							1;

				ctx.fillStyle = "white";
				ctx.fillText(
					`${tr("level")} ${character.light_cone?.level || character.equip?.level}`,
					light_cone_base_x + 30,
					light_cone_base_y + 240
				);
				ctx.fillStyle = "#DCC491";
				ctx.fillText(
					`${tr("lightConeLevel_Format", {
						rank: rankText
					})}`,
					light_cone_base_x +
						30 +
						ctx.measureText(
							`${tr("level")} ${character.light_cone?.level || character.equip?.level}`
						).width +
						15,
					light_cone_base_y + 240
				);
				ctx.fillStyle = "white";

				// 使用专门的光锥数据加载函数
				let lightConeEffect: any = {};
				try {
					lightConeEffect = (await loadLightConeData(userLang)) || {};
				} catch (error) {
					console.warn(
						`Failed to load light_cone_ranks.json for ${userLang}:`,
						error
					);
				}
				const currentLightConeEffect =
					lightConeEffect[character.light_cone?.id || ""] ||
					lightConeEffect[character.equip?.id || ""];

				if (currentLightConeEffect) {
					const rank =
						character.light_cone?.rank ||
						character.equip?.rank ||
						1;
					const params = currentLightConeEffect.params[rank - 1];

					// ... (描述渲染邏輯保持不變，但在這裡繼續)
					if (params) {
						let description = currentLightConeEffect.desc;
						params.forEach((param: any, pIndex: number) => {
							const goldWrapper = (text: string) =>
								`{{GOLD}}${text}{{/GOLD}}`;
							description = description.replace(
								`#${pIndex + 1}[i]%`,
								goldWrapper(`${(param * 100).toFixed(0)}%`)
							);
							description = description.replace(
								`#${pIndex + 1}[i]`,
								goldWrapper(`${param.toFixed(0)}`)
							);
							description = description.replace(
								`#${pIndex + 1}[f1]%`,
								goldWrapper(`${(param * 100).toFixed(1)}%`)
							);
							description = description.replace(
								`#${pIndex + 1}[f1]`,
								goldWrapper(`${param.toFixed(1)}`)
							);
						});

						ctx.textAlign = "left";
						const maxDescWidth = relics_width - 268 - 30;
						const descX = light_cone_base_x + 268;
						// 光錐框可用高度（扣掉名稱與等級行已佔的空間，預留上下各 20px 邊距）
						const descAreaHeight = light_cone_height - 80;

						// interface 定義
						interface WordToken { word: string; isGold: boolean; }
						interface CharToken { char: string; isGold: boolean; width: number; }

						// 解析 Rich Text segments
						const segments = description
							.split(/({{GOLD}}.*?{{\/GOLD}})/g)
							.filter((s: string) => s !== "")
							.map((part: string) => {
								if (part.startsWith("{{GOLD}}")) {
									return { text: part.replace(/{{GOLD}}|{{\/GOLD}}/g, ""), isGold: true };
								}
								return { text: part, isGold: false };
							});

						// 以初始字體 20px 先做分行，若超出高度則縮小字體重試
						let descFont = 20;
						let lineHeight = 24;
						let visibleLines: CharToken[][] = [];

						for (; descFont >= 14; descFont -= 1, lineHeight = Math.floor(descFont * 1.2)) {
							setupFont(ctx, descFont, false);

							// --- 分行邏輯 ---
						const wordTokens2: WordToken[] = [];
						segments.forEach((seg: { text: string; isGold: boolean }) => {
							const parts = seg.text.split(/(\s+)/);
							parts.forEach((part: string) => {
								if (part !== "") wordTokens2.push({ word: part, isGold: seg.isGold });
							});
						});

						const isCJK = (ch: string) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(ch);

						const spW = ctx.measureText(" ").width;
						let lns: CharToken[][] = [];
						let curLine: CharToken[] = [];
						let curW = 0;

						const pushLine = () => {
							// 去掉行尾空白
							while (curLine.length > 0 && /\s/.test(curLine[curLine.length - 1]!.char)) {
								curW -= curLine[curLine.length - 1]!.width;
								curLine.pop();
							}
							lns.push(curLine);
							curLine = [];
							curW = 0;
						};

						wordTokens2.forEach((token: WordToken) => {
							const isSp = /^\s+$/.test(token.word);
							if (isSp) {
								if (curW === 0) return; // 行首空白略過
								const spChars = token.word.split("");
								spChars.forEach((char: string) => {
									const cw = spW;
									curLine.push({ char, isGold: token.isGold, width: cw });
									curW += cw;
								});
								return;
							}

							// 非空白 token：逐字元處理
							token.word.split("").forEach((char: string) => {
								const cw = ctx.measureText(char).width;
								if (isCJK(char)) {
									// CJK 字元：每個字都可以換行
									if (curW > 0 && curW + cw > maxDescWidth) {
										pushLine();
									}
									curLine.push({ char, isGold: token.isGold, width: cw });
									curW += cw;
								} else {
									// 非 CJK（英文/數字）：先累積整個字元，超寬才換行
									// 這裡直接加字元，超過時換行（單字元級別，避免英文單字被切斷的問題
									// 由於已在 wordTokens2 層面保留了完整單詞，單詞超過一行時才會在字元層換行）
									if (curW > 0 && curW + cw > maxDescWidth) {
										pushLine();
									}
									curLine.push({ char, isGold: token.isGold, width: cw });
									curW += cw;
								}
							});
						});
						if (curLine.length > 0) lns.push(curLine);

							const neededHeight = lns.length * lineHeight;
							if (neededHeight <= descAreaHeight) {
								visibleLines = lns;
								break;
							}
							// 最小字體時直接截斷
							if (descFont === 14) {
								const maxLines = Math.floor(descAreaHeight / lineHeight);
								visibleLines = lns.slice(0, maxLines);
							}
						}
						setupFont(ctx, descFont, false);

						// 垂直置中計算
						const totalTextHeight = visibleLines.length * lineHeight;
						const descY =
							light_cone_base_y +
							(light_cone_height - totalTextHeight) / 2 +
							10;

						// Clip 文字繪製區域，防止溢出光錐框
						ctx.save();
						ctx.beginPath();
						ctx.rect(
							descX,
							light_cone_base_y + 10,
							maxDescWidth,
							light_cone_height - 20
						);
						ctx.clip();

						visibleLines.forEach((line, lIdx) => {
							let currentX = descX;
							line.forEach(token => {
								ctx.fillStyle = token.isGold
									? "#DCC491"
									: "lightgray";
								ctx.fillText(
									token.char,
									currentX,
									descY + lIdx * lineHeight
								);
								currentX += token.width;
							});
						});

						ctx.restore();
					}
				}
			} else {
				// 未裝備光錐的佔位顯示 - 優化設計
				const centerX = light_cone_base_x + light_cone_width / 2;
				const centerY = light_cone_base_y + light_cone_height / 2;

				ctx.save();
				// 繪製虛線邊框
				ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
				ctx.lineWidth = 2;
				ctx.setLineDash([10, 10]);
				ctx.strokeRect(
					light_cone_base_x + 10,
					light_cone_base_y + 10,
					light_cone_width - 20,
					light_cone_height - 20
				);
				ctx.restore();

				ctx.textAlign = "center";
				ctx.textBaseline = "middle";

				// 繪製 "Empty" 文字或圖標
				setupFont(ctx, 32, true);
				ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
				ctx.fillText(tr("None").toUpperCase(), centerX, centerY);

				// 恢復 textBaseline
				ctx.textBaseline = "alphabetic";
			}
		}

		ctx.fillStyle = "white";

		const hasServantSkills =
			(character.servant_detail?.servant_skills?.length || 0) > 0;
		const servantSkillsCount = hasServantSkills
			? character.servant_detail?.servant_skills?.length || 0
			: 0;

		let allSkills = [...(character.skills || [])];

		// 處理 Mihomo API 資料結構中的特殊技能 (憶靈/歡愉)
		if (character.skill_trees && character.skill_trees.length > 0) {
			character.skill_trees.forEach(treeNode => {
				const nodeId = treeNode.id.toString();
				const icon = treeNode.icon;

				// 1. 補齊已有技能但沒圖示的情況 (如歡愉技 150220 -> 1502420)
				if (nodeId.endsWith("420") || icon?.includes("_elation")) {
					const existingElation = allSkills.find(
						s =>
							s.type_text === tr("profile_ElationSkill") ||
							s.type_text === "Elation Skill" ||
							s.id?.toString().endsWith("20")
					);
					if (existingElation && !existingElation.icon) {
						existingElation.icon = icon;
					} else if (!existingElation) {
						// 如果 skills 陣列中完全沒有歡愉技，則從技能樹補入
						allSkills.push({
							id: nodeId,
							level: treeNode.level || 1,
							icon: icon,
							type_text: tr("profile_ElationSkill"),
							point_type: 4
						} as any);
					}
				}

				// 2. 處理憶靈技能 (通常僅存在於 skill_trees 中，ID 以 301/302 結尾)
				if (
					nodeId.endsWith("301") ||
					icon?.includes("memosprite_skill")
				) {
					if (
						!allSkills.some(
							s =>
								s.icon === icon ||
								s.type_text === tr("profile_MemospriteSkill")
						)
					) {
						allSkills.push({
							id: nodeId,
							level: treeNode.level || 1,
							icon: icon,
							type_text: tr("profile_MemospriteSkill"),
							point_type: 10 // 自定義標記
						} as any);
					}
				}
				if (
					nodeId.endsWith("302") ||
					icon?.includes("memosprite_talent")
				) {
					if (
						!allSkills.some(
							s =>
								s.icon === icon ||
								s.type_text === tr("profile_MemospriteTalent")
						)
					) {
						allSkills.push({
							id: nodeId,
							level: treeNode.level || 1,
							icon: icon,
							type_text: tr("profile_MemospriteTalent"),
							point_type: 11 // 自定義標記
						} as any);
					}
				}
			});
		}

		// 過濾主要技能（普攻、戰技、終結技、天賦、秘技）- 最多5個
		const basicSkills = allSkills
			.filter(skill => {
				// point_type 2 是主要技能（戰鬥技能）
				if (skill.point_type === 2) {
					return true;
				}

				// 對於沒有 point_type 的舊格式，檢查基本技能類型
				if (
					!skill.point_type &&
					skill.icon &&
					(skill.type_text || skill.remake)
				) {
					const skillType = skill.type || "";
					const skillTypeText = skill.type_text || "";

					// 排除憶靈技能與歡愉技能
					if (
						skillType === "MemospriteSkill" ||
						skillTypeText === tr("profile_MemospriteSkill") ||
						skillType === "MemospriteTalent" ||
						skillTypeText === tr("profile_MemospriteTalent") ||
						skillType === "ElationSkill" ||
						skillTypeText === tr("profile_ElationSkill") ||
						skillTypeText === "Elation Skill"
					) {
						return false;
					}

					// 其他基本技能
					return true;
				}

				return false;
			})
			.slice(0, 5); // 回復為最多 5 個基本技能

		// 過濾憶靈技能 - 第一個憶靈技和第一個憶靈天賦
		let foundMemospriteSkill = false;
		let foundMemospriteTalent = false;
		let foundElationSkill = false;

		const extraSkills = allSkills.filter(skill => {
			if (
				(!skill.icon && !skill.item_url) ||
				(!skill.type_text && !skill.remake)
			) {
				return false;
			}

			const skillType = skill.type || "";
			const skillTypeText = skill.type_text || skill.remake || "";

			// 憶靈技：只顯示第一個
			if (
				skillType === "MemospriteSkill" ||
				skillTypeText === tr("profile_MemospriteSkill")
			) {
				if (!foundMemospriteSkill) {
					foundMemospriteSkill = true;
					return true;
				}
				return false;
			}

			// 憶靈天賦：只顯示第一個
			if (
				skillType === "MemospriteTalent" ||
				skillTypeText === tr("profile_MemospriteTalent")
			) {
				if (!foundMemospriteTalent) {
					foundMemospriteTalent = true;
					return true;
				}
				return false;
			}

			// 歡愉技 (Elation Skill)：point_type 為 4
			if (
				skill.point_type === 4 ||
				skillType === "ElationSkill" ||
				skillTypeText === tr("profile_ElationSkill") ||
				skillTypeText === "Elation Skill"
			) {
				if (!foundElationSkill) {
					foundElationSkill = true;
					return true;
				}
				return false;
			}

			return false;
		});

		// 合併技能列表：主要技能 + 額外技能（憶靈/歡愉）
		const mainSkills = [...basicSkills, ...extraSkills];

		// 計算額外技能數量來調整技能排版
		const extraSkillsCount = extraSkills.length;

		// 總的額外技能數量
		const totalExtraSkillsCount = servantSkillsCount + extraSkillsCount;
		const baseSkillX =
			totalExtraSkillsCount > 0 ? 650 - totalExtraSkillsCount * 45 : 650;

		const skillPromises = mainSkills
			.map((skill, i) => {
				// 處理圖片 URL
				const imageUrl =
					skill.item_url ||
					(skill.icon
						? skill.icon.startsWith("http")
							? skill.icon
							: `${image_Header}/${skill.icon}`
						: null);

				if (!imageUrl) {
					return null;
				}

				return loadImageAsync(imageUrl).then(skillImageResult => ({
					skillImage: skillImageResult?.image,
					type_text:
						skill.type_text || skill.remake || tr("profile_Skill"),
					level: skill.level || 1
				}));
			})
			.filter(Boolean);

		const skills = await Promise.all(skillPromises);

		skills.forEach((skill, index) => {
			if (skill?.skillImage) {
				ctx.drawImage(
					skill.skillImage,
					baseSkillX + index * 90,
					760,
					80,
					80
				);
			}
			ctx.textAlign = "center";

			const originalLabel = `${skill?.type_text || ""}`;
			let displayLabel = originalLabel;
			if (userLang === "en") {
				const lower = originalLabel.toLowerCase();
				if (lower.includes("memosprite talent"))
					displayLabel = "M.Talent";
				else if (lower.includes("memosprite skill"))
					displayLabel = "M.Skill";
				else if (originalLabel.length > 12)
					displayLabel = originalLabel
						.replace("Technique", "Tech")
						.replace("Ultimate", "Ult");
			} else if (userLang === "tw") {
				if (originalLabel === "Elation Skill")
					displayLabel = tr("profile_ElationSkill");
			}
			let fontSize = 18;
			setupFont(ctx, fontSize, true);
			const maxLabelWidth = 80;
			while (
				ctx.measureText(displayLabel).width > maxLabelWidth &&
				fontSize > 14
			) {
				fontSize -= 1;
				setupFont(ctx, fontSize, true);
			}
			ctx.fillText(displayLabel, baseSkillX + 40 + index * 90, 870);
			setupFont(ctx, 16, true);
			let skillColor = "white";

			// 檢查是否為憶靈或歡愉技能 (Extra Skill)
			const currentSkill = skills[index];
			const isExtraSkill =
				currentSkill &&
				((currentSkill.type_text &&
					(currentSkill.type_text === tr("profile_MemospriteSkill") ||
						currentSkill.type_text ===
							tr("profile_MemospriteTalent") ||
						currentSkill.type_text === tr("profile_ElationSkill") ||
						currentSkill.type_text === "Elation Skill")) ||
					(skill?.type_text &&
						(skill.type_text === tr("profile_MemospriteSkill") ||
							skill.type_text ===
								tr("profile_MemospriteTalent") ||
							skill.type_text === tr("profile_ElationSkill") ||
							skill.type_text === "Elation Skill")));

			if (isExtraSkill) {
				// 額外技能使用和 servantSkill 相同的顏色邏輯
				const extraIndex =
					skills
						.slice(0, index + 1)
						.filter(
							s =>
								s?.type_text ===
									tr("profile_MemospriteSkill") ||
								s?.type_text ===
									tr("profile_MemospriteTalent") ||
								s?.type_text === tr("profile_ElationSkill") ||
								s?.type_text === "Elation Skill"
						).length - 1;

				if (character.rank >= 3 && extraIndex === 1)
					skillColor = "#DCC491";
				if (character.rank >= 5 && extraIndex === 0)
					skillColor = "#DCC491";
			} else {
				// 主要技能的顏色邏輯
				if (character.rank >= 3 && (index === 0 || index === 2))
					skillColor = "#DCC491";
				if (character.rank >= 5 && (index === 1 || index === 3))
					skillColor = "#DCC491";
			}

			ctx.fillStyle = skillColor;
			ctx.fillText(
				`${tr("level")} ${skill?.level || 0}`,
				baseSkillX + 40 + index * 90,
				890
			);
			ctx.fillStyle = "white";
		});

		if (hasServantSkills) {
			const servantSkillPromises = (
				character.servant_detail?.servant_skills || []
			).map(servantSkill => {
				return loadImageAsync(
					servantSkill.item_url ||
						image_Header + "/" + servantSkill.icon
				).then(skillImageResult => ({
					skillImage: skillImageResult?.image,
					type_text: servantSkill.remake,
					level: servantSkill.level
				}));
			});

			const servantSkills = await Promise.all(servantSkillPromises);

			servantSkills.forEach((servantSkill, index) => {
				const servantSkillX =
					650 + (skills.length - 1) * 90 + index * 90;

				if (servantSkill.skillImage) {
					ctx.drawImage(
						servantSkill.skillImage,
						servantSkillX,
						760,
						80,
						80
					);
				}
				ctx.textAlign = "center";
				// 英語下憶靈技能名稱過長處理
				let servantLabel = `${servantSkill.type_text}`;
				if (userLang === "en") {
					const lower = servantLabel.toLowerCase();
					if (lower.includes("memosprite talent"))
						servantLabel = "M.Talent";
					else if (lower.includes("memosprite skill"))
						servantLabel = "M.Skill";
				}
				let svFont = 18;
				setupFont(ctx, svFont, true);
				const svMax = 80;
				while (
					ctx.measureText(servantLabel).width > svMax &&
					svFont > 14
				) {
					svFont -= 1;
					setupFont(ctx, svFont, true);
				}
				ctx.fillText(servantLabel, servantSkillX + 40, 870);
				setupFont(ctx, 16, true);
				let skillColor = "white";
				if (character.rank >= 3 && index === 1) skillColor = "#DCC491";
				if (character.rank >= 5 && index === 0) skillColor = "#DCC491";
				ctx.fillStyle = skillColor;
				ctx.fillText(
					`${tr("level")} ${servantSkill.level}`,
					servantSkillX + 40,
					890
				);
				ctx.fillStyle = "white";
			});
		}

		ctx.strokeStyle = "#fff";
		ctx.beginPath();
		ctx.moveTo(hasServantSkills ? 680 : 670, 920);
		ctx.lineTo(hasServantSkills ? 1070 : 1050, 920);
		ctx.stroke();

		setupFont(ctx, 32, true);
		ctx.fillText(
			playerData.player.nickname,
			hasServantSkills ? 870 : 850,
			970
		);

		setupFont(ctx, 26);
		ctx.fillStyle = "lightgray";
		ctx.fillText(playerData.player.uid, hasServantSkills ? 870 : 850, 1010);

		// 顯示總分 - 置中於左側面板 (x=50 到 x=500，中心=275)
		const centerX = 275;
		ctx.font = "bold 32px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.textAlign = "center";
		ctx.fillStyle = "white";

		if (relicsScore) {
			const scoreOffsetY = 56;
			const tipOffsetY = 86;

			const scoreText = tr("RelicGrade", {
				grade: `${relicsScore.totalScore}`
			});
			const gradeText = relicsScore.totalGrade.grade;

			ctx.font = "bold 32px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			const scoreWidth = ctx.measureText(scoreText).width;
			const gradeWidth = ctx.measureText(gradeText).width;
			const gap = 8;
			const totalWidth = scoreWidth + gap + gradeWidth;
			const blockStartX = centerX - totalWidth / 2;

			ctx.textAlign = "left";
			ctx.fillStyle = "white";
			ctx.fillText(
				scoreText,
				blockStartX,
				effectivePanelBottomY + scoreOffsetY
			);

			ctx.fillStyle = `${relicsScore.totalGrade.color}`;
			ctx.fillText(
				gradeText,
				blockStartX + scoreWidth + gap,
				effectivePanelBottomY + scoreOffsetY
			);

			if (isAllCharacter) {
				ctx.textAlign = "center";
				ctx.fillStyle = "lightgray";
				ctx.font =
					"bold 20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
				ctx.fillText(tr("profile_Tip"), centerX, effectivePanelBottomY + tipOffsetY);
			}
		} else {
			ctx.textAlign = "center";
			ctx.fillText(tr("RelicNoScore"), centerX - 200, 830);
		}

		const relicRenderData = await Promise.all(
			allRelics.map(async (relic: any, i) => {
				if (!relic) {
					return {
						relic: null,
						index: i,
						icons: {
							main: null,
							rarity: null,
							mainAffix: null,
							subAffixes: []
						},
						score: null
					};
				}

				// 處理子屬性圖標
				const subAffixIconResults = await Promise.all(
					(relic.sub_affix || relic.properties || []).map(
						(subAff: any) =>
							loadImageAsync(
								`./src/assets/image/${subAff.icon?.replace("Icon", "icon") || `icon/property/icon${propertyMap[subAff.property_type]}.png`}`
							)
					)
				);
				const subAffixIcons = subAffixIconResults.map(
					result => result?.image
				);

				// 處理主屬性圖標
				const mainAffixIconResult = await loadImageAsync(
					`./src/assets/image/${relic.main_affix?.icon?.replace("Icon", "icon").replace("Base", "") || `icon/property/icon${propertyMap[relic.main_property?.property_type || 0]}.png`}`
				);

				const rarityIconResult = await loadImageAsync(
					`./src/assets/image/icon/deco/Star${relic.rarity == 5 ? "5" : "4"}.png`
				);
				const mainAffixIcon = mainAffixIconResult?.image;
				const rarityIcon = rarityIconResult?.image;

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
			const { index: i, icons, score } = data;
			const relic: any = data.relic;

			let row = Math.floor(i / 2);
			let column = i % 2;
			let x = 1210 + column * (width + padding);
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

			if (relic) {
				if (icons.main) {
					ctx.drawImage(icons.main, x + 10, y + 20, 96, 96);
				}
				if (icons.rarity) {
					ctx.drawImage(icons.rarity, x + 15, y + 115, 83.78, 16.75);
				}

				setupFont(ctx, 20, true);
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(`+${relic.level}`, x + 55, y + 150);

				const mainAff = relic.main_affix?.weight || 0;
				if (icons.mainAffix) {
					ctx.drawImage(icons.mainAffix, x + 100, y + 15, 40, 40);
				}
				ctx.fillStyle =
					mainAff >= 0.75
						? "#F3B664"
						: mainAff > 0
							? "#FFFFFF"
							: "#B6BBC4";
				ctx.textAlign = "left";

				let text =
					relic.main_affix?.name ||
					tr(
						`property_${relic.main_affix?.propertyName || propertyMap[relic.main_property?.property_type || 0]}`
					);
				// 英文環境縮寫關鍵詞，避免過長
				if (userLang === "en" && typeof text === "string") {
					text = text
						.replace(/Critical Damage/g, "Crit DMG")
						.replace(/Critical Rate/g, "Crit Rate");
				}
				if (typeof text !== "string") text = "";

				// 動態調整字體大小以適應寬度
				const relicTextMaxWidth = 115; // 可用寬度
				let fontSize = 22;
				let minFontSize = 12;

				// 找到合適的字體大小
				while (fontSize > minFontSize) {
					setupFont(ctx, fontSize, true);
					const textWidth = ctx.measureText(text).width;
					if (textWidth <= relicTextMaxWidth) {
						break;
					}
					fontSize--;
				}

				// 使用最終確定的字體大小繪製文字
				setupFont(ctx, fontSize, true);
				ctx.fillText(text, x + 140, y + 43);

				ctx.textAlign = "right";
				setupFont(ctx, 20, true);
				ctx.fillText(
					`${relic.main_affix?.display || relic.main_affix?.value || relic.main_property?.value}`,
					x + 320,
					y + 43
				);

				let affixYStart = 58;
				(relic.sub_affix || relic.properties || []).forEach(
					(subAffix: any, subIndex: number) => {
						if (icons.subAffixes[subIndex]) {
							ctx.drawImage(
								icons.subAffixes[subIndex],
								x + 103,
								y + affixYStart + subIndex * 34,
								32,
								32
							);
						}

						let fontSize = 18;
						setupFont(ctx, fontSize, true);

						const weight = subAffix.weight || 0;
						const color =
							weight >= 0.75
								? "#F3B664"
								: weight > 0
									? "#FFFFFF"
									: "#B6BBC4";
						ctx.fillStyle = color;
						ctx.textAlign = "left";

						let text =
							subAffix.name ||
							tr(
								`property_${subAffix.propertyName || propertyMap[subAffix.property_type]}`
							);
						// 英文環境縮寫關鍵詞
						if (userLang === "en" && typeof text === "string") {
							text = text
								.replace(/Critical Damage/g, "CritDMG")
								.replace(/Critical Rate/g, "CritRATE");
						}
						// 限制名稱最右邊不超過 +count 的左側
						const nameStartX = x + 137;
						const nameRightLimit = x + 240;
						const allowedWidth = Math.max(
							60,
							nameRightLimit - nameStartX
						);
						let textWidth = ctx.measureText(text).width;

						while (textWidth > allowedWidth && fontSize > 14) {
							fontSize -= 1;
							setupFont(ctx, fontSize, true);
							textWidth = ctx.measureText(text).width;
						}
						if (textWidth > allowedWidth) {
							while (
								text.length > 0 &&
								ctx.measureText(text + "...").width >
									allowedWidth
							) {
								text = text.slice(0, -1);
							}
							text = text + "...";
						}

						ctx.fillText(
							text,
							nameStartX,
							y + affixYStart + 23 + subIndex * 34
						);

						ctx.textAlign = "right";
						setupFont(ctx, 18, true);
						ctx.fillText(
							`${subAffix.display || subAffix.value}`,
							x + 320,
							y + affixYStart + 25 + subIndex * 34
						);

						// 疊層顯示優化
						const count = Number(
							(subAffix.count || 0) - 1 ||
								(subAffix.times || 0) - 1 ||
								0
						);
						if (count >= 1) {
							ctx.font =
								"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
							ctx.textAlign = "center";
							ctx.fillText(
								`+${count}`,
								x + 250,
								y + affixYStart + 23 + subIndex * 34
							);
						}
					}
				);
			} else {
				// 未裝備遺器的佔位顯示 - 優化設計
				const centerX = x + width / 2;
				const centerY = y + height / 2;

				ctx.save();
				// 繪製虛線邊框
				ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
				ctx.lineWidth = 2;
				ctx.setLineDash([8, 8]);
				ctx.strokeRect(x + 10, y + 10, width - 20, height - 20);
				ctx.restore();

				ctx.textAlign = "center";
				ctx.textBaseline = "middle";

				// 繪製 "Empty" 文字
				setupFont(ctx, 28, true);
				ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
				ctx.fillText(tr("None").toUpperCase(), centerX, centerY);

				// 恢復 textBaseline
				ctx.textBaseline = "alphabetic";
			}

			if (score) {
				setupFont(ctx, 22, true);
				ctx.fillStyle = `${score.grade?.color || "#FFFFFF"}`;
				ctx.textAlign = "center";
				ctx.fillText(
					`${score.scoreN} - ${score.grade?.grade || "N/A"}`,
					x + 55,
					y + 190
				);
			}
		});

		return canvas.toBuffer("image/webp");
	} catch (error) {
		console.error("Error generating image:", error);
		// 尝试创建一个简单的错误图片
		try {
			const errorCanvas = createCanvas(1920, 1080);
			const errorCtx = errorCanvas.getContext("2d");
			errorCtx.fillStyle = "#1a1a2e";
			errorCtx.fillRect(0, 0, 1920, 1080);
			errorCtx.fillStyle = "white";
			errorCtx.font = "48px Arial";
			errorCtx.textAlign = "center";
			errorCtx.fillText(tr("profile_DrawFailed"), 960, 540);
			return errorCanvas.toBuffer("image/webp");
		} catch (fallbackError) {
			console.error("Failed to create error image:", fallbackError);
			return null;
		}
	}
}

async function drawAllCharactersImage(
	tr: any,
	playerData: PlayerData,
	characters: Character[],
	filterInfo: FilterInfo | null = null,
	bgPath?: string
): Promise<Buffer | null> {
	try {
		const mf = (ctx: any, size: number, bold = false) => {
			ctx.font = `${bold ? "bold " : ""}${size}px 'YaHei','URW DIN Arabic',Arial,sans-serif`;
		};

		// ── Layout constants ───────────────────────────────────────────────
		const W = 1920;
		const LEFT_W = 340;
		const GRID_X = LEFT_W + 20;
		const GRID_COLS = 6;
		const CARD_W = 245, CARD_H = 300, CARD_GAP = 14;
		const GRID_TOP = 28;
		const totalRows = Math.ceil(characters.length / GRID_COLS);
		const H = Math.max(1080, GRID_TOP + totalRows * (CARD_H + CARD_GAP) + 28);

		const canvas = createCanvas(W, H);
		const ctx = canvas.getContext("2d");

		// ── 1. Background ──────────────────────────────────────────────────
		const bgResult = await loadImageAsync(bgPath ?? await getTodayBg());
		if (bgResult?.image) {
			ctx.drawImage(bgResult.image, 0, 0, W, H);
		} else {
			ctx.fillStyle = "#0d1117";
			ctx.fillRect(0, 0, W, H);
		}
		ctx.fillStyle = "rgba(0,0,0,0.55)";
		ctx.fillRect(0, 0, W, H);

		// ── 2. Left panel (glass) ──────────────────────────────────────────
		fillGlass(ctx, 14, 14, LEFT_W, H - 28, 14, 0.5);

		const avatarCX = 14 + LEFT_W / 2;
		const avatarCY = 110;
		const avatarR = 68;

		// Avatar
		const avatarResult = await loadImageAsync(
			`${image_Header}/${playerData.player.avatar.icon}`
		);
		if (avatarResult?.image) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(
				avatarResult.image,
				avatarCX - avatarR, avatarCY - avatarR,
				avatarR * 2, avatarR * 2
			);
			ctx.restore();
		}
		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarCX, avatarCY, avatarR + 3, 0, Math.PI * 2);
		ctx.strokeStyle = "#D4AF37";
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.restore();

		// Anomaly icon overlay
		const anomalyRecord = (await database.get(
			`${playerData.player.uid}.anomalyRoundNum`
		)) as AnomalyRoundRecord | null;
		if (anomalyRecord && Date.now() / 1000 < anomalyRecord.expireTime) {
			const iconPath = getAnomalyIconPath(anomalyRecord.roundNum);
			if (iconPath) {
				const anomalyIcon = await loadImage(iconPath);
				if (anomalyIcon) {
					const iSize = avatarR * 2 * 1.1;
					ctx.drawImage(
						anomalyIcon,
						avatarCX - avatarR - iSize * 0.05,
						avatarCY - avatarR - iSize * 0.05,
						iSize, iSize
					);
				}
			}
		}

		// Nickname
		mf(ctx, 30, true);
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "center";
		ctx.fillText(playerData.player.nickname, avatarCX, avatarCY + avatarR + 36);

		// UID
		mf(ctx, 20);
		ctx.fillStyle = "rgba(255,255,255,0.6)";
		ctx.fillText(`UID  ${playerData.player.uid}`, avatarCX, avatarCY + avatarR + 60);

		// Anomaly rank badges
		const anomalyRankRecords = (await database.get(
			`${playerData.player.uid}.anomalyRankIcon`
		)) as AnomalyRankRecord[] | null;
		if (anomalyRankRecords && anomalyRankRecords.length > 0) {
			anomalyRankRecords.sort((a, b) => b.challengeTime - a.challengeTime);
			const badges = anomalyRankRecords.slice(0, 5);
			const badgeSz = 32;
			const totalBW = badges.length * badgeSz + (badges.length - 1) * 5;
			let bx = avatarCX - totalBW / 2;
			const by = avatarCY + avatarR + 70;
			for (const record of badges) {
				try {
					let src: string | Buffer = record.rankIcon;
					if (record.rankIcon?.startsWith("http")) {
						const resp = await axios.get(record.rankIcon, { responseType: "arraybuffer", timeout: 10000 });
						src = Buffer.from(resp.data);
					}
					const bi = await loadImage(src);
					if (bi) ctx.drawImage(bi, bx, by, badgeSz, badgeSz);
				} catch { /* skip */ }
				bx += badgeSz + 5;
			}
		}

		// Divider
		const divY1 = avatarCY + avatarR + 108;
		ctx.strokeStyle = "rgba(255,255,255,0.2)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(28, divY1);
		ctx.lineTo(14 + LEFT_W - 14, divY1);
		ctx.stroke();

		// Stats grid
		const stats = [
			{ label: tr("profile_TrailblazeLevel"),  value: `${playerData.player.level}` },
			{ label: tr("profile_EquilibriumLevel"),  value: `${playerData.player.world_level ?? "-"}` },
			{ label: tr("profile_CharactersCount"),   value: `${characters.length}` },
			{ label: tr("profile_AchievementsCount"), value: `${playerData.player.space_info?.achievement_count ?? "-"}` }
		];
		const gX0 = 28, gY0 = divY1 + 18;
		const gColW = LEFT_W / 2, gRowH = 74;
		stats.forEach((s, i) => {
			const col = i % 2, row = Math.floor(i / 2);
			const sx = gX0 + col * gColW + gColW / 2;
			const sy = gY0 + row * gRowH;
			mf(ctx, 28, true);
			ctx.fillStyle = "#FFFFFF";
			ctx.textAlign = "center";
			ctx.fillText(s.value, sx, sy + 30);
			mf(ctx, 16);
			ctx.fillStyle = "rgba(255,255,255,0.55)";
			ctx.fillText(s.label, sx, sy + 50);
		});

		// Filter / sort status
		if (filterInfo && (filterInfo.filters.length > 0 || filterInfo.sortType)) {
			const divY2 = gY0 + 2 * gRowH + 10;
			ctx.strokeStyle = "rgba(255,255,255,0.2)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(28, divY2);
			ctx.lineTo(14 + LEFT_W - 14, divY2);
			ctx.stroke();

			const filterLabelMap: Record<string, string> = {};
			try {
				const [elemData, pathData] = await Promise.all([
					loadElementsData("cht"),
					loadPathsData("cht")
				]);
				if (elemData) for (const val of Object.values(elemData) as any[]) filterLabelMap[val.id.toLowerCase()] = val.name;
				if (pathData) for (const val of Object.values(pathData) as any[]) filterLabelMap[val.text.toLowerCase()] = val.name;
			} catch {
				Object.assign(filterLabelMap, {
					physical: tr("element_physical"), ice: tr("element_ice"),
					fire: tr("element_fire"), lightning: tr("element_lightning"),
					wind: tr("element_wind"), quantum: tr("element_quantum"),
					imaginary: tr("element_imaginary"), destruction: tr("path_destruction"),
					harmony: tr("path_harmony"), erudition: tr("path_erudition"),
					hunt: tr("path_hunt"), preservation: tr("path_preservation"),
					nihility: tr("path_nihility"), abundance: tr("path_abundance"),
					remembrance: tr("path_remembrance")
				});
			}

			let statusLines: string[] = [];
			if (filterInfo.sortType === "sort_level") statusLines.push(tr("profile_SortByLevel"));
			else if (filterInfo.sortType === "sort_eidolon") statusLines.push(tr("profile_SortByEidolon"));
			if (filterInfo.filters.length > 0) {
				statusLines.push(filterInfo.filters.map(f => filterLabelMap[f] || f).join(" / "));
			}

			mf(ctx, 18, true);
			ctx.fillStyle = "#D4AF37";
			ctx.textAlign = "left";
			statusLines.forEach((line, i) => {
				ctx.fillText(`※ ${line}`, 28, divY2 + 22 + i * 26);
			});
		}

		// ── 3. Character grid ───────────────────────────────────────────────
		const pathMapper: Record<string, string> = {
			warrior: "destruction", rogue: "hunt", mage: "erudition",
			priest: "abundance", shaman: "harmony", warlock: "nihility",
			knight: "preservation", memory: "remembrance", elation: "elation"
		};

		for (let i = 0; i < characters.length; i++) {
			const char = characters[i];
			if (!char) continue;
			const col = i % GRID_COLS;
			const row = Math.floor(i / GRID_COLS);
			const cx = GRID_X + col * (CARD_W + CARD_GAP);
			const cy = GRID_TOP + row * (CARD_H + CARD_GAP);

			// glass card
			fillGlass(ctx, cx, cy, CARD_W, CARD_H, 10, 0.38);

			// character icon (top portion)
			const charIconResult = await loadImageAsync(char.icon);
			const charIcon = charIconResult?.image;
			if (charIcon) {
				ctx.save();
				drawRoundRect(ctx, cx, cy, CARD_W, CARD_H, 10);
				ctx.clip();
				const iconH = CARD_H * 0.65;
				const srcAR = charIcon.width / charIcon.height;
				const dstH = iconH * 1.15;
				const dstW = dstH * srcAR;
				const dx = cx + (CARD_W - dstW) / 2;
				ctx.drawImage(charIcon, dx, cy - iconH * 0.08, dstW, dstH);
				ctx.restore();
			}

			// Bottom info bar
			const barH = 90;
			ctx.save();
			drawRoundRect(ctx, cx, cy + CARD_H - barH, CARD_W, barH, 10);
			ctx.clip();
			ctx.fillStyle = "rgba(0,0,0,0.70)";
			ctx.fillRect(cx, cy + CARD_H - barH, CARD_W, barH);
			ctx.restore();

			// Name
			mf(ctx, 18, true);
			ctx.fillStyle = "#FFD89C";
			ctx.textAlign = "center";
			ctx.fillText(char.name, cx + CARD_W / 2, cy + CARD_H - barH + 22);

			// Lv + Eidolon
			mf(ctx, 16);
			ctx.fillStyle = "rgba(255,255,255,0.85)";
			ctx.fillText(`Lv.${char.level}  E${char.rank ?? 0}`, cx + CARD_W / 2, cy + CARD_H - barH + 44);

			// Element + Path icons
			const elementIconResult = await loadImageAsync(
				`./src/assets/image/element/${(typeof char.element === "string" ? char.element : char.element?.id || "physical").toLowerCase()}.png`
			);
			let pathIconPath: string;
			if (char.base_type) {
				const pathName = (await getPathMap())[char.base_type] || "none";
				pathIconPath = `./src/assets/image/icon/path/${pathName}Small.png`;
			} else if (char.path) {
				const rawPath = (typeof char.path === "string" ? char.path : char.path?.id || "none").toLowerCase();
				pathIconPath = `./src/assets/image/icon/path/${pathMapper[rawPath] || rawPath}Small.png`;
			} else {
				pathIconPath = `./src/assets/image/icon/path/none.png`;
			}
			const [pathIconResult] = await Promise.all([loadImageAsync(pathIconPath)]);
			const iconSz = 28;
			const iconY2 = cy + CARD_H - barH + 52;
			const totalIconW = (elementIconResult?.image ? iconSz : 0) + (pathIconResult?.image ? iconSz : 0) + 4;
			let ix = cx + (CARD_W - totalIconW) / 2;
			if (pathIconResult?.image) { ctx.drawImage(pathIconResult.image, ix, iconY2, iconSz, iconSz); ix += iconSz + 4; }
			if (elementIconResult?.image) { ctx.drawImage(elementIconResult.image, ix, iconY2, iconSz, iconSz); }

			// Light cone (small, top-right corner of card)
			if (char.equip?.icon) {
				const lcResult = await loadImageAsync(char.equip.icon);
				if (lcResult?.image) {
					const lcSz = 52;
					ctx.save();
					drawRoundRect(ctx, cx + CARD_W - lcSz - 4, cy + 4, lcSz, lcSz, 6);
					ctx.clip();
					ctx.drawImage(lcResult.image, cx + CARD_W - lcSz - 4, cy + 4, lcSz, lcSz);
					ctx.restore();
					mf(ctx, 13, true);
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(`${char.equip.level ?? ""}`, cx + CARD_W - lcSz / 2 - 4, cy + lcSz + 10);
				}
			}
		}

		return canvas.toBuffer("image/webp");
	} catch (error) {
		console.error("Error generating all characters image:", error);
		return null;
	}
}
async function setupLeaderboardMaintenance(): Promise<void> {
	try {
		console.log("[Leaderboard] Starting scheduled maintenance...");
		const result = await maintainLeaderboard(30, 10);
		console.log(
			`[Leaderboard] Scheduled maintenance completed: ${result.cleanedCharacters} characters cleaned, ${result.removedEntries} entries removed`
		);
	} catch (error) {
		console.error("[Leaderboard] Scheduled maintenance failed:", error);
	}

	console.log(`[Leaderboard] Maintenance scheduled every 24 hours`);
}

/**
 * 優化的排行榜數據獲取函數
 * @param characterId - 角色ID
 * @param limit - 限制返回的記錄數量
 */
async function getOptimizedLeaderboard(
	characterId: string,
	limit: number = 10
): Promise<LeaderboardData | null> {
	try {
		const leaderboard: Leaderboard =
			(await database.get("LeaderBoard")) || {};
		const characterData = leaderboard[characterId];

		if (
			!characterData ||
			!characterData.score ||
			characterData.score.length === 0
		) {
			return null;
		}

		// 只返回需要的數據，減少內存使用
		const optimizedScores = characterData.score
			.slice(0, limit)
			.map(entry => ({
				uid: entry.uid,
				nickname: entry.nickname,
				avatar: entry.avatar,
				score: entry.score,
				characterLevel: entry.characterLevel,
				characterRank: entry.characterRank,
				lastUpdated: entry.lastUpdated
			}));

		return {
			id: characterData.id,
			icon: characterData.icon,
			element: characterData.element,
			score: optimizedScores,
			stats: characterData.stats,
			lastUpdated: Date.now()
		};
	} catch (error) {
		console.error("[Optimized Leaderboard] Error:", error);
		return null;
	}
}

// 添加文本處理函數
function parseSegments(text: string): TextSegment[] {
	const result: TextSegment[] = [];
	let lastIndex = 0;
	let regex = /\[GOLD\](.*?)\[\/GOLD\]/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			result.push({
				text: text.slice(lastIndex, match.index),
				color: "white"
			});
		}
		result.push({ text: match[1] || "", color: "#DCC491" });
		lastIndex = regex.lastIndex;
	}
	if (lastIndex < text.length) {
		result.push({ text: text.slice(lastIndex), color: "white" });
	}
	return result;
}

function wrapSegments(
	segments: TextSegment[],
	maxWidth: number,
	ctx: any
): TextSegment[][] {
	const lines: TextSegment[][] = [];
	let currentLine: TextSegment[] = [];
	let currentLineWidth = 0;
	for (const seg of segments) {
		let segText = seg.text;
		let segColor = seg.color;
		while (segText.length > 0) {
			let fitLength = segText.length;
			let subText = segText;
			// 若本段加上去會超過寬度，則嘗試裁切
			while (
				ctx.measureText(subText).width + currentLineWidth > maxWidth &&
				fitLength > 1
			) {
				fitLength--;
				subText = segText.slice(0, fitLength);
			}
			if (
				ctx.measureText(subText).width + currentLineWidth > maxWidth &&
				currentLine.length > 0
			) {
				// 當前行已滿，換行
				lines.push(currentLine);
				currentLine = [];
				currentLineWidth = 0;
				continue;
			}
			currentLine.push({ text: subText, color: segColor });
			currentLineWidth += ctx.measureText(subText).width;
			segText = segText.slice(fitLength);
			if (segText.length > 0) {
				// 剩下的內容換行
				lines.push(currentLine);
				currentLine = [];
				currentLineWidth = 0;
			}
		}
	}
	if (currentLine.length > 0) lines.push(currentLine);
	return lines;
}

function drawColoredTextLines(
	lines: TextSegment[][],
	x: number,
	y: number,
	lineHeight: number,
	ctx: any,
	maxY?: number
): void {
	for (let i = 0; i < lines.length; i++) {
		if (typeof maxY === "number" && y + lineHeight > maxY) {
			// 超出高度，最後一行加 ...
			const lastLine = lines[i - 1];
			if (lastLine) {
				// 在最後一個 segment 後加 ...
				if (lastLine.length > 0) {
					const lastSegment = lastLine[lastLine.length - 1];
					if (lastSegment) {
						lastSegment.text += "...";
					}
				} else {
					lastLine.push({ text: "...", color: "white" });
				}
				// 重繪最後一行
				let currentX = x;
				for (const seg of lastLine) {
					ctx.fillStyle = seg.color;
					ctx.fillText(seg.text, currentX, y - lineHeight);
					currentX += ctx.measureText(seg.text).width;
				}
			}
			break;
		}
		let currentX = x;
		for (const seg of lines[i] || []) {
			ctx.fillStyle = seg.color;
			ctx.fillText(seg.text, currentX, y);
			currentX += ctx.measureText(seg.text).width;
		}
		y += lineHeight;
	}
}

// 移除圖片預加載緩存，改為即時載入以節省記憶體

// 移除預加載功能
async function preloadCommonImages(): Promise<void> {
	return;
}

// 簡化的圖片載入函數，不進行全域緩存
const loadImageOptimized = async (
	url: string,
	fallbackUrl?: string | null
): Promise<any> => {
	try {
		const result = await loadImageAsync(url, fallbackUrl);
		return result.image;
	} catch (error) {
		console.warn(`Failed to load image: ${url}`, error);
		return null;
	}
};

export {
	handleProfileDraw,
	drawMainImage,
	drawCharacterImage,
	drawAllCharactersImage,
	saveLeaderboard,
	maintainLeaderboard,
	getLeaderboardStats,
	setupLeaderboardMaintenance,
	getOptimizedLeaderboard,
	preloadCommonImages,
	loadImageOptimized,
	downloadCharacterPortrait,
	downloadCharacterPortraits,
	downloadImage,
	downloadImages
};
