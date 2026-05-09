describe("jest sanity", () => {
	it("runs", () => {
		expect(1 + 1).toBe(2);
	});
});

import { createFakeDb } from "./helpers/fakeDb";

describe("fakeDb", () => {
	it("supports dotted set/get/delete/has", async () => {
		const db = createFakeDb();
		await db.set("123.account", [{ uid: "A" }]);
		expect(await db.has("123.account")).toBe(true);
		expect(await db.get("123.account")).toEqual([{ uid: "A" }]);
		await db.delete("123.account");
		expect(await db.has("123.account")).toBe(false);
	});
});
