import { drawInQueueReply } from "@/utilities/index.js";
import {
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	CommandInteraction,
	User
} from "discord.js";
import { database } from "../../index.js";
import {
	createCanvas,
	loadImage,
	GlobalFonts,
	CanvasRenderingContext2D,
	Image
} from "@napi-rs/canvas";
import { join } from "path";
import Logger from "@/utilities/core/logger.js";
import Queue from "queue";

const formatDate = (time: TimeInfo) =>
	`${time.year}/${time.month.toString().padStart(2, "0")}/${time.day.toString().padStart(2, "0")}`;

// 將 TimeInfo 轉換為 timestamp
const timeToTimestamp = (time: TimeInfo): number => {
	const date = new Date(
		time.year,
		time.month - 1,
		time.day,
		time.hour || 0,
		time.minute || 0
	);
	return Math.floor(date.getTime() / 1000);
};

// 異常仲裁輪次記錄接口
interface AnomalyRoundRecord {
	roundNum: number;
	expireTime: number;
}

// 異常仲裁徽章記錄接口
interface AnomalyRankRecord {
	mazeId: number;
	groupName: string;
	rankIcon: string;
	rankIconType: string;
	expireTime: number;
	challengeTime: number; // 挑戰時間戳
}

// 角色繪製配置接口
interface CharacterDrawConfig {
	avatarX: number;
	avatarY: number;
	avatarWidth: number;
	avatarHeight: number;
	char4StarBg: Image | null;
	char5StarBg: Image | null;
	elementIcons: Map<string, Image>;
	tr: any;
}

// 通用角色繪製函數
async function drawCharacter(
	ctx: CanvasRenderingContext2D,
	character: CharacterInfo,
	avatar: Image | null,
	config: CharacterDrawConfig
): Promise<void> {
	const {
		avatarX,
		avatarY,
		avatarWidth,
		avatarHeight,
		char4StarBg,
		char5StarBg,
		elementIcons,
		tr
	} = config;

	// 繪製角色稀有度背景
	const bg = character.rarity == 4 ? char4StarBg : char5StarBg;
	if (bg) {
		(ctx as any).drawImage(bg, avatarX, avatarY, avatarWidth, avatarHeight);
	}

	// 為角色圖片添加右上角圓角裁剪
	ctx.save();
	ctx.beginPath();
	// 創建右上角圓角矩形路徑
	const cornerRadius = 40;
	ctx.moveTo(avatarX + cornerRadius, avatarY);
	ctx.lineTo(avatarX + avatarWidth - cornerRadius, avatarY);
	ctx.quadraticCurveTo(
		avatarX + avatarWidth,
		avatarY,
		avatarX + avatarWidth,
		avatarY + cornerRadius
	);
	ctx.lineTo(avatarX + avatarWidth, avatarY + avatarHeight - cornerRadius);
	ctx.quadraticCurveTo(
		avatarX + avatarWidth,
		avatarY + avatarHeight,
		avatarX + avatarWidth - cornerRadius,
		avatarY + avatarHeight
	);
	ctx.lineTo(avatarX + cornerRadius, avatarY + avatarHeight);
	ctx.quadraticCurveTo(
		avatarX,
		avatarY + avatarHeight,
		avatarX,
		avatarY + avatarHeight - cornerRadius
	);
	ctx.lineTo(avatarX, avatarY + cornerRadius);
	ctx.quadraticCurveTo(avatarX, avatarY, avatarX + cornerRadius, avatarY);
	ctx.closePath();
	ctx.clip();

	// 繪製角色頭像
	if (avatar) {
		(ctx as any).drawImage(
			avatar,
			avatarX,
			avatarY,
			avatarWidth,
			avatarHeight
		);
	}

	ctx.restore();

	// 繪製等級背景
	ctx.fillStyle = "rgba(0,0,0,.7)";
	ctx.fillRect(avatarX, avatarY + avatarHeight - 3 - 31, avatarWidth, 31);

	// 繪製等級文字
	ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(
		`${tr("level_Format", { level: `${character.level}` })}`,
		avatarX + 74,
		avatarY + avatarHeight - 7
	);

	// 繪製元素圖標背景
	ctx.beginPath();
	ctx.arc(avatarX + 30, avatarY + 25, 15, 0, 2 * Math.PI);
	ctx.fillStyle = "rgba(0,0,0,.4)";
	ctx.fill();

	// 繪製元素圖標
	const elementId = character.element || "physical";
	if (!elementIcons.has(elementId)) {
		const elementImage = await getCachedImage(
			`./src/assets/image/element/${elementId}.png`
		);
		if (elementImage) {
			elementIcons.set(elementId, elementImage);
		}
	}
	const elementImage = elementIcons.get(elementId);
	if (elementImage) {
		(ctx as any).drawImage(
			elementImage,
			avatarX + 16,
			avatarY + 11,
			27,
			27
		);
	}

	// 繪製命座
	if (character.rank != 0) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		const rankX = avatarX + 110;
		const rankY = avatarY;
		const rankWidth = 40;
		const rankHeight = 50;

		ctx.beginPath();
		ctx.moveTo(rankX, rankY);
		ctx.lineTo(rankX + rankWidth - 37, rankY);
		ctx.quadraticCurveTo(
			rankX + rankWidth,
			rankY,
			rankX + rankWidth,
			rankY + 37
		);
		ctx.lineTo(rankX + rankWidth, rankY + rankHeight);
		ctx.lineTo(rankX + 20, rankY + rankHeight);
		ctx.quadraticCurveTo(
			rankX,
			rankY + rankHeight,
			rankX,
			rankY + rankHeight - 20
		);
		ctx.lineTo(rankX, rankY);
		ctx.closePath();
		ctx.fill();

		ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(`${character.rank}`, avatarX + 130, avatarY + 35);
	}
}

// 小型角色繪製函數（用於騎士關卡）
async function drawSmallCharacter(
	ctx: CanvasRenderingContext2D,
	character: CharacterInfo,
	avatar: Image | null,
	config: CharacterDrawConfig
): Promise<void> {
	const {
		avatarX,
		avatarY,
		avatarWidth,
		avatarHeight,
		char4StarBg,
		char5StarBg,
		elementIcons,
		tr
	} = config;

	// 繪製角色稀有度背景
	const bg = character.rarity == 4 ? char4StarBg : char5StarBg;
	if (bg) {
		(ctx as any).drawImage(bg, avatarX, avatarY, avatarWidth, avatarHeight);
	}

	// 為角色圖片添加右上角圓角裁剪
	ctx.save();
	ctx.beginPath();
	// 創建右上角圓角矩形路徑
	const cornerRadius = 15; // 較小的圓角適合小型角色
	ctx.moveTo(avatarX + cornerRadius, avatarY);
	ctx.lineTo(avatarX + avatarWidth - cornerRadius, avatarY);
	ctx.quadraticCurveTo(
		avatarX + avatarWidth,
		avatarY,
		avatarX + avatarWidth,
		avatarY + cornerRadius
	);
	ctx.lineTo(avatarX + avatarWidth, avatarY + avatarHeight - cornerRadius);
	ctx.quadraticCurveTo(
		avatarX + avatarWidth,
		avatarY + avatarHeight,
		avatarX + avatarWidth - cornerRadius,
		avatarY + avatarHeight
	);
	ctx.lineTo(avatarX + cornerRadius, avatarY + avatarHeight);
	ctx.quadraticCurveTo(
		avatarX,
		avatarY + avatarHeight,
		avatarX,
		avatarY + avatarHeight - cornerRadius
	);
	ctx.lineTo(avatarX, avatarY + cornerRadius);
	ctx.quadraticCurveTo(avatarX, avatarY, avatarX + cornerRadius, avatarY);
	ctx.closePath();
	ctx.clip();

	// 繪製角色頭像
	if (avatar) {
		(ctx as any).drawImage(
			avatar,
			avatarX,
			avatarY,
			avatarWidth,
			avatarHeight
		);
	}

	ctx.restore();

	// 繪製等級背景
	ctx.fillStyle = "rgba(0,0,0,.7)";
	ctx.fillRect(avatarX, avatarY + avatarHeight - 3 - 25, avatarWidth, 25);

	// 繪製等級文字
	ctx.font = "20px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(
		`${tr("level_Format", { level: `${character.level}` })}`,
		avatarX + 50,
		avatarY + avatarHeight - 5
	);

	// 繪製元素圖標背景
	ctx.beginPath();
	ctx.arc(avatarX + 20, avatarY + 15, 12, 0, 2 * Math.PI);
	ctx.fillStyle = "rgba(0,0,0,.4)";
	ctx.fill();

	// 繪製元素圖標
	const elementId = character.element || "physical";
	if (!elementIcons.has(elementId)) {
		const elementImage = await getCachedImage(
			`./src/assets/image/element/${elementId}.png`
		);
		if (elementImage) {
			elementIcons.set(elementId, elementImage);
		}
	}
	const elementImage = elementIcons.get(elementId);
	if (elementImage) {
		(ctx as any).drawImage(elementImage, avatarX + 8, avatarY + 3, 24, 24);
	}

	// 繪製命座
	if (character.rank != 0) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		const rankX = avatarX + 75;
		const rankY = avatarY;
		const rankWidth = 30;
		const rankHeight = 35;

		ctx.beginPath();
		ctx.moveTo(rankX, rankY);
		ctx.lineTo(rankX + rankWidth - 25, rankY);
		ctx.quadraticCurveTo(
			rankX + rankWidth,
			rankY,
			rankX + rankWidth,
			rankY + 25
		);
		ctx.lineTo(rankX + rankWidth, rankY + rankHeight);
		ctx.lineTo(rankX + 15, rankY + rankHeight);
		ctx.quadraticCurveTo(
			rankX,
			rankY + rankHeight,
			rankX,
			rankY + rankHeight - 15
		);
		ctx.lineTo(rankX, rankY);
		ctx.closePath();
		ctx.fill();

		ctx.font = "20px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(`${character.rank}`, avatarX + 90, avatarY + 25);
	}
}

interface HSRClient {
	uid: string;
	record: {
		forgottenHall: (
			mode: number,
			time: number
		) => Promise<ForgottenHallResponse | AnomalyArbitrationResponse>;
	};
}

interface AnomalyArbitrationResponse {
	challenge_peak_records: ChallengePeakRecord[];
	has_more_boss_record: boolean;
	challenge_peak_best_record_brief: {
		total_battle_num: number;
		mob_stars: number;
		boss_stars: number;
		challenge_peak_rank_icon_type: string;
		challenge_peak_rank_icon: string;
	};
	role: {
		server: string;
		nickname: string;
		level: number;
		role_id: string;
	};
}

interface ChallengePeakRecord {
	group: {
		group_id: number;
		begin_time: TimeInfo;
		end_time: TimeInfo;
		status: string;
		name_mi18n: string;
		game_version: string;
		theme_pic_path: string;
	};
	boss_info: {
		maze_id: number;
		name_mi18n: string;
		hard_mode_name_mi18n: string;
		icon: string;
	};
	mob_infos: MobInfo[];
	has_challenge_record: boolean;
	battle_num: number;
	boss_record: BossRecord;
	mob_records: MobRecord[];
	boss_stars: number;
	mob_stars: number;
}

interface MobInfo {
	maze_id: number;
	name: string;
	monster_name: string;
	monster_icon: string;
}

interface BossRecord {
	maze_id: number;
	has_challenge_record: boolean;
	challenge_time: TimeInfo;
	avatars: CharacterInfo[];
	buff: {
		id: number;
		name_mi18n: string;
		desc_mi18n: string;
		icon: string;
	};
	hard_mode: boolean;
	round_num: number;
	star_num: number;
	finish_color_medal: boolean;
	challenge_peak_rank_icon_type: string;
	challenge_peak_rank_icon: string;
	record_unique_key: string;
}

interface MobRecord {
	maze_id: number;
	has_challenge_record: boolean;
	challenge_time: TimeInfo;
	avatars: CharacterInfo[];
	round_num: number;
	star_num: number;
	is_fast: boolean;
}

interface ForgottenHallResponse {
	has_data: boolean;
	star_num: number;
	battle_num: number;
	all_floor_detail: FloorDetail[];
	begin_time?: TimeInfo;
	end_time?: TimeInfo;
	schedule_id?: string;
	groups?: GroupInfo[];
}

interface FloorDetail {
	maze_id: string;
	name: string;
	star_num: number;
	round_num: number;
	node_1: NodeInfo;
	node_2: NodeInfo;
}

interface NodeInfo {
	score: string;
	avatars: CharacterInfo[];
	challenge_time?: TimeInfo;
	buff?: BuffInfo;
}

interface CharacterInfo {
	id: number;
	icon: string;
	rarity: number;
	level: number;
	rank: number;
	element: string;
}

interface BuffInfo {
	icon: string;
	name_mi18n: string;
}

interface TimeInfo {
	year: number;
	month: number;
	day: number;
	hour?: number;
	minute?: number;
}

interface GroupInfo {
	begin_time: TimeInfo;
	end_time: TimeInfo;
	schedule_id: string;
	upper_boss: BossInfo;
	lower_boss: BossInfo;
}

interface BossInfo {
	icon: string;
	name_mi18n: string;
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

const imageCache = new Map<string, Image>();

// 圖片路徑常量
const IMAGE_PATHS = {
	BACKGROUNDS: {
		NORMAL: "./src/assets/image/forgottenhall/normalbg.png",
		STORY: "./src/assets/image/forgottenhall/storybg.png",
		KNIGHT: "./src/assets/image/forgottenhall/knightbg.png",
		NORMAL2: "./src/assets/image/forgottenhall/normalbg2.png",
		STORY2: "./src/assets/image/forgottenhall/storybg2.png",
		KNIGHT2: "./src/assets/image/forgottenhall/knightbg2.png"
	},
	BLOCKS: {
		TOP: "./src/assets/image/forgottenhall/block_bg_top.png",
		MID: "./src/assets/image/forgottenhall/block_bg_mid.png",
		BOTTOM: "./src/assets/image/forgottenhall/block_bg_bottom.png"
	},
	BOSS_CARD: {
		TOP: "./src/assets/image/forgottenhall/normal_boss_bg_top.png",
		MID: "./src/assets/image/forgottenhall/normal_boss_bg_mid.png",
		BOTTOM: "./src/assets/image/forgottenhall/normal_boss_bg_bottom.png"
	},
	CHARACTERS: {
		FOUR_STAR: "./src/assets/image/forgottenhall/character4star.png",
		FIVE_STAR: "./src/assets/image/forgottenhall/character5star.png"
	},
	UI: {
		SUMMARY: "./src/assets/image/forgottenhall/summary.png",
		STAR: "./src/assets/image/forgottenhall/star.png",
		NORMAL_STAR: "./src/assets/image/forgottenhall/normal_star.png",
		NORMAL_STAR_GREY:
			"./src/assets/image/forgottenhall/normal_star_grey.png",
		BOSS_STAR: "./src/assets/image/forgottenhall/boss_star.png",
		KNIGHT_BOSS_NODE: "./src/assets/image/forgottenhall/knightBossNode.png",
		BUFF_BG: "./src/assets/image/forgottenhall/buff_bg.png"
	}
} as const;

// 常數定義
const CANVAS_CONFIG = {
	WIDTH: 1920,
	HEIGHT: {
		ANOMALY: 1300,
		FORGOTTEN: 1080
	}
} as const;

const BOSS_CARD_CONFIG = {
	WIDTH: 1792,
	MID_BG_AMOUNT: 3,
	HEIGHT: 60 + 60 * 3 + 120, // 360
	BORDER_RADIUS: 48,
	PADDING: 4 // gpx * 2
} as const;

const CHARACTER_CONFIG = {
	BOSS: {
		WIDTH: 148,
		HEIGHT: 180,
		LEVEL_FONT_SIZE: 30,
		RANK_FONT_SIZE: 28
	},
	KNIGHT: {
		WIDTH: 100,
		HEIGHT: 120,
		LEVEL_FONT_SIZE: 20,
		RANK_FONT_SIZE: 20
	}
} as const;

// 輔助函數
function getBackgroundPath(mode: number): string {
	const backgrounds = {
		1: IMAGE_PATHS.BACKGROUNDS.NORMAL,
		2: IMAGE_PATHS.BACKGROUNDS.STORY,
		3: IMAGE_PATHS.BACKGROUNDS.KNIGHT
	};
	return (
		backgrounds[mode as keyof typeof backgrounds] ||
		IMAGE_PATHS.BACKGROUNDS.NORMAL
	);
}

function getBackground2Path(mode: number): string {
	const backgrounds = {
		1: IMAGE_PATHS.BACKGROUNDS.NORMAL2,
		2: IMAGE_PATHS.BACKGROUNDS.STORY2,
		3: IMAGE_PATHS.BACKGROUNDS.KNIGHT2
	};
	return (
		backgrounds[mode as keyof typeof backgrounds] ||
		IMAGE_PATHS.BACKGROUNDS.NORMAL2
	);
}

function getBackgroundColor(mode: number): string {
	const colors = {
		1: "rgba(58,8,18,.4)",
		2: "rgb(14, 21, 39,.4)",
		3: "rgb(190,119,255,.4)",
		4: "rgba(100, 50, 150, .4)"
	};
	return colors[mode as keyof typeof colors] || "rgba(58,8,18,.4)";
}

async function preloadImages(): Promise<void> {
	try {
		const imagesToPreload = [
			...Object.values(IMAGE_PATHS.BACKGROUNDS),
			...Object.values(IMAGE_PATHS.BLOCKS),
			...Object.values(IMAGE_PATHS.BOSS_CARD),
			...Object.values(IMAGE_PATHS.CHARACTERS),
			...Object.values(IMAGE_PATHS.UI)
		];

		// 並行預載圖片以提高效率
		const preloadPromises = imagesToPreload.map(async path => {
			if (!imageCache.has(path)) {
				try {
					const image = await loadImage(path);
					imageCache.set(path, image);
				} catch (error) {
					console.warn(`Failed to preload image: ${path}`, error);
				}
			}
		});

		await Promise.allSettled(preloadPromises);
	} catch (error) {
		console.error("Error preloading images:", error);
	}
}

preloadImages();

async function getCachedImage(path: string): Promise<Image | null> {
	if (!imageCache.has(path)) {
		try {
			const image = await loadImage(path);
			imageCache.set(path, image);
			return image;
		} catch (error) {
			return null;
		}
	}
	return imageCache.get(path) || null;
}

async function handleForgottenHallDraw(
	interaction: CommandInteraction,
	tr: any,
	user: User,
	mode: number,
	time: number,
	hsr: HSRClient
): Promise<void> {
	const drawTask = async (): Promise<void> => {
		try {
			const requestStartTime = Date.now();
			const res = await hsr.record.forgottenHall(mode, time);

			if (
				(mode !== 4 &&
					(res as ForgottenHallResponse).has_data === false) ||
				!res
			) {
				interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("forgottenHall_NonData"))
							.setDescription(tr("forgottenHall_NonDataDesc"))
					]
				});
				return;
			}

			let floor;
			if (mode == 4) {
				floor = (res as AnomalyArbitrationResponse)
					.challenge_peak_records[0];
				if (
					!floor ||
					(!floor.mob_records?.length &&
						!floor.boss_record?.has_challenge_record)
				) {
					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(tr("forgottenHall_NonData"))
								.setDescription(tr("forgottenHall_NonDataDesc"))
						]
					});
					return;
				}
			} else {
				floor = (res as ForgottenHallResponse).all_floor_detail[0];
				if (!floor) {
					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(tr("forgottenHall_NonData"))
								.setDescription(tr("forgottenHall_NonDataDesc"))
						]
					});
					return;
				}
			}

			const requestEndTime = Date.now();
			const drawStartTime = Date.now();

			const imageBuffer = await drawFloorImage(
				tr,
				hsr.uid,
				res,
				mode,
				floor
			);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const drawEndTime = Date.now();
			const image = new AttachmentBuilder(imageBuffer, {
				name: `${mode === 4 ? (floor as ChallengePeakRecord).group.group_id : (floor as FloorDetail).maze_id}.webp`
			});

			const commonParams = {
				s: `${mode === 4 ? (floor as ChallengePeakRecord).mob_stars + (floor as ChallengePeakRecord).boss_stars : (floor as FloorDetail).star_num}`
			};

			// 根據 mode 決定選擇菜單的選項
			let selectMenuOptions: any[] = [];

			if (mode === 4) {
				// 異常仲裁模式：使用 challenge_peak_records
				const anomalyRes = res as AnomalyArbitrationResponse;
				selectMenuOptions = anomalyRes.challenge_peak_records.map(
					(record, i) => ({
						label: `${record.group.name_mi18n}`,
						description: tr("forgottenHall_AnomalyFormat", {
							s: `${record.mob_stars + record.boss_stars}`,
							b: `${record.battle_num}`
						}),
						value: `${user.id}-${mode}-${time}-${i}`
					})
				);
			} else {
				// 其他模式：使用 all_floor_detail
				const forgottenRes = res as ForgottenHallResponse;
				selectMenuOptions = forgottenRes.all_floor_detail.map(
					(floor, i) => {
						const floorScore = (node: NodeInfo) =>
							parseInt(node?.score) || 0;
						const totalScore =
							floorScore(floor.node_1) + floorScore(floor.node_2);
						return {
							label: `${floor.name.replace(
								/<\/?[^>]+(>|$)/g,
								""
							)}`,
							description:
								mode === 3
									? tr("forgottenHall_FloorFormat3", {
											...commonParams,
											z: `${totalScore}`
										})
									: mode === 2
										? tr("forgottenHall_FloorFormat2", {
												...commonParams,
												r: `${floor.round_num}`,
												z: `${totalScore}`
											})
										: tr("forgottenHall_FloorFormat1", {
												...commonParams,
												r: `${floor.round_num}`
											}),
							value: `${user.id}-${mode}-${time}-${i}`
						};
					}
				);
			}

			// 根據 mode 決定是否顯示選擇菜單
			const replyData: any = {
				content: `-# ${tr("CostTime", {
					requestTime: (
						(requestEndTime - requestStartTime) /
						1000
					).toFixed(2),
					drawTime: ((drawEndTime - drawStartTime) / 1000).toFixed(2)
				})}`,
				embeds: [],
				files: [image]
			};

			// 只有非 mode 4 才顯示選擇菜單
			if (mode !== 4) {
				replyData.components = [
					(new ActionRowBuilder() as any).addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("forgottenHall_SelectFloor"))
							.setCustomId("forgottenHall_Floor")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(selectMenuOptions)
					)
				];
			}

			interaction.editReply(replyData);
		} catch (error) {
			console.log(error);
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
			interaction as any,
			tr("DrawInQueue", { position: (drawQueue.length - 1).toString() })
		);
	}
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number | number[],
	fill = true,
	stroke = false
): void {
	let radiusTopLeft = radius;
	let radiusTopRight = radius;
	let radiusBottomRight = radius;
	let radiusBottomLeft = radius;

	if (Array.isArray(radius)) {
		radiusTopLeft = (radius as number[])[0] || 0;
		radiusTopRight = (radius as number[])[1] || 0;
		radiusBottomRight = (radius as number[])[2] || 0;
		radiusBottomLeft = (radius as number[])[3] || 0;
	}

	ctx.beginPath();
	ctx.moveTo(x + (radiusTopLeft as number), y);
	ctx.lineTo(x + width - (radiusTopRight as number), y);
	ctx.quadraticCurveTo(
		x + width,
		y,
		x + width,
		y + (radiusTopRight as number)
	);
	ctx.lineTo(x + width, y + height - (radiusBottomRight as number));
	ctx.quadraticCurveTo(
		x + width,
		y + height,
		x + width - (radiusBottomRight as number),
		y + height
	);
	ctx.lineTo(x + (radiusBottomLeft as number), y + height);
	ctx.quadraticCurveTo(
		x,
		y + height,
		x,
		y + height - (radiusBottomLeft as number)
	);
	ctx.lineTo(x, y + (radiusTopLeft as number));
	ctx.quadraticCurveTo(x, y, x + (radiusTopLeft as number), y);
	ctx.closePath();

	if (fill) {
		ctx.fill();
	}

	if (stroke) {
		ctx.stroke();
	}
}

async function drawAnomalyArbitrationImage(
	tr: any,
	uid: string,
	res: AnomalyArbitrationResponse,
	mode: number,
	floor: ChallengePeakRecord
): Promise<Buffer | null> {
	try {
		const canvas = createCanvas(
			CANVAS_CONFIG.WIDTH,
			CANVAS_CONFIG.HEIGHT.ANOMALY
		);
		const ctx = canvas.getContext("2d");

		// 使用分層背景圖片
		const topBg = await getCachedImage(IMAGE_PATHS.BLOCKS.TOP);
		const midBg = await getCachedImage(IMAGE_PATHS.BLOCKS.MID);
		const bottomBg = await getCachedImage(IMAGE_PATHS.BLOCKS.BOTTOM);

		// 繪製分層背景
		if (topBg) {
			(ctx as any).drawImage(topBg, 0, 0, 1920, 740); // 頂部區域
		}
		if (midBg) {
			(ctx as any).drawImage(midBg, 0, 740, 1920, 160); // 中間區域
		}
		if (bottomBg) {
			(ctx as any).drawImage(bottomBg, 0, 900, 1920, 400); // 底部區域
		}

		const backgroundColor = getBackgroundColor(mode);
		const borderColor = "rgba(255,255,255,.4)";
		const borderWidth = 1;

		// 標題
		ctx.font = "bold 38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFC870";
		ctx.textAlign = "center";
		ctx.fillText(
			tr("forgottenHall_Mode" + mode) + tr("forgottenHall_Title"),
			canvas.width / 2,
			125
		);

		// 頂部資訊欄 - 使用 summary.png
		const summaryBg = await getCachedImage(IMAGE_PATHS.UI.SUMMARY);
		const summaryWidth = 1792;
		const summaryHeight = 120;
		const summaryX = (canvas.width - summaryWidth) / 2; // 置中
		const summaryY = 175;

		if (summaryBg) {
			(ctx as any).drawImage(
				summaryBg,
				summaryX,
				summaryY,
				summaryWidth,
				summaryHeight
			);
		}

		// 星星顯示
		if (floor.boss_record?.has_challenge_record) {
			const peakRankIcon = await getCachedImage(
				floor.boss_record.challenge_peak_rank_icon
			);
			if (peakRankIcon) {
				(ctx as any).drawImage(peakRankIcon, 100, 195, 80, 80);
			}
		}

		const bossStar = await getCachedImage(IMAGE_PATHS.UI.BOSS_STAR);

		if (bossStar) {
			(ctx as any).drawImage(bossStar, 190, 215, 40, 40);
		}

		ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(
			`× ${res.challenge_peak_best_record_brief.boss_stars}`,
			250,
			245
		);

		const star = await getCachedImage(IMAGE_PATHS.UI.NORMAL_STAR);
		if (star) {
			(ctx as any).drawImage(star, 290, 215, 40, 40);
		}

		ctx.fillText(
			`× ${res.challenge_peak_best_record_brief.mob_stars}`,
			350,
			245
		);

		// 關卡名稱
		ctx.font = "bold 31px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(floor.group.name_mi18n, 425, 230);

		// 戰鬥次數
		ctx.font = "31px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.fillText(
			`${tr("forgottenHall_Battle")}:  ${res.challenge_peak_best_record_brief.total_battle_num}`,
			425,
			270
		);

		// Boss Card 展示區域 - 在資訊區域底下
		const bossCardWidth = BOSS_CARD_CONFIG.WIDTH;
		const bossCardMidBgAmount = BOSS_CARD_CONFIG.MID_BG_AMOUNT;
		const bossCardHeight = BOSS_CARD_CONFIG.HEIGHT;
		const bossCardX = (canvas.width - bossCardWidth) / 2;
		const bossCardY = summaryY + summaryHeight + 100; // 在主內容區域下方

		// 繪製 Boss Card 分層背景 (背景填滿整個區域)
		const bossCardTopBg = await getCachedImage(IMAGE_PATHS.BOSS_CARD.TOP);
		const bossCardMidBg = await getCachedImage(IMAGE_PATHS.BOSS_CARD.MID);
		const bossCardBottomBg = await getCachedImage(
			IMAGE_PATHS.BOSS_CARD.BOTTOM
		);

		// 繪製分層背景，添加圓角裁剪
		const borderRadius = BOSS_CARD_CONFIG.BORDER_RADIUS;

		ctx.save();
		// 創建圓角裁剪路徑
		ctx.beginPath();
		ctx.moveTo(bossCardX, bossCardY);
		ctx.lineTo(bossCardX + bossCardWidth - borderRadius, bossCardY);
		ctx.quadraticCurveTo(
			bossCardX + bossCardWidth,
			bossCardY,
			bossCardX + bossCardWidth,
			bossCardY + borderRadius
		);
		ctx.lineTo(bossCardX + bossCardWidth, bossCardY + bossCardHeight);
		ctx.lineTo(bossCardX, bossCardY + bossCardHeight);
		ctx.lineTo(bossCardX, bossCardY);
		ctx.closePath();
		ctx.clip();

		// 繪製背景圖片
		if (bossCardTopBg) {
			(ctx as any).drawImage(
				bossCardTopBg,
				bossCardX,
				bossCardY,
				bossCardWidth,
				60
			);
		}
		if (bossCardMidBg) {
			for (let i = 0; i < bossCardMidBgAmount; i++) {
				(ctx as any).drawImage(
					bossCardMidBg,
					bossCardX,
					bossCardY + 60 * (i + 1),
					bossCardWidth,
					60
				);
			}
		}
		if (bossCardBottomBg) {
			(ctx as any).drawImage(
				bossCardBottomBg,
				bossCardX,
				bossCardY + 60 + 60 * bossCardMidBgAmount,
				bossCardWidth,
				120
			);
		}
		ctx.restore();

		// 添加 Boss Card 邊框樣式 (邊框往內縮進)
		const gpx = 2; // CSS變量 --gpx 的值
		const padding = BOSS_CARD_CONFIG.PADDING;
		const bossCardBorderWidth = gpx * 1;
		const bossCardBorderRadius: number[] = [0, gpx * 24, 0, 0]; // 左上、右上、右下、左下

		// 邊框位置 (往內縮進)
		const borderX = bossCardX + padding;
		const borderY = bossCardY + padding;
		const borderRectWidth = bossCardWidth - padding * 2;
		const borderHeight = bossCardHeight - padding * 2;

		ctx.strokeStyle = "hsla(268, 5%, 52%, .3)";
		ctx.lineWidth = bossCardBorderWidth;

		// 繪製圓角邊框
		ctx.beginPath();
		ctx.moveTo(borderX + (bossCardBorderRadius[0] || 0), borderY);
		ctx.lineTo(
			borderX + borderRectWidth - (bossCardBorderRadius[1] || 0),
			borderY
		);
		ctx.quadraticCurveTo(
			borderX + borderRectWidth,
			borderY,
			borderX + borderRectWidth,
			borderY + (bossCardBorderRadius[1] || 0)
		);
		ctx.lineTo(
			borderX + borderRectWidth,
			borderY + borderHeight - (bossCardBorderRadius[2] || 0)
		);
		ctx.quadraticCurveTo(
			borderX + borderRectWidth,
			borderY + borderHeight,
			borderX + borderRectWidth - (bossCardBorderRadius[2] || 0),
			borderY + borderHeight
		);
		ctx.lineTo(
			borderX + (bossCardBorderRadius[3] || 0),
			borderY + borderHeight
		);
		ctx.quadraticCurveTo(
			borderX,
			borderY + borderHeight,
			borderX,
			borderY + borderHeight - (bossCardBorderRadius[3] || 0)
		);
		ctx.lineTo(borderX, borderY + (bossCardBorderRadius[0] || 0));
		ctx.quadraticCurveTo(
			borderX,
			borderY,
			borderX + (bossCardBorderRadius[0] || 0),
			borderY
		);
		ctx.closePath();
		ctx.stroke();

		// 在 Boss Card 左上角顯示標題
		ctx.font = "bold 32px 'PingFang', URW DIN Arabic, Arial, sans-serif";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(tr("forgottenHall_BossRecord"), bossCardX, bossCardY - 20);
		ctx.fillText(
			floor.boss_info.name_mi18n,
			bossCardX + 40,
			bossCardY + 45
		);

		if (floor.boss_record?.has_challenge_record) {
			// 使用輪次文字
			ctx.font = "24px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "hsla(0, 0%, 100%, .65)";
			ctx.textAlign = "left";
			const useRoundText = `${tr("forgottenHall_UseRound")}`;
			ctx.fillText(useRoundText, bossCardX + 40, bossCardY + 80);

			// 輪次數字
			ctx.fillStyle = "#ffd37f";
			ctx.fillText(
				`${floor.boss_record.round_num}`,
				bossCardX + 40 + ctx.measureText(useRoundText).width + 10,
				bossCardY + 80
			);

			// 挑戰時間
			ctx.font = "24px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "hsla(0, 0%, 100%, .65)";
			const { year, month, day, hour, minute } =
				floor.boss_record.challenge_time;
			ctx.fillText(
				`${year}/${month}/${day} ${hour}:${minute}`,
				bossCardX + 40 + ctx.measureText(useRoundText).width + 80,
				bossCardY + 80
			);

			// 繪製王棋過關角色
			const bossRecord = floor.boss_record;
			const bossRecordAvatars = bossRecord.avatars;
			const bossRecordAvatarPromises = bossRecordAvatars.map(character =>
				getCachedImage(character.icon)
			);
			const bossRecordAvatarImages = await Promise.all(
				bossRecordAvatarPromises
			);

			// 獲取角色背景圖片
			const bossChar4StarBg = await getCachedImage(
				IMAGE_PATHS.CHARACTERS.FOUR_STAR
			);
			const bossChar5StarBg = await getCachedImage(
				IMAGE_PATHS.CHARACTERS.FIVE_STAR
			);

			// 元素圖標緩存
			const bossElementIcons = new Map<string, Image>();

			for (let i = 0; i < bossRecordAvatars.length; i++) {
				const character = bossRecordAvatars[i];
				if (!character) continue;

				const avatarX =
					bossCardX + 40 + (670 / bossRecordAvatars.length) * i;
				const avatarY = bossCardY + 120;
				const avatarWidth = CHARACTER_CONFIG.BOSS.WIDTH;
				const avatarHeight = CHARACTER_CONFIG.BOSS.HEIGHT;
				const avatar = bossRecordAvatarImages[i] || null;

				const config: CharacterDrawConfig = {
					avatarX,
					avatarY,
					avatarWidth,
					avatarHeight,
					char4StarBg: bossChar4StarBg,
					char5StarBg: bossChar5StarBg,
					elementIcons: bossElementIcons,
					tr
				};

				await drawCharacter(ctx, character, avatar, config);
			}
		}

		// 繪製王
		let bossIconWidth = 0;
		if (floor.boss_info) {
			const bossIcon = await getCachedImage(floor.boss_info.icon);
			if (bossIcon) {
				const padding = 30;
				const bossIconHeight = borderHeight - padding * 2;
				const aspectRatio = bossIcon.width / bossIcon.height;
				bossIconWidth = bossIconHeight * aspectRatio;

				(ctx as any).drawImage(
					bossIcon,
					bossCardX + bossCardWidth - bossIconWidth - 40,
					bossCardY + padding,
					bossIconWidth,
					bossIconHeight
				);
			}
		}

		// 繪製 Buff 信息區域
		if (floor.boss_record?.has_challenge_record && floor.boss_record.buff) {
			const buffAreaX = bossCardX + 40 + 670 + 20; // 角色區域右側 + 間隔
			const buffAreaY = bossCardY + 120;
			const buffAreaWidth =
				bossCardWidth - buffAreaX - bossIconWidth - 10;
			const buffAreaHeight = 180;

			// 繪製 team-info 背景
			const gpx = 2;
			const teamInfoBorderWidth = gpx * 0.5;

			ctx.fillStyle = "hsla(0, 0%, 100%, .04)";
			ctx.fillRect(buffAreaX, buffAreaY, buffAreaWidth, buffAreaHeight);

			// 繪製邊框
			ctx.strokeStyle = "hsla(0, 0%, 100%, .04)";
			ctx.lineWidth = teamInfoBorderWidth;
			ctx.strokeRect(buffAreaX, buffAreaY, buffAreaWidth, buffAreaHeight);

			// 繪製 buff 背景
			const buffBg = await getCachedImage(IMAGE_PATHS.UI.BUFF_BG);
			if (buffBg) {
				const buffBgSize = 120;
				const buffBgX = buffAreaX + 20;
				const buffBgY = buffAreaY + (buffAreaHeight - buffBgSize) / 2;
				(ctx as any).drawImage(
					buffBg,
					buffBgX,
					buffBgY,
					buffBgSize,
					buffBgSize
				);
			}

			// 繪製 buff icon
			const buffIcon = await getCachedImage(floor.boss_record.buff.icon);
			if (buffIcon) {
				const buffIconSize = 80;
				const buffIconX = buffAreaX + 20 + 20;
				const buffIconY =
					buffAreaY + (buffAreaHeight - buffIconSize) / 2;
				(ctx as any).drawImage(
					buffIcon,
					buffIconX,
					buffIconY,
					buffIconSize,
					buffIconSize
				);
			}

			// 繪製 buff 名稱
			ctx.font =
				"bold 36px 'PingFang', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			const buffNameX = buffAreaX + 160;
			const buffNameY = buffAreaY + 55;
			ctx.fillText(
				floor.boss_record.buff.name_mi18n,
				buffNameX,
				buffNameY
			);

			// 繪製 buff 描述 (支持換行)
			ctx.font = "26px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "hsla(0, 0%, 100%, .7)";
			const buffDescX = buffNameX;
			const buffDescY = buffAreaY + 95;
			const maxWidth = buffAreaWidth - 160;

			// 文字換行處理 (支持中文字符)
			const text = floor.boss_record.buff.desc_mi18n;
			let currentLine = "";
			let y = buffDescY;
			const lineHeight = 30; // 行高

			for (let i = 0; i < text.length; i++) {
				const char = text[i] || "";
				const testLine = currentLine + char;
				const metrics = ctx.measureText(testLine);

				if (metrics.width > maxWidth && currentLine.length > 0) {
					// 如果超出寬度且當前行有內容，先繪製當前行
					ctx.fillText(currentLine, buffDescX, y);
					currentLine = char; // 開始新行
					y += lineHeight;
				} else {
					currentLine = testLine;
				}
			}

			// 繪製最後一行
			if (currentLine.length > 0) {
				ctx.fillText(currentLine, buffDescX, y);
			}
		}

		// 繪製騎士關卡戰績區域
		ctx.font = "bold 32px 'PingFang', URW DIN Arabic, Arial, sans-serif";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(
			tr("forgottenHall_KnightRecord"),
			bossCardX,
			bossCardY + bossCardHeight + 90
		);
		const knightAreaY = bossCardY + bossCardHeight + 110;
		const knightAreaHeight = 240;
		const knightAreaWidth = Math.floor(bossCardWidth / 3);

		for (let i = 0; i < Math.min(floor.mob_records.length, 3); i++) {
			const mobRecord = floor.mob_records[i];
			const mobInfo = floor.mob_infos[i];
			if (!mobRecord || !mobInfo) continue;

			const knightAreaX = bossCardX + i * (knightAreaWidth + 10);

			// 繪製騎士關卡背景
			ctx.fillStyle = "hsla(0, 0%, 100%, .04)";
			ctx.fillRect(
				knightAreaX,
				knightAreaY,
				knightAreaWidth,
				knightAreaHeight
			);

			// 繪製邊框
			ctx.strokeStyle = "hsla(0, 0%, 100%, .04)";
			ctx.lineWidth = 1;
			ctx.strokeRect(
				knightAreaX,
				knightAreaY,
				knightAreaWidth,
				knightAreaHeight
			);

			// 繪製關卡名稱
			ctx.font =
				"bold 28px 'PingFang', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(mobInfo.name, knightAreaX + 20, knightAreaY + 45);
			const nameWidth = ctx.measureText(mobInfo.name).width;

			// 繪製怪物名稱
			ctx.fillStyle = "hsla(0, 0%, 100%, .7)";
			ctx.font = "24px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
			ctx.fillText(
				mobInfo.monster_name,
				knightAreaX + 20 + nameWidth + 10,
				knightAreaY + 45
			);

			// 繪製使用輪次
			ctx.font = "20px 'Hanyi', URW DIN Arabic, Arial, sans-serif";
			ctx.fillStyle = "hsla(0, 0%, 100%, .65)";
			const useRoundText = tr("forgottenHall_UseRound");
			ctx.fillText(useRoundText, knightAreaX + 20, knightAreaY + 75);

			// 繪製輪次數字
			ctx.fillStyle = "#ffd37f";
			const roundNumText = mobRecord.round_num.toString();
			const roundNumX =
				knightAreaX + 20 + ctx.measureText(useRoundText).width + 10;
			ctx.fillText(roundNumText, roundNumX, knightAreaY + 75);

			// 繪製星星
			const normalStar = await getCachedImage(IMAGE_PATHS.UI.NORMAL_STAR);
			const normalStarGrey = await getCachedImage(
				IMAGE_PATHS.UI.NORMAL_STAR_GREY
			);
			const starSize = 32;
			const starStartX =
				roundNumX + ctx.measureText(roundNumText).width + 20; // 在輪次數字右側

			// 繪製金色星星
			if (normalStar) {
				for (let j = 0; j < mobRecord.star_num; j++) {
					(ctx as any).drawImage(
						normalStar,
						starStartX + j * starSize,
						knightAreaY + 52, // 調整垂直位置與文字對齊
						starSize,
						starSize
					);
				}
			}

			// 繪製灰色星星
			if (normalStarGrey) {
				for (let j = mobRecord.star_num; j < 3; j++) {
					(ctx as any).drawImage(
						normalStarGrey,
						starStartX + j * starSize,
						knightAreaY + 52, // 調整垂直位置與文字對齊
						starSize,
						starSize
					);
				}
			}

			// 只有當 has_challenge_record 為 true 時才繪製角色
			if (mobRecord.has_challenge_record) {
				// 繪製角色
				const knightAvatarPromises = mobRecord.avatars.map(character =>
					getCachedImage(character.icon)
				);
				const knightAvatarImages =
					await Promise.all(knightAvatarPromises);

				// 獲取角色背景圖片
				const knightChar4StarBg = await getCachedImage(
					IMAGE_PATHS.CHARACTERS.FOUR_STAR
				);
				const knightChar5StarBg = await getCachedImage(
					IMAGE_PATHS.CHARACTERS.FIVE_STAR
				);

				// 元素圖標緩存
				const knightElementIcons = new Map<string, Image>();

				for (let j = 0; j < mobRecord.avatars.length; j++) {
					const character = mobRecord.avatars[j];
					if (!character) continue;

					const avatarX =
						knightAreaX +
						20 +
						(j * knightAreaWidth) / mobRecord.avatars.length;
					const avatarY = knightAreaY + 100;
					const avatarWidth = CHARACTER_CONFIG.KNIGHT.WIDTH;
					const avatarHeight = CHARACTER_CONFIG.KNIGHT.HEIGHT;
					const avatar = knightAvatarImages[j] || null;

					const config: CharacterDrawConfig = {
						avatarX,
						avatarY,
						avatarWidth,
						avatarHeight,
						char4StarBg: knightChar4StarBg,
						char5StarBg: knightChar5StarBg,
						elementIcons: knightElementIcons,
						tr
					};

					await drawSmallCharacter(ctx, character, avatar, config);
				}
			}

			// 繪製怪物圖標
			const monsterIcon = await getCachedImage(mobInfo.monster_icon);
			if (monsterIcon) {
				const iconSize = 80;
				const iconX = knightAreaX + knightAreaWidth - iconSize - 10;
				const iconY = knightAreaY + 10;
				(ctx as any).drawImage(
					monsterIcon,
					iconX,
					iconY,
					iconSize,
					iconSize
				);
			}
		}

		// 底部時間資訊
		ctx.font = "bold 26px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "rgba(128,128,128,.7)";
		ctx.textAlign = "left";
		if (floor.group.begin_time && floor.group.end_time) {
			ctx.fillText(
				`#${floor.group.group_id} ${tr("forgottenHall_TimeFooter")}: ${formatDate(floor.group.begin_time)} - ${formatDate(floor.group.end_time)} UID ${uid}`,
				7,
				canvas.height - 13
			);
		}

		// 儲存異常仲裁輪次記錄（如果是用戶自己的帳號且有 boss_record）
		if (
			floor.boss_record?.has_challenge_record &&
			floor.boss_record.round_num !== undefined
		) {
			const expireTime = timeToTimestamp(floor.group.end_time);
			const anomalyRecord: AnomalyRoundRecord = {
				roundNum: floor.boss_record.round_num,
				expireTime: expireTime
			};

			// 儲存到數據庫
			await database.set(`${uid}.anomalyRoundNum`, anomalyRecord);
		}

		// 儲存異常仲裁徽章記錄（如果有 boss_record 且有 challenge_peak_rank_icon）
		if (
			floor.boss_record?.has_challenge_record &&
			floor.boss_record.challenge_peak_rank_icon
		) {
			const expireTime = timeToTimestamp(floor.group.end_time);
			const challengeTime = timeToTimestamp(
				floor.boss_record.challenge_time
			);

			const rankRecord: AnomalyRankRecord = {
				mazeId: floor.boss_info.maze_id,
				groupName: floor.group.name_mi18n,
				rankIcon: floor.boss_record.challenge_peak_rank_icon,
				rankIconType: floor.boss_record.challenge_peak_rank_icon_type,
				expireTime: expireTime,
				challengeTime: challengeTime
			};

			// 獲取現有的徽章記錄
			const existingRecords =
				((await database.get(
					`${uid}.anomalyRankIcon`
				)) as AnomalyRankRecord[]) || [];

			// 檢查是否已存在相同的 maze_id 記錄
			const existingIndex = existingRecords.findIndex(
				record => record.mazeId === floor.boss_info.maze_id
			);

			if (existingIndex >= 0) {
				// 更新現有記錄
				existingRecords[existingIndex] = rankRecord;
			} else {
				// 添加新記錄
				existingRecords.push(rankRecord);
			}

			// 儲存到數據庫
			await database.set(`${uid}.anomalyRankIcon`, existingRecords);
		}

		return canvas.toBuffer("image/webp");
	} catch (e) {
		console.log(e);
		new Logger("異常仲裁").error(`AnomalyArbitration Error: ${e}`);
		return null;
	}
}

async function drawFloorImage(
	tr: any,
	uid: string,
	res: ForgottenHallResponse | AnomalyArbitrationResponse,
	mode: number,
	floor: FloorDetail | ChallengePeakRecord
): Promise<Buffer | null> {
	if (mode === 4) {
		return await drawAnomalyArbitrationImage(
			tr,
			uid,
			res as AnomalyArbitrationResponse,
			mode,
			floor as ChallengePeakRecord
		);
	}

	return await drawForgottenHallImage(
		tr,
		uid,
		res as ForgottenHallResponse,
		mode,
		floor as FloorDetail
	);
}

async function drawForgottenHallImage(
	tr: any,
	uid: string,
	res: ForgottenHallResponse,
	mode: number,
	floor: FloorDetail
): Promise<Buffer | null> {
	try {
		const canvas = createCanvas(
			CANVAS_CONFIG.WIDTH,
			CANVAS_CONFIG.HEIGHT.FORGOTTEN
		);
		const ctx = canvas.getContext("2d");

		const bgPath = getBackgroundPath(mode);
		const background = await getCachedImage(bgPath);
		if (background) {
			(ctx as any).drawImage(background, 0, 0, CANVAS_CONFIG.WIDTH, 1080);
		}

		const backgroundColor = getBackgroundColor(mode);
		const borderColor = "rgba(255,255,255,.4)";
		const borderWidth = 1;

		ctx.font = "bold 38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "#FFC870";
		ctx.textAlign = "center";
		ctx.fillText(
			tr("forgottenHall_Mode" + mode) + tr("forgottenHall_Title"),
			canvas.width / 2,
			125
		);

		const box1X = 91;
		const box1Y = 175;
		const box1Width = 1738;
		const box1Height = 144;

		ctx.fillStyle = mode == 3 ? "rgba(0, 0, 0, .45)" : backgroundColor;
		ctx.fillRect(box1X, box1Y, box1Width, box1Height);

		ctx.strokeStyle = borderColor;
		ctx.lineWidth = borderWidth;
		ctx.strokeRect(box1X, box1Y, box1Width, box1Height);

		const lineX = box1X + (92.39 / 632) * box1Width;
		const lineY = box1Y;
		const lineHeight = box1Height;

		ctx.beginPath();
		ctx.moveTo(lineX, lineY);
		ctx.lineTo(lineX, lineY + lineHeight);
		ctx.stroke();

		const star = await getCachedImage(
			"./src/assets/image/forgottenhall/star.png"
		);
		if (star) {
			(ctx as any).drawImage(star, 150, 220, 54, 54);
		}

		ctx.font = "38px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(`× ${res.star_num}`, 253, 263);

		ctx.font = "bold 31px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(
			`${tr("forgottenHall_Level")}:  ${floor.name.replace(
				/<\/?[^>]+(>|$)/g,
				""
			)}`,
			425,
			230
		);

		ctx.font = "31px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "left";
		ctx.fillText(
			`${tr("forgottenHall_Battle")}:  ${res.battle_num}`,
			425,
			285
		);

		if (mode == 3) {
			ctx.fillStyle = mode == 3 ? "rgba(0, 0, 0, .45)" : backgroundColor;
			ctx.fillRect(box1X, box1Y + 165, box1Width, box1Height - 50);

			ctx.strokeStyle = borderColor;
			ctx.lineWidth = borderWidth;
			ctx.strokeRect(box1X, box1Y + 165, box1Width, box1Height - 50);

			const lineX = box1X + box1Width / 2;
			const lineY = box1Y + 165;
			const lineHeight = box1Height - 50;

			ctx.beginPath();
			ctx.moveTo(lineX, lineY);
			ctx.lineTo(lineX, lineY + lineHeight);
			ctx.stroke();

			const bossBg = await getCachedImage(
				`./src/assets/image/forgottenhall/knightBossNode.png`
			);

			const upperBoss = await getCachedImage(
				res.groups?.[0]?.upper_boss.icon || ""
			);
			const lowerBoss = await getCachedImage(
				res.groups?.[0]?.lower_boss.icon || ""
			);

			for (let i = 1; i <= 2; i++) {
				ctx.font =
					"bold 24px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "left";
				ctx.fillText(
					`${tr("forgottenHall_TeamSetup", {
						z: i.toString()
					})}`,
					i == 1 ? box1X + 20 : box1X + box1Width / 2 + 20,
					lineY + 40
				);

				ctx.fillText(
					`${i == 1 ? res.groups?.[0]?.upper_boss.name_mi18n : res.groups?.[0]?.lower_boss.name_mi18n}`,
					i == 1 ? box1X + 20 : box1X + box1Width / 2 + 20,
					lineY + 75
				);
			}

			if (bossBg) {
				(ctx as any).drawImage(
					bossBg,
					box1X + box1Width / 2 - 180,
					lineY + 2,
					174.6,
					90
				);
				(ctx as any).drawImage(
					bossBg,
					box1X + box1Width - 180,
					lineY + 2,
					174.6,
					90
				);
			}
			if (upperBoss) {
				(ctx as any).drawImage(
					upperBoss,
					box1X + box1Width / 2 - 110,
					lineY + 7,
					80,
					80
				);
			}
			if (lowerBoss) {
				(ctx as any).drawImage(
					lowerBoss,
					box1X + box1Width - 110,
					lineY + 7,
					80,
					80
				);
			}
		}

		const mainBorderRadius = 60;
		const bg2Width = 1735;
		const bg2Height = mode == 2 || mode == 3 ? 546 : 496;
		const bg2Path = getBackground2Path(mode);
		const background2 = await getCachedImage(bg2Path);

		const box2X = canvas.width / 2 - bg2Width / 2;
		const box2Y =
			canvas.height / 2 -
			bg2Height / 2 +
			(mode == 3 ? 190 : mode == 2 ? 125 : 100);

		ctx.fillStyle = backgroundColor;
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			mainBorderRadius,
			true,
			false
		);

		ctx.save();
		ctx.beginPath();
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			mainBorderRadius,
			false,
			false
		);
		ctx.clip();
		if (background2) {
			(ctx as any).drawImage(
				background2,
				box2X,
				box2Y,
				bg2Width,
				bg2Height
			);
		}
		ctx.fillStyle = "rgba(0,0,0,.5)";
		ctx.fillRect(box2X, box2Y, bg2Width, 150);
		ctx.restore();

		ctx.strokeStyle = borderColor;
		ctx.lineWidth = borderWidth;
		ctx.beginPath();
		drawRoundedRect(
			ctx,
			box2X,
			box2Y,
			bg2Width,
			bg2Height,
			mainBorderRadius,
			false,
			true
		);

		ctx.font = "bold 42px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.fillText(
			`${floor.name.replace(/<\/?[^>]+(>|$)/g, "")}`,
			200,
			mode == 3 ? 460 + 65 : 460
		);

		ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "rgba(255,255,255,.7)";
		ctx.textAlign = "left";

		if (mode == 2) {
			const forgottenHallUseRoundText = `${tr(
				"forgottenHall_UseRound"
			)}:`;
			const forgottenHallUseRoundX = 200;
			const forgottenHallUseRoundY = 515;

			ctx.fillText(
				forgottenHallUseRoundText,
				forgottenHallUseRoundX,
				forgottenHallUseRoundY
			);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${floor.round_num}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					30,
				forgottenHallUseRoundY + 1.5
			);

			ctx.fillStyle = "rgba(255,255,255,.7)";
			ctx.fillText(
				`${tr("TotalScore")}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					ctx.measureText(`${floor.round_num}`).width +
					60,
				forgottenHallUseRoundY
			);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${
					parseInt(floor.node_1.score) + parseInt(floor.node_2.score)
				}`,
				forgottenHallUseRoundX +
					ctx.measureText(forgottenHallUseRoundText).width +
					ctx.measureText(`${floor.round_num}`).width +
					ctx.measureText(`${tr("TotalScore")}`).width +
					90,
				forgottenHallUseRoundY + 1.5
			);
		} else if (mode == 3) {
			ctx.fillStyle = "rgba(255,255,255,.7)";
			ctx.fillText(`${tr("TotalScore")}`, 200, 515 + 65);

			ctx.fillStyle = "rgb(249, 200, 126)";
			ctx.fillText(
				`${
					parseInt(floor.node_1.score) + parseInt(floor.node_2.score)
				}`,
				200 + ctx.measureText(tr("TotalScore")).width + 40,
				515 + 1.5 + 65
			);
		} else {
			ctx.fillText(
				`${tr("forgottenHall_UseRound")}:  ${floor.round_num}`,
				200,
				515
			);
		}

		if (star) {
			for (let i = 0; i < floor.star_num; i++)
				(ctx as any).drawImage(
					star,
					1650 - (i * 68 - 3),
					mode == 3 ? 435 + 65 : 435,
					68,
					68
				);
		}

		const char4StarBg = await getCachedImage(
			"./src/assets/image/forgottenhall/character4star.png"
		);
		const char5StarBg = await getCachedImage(
			"./src/assets/image/forgottenhall/character5star.png"
		);

		const elementIcons = new Map<string, Image>();

		for (let i = 1; i <= 2; i++) {
			const x = i == 1 ? 200 : 1025;
			const y = mode == 3 ? 600 + 65 : 600;
			const node = floor[`node_${i}` as keyof FloorDetail] as NodeInfo;

			ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText(
				`${tr("forgottenHall_TeamSetup", {
					z: i.toString()
				})}`,
				x,
				y
			);

			if (mode == 2 || mode == 3) {
				ctx.font = "28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "rgba(255,255,255,.7)";
				ctx.textAlign = "left";
				ctx.fillText(
					`${tr("Score")}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_TeamSetup", {
								z: i.toString()
							})}`
						).width +
						25,
					y
				);

				ctx.fillStyle = "rgb(249, 200, 126)";
				ctx.fillText(
					`${node.score}`,
					x +
						ctx.measureText(
							`${tr("forgottenHall_TeamSetup", {
								z: i.toString()
							})}`
						).width +
						ctx.measureText(`${tr("Score")}`).width +
						40,
					y + 1.5
				);
			} else {
				const time = node.challenge_time;
				if (time) {
					ctx.font =
						"28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
					ctx.fillStyle = "rgba(255,255,255,.7)";
					ctx.textAlign = "left";
					ctx.fillText(
						`${time.year}/${time.month}/${time.day} ${time.hour}:${time.minute}`,
						x +
							ctx.measureText(
								`${tr("forgottenHall_TeamSetup", {
									z: i.toString()
								})}`
							).width +
							25,
						y
					);
				}
			}

			const avatarPromises = node.avatars.map(character =>
				getCachedImage(character.icon)
			);
			const avatarImages = await Promise.all(avatarPromises);

			for (let j = 0; j < node.avatars.length; j++) {
				const character = node.avatars[j];
				if (!character) continue;
				const avatarX = x + j * (750 / node.avatars.length);
				const avatarY = mode == 3 ? 630 + 65 : 630;
				const avatarWidth = 148;
				const avatarHeight = 180;

				const bg = character.rarity == 4 ? char4StarBg : char5StarBg;
				if (bg) {
					(ctx as any).drawImage(
						bg,
						avatarX,
						avatarY,
						avatarWidth,
						avatarHeight
					);
				}

				const avatar = avatarImages[j];
				if (avatar) {
					(ctx as any).drawImage(
						avatar,
						avatarX,
						avatarY,
						avatarWidth,
						avatarHeight
					);
				}

				ctx.fillStyle = "rgba(0,0,0,.7)";
				ctx.fillRect(
					avatarX,
					avatarY + avatarHeight - 3 - 31,
					avatarWidth,
					31
				);

				ctx.font = "30px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(
					`${tr("level_Format", {
						level: `${character.level}`
					})}`,
					avatarX + 74,
					avatarY + avatarHeight - 7
				);

				ctx.beginPath();
				ctx.arc(avatarX + 30, avatarY + 25, 15, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				const elementId = character.element || "physical";
				if (!elementIcons.has(elementId)) {
					const elementImage = await getCachedImage(
						`./src/assets/image/element/${elementId}.png`
					);
					if (elementImage) {
						elementIcons.set(elementId, elementImage);
					}
				}
				const elementImage = elementIcons.get(elementId);
				if (elementImage) {
					(ctx as any).drawImage(
						elementImage,
						avatarX + 16,
						avatarY + 11,
						27,
						27
					);
				}

				if (character.rank != 0) {
					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					const rankX = avatarX + 110;
					const rankY = avatarY;
					const rankWidth = 40;
					const rankHeight = 50;

					ctx.beginPath();
					ctx.moveTo(rankX, rankY);
					ctx.lineTo(rankX + rankWidth - 37, rankY);
					ctx.quadraticCurveTo(
						rankX + rankWidth,
						rankY,
						rankX + rankWidth,
						rankY + 37
					);
					ctx.lineTo(rankX + rankWidth, rankY + rankHeight);
					ctx.lineTo(rankX + 20, rankY + rankHeight);
					ctx.quadraticCurveTo(
						rankX,
						rankY + rankHeight,
						rankX,
						rankY + rankHeight - 20
					);
					ctx.lineTo(rankX, rankY);
					ctx.closePath();
					ctx.fill();

					ctx.font =
						"28px 'Hanyi', URW DIN Arabic, Arial, sans-serif' ";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(
						`${character.rank}`,
						avatarX + 130,
						avatarY + 35
					);
				}
			}

			if (mode == 2 || mode == 3) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
				ctx.fillRect(x, y + 240, 710, 70);

				ctx.textAlign = "left";
				ctx.fillStyle = "rgb(249, 200, 126)";
				ctx.fillText(
					tr(mode == 2 ? "Cacophony" : "Finality"),
					x + 20,
					y + 285
				);

				ctx.beginPath();
				ctx.arc(x + 215, y + 274, 28, 0, 2 * Math.PI);
				ctx.fillStyle = "rgba(0,0,0,.4)";
				ctx.fill();

				if (node.buff) {
					const buffImage = await getCachedImage(node.buff.icon);
					if (buffImage) {
						(ctx as any).drawImage(
							buffImage,
							x + 187.5,
							y + 245,
							56,
							56
						);
					}

					ctx.fillStyle = "lightgray";
					ctx.fillText(`${node.buff.name_mi18n}`, x + 257.5, y + 285);
				}
			}
		}

		const beginTime = res?.begin_time ?? res.groups?.[0]?.begin_time;
		const endTime = res?.end_time ?? res.groups?.[0]?.end_time;
		const schedule_id = res?.schedule_id ?? res.groups?.[0]?.schedule_id;
		ctx.font = "bold 26px 'PingFang', URW DIN Arabic, Arial, sans-serif' ";
		ctx.fillStyle = "rgba(128,128,128,.7)";
		ctx.textAlign = "left";
		if (beginTime && endTime && schedule_id) {
			ctx.fillText(
				`#${schedule_id} ${tr("forgottenHall_TimeFooter")}: ${formatDate(beginTime)} - ${formatDate(endTime)} UID ${uid}`,
				7,
				canvas.height - 13
			);
		}

		return canvas.toBuffer("image/webp");
	} catch (e) {
		new Logger("ForgottenHall").error(`ForgottenHall Error: ${e}`);
		return null;
	}
}

export {
	handleForgottenHallDraw,
	drawFloorImage,
	drawAnomalyArbitrationImage,
	drawForgottenHallImage
};
