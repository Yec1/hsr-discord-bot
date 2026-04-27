import { createHash } from "node:crypto";

/**
 * Extract the Hoyolab account identifier (ltuid_v2) from a cookie string.
 * Mirrors the helper in web-login/app/api/login/email-verify/route.ts so
 * IDs computed bot-side match what the web app stored in Supabase.
 */
export function extractLtuidFromCookie(cookieStr: string): string | null {
	const m =
		cookieStr.match(/ltuid_v2=([^;\s]+)/i) ??
		cookieStr.match(/ltuid=([^;\s]+)/i);
	return m ? m[1]! : null;
}

/**
 * Deterministic placeholder ID for cookies whose ltuid we cannot parse.
 * Same cookie always yields the same bucket so legacy entries that
 * shared a broken cookie group together.
 */
export function fallbackBucketKey(cookieStr: string): string {
	const h = createHash("sha1").update(cookieStr).digest("hex").slice(0, 8);
	return `unknown-${h}`;
}

// ---------- Types ----------

export interface Character {
	uid: string;
	nickname: string | null;
	region: string | null;
	lastUpdate: string;
	invalid: boolean;
}

export interface Hoyolab {
	ltuid_v2: string;
	cookie: string;
	hoyolabName: string | null;
	lastUpdate: string;
	invalid: boolean;
	characters: Character[];
}

export interface AccountStore {
	hoyolabs: Hoyolab[];
}

/** Subset of quick.db API the store relies on. */
export interface DbAdapter {
	get<T = unknown>(key: string): Promise<T | undefined> | T | undefined;
	set<T = unknown>(key: string, value: T): Promise<void> | void;
	delete(key: string): Promise<void> | void;
	has(key: string): Promise<boolean> | boolean;
}

// ---------- Legacy shape ----------

interface LegacyChar {
	uid: string;
	cookie?: string;
	nickname?: string;
	lastUpdate?: string;
	invalid?: boolean;
}

// ---------- Lazy migration ----------

/**
 * Load (and lazily migrate) a Discord user's account store. Idempotent.
 *
 * - If `<userId>.hoyolabs` exists → return it as-is.
 * - Else if `<userId>.account` exists (legacy flat array) → group by
 *   ltuid extracted from cookie, write back, delete legacy key, return.
 * - Else → return `{ hoyolabs: [] }` without writing.
 */
export async function loadAccounts(
	db: DbAdapter,
	userId: string
): Promise<AccountStore> {
	const existing = (await db.get<AccountStore>(`${userId}.hoyolabs`)) as
		| AccountStore["hoyolabs"]
		| undefined;
	if (existing && Array.isArray(existing)) {
		return { hoyolabs: existing };
	}

	const legacy = (await db.get<LegacyChar[]>(`${userId}.account`)) as
		| LegacyChar[]
		| undefined;
	if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
		return { hoyolabs: [] };
	}

	const groups = new Map<string, { cookie: string; entries: LegacyChar[] }>();
	for (const entry of legacy) {
		const cookie = entry.cookie ?? "";
		const id =
			extractLtuidFromCookie(cookie) ?? fallbackBucketKey(cookie || entry.uid);
		const g = groups.get(id);
		if (g) g.entries.push(entry);
		else groups.set(id, { cookie, entries: [entry] });
	}

	const hoyolabs: Hoyolab[] = [];
	for (const [ltuid_v2, { cookie, entries }] of groups) {
		const lastUpdate = entries
			.map(e => e.lastUpdate ?? "")
			.filter(Boolean)
			.sort()
			.pop() ?? new Date().toISOString();

		hoyolabs.push({
			ltuid_v2,
			cookie,
			hoyolabName: null,
			lastUpdate,
			invalid: entries.length > 0 && entries.every(e => e.invalid === true),
			characters: entries.map(e => ({
				uid: String(e.uid),
				nickname: e.nickname ?? null,
				region: null,
				lastUpdate: e.lastUpdate ?? new Date().toISOString(),
				invalid: e.invalid === true
			}))
		});
	}

	await db.set(`${userId}.hoyolabs`, hoyolabs);
	await db.delete(`${userId}.account`);
	return { hoyolabs };
}
