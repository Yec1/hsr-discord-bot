import {
	buildHSRRedeemCard,
	getHSRRedeemCardLayout,
	getHSRRedeemRewardLabel
} from "@/utilities/canvas/redeemCard.js";

describe("HSR redeem result card", () => {
	it("keeps every redeem code in a readable two-column layout", () => {
		const layout = getHSRRedeemCardLayout(17);

		expect(layout.columns).toBe(2);
		expect(layout.rows).toBe(9);
		expect(layout.visibleCodeCount).toBe(17);
		expect(layout.height).toBeGreaterThan(900);
	});

	it("shows an explicit reward fallback when the API has no reward name", () => {
		expect(getHSRRedeemRewardLabel("60 stellar jade")).toBe("60 stellar jade");
		expect(getHSRRedeemRewardLabel("  ")).toBe("獎勵資訊未提供");
		expect(getHSRRedeemRewardLabel(undefined)).toBe("獎勵資訊未提供");
	});

	it("renders all results to a dynamically sized PNG", async () => {
		const codes = Array.from({ length: 11 }, (_, index) => ({
			code: `TESTCODE${String(index + 1).padStart(2, "0")}`,
			...(index === 0 ? { rewards: "60 stellar jade and one fuel" } : {}),
			status: index % 3 === 0 ? "success" as const : "invalid" as const
		}));
		const layout = getHSRRedeemCardLayout(codes.length);
		const image = await buildHSRRedeemCard({
			uid: "800000001",
			nickname: "測試開拓者",
			codes
		});

		expect(image.subarray(1, 4).toString()).toBe("PNG");
		expect(image.readUInt32BE(16)).toBe(layout.width);
		expect(image.readUInt32BE(20)).toBe(layout.height);
	});
});