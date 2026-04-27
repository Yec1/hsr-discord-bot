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
