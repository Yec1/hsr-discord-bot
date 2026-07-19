import { claimDaily } from "@/utilities/hsr/dailyClaim.js";

describe("claimDaily", () => {
	it("uses claim-provided info/reward so the info endpoint runs once", async () => {
		const info = jest.fn(async () => ({
			total_sign_day: 10,
			month_last_day: false,
			sign_cnt_missed: 0,
			is_sign: true
		}));
		const rewards = jest.fn(async () => ({
			awards: [{ name: "星瓊", cnt: 20, icon: "reward.png" }]
		}));
		const reward = jest.fn(async () => {
			await rewards();
			return { month: 7 };
		});
		const claim = jest.fn(async () => ({
			code: 0,
			info: await info(),
			reward: await reward()
		}));

		const result = await claimDaily({
			uid: 800000001,
			daily: { claim, rewards }
		});

		expect(result.info.total_sign_day).toBe(10);
		expect(result.reward.month).toBe(7);
		expect(result.uid).toBe("800000001");
		expect(claim).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledTimes(1);
		expect(reward).toHaveBeenCalledTimes(1);
		// claim -> reward -> rewards, plus one explicit full monthly awards request.
		expect(rewards).toHaveBeenCalledTimes(2);
	});
});
