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
	// Plan C — optional rich fields populated from web-login enriched payload.
	// All optional so legacy characters (and rows where enrichment failed)
	// continue to round-trip without modification.
	level?: number;
	region_name?: string;
	cover?: string;
	logo?: string;
	game_name?: string;
	stats?: { name: string; value: string }[];
	enrichedAt?: string;
}

export interface Hoyolab {
	ltuid_v2: string;
	cookie: string;
	hoyolabName: string | null;
	lastUpdate: string;
	invalid: boolean;
	characters: Character[];
	/** Encrypted stoken for silent cookie refresh. Stored per Hoyolab account. */
	stoken?: string;
	/** ltmid_v2 required alongside ltuid_v2 for stoken exchange. */
	ltmid_v2?: string;
	/** Hoyolab profile picture URL fetched at web-login time. */
	hoyolabIcon?: string;
}

export interface AccountStore {
	hoyolabs: Hoyolab[];
}

/** Subset of quick.db API the store relies on. */
export interface DbAdapter {
	get<T = unknown>(
		key: string
	): Promise<T | null | undefined> | T | null | undefined;
	set<T = unknown>(key: string, value: T): Promise<unknown> | unknown;
	delete(key: string): Promise<unknown> | unknown;
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

/**
 * Persist `store` and synchronously rewrite the legacy
 * `<userId>.account` flat array so that all 30+ existing direct
 * readers (`database.get(`${userId}.account`)`) continue to see
 * up-to-date data without needing to switch to the new API.
 *
 * Mirror shape per entry: `{ uid, cookie, nickname, lastUpdate, invalid }`
 * — matches what legacy callers already destructure.
 */
export async function saveAccounts(
	db: DbAdapter,
	userId: string,
	store: AccountStore
): Promise<void> {
	await db.set(`${userId}.hoyolabs`, store.hoyolabs);
	await syncLegacyMirror(db, userId, store);
}

async function syncLegacyMirror(
	db: DbAdapter,
	userId: string,
	store: AccountStore
): Promise<void> {
	const flat: Array<{
		uid: string;
		cookie: string;
		nickname: string | null;
		lastUpdate: string;
		invalid: boolean;
	}> = [];
	for (const h of store.hoyolabs) {
		for (const c of h.characters) {
			flat.push({
				uid: c.uid,
				cookie: h.cookie,
				nickname: c.nickname,
				lastUpdate: c.lastUpdate,
				invalid: c.invalid || h.invalid
			});
		}
	}
	if (flat.length === 0) {
		await db.delete(`${userId}.account`);
	} else {
		await db.set(`${userId}.account`, flat);
	}
}

// ---------- Reads ----------

export async function getHoyolabs(
	db: DbAdapter,
	userId: string
): Promise<Hoyolab[]> {
	const store = await loadAccounts(db, userId);
	return store.hoyolabs;
}

export async function getHoyolabByLtuid(
	db: DbAdapter,
	userId: string,
	ltuid_v2: string
): Promise<Hoyolab | null> {
	const hs = await getHoyolabs(db, userId);
	return hs.find(h => h.ltuid_v2 === ltuid_v2) ?? null;
}

export async function getAllCharacters(
	db: DbAdapter,
	userId: string
): Promise<Array<Character & { ltuid_v2: string; cookie: string }>> {
	const hs = await getHoyolabs(db, userId);
	const out: Array<Character & { ltuid_v2: string; cookie: string }> = [];
	for (const h of hs) {
		for (const c of h.characters) {
			out.push({ ...c, ltuid_v2: h.ltuid_v2, cookie: h.cookie });
		}
	}
	return out;
}

export async function getCharacter(
	db: DbAdapter,
	userId: string,
	uid: string
): Promise<{ character: Character; hoyolab: Hoyolab } | null> {
	const hs = await getHoyolabs(db, userId);
	for (const h of hs) {
		const c = h.characters.find(ch => ch.uid === String(uid));
		if (c) return { character: c, hoyolab: h };
	}
	return null;
}
// ---------- Writes ----------

function nowIso() {
	return new Date().toISOString();
}

export async function upsertHoyolab(
	db: DbAdapter,
	userId: string,
	patch: { ltuid_v2: string; cookie: string; hoyolabName?: string | null; stoken?: string; ltmid_v2?: string; hoyolabIcon?: string }
): Promise<Hoyolab> {
	const store = await loadAccounts(db, userId);
	const idx = store.hoyolabs.findIndex(h => h.ltuid_v2 === patch.ltuid_v2);
	let h: Hoyolab;
	if (idx === -1) {
		h = {
			ltuid_v2: patch.ltuid_v2,
			cookie: patch.cookie,
			hoyolabName: patch.hoyolabName ?? null,
			lastUpdate: nowIso(),
			invalid: false,
			characters: [],
			...(patch.stoken !== undefined && { stoken: patch.stoken }),
			...(patch.ltmid_v2 !== undefined && { ltmid_v2: patch.ltmid_v2 }),
			...(patch.hoyolabIcon !== undefined && { hoyolabIcon: patch.hoyolabIcon }),
		};
		store.hoyolabs.push(h);
	} else {
		h = store.hoyolabs[idx]!;
		h.cookie = patch.cookie;
		h.invalid = false;
		h.lastUpdate = nowIso();
		if (patch.hoyolabName !== undefined) h.hoyolabName = patch.hoyolabName;
		if (patch.stoken !== undefined) h.stoken = patch.stoken;
		if (patch.ltmid_v2 !== undefined) h.ltmid_v2 = patch.ltmid_v2;
		if (patch.hoyolabIcon !== undefined) h.hoyolabIcon = patch.hoyolabIcon;
	}
	await saveAccounts(db, userId, store);
	return h;
}

export async function upsertCharacter(
	db: DbAdapter,
	userId: string,
	ltuid_v2: string,
	character: Character
): Promise<void> {
	const store = await loadAccounts(db, userId);
	const h = store.hoyolabs.find(x => x.ltuid_v2 === ltuid_v2);
	if (!h) {
		throw new Error(
			`upsertCharacter: hoyolab ltuid_v2=${ltuid_v2} not found for user=${userId}`
		);
	}
	const i = h.characters.findIndex(c => c.uid === character.uid);
	if (i === -1) h.characters.push(character);
	else h.characters[i] = character;
	h.lastUpdate = nowIso();
	await saveAccounts(db, userId, store);
}

export async function removeHoyolab(
	db: DbAdapter,
	userId: string,
	ltuid_v2: string
): Promise<void> {
	const store = await loadAccounts(db, userId);
	store.hoyolabs = store.hoyolabs.filter(h => h.ltuid_v2 !== ltuid_v2);
	await saveAccounts(db, userId, store);
}

export async function markCharacterInvalid(
	db: DbAdapter,
	userId: string,
	uid: string,
	invalid: boolean
): Promise<void> {
	const store = await loadAccounts(db, userId);
	for (const h of store.hoyolabs) {
		const c = h.characters.find(ch => ch.uid === String(uid));
		if (c) {
			c.invalid = invalid;
			await saveAccounts(db, userId, store);
			return;
		}
	}
}

export async function markHoyolabInvalid(
	db: DbAdapter,
	userId: string,
	ltuid_v2: string,
	invalid: boolean
): Promise<void> {
	const store = await loadAccounts(db, userId);
	const h = store.hoyolabs.find(x => x.ltuid_v2 === ltuid_v2);
	if (!h) return;
	h.invalid = invalid;
	await saveAccounts(db, userId, store);
}

/**
 * Set hoyolabName only if it is currently null. Best-effort backfill from
 * opportunistic API calls (e.g. during daily check). No-op if the name
 * is already set, so manual edits (when added later) are not clobbered.
 */
export async function backfillHoyolabName(
	db: DbAdapter,
	userId: string,
	ltuid_v2: string,
	name: string
): Promise<void> {
	const store = await loadAccounts(db, userId);
	const h = store.hoyolabs.find(x => x.ltuid_v2 === ltuid_v2);
	if (!h || h.hoyolabName != null) return;
	h.hoyolabName = name;
	await saveAccounts(db, userId, store);
}
