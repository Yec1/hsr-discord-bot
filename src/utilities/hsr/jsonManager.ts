import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import axios from "axios";

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

	private constructor() {}

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
			console.log(`[JSON] Using cached ${config.fileName}`);
			return this.cache.get(cacheKey);
		}

		try {
			// 首先尝试从本地加载
			if (existsSync(config.localPath)) {
				console.log(
					`[JSON] Loading ${config.fileName} from local: ${config.localPath}`
				);
				const localData = readFileSync(config.localPath, "utf-8");
				const parsedData = JSON.parse(localData);
				this.cache.set(cacheKey, parsedData);
				console.log(
					`[JSON] ✓ Successfully loaded ${config.fileName} from local`
				);
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
		}

		return null;
	}

	/**
	 * 从远程下载JSON文件
	 */
	private async downloadJSON(url: string): Promise<any> {
		try {
			const response = await axios.get(url, {
				timeout: 10000,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
				}
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
				console.log(`[JSON] Created directory: ${dir}`);
			}

			writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
			console.log(`[JSON] Saved file: ${filePath}`);
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
}

// 预定义的JSON文件配置
export const JSON_CONFIGS = {
	LIGHT_CONE_RANKS: {
		localPath: "./src/assets/light_cone_ranks.json",
		remoteUrl:
			"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/light_cone_ranks.json",
		fileName: "light_cone_ranks.json"
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
 */
export async function loadLightConeData(): Promise<any> {
	console.log("[JSON] Loading light cone data with local priority...");
	const manager = JSONManager.getInstance();

	try {
		// 首先检查本地文件
		if (existsSync(JSON_CONFIGS.LIGHT_CONE_RANKS.localPath)) {
			console.log("[JSON] Light cone local file found, loading...");
			const localData = readFileSync(
				JSON_CONFIGS.LIGHT_CONE_RANKS.localPath,
				"utf-8"
			);
			const parsedData = JSON.parse(localData);
			manager.setCacheData(
				JSON_CONFIGS.LIGHT_CONE_RANKS.fileName,
				parsedData
			);
			console.log(
				"[JSON] ✓ Light cone data loaded from local successfully"
			);
			return parsedData;
		}

		// 如果本地文件不存在，使用标准加载流程
		console.log(
			"[JSON] Light cone local file not found, using standard loading..."
		);
		return await loadJSONFile(JSON_CONFIGS.LIGHT_CONE_RANKS);
	} catch (error) {
		console.error("[JSON] Error loading light cone data:", error);
		return null;
	}
}

export function getJSONManager(): JSONManager {
	return JSONManager.getInstance();
}
