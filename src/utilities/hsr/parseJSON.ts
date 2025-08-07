import { join } from "path";
import { loadJSONFile, JSON_CONFIGS } from "./jsonManager.js";

interface CharItem {
	name: string;
	rarity: number;
	path: string;
	element: string;
}

interface WeaponItem {
	name: string;
	rarity: number;
	path: string;
}

interface BannerItem {
	vers: string[];
	type: string;
	title: Record<string, string>;
	rateUpFive: string[];
	rateUpFour: string[];
	poolFiveChar: string[];
	poolFiveWeap: string[];
	poolFourChar: string[];
	poolFourWeap: string[];
}

const cleanText = (text: string): string => {
	return text
		.replace(/[^\w\s-]/g, "")
		.toLowerCase()
		.replace(/\s+/g, "-");
};

let charJSON: Record<string, CharItem> = {};
let weaponJSON: Record<string, WeaponItem> = {};
let bannerJSON: BannerItem[] = [];

async function fetchData(): Promise<void> {
	try {
		// 使用JSON管理器加载所有文件
		const [localBanners, localChar, localWeapons] = await Promise.all([
			loadJSONFile(JSON_CONFIGS.BANNERS),
			loadJSONFile(JSON_CONFIGS.CHAR),
			loadJSONFile(JSON_CONFIGS.WEAPONS)
		]);

		// 设置数据
		if (localBanners) {
			bannerJSON = localBanners;
		}
		if (localChar) {
			charJSON = localChar.reduce(
				(acc: Record<string, CharItem>, item: CharItem) => {
					acc[cleanText(item.name)] = item;
					return acc;
				},
				{}
			);
		}
		if (localWeapons) {
			weaponJSON = localWeapons.reduce(
				(acc: Record<string, WeaponItem>, item: WeaponItem) => {
					acc[cleanText(item.name)] = item;
					return acc;
				},
				{}
			);
		}

		console.log("[JSON] Data loading completed");
	} catch (error) {
		console.error("[JSON] Error loading data:", error);
		// 如果所有方法都失败，使用空的默认值
		bannerJSON = [];
		charJSON = {};
		weaponJSON = {};
	}
}

fetchData();

function isChar(item: string): boolean {
	return Object.keys(charJSON).includes(cleanText(item));
}

function getName(item: string): string | undefined {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.name;
}

function getRarity(item: string): number | undefined {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.rarity;
}

function getPath(item: string, lang: string = "zh"): string | undefined {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.path;
}

function getElement(name: string): string {
	return charJSON[cleanText(name)]?.element || "";
}

function getTitle(
	vers: string,
	type: string,
	lang: string
): string | undefined {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.title[lang];
}

function getRateUpFive(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.rateUpFive || [];
}

function getRateUpFour(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.rateUpFour || [];
}

function getPoolFiveChar(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFiveChar || [];
}

function getPoolFiveWeap(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFiveWeap || [];
}

function getPoolFourChar(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFourChar || [];
}

function getPoolFourWeap(vers: string, type: string): string[] {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFourWeap || [];
}

function getTypes(vers: string): string[] {
	let types: string[] = [];
	for (const key of bannerJSON) {
		if (key.vers.includes(vers)) types.push(key.type);
	}
	return types;
}

export {
	isChar,
	getName,
	getRarity,
	getPath,
	getElement,
	getTitle,
	getRateUpFive,
	getRateUpFour,
	getPoolFiveChar,
	getPoolFiveWeap,
	getPoolFourChar,
	getPoolFourWeap,
	getTypes
};
