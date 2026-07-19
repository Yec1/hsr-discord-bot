export interface ProfileAttribute {
	field: string;
	value: number;
	display?: string;
	name?: string;
	icon?: string;
	final?: string | number;
	base?: string | number;
	add?: string | number;
}

export interface ProfileSubAffix {
	type?: string | number;
	name: string;
	display: string;
	value: string;
	weight: number;
	icon: string;
	property_type: number;
	propertyName?: string;
	count?: number;
	times?: number;
	step?: number;
}

export interface ProfileRelic {
	id: string;
	type?: number | string;
	name: string;
	level: number;
	rarity: number;
	icon: string;
	main_affix?: Omit<ProfileSubAffix, "property_type"> & { property_type?: number };
	main_property?: { property_type: number; value: string };
	sub_affix?: ProfileSubAffix[];
	properties?: ProfileSubAffix[];
}

export interface ProfileSkill {
	id?: string;
	point_id?: string;
	point_type: number;
	item_url?: string;
	icon?: string;
	type?: string;
	type_text?: string;
	remake?: string;
	level: number;
	is_activated?: boolean;
	anchor?: string;
}

export interface ProfileSkillTree {
	id: string;
	level: number;
	anchor: string;
	max_level: number;
	icon: string;
	parent: string | null;
	is_activated?: boolean;
	point_type?: number;
}

export interface ProfileLightCone {
	id: string;
	name: string;
	level: number;
	rank: number;
	icon: string;
	desc?: string;
	preview?: string;
	portrait?: string;
}

export interface ProfileCharacter {
	id: string;
	_assist?: boolean;
	pos?: number;
	name: string;
	level: number;
	rank: number;
	rank_icons?: string[];
	rarity: number;
	icon: string;
	preview?: string;
	portrait?: string;
	image?: string;
	figure_path?: string;
	element: { id: string; icon: string; color: string } | string;
	path?: { id: string; name: string; icon: string } | string;
	base_type?: number;
	attributes?: ProfileAttribute[];
	additions?: ProfileAttribute[];
	properties?: Array<{ property_type: number; base: string; add: string; final: string; icon?: string; name?: string }>;
	relics?: ProfileRelic[];
	ornaments?: ProfileRelic[];
	light_cone?: ProfileLightCone;
	equip?: ProfileLightCone;
	skills?: ProfileSkill[];
	skill_trees?: ProfileSkillTree[];
}

export interface PlayerData {
	player: {
		nickname: string;
		signature?: string;
		uid: string;
		level: number;
		world_level?: number | undefined;
		avatar: { icon: string };
		space_info?: { avatar_count: number; achievement_count: number };
	};
	characters: ProfileCharacter[];
}
