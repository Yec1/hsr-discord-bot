import { AUTO_REDEEM_CRON, hasUnredeemedCodes } from "@/utilities/core/redeemSchedule.js";

describe("自動兌換排程", () => {
	it("每小時檢查一次新兌換碼，而不是每天只檢查一次", () => {
		expect(AUTO_REDEEM_CRON).toBe("20 * * * *");
	});

	it("只有帳號存在尚未處理的兌換碼時才進入完整兌換流程", () => {
		const codes = [{ code: "OLD" }, { code: "NEW" }];

		expect(hasUnredeemedCodes(["OLD"], codes)).toBe(true);
		expect(hasUnredeemedCodes(["OLD", "NEW"], codes)).toBe(false);
	});
});
