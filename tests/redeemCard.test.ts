import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  buildHSRRedeemCard,
  getFirstHSRRedeemRewardIcon,
  getHSRRedeemCardLayout,
  HSR_REDEEM_BACKGROUND,
  maskHSRRedeemUid,
} from "@/utilities/canvas/redeemCard.js";

function createRewardIconDataUrl(color = "#ff00ff"): string {
	const canvas = createCanvas(32, 32);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 32, 32);
	return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

describe("HSR redeem result card", () => {
	it("uses a simple single-column layout for every redeem result", () => {
		const layout = getHSRRedeemCardLayout(17);

		expect(layout.columns).toBe(1);
		expect(layout.rows).toBe(17);
		expect(layout.visibleCodeCount).toBe(17);
		expect(layout.height).toBeGreaterThan(1700);
	});

	it("masks the account UID without leaking the middle digits", () => {
		expect(maskHSRRedeemUid("800123456")).toBe("800****56");
		expect(maskHSRRedeemUid("1234")).toBe("****");
		expect(maskHSRRedeemUid("  ")).toBe("—");
	});

	it("selects only the first available reward icon", () => {
		expect(
			getFirstHSRRedeemRewardIcon(["https://example.test/first.png", "https://example.test/second.png"])
		).toBe("https://example.test/first.png");
		expect(getFirstHSRRedeemRewardIcon([" ", "https://example.test/icon.png"])).toBe(
			"https://example.test/icon.png"
		);
		expect(getFirstHSRRedeemRewardIcon(undefined)).toBeUndefined();
	});

  it("uses the local starfield image as its background", () => {
    expect(HSR_REDEEM_BACKGROUND.endsWith("daily-bg.jpg")).toBe(true);
    expect(fs.existsSync(HSR_REDEEM_BACKGROUND)).toBe(true);
  });

  it("renders the optional reward icon with the real renderer", async () => {
		const layout = getHSRRedeemCardLayout(2);
		const image = await buildHSRRedeemCard({
			uid: "800123456",
			nickname: "匿名開拓者",
			codes: [
				{
					code: "SAMPLECODE01",
					rewards: "60 stellar jade",
					rewardIcon: createRewardIconDataUrl(),
					status: "success"
				},
				{
					code: "SAMPLECODE02",
					status: "invalid"
				}
			]
		});
		const rendered = await loadImage(image);
		const pixelCanvas = createCanvas(layout.width, layout.height);
		const pixelContext = pixelCanvas.getContext("2d");
		pixelContext.drawImage(rendered, 0, 0);
    const iconPixel = pixelContext.getImageData(78, 192, 1, 1).data;

    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(layout.width);
    expect(image.readUInt32BE(20)).toBe(layout.height);
    expect(Array.from(iconPixel)).toEqual([255, 0, 255, 255]);
	});

	it("renders naturally when reward text and icon are absent", async () => {
		const layout = getHSRRedeemCardLayout(1);
		const image = await buildHSRRedeemCard({
			uid: "900987654",
			nickname: "匿名帳號",
			codes: [{ code: "NOASSETCODE", status: "failed" }]
		});

		expect(image.subarray(1, 4).toString()).toBe("PNG");
		expect(image.readUInt32BE(16)).toBe(layout.width);
		expect(image.readUInt32BE(20)).toBe(layout.height);
	});
});
