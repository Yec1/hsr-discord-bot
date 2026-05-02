import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
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

const STATUS_CONFIG = {
  success:        { icon: "✅", color: "#c084fc", bg: "rgba(192,132,252,0.18)", border: "rgba(192,132,252,0.50)" },
  already_claimed:{ icon: "🔁", color: "#7ab8d8", bg: "rgba(100,170,220,0.14)", border: "rgba(120,190,240,0.38)" },
  invalid:        { icon: "⚠️", color: "#e0b060", bg: "rgba(200,160,60,0.15)", border: "rgba(220,180,80,0.38)" },
  failed:         { icon: "❌", color: "#e08080", bg: "rgba(200,80,80,0.15)", border: "rgba(220,100,100,0.38)" },
};

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

// ── Layout constants ──────────────────────────────────────────────────────────
const W = 900;
const LEFT_W = 200;          // left info column width
const PADDING = 28;
const SLOT_COLS = 4;         // code slots per row
const SLOT_W = 148;          // slot width
const SLOT_H = 110;          // slot height
const SLOT_GAP = 14;         // gap between slots
const ACC_HEADER_H = 56;     // per-account header height
const ACC_GAP = 20;          // gap between accounts
const TOP_H = 72;            // global header height
const BOTTOM_H = 40;         // footer height

function calcHeight(accounts: HSRRedeemAccountResult[]): number {
  let h = PADDING * 2 + TOP_H;
  for (let i = 0; i < accounts.length; i++) {
    const codes = accounts[i]!.codes.length || 1;
    const rows = Math.ceil(codes / SLOT_COLS);
    h += ACC_HEADER_H + rows * (SLOT_H + SLOT_GAP);
    if (i < accounts.length - 1) h += ACC_GAP;
  }
  h += BOTTOM_H;
  return Math.max(320, h);
}

export async function buildHSRRedeemCard(payload: HSRRedeemCardPayload): Promise<Buffer> {
  const font = '"HSRFont", "HSRFontTW", sans-serif';
  const H = calcHeight(payload.accounts);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as any;

  // ── BACKGROUND ──────────────────────────────────────────────────────────────
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
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, 0, W, H);
        bgLoaded = true;
        break;
      } catch {
        // continue
      }
    }
  }
  if (!bgLoaded) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0e0a18");
    grad.addColorStop(0.5, "#130f20");
    grad.addColorStop(1, "#1a1228");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Left shadow overlay (same as dailyCard)
  const leftShadow = ctx.createLinearGradient(0, 0, W, 0);
  leftShadow.addColorStop(0, "rgba(6,4,14,0.96)");
  leftShadow.addColorStop(0.22, "rgba(6,4,14,0.80)");
  leftShadow.addColorStop(0.45, "rgba(6,4,14,0.10)");
  leftShadow.addColorStop(1, "rgba(6,4,14,0)");
  ctx.fillStyle = leftShadow;
  ctx.fillRect(0, 0, W, H);

  // Bottom fade
  const bottomFade = ctx.createLinearGradient(0, H * 0.6, 0, H);
  bottomFade.addColorStop(0, "rgba(4,3,10,0)");
  bottomFade.addColorStop(1, "rgba(4,3,10,0.55)");
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 0, W, H);

  // ── GLOBAL HEADER ───────────────────────────────────────────────────────────
  const lx = 36;
  const headerY = PADDING;

  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = `bold 30px ${font}`;
  ctx.fillText("兌換碼兌換結果", lx, headerY + 36);

  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.font = `13px ${font}`;
  const ts = moment().tz("Asia/Taipei").format("YYYY/MM/DD · HH:mm") + " CST";
  ctx.fillText(ts, lx, headerY + 56);

  // Accent bar under header
  ctx.fillStyle = "rgba(192,132,252,0.45)";
  ctx.fillRect(lx, headerY + TOP_H - 4, W - lx - PADDING, 1);

  // ── PER-ACCOUNT BLOCKS ──────────────────────────────────────────────────────
  const codeAreaX = LEFT_W + PADDING;
  const codeAreaW = W - codeAreaX - PADDING;

  let curY = PADDING + TOP_H;

  // All-account summary (success count)
  const allCodes = payload.accounts.flatMap(a => a.codes);
  const successCount = allCodes.filter(c => c.status === "success").length;
  const alreadyCount = allCodes.filter(c => c.status === "already_claimed").length;
  const failCount = allCodes.filter(c => c.status === "failed" || c.status === "invalid").length;

  for (let ai = 0; ai < payload.accounts.length; ai++) {
    const acc = payload.accounts[ai]!;

    // ── Account header (left) ──
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `12px ${font}`;
    ctx.fillText(`UID  ${acc.uid}`, lx, curY + 16);

    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = `bold 22px ${font}`;
    ctx.fillText(acc.nickname || acc.uid, lx, curY + 16 + 22);

    // Vertical separator
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(LEFT_W, curY + 4, 1, ACC_HEADER_H - 8);

    // ── Code slots (right) ──
    const codes = acc.codes;
    const rows = Math.ceil((codes.length || 1) / SLOT_COLS);

    for (let ri = 0; ri < rows; ri++) {
      const rowY = curY + (ri * (SLOT_H + SLOT_GAP));
      const rowCodes = codes.slice(ri * SLOT_COLS, (ri + 1) * SLOT_COLS);

      for (let ci = 0; ci < rowCodes.length; ci++) {
        const codeResult = rowCodes[ci]!;
        const cfg = STATUS_CONFIG[codeResult.status] || STATUS_CONFIG.failed;

        const sx = codeAreaX + ci * (SLOT_W + SLOT_GAP);
        const sy = rowY + ACC_HEADER_H;

        // Slot background
        roundedRect(ctx, sx, sy, SLOT_W, SLOT_H, 14);
        ctx.fillStyle = cfg.bg;
        ctx.fill();
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Code text (truncate if too long)
        ctx.fillStyle = cfg.color;
        ctx.font = `bold 15px ${font}`;
        let codeText = codeResult.code;
        while (ctx.measureText(codeText).width > SLOT_W - 16 && codeText.length > 4) {
          codeText = codeText.slice(0, -2) + "…";
        }
        const codeW = ctx.measureText(codeText).width;
        ctx.fillText(codeText, sx + (SLOT_W - codeW) / 2, sy + 56);

        // Rewards text (small, below code)
        if (codeResult.rewards) {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.font = `11px ${font}`;
          let rewardsText = codeResult.rewards;
          while (ctx.measureText(rewardsText).width > SLOT_W - 12 && rewardsText.length > 6) {
            rewardsText = rewardsText.slice(0, -3) + "…";
          }
          const rw = ctx.measureText(rewardsText).width;
          ctx.fillText(rewardsText, sx + (SLOT_W - rw) / 2, sy + 74);
        }

        // Status label
        const statusLabels = {
          success: "兌換成功",
          already_claimed: "已兌換",
          invalid: "無效碼",
          failed: "兌換失敗",
        };
        ctx.fillStyle = cfg.color;
        ctx.globalAlpha = 0.7;
        ctx.font = `11px ${font}`;
        const stLabel = statusLabels[codeResult.status] || "失敗";
        const stW = ctx.measureText(stLabel).width;
        ctx.fillText(stLabel, sx + (SLOT_W - stW) / 2, sy + SLOT_H - 10);
        ctx.globalAlpha = 1.0;
      }
    }

    curY += ACC_HEADER_H + rows * (SLOT_H + SLOT_GAP);
    if (ai < payload.accounts.length - 1) {
      // Divider between accounts
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(lx, curY + 4, W - lx - PADDING, 1);
      curY += ACC_GAP;
    }
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `成功 ${successCount}  ·  已兌換 ${alreadyCount}  ·  失敗 ${failCount}  ·  共 ${allCodes.length} 個`,
    lx,
    H - PADDING + 8,
  );

  return canvas.toBuffer("image/png");
}
