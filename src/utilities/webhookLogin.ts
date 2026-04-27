/**
 * Web-login finalizer (HSR).
 *
 * `drainPendingLogins` pulls unconsumed rows from Supabase (queued by the
 * web-login Next.js app) and binds them to local accounts. Called lazily
 * from `/account` and other entry points.
 */
import { database, client } from "@/index.js";
import { getUserGameInfo, updateAccountInfo } from "@/utilities/index.js";
import { getConfig } from "@/utilities/core/config.js";
import Logger from "@/utilities/core/logger.js";
import {
	fetchPendingLogins,
	markConsumed,
	decryptString
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

export async function bindCookieToUser(
	discordUserId: string,
	cookieStr: string
): Promise<BindResult> {
	log.info(`[bind] start user=${discordUserId} cookieLen=${cookieStr.length}`);
	const config = getConfig();
	let gameInfo: Awaited<ReturnType<typeof getUserGameInfo>>;
	try {
		gameInfo = await getUserGameInfo(cookieStr);
	} catch (e: any) {
		log.error(`[bind] getUserGameInfo failed user=${discordUserId}: ${e?.message ?? e}`);
		throw e;
	}
	const uid = gameInfo.uid;
	log.info(`[bind] gameInfo uid=${uid} nickname=${gameInfo.nickname ?? "-"}`);

	const accounts: Account[] =
		(await database.get(`${discordUserId}.account`)) || [];
	log.info(`[bind] existing accounts=${accounts.length} for user=${discordUserId}`);

	const existingIndex = accounts.findIndex(acc => acc.uid === uid);
	let updated = false;

	if (existingIndex !== -1) {
		updated = true;
		log.info(`[bind] updating existing slot index=${existingIndex} uid=${uid}`);
	} else {
		if (
			!config.DEVIDS.includes(discordUserId) &&
			accounts.length >= 5
		) {
			log.warn(`[bind] account limit reached for user=${discordUserId}`);
			throw new Error("Account limit (5) exceeded");
		}
		log.info(`[bind] appending new account uid=${uid} totalNow=${accounts.length + 1}`);
	}

	await updateAccountInfo(discordUserId, {
		uid,
		cookie: cookieStr,
		nickname: gameInfo.nickname
	});
	log.info(`[bind] updateAccountInfo OK key=${discordUserId}.account uid=${uid}`);

	try {
		const user = await client.users.fetch(discordUserId);
		await user.send(
			`✅ Your Hoyoverse account has been linked to **HSR Bot**!\nUID: \`${uid}\`${gameInfo.nickname ? ` — ${gameInfo.nickname}` : ""}`
		);
		log.info(`[bind] DM sent to ${discordUserId}`);
	} catch (e) {
		log.info(`DM to ${discordUserId} failed (likely DMs disabled): ${(e as Error).message}`);
	}

	return { uid, nickname: gameInfo.nickname, updated };
}

/**
 * Pull queued web-logins from Supabase and bind them. Called from
 * command entry points (e.g. /account) so the bot picks up logins
 * without needing an inbound HTTP webhook.
 */
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
		try {
			const res = await bindCookieToUser(discordUserId, cookieStr);
			log.info(`[drain] bind OK row=${row.id} uid=${res.uid} updated=${res.updated}`);
			out.push(res);
		} catch (e: any) {
			log.error(`[drain] bindCookieToUser FAILED row=${row.id}: ${e?.message ?? e}`);
		}
		await markConsumed(row.id);
		log.info(`[drain] markConsumed row=${row.id}`);
	}
	log.info(`[drain] done user=${discordUserId} bound=${out.length}`);
	return out;
}
