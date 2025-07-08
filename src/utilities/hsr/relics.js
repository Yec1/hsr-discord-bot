import axios from "axios";
import { propertyMap } from "./constants.js";
// import { lazy } from "discord.js";

// this lazy() can be changed to getting the scores on web, etc
// as long it is a function
// import scoreJson from "../assets/score.json" assert { type: "json" };

const propertyTranslate = {
	12: "PhysicalAddedRatio",
	14: "FireAddedRatio",
	16: "IceAddedRatio",
	18: "ThunderAddedRatio",
	20: "WindAddedRatio",
	22: "QuantumAddedRatio",
	24: "ImaginaryAddedRatio",
	27: "HPDelta", // 小生命
	29: "AttackDelta", // 小攻擊
	31: "DefenceDelta", // 小防禦
	32: "HPAddedRatio", // 大生命
	33: "AttackAddedRatio", // 大攻擊
	34: "DefenceAddedRatio", // 大防禦
	51: "SpeedDelta",
	52: "CriticalChanceBase",
	53: "CriticalDamageBase",
	54: "SPRatioBase",
	55: "HealRatioBase",
	56: "StatusProbabilityBase",
	57: "StatusResistanceBase",
	59: "BreakDamageAddedRatioBase"
};

async function getRelicsScore(character, scoreType = "SRS-N") {
	const responses = await axios.get(
		"https://raw.githubusercontent.com/Mar-7th/StarRailScore/master/score.json"
	);
	const scoreJson = responses.data;
	const charScore = scoreJson[character.id];
	if (!charScore) return null;

	let totalScoreN = 0;

	// 合併 relics 和 ornaments
	const allRelics = [
		...(character.relics || []),
		...(character.ornaments || [])
	];

	for (let i = 0; i < allRelics.length; i++) {
		const relic = allRelics[i];
		const mainScore = calculateMainAffixScore(relic, charScore, i + 1);
		const subScore = calculateSubScore(relic, charScore);

		// SRS-N: 主词条和副词条各占 50% 的分数
		let relicScoreN = mainScore * 0.5 + subScore * 0.5;

		// SRS-M: 将 SRS-N 的结果开平方根
		if (scoreType === "SRS-M") {
			relicScoreN = Math.sqrt(relicScoreN);
		}

		totalScoreN += parseFloat(relicScoreN);
		relic.scoreN = (relicScoreN * 100).toFixed(1);
		relic.grade = calculateGrade(relic.scoreN);
	}

	const totalGrade = calculateGrade(
		((totalScoreN * 100) / allRelics.length).toFixed(1)
	);

	// 將計算結果存儲到 character 對象中
	character.relics = allRelics;
	character.relics.totalScore = (totalScoreN * 100).toFixed(1);
	character.relics.totalGrade = totalGrade;
	character.relics.scoreType = scoreType;

	return character.relics;
}

function calculateMainAffixScore(relic, weights, index) {
	const mainAffix = relic.main_affix || relic.main_property;
	if (!mainAffix) return 0;

	const affixType = mainAffix.type || mainAffix.property_type;
	const calAffixType = propertyTranslate[affixType] || affixType;
	const weight = weights.main[index.toString()][calAffixType] || 0;
	const level = Number(relic.level) || 0;

	// SRS 标准：主词条归一化得分 = (等级+1)/16 * 权重
	// 0 级到 15 级分别对应基础值 1/16 到 16/16
	const score = ((level + 1) / 16) * weight;

	// 為兼容性，將計算結果添加到 mainAffix 對象
	mainAffix.weight = weight;

	// 如果原始對象沒有 main_affix，創建一個兼容的結構
	if (!relic.main_affix) {
		relic.main_affix = {
			...mainAffix,
			type: affixType,
			// 為顯示添加必要的字段
			name: mainAffix.name,
			propertyName: propertyMap[affixType],
			display: mainAffix.value || mainAffix.display || "0",
			icon:
				mainAffix.icon ||
				`icon/property/icon${propertyMap[affixType]}.png`
		};
	}

	return score;
}

function calculateSubScore(relic, weights) {
	const subAffixes = relic.sub_affix || relic.properties || [];

	// SRS 标准：副词条归一化得分计算
	// 原始得分 = Σ(基础值次数 + 提升值次数 * 0.1) * 权重
	let rawScore = subAffixes.reduce((subScore, sub) => {
		const count = Number(sub.count || sub.times - 1 || 0);
		const step = Number(sub.step || 0);

		const subType = sub.type || sub.property_type;
		const calSubType = propertyTranslate[subType] || subType;
		const subWeight = weights.weight[calSubType] || 0;

		sub.weight = subWeight;

		if (!relic.sub_affix) {
			relic.sub_affix = [];
		}
		const existingSub = relic.sub_affix.find(s => s.type === subType);
		if (!existingSub) {
			relic.sub_affix.push({
				...sub,
				type: subType,
				count: count,
				name: sub.name,
				propertyName: propertyMap[subType],
				display: sub.value || sub.display || "0",
				icon:
					sub.icon || `icon/property/icon${propertyMap[subType]}.png`
			});
		}

		// 基础值次数 + 提升值次数 * 0.1
		return subScore + (count + step * 0.1) * subWeight;
	}, 0);

	// 归一化得分 = 原始得分 / max
	return rawScore / (weights.max || 1);
}

const grades = {
	D: { threshold: 0, color: "#9DB2BF" },
	C: { threshold: 30, color: "#9DB2BF" },
	B: { threshold: 45, color: "#78C1F3" },
	A: { threshold: 55, color: "#525FE1" },
	S: { threshold: 65, color: "#F29727" },
	SS: { threshold: 75, color: "#F29727" },
	SSS: { threshold: 80, color: "#F24C3D" },
	ACE: { threshold: 85, color: "#F24C3D" }
};
const sortedGrades = Object.keys(grades).sort(
	(a, b) => grades[a].threshold - grades[b].threshold
);

function calculateGrade(score) {
	let grade = "D";

	for (let i = 0; i < sortedGrades.length; i++) {
		const current = sortedGrades[i];
		if (score >= grades[current].threshold) grade = current;
		else continue;
	}

	return { grade: grade, color: grades[grade].color };
}

export { getRelicsScore };
