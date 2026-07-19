import type { EnkaAvatarDetail, EnkaFlatProperty, EnkaHsrResponse, EnkaRelic } from "@/types/enkaHsr.js";
import type { PlayerData, ProfileAttribute, ProfileCharacter, ProfileRelic, ProfileSkill } from "@/types/hsrProfile.js";
import type { StarRailResBundle } from "./starRailRes.js";
import { isVisibleProfileSkill } from "./profileSkills.js";

const PROPERTY_TYPE: Record<string, number> = {
	PhysicalAddedRatio: 12, FireAddedRatio: 14, IceAddedRatio: 16, ThunderAddedRatio: 18,
	WindAddedRatio: 20, QuantumAddedRatio: 22, ImaginaryAddedRatio: 24,
	HPDelta: 27, AttackDelta: 29, DefenceDelta: 31, HPAddedRatio: 32,
	AttackAddedRatio: 33, DefenceAddedRatio: 34, SpeedDelta: 51,
	CriticalChanceBase: 52, CriticalDamageBase: 53, SPRatioBase: 54,
	HealRatioBase: 55, StatusProbabilityBase: 56, StatusResistanceBase: 57,
	BreakDamageAddedRatioBase: 59
};

const TYPE_ALIASES: Record<string, string> = {
	CriticalChance: "CriticalChanceBase",
	CriticalDamage: "CriticalDamageBase",
	BreakDamageAddedRatio: "BreakDamageAddedRatioBase",
	StatusResistance: "StatusResistanceBase",
	StatusProbability: "StatusProbabilityBase"
};

const BASE_PROP_FIELDS: Record<string, string> = {
	BaseHP: "hp", BaseAttack: "atk", BaseDefence: "def", BaseSpeed: "spd"
};
const FLAT_PROP_FIELDS: Record<string, string> = {
	HPDelta: "hp", AttackDelta: "atk", DefenceDelta: "def", SpeedDelta: "spd"
};
const RATIO_PROP_FIELDS: Record<string, string> = {
	HPAddedRatio: "hp", AttackAddedRatio: "atk", DefenceAddedRatio: "def", SpeedAddedRatio: "spd"
};
const DIRECT_PROP_FIELDS: Record<string, string> = {
	CriticalChanceBase: "crit_rate", CriticalDamageBase: "crit_dmg", SPRatioBase: "energy_recovery",
	HealRatioBase: "heal_ratio", StatusProbabilityBase: "status_prob", StatusResistanceBase: "status_res",
	BreakDamageAddedRatioBase: "break_dmg", PhysicalAddedRatio: "physical_dmg",
	FireAddedRatio: "fire_dmg", IceAddedRatio: "ice_dmg", ThunderAddedRatio: "lightning_dmg",
	WindAddedRatio: "wind_dmg", QuantumAddedRatio: "quantum_dmg", ImaginaryAddedRatio: "imaginary_dmg"
};
const RESOURCE_FIELDS: Record<string, string> = {
	energy_recovery: "sp_rate",
	status_res: "effect_res",
	heal_ratio: "heal_rate",
	status_prob: "effect_hit"
};
const SKILL_TYPE_LABELS: Record<string, string> = {
	Normal: "普通攻擊",
	BPSkill: "戰技",
	Ultra: "終結技",
	Talent: "天賦",
	MazeNormal: "普通攻擊",
	Maze: "秘技"
};

function normalizedType(type: string): string {
	return TYPE_ALIASES[type] ?? type;
}

function formatValue(value: number, percent: boolean): string {
	return percent ? `${(value * 100).toFixed(1)}%` : `${Math.round(value * 10) / 10}`;
}

function propertyMeta(resources: StarRailResBundle, rawType: string): any {
	const type = normalizedType(rawType);
	return resources.properties[type] ?? resources.properties[rawType] ?? {
		type, name: type, field: DIRECT_PROP_FIELDS[type] ?? FLAT_PROP_FIELDS[type] ?? type,
		percent: Boolean(DIRECT_PROP_FIELDS[type] && !FLAT_PROP_FIELDS[type]), icon: ""
	};
}

function mapRelic(raw: EnkaRelic, resources: StarRailResBundle): ProfileRelic {
	const id = String(raw.tid);
	const meta = resources.relics[id] ?? {};
	const props = raw._flat?.props ?? [];
	const mainRaw = props[0] ?? { type: "HPDelta", value: 0 };
	const mainType = normalizedType(mainRaw.type);
	const mainMeta = propertyMeta(resources, mainType);
	const mainDisplay = formatValue(mainRaw.value, Boolean(mainMeta.percent));
	const subAffix = (raw.subAffixList ?? []).map((affix, index) => {
		const valueRaw = props[index + 1] ?? { type: String(affix.affixId), value: 0 };
		const type = normalizedType(valueRaw.type);
		const prop = propertyMeta(resources, type);
		return {
			type,
			name: prop.name ?? type,
			display: formatValue(valueRaw.value, Boolean(prop.percent)),
			value: String(valueRaw.value),
			weight: 0,
			icon: prop.icon ?? "",
			property_type: PROPERTY_TYPE[type] ?? 0,
			propertyName: type,
			count: affix.cnt,
			times: affix.step ?? 0,
			step: affix.step ?? 0
		};
	});
	return {
		id,
		type: raw.type,
		name: meta.name ?? id,
		level: raw.level,
		rarity: meta.rarity ?? 5,
		icon: meta.icon ?? `icon/relic/${id}.png`,
		main_affix: {
			name: mainMeta.name ?? mainType,
			display: mainDisplay,
			value: String(mainRaw.value),
			weight: 0,
			icon: mainMeta.icon ?? "",
			propertyName: mainType,
			property_type: PROPERTY_TYPE[mainType] ?? 0,
			count: 1,
			times: 1,
			step: 0
		},
		main_property: { property_type: PROPERTY_TYPE[mainType] ?? 0, value: String(mainRaw.value) },
		sub_affix: subAffix,
		properties: subAffix
	};
}

interface StatBuckets {
	base: Record<string, number>;
	flat: Record<string, number>;
	ratio: Record<string, number>;
	direct: Record<string, number>;
}

function addProperty(stats: StatBuckets, raw: EnkaFlatProperty): void {
	const type = normalizedType(raw.type);
	const base = BASE_PROP_FIELDS[type];
	const flat = FLAT_PROP_FIELDS[type];
	const ratio = RATIO_PROP_FIELDS[type];
	const direct = DIRECT_PROP_FIELDS[type];
	if (base) stats.base[base] = (stats.base[base] ?? 0) + raw.value;
	else if (flat) stats.flat[flat] = (stats.flat[flat] ?? 0) + raw.value;
	else if (ratio) stats.ratio[ratio] = (stats.ratio[ratio] ?? 0) + raw.value;
	else if (direct) stats.direct[direct] = (stats.direct[direct] ?? 0) + raw.value;
}

function promotionProps(meta: any, promotion: number, level: number): EnkaFlatProperty[] {
	const values = meta?.values?.[promotion];
	if (!values) return [];
	const result: EnkaFlatProperty[] = [];
	const mapping: Record<string, string> = {
		hp: "BaseHP", atk: "BaseAttack", def: "BaseDefence", spd: "BaseSpeed",
		crit_rate: "CriticalChanceBase", crit_dmg: "CriticalDamageBase"
	};
	for (const [key, type] of Object.entries(mapping)) {
		const value = values[key];
		if (value) result.push({ type, value: Number(value.base ?? 0) + Number(value.step ?? 0) * (level - 1) });
	}
	return result;
}

function traceProperties(raw: EnkaAvatarDetail, resources: StarRailResBundle): EnkaFlatProperty[] {
	const result: EnkaFlatProperty[] = [];
	for (const node of raw.skillTreeList ?? []) {
		const tree = resources.characterSkillTrees[String(node.pointId)];
		if (!tree) continue;
		for (const level of (tree.levels ?? []).slice(0, Math.max(1, node.level))) {
			for (const prop of level.properties ?? []) result.push({ type: prop.type, value: Number(prop.value ?? 0) });
		}
	}
	return result;
}

function setProperties(raw: EnkaAvatarDetail, resources: StarRailResBundle): EnkaFlatProperty[] {
	const counts = new Map<string, number>();
	for (const relic of raw.relicList ?? []) {
		const setId = String(resources.relics[String(relic.tid)]?.set_id ?? relic._flat?.setID ?? "");
		if (setId) counts.set(setId, (counts.get(setId) ?? 0) + 1);
	}
	const result: EnkaFlatProperty[] = [];
	for (const [setId, count] of counts) {
		const bonuses = resources.relicSets[setId]?.properties ?? [];
		if (count >= 2) result.push(...(bonuses[0] ?? []));
		if (count >= 4) result.push(...(bonuses[1] ?? []));
	}
	return result;
}

function buildAttributes(raw: EnkaAvatarDetail, resources: StarRailResBundle): ProfileAttribute[] {
	const stats: StatBuckets = {
		base: {}, flat: {}, ratio: {},
		direct: { crit_rate: 0, crit_dmg: 0, energy_recovery: 1 }
	};
	const charPromotion = promotionProps(resources.characterPromotions[String(raw.avatarId)], raw.promotion, raw.level);
	for (const prop of charPromotion) addProperty(stats, prop);
	if (raw.equipment?._flat?.props) {
		for (const prop of raw.equipment._flat.props) addProperty(stats, prop);
	} else if (raw.equipment) {
		for (const prop of promotionProps(resources.lightConePromotions[String(raw.equipment.tid)], raw.equipment.promotion, raw.equipment.level)) addProperty(stats, prop);
	}
	for (const relic of raw.relicList ?? []) for (const prop of relic._flat?.props ?? []) addProperty(stats, prop);
	for (const prop of traceProperties(raw, resources)) addProperty(stats, prop);
	for (const prop of setProperties(raw, resources)) addProperty(stats, prop);

	const fields = new Set([...Object.keys(stats.base), ...Object.keys(stats.flat), ...Object.keys(stats.ratio), ...Object.keys(stats.direct)]);
	return [...fields].map(field => {
		const value = field in stats.base
			? (stats.base[field] ?? 0) * (1 + (stats.ratio[field] ?? 0)) + (stats.flat[field] ?? 0)
			: (stats.direct[field] ?? 0) + (stats.flat[field] ?? 0);
		const resourceField = RESOURCE_FIELDS[field] ?? field;
		const prop = Object.values(resources.properties).find((item: any) => item.field === resourceField);
		const percent = ["crit_rate", "crit_dmg", "heal_ratio", "status_prob", "status_res", "energy_recovery", "break_dmg"].includes(field) || field.endsWith("_dmg");
		return { field, value, display: formatValue(value, percent), name: prop?.name, icon: prop?.icon };
	}).filter(item => item.value !== 0);
}

function pointType(skill: any): number {
	return skill?.type === "Maze" || skill?.type === "Technique" ? 4 : 2;
}

function mapSkills(raw: EnkaAvatarDetail, charMeta: any, resources: StarRailResBundle): ProfileSkill[] {
	return (charMeta?.skills ?? [])
		.filter((skillId: string) => isVisibleProfileSkill(resources.characterSkills[skillId] ?? {}))
		.map((skillId: string) => {
		const skill = resources.characterSkills[skillId] ?? {};
		const sourceTree = (raw.skillTreeList ?? []).find(node =>
			(resources.characterSkillTrees[String(node.pointId)]?.level_up_skills ?? []).some((entry: any) => String(entry.id) === skillId)
		);
		return {
			id: skillId,
			point_type: pointType(skill),
			icon: skill.icon,
			type: skill.type,
			type_text: skill.type_text || SKILL_TYPE_LABELS[skill.type] || skill.name,
			level: sourceTree?.level ?? 1,
			is_activated: Boolean(sourceTree)
		};
	});
}

function mapCharacter(raw: EnkaAvatarDetail, resources: StarRailResBundle): ProfileCharacter {
	const id = String(raw.avatarId);
	const meta = resources.characters[id] ?? {};
	const element = resources.elements[meta.element] ?? {};
	const path = resources.paths[meta.path] ?? {};
	const relics = (raw.relicList ?? []).map(item => ({ raw: item, mapped: mapRelic(item, resources) }));
	const skillTrees = (raw.skillTreeList ?? []).map(node => {
		const tree = resources.characterSkillTrees[String(node.pointId)] ?? {};
		return {
			id: String(node.pointId), level: node.level, anchor: tree.anchor ?? "",
			max_level: tree.max_level ?? node.level, icon: tree.icon ?? "",
			parent: tree.pre_points?.[0] ?? null, is_activated: true
		};
	});
	const lightConeMeta = resources.lightCones[String(raw.equipment?.tid)] ?? {};
	const lightCone = raw.equipment ? {
		id: String(raw.equipment.tid),
		name: lightConeMeta.name ?? String(raw.equipment.tid),
		level: raw.equipment.level,
		rank: raw.equipment.rank,
		icon: lightConeMeta.icon ?? `icon/light_cone/${raw.equipment.tid}.png`,
		desc: lightConeMeta.desc,
		preview: lightConeMeta.preview,
		portrait: lightConeMeta.portrait
	} : undefined;
	return {
		id,
		...(raw._assist !== undefined ? { _assist: raw._assist } : {}),
		name: meta.name ?? id,
		level: raw.level,
		rank: raw.rank,
		rank_icons: (meta.ranks ?? []).map((rankId: string) => resources.characterRanks[rankId]?.icon).filter(Boolean),
		rarity: meta.rarity ?? 5,
		icon: meta.icon ?? `icon/character/${id}.png`,
		...(meta.preview ? { preview: meta.preview } : {}),
		...(meta.portrait ? { portrait: meta.portrait, figure_path: meta.portrait } : {}),
		...((meta.portrait ?? meta.preview ?? meta.icon) ? { image: meta.portrait ?? meta.preview ?? meta.icon } : {}),
		element: { id: meta.element ?? "Physical", icon: element.icon ?? "", color: element.color ?? "#FFFFFF" },
		path: { id: meta.path ?? "", name: path.name ?? meta.path ?? "", icon: path.icon ?? "" },
		attributes: buildAttributes(raw, resources),
		relics: relics.filter(item => item.raw.type <= 4).map(item => item.mapped),
		ornaments: relics.filter(item => item.raw.type >= 5).map(item => item.mapped),
		...(lightCone ? { light_cone: lightCone, equip: lightCone } : {}),
		skills: mapSkills(raw, meta, resources),
		skill_trees: skillTrees
	};
}

export function adaptEnkaProfile(raw: EnkaHsrResponse, resources: StarRailResBundle): PlayerData {
	const detail = raw.detailInfo;
	if (!detail) throw new Error("Enka response does not contain detailInfo");
	const avatar = resources.avatars[String(detail.headIcon ?? "")];
	return {
		player: {
			nickname: detail.nickname ?? "Unknown",
			...(detail.signature?.trim() ? { signature: detail.signature.trim() } : {}),
			uid: String(detail.uid ?? raw.uid ?? ""),
			level: detail.level ?? 0,
			...(detail.worldLevel !== undefined ? { world_level: detail.worldLevel } : {}),
			avatar: { icon: avatar?.icon ?? "icon/avatar/Default.png" },
			space_info: {
				avatar_count: detail.recordInfo?.avatarCount ?? detail.avatarDetailList?.length ?? 0,
				achievement_count: detail.recordInfo?.achievementCount ?? 0
			}
		},
		characters: (detail.avatarDetailList ?? []).map(item => mapCharacter(item, resources))
	};
}
