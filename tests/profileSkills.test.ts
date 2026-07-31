import { filterVisibleProfileSkills } from "@/utilities/hsr/profileSkills.js";

describe("filterVisibleProfileSkills", () => {
	it("keeps only the six profile skill categories supported by the game UI", () => {
		const skills = [
			{ type: "Normal", type_text: "普攻" },
			{ type: "BPSkill", type_text: "戰技" },
			{ type: "Talent", type_text: "天賦" },
			{ type: "Ultra", type_text: "終結技" },
			{ type: "MemospriteSkill", type_text: "憶靈技" },
			{ type: "ElationSkill", type_text: "歡愉技" },
			{ type: "MazeNormal", type_text: "普通攻擊" },
			{ type: "Maze", type_text: "秘技" },
			{ type: "Technique", type_text: "Technique" },
			{ type: "Passive", type_text: "被動" },
			{ type: "Insert", type_text: "追加攻擊" }
		];

		expect(filterVisibleProfileSkills(skills).map(skill => skill.type)).toEqual([
			"Normal",
			"BPSkill",
			"Talent",
			"Ultra",
			"MemospriteSkill",
			"ElationSkill"
		]);
	});

	it("recognises official API labels without allowing unrelated or technique nodes", () => {
		const skills = [
			{ remake: "普通攻擊", point_type: 2 },
			{ remake: "戰技", point_type: 2 },
			{ remake: "天賦", point_type: 2 },
			{ remake: "終結技", point_type: 2 },
			{ remake: "憶靈技", point_type: 10 },
			{ remake: "歡愉技", point_type: 4 },
			{ remake: "秘技", point_type: 4 },
			{ type_text: "Technique", point_type: 4 },
			{ remake: "憶靈天賦", point_type: 10 },
			{ remake: "生命強化", point_type: 1 }
		];

		expect(filterVisibleProfileSkills(skills).map(skill => skill.remake)).toEqual([
			"普通攻擊",
			"戰技",
			"天賦",
			"終結技",
			"憶靈技",
			"歡愉技"
		]);
	});
});
