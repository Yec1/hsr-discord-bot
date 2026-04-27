import { extractLtuidFromCookie, fallbackBucketKey } from "@/utilities/accountStore";

describe("extractLtuidFromCookie", () => {
	it("extracts ltuid_v2", () => {
		expect(extractLtuidFromCookie("foo=1; ltuid_v2=12345678; bar=2")).toBe("12345678");
	});
	it("falls back to ltuid", () => {
		expect(extractLtuidFromCookie("ltuid=99887766")).toBe("99887766");
	});
	it("is case-insensitive", () => {
		expect(extractLtuidFromCookie("LTUID_V2=42")).toBe("42");
	});
	it("returns null when neither key present", () => {
		expect(extractLtuidFromCookie("foo=1; bar=2")).toBeNull();
	});
});

describe("fallbackBucketKey", () => {
	it("returns deterministic unknown-<8hex> for same cookie", () => {
		const k1 = fallbackBucketKey("garbage-cookie");
		const k2 = fallbackBucketKey("garbage-cookie");
		expect(k1).toBe(k2);
		expect(k1).toMatch(/^unknown-[0-9a-f]{8}$/);
	});
	it("differs across cookies", () => {
		expect(fallbackBucketKey("a")).not.toBe(fallbackBucketKey("b"));
	});
});

import { createFakeDb } from "./helpers/fakeDb";
import { loadAccounts } from "@/utilities/accountStore";

const COOKIE_A = "ltuid_v2=11111111; ltoken_v2=AAA";
const COOKIE_B = "ltuid_v2=22222222; ltoken_v2=BBB";
const COOKIE_BAD = "ltoken_v2=NOIDHERE";

describe("loadAccounts (lazy migration)", () => {
	it("returns empty store when user has no data", async () => {
		const db = createFakeDb();
		const out = await loadAccounts(db, "u1");
		expect(out).toEqual({ hoyolabs: [] });
	});

	it("returns already-migrated data unchanged (idempotent)", async () => {
		const db = createFakeDb({
			u1: {
				hoyolabs: [
					{
						ltuid_v2: "11111111",
						cookie: COOKIE_A,
						hoyolabName: "Existing",
						lastUpdate: "2026-04-27T00:00:00.000Z",
						invalid: false,
						characters: []
					}
				]
			}
		});
		const before = db._dump();
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs).toHaveLength(1);
		expect(out.hoyolabs[0]!.ltuid_v2).toBe("11111111");
		expect(db._dump()).toEqual(before); // no write happened
	});

	it("migrates a single legacy entry with valid cookie", async () => {
		const db = createFakeDb({
			u1: {
				account: [
					{ uid: "800000001", cookie: COOKIE_A, nickname: "Alice", lastUpdate: "2026-01-01T00:00:00.000Z" }
				]
			}
		});
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs).toHaveLength(1);
		const h = out.hoyolabs[0]!;
		expect(h.ltuid_v2).toBe("11111111");
		expect(h.cookie).toBe(COOKIE_A);
		expect(h.hoyolabName).toBeNull();
		expect(h.invalid).toBe(false);
		expect(h.characters).toHaveLength(1);
		expect(h.characters[0]).toMatchObject({
			uid: "800000001",
			nickname: "Alice",
			region: null,
			invalid: false
		});
		// legacy key cleared
		expect(await db.has("u1.account")).toBe(false);
		// new key written
		expect(await db.has("u1.hoyolabs")).toBe(true);
	});

	it("groups multiple legacy entries that share a cookie under one hoyolab", async () => {
		const db = createFakeDb({
			u1: {
				account: [
					{ uid: "800000001", cookie: COOKIE_A, nickname: "A1" },
					{ uid: "800000002", cookie: COOKIE_A, nickname: "A2" }
				]
			}
		});
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs).toHaveLength(1);
		expect(out.hoyolabs[0]!.characters).toHaveLength(2);
		expect(out.hoyolabs[0]!.characters.map(c => c.uid).sort()).toEqual([
			"800000001",
			"800000002"
		]);
	});

	it("creates separate hoyolabs for distinct cookies (distinct ltuids)", async () => {
		const db = createFakeDb({
			u1: {
				account: [
					{ uid: "800000001", cookie: COOKIE_A, nickname: "A" },
					{ uid: "700000001", cookie: COOKIE_B, nickname: "B" }
				]
			}
		});
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs).toHaveLength(2);
		const ids = out.hoyolabs.map(h => h.ltuid_v2).sort();
		expect(ids).toEqual(["11111111", "22222222"]);
	});

	it("buckets entries with corrupt cookies under unknown-<hash>", async () => {
		const db = createFakeDb({
			u1: {
				account: [
					{ uid: "1", cookie: COOKIE_BAD, nickname: "X" },
					{ uid: "2", cookie: COOKIE_BAD, nickname: "Y" }
				]
			}
		});
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs).toHaveLength(1);
		expect(out.hoyolabs[0]!.ltuid_v2).toMatch(/^unknown-[0-9a-f]{8}$/);
		expect(out.hoyolabs[0]!.characters).toHaveLength(2);
	});

	it("treats hoyolab as invalid only if all legacy entries are invalid", async () => {
		const db = createFakeDb({
			u1: {
				account: [
					{ uid: "1", cookie: COOKIE_A, invalid: true },
					{ uid: "2", cookie: COOKIE_A, invalid: true }
				]
			}
		});
		const out = await loadAccounts(db, "u1");
		expect(out.hoyolabs[0]!.invalid).toBe(true);
	});

	it("does not write back when there is no legacy data", async () => {
		const db = createFakeDb();
		const before = db._dump();
		await loadAccounts(db, "u1");
		expect(db._dump()).toEqual(before);
	});
});

import { saveAccounts, type AccountStore, type Character } from "@/utilities/accountStore";

describe("saveAccounts (writes hoyolabs + legacy mirror)", () => {
	it("writes hoyolabs and a flattened legacy `.account` mirror", async () => {
		const db = createFakeDb();
		const store: AccountStore = {
			hoyolabs: [
				{
					ltuid_v2: "11111111",
					cookie: COOKIE_A,
					hoyolabName: "X",
					lastUpdate: "2026-04-27T00:00:00.000Z",
					invalid: false,
					characters: [
						{ uid: "800000001", nickname: "A1", region: "prod_official_asia", lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false },
						{ uid: "800000002", nickname: "A2", region: "prod_official_asia", lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false }
					]
				},
				{
					ltuid_v2: "22222222",
					cookie: COOKIE_B,
					hoyolabName: null,
					lastUpdate: "2026-04-27T00:00:00.000Z",
					invalid: false,
					characters: [
						{ uid: "700000001", nickname: "B1", region: null, lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false }
					]
				}
			]
		};

		await saveAccounts(db, "u1", store);

		// New shape preserved
		expect(await db.get("u1.hoyolabs")).toEqual(store.hoyolabs);

		// Legacy mirror flattened with cookie denormalized onto each char
		const mirror = (await db.get("u1.account")) as any[];
		expect(mirror).toHaveLength(3);
		expect(mirror.map(m => m.uid).sort()).toEqual([
			"700000001",
			"800000001",
			"800000002"
		]);
		for (const m of mirror) {
			expect(typeof m.cookie).toBe("string");
			expect(m.cookie.length).toBeGreaterThan(0);
		}
	});

	it("removes the legacy mirror when store is empty", async () => {
		const db = createFakeDb({ u1: { account: [{ uid: "1" }], hoyolabs: [] } });
		await saveAccounts(db, "u1", { hoyolabs: [] });
		expect(await db.has("u1.account")).toBe(false);
		expect(await db.get("u1.hoyolabs")).toEqual([]);
	});
});

import {
	getHoyolabs,
	getHoyolabByLtuid,
	getAllCharacters,
	getCharacter
} from "@/utilities/accountStore";

describe("read API", () => {
	const seedStore: AccountStore = {
		hoyolabs: [
			{
				ltuid_v2: "11111111",
				cookie: COOKIE_A,
				hoyolabName: "Hoyo1",
				lastUpdate: "2026-04-27T00:00:00.000Z",
				invalid: false,
				characters: [
					{ uid: "800000001", nickname: "A1", region: "asia", lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false },
					{ uid: "800000002", nickname: "A2", region: "asia", lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false }
				]
			},
			{
				ltuid_v2: "22222222",
				cookie: COOKIE_B,
				hoyolabName: null,
				lastUpdate: "2026-04-27T00:00:00.000Z",
				invalid: false,
				characters: [
					{ uid: "700000001", nickname: "B1", region: "america", lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false }
				]
			}
		]
	};

	function seed() {
		return createFakeDb({ u1: { hoyolabs: seedStore.hoyolabs } });
	}

	it("getHoyolabs returns all", async () => {
		const db = seed();
		expect(await getHoyolabs(db, "u1")).toHaveLength(2);
	});

	it("getHoyolabByLtuid finds match", async () => {
		const db = seed();
		const h = await getHoyolabByLtuid(db, "u1", "22222222");
		expect(h?.cookie).toBe(COOKIE_B);
	});

	it("getHoyolabByLtuid returns null when missing", async () => {
		const db = seed();
		expect(await getHoyolabByLtuid(db, "u1", "99999999")).toBeNull();
	});

	it("getAllCharacters flattens with ltuid + cookie attached", async () => {
		const db = seed();
		const all = await getAllCharacters(db, "u1");
		expect(all).toHaveLength(3);
		const a1 = all.find(c => c.uid === "800000001")!;
		expect(a1.ltuid_v2).toBe("11111111");
		expect(a1.cookie).toBe(COOKIE_A);
	});

	it("getCharacter returns char + parent hoyolab", async () => {
		const db = seed();
		const r = await getCharacter(db, "u1", "700000001");
		expect(r?.character.uid).toBe("700000001");
		expect(r?.hoyolab.ltuid_v2).toBe("22222222");
	});

	it("getCharacter returns null when uid missing", async () => {
		const db = seed();
		expect(await getCharacter(db, "u1", "0")).toBeNull();
	});
});

import {
	upsertHoyolab,
	upsertCharacter,
	removeHoyolab,
	markCharacterInvalid,
	markHoyolabInvalid,
	backfillHoyolabName
} from "@/utilities/accountStore";

describe("write API", () => {
	it("upsertHoyolab inserts a new hoyolab", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		const hs = await getHoyolabs(db, "u1");
		expect(hs).toHaveLength(1);
		expect(hs[0]).toMatchObject({
			ltuid_v2: "11111111",
			cookie: COOKIE_A,
			hoyolabName: null,
			invalid: false,
			characters: []
		});
	});

	it("upsertHoyolab updates cookie and clears invalid on existing", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await markHoyolabInvalid(db, "u1", "11111111", true);
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_B, hoyolabName: "Renamed" });
		const h = (await getHoyolabByLtuid(db, "u1", "11111111"))!;
		expect(h.cookie).toBe(COOKIE_B);
		expect(h.hoyolabName).toBe("Renamed");
		expect(h.invalid).toBe(false);
	});

	it("upsertCharacter inserts and then updates a character on a hoyolab", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await upsertCharacter(db, "u1", "11111111", {
			uid: "800000001", nickname: "A1", region: "asia",
			lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false
		});
		await upsertCharacter(db, "u1", "11111111", {
			uid: "800000001", nickname: "A1-Renamed", region: "asia",
			lastUpdate: "2026-04-27T01:00:00.000Z", invalid: false
		});
		const h = (await getHoyolabByLtuid(db, "u1", "11111111"))!;
		expect(h.characters).toHaveLength(1);
		expect(h.characters[0]!.nickname).toBe("A1-Renamed");
	});

	it("upsertCharacter throws if hoyolab missing", async () => {
		const db = createFakeDb();
		await expect(
			upsertCharacter(db, "u1", "deadbeef", {
				uid: "1", nickname: null, region: null,
				lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false
			})
		).rejects.toThrow(/hoyolab/i);
	});

	it("removeHoyolab drops the hoyolab and its characters", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await upsertHoyolab(db, "u1", { ltuid_v2: "22222222", cookie: COOKIE_B });
		await removeHoyolab(db, "u1", "11111111");
		const hs = await getHoyolabs(db, "u1");
		expect(hs).toHaveLength(1);
		expect(hs[0]!.ltuid_v2).toBe("22222222");
	});

	it("markCharacterInvalid flips the flag", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await upsertCharacter(db, "u1", "11111111", {
			uid: "800000001", nickname: "A", region: null,
			lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false
		});
		await markCharacterInvalid(db, "u1", "800000001", true);
		const r = await getCharacter(db, "u1", "800000001");
		expect(r?.character.invalid).toBe(true);
	});

	it("markHoyolabInvalid flips the flag", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await markHoyolabInvalid(db, "u1", "11111111", true);
		const h = await getHoyolabByLtuid(db, "u1", "11111111");
		expect(h?.invalid).toBe(true);
	});

	it("backfillHoyolabName sets name when null, no-ops when already set", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await backfillHoyolabName(db, "u1", "11111111", "FirstName");
		expect((await getHoyolabByLtuid(db, "u1", "11111111"))?.hoyolabName).toBe("FirstName");
		await backfillHoyolabName(db, "u1", "11111111", "OtherName");
		expect((await getHoyolabByLtuid(db, "u1", "11111111"))?.hoyolabName).toBe("FirstName");
	});

	it("write API keeps legacy mirror in sync", async () => {
		const db = createFakeDb();
		await upsertHoyolab(db, "u1", { ltuid_v2: "11111111", cookie: COOKIE_A });
		await upsertCharacter(db, "u1", "11111111", {
			uid: "800000001", nickname: "A1", region: "asia",
			lastUpdate: "2026-04-27T00:00:00.000Z", invalid: false
		});
		const mirror = (await db.get("u1.account")) as any[];
		expect(mirror).toHaveLength(1);
		expect(mirror[0]).toMatchObject({ uid: "800000001", cookie: COOKIE_A, nickname: "A1" });
	});
});

describe("Plan C — extended Character fields", () => {
	it("persists and reloads optional level/cover/logo/stats/region_name/game_name/enrichedAt", async () => {
		const db = createFakeDb();
		const userId = "u-planc-1";
		// Seed via upsertHoyolab + upsertCharacter
		await upsertHoyolab(db, userId, {
			ltuid_v2: "L1",
			cookie: "ltuid_v2=L1; ltoken_v2=tok",
			hoyolabName: null
		});
		const char: Character = {
			uid: "800111111",
			nickname: "Sloop",
			region: "prod_official_usa",
			lastUpdate: "2026-04-27T00:00:00.000Z",
			invalid: false,
			level: 70,
			region_name: "America",
			cover: "https://example.com/cover.png",
			logo: "https://example.com/logo.png",
			game_name: "Honkai: Star Rail",
			stats: [
				{ name: "Active days", value: "120" },
				{ name: "Avatars", value: "45" },
				{ name: "Light Cones", value: "80" },
				{ name: "Achievements", value: "320" }
			],
			enrichedAt: "2026-04-27T00:00:00.000Z"
		};
		await upsertCharacter(db, userId, "L1", char);

		const round = await getCharacter(db, userId, "800111111");
		expect(round).not.toBeNull();
		expect(round!.character.level).toBe(70);
		expect(round!.character.region_name).toBe("America");
		expect(round!.character.cover).toBe("https://example.com/cover.png");
		expect(round!.character.logo).toBe("https://example.com/logo.png");
		expect(round!.character.game_name).toBe("Honkai: Star Rail");
		expect(round!.character.stats).toHaveLength(4);
		expect(round!.character.stats![2]).toEqual({ name: "Light Cones", value: "80" });
		expect(round!.character.enrichedAt).toBe("2026-04-27T00:00:00.000Z");
	});

	it("legacy character without optional fields still round-trips", async () => {
		const db = createFakeDb();
		const userId = "u-planc-2";
		await upsertHoyolab(db, userId, {
			ltuid_v2: "L2",
			cookie: "c",
			hoyolabName: null
		});
		const legacy: Character = {
			uid: "800222222",
			nickname: "OldNick",
			region: null,
			lastUpdate: "2026-01-01T00:00:00.000Z",
			invalid: false
		};
		await upsertCharacter(db, userId, "L2", legacy);
		const round = await getCharacter(db, userId, "800222222");
		expect(round!.character.level).toBeUndefined();
		expect(round!.character.cover).toBeUndefined();
		expect(round!.character.stats).toBeUndefined();
	});
});
