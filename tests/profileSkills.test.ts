import { filterVisibleProfileSkills } from "@/utilities/hsr/profileSkills.js";

describe("filterVisibleProfileSkills", () => {
	it("removes Enka map attacks and techniques", () => {
		const skills = [
			{ type: "Normal", type_text: "普通攻擊" },
			{ type: "MazeNormal", type_text: "普通攻擊" },
			{ type: "Maze", type_text: "秘技" }
		];

		expect(filterVisibleProfileSkills(skills)).toEqual([
			{ type: "Normal", type_text: "普通攻擊" }
		]);
	});

	it("removes techniques returned by the official API without a type", () => {
		const skills = [
			{ remake: "普通攻擊", point_type: 1 },
			{ remake: "秘技", point_type: 4 },
			{ type_text: "Technique", point_type: 4 },
			{ type: "ElationSkill", type_text: "歡愉技", point_type: 4 }
		];

		expect(filterVisibleProfileSkills(skills)).toEqual([
			{ remake: "普通攻擊", point_type: 1 },
			{ type: "ElationSkill", type_text: "歡愉技", point_type: 4 }
		]);
	});
});
