/**
 * Webhook login finalizer.
 *
 * Receives a fully-validated Hoyoverse cookie string from the web-login
 * Next.js app and stores it under the user's account list, mirroring the
 * logic used in events/modal.ts for the password/cookie login flows.
 */
import { database, client } from "@/index.js";
import { getUserGameInfo } from "@/utilities/index.js";
import { getConfig } from "@/utilities/core/config.js";
import Logger from "@/utilities/core/logger.js";

interface Account {
	uid: string;
	nickname?: string;
	cookie?: string;
}

export interface WebhookLoginResult {
	uid: string;
	nickname?: string;
	updated: boolean;
}

const log = new Logger("WebhookLogin");

export async function handleWebhookLogin(
	discordUserId: string,
	cookieStr: string
): Promise<WebhookLoginResult> {
	const config = getConfig();
	const gameInfo = await getUserGameInfo(cookieStr);
	const uid = gameInfo.uid;

	const accounts: Account[] =
		(await database.get(`${discordUserId}.account`)) || [];

	const existingIndex = accounts.findIndex(acc => acc.uid === uid);
	let updated = false;

	if (existingIndex !== -1) {
		const existing = accounts[existingIndex];
		if (existing) {
			existing.cookie = cookieStr;
			existing.nickname = gameInfo.nickname;
			updated = true;
		}
	} else {
		// Enforce 5-account limit (devs exempt) — same as modal.ts
		if (
			!config.DEVIDS.includes(discordUserId) &&
			accounts.length >= 5
		) {
			throw new Error("Account limit (5) exceeded");
		}
		accounts.push({
			uid: gameInfo.uid,
			nickname: gameInfo.nickname,
			cookie: cookieStr
		});
	}

	await database.set(`${discordUserId}.account`, accounts);

	// Best-effort DM to confirm — silent failure if user has DMs disabled
	try {
		const user = await client.users.fetch(discordUserId);
		await user.send(
			`✅ Your Hoyoverse account has been linked to **HSR Bot**!\nUID: \`${uid}\`${gameInfo.nickname ? ` — ${gameInfo.nickname}` : ""}`
		);
	} catch (e) {
		log.info(`DM to ${discordUserId} failed (likely DMs disabled): ${(e as Error).message}`);
	}

	return { uid, nickname: gameInfo.nickname, updated };
}
