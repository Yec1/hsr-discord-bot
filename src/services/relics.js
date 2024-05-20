import axios from "axios";
// import { lazy } from "discord.js";

// this lazy() can be changed to getting the scores on web, etc
// as long it is a function
// import scoreJson from "../assets/score.json" assert { type: "json" };

async function getRelicsScore(character) {
	const responses = await axios.get(
		"https://raw.githubusercontent.com/Mar-7th/StarRailScore/master/score.json"
	);
	const scoreJson = responses.data;
	const charScore = scoreJson[character.id];

	let totalScoreN = 0;

	for (let i = 0; i < character.relics.length; i++) {
		const relic = character.relics[i];
		const mainScore = calculateMainAffixScore(relic, charScore, i + 1);
		const subScore = calculateSubScore(relic, charScore);

		const relicScoreN = mainScore * 0.4 + subScore * 0.6;
		totalScoreN += parseFloat(relicScoreN);
		relic.scoreN = (relicScoreN * 100).toFixed(1);
		relic.grade = calculateGrade(relic.scoreN);
	}
	const totalGrade = calculateGrade(
		((totalScoreN * 100) / character.relics.length).toFixed(1)
	);
	character.relics.totalScore = (totalScoreN * 100).toFixed(1);
	character.relics.totalGrade = totalGrade;
	return character.relics;
}

function calculateMainAffixScore(relic, weights, index) {
	const { main_affix: mainAffix } = relic;
	const weight = weights.main[index.toString()][mainAffix.type] || 0;
	const level = Number(relic.level) || 0;
	const score = ((level + 1) / 16) * weight;
	mainAffix.weight = weight;
	return score;
}

function calculateSubScore(relic, weights) {
	return (
		relic.sub_affix.reduce((subScore, sub) => {
			const count = Number(sub.count) || 0;
			const step = Number(sub.step) || 0;
			const subWeight = weights.weight[sub.type] || 0;
			sub.weight = subWeight;
			return subScore + (count + step * 0.1) * subWeight;
		}, 0) / (weights.max || 1)
	);
}

const grades = {
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
