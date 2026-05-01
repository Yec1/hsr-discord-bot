import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import axios from "axios";
import moment from "moment-timezone";

// Register fonts
const assetDir = path.join(__dirname, "../../assets");
const fontCandidates = [
  { file: "YaHei.ttf", family: "HSRFont" },
  { file: "zh-tw.ttf", family: "HSRFontTW" },
];
for (const { file, family } of fontCandidates) {
  const candidates = [
    path.join(assetDir, file),
    path.join(process.cwd(), "src/assets", file),
    path.join(process.cwd(), "dist/assets", file),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, family);
      break;
    }
  }
}

export interface HSRDailyCardPayload {
  uid: string;
  status: "success" | "already_signed";
  rewardName: string;
  rewardIcon?: string;
  rewardCount: number;
  totalDays: number;
  month: number;
  signCntMissed?: number;
  monthLastDay?: boolean;
  tmrRewardName?: string;
  tmrRewardIcon?: string;
  tmrRewardCount?: number;
}

const imageCache = new Map<string, Buffer>();

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  const cached = imageCache.get(url);
  if (cached) return cached;
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 8000,
    });
    const buf = Buffer.from(res.data);
    imageCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

function roundedRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function drawIconBox(
  ctx: any,
  iconBuffer: Buffer | null,
  fallbackLabel: string,
  font: string,
  x: number,
  y: number,
  size: number,
  accentColor: string,
) {
  roundedRect(ctx, x - 8, y - 8, size + 16, size + 16, 14);
  ctx.fillStyle = "rgba(192, 132, 252, 0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(192, 132, 252, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (iconBuffer) {
    try {
      const img = await loadImage(iconBuffer);
      const ratio = Math.min(size / img.width, size / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
      return;
    } catch {}
  }
  // Fallback text
  ctx.fillStyle = accentColor;
  ctx.font = `bold 26px ${font}`;
  const initials = (fallbackLabel || "?").slice(0, 2);
  const tw = ctx.measureText(initials).width;
  ctx.fillText(initials, x + (size - tw) / 2, y + size / 2 + 10);
}

export async function buildHSRDailyCard(
  payload: HSRDailyCardPayload,
): Promise<Buffer> {
  const W = 900;
  const H = payload.monthLastDay ? 320 : 360;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const font = '"HSRFont", "HSRFontTW", sans-serif';
  const accent = "#c084fc";

  // Background gradient — HSR dark purple theme
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0e0a18");
  bg.addColorStop(0.5, "#130f20");
  bg.addColorStop(1, "#1a1228");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer panel
  const px = 28, py = 24, pw = W - 56, ph = H - 48;
  roundedRect(ctx, px, py, pw, ph, 20);
  ctx.fillStyle = "rgba(8, 6, 14, 0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(192, 132, 252, 0.26)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Accent bar left
  ctx.fillStyle = accent;
  roundedRect(ctx, px, py + 20, 4, ph - 40, 2);
  ctx.fill();

  // ── LEFT: UID ──
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 34px ${font}`;
  ctx.fillText(`UID ${payload.uid}`, px + 24, py + 54);

  // Status badge
  const signed = payload.status === "success";
  const badgeText = signed ? "✔ 簽到成功" : "✔ 已簽到";
  const badgeColor = signed ? accent : "#a0b8d0";
  roundedRect(ctx, px + 24, py + 70, 150, 36, 10);
  ctx.fillStyle = signed
    ? "rgba(192, 132, 252, 0.16)"
    : "rgba(160, 184, 208, 0.12)";
  ctx.fill();
  ctx.strokeStyle = signed
    ? "rgba(192, 132, 252, 0.50)"
    : "rgba(160, 184, 208, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = badgeColor;
  ctx.font = `bold 20px ${font}`;
  ctx.fillText(badgeText, px + 36, py + 94);

  // ── CENTER: Today reward icon ──
  const iconSize = 112;
  const centerX = Math.floor(W / 2);
  const iconX = centerX - iconSize / 2 - (payload.monthLastDay ? 0 : 80);
  const iconY = py + 36;

  const todayBuffer = payload.rewardIcon
    ? await loadImageBuffer(payload.rewardIcon)
    : null;
  await drawIconBox(ctx, todayBuffer, payload.rewardName, font, iconX, iconY, iconSize, accent);

  ctx.fillStyle = "#8a6aaa";
  ctx.font = `16px ${font}`;
  const todayLbl = "今日獎勵";
  ctx.fillText(todayLbl, iconX, iconY - 14);

  ctx.fillStyle = "#e5c8ff";
  ctx.font = `bold 20px ${font}`;
  const rewardLabel = `${payload.rewardName} ×${payload.rewardCount}`;
  const rlW = ctx.measureText(rewardLabel).width;
  ctx.fillText(rewardLabel, iconX + (iconSize - rlW) / 2, iconY + iconSize + 28);

  // Tomorrow reward icon (only if not last day)
  if (!payload.monthLastDay && payload.tmrRewardName) {
    const tmrIconX = centerX + 10;
    const tmrBuf = payload.tmrRewardIcon
      ? await loadImageBuffer(payload.tmrRewardIcon)
      : null;

    // Dim the tomorrow box
    ctx.globalAlpha = 0.65;
    await drawIconBox(ctx, tmrBuf, payload.tmrRewardName, font, tmrIconX, iconY, iconSize, "#7a5aaa");
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#6a4a8a";
    ctx.font = `16px ${font}`;
    ctx.fillText("明日獎勵", tmrIconX, iconY - 14);

    ctx.fillStyle = "#9a80b8";
    ctx.font = `18px ${font}`;
    const tmrLabel = `${payload.tmrRewardName} ×${payload.tmrRewardCount ?? 1}`;
    const tmrLW = ctx.measureText(tmrLabel).width;
    ctx.fillText(tmrLabel, tmrIconX + (iconSize - tmrLW) / 2, iconY + iconSize + 28);
  }

  // ── RIGHT: Stats ──
  const rightX = W - px - 220;
  const statsStartY = py + 52;
  const lineH = 54;

  const stats: [string, string][] = [
    [`${payload.month} 月簽到`, `${payload.totalDays} 天`],
  ];
  if (payload.signCntMissed !== undefined) {
    stats.push(["漏簽天數", `${payload.signCntMissed} 天`]);
  }

  for (let i = 0; i < stats.length; i++) {
    const item = stats[i] as [string, string];
    const [label, value] = item;
    const sy = statsStartY + i * lineH;
    ctx.fillStyle = "#7a5a9a";
    ctx.font = `18px ${font}`;
    ctx.fillText(label, rightX, sy);
    ctx.fillStyle = "#d8b4fe";
    ctx.font = `bold 30px ${font}`;
    ctx.fillText(value, rightX, sy + 30);
  }

  // Timestamp bottom right
  const ts = moment().tz("Asia/Taipei").format("YYYY/MM/DD HH:mm");
  ctx.fillStyle = "#4a3a6a";
  ctx.font = `16px ${font}`;
  const tsW = ctx.measureText(ts).width;
  ctx.fillText(ts, W - px - tsW - 8, H - py - 8);

  return canvas.toBuffer("image/png");
}
