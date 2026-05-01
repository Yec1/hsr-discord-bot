/**
 * Web-login finalizer (HSR).
 *
 * `drainPendingLogins` pulls unconsumed rows from Supabase (queued by the
 * web-login Next.js app) and routes each row to one of two paths:
 *
 *   1. `bindFromEnriched` — row has `enriched` payload AND a card for HSR
 *      (game_id = 6). Fast path: no Hoyolab API call. Writes a rich
 *      Character row with level/cover/stats from the card.
 *
 *   2. `bindCookieToUser` — fallback for rows without an HSR card
 *      (enriched missing or no HSR game on this Hoyolab account).
 *      Internally exchanges stoken → ltoken_v2 before calling getUserGameInfo.
 */
import { database, client } from "@/index.js";
import { getUserGameInfo, updateAccountInfo } from "@/utilities/index.js";
import { upsertHoyolab, upsertCharacter, type Character } from "@/utilities/accountStore.js";
import { getConfig } from "@/utilities/core/config.js";
import Logger from "@/utilities/core/logger.js";
import {
	fetchPendingLogins,
	markConsumed,
	decryptString,
	type EnrichedGameCard
} from "@/utilities/core/supabase.js";

interface Account {
	uid: string;
	nickname?: string;
	cookie?: string;
}

export interface BindResult {
	uid: string;
	nickname?: string;
	updated: boolean;
}

const log = new Logger("WebLogin");
const HSR_GAME_ID = 6;

/** Parse a cookie string into a key→value map. */
function parseCookieMap(cookieStr: string): Record<string, string> {
	return Object.fromEntries(
		cookieStr.split(";").map(p => {
			const [k, ...v] = p.trim().split("=");
			return [k!.trim(), v.join("=").trim()];
		})
	);
}

/** Extract stoken + ltmid_v2 from a raw cookie string for Hoyolab storage. */
function extractStokenFields(
	cookieStr: string
): { stoken: string; ltmid_v2: string } | null {
	try {
		const m = parseCookieMap(cookieStr);
		const stoken = m["stoken"];
		const ltmid_v2 = m["ltmid_v2"] ?? m["account_mid_v2"] ?? m["mid"];
		if (!stoken || !ltmid_v2) return null;
		return { stoken, ltmid_v2 };
	} catch {
		return null;
	}
}

/**
 * Exchange stoken → ltoken_v2 + cookie_token_v2 and return an enriched cookie string.
 * Returns null on any failure (caller should fall back to raw cookie).
 * Mirrors ZZZ's exchangeStokenForCookies but uses Node crypto directly.
 */
async function getTokensFromStokenInternal(
	stoken: string,
	ltuid_v2: string,
	ltmid_v2: string
): Promise<string | null> {
	const { createHash } = await import("node:crypto");
	const t = Math.floor(Date.now() / 1000);
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const r = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
	const APP_LOGIN_DS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
	const ds = createHash("md5")
		.update(`salt=${APP_LOGIN_DS_SALT}&t=${t}&r=${r}&b=&q=`)
		.digest("hex");
	const dsHeader = `${t},${r},${ds}`;
	const cookieStr = `stoken=${stoken}; ltuid_v2=${ltuid_v2}; ltmid_v2=${ltmid_v2}; mid=${ltmid_v2}`;

	try {
		const response = await fetch(
			"https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-rpc-app_id": "c9oqaq3s3gu8",
					ds: dsHeader,
					Cookie: cookieStr
				},
				body: JSON.stringify({ dst_token_types: [2, 4] })
			}
		);
		if (!response.ok) return null;
		const data: any = await response.json();
		if (data?.retcode !== 0 || !data?.data?.tokens) return null;
		let ltoken_v2 = "";
		let cookie_token_v2 = "";
		for (const token of data.data.tokens) {
			if (token.token_type === 2) ltoken_v2 = token.token;
			if (token.token_type === 4) cookie_token_v2 = token.token;
		}
		if (!ltoken_v2) return null;
		return [
			`stoken=${stoken}`,
			`ltuid_v2=${ltuid_v2}`,
			`ltoken_v2=${ltoken_v2}`,
			`cookie_token_v2=${cookie_token_v2}`,
			`ltmid_v2=${ltmid_v2}`,
			`account_id_v2=${ltuid_v2}`,
			`account_mid_v2=${ltmid_v2}`,
			`mid=${ltmid_v2}`
		].join("; ");
	} catch {
		return null;
	}
}

async function checkAccountLimit(discordUserId: string): Promise<void> {
	const config = getConfig();
	if (config.DEVIDS.includes(discordUserId)) return;
	const accounts: Account[] = (await database.get(`${discordUserId}.account`)) || [];
	if (accounts.length >= 5) {
		throw new Error("Account limit (5) exceeded");
	}
}

async function notifyBound(_discordUserId: string, _uid: string, _nickname?: string): Promise<void> {
	// DM notification removed — users see the newly bound account immediately
	// when they next use any command or autocomplete.
}

export async function bindCookieToUser(
	discordUserId: string,
	cookieStr: string
): Promise<BindResult> {
	log.info(`[bind] start user=${discordUserId} cookieLen=${cookieStr.length}`);

	// Web-login cookies contain stoken but not ltoken_v2, which getUserGameInfo needs.
	// Exchange stoken → ltoken_v2 first (same pattern as ZZZ bot).
	let apiCookie = cookieStr;
	try {
		const m = parseCookieMap(cookieStr);
		const stoken = m["stoken"];
		const uid = m["ltuid_v2"] ?? m["account_id_v2"];
		const mid = m["ltmid_v2"] ?? m["account_mid_v2"] ?? m["mid"];
		if (stoken && uid && mid) {
			log.info(`[bind] exchanging stoken for ltoken_v2…`);
			const refreshed = await getTokensFromStokenInternal(stoken, uid, mid);
			if (refreshed) {
				apiCookie = refreshed;
				log.info(`[bind] stoken exchange OK cookieLen=${apiCookie.length}`);
			} else {
				log.warn(`[bind] stoken exchange returned null, falling back to raw cookie`);
			}
		}
	} catch (e: any) {
		log.warn(`[bind] stoken exchange failed, falling back to raw cookie: ${e?.message ?? e}`);
	}

	let gameInfo: Awaited<ReturnType<typeof getUserGameInfo>>;
	try {
		gameInfo = await getUserGameInfo(apiCookie);
	} catch (e: any) {
		log.error(`[bind] getUserGameInfo failed user=${discordUserId}: ${e?.message ?? e}`);
		throw e;
	}
	const uid = gameInfo.uid;
	log.info(`[bind] gameInfo uid=${uid} nickname=${gameInfo.nickname ?? "-"}`);

	const accounts: Account[] =
		(await database.get(`${discordUserId}.account`)) || [];
	const existingIndex = accounts.findIndex(acc => acc.uid === uid);
	let updated = false;
	if (existingIndex !== -1) {
		updated = true;
	} else {
		await checkAccountLimit(discordUserId);
	}

	await updateAccountInfo(discordUserId, {
		uid,
		cookie: apiCookie,
		nickname: gameInfo.nickname
	});
	log.info(`[bind] updateAccountInfo OK key=${discordUserId}.account uid=${uid}`);

	// Patch stoken/ltmid_v2 onto the Hoyolab record for silent cookie refresh.
	const ltuid_v2 = parseCookieMap(apiCookie)["ltuid_v2"] ?? parseCookieMap(apiCookie)["account_id_v2"];
	const stokenPatch = extractStokenFields(cookieStr); // use original cookie for stoken
	if (ltuid_v2 && stokenPatch) {
		try {
			await upsertHoyolab(database as any, discordUserId, {
				ltuid_v2,
				cookie: apiCookie,
				...stokenPatch,
			});
			log.info(`[bind] stoken stored for ltuid=${ltuid_v2}`);
		} catch (e: any) {
			log.warn(`[bind] stoken patch failed: ${e?.message ?? e}`);
		}
	}

	await notifyBound(discordUserId, uid, gameInfo.nickname);

	return { uid, nickname: gameInfo.nickname, updated };
}

export async function bindFromEnriched(
	discordUserId: string,
	ltuid_v2: string,
	cookieStr: string,
	card: EnrichedGameCard,
	fetchedAt: string
): Promise<BindResult> {
	log.info(
		`[bindFromEnriched] start user=${discordUserId} uid=${card.game_role_id} ltuid=${ltuid_v2}`
	);

	const uid = String(card.game_role_id);

	// Mirror legacy account-limit semantics: only enforce when adding a NEW slot.
	const existing: Account[] =
		(await database.get(`${discordUserId}.account`)) || [];
	const isNew = !existing.some(a => a.uid === uid);
	if (isNew) await checkAccountLimit(discordUserId);

	const cover = card.background_image_v2 || card.background_image || undefined;
	const character: Character = {
		uid,
		nickname: card.nickname ?? null,
		region: card.region ?? null,
		lastUpdate: new Date().toISOString(),
		invalid: false,
		level: card.level,
		region_name: card.region_name,
		stats: (card.data ?? []).slice(0, 4),
		enrichedAt: fetchedAt,
		...(cover !== undefined ? { cover } : {}),
		...(card.logo !== undefined ? { logo: card.logo } : {}),
		...(card.game_name !== undefined ? { game_name: card.game_name } : {})
	};

	await upsertHoyolab(database as any, discordUserId, {
		ltuid_v2,
		cookie: cookieStr,
		hoyolabName: null,
		...extractStokenFields(cookieStr),
	});
	await upsertCharacter(database as any, discordUserId, ltuid_v2, character);
	log.info(`[bindFromEnriched] OK uid=${uid} updated=${!isNew}`);

	await notifyBound(discordUserId, uid, card.nickname);

	return { uid, nickname: card.nickname, updated: !isNew };
}

export async function bindHoyolabOnly(
	discordUserId: string,
	ltuid_v2: string,
	cookieStr: string
): Promise<void> {
	log.info(
		`[bindHoyolabOnly] storing hoyolab record (no HSR card) user=${discordUserId} ltuid=${ltuid_v2}`
	);
	await upsertHoyolab(database as any, discordUserId, {
		ltuid_v2,
		cookie: cookieStr,
		hoyolabName: null,
		...extractStokenFields(cookieStr),
	});
	// No character row, no DM, no slot consumed.
}

export async function drainPendingLogins(
	discordUserId: string
): Promise<BindResult[]> {
	log.info(`[drain] start user=${discordUserId}`);
	let rows: Awaited<ReturnType<typeof fetchPendingLogins>>;
	try {
		rows = await fetchPendingLogins(discordUserId);
	} catch (e: any) {
		log.warn(`[drain] fetchPendingLogins failed user=${discordUserId}: ${e?.message ?? e}`);
		return [];
	}
	log.info(`[drain] fetched rows=${rows.length} user=${discordUserId}`);
	if (rows.length === 0) return [];

	const out: BindResult[] = [];
	for (const row of rows) {
		log.info(`[drain] processing row id=${row.id} ltuid=${row.ltuid_v2}`);
		let cookieStr: string;
		try {
			cookieStr = decryptString(row.encrypted_cookies);
			log.info(`[drain] decrypt OK row=${row.id} cookieLen=${cookieStr.length}`);
		} catch (e: any) {
			log.error(`[drain] decrypt FAILED row=${row.id}: ${e?.message ?? e}`);
			await markConsumed(row.id);
			continue;
		}

		const enriched = row.enriched;
		const card = enriched?.cards.find(c => c.game_id === HSR_GAME_ID) ?? null;

		try {
			if (card && enriched) {
				log.info(`[drain] route=enriched row=${row.id}`);
				const res = await bindFromEnriched(
					discordUserId,
					row.ltuid_v2,
					cookieStr,
					card,
					enriched.fetched_at
				);
				out.push(res);
			} else {
				// No HSR card in enriched payload (or no enriched at all) — fall back to
				// legacy bindCookieToUser which calls getUserGameInfo to resolve the UID.
				// Previously this branch walked bindHoyolabOnly when enriched existed but
				// had no HSR card, which stored no UID and left the account unreachable.
				if (enriched) {
					log.info(`[drain] route=legacy-fallback row=${row.id} (enriched present but no HSR card)`);
				} else {
					log.info(`[drain] route=legacy row=${row.id} (no enriched payload)`);
				}
				// bindCookieToUser now handles stoken → ltoken_v2 exchange internally.
				const res = await bindCookieToUser(discordUserId, cookieStr);
				out.push(res);
			}
		} catch (e: any) {
			log.error(`[drain] bind FAILED row=${row.id}: ${e?.message ?? e}`);
			// Do NOT markConsumed on bind failure — keep row available for retry.
			continue;
		}
		await markConsumed(row.id);
		log.info(`[drain] markConsumed row=${row.id}`);
	}
	log.info(`[drain] done user=${discordUserId} bound=${out.length}`);
	return out;
}
