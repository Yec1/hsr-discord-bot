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

// Legacy multi-account interface kept for backwards compat; prefer single-account overload
export interface HSRRedeemCardPayload {
  accounts: HSRRedeemAccountResult[];
}

// ── Status styling ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  success:         { color: "#c084fc", bg: "rgba(192,132,252,0.18)", border: "rgba(192,132,252,0.50)", label: "兌換成功" },
  already_claimed: { color: "#7ab8d8", bg: "rgba(100,170,220,0.14)", border: "rgba(120,190,240,0.38)", label: "已兌換" },
  invalid:         { color: "#e0b060", bg: "rgba(200,160,60,0.15)",  border: "rgba(220,180,80,0.38)",  label: "無效碼" },
  failed:          { color: "#e08080", bg: "rgba(200,80,80,0.15)",   border: "rgba(220,100,100,0.38)", label: "兌換失敗" },
};

// ── Image cache (LRU, max 100) ─────────────────────────────────────────────────
const IMAGE_CACHE_MAX = 100;
const imageCache = new Map<string, Buffer>();

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  const cached = imageCache.get(url);
  if (cached) {
    imageCache.delete(url);
    imageCache.set(url, cached);
    return cached;
  }
  try {
    const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 8000 });
    const buf = Buffer.from(res.data);
    if (imageCache.size >= IMAGE_CACHE_MAX) {
      const oldest = imageCache.keys().next().value;
      if (oldest) imageCache.delete(oldest);
    }
    imageCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

function roundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
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

// ── Layout ────────────────────────────────────────────────────────────────────
const W = 900;
const H = 360;

// Right-area slot grid — 5 cols, up to 3 rows
const SLOT_COLS = 5;
const SLOT_ROWS_MAX = 3;
const CARD_AREA_X = 224;   // same as dailyCard cardAreaX
const CARD_AREA_W = W - CARD_AREA_X - 20;
const SLOT_GAP_X = 10;
const SLOT_GAP_Y = 10;
const SLOT_W = Math.floor((CARD_AREA_W - SLOT_GAP_X * (SLOT_COLS - 1)) / SLOT_COLS); // ~126
const SLOT_H = 108;

// Total grid height for vertical centering
function gridHeight(rows: number) {
  return rows * SLOT_H + (rows - 1) * SLOT_GAP_Y;
}

// ── Single-account card builder ───────────────────────────────────────────────
export async function buildHSRRedeemCard(
  accountOrPayload: HSRRedeemAccountResult | HSRRedeemCardPayload,
): Promise<Buffer> {
  // Accept both single-account and legacy multi-account payload (use first account)
  const account: HSRRedeemAccountResult =
    "accounts" in accountOrPayload
      ? (accountOrPayload as HSRRedeemCardPayload).accounts[0]!
      : (accountOrPayload as HSRRedeemAccountResult);

  const font = '"HSRFont", "HSRFontTW", sans-serif';
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as any;

  // ── BACKGROUND ───────────────────────────────────────────────────────────────
  const bgPaths = [
    path.join(__dirname, "../../assets/daily-bg.jpg"),
    path.join(process.cwd(), "src/assets/daily-bg.jpg"),
    path.join(process.cwd(), "dist/assets/daily-bg.jpg"),
  ];
  let bgLoaded = false;
  for (const bgPath of bgPaths) {
    if (fs.existsSync(bgPath)) {
      try {
        const bgBuf = fs.readFileSync(bgPath);
        const bgImg = await loadImage(bgBuf);
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const dw = bgImg.width * scale;
        const dh = bgImg.height * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.drawImage(bgImg, dx, dy, dw, dh);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        bgLoaded = true;
        break;
      } catch {
        // continue
      }
    }
  }
  if (!bgLoaded) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#06040e");
    grad.addColorStop(1, "#0a0614");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Left shadow overlay
  const leftShadow = ctx.createLinearGradient(0, 0, W, 0);
  leftShadow.addColorStop(0, "rgba(6,4,14,0.96)");
  leftShadow.addColorStop(0.28, "rgba(6,4,14,0.80)");
  leftShadow.addColorStop(0.55, "rgba(6,4,14,0.10)");
  leftShadow.addColorStop(1, "rgba(6,4,14,0)");
  ctx.fillStyle = leftShadow;
  ctx.fillRect(0, 0, W, H);

  // Bottom fade overlay
  const bottomFade = ctx.createLinearGradient(0, H * 0.5, 0, H);
  bottomFade.addColorStop(0, "rgba(4,3,10,0)");
  bottomFade.addColorStop(1, "rgba(4,3,10,0.6)");
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 0, W, H);

  // ── LEFT COLUMN ──────────────────────────────────────────────────────────────
  const lx = 36;
  const ly = 44;

  // UID
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `13px ${font}`;
  ctx.fillText(`UID  ${account.uid}`, lx, ly + 13);

  // Nickname
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = `bold 32px ${font}`;
  ctx.fillText(account.nickname || account.uid, lx, ly + 13 + 10 + 28);

  // Horizontal divider
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(lx, H / 2, 32, 1);

  // Stats
  const codes = account.codes;
  const successCount = codes.filter(c => c.status === "success").length;
  const alreadyCount = codes.filter(c => c.status === "already_claimed").length;
  const failCount = codes.filter(c => c.status === "failed" || c.status === "invalid").length;

  const statsY = H - 44 - 74;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold 32px ${font}`;
  ctx.fillText(`${successCount}`, lx, statsY + 30);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `12px ${font}`;
  ctx.fillText("兌換成功", lx, statsY + 30 + 16);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold 32px ${font}`;
  ctx.fillText(`${alreadyCount}`, lx, statsY + 30 + 16 + 34);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `12px ${font}`;
  ctx.fillText("已兌換", lx, statsY + 30 + 16 + 34 + 16);

  // ── VERTICAL DIVIDER ─────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(200, 44, 1, H - 88);

  // ── RIGHT COLUMN: CODE SLOTS ─────────────────────────────────────────────────
  const visibleCodes = codes.slice(0, SLOT_COLS * SLOT_ROWS_MAX);
  const rows = Math.max(1, Math.ceil(visibleCodes.length / SLOT_COLS));
  const gh = gridHeight(rows);
  const gridStartY = Math.floor((H - gh) / 2);

  for (let i = 0; i < visibleCodes.length; i++) {
    const codeResult = visibleCodes[i]!;
    const cfg = STATUS_CONFIG[codeResult.status] ?? STATUS_CONFIG.failed;
    const col = i % SLOT_COLS;
    const row = Math.floor(i / SLOT_COLS);

    const sx = CARD_AREA_X + col * (SLOT_W + SLOT_GAP_X);
    const sy = gridStartY + row * (SLOT_H + SLOT_GAP_Y);

    // Slot background
    roundedRect(ctx, sx, sy, SLOT_W, SLOT_H, 12);
    ctx.fillStyle = cfg.bg;
    ctx.fill();
    ctx.strokeStyle = cfg.border;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Code text (centred, truncated)
    ctx.fillStyle = cfg.color;
    ctx.font = `bold 13px ${font}`;
    let codeText = codeResult.code;
    while (ctx.measureText(codeText).width > SLOT_W - 14 && codeText.length > 4) {
      codeText = codeText.slice(0, -2) + "…";
    }
    ctx.fillText(codeText, sx + (SLOT_W - ctx.measureText(codeText).width) / 2, sy + 34);

    // Rewards text
    if (codeResult.rewards) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `11px ${font}`;
      let rText = codeResult.rewards;
      while (ctx.measureText(rText).width > SLOT_W - 12 && rText.length > 6) {
        rText = rText.slice(0, -3) + "…";
      }
      ctx.fillText(rText, sx + (SLOT_W - ctx.measureText(rText).width) / 2, sy + 54);
    }

    // Status label
    ctx.fillStyle = cfg.color;
    ctx.globalAlpha = 0.75;
    ctx.font = `11px ${font}`;
    const stW = ctx.measureText(cfg.label).width;
    ctx.fillText(cfg.label, sx + (SLOT_W - stW) / 2, sy + SLOT_H - 12);
    ctx.globalAlpha = 1.0;
  }

  // ── TIMESTAMP ─────────────────────────────────────────────────────────────────
  const ts = moment().tz("Asia/Taipei").format("YYYY/MM/DD · HH:mm") + " CST";
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `12px ${font}`;
  const tsW = ctx.measureText(ts).width;
  ctx.fillText(ts, W - 36 - tsW, H - 20);

  // ── FOOTER SUMMARY ────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `成功 ${successCount}  ·  已兌換 ${alreadyCount}  ·  失敗 ${failCount}  ·  共 ${codes.length} 個`,
    lx,
    H - 20,
  );

  return canvas.toBuffer("image/png");
}
