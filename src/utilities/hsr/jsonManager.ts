import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import axios from "axios";

// 日志级别配置
const LOG_LEVEL = {
	ERROR: 0, // 只显示错误
	WARN: 1, // 显示警告和错误
	INFO: 2, // 显示信息、警告和错误
	DEBUG: 3 // 显示所有日志
};

// 当前日志级别（可以通过环境变量设置）
const CURRENT_LOG_LEVEL = process.env.JSON_LOG_LEVEL
	? LOG_LEVEL[
			process.env.JSON_LOG_LEVEL.toUpperCase() as keyof typeof LOG_LEVEL
		] || LOG_LEVEL.INFO
	: LOG_LEVEL.INFO;

// 日志工具函数
function log(level: number, message: string, ...args: any[]) {
	if (level <= CURRENT_LOG_LEVEL) {
		console.log(message, ...args);
	}
}

function logWarn(level: number, message: string, ...args: any[]) {
	if (level <= CURRENT_LOG_LEVEL) {
		console.warn(message, ...args);
	}
}

function logError(level: number, message: string, ...args: any[]) {
	if (level <= CURRENT_LOG_LEVEL) {
		console.error(message, ...args);
	}
}

interface JSONFileConfig {
	localPath: string;
	remoteUrl: string;
	fileName: string;
}

/**
 * JSON文件管理器 - 优先使用本地文件，自动下载远程文件
 */
export class JSONManager {
	private static instance: JSONManager;
	private cache = new Map<string, any>();
	private lastUpdateTime = new Map<string, number>();
	private updateInterval = 24 * 60 * 60 * 1000; // 24小時的毫秒數
	private isUpdating = new Set<string>(); // 防止重複更新
	private updateTimer: NodeJS.Timeout | null = null;

	private constructor() {
		// 啟動定時檢查更新
		this.startPeriodicUpdate();
	}

	static getInstance(): JSONManager {
		if (!JSONManager.instance) {
			JSONManager.instance = new JSONManager();
		}
		return JSONManager.instance;
	}

	/**
	 * 加载JSON文件，优先使用本地文件
	 */
	async loadJSON(config: JSONFileConfig): Promise<any> {
		const cacheKey = config.fileName;

		// 检查缓存
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey);
		}

		// 防止重複加載
		if (this.isUpdating.has(cacheKey)) {
			// 等待加載完成
			while (this.isUpdating.has(cacheKey)) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			return this.cache.get(cacheKey);
		}

		this.isUpdating.add(cacheKey);

		try {
			// 首先尝试从本地加载
			if (existsSync(config.localPath)) {
				const localData = readFileSync(config.localPath, "utf-8");
				const parsedData = JSON.parse(localData);
				this.cache.set(cacheKey, parsedData);
				this.lastUpdateTime.set(cacheKey, Date.now());
				return parsedData;
			}

			// 如果本地文件不存在，从远程下载
			console.log(
				`[JSON] Local file not found, downloading ${config.fileName} from remote...`
			);
			const remoteData = await this.downloadJSON(config.remoteUrl);

			if (remoteData) {
				// 保存到本地
				await this.saveLocalJSON(config.localPath, remoteData);
				this.cache.set(cacheKey, remoteData);
				this.lastUpdateTime.set(cacheKey, Date.now());
				console.log(
					`[JSON] ✓ Successfully downloaded and saved ${config.fileName} to local`
				);
				return remoteData;
			} else {
				console.warn(
					`[JSON] Failed to download ${config.fileName} from remote`
				);
			}
		} catch (error) {
			console.error(`[JSON] Error loading ${config.fileName}:`, error);

			// 如果是本地文件解析错误，尝试删除损坏的文件并重新下载
			if (existsSync(config.localPath) && error instanceof SyntaxError) {
				console.log(
					`[JSON] Local file corrupted, attempting to re-download ${config.fileName}...`
				);
				try {
					// 删除损坏的文件
					const fs = await import("fs");
					fs.unlinkSync(config.localPath);
					console.log(
						`[JSON] Removed corrupted local file: ${config.localPath}`
					);

					// 重新尝试下载
					const remoteData = await this.downloadJSON(
						config.remoteUrl
					);
					if (remoteData) {
						await this.saveLocalJSON(config.localPath, remoteData);
						this.cache.set(cacheKey, remoteData);
						this.lastUpdateTime.set(cacheKey, Date.now());
						console.log(
							`[JSON] ✓ Successfully re-downloaded and saved ${config.fileName}`
						);
						return remoteData;
					}
				} catch (retryError) {
					console.error(
						`[JSON] Failed to re-download ${config.fileName}:`,
						retryError
					);
				}
			}
		} finally {
			this.isUpdating.delete(cacheKey);
		}

		return null;
	}

	/**
	 * 从远程下载JSON文件
	 */
	private async downloadJSON(url: string): Promise<any> {
		try {
			const response = await axios.get(url, {
				timeout: 15000, // 增加超時時間
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
					Accept: "application/json",
					"Accept-Encoding": "gzip, deflate, br"
				},
				maxRedirects: 5,
				validateStatus: status => status < 400
			});
			return response.data;
		} catch (error) {
			console.warn(`[JSON] Failed to download from ${url}:`, error);
			return null;
		}
	}

	/**
	 * 保存JSON文件到本地
	 */
	private async saveLocalJSON(filePath: string, data: any): Promise<void> {
		try {
			// 确保目录存在
			const dir = join(filePath, "..");
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
		} catch (error) {
			console.error(`[JSON] Failed to save file: ${filePath}`, error);
		}
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * 获取缓存状态
	 */
	getCacheStatus(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys())
		};
	}

	/**
	 * 设置缓存数据
	 */
	setCacheData(key: string, data: any): void {
		this.cache.set(key, data);
	}

	/**
	 * 啟動定時檢查更新
	 */
	private startPeriodicUpdate(): void {
		// 每24小時檢查一次更新
		this.updateTimer = setInterval(async () => {
			await this.checkAllFilesUpdate();
		}, this.updateInterval);

		// 立即執行一次檢查
		setTimeout(async () => {
			await this.checkAllFilesUpdate();
		}, 5000); // 5秒後開始首次檢查
	}

	/**
	 * 檢查所有文件的更新
	 */
	private async checkAllFilesUpdate(): Promise<void> {
		const configs = Object.values(JSON_CONFIGS);

		for (const config of configs) {
			try {
				await this.checkFileUpdate(config);
			} catch (error) {
				console.error(
					`[JSON] 檢查文件更新失敗 ${config.fileName}:`,
					error
				);
			}
		}
	}

	/**
	 * 檢查單個文件的更新
	 */
	private async checkFileUpdate(config: JSONFileConfig): Promise<void> {
		const now = Date.now();
		const lastUpdate = this.lastUpdateTime.get(config.fileName) || 0;

		// 檢查是否需要更新（距離上次更新超過24小時）
		if (now - lastUpdate < this.updateInterval) {
			return;
		}

		// 防止重複更新
		if (this.isUpdating.has(config.fileName)) {
			return;
		}

		this.isUpdating.add(config.fileName);

		try {
			// 下載遠程文件進行比較
			const remoteData = await this.downloadJSON(config.remoteUrl);
			if (!remoteData) {
				console.warn(`[JSON] 無法下載 ${config.fileName} 的遠程數據`);
				return;
			}

			// 獲取本地數據
			let localData = null;
			if (existsSync(config.localPath)) {
				try {
					const localContent = readFileSync(
						config.localPath,
						"utf-8"
					);
					localData = JSON.parse(localContent);
				} catch (error) {
					console.warn(
						`[JSON] 讀取本地文件失敗 ${config.fileName}:`,
						error
					);
				}
			}

			// 比較數據是否有更新（使用更高效的比較方法）
			const hasUpdate = this.hasDataChanged(localData, remoteData);

			if (hasUpdate) {
				console.log(
					`[JSON] 發現 ${config.fileName} 有更新，正在下載...`
				);
				await this.saveLocalJSON(config.localPath, remoteData);
				this.cache.set(config.fileName, remoteData);
				this.lastUpdateTime.set(config.fileName, now);
				console.log(`[JSON] ✓ ${config.fileName} 更新完成`);
			} else {
				this.lastUpdateTime.set(config.fileName, now);
			}
		} catch (error) {
			console.error(
				`[JSON] 檢查 ${config.fileName} 更新時發生錯誤:`,
				error
			);
		} finally {
			this.isUpdating.delete(config.fileName);
		}
	}

	/**
	 * 手動觸發更新檢查
	 */
	async forceUpdateCheck(): Promise<void> {
		await this.checkAllFilesUpdate();
	}

	/**
	 * 獲取文件最後更新時間
	 */
	getLastUpdateTime(fileName: string): number | undefined {
		return this.lastUpdateTime.get(fileName);
	}

	/**
	 * 高效比較數據是否有變化
	 */
	private hasDataChanged(localData: any, remoteData: any): boolean {
		if (!localData) return true;

		// 對於大型數據，先比較關鍵字段
		if (typeof localData === "object" && typeof remoteData === "object") {
			// 比較對象的鍵數量
			const localKeys = Object.keys(localData);
			const remoteKeys = Object.keys(remoteData);

			if (localKeys.length !== remoteKeys.length) return true;

			// 對於數組，比較長度
			if (Array.isArray(localData) && Array.isArray(remoteData)) {
				if (localData.length !== remoteData.length) return true;
			}
		}

		// 最後進行完整比較
		return JSON.stringify(remoteData) !== JSON.stringify(localData);
	}

	/**
	 * 從數據中枚舉並下載圖標
	 */
	async downloadIconsFromData(data: any): Promise<void> {
		const baseUrl =
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
		const iconKeys = ["icon", "icon_small"];

		const processItem = async (item: any) => {
			for (const key of iconKeys) {
				if (item[key] && typeof item[key] === "string") {
					const remoteRelativePath = item[key];
					const iconUrl = baseUrl + remoteRelativePath;
					// 本地存儲路徑映射：將遠端路徑映射到 src/assets/cache/...
					const localPath = join(
						"./src/assets/cache",
						remoteRelativePath.replace(/\//g, "_")
					);

					if (!existsSync(localPath)) {
						// console.log(`[JSON] Downloading icon: ${iconUrl} to ${localPath}`);
						await this.downloadFile(iconUrl, localPath);
					}
				}
			}
		};

		if (Array.isArray(data)) {
			// 控制併發
			for (const item of data) await processItem(item);
		} else if (typeof data === "object") {
			for (const item of Object.values(data)) await processItem(item);
		}
	}

	/**
	 * 下載二進制文件
	 */
	private async downloadFile(url: string, filePath: string): Promise<void> {
		try {
			const dir = join(filePath, "..");
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			const response = await axios.get(url, {
				responseType: "arraybuffer",
				timeout: 10000
			});

			writeFileSync(filePath, Buffer.from(response.data));
		} catch (error) {
			// console.error(`[JSON] Failed to download file from ${url}:`, (error as Error).message);
		}
	}

	/**
	 * 清理資源
	 */
	destroy(): void {
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
		this.cache.clear();
		this.lastUpdateTime.clear();
		this.isUpdating.clear();
	}
}

// 预定义的JSON文件配置（所有 JSON 統一存放在 src/assets/data/）
export const JSON_CONFIGS = {
	LIGHT_CONE_RANKS: {
		localPath: "./src/assets/data/light_cone_ranks.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/light_cone_ranks.json",
		fileName: "light_cone_ranks.json"
	},
	LIGHT_CONE_RANKS_CN: {
		localPath: "./src/assets/data/light_cone_ranks_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/light_cone_ranks.json",
		fileName: "light_cone_ranks_cn.json"
	},
	LIGHT_CONE_RANKS_EN: {
		localPath: "./src/assets/data/light_cone_ranks_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/light_cone_ranks.json",
		fileName: "light_cone_ranks_en.json"
	},
	LIGHT_CONE_NAMES: {
		localPath: "./src/assets/data/lightcone.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/light_cones.json",
		fileName: "lightcone.json"
	},
	CHARACTER_NAMES_CN: {
		localPath: "./src/assets/data/characters_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/characters.json",
		fileName: "characters_cn.json"
	},
	CHARACTER_NAMES_EN: {
		localPath: "./src/assets/data/characters_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/characters.json",
		fileName: "characters_en.json"
	},
	CHARACTER_NAMES_CHT: {
		localPath: "./src/assets/data/characters_cht.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/characters.json",
		fileName: "characters_cht.json"
	},
	RELIC_SET: {
		localPath: "./src/assets/data/relicset.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/relics.json",
		fileName: "relicset.json"
	},
	BANNERS: {
		localPath: "./src/assets/data/banners.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/banners.json",
		fileName: "banners.json"
	},
	CHAR: {
		localPath: "./src/assets/data/char.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/char.json",
		fileName: "char.json"
	},
	WEAPONS: {
		localPath: "./src/assets/data/weapons.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/weapons.json",
		fileName: "weapons.json"
	},
	PATHS_CN: {
		localPath: "./src/assets/data/paths_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cn/paths.json",
		fileName: "paths_cn.json"
	},
	PATHS_EN: {
		localPath: "./src/assets/data/paths_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/en/paths.json",
		fileName: "paths_en.json"
	},
	PATHS_CHT: {
		localPath: "./src/assets/data/paths_cht.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cht/paths.json",
		fileName: "paths_cht.json"
	},
	ELEMENTS_CN: {
		localPath: "./src/assets/data/elements_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cn/elements.json",
		fileName: "elements_cn.json"
	},
	ELEMENTS_EN: {
		localPath: "./src/assets/data/elements_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/en/elements.json",
		fileName: "elements_en.json"
	},
	ELEMENTS_CHT: {
		localPath: "./src/assets/data/elements_cht.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cht/elements.json",
		fileName: "elements_cht.json"
	},
	PROPERTIES_CN: {
		localPath: "./src/assets/data/properties_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cn/properties.json",
		fileName: "properties_cn.json"
	},
	PROPERTIES_EN: {
		localPath: "./src/assets/data/properties_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/en/properties.json",
		fileName: "properties_en.json"
	},
	PROPERTIES_CHT: {
		localPath: "./src/assets/data/properties_cht.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cht/properties.json",
		fileName: "properties_cht.json"
	}
};

// 便捷函数
export async function loadJSONFile(config: JSONFileConfig): Promise<any> {
	return await JSONManager.getInstance().loadJSON(config);
}

/**
 * 专门用于加载光锥数据的函数，优先使用本地文件
 * @param lang 用户语言 (tw, cn, en)
 */
export async function loadLightConeData(lang: string = "en"): Promise<any> {
	const manager = JSONManager.getInstance();

	// 根据语言选择配置
	let config;
	switch (lang) {
		case "cn":
			config = JSON_CONFIGS.LIGHT_CONE_RANKS_CN;
			break;
		case "en":
			config = JSON_CONFIGS.LIGHT_CONE_RANKS_EN;
			break;
		case "tw":
		default:
			config = JSON_CONFIGS.LIGHT_CONE_RANKS;
			break;
	}

	try {
		// 首先检查本地文件
		if (existsSync(config.localPath)) {
			const localData = readFileSync(config.localPath, "utf-8");
			const parsedData = JSON.parse(localData);
			manager.setCacheData(config.fileName, parsedData);
			return parsedData;
		}

		// 如果本地文件不存在，使用标准加载流程
		console.log(
			`[JSON] Light cone local file not found for ${lang}, using standard loading...`
		);
		return await loadJSONFile(config);
	} catch (error) {
		console.error(
			`[JSON] Error loading light cone data for ${lang}:`,
			error
		);
		return null;
	}
}

/**
 * 专门用于加载遗器套装数据的函数，优先使用本地文件
 */
export async function loadRelicSetData(): Promise<any> {
	const manager = JSONManager.getInstance();

	try {
		// 首先检查本地文件
		if (existsSync(JSON_CONFIGS.RELIC_SET.localPath)) {
			const localData = readFileSync(
				JSON_CONFIGS.RELIC_SET.localPath,
				"utf-8"
			);
			const parsedData = JSON.parse(localData);
			manager.setCacheData(JSON_CONFIGS.RELIC_SET.fileName, parsedData);
			return parsedData;
		}

		// 如果本地文件不存在，使用标准加载流程
		console.log(
			"[JSON] Relic set local file not found, using standard loading..."
		);
		return await loadJSONFile(JSON_CONFIGS.RELIC_SET);
	} catch (error) {
		console.error("[JSON] Error loading relic set data:", error);
		return null;
	}
}

/**
 * 专门用于加载光锥名称数据的函数，优先使用本地文件
 */
export async function loadLightConeNamesData(): Promise<any> {
	const manager = JSONManager.getInstance();

	try {
		// 首先检查本地文件
		if (existsSync(JSON_CONFIGS.LIGHT_CONE_NAMES.localPath)) {
			const localData = readFileSync(
				JSON_CONFIGS.LIGHT_CONE_NAMES.localPath,
				"utf-8"
			);
			const parsedData = JSON.parse(localData);
			manager.setCacheData(
				JSON_CONFIGS.LIGHT_CONE_NAMES.fileName,
				parsedData
			);
			return parsedData;
		}

		// 如果本地文件不存在，使用标准加载流程
		console.log(
			"[JSON] Light cone names local file not found, using standard loading..."
		);
		return await loadJSONFile(JSON_CONFIGS.LIGHT_CONE_NAMES);
	} catch (error) {
		console.error("[JSON] Error loading light cone names data:", error);
		return null;
	}
}

/**
 * 专门用于加载角色名称数据的函数，优先使用本地文件
 */
export async function loadCharacterNamesData(locale: string): Promise<any> {
	const manager = JSONManager.getInstance();

	// 根据语言选择对应的配置
	let config;
	switch (locale) {
		case "cn":
			config = JSON_CONFIGS.CHARACTER_NAMES_CN;
			break;
		case "en":
			config = JSON_CONFIGS.CHARACTER_NAMES_EN;
			break;
		case "cht":
		case "tw":
			config = JSON_CONFIGS.CHARACTER_NAMES_CHT;
			break;
		default:
			config = JSON_CONFIGS.CHARACTER_NAMES_EN; // 默认使用英文
	}

	try {
		// 首先检查本地文件
		if (existsSync(config.localPath)) {
			const localData = readFileSync(config.localPath, "utf-8");
			const parsedData = JSON.parse(localData);
			manager.setCacheData(config.fileName, parsedData);
			return parsedData;
		}

		// 如果本地文件不存在，使用标准加载流程
		console.log(
			`[JSON] Character names local file not found for ${locale}, using standard loading...`
		);
		return await loadJSONFile(config);
	} catch (error) {
		console.error(
			`[JSON] Error loading character names data for ${locale}:`,
			error
		);
		return null;
	}
}

/**
 * 专门用于加载命途数据的函数
 */
export async function loadPathsData(locale: string = "cht"): Promise<any> {
	const manager = JSONManager.getInstance();
	let config;
	switch (locale) {
		case "cn":
			config = JSON_CONFIGS.PATHS_CN;
			break;
		case "en":
			config = JSON_CONFIGS.PATHS_EN;
			break;
		case "cht":
		case "tw":
		default:
			config = JSON_CONFIGS.PATHS_CHT;
			break;
	}

	const data = await manager.loadJSON(config);
	if (data) {
		// 異步觸發圖標下載
		manager
			.downloadIconsFromData(data)
			.catch(err =>
				console.error("[JSON] Failed to download path icons:", err)
			);
	}
	return data;
}

/**
 * 专门用于加载属性数据的函数
 */
export async function loadElementsData(locale: string = "cht"): Promise<any> {
	const manager = JSONManager.getInstance();
	let config;
	switch (locale) {
		case "cn":
			config = JSON_CONFIGS.ELEMENTS_CN;
			break;
		case "en":
			config = JSON_CONFIGS.ELEMENTS_EN;
			break;
		case "cht":
		case "tw":
		default:
			config = JSON_CONFIGS.ELEMENTS_CHT;
			break;
	}

	const data = await manager.loadJSON(config);
	if (data) {
		// 異步觸發圖標下載
		manager
			.downloadIconsFromData(data)
			.catch(err =>
				console.error("[JSON] Failed to download element icons:", err)
			);
	}
	return data;
}

/**
 * 专门用于加载属性(property)数据的函数
 * @param locale 語言 (tw, cn, en)
 */
export async function loadPropertiesData(locale: string = "cht"): Promise<any> {
	const manager = JSONManager.getInstance();
	let config;
	switch (locale) {
		case "cn":
			config = JSON_CONFIGS.PROPERTIES_CN;
			break;
		case "en":
			config = JSON_CONFIGS.PROPERTIES_EN;
			break;
		case "cht":
		case "tw":
		default:
			config = JSON_CONFIGS.PROPERTIES_CHT;
			break;
	}

	const data = await manager.loadJSON(config);
	if (data) {
		// 異步觸發圖標下載
		manager
			.downloadIconsFromData(data)
			.catch(err =>
				console.error("[JSON] Failed to download property icons:", err)
			);
	}
	return data;
}

/**
 * 從 properties.json 建立 property_type (number) → property key (string) 的映射
 * 用於取代硬編碼的 propertyMap
 */
export async function buildPropertyMap(
	locale: string = "cht"
): Promise<Record<number, string>> {
	const propertiesData = await loadPropertiesData(locale);
	if (!propertiesData) return {};

	const map: Record<number, string> = {};
	// properties.json 的 key 就是 property 名稱（如 "CriticalChance"）
	// 它的 order 可以作為 number key
	for (const [key, value] of Object.entries(propertiesData)) {
		const prop = value as any;
		if (prop.order !== undefined) {
			map[prop.order] = key;
		}
	}
	return map;
}

/**
 * 從 paths.json 建立 base_type (number) → path text (string) 的映射
 * 用於取代硬編碼的 pathMap
 */
export async function buildPathMap(
	locale: string = "cht"
): Promise<Record<number, string>> {
	const pathsData = await loadPathsData(locale);
	if (!pathsData) return {};

	// paths.json 格式: { "Warrior": { id: "Warrior", text: "Destruction", ... }, ... }
	// base_type 數字映射: Warrior=1, Rogue=2, Mage=3, Shaman=4, Warlock=5, Knight=6, Priest=7, Memory=8, Elation=9
	const internalIdToBaseType: Record<string, number> = {
		Warrior: 1,
		Rogue: 2,
		Mage: 3,
		Shaman: 4,
		Warlock: 5,
		Knight: 6,
		Priest: 7,
		Memory: 8,
		Elation: 9
	};

	const map: Record<number, string> = {};
	for (const [internalId, data] of Object.entries(pathsData)) {
		const pathData = data as any;
		const baseType = internalIdToBaseType[internalId];
		if (baseType !== undefined) {
		// 使用 internalId lowercase 作為 value（與檔名一致，如 "Rogue" → "rogue"）
		// 注意：text 是顯示名稱（如 "The Hunt"），不能用於檔名
		const internalIdToFileName: Record<string, string> = {
			Warrior: "destruction",
			Rogue: "hunt",
			Mage: "erudition",
			Shaman: "harmony",
			Warlock: "nihility",
			Knight: "preservation",
			Priest: "abundance",
			Memory: "remembrance",
			Elation: "elation"
		};
		map[baseType] = internalIdToFileName[internalId] || internalId.toLowerCase();
		}
	}
	return map;
}

export function getJSONManager(): JSONManager {
	return JSONManager.getInstance();
}
