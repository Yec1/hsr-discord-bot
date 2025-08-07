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
			console.log(`[JSON] Using cached ${config.fileName}`);
			return this.cache.get(cacheKey);
		}

		// 防止重複加載
		if (this.isUpdating.has(cacheKey)) {
			console.log(
				`[JSON] ${config.fileName} is being loaded, waiting...`
			);
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
				console.log(
					`[JSON] Loading ${config.fileName} from local: ${config.localPath}`
				);
				const localData = readFileSync(config.localPath, "utf-8");
				const parsedData = JSON.parse(localData);
				this.cache.set(cacheKey, parsedData);
				this.lastUpdateTime.set(cacheKey, Date.now());
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

	/**
	 * 啟動定時檢查更新
	 */
	private startPeriodicUpdate(): void {
		// 每24小時檢查一次更新
		this.updateTimer = setInterval(async () => {
			console.log("[JSON] 開始定時檢查JSON文件更新...");
			await this.checkAllFilesUpdate();
		}, this.updateInterval);

		// 立即執行一次檢查
		setTimeout(async () => {
			console.log("[JSON] 首次檢查JSON文件更新...");
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
			console.log(
				`[JSON] ${config.fileName} 距離上次更新未滿24小時，跳過檢查`
			);
			return;
		}

		// 防止重複更新
		if (this.isUpdating.has(config.fileName)) {
			console.log(`[JSON] ${config.fileName} 正在更新中，跳過檢查`);
			return;
		}

		this.isUpdating.add(config.fileName);

		try {
			console.log(`[JSON] 檢查 ${config.fileName} 是否有更新...`);

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
				console.log(`[JSON] ${config.fileName} 已是最新版本`);
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
		console.log("[JSON] 手動觸發更新檢查...");
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
