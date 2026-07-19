export interface DailyInfo {
	total_sign_day: number;
	month_last_day: boolean;
	sign_cnt_missed: number;
	is_sign: boolean;
}

export interface DailyReward {
	month: number;
}

export interface DailyRewards {
	awards: Array<{
		name: string;
		cnt: number;
		icon: string;
	}>;
}

export interface DailyClaimResponse {
	code: number;
	info: DailyInfo;
	reward: DailyReward;
}

interface DailyClaimClient {
	uid?: number | string;
	daily: {
		claim(): Promise<DailyClaimResponse>;
		rewards(): Promise<DailyRewards>;
	};
}

/**
 * Claim first because hoyoapi's claim() already performs info() and reward().
 * One extra rewards() call is required for the complete monthly awards list.
 */
export async function claimDaily(client: DailyClaimClient): Promise<{
	info: DailyInfo;
	reward: DailyReward;
	rewards: DailyRewards;
	res: DailyClaimResponse;
	uid: string;
}> {
	const res = await client.daily.claim();
	const rewards = await client.daily.rewards();
	return {
		info: res.info,
		reward: res.reward,
		rewards,
		res,
		uid: client.uid?.toString() || ""
	};
}
