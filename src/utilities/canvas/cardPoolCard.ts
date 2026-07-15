import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getSharedImage } from "@/utilities/hsr/imageCache.js";

export type PoolItem = {
	item_name: string;
	icon_url?: string;
	item_url?: string;
	rarity: string;
};

export type CardPool = {
	id: string;
	type: "CardPoolRole" | "CardPoolEquipment";
	version: string;
	time_info: { start_ts: string; end_ts: string; now: string };
	avatar_list: PoolItem[];
	equip_list: PoolItem[];
};

export type CardPoolData = {
	cur_game_version: string;
	avatar_card_pool_list: CardPool[];
	equip_card_pool_list: CardPool[];
};

for (const [file, family] of [
	["zh-tw.ttf", "CardPoolTW"],
	["YaHei.ttf", "CardPoolCN"]
] as const) {
	for (const path of [
		join(process.cwd(), "src/assets", file),
		join(process.cwd(), "dist/assets", file)
	]) {
		if (existsSync(path)) {
			GlobalFonts.registerFromPath(path, family);
			break;
		}
	}
}

const poolKey = (pool: CardPool) =>
	`${pool.time_info.start_ts}:${pool.time_info.end_ts}`;

export function pairCardPools(data: CardPoolData) {
	// ponytail: one role/equipment pool per official time window; use arrays if HoYoLAB adds duplicates.
	const equipment = new Map(
		(data.equip_card_pool_list || []).map(pool => [poolKey(pool), pool])
	);
	const rows: Array<{ role: CardPool | null; equipment: CardPool | null }> = (
		data.avatar_card_pool_list || []
	).map(role => ({
		role,
		equipment: equipment.get(poolKey(role)) || null
	}));
	const used = new Set(rows.map(row => row.equipment));
	for (const pool of data.equip_card_pool_list || []) {
		if (!used.has(pool)) rows.push({ role: null, equipment: pool });
	}
	return rows;
}

function roundedRect(
	ctx: any,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

function duration(seconds: number) {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	return `${days ? `${days}天` : ""}${hours || !days ? `${hours}小時` : ""}`;
}

function timing(pool: CardPool) {
	const now = Number(pool.time_info.now);
	const start = Number(pool.time_info.start_ts);
	const end = Number(pool.time_info.end_ts);
	if (start > now)
		return {
			text: `${duration(start - now)}後開放`,
			color: "#888b91",
			muted: true
		};
	if (!end) return { text: "長期開放", color: "#dccb8e", muted: false };
	if (end < now) return { text: "已結束", color: "#777a80", muted: true };
	return {
		text: `剩餘 ${duration(end - now)}`,
		color: "#dccb8e",
		muted: false
	};
}

function fitText(ctx: any, text: string, maxWidth: number) {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let value = text;
	while (value && ctx.measureText(`${value}…`).width > maxWidth)
		value = value.slice(0, -1);
	return `${value}…`;
}

async function drawItems(ctx: any, items: PoolItem[], x: number, y: number) {
	const size = 76;
	const cell = 91;
	const images = await Promise.all(
		items.map(item => {
			const url = item.icon_url || item.item_url;
			return url ? getSharedImage(url).catch(() => null) : null;
		})
	);

	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const px = x + i * cell;
		const border = item.rarity === "5" ? "#dcb870" : "#9d72d8";
		const gradient = ctx.createLinearGradient(px, y, px, y + size);
		gradient.addColorStop(0, item.rarity === "5" ? "#6f5535" : "#48345f");
		gradient.addColorStop(1, item.rarity === "5" ? "#c49b5e" : "#7651a0");
		roundedRect(ctx, px, y, size, size, 7);
		ctx.fillStyle = gradient;
		ctx.fill();
		ctx.save();
		roundedRect(ctx, px + 2, y + 2, size - 4, size - 4, 5);
		ctx.clip();
		const image = images[i];
		if (image) {
			const side = Math.min(image.width, image.height);
			ctx.drawImage(
				image,
				(image.width - side) / 2,
				(image.height - side) / 2,
				side,
				side,
				px + 2,
				y + 2,
				size - 4,
				size - 4
			);
		}
		ctx.restore();
		ctx.strokeStyle = border;
		ctx.lineWidth = 2;
		roundedRect(ctx, px, y, size, size, 7);
		ctx.stroke();
		ctx.fillStyle = "#dad7cf";
		ctx.font = `13px "CardPoolTW", "CardPoolCN", sans-serif`;
		ctx.textAlign = "center";
		ctx.fillText(
			fitText(ctx, item.item_name, size + 8),
			px + size / 2,
			y + 96
		);
	}
}

export async function buildCardPoolCanvas(data: CardPoolData): Promise<Buffer> {
	const rows = pairCardPools(data);
	if (!rows.length) throw new Error("官方 API 未回傳任何卡池");

	const width = 1400;
	const header = 104;
	const rowHeight = 196;
	const gap = 14;
	const height = header + rows.length * (rowHeight + gap) + 22;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d") as any;
	const font = '"CardPoolTW", "CardPoolCN", sans-serif';

	const background = ctx.createLinearGradient(0, 0, width, height);
	background.addColorStop(0, "#252521");
	background.addColorStop(0.5, "#141618");
	background.addColorStop(1, "#24231f");
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);

	ctx.fillStyle = "#f1e7ca";
	ctx.font = `700 24px ${font}`;
	ctx.textAlign = "left";
	ctx.fillText("角色與光錐躍遷卡池", 34, 55);
	ctx.textAlign = "right";
	ctx.fillStyle = "#d5bf81";
	ctx.font = `700 20px ${font}`;
	ctx.fillText(`版本 ${data.cur_game_version}`, width - 34, 55);

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]!;
		const pool = row.role || row.equipment!;
		const state = timing(pool);
		const y = header + i * (rowHeight + gap);
		ctx.globalAlpha = state.muted ? 0.62 : 1;
		ctx.fillStyle = "#191b1d";
		ctx.strokeStyle = "#3b3d3e";
		ctx.lineWidth = 1;
		roundedRect(ctx, 24, y, width - 48, rowHeight, 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = state.muted ? "#a6a8aa" : "#e5d7ae";
		ctx.fillRect(24, y, 4, rowHeight);

		ctx.fillStyle = "#2b2c2c";
		ctx.strokeStyle = "#5a5548";
		ctx.fillRect(46, y + 18, 48, 25);
		ctx.strokeRect(46, y + 18, 48, 25);
		ctx.fillStyle = state.muted ? "#999b9c" : "#e4d2a0";
		ctx.font = `700 16px ${font}`;
		ctx.textAlign = "center";
		ctx.fillText(pool.version || data.cur_game_version, 70, y + 37);

		ctx.fillStyle = state.color;
		ctx.font = `15px ${font}`;
		ctx.textAlign = "right";
		ctx.fillText(state.text, width - 48, y + 37);
		const clockX = width - 48 - ctx.measureText(state.text).width - 12;
		const clockY = y + 32;
		ctx.strokeStyle = state.color;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(clockX, clockY, 5, 0, Math.PI * 2);
		ctx.moveTo(clockX, clockY);
		ctx.lineTo(clockX, clockY - 3);
		ctx.moveTo(clockX, clockY);
		ctx.lineTo(clockX + 2.5, clockY + 1.5);
		ctx.stroke();

		ctx.fillStyle = "#3b3d3e";
		ctx.fillRect(704, y + 62, 1, 112);

		await drawItems(ctx, row.role?.avatar_list || [], 48, y + 62);
		await drawItems(ctx, row.equipment?.equip_list || [], 734, y + 62);
		ctx.globalAlpha = 1;
	}

	return canvas.toBuffer("image/png");
}
