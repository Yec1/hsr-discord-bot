import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import moment from "moment-timezone";
import path from "path";

const assetDir = path.join(process.cwd(), "src/assets");
const fontCandidates = [
	{ file: "YaHei.ttf", family: "HSRFont" },
	{ file: "zh-tw.ttf", family: "HSRFontTW" }
];
for (const { file, family } of fontCandidates) {
	const candidates = [
		path.join(assetDir, file),
		path.join(process.cwd(), "src/assets", file),
		path.join(process.cwd(), "dist/assets", file)
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			GlobalFonts.registerFromPath(candidate, family);
			break;
		}
	}
}

export interface HSRRedeemCodeResult {
	code: string;
	rewards?: string;
	status: "success" | "already_claimed" | "invalid" | "failed";
}

export interface HSRRedeemAccountResult {
	uid: string;
	nickname?: string;
	codes: HSRRedeemCodeResult[];
}

export interface HSRRedeemCardPayload {
	accounts: HSRRedeemAccountResult[];
}

export interface HSRRedeemCardLayout {
	width: number;
	height: number;
	columns: number;
	rows: number;
	visibleCodeCount: number;
	gridX: number;
	gridY: number;
	itemWidth: number;
	itemHeight: number;
	columnGap: number;
	rowGap: number;
}

const STATUS_CONFIG = {
	success: {
		color: "#d8b4fe",
		background: "rgba(126, 72, 170, 0.30)",
		border: "rgba(216, 180, 254, 0.62)",
		label: "兌換成功"
	},
	already_claimed: {
		color: "#9bd7f5",
		background: "rgba(45, 106, 145, 0.25)",
		border: "rgba(155, 215, 245, 0.52)",
		label: "已兌換"
	},
	invalid: {
		color: "#f7cf7a",
		background: "rgba(145, 101, 35, 0.26)",
		border: "rgba(247, 207, 122, 0.52)",
		label: "無效或過期"
	},
	failed: {
		color: "#f3a6a6",
		background: "rgba(148, 58, 58, 0.25)",
		border: "rgba(243, 166, 166, 0.52)",
		label: "兌換失敗"
	}
} as const;

const WIDTH = 1080;
const OUTER_PADDING = 32;
const SIDEBAR_WIDTH = 244;
const GRID_X = OUTER_PADDING + SIDEBAR_WIDTH + 38;
const GRID_Y = 104;
const GRID_RIGHT = OUTER_PADDING;
const COLUMN_GAP = 14;
const ROW_GAP = 12;
const ITEM_HEIGHT = 150;
const FOOTER_SPACE = 66;

export function getHSRRedeemCardLayout(codeCount: number): HSRRedeemCardLayout {
	const visibleCodeCount = Math.max(0, Math.floor(codeCount));
	const columns = visibleCodeCount <= 1 ? 1 : 2;
	const rows = visibleCodeCount === 0 ? 0 : Math.ceil(visibleCodeCount / columns);
	const availableWidth = WIDTH - GRID_X - GRID_RIGHT;
	const itemWidth = Math.floor(
		(availableWidth - COLUMN_GAP * (columns - 1)) / columns
	);
	const gridHeight =
		rows === 0 ? 0 : rows * ITEM_HEIGHT + (rows - 1) * ROW_GAP;

	return {
		width: WIDTH,
		height: Math.max(420, GRID_Y + gridHeight + FOOTER_SPACE),
		columns,
		rows,
		visibleCodeCount,
		gridX: GRID_X,
		gridY: GRID_Y,
		itemWidth,
		itemHeight: ITEM_HEIGHT,
		columnGap: COLUMN_GAP,
		rowGap: ROW_GAP
	};
}

export function getHSRRedeemRewardLabel(rewards?: string): string {
	return rewards?.trim() || "獎勵資訊未提供";
}

function roundedRect(
	ctx: any,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void {
	const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + width - r, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r);
	ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

function fitFontSize(
	ctx: any,
	text: string,
	maxWidth: number,
	font: string,
	startSize: number,
	minimumSize: number
): number {
	let size = startSize;
	ctx.font = `bold ${size}px ${font}`;
	while (size > minimumSize && ctx.measureText(text).width > maxWidth) {
		size--;
		ctx.font = `bold ${size}px ${font}`;
	}
	return size;
}

function wrapText(
	ctx: any,
	text: string,
	maxWidth: number,
	maxLines: number
): string[] {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let line = "";

	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word;
		if (ctx.measureText(candidate).width <= maxWidth) {
			line = candidate;
			continue;
		}
		if (line) lines.push(line);
		line = word;
		if (ctx.measureText(line).width <= maxWidth) continue;

		let segment = "";
		for (const character of word) {
			if (segment && ctx.measureText(segment + character).width > maxWidth) {
				lines.push(segment);
				segment = character;
			} else {
				segment += character;
			}
		}
		line = segment;
	}
	if (line) lines.push(line);
	if (lines.length <= maxLines) return lines;

	const visible = lines.slice(0, maxLines);
	let lastLine = visible[maxLines - 1] || "";
	while (
		lastLine.length > 1 &&
		ctx.measureText(`${lastLine}…`).width > maxWidth
	) {
		lastLine = lastLine.slice(0, -1);
	}
	visible[maxLines - 1] = `${lastLine}…`;
	return visible;
}

async function drawBackground(ctx: any, width: number, height: number): Promise<void> {
	const backgroundPaths = [
		path.join(process.cwd(), "src/assets/daily-bg.jpg"),
		path.join(process.cwd(), "dist/assets/daily-bg.jpg")
	];
	let loaded = false;
	for (const backgroundPath of backgroundPaths) {
		if (!fs.existsSync(backgroundPath)) continue;
		try {
			const image = await loadImage(fs.readFileSync(backgroundPath));
			const scale = Math.max(width / image.width, height / image.height);
			const drawWidth = image.width * scale;
			const drawHeight = image.height * scale;
			ctx.drawImage(
				image,
				(width - drawWidth) / 2,
				(height - drawHeight) / 2,
				drawWidth,
				drawHeight
			);
			loaded = true;
			break;
		} catch {
			// Try the next path before falling back to a generated background.
		}
	}
	if (!loaded) {
		const fallback = ctx.createLinearGradient(0, 0, width, height);
		fallback.addColorStop(0, "#090512");
		fallback.addColorStop(0.55, "#161026");
		fallback.addColorStop(1, "#080610");
		ctx.fillStyle = fallback;
		ctx.fillRect(0, 0, width, height);
	}

	ctx.fillStyle = "rgba(4, 3, 10, 0.72)";
	ctx.fillRect(0, 0, width, height);
	const sideShade = ctx.createLinearGradient(0, 0, width, 0);
	sideShade.addColorStop(0, "rgba(4, 3, 10, 0.94)");
	sideShade.addColorStop(0.3, "rgba(4, 3, 10, 0.70)");
	sideShade.addColorStop(0.72, "rgba(4, 3, 10, 0.18)");
	sideShade.addColorStop(1, "rgba(4, 3, 10, 0.48)");
	ctx.fillStyle = sideShade;
	ctx.fillRect(0, 0, width, height);
}

function drawSidebar(
	ctx: any,
	account: HSRRedeemAccountResult,
	font: string,
	height: number
): void {
	const x = OUTER_PADDING;
	const codes = account.codes;
	const stats = [
		{
			label: "成功",
			value: codes.filter(code => code.status === "success").length,
			color: STATUS_CONFIG.success.color
		},
		{
			label: "已兌換",
			value: codes.filter(code => code.status === "already_claimed").length,
			color: STATUS_CONFIG.already_claimed.color
		},
		{
			label: "無效",
			value: codes.filter(code => code.status === "invalid").length,
			color: STATUS_CONFIG.invalid.color
		},
		{
			label: "失敗",
			value: codes.filter(code => code.status === "failed").length,
			color: STATUS_CONFIG.failed.color
		}
	];

	ctx.fillStyle = "rgba(255,255,255,0.42)";
	ctx.font = `12px ${font}`;
	ctx.fillText("HONKAI: STAR RAIL", x, 43);
	ctx.fillStyle = "#ffffff";
	fitFontSize(ctx, account.nickname || account.uid, SIDEBAR_WIDTH, font, 28, 18);
	ctx.fillText(account.nickname || account.uid, x, 79);
	ctx.fillStyle = "rgba(255,255,255,0.46)";
	ctx.font = `13px ${font}`;
	ctx.fillText(`UID  ${account.uid}`, x, 103);

	ctx.fillStyle = "rgba(255,255,255,0.13)";
	ctx.fillRect(x, 127, SIDEBAR_WIDTH - 12, 1);
	ctx.fillStyle = "rgba(255,255,255,0.55)";
	ctx.font = `bold 14px ${font}`;
	ctx.fillText("兌換結果統計", x, 159);

	let statY = 194;
	for (const stat of stats) {
		ctx.fillStyle = stat.color;
		ctx.font = `bold 27px ${font}`;
		ctx.fillText(String(stat.value), x, statY);
		ctx.fillStyle = "rgba(255,255,255,0.48)";
		ctx.font = `13px ${font}`;
		ctx.fillText(stat.label, x + 48, statY - 4);
		statY += 48;
	}

	ctx.fillStyle = "rgba(255,255,255,0.10)";
	ctx.fillRect(GRID_X - 20, OUTER_PADDING, 1, height - OUTER_PADDING * 2);
}

function drawCodeItem(
	ctx: any,
	result: HSRRedeemCodeResult,
	x: number,
	y: number,
	width: number,
	height: number,
	font: string
): void {
	const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.failed;
	roundedRect(ctx, x, y, width, height, 14);
	ctx.fillStyle = config.background;
	ctx.fill();
	ctx.strokeStyle = config.border;
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.fillStyle = "rgba(255,255,255,0.43)";
	ctx.font = `11px ${font}`;
	ctx.fillText("兌換碼", x + 18, y + 25);

	const badgeWidth = ctx.measureText(config.label).width + 22;
	roundedRect(ctx, x + width - badgeWidth - 14, y + 12, badgeWidth, 24, 12);
	ctx.fillStyle = "rgba(4,3,10,0.38)";
	ctx.fill();
	ctx.fillStyle = config.color;
	ctx.font = `bold 11px ${font}`;
	ctx.fillText(config.label, x + width - badgeWidth - 3, y + 28);

	ctx.fillStyle = "#ffffff";
	fitFontSize(ctx, result.code, width - 36, font, 19, 13);
	ctx.fillText(result.code, x + 18, y + 55);

	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.fillRect(x + 18, y + 68, width - 36, 1);
	ctx.fillStyle = "rgba(255,255,255,0.40)";
	ctx.font = `11px ${font}`;
	ctx.fillText("獎勵", x + 18, y + 88);

	const reward = getHSRRedeemRewardLabel(result.rewards);
	ctx.fillStyle = result.rewards?.trim()
		? "rgba(255,255,255,0.82)"
		: "rgba(255,255,255,0.42)";
	ctx.font = `13px ${font}`;
	const rewardLines = wrapText(ctx, reward, width - 36, 3);
	for (let index = 0; index < rewardLines.length; index++) {
		ctx.fillText(rewardLines[index], x + 18, y + 108 + index * 17);
	}
}

export async function buildHSRRedeemCard(
	accountOrPayload: HSRRedeemAccountResult | HSRRedeemCardPayload
): Promise<Buffer> {
	const account = "accounts" in accountOrPayload
		? accountOrPayload.accounts[0]
		: accountOrPayload;
	if (!account) throw new Error("Redeem card requires at least one account");

	const layout = getHSRRedeemCardLayout(account.codes.length);
	const font = '"HSRFont", "HSRFontTW", sans-serif';
	const canvas = createCanvas(layout.width, layout.height);
	const ctx = canvas.getContext("2d") as any;

	await drawBackground(ctx, layout.width, layout.height);
	drawSidebar(ctx, account, font, layout.height);

	ctx.fillStyle = "#ffffff";
	ctx.font = `bold 24px ${font}`;
	ctx.fillText("自動兌換結果", layout.gridX, 48);
	ctx.fillStyle = "rgba(255,255,255,0.48)";
	ctx.font = `13px ${font}`;
	ctx.fillText(
		`兌換明細 · ${account.codes.length} 個兌換碼`,
		layout.gridX,
		74
	);

	for (let index = 0; index < account.codes.length; index++) {
		const column = index % layout.columns;
		const row = Math.floor(index / layout.columns);
		const x = layout.gridX + column * (layout.itemWidth + layout.columnGap);
		const y = layout.gridY + row * (layout.itemHeight + layout.rowGap);
		drawCodeItem(
			ctx,
			account.codes[index]!,
			x,
			y,
			layout.itemWidth,
			layout.itemHeight,
			font
		);
	}

	if (account.codes.length === 0) {
		ctx.fillStyle = "rgba(255,255,255,0.55)";
		ctx.font = `16px ${font}`;
		ctx.fillText("本次沒有需要顯示的兌換結果", layout.gridX, layout.gridY + 42);
	}

	const timestamp = `${moment()
		.tz("Asia/Taipei")
		.format("YYYY/MM/DD · HH:mm")} CST`;
	ctx.fillStyle = "rgba(255,255,255,0.26)";
	ctx.font = `12px ${font}`;
	const timestampWidth = ctx.measureText(timestamp).width;
	ctx.fillText(
		timestamp,
		layout.width - OUTER_PADDING - timestampWidth,
		layout.height - 24
	);

	return canvas.toBuffer("image/png");
}
