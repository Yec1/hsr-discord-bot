import { fitProfileSignature } from "@/utilities/hsr/profileSignature.js";

const measure = (text: string) => text.length * 10;

describe("fitProfileSignature", () => {
	it("returns null for an empty signature", () => {
		expect(fitProfileSignature("   ", measure, 100)).toBeNull();
		expect(fitProfileSignature(undefined, measure, 100)).toBeNull();
	});

	it("keeps a signature that fits", () => {
		expect(fitProfileSignature("測試簽名", measure, 100)).toBe("測試簽名");
	});

	it("truncates an overlong signature with an ellipsis", () => {
		expect(fitProfileSignature("123456789012345", measure, 80)).toBe("1234567…");
	});
});
