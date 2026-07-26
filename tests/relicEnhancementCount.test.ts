import { getRelicSubAffixEnhancementCount } from "@/utilities/hsr/relicEnhancement.js";

describe("getRelicSubAffixEnhancementCount", () => {
	it("keeps an explicit Enka count of one at zero instead of falling back to step", () => {
		expect(getRelicSubAffixEnhancementCount({ count: 1, times: 2 })).toBe(0);
	});

	it("shows at most the five official enhancement rolls", () => {
		expect(getRelicSubAffixEnhancementCount({ count: 6, times: 99 })).toBe(5);
		expect(getRelicSubAffixEnhancementCount({ count: 7 })).toBe(5);
	});

	it("uses legacy times only when count is actually missing", () => {
		expect(getRelicSubAffixEnhancementCount({ times: 4 })).toBe(3);
	});
});
