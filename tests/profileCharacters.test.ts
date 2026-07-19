import { getProfileCharacterNameColor } from "@/utilities/hsr/profileCharacters.js";

describe("getProfileCharacterNameColor", () => {
	it("uses gold for an Enka support character", () => {
		expect(getProfileCharacterNameColor({ _assist: true })).toBe("#FFD89C");
	});

	it("keeps official API support positions gold", () => {
		expect(getProfileCharacterNameColor({ pos: 1 })).toBe("#FFD89C");
		expect(getProfileCharacterNameColor({ pos: 2 })).toBe("#FFD89C");
	});

	it("uses white for regular characters", () => {
		expect(getProfileCharacterNameColor({ _assist: false })).toBe("white");
		expect(getProfileCharacterNameColor({ pos: 3 })).toBe("white");
	});
});
