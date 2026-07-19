import axios from "axios";
import { database } from "@/index.js";

interface CacheData {
	codes: any[];
	timestamp: number;
}

export interface CacheStatus {
	exists: boolean;
	isExpired?: boolean;
	remainingHours?: number;
	codesCount?: number;
	lastUpdated?: string;
	message: string;
}

const CACHE_KEY = "redeemCodesCache";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export async function getRedeemCodes(): Promise<any[]> {
	const cachedData: CacheData | null = await database.get(CACHE_KEY);
	const currentTime = Date.now();

	if (cachedData && currentTime - cachedData.timestamp < CACHE_TTL_MS) {
		const remainingTime = Math.floor(
			(CACHE_TTL_MS - (currentTime - cachedData.timestamp)) /
				(1000 * 60 * 60)
		);
		console.log(`[快取] 使用快取的兌換碼數據，剩餘 ${remainingTime} 小時`);
		return cachedData.codes;
	}

	console.log("[快取] 快取已過期或不存在，重新獲取兌換碼數據...");
	try {
		const { data } = await axios.get(
			"https://hoyo-codes.seria.moe/codes?game=hkrpg"
		);
		await database.set(CACHE_KEY, {
			codes: data.codes,
			timestamp: currentTime
		});
		console.log(`[快取] 成功獲取並快取 ${data.codes.length} 個兌換碼`);
		return data.codes;
	} catch (error: any) {
		console.error("[快取] API請求失敗:", error.message);
		if (cachedData) {
			console.log("[快取] 使用過期的快取數據作為備用");
			return cachedData.codes;
		}
		throw error;
	}
}

export async function clearRedeemCodesCache(): Promise<void> {
	await database.delete(CACHE_KEY);
	console.log("[快取] 兌換碼快取已清除");
}

export async function getRedeemCodesCacheStatus(): Promise<CacheStatus> {
	const cachedData: CacheData | null = await database.get(CACHE_KEY);
	const currentTime = Date.now();
	if (!cachedData) return { exists: false, message: "快取不存在" };

	const timeDiff = currentTime - cachedData.timestamp;
	const isExpired = timeDiff >= CACHE_TTL_MS;
	const remainingHours = Math.floor(
		(CACHE_TTL_MS - timeDiff) / (1000 * 60 * 60)
	);

	return {
		exists: true,
		isExpired,
		remainingHours: isExpired ? 0 : remainingHours,
		codesCount: cachedData.codes.length,
		lastUpdated: new Date(cachedData.timestamp).toLocaleString("zh-TW"),
		message: isExpired
			? "快取已過期"
			: `快取有效，剩餘 ${remainingHours} 小時，包含 ${cachedData.codes.length} 個兌換碼`
	};
}
