import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

const assetDir = path.join(process.cwd(), "src/assets");
const fontCandidates = [
  { file: "YaHei.ttf", family: "HSRFont" },
  { file: "zh-tw.ttf", family: "HSRFontTW" },
];
for (const { file, family } of fontCandidates) {
  const candidates = [
    path.join(assetDir, file),
    path.join(process.cwd(), "dist/assets", file),
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

export const HSR_REDEEM_BACKGROUND = path.join(assetDir, "daily-bg.jpg");

const STATUS_CONFIG = {
  success: { color: "#C9F36A", label: "兌換成功", fallback: "獎勵將透過遊戲內信件發送" },
  already_claimed: { color: "#8FD7FF", label: "已兌換", fallback: "此兌換碼已使用" },
  invalid: { color: "#FFD86B", label: "兌換碼無效", fallback: "此兌換碼已失效或無法使用" },
  failed: { color: "#FF9B9B", label: "兌換失敗", fallback: "本次兌換未完成" },
} as const;

const WIDTH = 920;
const HEADER_HEIGHT = 82;
const FOOTER_HEIGHT = 30;
const ACCOUNT_HEADER_HEIGHT = 66;
const ROW_HEIGHT = 88;
const ROW_GAP = 10;
const ACCOUNT_PADDING_BOTTOM = 16;
const GRID_X = 34;
const ICON_SIZE = 58;
const rewardIconCache = new Map<string, Promise<any | null>>();

export function getHSRRedeemCardLayout(codeCount: number): HSRRedeemCardLayout {
  const visibleCodeCount = Math.max(0, Math.floor(codeCount));
  const rows = Math.max(1, visibleCodeCount);
  const gridY = HEADER_HEIGHT + ACCOUNT_HEADER_HEIGHT;
  return {
    width: WIDTH,
    height: Math.max(
      280,
      HEADER_HEIGHT +
        FOOTER_HEIGHT +
        ACCOUNT_HEADER_HEIGHT +
        rows * ROW_HEIGHT +
        Math.max(0, rows - 1) * ROW_GAP +
        ACCOUNT_PADDING_BOTTOM,
    ),
    columns: 1,
    rows: visibleCodeCount,
    visibleCodeCount,
    gridX: GRID_X,
    gridY,
    itemWidth: WIDTH - GRID_X * 2,
    itemHeight: ROW_HEIGHT,
    columnGap: 0,
    rowGap: ROW_GAP,
  };
}

export function maskHSRRedeemUid(uid: string): string {
  const normalized = uid.trim();
  if (!normalized) return "—";
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 3)}${"*".repeat(normalized.length - 5)}${normalized.slice(-2)}`;
}

export function getFirstHSRRedeemRewardIcon(
  rewardIcons?: readonly string[],
): string | undefined {
  return rewardIcons
    ?.find((icon) => typeof icon === "string" && Boolean(icon.trim()))
    ?.trim();
}

function roundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
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

function fitText(
  ctx: any,
  text: string,
  maxWidth: number,
  font: string,
  startSize: number,
  minimumSize: number,
): void {
  let size = startSize;
  do {
    ctx.font = `bold ${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth || size <= minimumSize) return;
    size -= 1;
  } while (size >= minimumSize);
}

function ellipsize(ctx: any, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

async function loadImageSource(source?: string): Promise<any | null> {
  const normalized = source?.trim();
  if (!normalized) return null;
  const cached = rewardIconCache.get(normalized);
  if (cached) return cached;

  const loading = (async () => {
    try {
      if (normalized.startsWith("data:") || fs.existsSync(normalized)) {
        return await loadImage(normalized);
      }
      const response = await fetch(normalized, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      return await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch {
      return null;
    }
  })();
  rewardIconCache.set(normalized, loading);
  return loading;
}

function drawCover(
  ctx: any,
  image: any,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

async function drawBackground(ctx: any, width: number, height: number): Promise<void> {
  const image = await loadImageSource(HSR_REDEEM_BACKGROUND);
  if (image) {
    drawCover(ctx, image, 0, 0, width, height);
    const overlay = ctx.createLinearGradient(0, 0, width, height);
    overlay.addColorStop(0, "rgba(7, 10, 29, 0.47)");
    overlay.addColorStop(1, "rgba(14, 8, 31, 0.62)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const fallback = ctx.createLinearGradient(0, 0, width, height);
  fallback.addColorStop(0, "#151228");
  fallback.addColorStop(1, "#080B19");
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, width, height);
}

function drawRewardIcon(ctx: any, image: any, x: number, y: number): void {
  const scale = Math.min((ICON_SIZE - 8) / image.width, (ICON_SIZE - 8) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(
    image,
    x + (ICON_SIZE - width) / 2,
    y + (ICON_SIZE - height) / 2,
    width,
    height,
  );
}

async function drawCodeRow(
  ctx: any,
  result: HSRRedeemCodeResult,
  x: number,
  y: number,
  width: number,
  height: number,
  font: string,
): Promise<void> {
  const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.failed;
  const icon = await loadImageSource(result.rewardIcon);

  roundedRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = "rgba(5, 8, 24, 0.68)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = config.color;
  ctx.fillRect(x, y + 12, 3, height - 24);

  let textX = x + 22;
  if (icon) {
    const iconX = x + 15;
    const iconY = y + (height - ICON_SIZE) / 2;
    roundedRect(ctx, iconX, iconY, ICON_SIZE, ICON_SIZE, 10);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    drawRewardIcon(ctx, icon, iconX, iconY);
    textX = iconX + ICON_SIZE + 16;
  }

  const statusWidth = 125;
  ctx.fillStyle = "#FFFFFF";
  fitText(ctx, result.code, width - (textX - x) - statusWidth - 25, font, 22, 16);
  ctx.fillText(result.code, textX, y + 34);

  ctx.font = `15px ${font}`;
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  const rewardText = result.rewards?.trim() || config.fallback;
  ctx.fillText(
    ellipsize(ctx, rewardText, width - (textX - x) - 25),
    textX,
    y + 62,
  );

  ctx.textAlign = "right";
  ctx.font = `bold 14px ${font}`;
  ctx.fillStyle = config.color;
  ctx.fillText(config.label, x + width - 18, y + 33);
  ctx.textAlign = "left";
}

export async function buildHSRRedeemCard(
  accountOrPayload: HSRRedeemAccountResult | HSRRedeemCardPayload,
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
  ctx.fillStyle = "#DABEFF";
  ctx.fillRect(34, 29, 5, 31);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 27px ${font}`;
  ctx.fillText("自動兌換", 53, 54);

  const nickname = account.nickname?.trim() || "開拓者";
  ctx.fillStyle = "#F5F2FF";
  fitText(ctx, nickname, 520, font, 23, 17);
  ctx.fillText(nickname, 34, 109);
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = `16px ${font}`;
  ctx.fillText(`UID ${maskHSRRedeemUid(account.uid)}`, 34, 134);

  if (account.codes.length === 0) {
    await drawCodeRow(
      ctx,
      { code: "沒有新的兌換碼", status: "already_claimed" },
      layout.gridX,
      layout.gridY,
      layout.itemWidth,
      layout.itemHeight,
      font,
    );
  } else {
    for (let index = 0; index < account.codes.length; index += 1) {
      await drawCodeRow(
        ctx,
        account.codes[index]!,
        layout.gridX,
        layout.gridY + index * (layout.itemHeight + layout.rowGap),
        layout.itemWidth,
        layout.itemHeight,
        font,
      );
    }
  }

  return canvas.toBuffer("image/png");
}
