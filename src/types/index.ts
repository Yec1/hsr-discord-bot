import {
	Collection,
	Interaction,
	Message,
	CommandInteraction
} from "discord.js";
import { ClusterClient } from "discord-hybrid-sharding";
import { QuickDB } from "quick.db";

export type MessageCommandType = {
	name: string;
	description: string;
	usage?: string;
	aliases?: string[];
	category?: string;
	cooldown?: number;
	args?: boolean;
	guildOnly?: boolean;

	/**
	 * @param message - 消息
	 * @param _args - ?�數
	 * @returns
	 */
	execute: (message: Message, args: string[]) => Promise<any>;
};

export type SlashCommandType = {
	data: any;

	/**
	 * @param interaction - 互�?實�?
	 * @param _args - ?�數
	 * @returns
	 */
	execute: (interaction: any, ..._args: string[]) => Promise<any>;
};

// Discord.js ?��?类�?
declare module "discord.js" {
	interface Client {
		db: QuickDB;
		cluster: ClusterClient;
		commands: {
			slash: Collection<string, any>;
			message: Collection<string, any>;
		};
	}
}

// ?�本?�择类�?
export interface VersionChoice {
	value: string;
	name: string;
	localName: string;
}

// ?�闻类�?
export interface NewsItem {
	post: {
		post_id: string;
		subject: string;
		content: string;
		created_at: number;
		updated_at: number;
		author: {
			uid: string;
			nickname: string;
			avatar_url: string;
		};
	};
	forum: {
		id: number;
		name: string;
	};
	topics: Array<{
		id: number;
		name: string;
	}>;
	image_list: string[];
	post_status: {
		is_official: boolean;
		is_top: boolean;
		is_good: boolean;
		is_subject: boolean;
	};
	view_type: number;
	is_user_master_post: boolean;
	is_official_master_post: boolean;
	is_question: boolean;
	self_operation: {
		is_liked: boolean;
		is_favorited: boolean;
	};
	stat: {
		view_num: number;
		reply_num: number;
		like_num: number;
		share_num: number;
		follow_num: number;
		favorite_num: number;
	};
	help_sys: {
		top_up: boolean;
		top_up_nid: string;
	};
	cover: {
		url: string;
		height: number;
		width: number;
		format: string;
	};
	image: {
		url: string;
		height: number;
		width: number;
		format: string;
	};
	is_block_on: boolean;
	game_ids: number[];
	is_unknown_cover: boolean;
	video_cover: {
		url: string;
		height: number;
		width: number;
		format: string;
	};
	official_type: number;
	is_overseas_only: boolean;
}

// ?�户?�据类�?
export interface UserData {
	uid: string;
	nickname: string;
	level: number;
	world_level: number;
	friend_count: number;
	avatar: {
		id: string;
		name: string;
		icon: string;
	};
	signature: string;
	is_display: boolean;
	space_info: {
		challenge_data: {
			maze_group_id: number;
			maze_group_index: number;
			pre_maze_group_index: number;
			start_time: number;
			end_time: number;
			stars: number;
			max_stars: number;
		};
		pass_area_progress: number;
		light_cone_count: number;
		avatar_count: number;
		achievement_count: number;
	};
}

// 跃�??�据类�?
export interface WarpData {
	gacha_id: string;
	gacha_type: string;
	item_id: string;
	count: number;
	time: string;
	name: string;
	item_type: string;
	rank_type: string;
	id: string;
}

export interface WarpResults {
	collaboration_character: WarpData[];
	collaboration_light_cone: WarpData[];
	character: WarpData[];
	light_cone: WarpData[];
	regular: WarpData[];
}

// 模�??�设置类??
export interface SimulatorSettings {
	pityFive: number;
	soft: number;
	max: number;
	chance: number;
	rateup: number;
	guaranteeFive?: boolean;
}

// ?�令类�?
export interface Command {
	name: string;
	description?: string;
	type?: number;
	data?: any;
	execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface MessageCommandInterface {
	name: string;
	description?: string;
	folder?: string;
	execute: (message: Message, args: string[]) => Promise<void>;
}

// 翻�??�数类�?
export type TranslationFunction = (
	key: string,
	params?: Record<string, any>
) => string;

// 工具?�数类�?
export interface UtilityFunctions {
	getRandomColor: () => string;
	getUserLang: (userId: string) => Promise<string>;
	drawInQueueReply: (
		interaction: Interaction,
		title: string
	) => Promise<void>;
	i18nMixin: (locale: string) => TranslationFunction;
}
