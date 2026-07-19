export interface ProfileSkillLike {
	type?: string;
	type_text?: string;
	remake?: string;
}

const HIDDEN_SKILL_TYPES = new Set(["Maze", "MazeNormal", "Technique"]);
const HIDDEN_SKILL_LABELS = new Set(["秘技", "秘技攻擊", "technique"]);

export function isVisibleProfileSkill(skill: ProfileSkillLike): boolean {
	if (skill.type && HIDDEN_SKILL_TYPES.has(skill.type)) return false;

	return ![skill.type_text, skill.remake]
		.filter((label): label is string => typeof label === "string")
		.some(label => HIDDEN_SKILL_LABELS.has(label.trim().toLowerCase()));
}

export function filterVisibleProfileSkills<T extends ProfileSkillLike>(skills: T[]): T[] {
	return skills.filter(isVisibleProfileSkill);
}
