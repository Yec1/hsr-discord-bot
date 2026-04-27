/**
 * Supabase pull-side helpers for the HSR bot. Mirror of ZZZ's
 * `utilities/core/supabase.ts`. See that file for design notes.
 */
import crypto from "node:crypto";
import { getConfig } from "./config.js";
import Logger from "./logger.js";

const logger = new Logger("Supabase");

let _client: any = null;

async function getClient(): Promise<any | null> {
	if (_client) return _client;
	const cfg = getConfig();
	if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
		return null;
	}
	try {
		const mod: any = await import("@supabase/supabase-js");
		_client = mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
		return _client;
	} catch (e: any) {
		logger.warn(
			`@supabase/supabase-js not installed — pending login pull disabled (${e?.message ?? e})`
		);
		return null;
	}
}

/** AES-256-CBC, "ivHex:cipherHex" — must match web-login/lib/hoyoapi.ts */
function decryptString(encrypted: string): string {
	const cfg = getConfig();
	const secret = cfg.WEB_LOGIN_SESSION_SECRET ?? "";
	if (!secret) throw new Error("WEB_LOGIN_SESSION_SECRET not configured");
	const key = Buffer.from(secret.padEnd(32, "0").slice(0, 32));
	const [ivHex, encHex] = encrypted.split(":");
	if (!ivHex || !encHex) throw new Error("malformed encrypted cookie");
	const iv = Buffer.from(ivHex, "hex");
	const enc = Buffer.from(encHex, "hex");
	const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
	return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/**
 * Per-game card extracted from Hoyolab `getGameRecordCard` and persisted
 * by web-login. Mirror of `web-login/lib/enrichment-types.ts:EnrichedGameCard`.
 * Duplicated here (not shared) — bots are independent repos. Keep in sync
 * if the web-side shape changes.
 */
export interface EnrichedGameCard {
	game_id: number;
	game_role_id: string;
	nickname: string;
	level: number;
	region: string;
	region_name: string;
	game_name?: string;
	logo?: string;
	background_image?: string;
	background_image_v2?: string;
	data?: { name: string; value: string }[];
}

export interface EnrichedData {
	ltuid_v2: string;
	cards: EnrichedGameCard[];
	fetched_at: string;
}

export interface PendingLoginRow {
	id: number;
	discord_id: string;
	ltuid_v2: string;
	encrypted_cookies: string;
	hoyo_account: Record<string, unknown> | null;
	enriched: EnrichedData | null;
	created_at: string;
}

const BOT_ID = "hsr" as const;

/**
 * Fetch all pending logins for this Discord user that HSR hasn't consumed yet
 * and haven't expired. One row per Hoyoverse login is shared across all bots
 * (HSR/ZZZ); each bot tracks its own consumption via `consumed_by_bots[]`.
 */
export async function fetchPendingLogins(
	discordUserId: string
): Promise<PendingLoginRow[]> {
	const sb = await getClient();
	if (!sb) return [];
	const { data, error } = await sb
		.from("pending_logins")
		.select(
			"id, discord_id, ltuid_v2, encrypted_cookies, hoyo_account, enriched, created_at, consumed_by_bots"
		)
		.eq("discord_id", discordUserId)
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: true });
	if (error) {
		logger.error(`fetchPendingLogins: ${error.message}`);
		return [];
	}
	return ((data ?? []) as (PendingLoginRow & { consumed_by_bots: string[] | null })[])
		.filter(r => !(r.consumed_by_bots ?? []).includes(BOT_ID));
}

/**
 * Mark this bot as having consumed the row, and shorten expiry to 1h.
 */
export async function markConsumed(id: number): Promise<void> {
	const sb = await getClient();
	if (!sb) return;
	const { data: row, error: readErr } = await sb
		.from("pending_logins")
		.select("consumed_by_bots")
		.eq("id", id)
		.single();
	if (readErr) {
		logger.warn(`markConsumed(${id}) read: ${readErr.message}`);
		return;
	}
	const current: string[] = (row?.consumed_by_bots as string[] | null) ?? [];
	if (current.includes(BOT_ID)) return;
	const next = [...current, BOT_ID];
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
	const { error } = await sb
		.from("pending_logins")
		.update({
			consumed_by_bots: next,
			consumed_at: new Date().toISOString(),
			expires_at: expiresAt
		})
		.eq("id", id);
	if (error) logger.warn(`markConsumed(${id}) write: ${error.message}`);
}

export { decryptString };
