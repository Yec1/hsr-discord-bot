import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

const assetDir = path.join(process.cwd(), "src/assets");
const fontCandidates = [
	{ file: "YaHei.ttf", family: "HSRFont" },
	{ file: "zh-tw.ttf", family: "HSRFontTW" }
];
for (const { file, family } of fontCandidates) {
	const candidates = [
		path.join(assetDir, file),
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
	rewardIcon?: string;
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
	success: { color: "#c8a6ef", label: "兌換成功" },
	already_claimed: { color: "#8dc9e8", label: "已兌換" },
	invalid: { color: "#e7bd69", label: "無效或過期" },
	failed: { color: "#e69696", label: "兌換失敗" }
} as const;

const WIDTH = 900;
const OUTER_PADDING = 40;
const GRID_Y = 112;
const ITEM_HEIGHT = 96;
const ROW_GAP = 0;
const BOTTOM_PADDING = 28;
const ICON_SIZE = 58;
const ICON_GAP = 18;
const rewardIconCache = new Map<string, Promise<any | null>>();

export function getHSRRedeemCardLayout(codeCount: number): HSRRedeemCardLayout {
	const visibleCodeCount = Math.max(0, Math.floor(codeCount));
	const rows = visibleCodeCount;
	const contentHeight = rows === 0
		? ITEM_HEIGHT
		: rows * ITEM_HEIGHT + Math.max(0, rows - 1) * ROW_GAP;

	return {
		width: WIDTH,
		height: Math.max(236, GRID_Y + contentHeight + BOTTOM_PADDING),
		columns: 1,
		rows,
		visibleCodeCount,
		gridX: OUTER_PADDING,
		gridY: GRID_Y,
		itemWidth: WIDTH - OUTER_PADDING * 2,
		itemHeight: ITEM_HEIGHT,
		columnGap: 0,
		rowGap: ROW_GAP
	};
}

export function maskHSRRedeemUid(uid: string): string {
	const normalized = uid.trim();
	if (!normalized) return "—";
	if (normalized.length <= 4) return "*".repeat(normalized.length);
	return `${normalized.slice(0, 3)}${"*".repeat(normalized.length - 5)}${normalized.slice(-2)}`;
}

export function getFirstHSRRedeemRewardIcon(
	rewardIcons?: readonly string[]
): string | undefined {
	return rewardIcons?.find(icon => typeof icon === "string" && Boolean(icon.trim()))?.trim();
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
	while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
		lastLine = lastLine.slice(0, -1);
	}
	visible[maxLines - 1] = `${lastLine}…`;
	return visible;
}

async function loadRewardIcon(source?: string): Promise<any | null> {
	const normalized = source?.trim();
	if (!normalized) return null;

	const cached = rewardIconCache.get(normalized);
	if (cached) return cached;

	const loading = (async () => {
		try {
			if (normalized.startsWith("data:") || fs.existsSync(normalized)) {
				return await loadImage(normalized);
			}
			const response = await fetch(normalized, {
				signal: AbortSignal.timeout(8000)
			});
			if (!response.ok) return null;
			return await loadImage(Buffer.from(await response.arrayBuffer()));
		} catch {
			return null;
		}
	})();
	rewardIconCache.set(normalized, loading);
	return loading;
}

function drawBackground(ctx: any, width: number, height: number): void {
	const background = ctx.createLinearGradient(0, 0, width, height);
	background.addColorStop(0, "#100c18");
	background.addColorStop(1, "#08070c");
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
}

function drawRewardIcon(ctx: any, image: any, x: number, y: number): void {
	const scale = Math.min(ICON_SIZE / image.width, ICON_SIZE / image.height);
	const width = image.width * scale;
	const height = image.height * scale;
	ctx.drawImage(
		image,
		x + (ICON_SIZE - width) / 2,
		y + (ICON_SIZE - height) / 2,
		width,
		height
	);
}

function drawCodeResult(
	ctx: any,
	result: HSRRedeemCodeResult,
	rewardIcon: any | null,
	x: number,
	y: number,
	width: number,
	font: string
): void {
	const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.failed;
	const reward = result.rewards?.trim();
	const textWidth = width - 18 - (rewardIcon ? ICON_SIZE + ICON_GAP : 0);
	const codeY = reward ? y + 33 : y + 55;

	ctx.fillStyle = config.color;
	ctx.beginPath();
	ctx.arc(x + 4, codeY - 6, 4, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = "#ffffff";
	fitFontSize(ctx, result.code, Math.max(180, textWidth - 130), font, 18, 13);
	ctx.fillText(result.code, x + 18, codeY);
	const codeWidth = ctx.measureText(result.code).width;

	ctx.fillStyle = config.color;
	ctx.font = `14px ${font}`;
	ctx.fillText(config.label, x + 30 + codeWidth, codeY);

	if (reward) {
		ctx.fillStyle = "rgba(255,255,255,0.64)";
		ctx.font = `14px ${font}`;
		const rewardLines = wrapText(ctx, reward, textWidth, 2);
		for (let index = 0; index < rewardLines.length; index++) {
			ctx.fillText(rewardLines[index], x + 18, y + 60 + index * 19);
		}
	}

	if (rewardIcon) {
		drawRewardIcon(ctx, rewardIcon, x + width - ICON_SIZE, y + 19);
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
	const rewardIcons = await Promise.all(
		account.codes.map(result => loadRewardIcon(result.rewardIcon))
	);

	drawBackground(ctx, layout.width, layout.height);

	const nickname = account.nickname?.trim() || "開拓者";
	ctx.fillStyle = "#ffffff";
	fitFontSize(ctx, nickname, layout.itemWidth, font, 28, 18);
	ctx.fillText(nickname, layout.gridX, 50);
	ctx.fillStyle = "rgba(255,255,255,0.48)";
	ctx.font = `14px ${font}`;
	ctx.fillText(`UID ${maskHSRRedeemUid(account.uid)}`, layout.gridX, 77);
	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.fillRect(layout.gridX, 96, layout.itemWidth, 1);

	for (let index = 0; index < account.codes.length; index++) {
		const y = layout.gridY + index * (layout.itemHeight + layout.rowGap);
		if (index > 0) {
			ctx.fillStyle = "rgba(255,255,255,0.08)";
			ctx.fillRect(layout.gridX, y, layout.itemWidth, 1);
		}
		drawCodeResult(
			ctx,
			account.codes[index]!,
			rewardIcons[index],
			layout.gridX,
			y,
			layout.itemWidth,
			font
		);
	}

	if (account.codes.length === 0) {
		ctx.fillStyle = "rgba(255,255,255,0.48)";
		ctx.font = `15px ${font}`;
		ctx.fillText("本次沒有兌換結果", layout.gridX, layout.gridY + 50);
	}

	return canvas.toBuffer("image/png");
}
