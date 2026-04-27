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

export interface PendingLoginRow {
	id: number;
	discord_id: string;
	ltuid_v2: string;
	encrypted_cookies: string;
	hoyo_account: Record<string, unknown> | null;
	created_at: string;
}

export async function fetchPendingLogins(
	discordUserId: string
): Promise<PendingLoginRow[]> {
	const sb = await getClient();
	if (!sb) return [];
	const { data, error } = await sb
		.from("pending_logins")
		.select("id, discord_id, ltuid_v2, encrypted_cookies, hoyo_account, created_at")
		.eq("discord_id", discordUserId)
		.eq("bot_id", "hsr")
		.eq("status", "pending")
		.order("created_at", { ascending: true });
	if (error) {
		logger.error(`fetchPendingLogins: ${error.message}`);
		return [];
	}
	return (data ?? []) as PendingLoginRow[];
}

export async function markConsumed(id: number): Promise<void> {
	const sb = await getClient();
	if (!sb) return;
	const { error } = await sb
		.from("pending_logins")
		.update({ status: "consumed", consumed_at: new Date().toISOString() })
		.eq("id", id);
	if (error) logger.warn(`markConsumed(${id}): ${error.message}`);
}

export { decryptString };
