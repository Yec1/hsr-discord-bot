import axios from "axios";
import { clearStarRailResCache, loadStarRailRes } from "@/utilities/hsr/starRailRes.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const files: Record<string, unknown> = {
	characters: { "1502": { id: "1502", name: "爻光", rarity: 5, path: "Elation", element: "Physical", icon: "icon/character/1502.png" } },
	character_promotions: {}, character_ranks: {}, character_skills: {}, character_skill_trees: {},
	light_cones: {}, light_cone_promotions: {}, relics: {}, relic_sets: {}, relic_main_affixes: {}, relic_sub_affixes: {},
	properties: {}, paths: {}, elements: {}, avatars: {}
};

describe("loadStarRailRes", () => {
	beforeEach(() => clearStarRailResCache());

	it("loads each resource once and caches the locale bundle", async () => {
		mockedAxios.get.mockImplementation(async url => {
			const file = String(url).split("/").pop()!.replace(".json", "");
			return { data: files[file] };
		});
		const a = await loadStarRailRes("tw", { readLocal: false, writeLocal: false });
		const calls = mockedAxios.get.mock.calls.length;
		const b = await loadStarRailRes("tw", { readLocal: false, writeLocal: false });
		expect(a.characters["1502"].name).toBe("爻光");
		expect(b).toBe(a);
		expect(mockedAxios.get).toHaveBeenCalledTimes(calls);
	});
});
