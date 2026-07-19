import axios from "axios";
import type { Interaction } from "discord.js";
import type { EnkaHsrResponse, EnkaPlayerResult } from "@/types/enkaHsr.js";
import { adaptEnkaProfile } from "./enkaAdapter.js";
import { loadStarRailRes, type StarRailResLocale } from "./starRailRes.js";

const ENKA_HSR_URL = "https://enka.network/api/hsr/uid";
const MIN_TTL_MS = 30_000;
const MAX_TTL_MS = 10 * 60_000;
const cache = new Map<string, { expiresAt: number; value: EnkaPlayerResult }>();
const inflight = new Map<string, Promise<EnkaPlayerResult>>();

export interface PlayerDataResponse {
	status: number;
	playerData: any;
	errorCode?: string | undefined;
}

function errorResult(status: number, code: NonNullable<EnkaPlayerResult["error"]>["code"], message: string): EnkaPlayerResult {
	return { status, error: { code, message } };
}

function normalizeError(error: any): EnkaPlayerResult {
	const status = Number(error?.response?.status ?? 503);
	if (status === 404) return errorResult(404, "PLAYER_NOT_FOUND", "找不到這個玩家");
	if (status === 429) return errorResult(429, "RATE_LIMITED", "Enka 查詢過於頻繁，請稍後再試");
	if (status >= 500 || error?.code === "ECONNABORTED") return errorResult(503, "UPSTREAM_UNAVAILABLE", "Enka 暫時無法使用");
	return errorResult(status || 400, "INVALID_RESPONSE", error?.message ?? "Enka 回傳無效資料");
}

async function fetchEnka(uid: string): Promise<EnkaPlayerResult> {
	try {
		const response = await axios.get<EnkaHsrResponse>(`${ENKA_HSR_URL}/${uid}`, { timeout: 15_000 });
		const data = response.data;
		if (!data || typeof data !== "object") return errorResult(502, "INVALID_RESPONSE", "Enka 回傳無效資料");
		if (!data.detailInfo) return errorResult(404, "PLAYER_NOT_FOUND", data.message ?? "找不到這個玩家");
		if (!Array.isArray(data.detailInfo.avatarDetailList) || data.detailInfo.avatarDetailList.length === 0) {
			return errorResult(422, "PROFILE_PRIVATE", "請先在遊戲內公開展示角色");
		}
		return { status: 200, data };
	} catch (error) {
		return normalizeError(error);
	}
}

export function requestEnkaPlayer(uid: string): Promise<EnkaPlayerResult> {
	if (!/^\d{9}$/.test(uid)) return Promise.resolve(errorResult(400, "INVALID_UID", "UID 必須為 9 位數字"));
	const cached = cache.get(uid);
	if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
	const pending = inflight.get(uid);
	if (pending) return pending;
	const request = fetchEnka(uid).then(result => {
		const ttlSeconds = result.data?.ttl ?? 60;
		const ttlMs = Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Number(ttlSeconds) * 1000));
		cache.set(uid, { expiresAt: Date.now() + ttlMs, value: result });
		return result;
	}).finally(() => inflight.delete(uid));
	inflight.set(uid, request);
	return request;
}

export function clearEnkaCache(): void {
	cache.clear();
	inflight.clear();
}

function localeForInteraction(interaction?: Interaction): StarRailResLocale {
	return interaction && "locale" in interaction && interaction.locale === "zh-TW" ? "tw" : "en";
}

export async function getEnkaPlayerData(uid: string, locale: StarRailResLocale = "tw"): Promise<PlayerDataResponse> {
	const result = await requestEnkaPlayer(uid);
	if (!result.data) {
		return {
			status: result.status,
			errorCode: result.error?.code,
			playerData: { detail: result.error?.message, message: result.error?.message }
		};
	}
	try {
		const resources = await loadStarRailRes(locale);
		return { status: 200, playerData: adaptEnkaProfile(result.data, resources) };
	} catch (error: any) {
		return { status: 503, errorCode: "UPSTREAM_UNAVAILABLE", playerData: { detail: error?.message, message: error?.message } };
	}
}

/** Backward-compatible raw Enka lookup used by account-binding flows. */
export async function requestPlayerDataEnka(uid: string): Promise<PlayerDataResponse> {
	const result = await requestEnkaPlayer(uid);
	return {
		status: result.status,
		errorCode: result.error?.code,
		playerData: result.data ?? { detail: result.error?.message, message: result.error?.message }
	};
}

/** Public UID profile lookup. The data is Enka + StarRailRes canonical PlayerData. */
export function requestPlayerData(uid: string, interaction?: Interaction): Promise<PlayerDataResponse> {
	return getEnkaPlayerData(uid, localeForInteraction(interaction));
}

export { ENKA_HSR_URL };
