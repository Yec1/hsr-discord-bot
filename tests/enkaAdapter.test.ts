import fixture from "./fixtures/enka-hsr-profile.json";
import { adaptEnkaProfile } from "@/utilities/hsr/enkaAdapter.js";
import type { StarRailResBundle } from "@/utilities/hsr/starRailRes.js";

const resources: StarRailResBundle = {
	characters: {
		"1502": {
			id: "1502", name: "爻光", rarity: 5, path: "Elation", element: "Physical",
			ranks: ["150201", "150202", "150203", "150204", "150205", "150206"],
			skills: ["150201", "150206", "150207"],
			skill_trees: ["1502001", "1502002", "1502003"], icon: "icon/character/1502.png",
			preview: "image/character_preview/1502.png", portrait: "image/character_portrait/1502.png"
		}
	},
	characterPromotions: {
		"1502": { id: "1502", values: [{}, {}, {}, {}, {}, {}, {
			hp: { base: 489.6, step: 7.2 }, atk: { base: 236.64, step: 3.48 },
			def: { base: 265.2, step: 3.9 }, spd: { base: 101, step: 0 },
			crit_rate: { base: 0.05, step: 0 }, crit_dmg: { base: 0.5, step: 0 }
		}] }
	},
	characterRanks: Object.fromEntries([1,2,3,4,5,6].map(n => [`15020${n}`, { id: `15020${n}`, icon: `icon/skill/1502_rank${n}.png` }])),
	characterSkills: {
		"150201": { id: "150201", name: "普通攻擊", max_level: 10, type: "Normal", type_text: "普通攻擊", icon: "icon/skill/basic.png" },
		"150206": { id: "150206", name: "秘技攻擊", max_level: 1, type: "MazeNormal", type_text: "", icon: "icon/skill/basic.png" },
		"150207": { id: "150207", name: "追加攻擊", max_level: 1, type: "Insert", type_text: "追加攻擊", icon: "icon/skill/insert.png" }
	},
	characterSkillTrees: {
		"1502001": { id: "1502001", max_level: 6, anchor: "Point01", level_up_skills: [{ id: "150201", num: 1 }], levels: [], icon: "icon/skill/basic.png" },
		"1502002": { id: "1502002", max_level: 10, anchor: "Point02", level_up_skills: [], levels: [], icon: "icon/skill/skill.png" },
		"1502003": { id: "1502003", max_level: 10, anchor: "Point03", level_up_skills: [], levels: [], icon: "icon/skill/ult.png" }
	},
	lightCones: { "21064": { id: "21064", name: "菇菇嘎嘎歷險記", rarity: 4, path: "Elation", desc: "繁中敘述", icon: "icon/light_cone/21064.png" } },
	lightConePromotions: {},
	relics: Object.fromEntries(["61301","61302","61303","61304","61405","61406"].map((id, i) => [id, { id, set_id: i < 4 ? "130" : "131", name: `測試遺器${i+1}`, rarity: 5, type: ["HEAD","HAND","BODY","FOOT","NECK","OBJECT"][i], max_level: 15, main_affix_id: "51", sub_affix_id: "5", icon: `icon/relic/${id}.png` }])),
	relicSets: {}, relicMainAffixes: {}, relicSubAffixes: {},
	properties: {
		HPDelta: { type: "HPDelta", name: "生命值", field: "hp", affix: true, ratio: false, percent: false, order: 39, icon: "icon/property/IconMaxHP.png" },
		DefenceDelta: { type: "DefenceDelta", name: "防禦力", field: "def", affix: true, ratio: false, percent: false, order: 37, icon: "icon/property/IconDefence.png" },
		SpeedDelta: { type: "SpeedDelta", name: "速度", field: "spd", affix: true, ratio: false, percent: false, order: 36, icon: "icon/property/IconSpeed.png" },
		CriticalChance: { type: "CriticalChance", name: "暴擊率", field: "crit_rate", affix: true, ratio: true, percent: true, order: 30, icon: "icon/property/IconCriticalChance.png" },
		BreakDamageAddedRatio: { type: "BreakDamageAddedRatio", name: "擊破特攻", field: "break_dmg", affix: true, ratio: true, percent: true, order: 28, icon: "icon/property/IconBreakUp.png" },
		SPRatioBase: { type: "SPRatioBase", name: "能量恢復效率", field: "sp_rate", affix: true, ratio: false, percent: true, order: 19, icon: "icon/property/IconEnergyRecovery.png" },
		StatusResistanceBase: { type: "StatusResistanceBase", name: "效果抗性", field: "effect_res", affix: true, ratio: false, percent: true, order: 21, icon: "icon/property/IconStatusResistance.png" }
	},
	paths: { Elation: { id: "Elation", name: "歡愉", icon: "icon/path/Elation.png" } },
	elements: { Physical: { id: "Physical", name: "物理", color: "#FFFFFF", icon: "icon/element/Physical.png" } },
	avatars: {}
};

describe("adaptEnkaProfile", () => {
	it("converts player identity and displayed character metadata", () => {
		const result = adaptEnkaProfile(fixture, resources);
		expect(result.player.uid).toBe("800000001");
		expect(result.player.nickname).toBe("測試玩家");
		expect(result.player.signature).toBe("這是一段測試簽名");
		expect(result.characters).toHaveLength(1);
		expect(result.characters[0]).toMatchObject({ id: "1502", name: "爻光", rank: 1, rarity: 5, _assist: true });
		expect(result.characters[0]!.rank_icons).toHaveLength(6);
	});

	it("maps light cone, six relics, skills and calculated base properties", () => {
		const character = adaptEnkaProfile(fixture, resources).characters[0]!;
		expect(character.light_cone).toMatchObject({ id: "21064", name: "菇菇嘎嘎歷險記", level: 80, rank: 5, desc: "繁中敘述" });
		expect([...(character.relics ?? []), ...(character.ornaments ?? [])]).toHaveLength(6);
		expect(character.relics).toHaveLength(4);
		expect(character.ornaments).toHaveLength(2);
		expect(character.relics![0]!.sub_affix?.[0]).toMatchObject({ type: "DefenceDelta", count: 2, times: 3, propertyName: "DefenceDelta" });
		expect(character.relics![0]!.type).toBe(1);
		expect(character.skills?.some(skill => skill.type_text === "普通攻擊")).toBe(true);
		expect(character.skills?.some(skill => skill.type === "MazeNormal")).toBe(false);
		expect(character.skills?.some(skill => skill.type === "Insert")).toBe(false);
		expect(character.skill_trees?.[0]).toMatchObject({ id: "1502001", level: 1, anchor: "Point01" });
		expect(character.attributes?.find(a => a.field === "hp")?.value).toBeGreaterThan(1800);
		expect(character.attributes?.find(a => a.field === "energy_recovery")).toMatchObject({ name: "能量恢復效率", icon: "icon/property/IconEnergyRecovery.png" });
		expect(character.attributes?.find(a => a.field === "status_res")).toMatchObject({ name: "效果抗性", icon: "icon/property/IconStatusResistance.png" });
	});
});
