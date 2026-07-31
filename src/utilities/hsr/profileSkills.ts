export interface ProfileSkillLike {
	type?: string;
	type_text?: string;
	remake?: string;
}

const VISIBLE_SKILL_TYPES = new Set([
	"normal",
	"bpskill",
	"talent",
	"ultra",
	"memospriteskill",
	"elationskill"
]);

const VISIBLE_SKILL_LABELS = new Set([
	"普攻",
	"普通攻擊",
	"普通攻击",
	"basic atk",
	"basic attack",
	"normal attack",
	"戰技",
	"战技",
	"skill",
	"天賦",
	"天赋",
	"talent",
	"大招",
	"終結技",
	"终结技",
	"ultimate",
	"憶靈技",
	"忆灵技",
	"memosprite skill",
	"歡愉技",
	"欢愉技",
	"elation skill"
]);

function normalizeSkillValue(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isVisibleProfileSkill(skill: ProfileSkillLike): boolean {
	// An explicit resource type is authoritative. This prevents MazeNormal from
	// sneaking through merely because its translated label says "Normal Attack".
	if (typeof skill.type === "string" && skill.type.trim())
		return VISIBLE_SKILL_TYPES.has(normalizeSkillValue(skill.type));

	return [skill.type_text, skill.remake]
		.filter((label): label is string => typeof label === "string")
		.some(label => VISIBLE_SKILL_LABELS.has(normalizeSkillValue(label)));
}

export function filterVisibleProfileSkills<T extends ProfileSkillLike>(skills: T[]): T[] {
	return skills.filter(isVisibleProfileSkill);
}
