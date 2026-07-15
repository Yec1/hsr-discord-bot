export interface LeaderboardData {
	id: string;
	score: Array<{
		nickname: string;
		uid: string;
		score: number;
		avatar: string;
	}>;
	element: {
		color: string;
	};
	icon: string;
}

export interface NewsData {
	data: {
		list: Array<{
			post: {
				post_id: string;
				subject: string;
				created_at: number;
			};
		}>;
	};
}

export interface PostData {
	post: {
		post: {
			subject: string;
			content: string;
			created_at: number;
			post_id?: string;
		};
		user: {
			avatar_url?: string;
			nickname?: string;
			uid: string;
		};
		image_list: Array<{ url: string }>;
		cover_list: Array<{ url: string }>;
	};
}
