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
	/** Preserves legacy flat-account ordering during migration. */
	legacyOrder?: number;
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

export function getBoundUserIds(
	rows: Array<{ id: string; value: unknown }>
): string[] {
	return rows.flatMap(({ id, value }) => {
		const root = value as {
			hoyolabs?: Array<{ characters?: unknown[] }>;
			account?: unknown[];
		};
		const hasCanonicalBinding =
			Array.isArray(root?.hoyolabs) &&
			root.hoyolabs.some(
				h => Array.isArray(h.characters) && h.characters.length > 0
			);
		const hasLegacyBinding =
			Array.isArray(root?.account) && root.account.length > 0;
		return hasCanonicalBinding || hasLegacyBinding ? [id] : [];
	});
}

export interface LegacyAccountEntry {
	uid: string;
	cookie: string;
	nickname: string | null;
	lastUpdate: string;
	invalid: boolean;
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
	const legacy = (await db.get<LegacyChar[]>(`${userId}.account`)) as
		| LegacyChar[]
		| undefined;
	if (existing && Array.isArray(existing)) {
		if (legacy && Array.isArray(legacy) && legacy.length > 0) {
			const latestCookieByLtuid = new Map<
				string,
				{ cookie: string; lastUpdate: string }
			>();
			const orderByUid = new Map<string, number>();
			for (const [index, entry] of legacy.entries()) {
				if (!orderByUid.has(String(entry.uid))) {
					orderByUid.set(String(entry.uid), index);
				}
				const cookie = entry.cookie ?? "";
				const ltuid = extractLtuidFromCookie(cookie);
				if (!ltuid || !cookie) continue;
				const lastUpdate = entry.lastUpdate ?? "";
				const previous = latestCookieByLtuid.get(ltuid);
				if (!previous || lastUpdate >= previous.lastUpdate) {
					latestCookieByLtuid.set(ltuid, { cookie, lastUpdate });
				}
			}

			const reconciled = existing.map(h => {
				const latest = latestCookieByLtuid.get(h.ltuid_v2);
				return {
					...h,
					...(latest && { cookie: latest.cookie }),
					characters: h.characters.map(character => {
						const legacyOrder = orderByUid.get(character.uid);
						return legacyOrder === undefined
							? character
							: { ...character, legacyOrder };
					})
				};
			});

			await db.set(`${userId}.hoyolabs`, reconciled);
			await db.delete(`${userId}.account`);
			return { hoyolabs: reconciled };
		}
		return { hoyolabs: existing };
	}

	if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
		return { hoyolabs: [] };
	}

	const groups = new Map<
		string,
		{ cookie: string; entries: Array<{ value: LegacyChar; index: number }> }
	>();
	for (const [index, entry] of legacy.entries()) {
		const cookie = entry.cookie ?? "";
		const id =
			extractLtuidFromCookie(cookie) ?? fallbackBucketKey(cookie || entry.uid);
		const g = groups.get(id);
		if (g) {
			const previousLastUpdate = g.entries
				.map(({ value: e }) => e.lastUpdate ?? "")
				.filter(Boolean)
				.sort()
				.pop() ?? "";
			if (
				cookie &&
				(!g.cookie || (entry.lastUpdate ?? "") >= previousLastUpdate)
			) {
				g.cookie = cookie;
			}
			g.entries.push({ value: entry, index });
		} else {
			groups.set(id, { cookie, entries: [{ value: entry, index }] });
		}
	}

	const hoyolabs: Hoyolab[] = [];
	for (const [ltuid_v2, { cookie, entries }] of groups) {
		const lastUpdate = entries
			.map(({ value: e }) => e.lastUpdate ?? "")
			.filter(Boolean)
			.sort()
			.pop() ?? new Date().toISOString();

		hoyolabs.push({
			ltuid_v2,
			cookie,
			hoyolabName: null,
			lastUpdate,
			invalid:
				entries.length > 0 &&
				entries.every(({ value: e }) => e.invalid === true),
			characters: entries.map(({ value: e, index }) => ({
				uid: String(e.uid),
				nickname: e.nickname ?? null,
				region: null,
				lastUpdate: e.lastUpdate ?? new Date().toISOString(),
				invalid: e.invalid === true,
				legacyOrder: index
			}))
		});
	}

	await db.set(`${userId}.hoyolabs`, hoyolabs);
	await db.delete(`${userId}.account`);
	return { hoyolabs };
}

/**
 * Persist canonical Hoyolab data. Legacy flat arrays are migrated lazily by
 * `loadAccounts`; writes never recreate the legacy key.
 *
 * The canonical shape preserves each character under its Hoyolab binding.
 */
export async function saveAccounts(
	db: DbAdapter,
	userId: string,
	store: AccountStore
): Promise<void> {
	await db.set(`${userId}.hoyolabs`, store.hoyolabs);
	await db.delete(`${userId}.account`);
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
	out.sort((a, b) => {
		if (a.legacyOrder === undefined && b.legacyOrder === undefined) return 0;
		if (a.legacyOrder === undefined) return 1;
		if (b.legacyOrder === undefined) return -1;
		return a.legacyOrder - b.legacyOrder;
	});
	return out;
}

export async function getLegacyAccounts(
	db: DbAdapter,
	userId: string
): Promise<LegacyAccountEntry[]> {
	const chars = await getAllCharacters(db, userId);
	return chars.map(c => ({
		uid: c.uid,
		cookie: c.cookie,
		nickname: c.nickname ?? null,
		lastUpdate: c.lastUpdate,
		invalid: c.invalid
	}));
}

export async function getLegacyAccountAtIndex(
	db: DbAdapter,
	userId: string,
	index: number
): Promise<LegacyAccountEntry | null> {
	const accounts = await getLegacyAccounts(db, userId);
	return accounts[index] ?? null;
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
	else {
		const previous = h.characters[i]!;
		h.characters[i] =
			character.legacyOrder === undefined && previous.legacyOrder !== undefined
				? { ...character, legacyOrder: previous.legacyOrder }
				: character;
	}
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

export async function removeCharacter(
	db: DbAdapter,
	userId: string,
	uid: string
): Promise<void> {
	const store = await loadAccounts(db, userId);
	for (const h of store.hoyolabs) {
		const nextCharacters = h.characters.filter(ch => ch.uid !== String(uid));
		if (nextCharacters.length !== h.characters.length) {
			h.characters = nextCharacters;
			h.lastUpdate = nowIso();
			store.hoyolabs = store.hoyolabs.filter(
				x => !(x.ltuid_v2 === h.ltuid_v2 && x.characters.length === 0)
			);
			await saveAccounts(db, userId, store);
			return;
		}
	}
}

export async function replaceCharacterBinding(
	db: DbAdapter,
	userId: string,
	oldUid: string,
	patch: { uid: string; cookie: string; nickname?: string | null }
): Promise<void> {
	const store = await loadAccounts(db, userId);
	let removed = false;
	let removedOrder: number | undefined;
	for (const h of store.hoyolabs) {
		const nextCharacters = h.characters.filter(ch => ch.uid !== String(oldUid));
		if (nextCharacters.length !== h.characters.length) {
			removedOrder = h.characters.find(ch => ch.uid === String(oldUid))?.legacyOrder;
			h.characters = nextCharacters;
			h.lastUpdate = nowIso();
			removed = true;
			break;
		}
	}
	if (!removed) {
		throw new Error(`replaceCharacterBinding: uid=${oldUid} not found for user=${userId}`);
	}

	store.hoyolabs = store.hoyolabs.filter(h => h.characters.length > 0);

	const ltuid = extractLtuidFromCookie(patch.cookie) ?? fallbackBucketKey(patch.cookie);
	let hoyolab = store.hoyolabs.find(h => h.ltuid_v2 === ltuid);
	if (!hoyolab) {
		hoyolab = {
			ltuid_v2: ltuid,
			cookie: patch.cookie,
			hoyolabName: null,
			lastUpdate: nowIso(),
			invalid: false,
			characters: []
		};
		store.hoyolabs.push(hoyolab);
	} else {
		hoyolab.cookie = patch.cookie;
		hoyolab.invalid = false;
		hoyolab.lastUpdate = nowIso();
	}

	hoyolab.characters.push({
		uid: String(patch.uid),
		nickname: patch.nickname ?? null,
		region: null,
		lastUpdate: nowIso(),
		invalid: false,
		...(removedOrder !== undefined && { legacyOrder: removedOrder })
	});

	await saveAccounts(db, userId, store);
}

export async function storeAccountBinding(
	db: DbAdapter,
	userId: string,
	patch: { uid: string; cookie: string; nickname?: string | null }
): Promise<void> {
	const ltuid = extractLtuidFromCookie(patch.cookie) ?? fallbackBucketKey(patch.cookie);
	await upsertHoyolab(db, userId, { ltuid_v2: ltuid, cookie: patch.cookie });
	await upsertCharacter(db, userId, ltuid, {
		uid: String(patch.uid),
		nickname: patch.nickname ?? null,
		region: null,
		lastUpdate: nowIso(),
		invalid: false
	});
}

export async function upsertLegacyBinding(
	db: DbAdapter,
	userId: string,
	patch: { uid: string; cookie: string; nickname?: string | null }
): Promise<void> {
	const existing = await getCharacter(db, userId, patch.uid);
	if (existing) {
		await updateAccountCookieAtIndex(
			db,
			userId,
			(await getLegacyAccounts(db, userId)).findIndex(a => a.uid === patch.uid),
			patch.cookie
		);
		if (patch.nickname !== undefined && patch.nickname !== existing.character.nickname) {
			const store = await loadAccounts(db, userId);
			for (const h of store.hoyolabs) {
				const c = h.characters.find(ch => ch.uid === patch.uid);
				if (c) {
					c.nickname = patch.nickname;
					c.lastUpdate = nowIso();
					await saveAccounts(db, userId, store);
					return;
				}
			}
		}
		return;
	}

	await storeAccountBinding(db, userId, patch);
}

export async function updateAccountCookieAtIndex(
	db: DbAdapter,
	userId: string,
	index: number,
	newCookie: string
): Promise<LegacyAccountEntry | null> {
	const target = await getLegacyAccountAtIndex(db, userId, index);
	if (!target) return null;

	const store = await loadAccounts(db, userId);
	for (const h of store.hoyolabs) {
		const charIndex = h.characters.findIndex(ch => ch.uid === target.uid);
		if (charIndex === -1) continue;

		const character = h.characters[charIndex]!;
		const nextLtuid = extractLtuidFromCookie(newCookie) ?? fallbackBucketKey(newCookie);
		if (nextLtuid === h.ltuid_v2) {
			h.cookie = newCookie;
			h.invalid = false;
			h.lastUpdate = nowIso();
			await saveAccounts(db, userId, store);
			return {
				uid: character.uid,
				cookie: newCookie,
				nickname: character.nickname ?? null,
				lastUpdate: character.lastUpdate,
				invalid: character.invalid
			};
		}

		h.characters.splice(charIndex, 1);
		h.lastUpdate = nowIso();

		let targetHoyolab = store.hoyolabs.find(x => x.ltuid_v2 === nextLtuid);
		if (!targetHoyolab) {
			targetHoyolab = {
				ltuid_v2: nextLtuid,
				cookie: newCookie,
				hoyolabName: null,
				lastUpdate: nowIso(),
				invalid: false,
				characters: []
			};
			store.hoyolabs.push(targetHoyolab);
		} else {
			targetHoyolab.cookie = newCookie;
			targetHoyolab.invalid = false;
			targetHoyolab.lastUpdate = nowIso();
		}

		targetHoyolab.characters.push({
			...character,
			lastUpdate: nowIso(),
			invalid: false
		});
		store.hoyolabs = store.hoyolabs.filter(x => x.characters.length > 0);
		await saveAccounts(db, userId, store);
		return {
			uid: character.uid,
			cookie: newCookie,
			nickname: character.nickname ?? null,
			lastUpdate: character.lastUpdate,
			invalid: false
		};
	}

	return null;
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
