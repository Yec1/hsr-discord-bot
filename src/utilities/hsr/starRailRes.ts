import axios from "axios";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type StarRailResLocale = "tw" | "cn" | "en";
type JsonMap = Record<string, any>;

export interface StarRailResBundle {
	characters: JsonMap;
	characterPromotions: JsonMap;
	characterRanks: JsonMap;
	characterSkills: JsonMap;
	characterSkillTrees: JsonMap;
	lightCones: JsonMap;
	lightConePromotions: JsonMap;
	relics: JsonMap;
	relicSets: JsonMap;
	relicMainAffixes: JsonMap;
	relicSubAffixes: JsonMap;
	properties: JsonMap;
	paths: JsonMap;
	elements: JsonMap;
	avatars: JsonMap;
}

const FILES: Array<[keyof StarRailResBundle, string]> = [
	["characters", "characters"], ["characterPromotions", "character_promotions"],
	["characterRanks", "character_ranks"], ["characterSkills", "character_skills"],
	["characterSkillTrees", "character_skill_trees"], ["lightCones", "light_cones"],
	["lightConePromotions", "light_cone_promotions"], ["relics", "relics"],
	["relicSets", "relic_sets"], ["relicMainAffixes", "relic_main_affixes"],
	["relicSubAffixes", "relic_sub_affixes"], ["properties", "properties"],
	["paths", "paths"], ["elements", "elements"], ["avatars", "avatars"]
];
const LOCALE_PATH: Record<StarRailResLocale, string> = { tw: "cht", cn: "cn", en: "en" };
const BASE_URL = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new";
const MAX_AGE = 24 * 60 * 60 * 1000;
const bundles = new Map<StarRailResLocale, Promise<StarRailResBundle>>();

export interface LoadOptions {
	readLocal?: boolean;
	writeLocal?: boolean;
	forceRefresh?: boolean;
}

async function readCached(path: string, allowStale = false): Promise<JsonMap | null> {
	try {
		const info = await stat(path);
		if (!allowStale && Date.now() - info.mtimeMs > MAX_AGE) return null;
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

async function loadFile(locale: StarRailResLocale, name: string, options: LoadOptions): Promise<JsonMap> {
	const localePath = LOCALE_PATH[locale];
	const localPath = join(process.cwd(), "src", "assets", "data", "starrailres", localePath, `${name}.json`);
	if (options.readLocal !== false && !options.forceRefresh) {
		const current = await readCached(localPath);
		if (current) return current;
	}
	try {
		const { data } = await axios.get<JsonMap>(`${BASE_URL}/${localePath}/${name}.json`, { timeout: 20_000 });
		if (!data || typeof data !== "object") throw new Error(`Invalid StarRailRes ${name}`);
		if (options.writeLocal !== false) {
			await mkdir(dirname(localPath), { recursive: true });
			await writeFile(localPath, `${JSON.stringify(data)}\n`, "utf8");
		}
		return data;
	} catch (error) {
		if (options.readLocal !== false) {
			const stale = await readCached(localPath, true);
			if (stale) return stale;
		}
		throw error;
	}
}

export function loadStarRailRes(locale: StarRailResLocale, options: LoadOptions = {}): Promise<StarRailResBundle> {
	if (!options.forceRefresh && bundles.has(locale)) return bundles.get(locale)!;
	const promise = Promise.all(FILES.map(async ([key, file]) => [key, await loadFile(locale, file, options)] as const))
		.then(entries => Object.fromEntries(entries) as unknown as StarRailResBundle)
		.catch(error => { bundles.delete(locale); throw error; });
	bundles.set(locale, promise);
	return promise;
}

export function clearStarRailResCache(): void {
	bundles.clear();
}

export { BASE_URL as STAR_RAIL_RES_BASE_URL };
