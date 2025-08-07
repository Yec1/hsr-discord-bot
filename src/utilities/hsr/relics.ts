import axios from "axios";
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
	27: "HPDelta", // 小�???
	29: "AttackDelta", // 小攻??
	31: "DefenceDelta", // 小防�?
	32: "HPAddedRatio", // 大�???
	33: "AttackAddedRatio", // 大攻??
	34: "DefenceAddedRatio", // 大防�?
	51: "SpeedDelta",
	52: "CriticalChanceBase",
	53: "CriticalDamageBase",
	54: "SPRatioBase",
	55: "HealRatioBase",
	56: "StatusProbabilityBase",
	57: "StatusResistanceBase",
	59: "BreakDamageAddedRatioBase"
};

// 緩存評分數據，避免重複網絡請求
let scoreJsonCache: ScoreJson | null = null;
let scoreJsonCacheTime = 0;
const CACHE_DURATION = 3 * 60 * 1000; // 5分鐘緩存

async function getScoreJson(): Promise<ScoreJson | null> {
	const now = Date.now();

	// 如果緩存存在且未過期，直接返回
	if (scoreJsonCache && now - scoreJsonCacheTime < CACHE_DURATION) {
		return scoreJsonCache;
	}

	try {
		const response = await axios.get(
			"https://raw.githubusercontent.com/Mar-7th/StarRailScore/master/score.json"
		);
		scoreJsonCache = response.data;
		scoreJsonCacheTime = now;
		return scoreJsonCache;
	} catch (error) {
		console.error("[Relics] Error fetching score data:", error);
		// 如果網絡請求失敗但有緩存，返回緩存數據
		if (scoreJsonCache) {
			return scoreJsonCache;
		}
		return null;
	}
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

	// ?�併 relics ??ornaments
	const allRelics: Relic[] = [
		...(character.relics || []),
		...(character.ornaments || [])
	];

	for (let i = 0; i < allRelics.length; i++) {
		const relic = allRelics[i];
		if (!relic) continue;
		const mainScore = calculateMainAffixScore(relic, charScore, i + 1);
		const subScore = calculateSubScore(relic, charScore);

		// SRS-N: 主�??��??��??��???50% ?��???
		let relicScoreN = mainScore * 0.4 + subScore * 0.6;

		// SRS-M: �?SRS-N ?��??��?平方??
		if (scoreType === "SRS-M") {
			relicScoreN = Math.sqrt(relicScoreN);
		}

		totalScoreN += parseFloat(relicScoreN.toString());
		relic.scoreN = (relicScoreN * 100).toFixed(1);
		relic.grade = calculateGrade(relic.scoreN);
	}

	const totalGrade = calculateGrade(
		((totalScoreN * 100) / allRelics.length).toFixed(1)
	);

	// 將�?算�??��??�到 character 對象�?
	character.relics = allRelics;
	(character.relics as any).totalScore = (totalScoreN * 100).toFixed(1);
	(character.relics as any).totalGrade = totalGrade;
	(character.relics as any).scoreType = scoreType;

	return character.relics as any;
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

	// SRS ?��?：主词条归�??��???= (等级+1)/16 * ?��?
	// 0 级到 15 级�??�对应基础??1/16 ??16/16
	const score = ((level + 1) / 16) * weight;

	// ?�兼容性�?將�?算�??�添?�到 mainAffix 對象
	mainAffix.weight = weight;

	// 如�??��?對象沒�? main_affix，創建�??�兼容�?結�?
	if (!relic.main_affix) {
		relic.main_affix = {
			...mainAffix,
			type: affixType as any,
			// ?�顯示添?��?要�?字段
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

	// SRS ?��?：副词条归�??��??�计�?
	// ?��?得�? = Σ(?��??�次??+ ?��??�次??* 0.1) * ?��?
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
				step: step, // 添�?step字段以�??��??��?
				name: sub.name || "",
				propertyName: propertyMap[subType!] || "",
				display: sub.value || sub.display || "0",
				icon:
					sub.icon?.replace(/^Icon/, "icon") ||
					`icon/property/icon${propertyMap[subType!]}.png`
			});
		}

		// ?��??�次??+ ?��??�次??* 0.1
		return subScore + (count + step * 0.1) * subWeight;
	}, 0);

	// 归�??��???= ?��?得�? / max
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

export { getRelicsScore };
