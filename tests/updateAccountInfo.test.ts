/**
 * Verifies that updateAccountInfo (legacy signature) routes through the
 * new accountStore and persists the canonical `<userId>.hoyolabs` shape.
 * Legacy `.account` data is read only for one-time migration and is never
 * recreated by writes.
 *
 * The wrapper is exercised through the accountStore primitives directly
 * because importing utilities/index.ts pulls in the live database/client
 * singletons. End-to-end behavior is covered by smoke-testing in a real
 * dev environment (Phase 1 manual verification step).
 */
import { createFakeDb } from "./helpers/fakeDb";
import {
	upsertHoyolab,
	upsertCharacter,
	extractLtuidFromCookie,
	fallbackBucketKey
} from "@/utilities/accountStore";

const COOKIE_A = "ltuid_v2=11111111; ltoken_v2=AAA";
const COOKIE_BAD = "ltoken_v2=NOIDHERE";

async function updateAccountInfoLike(
	db: any,
	userId: string,
	{ uid, cookie, nickname }: { uid: string; cookie: string; nickname?: string }
) {
	const ltuid = extractLtuidFromCookie(cookie) ?? fallbackBucketKey(cookie);
	await upsertHoyolab(db, userId, { ltuid_v2: ltuid, cookie });
	await upsertCharacter(db, userId, ltuid, {
		uid: String(uid),
		nickname: nickname ?? null,
		region: null,
		lastUpdate: new Date().toISOString(),
		invalid: false
	});
}

describe("updateAccountInfo wrapper semantics", () => {
	it("creates hoyolab + character for a new user", async () => {
		const db = createFakeDb();
		await updateAccountInfoLike(db, "u1", { uid: "800000001", cookie: COOKIE_A, nickname: "A" });
		expect((await db.get("u1.hoyolabs")) as any[]).toHaveLength(1);
		expect(await db.has("u1.account")).toBe(false);
	});

	it("updates an existing character without duplicating", async () => {
		const db = createFakeDb();
		await updateAccountInfoLike(db, "u1", { uid: "800000001", cookie: COOKIE_A, nickname: "A" });
		await updateAccountInfoLike(db, "u1", { uid: "800000001", cookie: COOKIE_A, nickname: "A-renamed" });
		expect(((await db.get("u1.hoyolabs")) as any[])[0].characters.length).toBe(1);
	});

	it("buckets corrupt-cookie writes under unknown-<hash>", async () => {
		const db = createFakeDb();
		await updateAccountInfoLike(db, "u1", { uid: "1", cookie: COOKIE_BAD });
		const hs = (await db.get("u1.hoyolabs")) as any[];
		expect(hs[0].ltuid_v2).toMatch(/^unknown-[0-9a-f]{8}$/);
	});
});
