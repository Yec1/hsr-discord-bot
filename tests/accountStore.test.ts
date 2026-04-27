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

import { saveAccounts, type AccountStore } from "@/utilities/accountStore";

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
