export interface EnkaFlatProperty {
	type: string;
	value: number;
}

export interface EnkaRelic {
	tid: number;
	type: number;
	level: number;
	mainAffixId: number;
	subAffixList?: Array<{ affixId: number; cnt: number; step?: number }>;
	_flat?: { props?: EnkaFlatProperty[]; setName?: string; setID?: number };
}

export interface EnkaEquipment {
	tid: number;
	level: number;
	promotion: number;
	rank: number;
	_flat?: { props?: EnkaFlatProperty[]; name?: string };
}

export interface EnkaAvatarDetail {
	avatarId: number;
	level: number;
	promotion: number;
	rank: number;
	relicList?: EnkaRelic[];
	skillTreeList?: Array<{ pointId: number; level: number }>;
	equipment?: EnkaEquipment;
	_assist?: boolean;
}

export interface EnkaHsrResponse {
	uid?: string;
	ttl?: number;
	region?: string;
	detailInfo?: {
		uid?: number;
		nickname?: string;
		signature?: string;
		level?: number;
		worldLevel?: number;
		headIcon?: number;
		recordInfo?: { avatarCount?: number; achievementCount?: number };
		avatarDetailList?: EnkaAvatarDetail[];
	};
	message?: string;
}

export type EnkaErrorCode =
	| "INVALID_UID"
	| "PLAYER_NOT_FOUND"
	| "PROFILE_PRIVATE"
	| "RATE_LIMITED"
	| "UPSTREAM_UNAVAILABLE"
	| "INVALID_RESPONSE";

export interface EnkaPlayerResult {
	status: number;
	data?: EnkaHsrResponse;
	error?: { code: EnkaErrorCode; message: string };
}
