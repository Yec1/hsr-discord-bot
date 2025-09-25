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

// 预定义的JSON文件配置
export const JSON_CONFIGS = {
	LIGHT_CONE_RANKS: {
		localPath: "./src/assets/light_cone_ranks.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/light_cone_ranks.json",
		fileName: "light_cone_ranks.json"
	},
	LIGHT_CONE_RANKS_CN: {
		localPath: "./src/assets/light_cone_ranks_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/light_cone_ranks.json",
		fileName: "light_cone_ranks_cn.json"
	},
	LIGHT_CONE_RANKS_EN: {
		localPath: "./src/assets/light_cone_ranks_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/light_cone_ranks.json",
		fileName: "light_cone_ranks_en.json"
	},
	LIGHT_CONE_NAMES: {
		localPath: "./src/assets/lightcone.json",
		remoteUrl: "https://api.hakush.in/hsr/data/lightcone.json",
		fileName: "lightcone.json"
	},
	CHARACTER_NAMES_CN: {
		localPath: "./src/assets/characters_cn.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/characters.json",
		fileName: "characters_cn.json"
	},
	CHARACTER_NAMES_EN: {
		localPath: "./src/assets/characters_en.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/characters.json",
		fileName: "characters_en.json"
	},
	CHARACTER_NAMES_CHT: {
		localPath: "./src/assets/characters_cht.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/characters.json",
		fileName: "characters_cht.json"
	},
	RELIC_SET: {
		localPath: "./src/assets/relicset.json",
		remoteUrl: "https://api.hakush.in/hsr/data/relicset.json",
		fileName: "relicset.json"
	},
	BANNERS: {
		localPath: "./src/assets/banners.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/banners.json",
		fileName: "banners.json"
	},
	CHAR: {
		localPath: "./src/assets/char.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/char.json",
		fileName: "char.json"
	},
	WEAPONS: {
		localPath: "./src/assets/weapons.json",
		remoteUrl:
			"https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/weapons.json",
		fileName: "weapons.json"
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

export function getJSONManager(): JSONManager {
	return JSONManager.getInstance();
}
