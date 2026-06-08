/**
 * wallpaperManager.ts
 * 抓取 HSR 官方 Hoyolab 新聞（預告 & 版本更新）封面圖，作為 profile 動態背景
 */

import axios from "axios";
import { database } from "../../index.js";

const HOYOLAB_API =
	"https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface BgArticle {
	title: string;
	url: string; // 1920×1080 cover image URL
}

// In-memory cache
let bgPool: BgArticle[] = [];
let lastFetchTime = 0;

// Keywords to match (title must contain at least one)
const KEYWORDS = ["預告", "版本更新", "版本更新說明"];

function matchesKeyword(title: string): boolean {
	return KEYWORDS.some(kw => title.includes(kw));
}

async function fetchArticles(type: number): Promise<BgArticle[]> {
	const response = await axios.get(HOYOLAB_API, {
		headers: {
			"x-rpc-app_version": "2.43.0",
			"x-rpc-client_type": 4,
			"X-Rpc-Language": "zh-tw"
		},
		params: { gids: 6, page_size: 20, type },
		timeout: 10000
	});

	const list = response.data?.data?.list ?? [];
	const results: BgArticle[] = [];

	for (const item of list) {
		const title: string = item?.post?.subject ?? "";
		const covers: any[] = item?.cover_list ?? [];
		if (!covers.length) continue;
		const url = covers[0]?.url;
		if (!url) continue;
		results.push({ title, url });
	}

	return results;
}

/**
 * Refresh the bg pool from Hoyolab news.
 * type=1: 公告（含版本更新說明、預告、活動）
 * type=3: 遊戲資訊（角色介紹、活動詳情等）
 */
export async function refreshBgWallpapers(): Promise<void> {
	try {
		const [type1, type3] = await Promise.all([
			fetchArticles(1),
			fetchArticles(3)
		]);

		// Filter type1 by keyword, keep all type3 that are 預告/版本更新 related
		const filtered1 = type1.filter(a => matchesKeyword(a.title));
		// type3: keep anything with 版本/預告/角色預覽
		const filtered3 = type3.filter(a =>
			["預告", "版本", "角色預覽"].some(kw => a.title.includes(kw))
		);

		// Combine, deduplicate by URL
		const combined = [...filtered1, ...filtered3];
		const seen = new Set<string>();
		bgPool = combined.filter(a => {
			if (seen.has(a.url)) return false;
			seen.add(a.url);
			return true;
		});

		lastFetchTime = Date.now();
		console.log(`[wallpaperManager] Loaded ${bgPool.length} bg images`);
	} catch (err) {
		console.error("[wallpaperManager] Failed to fetch wallpapers:", err);
	}
}

async function ensureFresh(): Promise<void> {
	if (bgPool.length === 0 || Date.now() - lastFetchTime > CACHE_TTL_MS) {
		await refreshBgWallpapers();
	}
}

/** Get current bg pool */
export async function getBgPool(): Promise<BgArticle[]> {
	await ensureFresh();
	return bgPool;
}

/**
 * Get a random bg URL from the pool for today (globally consistent).
 * Falls back to static bg if pool is empty.
 */
export async function getTodayBg(): Promise<string> {
	await ensureFresh();
	if (bgPool.length === 0) {
		return "./src/assets/image/warp/bg.jpg";
	}
	// Use date as seed for daily-consistent random
	const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const idx = parseInt(today) % bgPool.length;
	return bgPool[idx]!.url;
}

/**
 * Set user's preferred bg. Pass null to reset to random.
 */
export async function setUserBgPref(
	userId: string,
	bgUrl: string | null
): Promise<void> {
	if (bgUrl === null) {
		database.delete(`hsr_bg_pref_${userId}`);
	} else {
		database.set(`hsr_bg_pref_${userId}`, bgUrl);
	}
}

/**
 * Get user's bg. Returns their fixed URL, or today's random from pool.
 */
export async function getUserBg(userId: string): Promise<string> {
	const pref = (await database.get(`hsr_bg_pref_${userId}`)) as string | undefined;
	if (typeof pref === "string" && pref.length > 0) {
		return pref;
	}
	return getTodayBg();
}
