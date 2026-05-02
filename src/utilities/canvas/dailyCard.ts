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

export interface DayReward {
  name: string;
  icon?: string;
  count: number;
}

export interface HSRDailyCardPayload {
  uid: string;
  nickname: string;
  status: "success" | "already_signed";
  totalDays: number;
  month: number;
  signCntMissed?: number;
  yesterdayReward?: DayReward & { claimed: boolean };
  todayReward: DayReward;
  nextRewards: [DayReward, DayReward, DayReward];
  // i18n labels (pre-translated by caller; hardcoded Chinese as fallback)
  labelMonthCumulativeDays?: string; // e.g. "3月累計天數"
  labelMissedDays?: string;          // e.g. "漏簽天數"
  labelDays?: [string, string, string, string, string]; // [昨天,今天,明天,後天,大後天]
  labelClaimed?: string;             // e.g. "已領取"
  labelMissed?: string;              // e.g. "未簽到"
  labelCheckedIn?: string;           // e.g. "已簽到"
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

export async function buildHSRDailyCard(
  payload: HSRDailyCardPayload,
): Promise<Buffer> {
  const W = 900;
  const H = 360;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as any;

  const font = '"HSRFont", "HSRFontTW", sans-serif';

  // ── BACKGROUND ──
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
        // Cover-crop centered
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const dw = bgImg.width * scale;
        const dh = bgImg.height * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.drawImage(bgImg, dx, dy, dw, dh);
        // Dark overlay to simulate brightness(0.45) saturate(0.9)
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        bgLoaded = true;
        break;
      } catch {
        // continue to next path
      }
    }
  }
  if (!bgLoaded) {
    // Fallback gradient
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

  // ── LEFT COLUMN ──
  const lx = 36;
  const ly = 44;

  // UID
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `13px ${font}`;
  ctx.fillText(`UID  ${payload.uid}`, lx, ly + 13);

  // Nickname
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = `bold 32px ${font}`;
  ctx.fillText(payload.nickname, lx, ly + 13 + 10 + 28);

  // Horizontal divider — vertically centered in column
  const dividerY = H / 2;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(lx, dividerY, 32, 1);

  // Stats block ~64px from bottom
  const statsY = H - 44 - 74;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold 32px ${font}`;
  ctx.fillText(`${payload.totalDays}`, lx, statsY + 30);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `12px ${font}`;
  ctx.fillText(payload.labelMonthCumulativeDays ?? `${payload.month}月累計天數`, lx, statsY + 30 + 16);

  if (payload.signCntMissed !== undefined) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(`${payload.signCntMissed}`, lx, statsY + 30 + 16 + 34);

    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `12px ${font}`;
    ctx.fillText(payload.labelMissedDays ?? "漏簽天數", lx, statsY + 30 + 16 + 34 + 16);
  }

  // ── VERTICAL DIVIDER ──
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(200, 44, 1, H - 88);

  // ── RIGHT COLUMN: 5-DAY CARDS ──
  const now = moment().tz("Asia/Taipei");
  const dayLabels = payload.labelDays ?? ["昨天", "今天", "明天", "後天", "大後天"] as [string,string,string,string,string];
  const cardAreaX = 224;
  const cardAreaW = W - cardAreaX - 20;
  const slotW = cardAreaW / 5;

  // Build slot data
  type SlotState = "past-claimed" | "past-missed" | "active" | "future";
  interface Slot {
    label: string;
    date: string;
    reward: DayReward;
    state: SlotState;
  }

  const slots: Slot[] = [
    {
      label: dayLabels[0],
      date: now.clone().subtract(1, "day").format("M/DD"),
      reward: payload.yesterdayReward ?? { name: "—", count: 0 },
      state: payload.yesterdayReward?.claimed ? "past-claimed" : "past-missed",
    },
    {
      label: dayLabels[1],
      date: now.format("M/DD"),
      reward: payload.todayReward,
      state: "active",
    },
    {
      label: dayLabels[2],
      date: now.clone().add(1, "day").format("M/DD"),
      reward: payload.nextRewards[0],
      state: "future",
    },
    {
      label: dayLabels[3],
      date: now.clone().add(2, "day").format("M/DD"),
      reward: payload.nextRewards[1],
      state: "future",
    },
    {
      label: dayLabels[4],
      date: now.clone().add(3, "day").format("M/DD"),
      reward: payload.nextRewards[2],
      state: "future",
    },
  ];

  const iconBoxSize = 96;
  const iconPad = 12;

  // Vertical center for icon boxes
  const iconBoxY = Math.floor((H - iconBoxSize) / 2);
  const iconCenterY = iconBoxY + iconBoxSize / 2;

  for (let i = 0; i < 5; i++) {
    const slot = slots[i]!;
    const slotCenterX = Math.floor(cardAreaX + slotW * i + slotW / 2);
    const iconBoxX = slotCenterX - iconBoxSize / 2;

    // Set alpha
    const alpha =
      slot.state === "active" ? 1.0 : slot.state === "future" ? 0.55 : 0.32;
    ctx.globalAlpha = alpha;

    // Day label
    const dayLabelColor =
      slot.state === "active"
        ? "rgba(255,255,255,0.70)"
        : "rgba(255,255,255,0.25)";
    ctx.fillStyle = dayLabelColor;
    ctx.font = `13px ${font}`;
    const dayLabelW = ctx.measureText(slot.label).width;
    ctx.fillText(slot.label, slotCenterX - dayLabelW / 2, iconBoxY - 28);

    // Date
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.font = `12px ${font}`;
    const dateW = ctx.measureText(slot.date).width;
    ctx.fillText(slot.date, slotCenterX - dateW / 2, iconBoxY - 14);

    // Icon box background
    const bgColor =
      slot.state === "active"
        ? "rgba(255,255,255,0.10)"
        : "rgba(255,255,255,0.06)";
    roundedRect(ctx, iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 10);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Icon box border
    const borderColor =
      slot.state === "active"
        ? "rgba(255,255,255,0.35)"
        : "rgba(255,255,255,0.09)";
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon image
    if (slot.reward.icon) {
      const iconBuf = await loadImageBuffer(slot.reward.icon);
      if (iconBuf) {
        try {
          const img = await loadImage(iconBuf);
          const innerSize = iconBoxSize - iconPad * 2;
          const scale = Math.min(innerSize / img.width, innerSize / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const ox = iconBoxX + iconPad + (innerSize - dw) / 2;
          const oy = iconBoxY + iconPad + (innerSize - dh) / 2;
          ctx.drawImage(img, ox, oy, dw, dh);
        } catch {
          // skip
        }
      }
    }

    // Checkmark badge (past-claimed)
    if (slot.state === "past-claimed") {
      const badgeX = iconBoxX + iconBoxSize - 8;
      const badgeY = iconBoxY - 8;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.20)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `10px ${font}`;
      ctx.fillText("✓", badgeX - 3, badgeY + 4);
    }

    // Reward name + count
    const rewardColor =
      slot.state === "active"
        ? "rgba(255,255,255,0.90)"
        : "rgba(255,255,255,0.55)";
    ctx.fillStyle = rewardColor;
    ctx.font =
      slot.state === "active" ? `600 13px ${font}` : `13px ${font}`;
    const rewardText = `${slot.reward.name} ×${slot.reward.count}`;
    const rewardW = ctx.measureText(rewardText).width;
    ctx.fillText(rewardText, slotCenterX - rewardW / 2, iconBoxY + iconBoxSize + 20);

    // Status text (yesterday and today only)
    if (slot.state === "past-claimed") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `11px ${font}`;
      const st = payload.labelClaimed ?? "已領取";
      const stW = ctx.measureText(st).width;
      ctx.fillText(st, slotCenterX - stW / 2, iconBoxY + iconBoxSize + 36);
    } else if (slot.state === "past-missed") {
      ctx.fillStyle = "rgba(255,80,80,0.8)";
      ctx.font = `11px ${font}`;
      const st = payload.labelMissed ?? "未簽到";
      const stW = ctx.measureText(st).width;
      ctx.fillText(st, slotCenterX - stW / 2, iconBoxY + iconBoxSize + 36);
    } else if (slot.state === "active") {
      ctx.fillStyle = "#86efac";
      ctx.font = `11px ${font}`;
      const st = payload.labelCheckedIn ?? "已簽到";
      const stW = ctx.measureText(st).width;
      ctx.fillText(st, slotCenterX - stW / 2, iconBoxY + iconBoxSize + 36);
    }

    // Arrow between cards (after each card except last)
    if (i < 4) {
      ctx.globalAlpha = 0.45;
      const nextSlotCenterX = Math.floor(cardAreaX + slotW * (i + 1) + slotW / 2);
      const arrowX = Math.floor((slotCenterX + nextSlotCenterX) / 2);
      const arrowY = iconCenterY;
      const aw = 10;
      const ah = 7;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(arrowX + aw / 2, arrowY);
      ctx.lineTo(arrowX - aw / 2, arrowY - ah / 2);
      ctx.lineTo(arrowX - aw / 2, arrowY + ah / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1.0;

  // ── TIMESTAMP ──
  const ts = moment().tz("Asia/Taipei").format("YYYY/MM/DD · HH:mm") + " CST";
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `12px ${font}`;
  const tsW = ctx.measureText(ts).width;
  ctx.fillText(ts, W - 36 - tsW, H - 20);

  return canvas.toBuffer("image/png");
}
