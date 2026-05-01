import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
  rewards?: string; // single string from seria.moe
  status: "success" | "already_claimed" | "invalid" | "failed";
}

export interface HSRRedeemAccountResult {
  uid: string;
  codes: HSRRedeemCodeResult[];
}

export interface HSRRedeemCardPayload {
  accounts: HSRRedeemAccountResult[];
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

const STATUS_CONFIG = {
  success: { icon: "✅", color: "#c084fc", bg: "rgba(192,132,252,0.13)", border: "rgba(192,132,252,0.38)" },
  already_claimed: { icon: "🔁", color: "#7ab8d8", bg: "rgba(100,170,220,0.10)", border: "rgba(120,190,240,0.28)" },
  invalid: { icon: "⚠️", color: "#e0b060", bg: "rgba(200,160,60,0.12)", border: "rgba(220,180,80,0.30)" },
  failed: { icon: "❌", color: "#e08080", bg: "rgba(200,80,80,0.12)", border: "rgba(220,100,100,0.30)" },
};

export async function buildHSRRedeemCard(
  payload: HSRRedeemCardPayload,
): Promise<Buffer> {
  const font = '"HSRFont", "HSRFontTW", sans-serif';

  const W = 900;
  const HEADER_H = 80;
  const ACCOUNT_HEADER_H = 50;
  const CODE_ROW_H = 64;
  const PADDING = 28;
  const FOOTER_H = 40;

  let totalCodes = 0;
  const accountCount = payload.accounts.length;
  for (const acc of payload.accounts) {
    totalCodes += acc.codes.length;
  }
  const H = Math.max(
    320,
    PADDING * 2 +
      HEADER_H +
      accountCount * ACCOUNT_HEADER_H +
      totalCodes * CODE_ROW_H +
      FOOTER_H,
  );

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0e0a18");
  bg.addColorStop(0.5, "#130f20");
  bg.addColorStop(1, "#1a1228");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer panel
  const px = PADDING, py = PADDING, pw = W - PADDING * 2, ph = H - PADDING * 2;
  roundedRect(ctx, px, py, pw, ph, 20);
  ctx.fillStyle = "rgba(8, 6, 14, 0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(192, 132, 252, 0.22)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Accent bar
  ctx.fillStyle = "#c084fc";
  roundedRect(ctx, px, py + 16, 4, ph - 32, 2);
  ctx.fill();

  // Header
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 36px ${font}`;
  ctx.fillText("兌換碼兌換結果", px + 24, py + 46);

  ctx.fillStyle = "#7a5a9a";
  ctx.font = `18px ${font}`;
  const ts = moment().tz("Asia/Taipei").format("YYYY/MM/DD HH:mm");
  const tsW = ctx.measureText(ts).width;
  ctx.fillText(ts, W - px - tsW - 8, py + 46);

  // Divider
  ctx.strokeStyle = "rgba(192, 132, 252, 0.20)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + HEADER_H - 4);
  ctx.lineTo(px + pw - 16, py + HEADER_H - 4);
  ctx.stroke();

  let curY = py + HEADER_H;

  for (const acc of payload.accounts) {
    ctx.fillStyle = "#d8b4fe";
    ctx.font = `bold 24px ${font}`;
    ctx.fillText(`UID ${acc.uid}`, px + 24, curY + 32);
    curY += ACCOUNT_HEADER_H;

    for (const codeResult of acc.codes) {
      const cfg = STATUS_CONFIG[codeResult.status] || STATUS_CONFIG.failed;

      roundedRect(ctx, px + 16, curY + 4, pw - 32, CODE_ROW_H - 8, 12);
      ctx.fillStyle = cfg.bg;
      ctx.fill();
      ctx.strokeStyle = cfg.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `22px ${font}`;
      ctx.fillText(cfg.icon, px + 30, curY + CODE_ROW_H / 2 + 9);

      ctx.fillStyle = cfg.color;
      ctx.font = `bold 22px ${font}`;
      ctx.fillText(codeResult.code, px + 64, curY + CODE_ROW_H / 2 + 9);

      if (codeResult.rewards) {
        ctx.fillStyle = "#8a6aaa";
        ctx.font = `16px ${font}`;
        let displayText = codeResult.rewards;
        const maxW = pw - 280;
        while (ctx.measureText(displayText).width > maxW && displayText.length > 10) {
          displayText = displayText.slice(0, -4) + "…";
        }
        ctx.fillText(displayText, W - px - ctx.measureText(displayText).width - 24, curY + CODE_ROW_H / 2 + 9);
      }

      curY += CODE_ROW_H;
    }
    curY += 8;
  }

  const allCodes = payload.accounts.flatMap((a) => a.codes);
  const successCount = allCodes.filter((c) => c.status === "success").length;
  const failCount = allCodes.filter((c) => c.status === "failed" || c.status === "invalid").length;

  ctx.fillStyle = "#4a3a6a";
  ctx.font = `16px ${font}`;
  ctx.fillText(
    `成功 ${successCount} / 失敗 ${failCount} / 共 ${allCodes.length} 個`,
    px + 24,
    H - PADDING - 8,
  );

  return canvas.toBuffer("image/png");
}
