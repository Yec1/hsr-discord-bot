import { drawInQueueReply, secondsToHms } from "@/utilities/index.js";
import {
	EmbedBuilder,
	AttachmentBuilder,
	ChatInputCommandInteraction
} from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { join } from "path";
import Logger from "@/utilities/core/logger.js";
import Queue from "queue";
import moment from "moment";

interface NoteResponse {
	stamina_recover_time: number;
	current_stamina: number;
	max_stamina: number;
	current_train_score: number;
	max_train_score: number;
	weekly_cocoon_cnt: number;
	weekly_cocoon_limit: number;
	rogue_tourn_weekly_unlocked: boolean;
	rogue_tourn_weekly_cur: number;
	rogue_tourn_weekly_max: number;
	current_reserve_stamina: number;
	accepted_epedition_num: number;
	total_expedition_num: number;
	expeditions: Expedition[];
}

interface Expedition {
	item_url: string;
	remaining_time: number;
}

interface HSRClient {
	record: {
		note(): Promise<NoteResponse>;
	};
}

const drawQueue = new Queue({ autostart: true });

GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
	"URW DIN Arabic"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "RPG_CN.ttf"),
	"Hanyi"
);
GlobalFonts.registerFromPath(
	join(".", "src", ".", "assets", "RPG_CN.ttf"),
	"PingFang"
);

async function handleNoteDraw(
	interaction: ChatInputCommandInteraction,
	tr: any,
	hsr: HSRClient
): Promise<void> {
	const drawTask = async () => {
		try {
			const requestStartTime = Date.now();
			const res = await hsr.record.note();
			const requestEndTime = Date.now();
			const drawStartTime = Date.now();
			const imageBuffer = await drawNoteImage(tr, res);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `note.png`
			});

			interaction.editReply({
				content: `-# ${tr("TP_RecoveryTime")}  ${`<t:${
					moment(new Date()).unix() + res.stamina_recover_time
				}:f>`} (${`<t:${
					moment(new Date()).unix() + res.stamina_recover_time
				}:R>`})`,
				embeds: [],
				files: [image]
			});
		} catch (error) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription(`\`${error}\``)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length !== 1) {
		drawInQueueReply(
			interaction,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}

// 圖片緩存機制
const noteImageCache = new Map<string, any>();
const noteImageLoadPromises = new Map<string, Promise<any>>();

async function loadNoteImage(url: string): Promise<any> {
	// 檢查緩存
	if (noteImageCache.has(url)) {
		return noteImageCache.get(url);
	}

	// 防止重複加載
	if (noteImageLoadPromises.has(url)) {
		return await noteImageLoadPromises.get(url);
	}

	// 創建加載 Promise
	const loadPromise = loadImage(url).catch(() => {
		console.warn(`Failed to load note image: ${url}`);
		return null;
	});

	noteImageLoadPromises.set(url, loadPromise);

	// 30秒後清理 Promise 緩存
	setTimeout(() => {
		noteImageLoadPromises.delete(url);
	}, 30000);

	const result = await loadPromise;
	if (result) {
		noteImageCache.set(url, result);
	}
	return result;
}

// 清理 note 圖片緩存
function clearNoteImageCache(): void {
	noteImageCache.clear();
	noteImageLoadPromises.clear();
	console.log("[Note Image Cache] All note image caches cleared");
}

// 定期清理 note 圖片緩存
function setupNoteImageCacheCleanup(): void {
	setInterval(
		() => {
			let clearedCount = 0;
			for (const [url, promise] of noteImageLoadPromises.entries()) {
				clearedCount++;
			}

			if (clearedCount > 0) {
				console.log(
					`[Note Image Cache] Cleaned ${clearedCount} cached promises`
				);
			}
		},
		5 * 60 * 1000
	); // 每5分鐘清理一次
}

async function drawNoteImage(
	tr: any,
	res: NoteResponse
): Promise<Buffer | null> {
	try {
		const canvas = createCanvas(1958, 456);
		const ctx = canvas.getContext("2d");

		// 並行加載背景圖片
		const [background, backgroundbtm] = await Promise.all([
			loadNoteImage("./src/assets/image/note/bg.png"),
			loadNoteImage("./src/assets/image/note/bgbtm.png")
		]);

		// Background
		if (background) {
			ctx.drawImage(background, 10, 0, 1948, 408);
		}
		if (backgroundbtm) {
			ctx.drawImage(backgroundbtm, 10, 408, 1922, 48);
		}

		// Text
		ctx.font = "bold 24px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#8C8C8C";
		ctx.textAlign = "left";
		ctx.fillText(tr("TrailblazePower"), 50, 60);
		ctx.fillText(tr("TP_RecoveryTime"), 510, 60);
		ctx.fillText(tr("DailyTraining"), 930, 60);
		ctx.fillText(tr("EchoOfWar"), 50, 180);
		ctx.fillText(tr("SynchronicityPoints"), 510, 180);

		// Value
		const FirstLineY = 95;
		const SecondLineY = FirstLineY + 120;
		ctx.font = "bold 24px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(
			`${res.current_stamina}/${res.max_stamina}`,
			50,
			FirstLineY
		);
		ctx.fillText(
			secondsToHms(res.stamina_recover_time, tr),
			510,
			FirstLineY
		);
		ctx.fillText(
			`${res.current_train_score}/${res.max_train_score}`,
			930,
			FirstLineY
		);
		ctx.fillText(
			`${res.weekly_cocoon_cnt}/${res.weekly_cocoon_limit}`,
			50,
			SecondLineY
		);

		if (res.rogue_tourn_weekly_unlocked)
			ctx.fillText(
				`${res.rogue_tourn_weekly_cur}/${res.rogue_tourn_weekly_max}`,
				510,
				SecondLineY
			);

		// Other Value
		ctx.font = "bold 24px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#6CFFF2";
		ctx.textAlign = "left";
		ctx.fillText(`+${res.current_reserve_stamina}`, 150, FirstLineY);

		// Box
		const rectX = -8;
		const rectY = 250;
		const rectWidth = 1880;
		const rectHeight = 160;
		const radius = 50;

		ctx.beginPath();
		ctx.moveTo(rectX, rectY);
		ctx.lineTo(rectX + rectWidth - radius, rectY);
		ctx.arcTo(
			rectX + rectWidth,
			rectY,
			rectX + rectWidth,
			rectY + radius,
			radius
		);
		ctx.lineTo(rectX + rectWidth, rectY + rectHeight);
		ctx.lineTo(rectX, rectY + rectHeight);
		ctx.closePath();
		ctx.fillStyle = "#1d1d1d";
		ctx.fill();

		ctx.lineWidth = 1;
		ctx.strokeStyle = "#3c3830";
		ctx.stroke();

		const circleRadius = 7;
		ctx.beginPath();
		ctx.arc(15, 265, circleRadius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fillStyle = "#3c3830";
		ctx.fill();

		// Expeditions
		ctx.font = "bold 24px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(
			`${tr("OngoingAssignments")} ${res.accepted_epedition_num} / ${res.total_expedition_num}`,
			40,
			300
		);

		const expeditionbg = await loadImage(
			"./src/assets/image/note/expedition.png"
		);
		let expeditionIndex = 0;
		for (const expedition of res.expeditions) {
			const expeditionItem = await loadImage(expedition.item_url);
			ctx.drawImage(
				expeditionbg,
				40 + expeditionIndex * 460,
				315,
				430,
				77
			);
			ctx.drawImage(
				expeditionItem,
				67 + expeditionIndex * 460,
				318,
				70,
				70
			);

			ctx.font =
				"bold 24px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "#8C8C8C";
			ctx.textAlign = "right";
			expedition.remaining_time != 0 &&
				ctx.fillText(tr("Remaining"), 460 + expeditionIndex * 460, 350);
			ctx.fillText(
				secondsToHms(expedition.remaining_time, tr),
				460 + expeditionIndex * 460,
				375
			);

			expeditionIndex++;
		}

		return canvas.toBuffer("image/png");
	} catch (e) {
		new Logger("分片").error(`Note Error: ${e}`);
		return null;
	}
}

export { handleNoteDraw, setupNoteImageCacheCleanup, clearNoteImageCache };
