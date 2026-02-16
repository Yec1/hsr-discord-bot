import axios from "axios";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { propertyMap } from "@/utilities/hsr/constants.js";

interface PropertyTranslate {
	[key: number]: string;
}

interface MainAffix {
	type?: number;
	property_type?: number;
	name?: string;
	value?: string;
	display?: string;
	icon?: string;
	weight?: number;
	propertyName?: string;
}

interface SubAffix {
	type?: number;
	property_type?: number;
	count?: number;
	times?: number;
	step?: number;
	name?: string;
	value?: string;
	display?: string;
	icon?: string;
	weight?: number;
	propertyName?: string;
}

interface Relic {
	main_affix?: MainAffix;
	main_property?: MainAffix;
	sub_affix?: SubAffix[];
	properties?: SubAffix[];
	level?: number;
	scoreN?: string;
	grade?: Grade;
}

interface Character {
	id: string;
	relics?: Relic[];
	ornaments?: Relic[];
}

interface Weights {
	main: { [key: string]: { [key: string]: number } };
	weight: { [key: string]: number };
	max?: number;
}

interface ScoreJson {
	[key: string]: Weights;
}

interface Grade {
	grade: string;
	color: string;
}

interface RelicsResult {
	totalScore: string;
	totalGrade: Grade;
	scoreType: string;
	[key: number]: Relic;
}

const propertyTranslate: PropertyTranslate = {
	12: "PhysicalAddedRatio",
	14: "FireAddedRatio",
	16: "IceAddedRatio",
	18: "ThunderAddedRatio",
	20: "WindAddedRatio",
	22: "QuantumAddedRatio",
	24: "ImaginaryAddedRatio",
	27: "HPDelta", // 小生命
	29: "AttackDelta", // 小攻击
	31: "DefenceDelta", // 小防御
	32: "HPAddedRatio", // 大生命
	33: "AttackAddedRatio", // 大攻击
	34: "DefenceAddedRatio", // 大防御
	51: "SpeedDelta",
	52: "CriticalChanceBase",
	53: "CriticalDamageBase",
	54: "SPRatioBase",
	55: "HealRatioBase",
	56: "StatusProbabilityBase",
	57: "StatusResistanceBase",
	59: "BreakDamageAddedRatioBase"
};

// 本地文件路徑配置
const LOCAL_SCORE_FILE_PATH = "./src/assets/data/score.json";
const REMOTE_SCORE_URL =
	"https://raw.githubusercontent.com/Mar-7th/StarRailScore/master/score.json";

// 緩存評分數據，避免重複網絡請求
let scoreJsonCache: ScoreJson | null = null;
let scoreJsonCacheTime = 0;
let lastUpdateTime = 0;
let updateTimer: NodeJS.Timeout | null = null;
const CACHE_DURATION = 3 * 60 * 1000; // 3分鐘緩存
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24小時更新間隔

// 啟動定時檢查更新
function startPeriodicUpdate(): void {
	// 每24小時檢查一次更新
	updateTimer = setInterval(async () => {
		await checkAndUpdateScoreData();
	}, UPDATE_INTERVAL);

	// 立即執行一次檢查（延遲5秒）
	setTimeout(async () => {
		await checkAndUpdateScoreData();
	}, 5000);
}

// 模塊加載時啟動定時更新
startPeriodicUpdate();

/**
 * 智能合併兩個分數數據對象，只更新新增或修改的部分
 */
function mergeScoreData(
	localData: ScoreJson,
	remoteData: ScoreJson
): ScoreJson {
	const mergedData = { ...localData };

	// 遍歷遠程數據，只添加新的角色或更新現有角色的新權重
	for (const [characterId, remoteWeights] of Object.entries(remoteData)) {
		if (!mergedData[characterId]) {
			// 新角色，直接添加
			mergedData[characterId] = remoteWeights;
			console.log(`[Relics] 添加新角色分數數據: ${characterId}`);
		} else {
			// 現有角色，檢查是否有新的權重需要更新
			const localWeights = mergedData[characterId];
			let hasUpdate = false;

			// 檢查主詞條權重
			if (remoteWeights.main) {
				if (!localWeights.main) {
					localWeights.main = remoteWeights.main;
					hasUpdate = true;
				} else {
					// 合併主詞條權重，保留本地修改
					for (const [slot, remoteSlotWeights] of Object.entries(
						remoteWeights.main
					)) {
						if (!localWeights.main[slot]) {
							localWeights.main[slot] = remoteSlotWeights;
							hasUpdate = true;
						} else {
							// 合併該槽位的權重
							for (const [property, weight] of Object.entries(
								remoteSlotWeights
							)) {
								if (!(property in localWeights.main[slot])) {
									localWeights.main[slot][property] = weight;
									hasUpdate = true;
								}
							}
						}
					}
				}
			}

			// 檢查副詞條權重
			if (remoteWeights.weight) {
				if (!localWeights.weight) {
					localWeights.weight = remoteWeights.weight;
					hasUpdate = true;
				} else {
					// 合併副詞條權重，保留本地修改
					for (const [property, weight] of Object.entries(
						remoteWeights.weight
					)) {
						if (!(property in localWeights.weight)) {
							localWeights.weight[property] = weight;
							hasUpdate = true;
						}
					}
				}
			}

			// 更新最大值（如果遠程數據有更新的話）
			if (
				remoteWeights.max !== undefined &&
				localWeights.max !== remoteWeights.max
			) {
				localWeights.max = remoteWeights.max;
				hasUpdate = true;
			}

			if (hasUpdate) {
				console.log(`[Relics] 更新角色分數數據: ${characterId}`);
			}
		}
	}

	return mergedData;
}

/**
 * 從遠程下載分數數據
 */
async function downloadScoreData(): Promise<ScoreJson | null> {
	try {
		const response = await axios.get(REMOTE_SCORE_URL, {
			timeout: 15000,
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
		console.warn(`[Relics] 下載遠程分數數據失敗:`, error);
		return null;
	}
}

/**
 * 保存分數數據到本地文件
 */
async function saveLocalScoreData(data: ScoreJson): Promise<void> {
	try {
		// 確保目錄存在
		const dir = join(LOCAL_SCORE_FILE_PATH, "..");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		writeFileSync(
			LOCAL_SCORE_FILE_PATH,
			JSON.stringify(data, null, 2),
			"utf-8"
		);
		console.log(
			`[Relics] ✓ 成功保存分數數據到本地: ${LOCAL_SCORE_FILE_PATH}`
		);
	} catch (error) {
		console.error(`[Relics] 保存本地分數數據失敗:`, error);
	}
}

/**
 * 檢查並更新分數數據
 */
async function checkAndUpdateScoreData(): Promise<void> {
	const now = Date.now();

	// 檢查是否需要更新（距離上次更新超過24小時）
	if (now - lastUpdateTime < UPDATE_INTERVAL) {
		return;
	}

	try {
		console.log("[Relics] 檢查分數數據更新...");

		// 下載遠程數據
		const remoteData = await downloadScoreData();
		if (!remoteData) {
			console.warn("[Relics] 無法下載遠程分數數據");
			return;
		}

		// 獲取本地數據
		let localData: ScoreJson | null = null;
		if (existsSync(LOCAL_SCORE_FILE_PATH)) {
			try {
				const localContent = readFileSync(
					LOCAL_SCORE_FILE_PATH,
					"utf-8"
				);
				localData = JSON.parse(localContent);
			} catch (error) {
				console.warn("[Relics] 讀取本地分數數據失敗:", error);
			}
		}

		// 智能合併數據
		const mergedData = localData
			? mergeScoreData(localData, remoteData)
			: remoteData;

		// 檢查是否有實際更新
		const hasUpdate =
			!localData ||
			JSON.stringify(mergedData) !== JSON.stringify(localData);

		if (hasUpdate) {
			// 保存合併後的數據
			await saveLocalScoreData(mergedData);

			// 更新緩存
			scoreJsonCache = mergedData;
			scoreJsonCacheTime = now;
			lastUpdateTime = now;

			console.log("[Relics] ✓ 分數數據更新完成");
		} else {
			lastUpdateTime = now;
			console.log("[Relics] 分數數據無需更新");
		}
	} catch (error) {
		console.error("[Relics] 檢查分數數據更新時發生錯誤:", error);
	}
}

async function getScoreJson(): Promise<ScoreJson | null> {
	const now = Date.now();

	// 如果緩存存在且未過期，直接返回
	if (scoreJsonCache && now - scoreJsonCacheTime < CACHE_DURATION) {
		return scoreJsonCache;
	}

	try {
		// 首先嘗試從本地加載
		if (existsSync(LOCAL_SCORE_FILE_PATH)) {
			const localData = readFileSync(LOCAL_SCORE_FILE_PATH, "utf-8");
			const parsedData = JSON.parse(localData);
			scoreJsonCache = parsedData;
			scoreJsonCacheTime = now;
			console.log("[Relics] 從本地文件加載分數數據");
			return parsedData;
		}

		// 如果本地文件不存在，從遠程下載
		console.log("[Relics] 本地分數文件不存在，正在下載...");
		const remoteData = await downloadScoreData();

		if (remoteData) {
			// 保存到本地
			await saveLocalScoreData(remoteData);
			scoreJsonCache = remoteData;
			scoreJsonCacheTime = now;
			lastUpdateTime = now;
			console.log("[Relics] ✓ 成功下載並保存分數數據到本地");
			return remoteData;
		} else {
			console.warn("[Relics] 下載遠程分數數據失敗");
		}
	} catch (error) {
		console.error("[Relics] 加載分數數據時發生錯誤:", error);

		// 如果是本地文件解析錯誤，嘗試刪除損壞的文件並重新下載
		if (existsSync(LOCAL_SCORE_FILE_PATH) && error instanceof SyntaxError) {
			console.log("[Relics] 本地分數文件損壞，嘗試重新下載...");
			try {
				// 刪除損壞的文件
				const fs = await import("fs");
				fs.unlinkSync(LOCAL_SCORE_FILE_PATH);
				console.log(
					`[Relics] 已刪除損壞的本地文件: ${LOCAL_SCORE_FILE_PATH}`
				);

				// 重新嘗試下載
				const remoteData = await downloadScoreData();
				if (remoteData) {
					await saveLocalScoreData(remoteData);
					scoreJsonCache = remoteData;
					scoreJsonCacheTime = now;
					lastUpdateTime = now;
					console.log("[Relics] ✓ 成功重新下載並保存分數數據");
					return remoteData;
				}
			} catch (retryError) {
				console.error("[Relics] 重新下載分數數據失敗:", retryError);
			}
		}
	}

	// 如果網絡請求失敗但有緩存，返回緩存數據
	if (scoreJsonCache) {
		return scoreJsonCache;
	}

	return null;
}

async function getRelicsScore(
	character: Character,
	scoreType: string = "SRS-N"
): Promise<RelicsResult | null> {
	const scoreJson = await getScoreJson();
	if (!scoreJson) return null;
	const charScore = scoreJson[character.id];
	if (!charScore) return null;

	let totalScoreN = 0;
	let validRelicCount = 0;

	// 初始化長度為 6 的空陣列，對應 6 個槽位
	const allRelics: (Relic | null)[] = [null, null, null, null, null, null];

	// 映射遺器 (Head=1, Hand=2, Body=3, Feet=4) -> index 0-3
	(character.relics || []).forEach(relic => {
		const pos = (relic as any).pos || (relic as any).type;
		if (typeof pos === "number" && pos >= 1 && pos <= 4) {
			allRelics[pos - 1] = relic;
		} else if (typeof pos === "string") {
			const map: Record<string, number> = {
				HEAD: 0,
				HAND: 1,
				BODY: 2,
				FOOT: 3
			};
			const p = pos.toUpperCase();
			if (map[p] !== undefined) allRelics[map[p]] = relic;
		}
	});

	// 映射飾品 (Object=1/5, Neck=2/6) -> index 4-5
	// 注意：飾品的 pos 通常是 1(位面球) 和 2(連結繩)，對應 index 4 和 5
	// 但有時也會是 5(位面球) 和 6(連結繩)
	(character.ornaments || []).forEach(ornament => {
		const pos = (ornament as any).pos || (ornament as any).type;
		if (typeof pos === "number") {
			if (pos >= 1 && pos <= 2) {
				allRelics[pos + 3] = ornament;
			} else if (pos === 5 || pos === 6) {
				allRelics[pos - 1] = ornament;
			}
		} else if (typeof pos === "string") {
			const map: Record<string, number> = {
				OBJECT: 4,
				NECK: 5,
				PLANAR_SPHERE: 4,
				LINK_ROPE: 5
			};
			const p = pos.toUpperCase();
			if (map[p] !== undefined) allRelics[map[p]] = ornament;
		}
	});

	for (let i = 0; i < allRelics.length; i++) {
		const relic = allRelics[i];
		// 如果該槽位沒有聖遺物，跳過評分
		if (!relic) continue;

		// i+1 對應權重表中的槽位編號 (1-6)
		const mainScore = calculateMainAffixScore(relic, charScore, i + 1);
		const subScore = calculateSubScore(relic, charScore);

		// SRS-N: 主词条归一化得分 * 40% + 副词条归一化得分 * 60%
		let relicScoreN = mainScore * 0.4 + subScore * 0.6;

		// SRS-M: 对 SRS-N 得分取平方根
		if (scoreType === "SRS-M") {
			relicScoreN = Math.sqrt(relicScoreN);
		}

		totalScoreN += parseFloat(relicScoreN.toString());
		relic.scoreN = (relicScoreN * 100).toFixed(1);
		relic.grade = calculateGrade(relic.scoreN);
		validRelicCount++;
	}

	// 計算總評級：總分 / 有效聖遺物數量 (避免除以 0)
	// 或者您可以選擇除以 6 (如果是要求滿裝備的評分標準)
	// 這裡我們維持平均分邏輯
	const averageScore =
		validRelicCount > 0
			? ((totalScoreN * 100) / validRelicCount).toFixed(1)
			: "0.0";
	const totalGrade = calculateGrade(averageScore);

	// 返回結果
	const result: any = allRelics;
	result.totalScore = averageScore;
	result.totalGrade = totalGrade;
	result.scoreType = scoreType;

	return result;
}

function calculateMainAffixScore(
	relic: Relic,
	weights: Weights,
	index: number
): number {
	const mainAffix = relic.main_affix || relic.main_property;
	if (!mainAffix) return 0;

	const affixType = mainAffix.type || mainAffix.property_type;
	const calAffixType = propertyTranslate[affixType!] || affixType;
	const weight = weights.main[index.toString()]?.[calAffixType!] || 0;
	const level = Number(relic.level) || 0;

	// SRS 评分：主词条归一化得分 = (等级+1)/16 * 权重
	// 0 级到 15 级分别对应基础分 1/16 到 16/16
	const score = ((level + 1) / 16) * weight;

	// 为了兼容性，将计算出的权重添加到 mainAffix 对象
	mainAffix.weight = weight;

	// 如果从对象没有 main_affix，创建它以兼容旧结构
	if (!relic.main_affix) {
		relic.main_affix = {
			...mainAffix,
			type: affixType as any,
			// 仅显示添加必要的字段
			name: mainAffix.name || "",
			propertyName: propertyMap[affixType!] || "",
			display: mainAffix.value || mainAffix.display || "0",
			icon:
				mainAffix.icon?.replace(/^Icon/, "icon") ||
				`icon/property/icon${propertyMap[affixType!]}.png`
		};
	}

	return score;
}

function calculateSubScore(relic: Relic, weights: Weights): number {
	const subAffixes = relic.sub_affix || relic.properties || [];

	// SRS 评分：副词条归一化得分计算
	// 单项得分 = Σ(基础次数 + 强化次数 * 0.1) * 权重
	let rawScore = subAffixes.reduce((subScore: number, sub: SubAffix) => {
		const count = Number(sub.count || sub.times || 0);

		let step = 0;
		if (sub.step !== undefined) step = Number(sub.step || 0);
		else step = Math.max(0, count - 1);

		const subType = sub.type || sub.property_type;
		const calSubType = propertyTranslate[subType!] || subType;
		const subWeight = weights.weight[calSubType!] || 0;

		sub.weight = subWeight;

		if (!relic.sub_affix) {
			relic.sub_affix = [];
		}
		const existingSub = relic.sub_affix.find(s => s.type === subType);
		if (!existingSub) {
			relic.sub_affix.push({
				...sub,
				type: subType as any,
				count: count,
				step: step, // 添加step字段以供后续使用
				name: sub.name || "",
				propertyName: propertyMap[subType!] || "",
				display: sub.value || sub.display || "0",
				icon:
					sub.icon?.replace(/^Icon/, "icon") ||
					`icon/property/icon${propertyMap[subType!]}.png`
			});
		}

		// 基础次数 + 强化次数 * 0.1
		return subScore + (count + step * 0.1) * subWeight;
	}, 0);

	// 归一化得分 = 原始得分 / max
	return rawScore / (weights.max || 1);
}

const grades: { [key: string]: { threshold: number; color: string } } = {
	D: { threshold: 0, color: "#9DB2BF" },
	C: { threshold: 40, color: "#9DB2BF" },
	B: { threshold: 50, color: "#78C1F3" },
	A: { threshold: 60, color: "#525FE1" },
	S: { threshold: 70, color: "#F29727" },
	SS: { threshold: 80, color: "#F29727" },
	SSS: { threshold: 85, color: "#F24C3D" },
	ACE: { threshold: 90, color: "#F24C3D" }
};
const sortedGrades = Object.keys(grades).sort(
	(a, b) => (grades[a]?.threshold || 0) - (grades[b]?.threshold || 0)
);

function calculateGrade(score: string): Grade {
	let grade = "D";

	for (let i = 0; i < sortedGrades.length; i++) {
		const current = sortedGrades[i];
		if (current && parseFloat(score) >= (grades[current]?.threshold || 0))
			grade = current;
		else continue;
	}

	return { grade: grade, color: grades[grade]?.color || "#9DB2BF" };
}

/**
 * 手動觸發更新檢查
 */
export async function forceUpdateCheck(): Promise<void> {
	await checkAndUpdateScoreData();
}

/**
 * 獲取最後更新時間
 */
export function getLastUpdateTime(): number {
	return lastUpdateTime;
}

/**
 * 清理資源
 */
export function destroy(): void {
	if (updateTimer) {
		clearInterval(updateTimer);
		updateTimer = null;
	}
	scoreJsonCache = null;
	scoreJsonCacheTime = 0;
	lastUpdateTime = 0;
}

export { getRelicsScore };
