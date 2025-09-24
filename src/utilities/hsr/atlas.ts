import {
	ChatInputCommandInteraction,
	AttachmentBuilder,
	EmbedBuilder
} from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import type { TranslationFunction } from "@/types/index.js";
import { join } from "path";
import Queue from "queue";
import { getRandomColor } from "@/utilities/index.js";
import {
	getCharacterSimplyData,
	getLightconeNameById
} from "@/utilities/hsr/selectmenu.js";
import { loadRelicSetData } from "@/utilities/hsr/jsonManager.js";
import { Converter } from "opencc-js";

// 簡體轉繁體的輔助函數
const s2tConverter = Converter({ from: "cn", to: "tw" });
function s2t(text: string): string {
	if (!text) return text;
	return s2tConverter(text);
}

const baseTypeToPathMap = {
	warrior: "destruction",
	rogue: "hunt",
	mage: "erudition",
	priest: "abundance",
	shaman: "harmony",
	warlock: "nihility",
	knight: "preservation",
	memory: "remembrance"
};

// 属性ID到翻译键的映射
const propertyToTranslationKey: { [key: string]: string } = {
	PhysicalAddedRatio: "property_PhysicalAddedRatio",
	FireAddedRatio: "property_FireAddedRatio",
	IceAddedRatio: "property_IceAddedRatio",
	ThunderAddedRatio: "property_ThunderAddedRatio",
	WindAddedRatio: "property_WindAddedRatio",
	QuantumAddedRatio: "property_QuantumAddedRatio",
	ImaginaryAddedRatio: "property_ImaginaryAddedRatio",
	HPDelta: "property_MaxHP",
	AttackDelta: "property_Attack",
	DefenceDelta: "property_Defence",
	HPAddedRatio: "property_MaxHP",
	AttackAddedRatio: "property_Attack",
	DefenceAddedRatio: "property_Defence",
	SpeedDelta: "property_Speed",
	CriticalChanceBase: "property_CriticalChance",
	CriticalDamageBase: "property_CriticalDamage",
	SPRatioBase: "property_EnergyRecovery",
	HealRatioBase: "property_HealRatioBase",
	StatusProbabilityBase: "property_StatusProbability",
	StatusResistanceBase: "property_StatusResistance",
	BreakDamageAddedRatioBase: "property_BreakUp"
};

// Tag数字到文字的映射
const tagToText: { [key: number]: string } = {
	1: "单攻",
	2: "群攻",
	4: "弹射",
	5: "扩散",
	6: "辅助",
	8: "妨害",
	9: "回复",
	11: "防御",
	13: "强化",
	15: "天赋",
	16: "",
	17: "召唤"
};

// 技能類型的映射（中文）
const skillTypeToText: { [key: string]: string } = {
	Normal: "普攻",
	BPSkill: "战技",
	Ultra: "终结技",
	Talent: "天赋",
	Maze: "秘技",
	Passive: "天赋",
	Insert: "追加攻击",
	QTE: "QTE",
	DOT: "持续伤害",
	Pursued: "追击",
	MazeNormal: "秘技普攻",
	ElementDamage: "元素伤害"
};

const servantTypeToText: { [key: string]: string } = {
	Servant: "忆灵技",
	Talent: "忆灵天赋"
};

// 技能Tag到数字的映射
const skillTagToNumber: { [key: string]: number } = {
	SingleAttack: 1,
	AoEAttack: 2,
	ShieldBreak: 3,
	Bounce: 4,
	Blast: 5,
	Support: 6,
	Weaken: 7,
	Impair: 8,
	Restore: 9,
	Taunt: 10,
	Defence: 11,
	Damage: 12,
	Enhance: 13,
	Transform: 14,
	Passive: 15,
	MazeAttack: 16,
	Summon: 17
};

// 图片缓存系统
const imageCache = new Map<string, any>();
const CACHE_SIZE_LIMIT = 100; // 限制缓存大小

// 颜色缓存系统
const colorCache = new Map<string, { light: string; dark: string }>();

// 辅助函数：调整颜色亮度（带缓存）
function adjustBrightness(color: string, factor: number): string {
	// 检查缓存
	const cacheKey = `${color}_${factor}`;
	if (colorCache.has(cacheKey)) {
		const cached = colorCache.get(cacheKey);
		return factor === 1.2 ? cached!.light : cached!.dark;
	}

	// 将十六进制颜色转换为RGB
	const hex = color.replace("#", "");
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);

	// 调整亮度
	const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
	const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
	const newB = Math.min(255, Math.max(0, Math.round(b * factor)));

	// 转换回十六进制
	const result = `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;

	// 缓存结果
	if (factor === 1.2) {
		if (!colorCache.has(color)) {
			colorCache.set(color, { light: result, dark: "" });
		} else {
			colorCache.get(color)!.light = result;
		}
	} else if (factor === 0.8) {
		if (!colorCache.has(color)) {
			colorCache.set(color, { light: "", dark: result });
		} else {
			colorCache.get(color)!.dark = result;
		}
	}

	return result;
}

// 获取或缓存图片
async function getCachedImage(url: string): Promise<any> {
	if (imageCache.has(url)) {
		return imageCache.get(url);
	}

	try {
		const image = await loadImage(url);

		// 管理缓存大小
		if (imageCache.size >= CACHE_SIZE_LIMIT) {
			const firstKey = imageCache.keys().next().value;
			if (firstKey) {
				imageCache.delete(firstKey);
			}
		}

		imageCache.set(url, image);
		return image;
	} catch (error) {
		console.error(`Failed to load image: ${url}`, error);
		throw error;
	}
}

// 角色数据缓存
let characterListCache: any = null;
let characterDetailCache: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 绘制队列
const drawQueue = new Queue({ autostart: true });

// 字体注册状态
let fontsRegistered = false;

/**
 * 繪製帶顏色標記的文字
 * @param ctx - Canvas 上下文
 * @param text - 包含顏色標記的文字
 * @param x - 起始 X 座標
 * @param y - 起始 Y 座標
 * @param maxWidth - 最大寬度
 * @param defaultColor - 默認顏色
 * @param lineHeight - 行高
 * @returns 最終的 Y 座標
 */
function drawColoredText(
	ctx: any,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	defaultColor: string = "#cccccc",
	lineHeight: number = 18
): number {
	// 處理帶顏色的文本標記 [color]text[/color]
	const colorRegex = /\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]/g;
	let colorMatches: Array<{
		color: string;
		text: string;
		index: number;
		fullMatch: string;
	}> = [];
	let match;

	// 收集所有顏色標記
	while ((match = colorRegex.exec(text)) !== null) {
		if (match[1] && match[2]) {
			colorMatches.push({
				color: match[1],
				text: match[2],
				index: match.index,
				fullMatch: match[0]
			});
		}
	}

	let currentY = y;
	let currentX = x;
	let currentLine = "";

	// 如果沒有顏色標記，使用簡單的文字繪製
	if (colorMatches.length === 0) {
		// 先按換行符分割
		const lines = text.split("\n");

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			if (!line && lineIndex < lines.length - 1) {
				// 空行，直接換行
				currentY += lineHeight;
				continue;
			}

			const words = (line || "").split("");
			ctx.fillStyle = defaultColor;
			currentLine = "";
			currentX = x;

			for (const word of words) {
				const testLine = currentLine + word;
				const metrics = ctx.measureText(testLine);

				if (metrics.width > maxWidth && currentLine !== "") {
					// 檢查下一個字符是否是句號
					const nextIndex = words.indexOf(word) + 1;
					if (nextIndex < words.length && words[nextIndex] === "。") {
						// 如果下一個字符是句號，嘗試將當前字符和句號一起放在當前行
						const testLineWithPeriod = currentLine + word + "。";
						const metricsWithPeriod =
							ctx.measureText(testLineWithPeriod);

						// 如果加上句號後仍然不超過最大寬度，就將句號也加入當前行
						if (metricsWithPeriod.width <= maxWidth * 1.05) {
							// 允許 5% 的寬度彈性
							ctx.fillText(
								currentLine + word + "。",
								x,
								currentY
							);
							// 跳過下一個字符（句號）
							words.splice(nextIndex, 1);
							currentLine = "";
							currentY += lineHeight;
							continue;
						}
					}

					// 繪製當前行
					ctx.fillText(currentLine, x, currentY);
					currentLine = word;
					currentY += lineHeight;
				} else {
					currentLine = testLine;
				}
			}

			// 繪製當前行的剩餘文字
			if (currentLine) {
				ctx.fillText(currentLine, x, currentY);
			}

			// 如果不是最後一行，換行
			if (lineIndex < lines.length - 1) {
				currentY += lineHeight;
			}
		}

		return currentY;
	}

	// 處理帶顏色標記的文字
	let lastIndex = 0;
	let segments: Array<{ text: string; color: string }> = [];

	// 建立文字段落陣列
	for (const colorMatch of colorMatches) {
		// 添加顏色標記之前的普通文字
		if (colorMatch.index > lastIndex) {
			segments.push({
				text: text.substring(lastIndex, colorMatch.index),
				color: defaultColor
			});
		}

		// 添加帶顏色的文字
		segments.push({
			text: colorMatch.text,
			color: `#${colorMatch.color}`
		});

		lastIndex = colorMatch.index + colorMatch.fullMatch.length;
	}

	// 添加最後的普通文字
	if (lastIndex < text.length) {
		segments.push({
			text: text.substring(lastIndex),
			color: defaultColor
		});
	}

	// 繪製所有段落 - 使用改進的邏輯處理換行
	let pendingSegments: Array<{ text: string; color: string }> = [];

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		if (!segment) continue;

		// 處理換行符
		const lines = segment.text.split("\n");

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const lineText = lines[lineIndex];

			// 如果是換行符導致的新行（不是第一行）
			if (lineIndex > 0) {
				// 先繪製當前行的所有待繪製段落
				if (pendingSegments.length > 0 || currentLine) {
					let lineX = x;
					for (const pending of pendingSegments) {
						ctx.fillStyle = pending.color;
						ctx.fillText(pending.text, lineX, currentY);
						lineX += ctx.measureText(pending.text).width;
					}
					pendingSegments = [];
				}

				// 換行
				currentY += lineHeight;
				currentX = x;
				currentLine = "";
			}

			// 處理當前行的文字
			const chars = (lineText || "").split("");

			for (let j = 0; j < chars.length; j++) {
				const char = chars[j];
				if (!char) continue;

				const testLine = currentLine + char;
				const testWidth = ctx.measureText(testLine).width;

				if (testWidth > maxWidth && currentLine !== "") {
					// 檢查當前字符是否是句號，且前一行還有空間
					if (char === "。" && pendingSegments.length > 0) {
						// 嘗試將句號加到前一行
						let lineX = x;
						let fullLine = "";

						// 計算前一行的完整文字
						for (const pending of pendingSegments) {
							fullLine += pending.text;
						}

						// 測試加上句號後的寬度
						const testLineWithPeriod = fullLine + "。";
						const metricsWithPeriod =
							ctx.measureText(testLineWithPeriod);

						// 如果加上句號後不超過最大寬度（允許一點彈性）
						if (metricsWithPeriod.width <= maxWidth * 1.05) {
							// 將句號加到最後一個段落
							const lastSegment =
								pendingSegments[pendingSegments.length - 1];
							if (lastSegment) {
								lastSegment.text += "。";
							}
							continue; // 跳過這個句號，不需要換行
						}
					}

					// 需要換行，先繪製當前行的所有待繪製段落
					let lineX = x;

					for (const pending of pendingSegments) {
						ctx.fillStyle = pending.color;
						ctx.fillText(pending.text, lineX, currentY);
						lineX += ctx.measureText(pending.text).width;
					}

					// 清空待繪製段落
					pendingSegments = [];

					// 換行
					currentY += lineHeight;
					currentLine = char;

					// 將當前字符作為新段落的開始
					pendingSegments.push({
						text: char,
						color: segment.color
					});
				} else {
					// 不需要換行，累積字符
					currentLine = testLine;

					// 更新或添加當前段落
					if (pendingSegments.length > 0) {
						const lastSegment =
							pendingSegments[pendingSegments.length - 1];
						if (
							lastSegment &&
							lastSegment.color === segment.color
						) {
							// 如果顏色相同，累積到最後一個段落
							lastSegment.text += char;
						} else {
							// 如果顏色不同，創建新段落
							pendingSegments.push({
								text: char,
								color: segment.color
							});
						}
					} else {
						// 如果沒有待繪製段落，創建新段落
						pendingSegments.push({
							text: char,
							color: segment.color
						});
					}
				}
			}
		}
	}

	// 繪製最後一行的所有待繪製段落
	if (pendingSegments.length > 0) {
		let lineX = x;
		for (const pending of pendingSegments) {
			ctx.fillStyle = pending.color;
			ctx.fillText(pending.text, lineX, currentY);
			lineX += ctx.measureText(pending.text).width;
		}
	}

	return currentY;
}

// 预加载常用图片
async function preloadCommonImages(): Promise<void> {
	// 只注册一次字体
	if (fontsRegistered) return;

	// 注册字体
	GlobalFonts.registerFromPath(
		join(".", "src", ".", "assets", "URW-DIN-Arabic-Medium.ttf"),
		"URW DIN Arabic"
	);
	GlobalFonts.registerFromPath(
		join(".", "src", ".", "assets", "RPG_CN.ttf"),
		"YaHei"
	);
	GlobalFonts.registerFromPath(
		join(".", "src", ".", "assets", "Cinzel.ttf"),
		"Cinzel"
	);
	GlobalFonts.registerFromPath(
		join(".", "src", ".", "assets", "FourthWorld.ttf"),
		"FourthWorld"
	);

	fontsRegistered = true;
}

// 预加载常用图标
async function preloadCommonIcons(): Promise<void> {
	const commonIcons = [
		"./src/assets/image/forgottenhall/IconRelicBody.webp",
		"./src/assets/image/forgottenhall/IconRelicFoot.webp",
		"./src/assets/image/forgottenhall/IconRelicNeck.webp",
		"./src/assets/image/forgottenhall/IconRelicGoods.webp",
		"./src/assets/image/forgottenhall/star2.png",
		"./src/assets/image/forgottenhall/bg_character.png"
	];

	// 并行预加载所有图标
	await Promise.allSettled(
		commonIcons.map(iconPath => getCachedImage(iconPath))
	);
}

// 获取装饰条颜色的辅助函数（避免重复计算）
function getDecoratorColor(characterId: string, characterData: any): string {
	// 优先使用角色配置的颜色
	if (characterOffset[characterId]?.decoratorColor) {
		return characterOffset[characterId].decoratorColor;
	}

	// 使用强制元素类型颜色
	if (
		characterOffset[characterId]?.forceElementType &&
		elementDecoratorColors[characterOffset[characterId].forceElementType]
	) {
		return elementDecoratorColors[
			characterOffset[characterId].forceElementType
		];
	}

	// 根据DamageType自动选择颜色
	if (
		characterData.DamageType &&
		elementDecoratorColors[
			characterData.DamageType as keyof typeof elementDecoratorColors
		]
	) {
		return elementDecoratorColors[
			characterData.DamageType as keyof typeof elementDecoratorColors
		];
	}

	// 默认金色
	return "#b8a37a";
}

// Canvas上下文状态管理（减少重复设置）
function setCanvasState(
	ctx: any,
	state: {
		font?: string;
		fillStyle?: string | CanvasGradient;
		strokeStyle?: string;
		lineWidth?: number;
		textAlign?: CanvasTextAlign;
		globalCompositeOperation?: string;
		filter?: string;
	}
) {
	if (state.font !== undefined) ctx.font = state.font;
	if (state.fillStyle !== undefined) ctx.fillStyle = state.fillStyle;
	if (state.strokeStyle !== undefined) ctx.strokeStyle = state.strokeStyle;
	if (state.lineWidth !== undefined) ctx.lineWidth = state.lineWidth;
	if (state.textAlign !== undefined) ctx.textAlign = state.textAlign;
	if (state.globalCompositeOperation !== undefined)
		ctx.globalCompositeOperation = state.globalCompositeOperation;
	if (state.filter !== undefined) ctx.filter = state.filter;
}

// 获取角色列表数据
async function getCharacterList() {
	const now = Date.now();
	if (characterListCache && now - lastCacheTime < CACHE_DURATION)
		return characterListCache;

	try {
		const response = await fetch(
			"https://api.hakush.in/hsr/data/character.json"
		);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch character data: ${response.status} - ${response.statusText}`
			);
		}

		characterListCache = await response.json();
		lastCacheTime = now;
		return characterListCache;
	} catch (error) {
		console.error("Error fetching character data:", error);
		throw error;
	}
}

// 获取角色详细数据
async function getCharacterDetail(characterId: string, lang?: string) {
	const now = Date.now();
	const cacheKey = `${characterId}_${lang || "cn"}`;
	if (
		characterDetailCache &&
		characterDetailCache[cacheKey] &&
		now - lastCacheTime < CACHE_DURATION
	)
		return characterDetailCache[cacheKey];

	try {
		// 首先尝试获取指定语言版本的数据
		const response = await fetch(
			`https://api.hakush.in/hsr/data/${lang || "cn"}/character/${characterId}.json`
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch character detail: ${response.status} - ${response.statusText}`
			);
		}

		const characterData = await response.json();

		// 验证角色数据是否包含必要字段
		if (!characterData.Name) {
			throw new Error(
				`Invalid character data: missing Name field for ID ${characterId}`
			);
		}

		// 如果当前语言不是英文，且需要获取 Ranks 的英文名称，则额外请求英文版本
		if (lang !== "en" && characterData.Ranks) {
			try {
				const enResponse = await fetch(
					`https://api.hakush.in/hsr/data/en/character/${characterId}.json`
				);

				if (enResponse.ok) {
					const enCharacterData = await enResponse.json();
					if (enCharacterData.Ranks) {
						// 将英文版本的 Ranks 数据合并到当前数据中
						characterData.Ranks = enCharacterData.Ranks;
					}
				}
			} catch (enError) {
				console.warn(
					`Failed to fetch English character data for Ranks: ${enError}`
				);
				// 如果获取英文数据失败，继续使用当前语言的数据
			}
		}

		// 缓存数据
		if (!characterDetailCache) characterDetailCache = {};
		characterDetailCache[cacheKey] = characterData;
		lastCacheTime = now;

		return characterData;
	} catch (error) {
		console.error(
			`Error fetching character detail for ID ${characterId}:`,
			error
		);
		throw error;
	}
}

// 处理角色图鉴
export async function handleCharacterAtlas(
	interaction: ChatInputCommandInteraction,
	tr: TranslationFunction,
	characterInput: string
): Promise<void> {
	try {
		await interaction.deferReply();
		const characterList = await getCharacterList();
		if (!characterList[characterInput]) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(`該角色不存在 \`${characterInput}\``)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				]
			});
			return;
		}

		const drawTask = async () => {
			try {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("Searching"))
							.setColor(getRandomColor() as any)
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
							)
					]
				});

				const requestStartTime = Date.now();

				// 获取角色详细数据
				// 获取当前语言，如果不是英文则获取英文版本的 Ranks 数据
				const currentLang = interaction.locale.startsWith("zh")
					? "cn"
					: "en";
				const characterDetail = await getCharacterDetail(
					characterInput,
					currentLang
				);
				if (!characterDetail)
					throw new Error(`無法獲取角色數據: ${characterInput}`);

				const drawStartTime = Date.now();

				// 创建Canvas图像
				const imageBuffer = await createCharacterCanvas(
					characterInput,
					characterDetail,
					tr
				);

				if (!imageBuffer) {
					throw new Error("無法生成角色圖鑑圖像");
				}

				const drawEndTime = Date.now();
				const image = new AttachmentBuilder(imageBuffer, {
					name: `character_${characterInput}.png`
				});

				// 计算耗时
				const requestTime = (
					(drawStartTime - requestStartTime) /
					1000
				).toFixed(2);
				const drawTime = ((drawEndTime - drawStartTime) / 1000).toFixed(
					2
				);

				await interaction.editReply({
					content: `-# ${tr("CostTime", {
						requestTime: requestTime,
						drawTime: drawTime
					})} `,
					embeds: [],
					files: [image]
				});
			} catch (error) {
				console.error(
					`Error in handleCharacterAtlas drawTask for ${characterInput}:`,
					error
				);
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("DrawError") || "绘制错误")
							.setDescription(`\`${error}\``)
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
			}
		};

		// 使用队列系统，与profile保持一致
		drawQueue.push(drawTask);

		if (drawQueue.length !== 1) {
			// 如果在队列中，显示排队信息
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("图鉴生成排队中")
						.setDescription(`您的位置: ${drawQueue.length - 1}`)
						.setColor("#f59e0b")
				]
			});
		}
	} catch (error) {
		console.error(
			`Error in handleCharacterAtlas for ${characterInput}:`,
			error
		);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setTitle("图鉴查询错误")
					.setDescription(`\`${error}\``)
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
			]
		});
	}
}

// 元素类型对应的装饰条颜色
const elementDecoratorColors = {
	Ice: "#2583c1", // 冰：藍色
	Wind: "#45c38b", // 風：綠色
	Physical: "#b0abaa", // 物理：灰色
	Quantum: "#443180", // 量子：紫色
	Fire: "#a72b28", // 火：紅色
	Thunder: "#a33da8", // 雷：紫色
	Imaginary: "#e4cf32" // 虛數：黃色
};

const characterOffset: {
	[key: string]: {
		x?: number;
		y?: number;
		decoratorColor?: string; // 装饰条颜色
		forceElementType?: keyof typeof elementDecoratorColors; // 强制使用特定元素类型
	};
} = {
	// Default x: 0, y: -200
	1410: { x: 300 }
};

// 创建角色Canvas图像
async function createCharacterCanvas(
	characterId: string,
	characterData: any,
	tr: TranslationFunction
): Promise<Buffer> {
	const canvasWidth = 1920;
	const canvasHeight = 1080;
	const canvas = createCanvas(canvasWidth, canvasHeight);
	await preloadCommonImages();
	await preloadCommonIcons(); // 预加载常用图标

	const ctx = canvas.getContext("2d");
	const backgroundImage = await getCachedImage(
		"./src/assets/image/forgottenhall/bg_character.png"
	);
	ctx.drawImage(backgroundImage, 0, 0, 1920, 1080);

	// Character Avatar with fade effect - 使用缓存优化
	const characterAvatar = await getCachedImage(
		`https://api.hakush.in/hsr/UI/avatardrawcard/${characterId}.webp`
	);
	const characterAvatarWidth = 1200;
	const characterAvatarHeight = 1200;

	const avatarX = -200; // 固定左侧位置
	const avatarY = canvasHeight / 2 - characterAvatarHeight / 2;

	// 创建临时canvas来应用渐变效果
	const tempCanvas = createCanvas(
		characterAvatarWidth,
		characterAvatarHeight
	);
	const tempCtx = tempCanvas.getContext("2d");

	// 在临时canvas上绘制角色头像，利用高画质图片进行中心放大裁剪
	const scale = 2.2; // 放大倍数，从2048x2048裁剪到800x800，突出角色面部
	const sourceSize = 2048; // 原始图片尺寸
	const cropSize = sourceSize / scale; // 裁剪区域大小
	// 获取角色特定的偏移量，如果没有配置则使用默认值
	const offsetX = characterOffset[characterId]?.x ?? 0;
	const offsetY = characterOffset[characterId]?.y ?? -200;
	const cropStartX = (sourceSize - cropSize) / 2 - offsetX; // 裁剪起始X坐标
	const cropStartY = (sourceSize - cropSize) / 2 + offsetY; // 向上偏移，突出角色面部

	// 从原始2048x2048图片中裁剪中心区域，然后缩放到800x800
	tempCtx.drawImage(
		characterAvatar,
		cropStartX,
		cropStartY,
		cropSize,
		cropSize, // 源图片裁剪区域
		0,
		0,
		characterAvatarWidth,
		characterAvatarHeight // 目标区域
	);

	// 添加图像增强效果，提升显示质量
	setCanvasState(tempCtx, {
		filter: "contrast(1.1) brightness(1.05) saturate(1.1)"
	});

	// 创建径向渐变遮罩，让角色图片越往外面越淡
	const gradient = tempCtx.createRadialGradient(
		characterAvatarWidth / 2, // 中心点X
		characterAvatarHeight / 2, // 中心点Y
		0, // 内圆半径
		characterAvatarWidth / 2, // 中心点X
		characterAvatarHeight / 2, // 中心点Y
		characterAvatarWidth / 2 // 外圆半径
	);

	// 设置渐变颜色，从中心完全不透明到边缘完全透明
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)"); // 中心完全不透明
	gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.95)"); // 60%位置95%透明度
	gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.8)"); // 75%位置80%透明度
	gradient.addColorStop(0.85, "rgba(255, 255, 255, 0.5)"); // 85%位置50%透明度
	gradient.addColorStop(0.92, "rgba(255, 255, 255, 0.2)"); // 92%位置20%透明度
	gradient.addColorStop(0.97, "rgba(255, 255, 255, 0.05)"); // 97%位置5%透明度
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)"); // 边缘完全透明

	// 应用渐变遮罩到临时canvas
	setCanvasState(tempCtx, {
		globalCompositeOperation: "destination-in",
		fillStyle: gradient
	});
	tempCtx.fillRect(0, 0, characterAvatarWidth, characterAvatarHeight);

	// 将处理后的图像绘制到主canvas
	ctx.drawImage(
		tempCanvas,
		avatarX,
		avatarY,
		characterAvatarWidth,
		characterAvatarHeight
	);

	// 定义右侧数据框的布局配置 - 支持灵活的flex布局
	const rightPanelConfig = {
		startX: avatarX + characterAvatarWidth + 20, // 角色图片结束后的起始位置
		panelWidth: 400,
		panelHeight: 260, // 增加非技能信息卡片的高度
		spacing: 30,
		columns: 2, // 2列布局
		rows: 3, // 3行布局
		// 支持不同角色的自定义布局
		flexible: true
	};

	// // 根据角色ID调整布局参数
	// if (characterId === "1410") {
	// 	// 流萤特殊布局：更宽的面板
	// 	rightPanelConfig.panelWidth = 450;
	// 	rightPanelConfig.spacing = 25;
	// } else if (characterId === "1301") {
	// 	// 银狼特殊布局：更紧凑的面板
	// 	rightPanelConfig.panelWidth = 380;
	// 	rightPanelConfig.spacing = 35;
	// }

	// 响应式布局：根据可用空间自动调整面板大小
	const availableWidth = canvasWidth - rightPanelConfig.startX - 50; // 减去右边距
	const availableHeight = canvasHeight - 240; // 减去上下边距

	// 自动计算最佳面板尺寸
	if (availableWidth < 800) {
		// 空间不足时，调整为单列布局
		rightPanelConfig.columns = 1;
		rightPanelConfig.panelWidth = Math.min(availableWidth - 30, 500);
	} else if (availableWidth < 1000) {
		// 中等空间，保持双列但调整面板宽度
		rightPanelConfig.panelWidth = Math.min((availableWidth - 30) / 2, 450);
	}

	// 调整行数以适应内容
	if (availableHeight < 700) {
		rightPanelConfig.rows = 2;
		rightPanelConfig.panelHeight = Math.min(
			(availableHeight - 60) / 2,
			250
		);
	}

	// 计算每个面板的位置
	const calculatePanelPosition = (row: number, col: number) => {
		const x =
			rightPanelConfig.startX +
			col * (rightPanelConfig.panelWidth + rightPanelConfig.spacing);
		const y =
			120 +
			row * (rightPanelConfig.panelHeight + rightPanelConfig.spacing);
		return { x, y };
	};

	// 绘制右侧数据面板
	const drawDataPanel = async (
		title: string,
		content: string[],
		x: number,
		y: number,
		color: string = "#1D1D1D"
	) => {
		// 面板背景
		ctx.fillStyle = color;
		ctx.fillRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);

		// 获取装饰条颜色（优化版本）
		const decoratorColor = getDecoratorColor(characterId, characterData);

		// 生成渐变颜色变体
		const primaryColor = decoratorColor;
		const lightColor = adjustBrightness(decoratorColor, 1.2);
		const darkColor = adjustBrightness(decoratorColor, 0.8);

		// 绘制装饰条
		ctx.fillStyle = primaryColor;
		ctx.fillRect(
			x - 1, // 位置：left: -1px
			y, // 位置：top: 0px
			3, // 宽度：width: 3px
			rightPanelConfig.panelHeight // 高度：覆盖整个面板高度
		);

		// 添加装饰条的渐变效果
		const barGradient = ctx.createLinearGradient(
			x - 1,
			y,
			x - 1,
			y + rightPanelConfig.panelHeight
		);
		barGradient.addColorStop(0, lightColor); // 顶部稍亮
		barGradient.addColorStop(0.5, primaryColor); // 中间主色
		barGradient.addColorStop(1, darkColor); // 底部稍暗

		ctx.fillStyle = barGradient;
		ctx.fillRect(x - 1, y, 3, rightPanelConfig.panelHeight);

		// 面板标题
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = primaryColor;
		ctx.fillText(title, x + 20, y + 30);

		// 面板内容
		ctx.font = "20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = "#cccccc";
		content.forEach((line, index) => {
			ctx.fillText(line, x + 20, y + 60 + index * 25);
		});

		// 面板边框
		ctx.strokeStyle = "#444444";
		ctx.lineWidth = 1;
		ctx.strokeRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);
	};

	// 绘制光锥图片面板
	const drawLightconePanel = async (
		title: string,
		lightconeIds: string[],
		x: number,
		y: number,
		color: string = "#1D1D1D"
	) => {
		// 面板背景
		ctx.fillStyle = color;
		ctx.fillRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);

		// 获取装饰条颜色（优化版本）
		const decoratorColor = getDecoratorColor(characterId, characterData);

		// 生成渐变颜色变体
		const primaryColor = decoratorColor;
		const lightColor = adjustBrightness(decoratorColor, 1.2);
		const darkColor = adjustBrightness(decoratorColor, 0.8);

		// 绘制装饰条
		ctx.fillStyle = primaryColor;
		ctx.fillRect(
			x - 1, // 位置：left: -1px
			y, // 位置：top: 0px
			3, // 宽度：width: 3px
			rightPanelConfig.panelHeight // 高度：覆盖整个面板高度
		);

		// 添加装饰条的渐变效果
		const barGradient = ctx.createLinearGradient(
			x - 1,
			y,
			x - 1,
			y + rightPanelConfig.panelHeight
		);
		barGradient.addColorStop(0, lightColor); // 顶部稍亮
		barGradient.addColorStop(0.5, primaryColor); // 中间主色
		barGradient.addColorStop(1, darkColor); // 底部稍暗

		ctx.fillStyle = barGradient;
		ctx.fillRect(x - 1, y, 3, rightPanelConfig.panelHeight);

		// 面板标题
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = primaryColor;
		ctx.fillText(title, x + 20, y + 30);

		// 绘制光锥图片和名称
		if (lightconeIds.length > 0) {
			const imageWidth = 348 / 3; // 光锥图片大小
			const imageHeight = 408 / 3; // 光锥图片大小
			const spacing = 15; // 图片之间的间距
			let cols = lightconeIds.length;
			if (lightconeIds.length === 4) cols = 2;
			else if (lightconeIds.length > 4) cols = 3;

			// 计算总内容宽度和高度
			const totalContentWidth = cols * imageWidth + (cols - 1) * spacing;

			// 计算起始位置，使内容居中
			const startX =
				x + (rightPanelConfig.panelWidth - totalContentWidth) / 2;
			const startY = y + 50;

			for (let i = 0; i < lightconeIds.length; i++) {
				const row = Math.floor(i / cols);
				const col = i % cols;
				const imageX = startX + col * (imageWidth + spacing);
				const imageY = startY + row * (imageHeight + spacing + 25); // 25是文字高度

				// 加载光锥图片（使用缓存）
				const imageUrl = `https://api.hakush.in/hsr/UI/lightconemediumicon/${lightconeIds[i]}.webp`;
				const image = await getCachedImage(imageUrl);

				// 绘制光锥图片
				ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);

				// 获取光锥名称
				const lightconeName = await getLightconeNameById(
					lightconeIds[i] || ""
				);
				if (lightconeName) {
					// 绘制光锥名称（图片下方）
					ctx.font =
						"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
					ctx.fillStyle = "#cccccc";
					ctx.textAlign = "center";
					ctx.fillText(
						`${s2t(lightconeName)}`,
						imageX + imageWidth / 2,
						imageY + imageHeight + 20
					);
				}
			}
		} else {
			// 如果没有光锥数据，显示提示信息
			ctx.font = "20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillStyle = "#cccccc";
			ctx.textAlign = "left";
			ctx.fillText("暫無推薦光錐", x + 20, y + 80);
		}

		// 重置文本对齐
		ctx.textAlign = "left";

		// 面板边框
		ctx.strokeStyle = "#444444";
		ctx.lineWidth = 1;
		ctx.strokeRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);
	};

	// 绘制推荐队伍面板
	const drawTeamPanel = async (teams: any[], x: number, y: number) => {
		// 面板背景
		ctx.fillStyle = "#1D1D1D";
		ctx.fillRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);

		// 获取装饰条颜色（优化版本）
		const decoratorColor = getDecoratorColor(characterId, characterData);

		// 生成渐变颜色变体
		const primaryColor = decoratorColor;
		const lightColor = adjustBrightness(decoratorColor, 1.2);
		const darkColor = adjustBrightness(decoratorColor, 0.8);

		// 绘制装饰条
		ctx.fillStyle = primaryColor;
		ctx.fillRect(
			x - 1, // 位置：left: -1px
			y, // 位置：top: 0px
			3, // 宽度：width: 3px
			rightPanelConfig.panelHeight // 高度：覆盖整个面板高度
		);

		// 添加装饰条的渐变效果
		const barGradient = ctx.createLinearGradient(
			x - 1,
			y,
			x - 1,
			y + rightPanelConfig.panelHeight
		);
		barGradient.addColorStop(0, lightColor); // 顶部稍亮
		barGradient.addColorStop(0.5, primaryColor); // 中间主色
		barGradient.addColorStop(1, darkColor); // 底部稍暗

		ctx.fillStyle = barGradient;
		ctx.fillRect(x - 1, y, 3, rightPanelConfig.panelHeight);

		// 面板标题
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = primaryColor;
		ctx.fillText("推薦隊伍", x + 20, y + 30);

		// 最多显示两队
		const maxTeams = Math.min(teams.length, 2);

		// 如果只有一个队伍，计算垂直居中位置
		let startY = y + 15;
		if (maxTeams === 1) {
			// 计算单个队伍的总高度
			const avatarSize = 64; // 使用标准头像大小
			const backupSize = Math.max(28, Math.floor(avatarSize * 0.6));
			const teamHeight = avatarSize + 20 + backupSize;

			// 计算居中位置
			const availableHeight = rightPanelConfig.panelHeight - 60; // 减去标题和边距
			startY = y + 30 + (availableHeight - teamHeight) / 2;
		}

		for (let teamIndex = 0; teamIndex < maxTeams; teamIndex++) {
			const team = teams[teamIndex];

			// 根据面板宽度计算角色头像位置和大小
			const panelWidth = rightPanelConfig.panelWidth;
			const availableWidth = panelWidth - 40; // 减去左右边距
			const maxMembers = 4; // 最多4个角色（主角色 + 3个成员）

			// 计算平衡的间距和头像大小
			const minSpacing = 70; // 最小间距，确保可替换角色有足够空间
			const maxSpacing = 90; // 最大间距，避免角色过于分散

			// 优先计算平衡的间距
			const balancedSpacing = Math.max(
				minSpacing,
				Math.min(
					maxSpacing,
					Math.floor(availableWidth / (maxMembers + 1)) // 在4个角色之间平均分配空间
				)
			);

			// 根据平衡间距计算头像大小
			const avatarSize = Math.max(
				48, // 最小头像尺寸
				Math.min(
					80, // 最大头像尺寸
					Math.floor(
						(availableWidth - balancedSpacing * (maxMembers - 1)) /
							maxMembers
					)
				)
			);

			// 使用平衡间距
			const spacing = balancedSpacing;
			const startX = x + 20;

			// 计算每队需要的高度
			const avatarSectionHeight = avatarSize + 20; // 头像区域高度
			const backupSize = Math.max(28, Math.floor(avatarSize * 0.6)); // 可替换角色头像为主头像的60%，最小28px（从20px增加到28px）
			const teamHeight = avatarSectionHeight + backupSize;

			// 根据队伍数量调整垂直位置
			let teamY: number;
			if (maxTeams === 1) {
				// 单个队伍时使用居中位置
				teamY = startY;
			} else {
				// 多个队伍时使用原来的布局
				teamY = startY + teamIndex * teamHeight;
			}

			// 绘制主角色（AvatarID）
			const mainCharacterX = startX;
			const mainCharacterY = teamY + 25;

			// 主角色头像（使用缓存）
			const mainCharacterImg = await getCachedImage(
				`https://api.hakush.in/hsr/UI/avatarroundicon/${team.AvatarID}.webp`
			);
			ctx.drawImage(
				mainCharacterImg,
				mainCharacterX,
				mainCharacterY,
				avatarSize,
				avatarSize
			);

			// 第一遍：计算所有角色的初始位置和调整后的位置
			const memberPositions: number[] = [];

			for (
				let memberIndex = 0;
				memberIndex < Math.min(team.MemberList.length, 3);
				memberIndex++
			) {
				// 计算成员角色的x坐标，考虑替补角色的位置
				let memberX = startX + (memberIndex + 1) * spacing;

				// 检查前一个角色的替补角色是否会影响当前角色的位置
				if (memberIndex > 0) {
					const prevMemberX = startX + memberIndex * spacing;
					const prevBackupList =
						team[`BackupList${memberIndex}`] || [];

					if (prevBackupList.length > 0) {
						// 计算前一个角色替补角色的最右边界
						const prevMemberCenterX = prevMemberX + avatarSize / 2;
						const backupSize = Math.max(
							28,
							Math.floor(avatarSize * 0.6)
						);
						const backupSpacing = 5;
						const prevBackupStartX =
							prevMemberCenterX -
							(backupSize * 3 + backupSpacing * 2) / 2;
						const prevBackupRightEdge =
							prevBackupStartX +
							3 * backupSize +
							2 * backupSpacing;

						// 如果替补角色会与当前角色重叠，调整当前角色的位置
						const minRequiredDistance = avatarSize + 10; // 最小所需距离
						if (
							prevBackupRightEdge + minRequiredDistance >
							memberX
						) {
							memberX = prevBackupRightEdge + minRequiredDistance;
						}
					}
				}

				memberPositions.push(memberX);
			}

			// 第二遍：平衡所有角色的x位置
			if (memberPositions.length > 1) {
				const firstPos = memberPositions[0];
				const lastPos = memberPositions[memberPositions.length - 1];

				if (firstPos !== undefined && lastPos !== undefined) {
					const totalWidth = lastPos - firstPos;
					const averageSpacing =
						totalWidth / (memberPositions.length - 1);

					// 重新计算平衡后的位置
					for (let i = 0; i < memberPositions.length; i++) {
						memberPositions[i] = startX + (i + 1) * averageSpacing;
					}
				}
			}

			// 第三遍：绘制角色
			for (
				let memberIndex = 0;
				memberIndex < Math.min(team.MemberList.length, 3);
				memberIndex++
			) {
				const memberX = memberPositions[memberIndex];
				if (memberX === undefined) continue; // 跳过未定义的位置

				const memberY = teamY + 25;

				// 成员头像（使用缓存）
				try {
					const memberImg = await getCachedImage(
						`https://api.hakush.in/hsr/UI/avatarroundicon/${team.MemberList[memberIndex]}.webp`
					);
					ctx.drawImage(
						memberImg,
						memberX,
						memberY,
						avatarSize,
						avatarSize
					);
				} catch (error) {
					// 如果加载失败，绘制占位符
					ctx.fillStyle = "#666666";
					ctx.fillRect(memberX, memberY, avatarSize, avatarSize);
				}

				// 绘制可替换角色（BackupList）- 根据实际数量显示并置中
				const backupList = team[`BackupList${memberIndex + 1}`] || [];
				const actualBackups = Math.min(backupList.length, 3); // 根据实际数量显示，最多3个

				if (actualBackups > 0) {
					for (
						let backupIndex = 0;
						backupIndex < actualBackups;
						backupIndex++
					) {
						const backupSpacing = 5;

						// 计算可替换角色的x坐标，使其在对应角色下方居中
						const memberCenterX = memberX + avatarSize / 2; // 成员角色的中心x坐标
						const backupStartX =
							memberCenterX -
							(backupSize * actualBackups +
								backupSpacing * (actualBackups - 1)) /
								2; // 根据实际数量计算起始位置，实现置中
						const backupX =
							backupStartX +
							backupIndex * (backupSize + backupSpacing);
						const backupY = memberY + avatarSize + 5;

						// 检查是否有对应的替补角色数据
						if (
							backupIndex < backupList.length &&
							backupList[backupIndex]
						) {
							// 有替补角色数据，显示角色头像（使用缓存）
							try {
								const backupImg = await getCachedImage(
									`https://api.hakush.in/hsr/UI/avatarroundicon/${backupList[backupIndex]}.webp`
								);
								ctx.drawImage(
									backupImg,
									backupX,
									backupY,
									backupSize,
									backupSize
								);
							} catch (error) {
								// 如果加载失败，绘制占位符
								ctx.fillStyle = "#444444";
								ctx.fillRect(
									backupX,
									backupY,
									backupSize,
									backupSize
								);
							}
						} else {
							// 没有替补角色数据，绘制透明背景（不显示）
							// 这里不绘制任何内容，保持透明
						}
					}
				}
			}
		}

		// 面板边框
		ctx.strokeStyle = "#444444";
		ctx.lineWidth = 1;
		ctx.strokeRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);

		// 如果指定了星魂编号，绘制对应的角色图
	};

	// 绘制合并的技能面板
	const drawMergedSkillPanel = async (
		title: string,
		skills: Array<{
			name: string;
			type: string;
			level: number;
			description: string;
			tag: string;
			iconUrl: string;
		}>,
		x: number,
		y: number,
		width: number,
		height: number,
		color: string = "#1D1D1D"
	) => {
		// 面板背景
		ctx.fillStyle = color;
		ctx.fillRect(x, y, width, height);

		// 获取装饰条颜色（优化版本）
		const decoratorColor = getDecoratorColor(characterId, characterData);

		// 生成渐变颜色变体
		const primaryColor = decoratorColor;
		const lightColor = adjustBrightness(decoratorColor, 1.2);
		const darkColor = adjustBrightness(decoratorColor, 0.8);

		// 绘制装饰条
		ctx.fillStyle = primaryColor;
		ctx.fillRect(x - 1, y, 3, height);

		// 添加装饰条的渐变效果
		const barGradient = ctx.createLinearGradient(
			x - 1,
			y,
			x - 1,
			y + height
		);
		barGradient.addColorStop(0, lightColor);
		barGradient.addColorStop(0.5, primaryColor);
		barGradient.addColorStop(1, darkColor);

		ctx.fillStyle = barGradient;
		ctx.fillRect(x - 1, y, 3, height);

		// 面板标题
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = primaryColor;
		ctx.fillText(title, x + 20, y + 30);

		// 如果没有技能数据，显示提示信息
		if (skills.length === 0) {
			ctx.font = "20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillStyle = "#cccccc";
			ctx.fillText("暫無技能數據", x + 20, y + 80);
		} else {
			// 绘制技能列表
			const skillIconSize = 48;
			const textStartX = x + 20;
			const iconStartX = x + 20;

			// 预计算每个技能的高度和位置
			const skillLayouts: Array<{
				skill: any;
				startY: number;
				endY: number;
				height: number;
			}> = [];

			let totalContentHeight = 0;
			const maxWidth = width - 100; // 留出左右边距

			// 第一遍：计算每个技能的实际高度
			for (let i = 0; i < skills.length; i++) {
				const skill = skills[i];
				if (!skill) continue;

				// 技能图标和名称区域高度
				let skillHeight = 50;

				// 计算技能描述的行数
				if (skill.description) {
					const description = skill.description;

					// 检查是否有颜色标记
					const colorRegex = /\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]/g;
					const hasColor = colorRegex.test(description);

					if (hasColor) {
						// 有颜色标记，需要更复杂的行数计算
						let lineCount = 0;
						let currentLine = "";

						// 移除颜色标记来计算纯文本长度
						const plainText = description.replace(
							/\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]/g,
							"$2"
						);
						const words = plainText.split("");

						for (const word of words) {
							if (word === undefined) continue;

							const testLine = currentLine + word;
							ctx.font =
								"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
							const metrics = ctx.measureText(testLine);

							if (
								metrics.width > maxWidth &&
								currentLine !== ""
							) {
								currentLine = word;
								lineCount++;
							} else {
								currentLine = testLine;
							}
						}

						// 最后一行
						if (currentLine) {
							lineCount++;
						}

						skillHeight += lineCount * 18;
					} else {
						// 没有颜色标记，使用原来的简单计算
						const words = description.split("");
						let line = "";
						let lineCount = 0;

						for (const word of words) {
							if (word === undefined) continue;

							const testLine = line + word;
							ctx.font =
								"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
							const metrics = ctx.measureText(testLine);

							if (metrics.width > maxWidth && line !== "") {
								line = word;
								lineCount++;
							} else {
								line = testLine;
							}
						}

						// 最后一行
						if (line) {
							lineCount++;
						}

						// 描述文本高度
						skillHeight += lineCount * 18;
					}
				}

				// 技能间距
				skillHeight += 15;

				skillLayouts.push({
					skill,
					startY: 0, // 临时值，稍后计算
					endY: 0, // 临时值，稍后计算
					height: skillHeight
				});

				totalContentHeight += skillHeight;
			}

			// 计算可用空间和平均间距
			const titleHeight = 60; // 标题高度
			const bottomMargin = 40; // 底部边距，确保技能描述与卡片底部有足够空间

			// 将底部 margin 整合到间隔计算中
			const totalMargin = titleHeight + bottomMargin; // 总边距（标题 + 底部）
			const availableHeight = height - totalMargin;

			// 如果有空余空间，计算平均间距
			let spacing = 15; // 默认间距
			if (
				availableHeight > totalContentHeight &&
				skillLayouts.length > 1
			) {
				// 将底部 margin 平均分配到技能间隔中
				const extraSpace = availableHeight - totalContentHeight;
				spacing = extraSpace / (skillLayouts.length - 1) + 15; // 在默认间距基础上增加平均分配的空间
			}

			// 第二遍：计算每个技能的实际位置
			let currentY = y + titleHeight;
			for (let i = 0; i < skillLayouts.length; i++) {
				const layout = skillLayouts[i];
				if (layout) {
					layout.startY = currentY;
					layout.endY = currentY + layout.height;
					currentY = layout.endY + spacing;
				}
			}

			// 第三遍：绘制技能
			for (let i = 0; i < skillLayouts.length; i++) {
				const layout = skillLayouts[i];
				if (!layout) continue;

				const skill = layout.skill;
				const skillY = layout.startY;

				// 绘制技能图标
				try {
					const skillIcon = await getCachedImage(skill.iconUrl);
					ctx.drawImage(
						skillIcon,
						iconStartX,
						skillY,
						skillIconSize,
						skillIconSize
					);
				} catch (error) {
					// 如果加载失败，绘制占位符
					ctx.fillStyle = "#666666";
					ctx.fillRect(
						iconStartX,
						skillY,
						skillIconSize,
						skillIconSize
					);
				}

				// 绘制技能名称和等级（等级置右）
				ctx.font =
					"bold 18px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
				ctx.fillStyle = "#ffffff";

				// 绘制技能名称
				ctx.fillText(
					skill.name,
					textStartX + skillIconSize + 15,
					skillY + 18
				);

				// 绘制技能描述（支持换行和颜色）
				const description = skill.description || "";

				// 使用新的輔助函數繪製帶顏色的文字
				drawColoredText(
					ctx,
					description,
					textStartX + skillIconSize + 15,
					skillY + 40,
					maxWidth,
					"#cccccc",
					18
				);
			}
		}

		// 面板边框
		ctx.strokeStyle = "#444444";
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, width, height);
	};

	// 绘制遗器推荐面板
	const drawRelicPanel = async (
		title: string,
		relicData: any,
		x: number,
		y: number,
		color: string = "#1D1D1D"
	) => {
		// 面板背景
		ctx.fillStyle = color;
		ctx.fillRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);

		// 获取装饰条颜色（优化版本）
		const decoratorColor = getDecoratorColor(characterId, characterData);

		// 生成渐变颜色变体
		const primaryColor = decoratorColor;
		const lightColor = adjustBrightness(decoratorColor, 1.2);
		const darkColor = adjustBrightness(decoratorColor, 0.8);

		// 绘制装饰条
		ctx.fillStyle = primaryColor;
		ctx.fillRect(
			x - 1, // 位置：left: -1px
			y, // 位置：top: 0px
			3, // 宽度：width: 3px
			rightPanelConfig.panelHeight // 高度：覆盖整个面板高度
		);

		// 添加装饰条的渐变效果
		const barGradient = ctx.createLinearGradient(
			x - 1,
			y,
			x - 1,
			y + rightPanelConfig.panelHeight
		);
		barGradient.addColorStop(0, lightColor); // 顶部稍亮
		barGradient.addColorStop(0.5, primaryColor); // 中间主色
		barGradient.addColorStop(1, darkColor); // 底部稍暗

		ctx.fillStyle = barGradient;
		ctx.fillRect(x - 1, y, 3, rightPanelConfig.panelHeight);

		// 面板标题
		ctx.font = "bold 28px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		ctx.fillStyle = primaryColor;
		ctx.fillText(title, x + 20, y + 30);

		// 遗器部位图标和属性配置
		const relicConfigs: Array<{
			icon: string;
			properties: string[];
		}> = [
			{
				icon: "IconRelicBody.webp",
				properties: relicData.PropertyList3 || []
			},
			{
				icon: "IconRelicFoot.webp",
				properties: relicData.PropertyList4 || []
			},
			{
				icon: "IconRelicNeck.webp",
				properties: relicData.PropertyList5 || []
			},
			{
				icon: "IconRelicGoods.webp",
				properties: relicData.PropertyList6 || []
			}
		];

		// 绘制四个遗器部位
		const iconSize = 36;
		const spacing = 40;
		const totalWidth = iconSize * 4 + spacing * 3;
		const startX = x + (rightPanelConfig.panelWidth - totalWidth) / 2;
		const startY = y + 40;

		for (let i = 0; i < relicConfigs.length; i++) {
			const config = relicConfigs[i];
			if (!config) continue;

			const iconX = startX + i * (iconSize + spacing);
			const iconY = startY;

			// 加载遗器部位图标（使用缓存）
			const iconPath = `./src/assets/image/forgottenhall/${config.icon}`;
			const iconImage = await getCachedImage(iconPath);

			// 绘制图标
			ctx.drawImage(iconImage, iconX, iconY, iconSize, iconSize);

			// 绘制属性列表
			if (config.properties && config.properties.length > 0) {
				ctx.font = "16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
				ctx.fillStyle = "#999999";
				ctx.textAlign = "center";

				// 将属性ID转换为可读的属性名称
				const propertyNames = config.properties.map((prop: string) => {
					// 使用属性翻译映射转换为中文名称
					const translationKey = propertyToTranslationKey[prop];
					return translationKey ? tr(translationKey) : prop;
				});

				// 显示属性名称（最多显示2个）
				const displayProps = propertyNames.slice(0, 2);
				displayProps.forEach((prop: string, index: number) => {
					ctx.fillText(
						prop,
						iconX + iconSize / 2,
						iconY + iconSize + 20 + index * 18
					);
				});
			}
		}

		// 在遗器部位下方显示副属性推荐
		if (
			relicData.SubAffixPropertyList &&
			relicData.SubAffixPropertyList.length > 0
		) {
			const subAffixStartY = startY + iconSize + 60; // 遗器部位下方留出空间

			// 绘制副属性推荐标签和列表（在同一行）
			ctx.font = "bold 18px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillStyle = "#b8a37a";
			ctx.textAlign = "left";
			ctx.fillText("副詞條:", x + 20, subAffixStartY + 15);

			// 绘制副属性列表（与标签在同一行）
			ctx.font = "16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			ctx.fillStyle = "#999999";
			ctx.textAlign = "left";

			const subAffixList = relicData.SubAffixPropertyList.slice(0, 4); // 最多显示4个副属性

			// 将所有副属性名称组合成一个字符串
			const subAffixText = subAffixList
				.map((prop: string) => {
					const translationKey = propertyToTranslationKey[prop];
					const propertyName = translationKey
						? tr(translationKey)
						: prop;
					return propertyName;
				})
				.join("  ");

			// 绘制副属性文本
			ctx.fillText(subAffixText, x + 20 + 70, subAffixStartY + 15);
		}

		// 在副属性推荐下方显示套装信息
		if (relicData.Set4IDList || relicData.Set2IDList) {
			// 计算套装信息的起始位置，考虑副属性推荐的高度
			const subAffixHeight =
				relicData.SubAffixPropertyList &&
				relicData.SubAffixPropertyList.length > 0
					? 50
					: 0;
			const setStartY = startY + iconSize + 60 + subAffixHeight; // 遗器部位下方 + 副属性推荐高度

			// 获取遗器套装数据（使用缓存系统）
			try {
				const relicSetData = await loadRelicSetData();
				if (relicSetData) {
					// 绘制4件套套装（左侧）
					if (
						relicData.Set4IDList &&
						relicData.Set4IDList.length > 0
					) {
						const set4LabelX = x + 20;
						const set4LabelY = setStartY;

						// 绘制标签
						ctx.font =
							"bold 18px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
						ctx.fillStyle = "#b8a37a";
						ctx.textAlign = "left";
						ctx.fillText("4件套:", set4LabelX, set4LabelY);

						// 绘制套装图标和名称
						const set4IconSize = 56;
						const set4Spacing = 2.5;
						const set4StartX = set4LabelX;
						const set4StartY = set4LabelY + 5;

						for (
							let i = 0;
							i < Math.min(relicData.Set4IDList.length, 3);
							i++
						) {
							const setId = relicData.Set4IDList[i];
							const setInfo = relicSetData[setId];

							if (setInfo) {
								const iconX =
									set4StartX +
									i * (set4IconSize + set4Spacing);
								const iconY = set4StartY;

								// 从icon路径中提取ID
								const iconPath = setInfo.icon;
								const iconId = iconPath
									.split("/")
									.pop()
									?.replace(".png", "");

								if (iconId) {
									// 加载套装图标（使用缓存）
									const setIconUrl = `https://api.hakush.in/hsr/UI/itemfigures/${iconId}.webp`;
									const setIcon =
										await getCachedImage(setIconUrl);

									// 绘制套装图标
									ctx.drawImage(
										setIcon,
										iconX,
										iconY,
										set4IconSize,
										set4IconSize
									);

									// 繪製順序
									ctx.font =
										"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
									ctx.fillStyle = "#999999";
									ctx.textAlign = "center";
									ctx.fillText(
										`${i + 1}`,
										iconX + set4IconSize / 2 - 5,
										iconY + set4IconSize + 10
									);
								}
							}
						}
					}

					// 绘制2件套套装（右侧）
					if (
						relicData.Set2IDList &&
						relicData.Set2IDList.length > 0
					) {
						const set2LabelX =
							x + rightPanelConfig.panelWidth / 2 + 20;
						const set2LabelY = setStartY;

						// 绘制标签
						ctx.font =
							"bold 18px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
						ctx.fillStyle = "#b8a37a";
						ctx.textAlign = "left";
						ctx.fillText("2件套:", set2LabelX, set2LabelY);

						// 绘制套装图标和名称
						const set2IconSize = 56;
						const set2Spacing = 2.5;
						const set2StartX = set2LabelX;
						const set2StartY = set2LabelY + 5;

						for (
							let i = 0;
							i < Math.min(relicData.Set2IDList.length, 3);
							i++
						) {
							const setId = relicData.Set2IDList[i];
							const setInfo = relicSetData[setId];

							if (setInfo) {
								const iconX =
									set2StartX +
									i * (set2IconSize + set2Spacing);
								const iconY = set2StartY;

								// 从icon路径中提取ID
								const iconPath = setInfo.icon;
								const iconId = iconPath
									.split("/")
									.pop()
									?.replace(".png", "");

								if (iconId) {
									// 加载套装图标（使用缓存）
									const setIconUrl = `https://api.hakush.in/hsr/UI/itemfigures/${iconId}.webp`;
									const setIcon =
										await getCachedImage(setIconUrl);

									// 绘制套装图标
									ctx.drawImage(
										setIcon,
										iconX,
										iconY,
										set2IconSize,
										set2IconSize
									);

									// 繪製順序
									ctx.font =
										"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
									ctx.fillStyle = "#999999";
									ctx.textAlign = "center";
									ctx.fillText(
										`${i + 1}`,
										iconX + set2IconSize / 2 - 5,
										iconY + set2IconSize + 10
									);
								}
							}
						}
					}
				}
			} catch (error) {
				console.error("Error fetching relic set data:", error);
			}
		}

		// 重置文本对齐
		ctx.textAlign = "left";

		// 面板边框
		ctx.strokeStyle = "#444444";
		ctx.lineWidth = 1;
		ctx.strokeRect(
			x,
			y,
			rightPanelConfig.panelWidth,
			rightPanelConfig.panelHeight
		);
	};

	// 处理技能描述的辅助函数
	const processSkillDescription = (
		desc: string,
		paramList: number[] | undefined,
		skillLevel: number
	) => {
		if (!desc) return "";

		let processedDesc = desc;

		// 替换 ParamList 的数值
		if (paramList && paramList.length > 0) {
			// 替换 #1[i], #2[i] 等格式的参数
			processedDesc = processedDesc.replace(
				/#(\d+)\[i\]/g,
				(match, index) => {
					const paramIndex = parseInt(index) - 1;
					if (paramIndex >= 0 && paramIndex < paramList.length) {
						const value = paramList[paramIndex];
						// 如果是百分比，转换为百分比格式
						if (value !== undefined && value > 0 && value < 1) {
							return `${(value * 100).toFixed(0)}%`;
						}
						return value?.toString() || match;
					}
					return match;
				}
			);
		}

		// 將字面的 \n 替換為真正的換行符
		processedDesc = processedDesc.replace(/\\n/g, "\n");

		// 移除 <u></u> 标签（下划线）
		processedDesc = processedDesc.replace(/<u>(.*?)<\/u>/g, "$1");

		// 處理所有的 <color> 標籤，包括嵌套的情況
		// 使用循環來確保所有的 <color> 標籤都被處理
		let previousDesc = "";
		while (previousDesc !== processedDesc) {
			previousDesc = processedDesc;

			// 处理 <color=#f29e38ff></color> 标签（颜色）
			processedDesc = processedDesc.replace(
				/<color=#([0-9a-fA-F]{8})>(.*?)<\/color>/g,
				(match, color, text) => {
					// 如果標籤內沒有文字，直接返回空字串
					if (!text || text.trim() === "") {
						return "";
					}
					// 提取颜色值，移除透明度
					const colorHex = color.substring(0, 6);
					// 返回带颜色的文本标记
					return `[${colorHex}]${text}[/${colorHex}]`;
				}
			);
		}

		// 处理 <unbreak> 标签
		processedDesc = processedDesc.replace(
			/<unbreak>(.*?)<\/unbreak>/g,
			(match, text) => {
				return text;
			}
		);

		// 清理嵌套的相同顏色標籤
		let cleanupDone = false;
		while (!cleanupDone) {
			const beforeCleanup = processedDesc;

			// 使用更複雜的正則表達式來處理嵌套的相同顏色標籤
			processedDesc = processedDesc.replace(
				/\[([0-9a-fA-F]{6})\]((?:(?!\[\/\1\]).)*?)\[(\1)\]((?:(?!\[\/\3\]).)*?)\[\/\3\]((?:(?!\[\/\1\]).)*?)\[\/\1\]/g,
				(
					match,
					outerColor,
					beforeInner,
					innerColor,
					innerText,
					afterInner
				) => {
					// 如果外層和內層顏色相同，合併它們
					if (outerColor === innerColor) {
						return `[${outerColor}]${beforeInner}${innerText}${afterInner}[/${outerColor}]`;
					}
					return match;
				}
			);

			// 清理重複的顏色標籤
			processedDesc = processedDesc.replace(
				/\[([0-9a-fA-F]{6})\]\[(\1)\](.*?)\[\/\2\]\[\/\1\]/g,
				"[$1]$3[/$1]"
			);

			// 合併相鄰的相同顏色標籤
			processedDesc = processedDesc.replace(
				/\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]\[(\1)\](.*?)\[\/\3\]/g,
				"[$1]$2$4[/$1]"
			);

			cleanupDone = beforeCleanup === processedDesc;
		}

		return processedDesc;
	};

	// 绘制推荐光锥面板 (第1行第1列)
	const lightconePanel = calculatePanelPosition(0, 0);

	// 绘制技能信息面板 (第1行第2列，跨越到第2行)
	const skillPanel = calculatePanelPosition(0, 1);

	// 获取角色技能数据
	let allSkills: Array<{
		name: string;
		type: string;
		level: number;
		description: string;
		tag: string;
		iconUrl: string;
	}> = [];

	// 辅助函数：获取Tag文字描述
	const getTagText = (tag: string | number): string => {
		if (typeof tag === "string") {
			// 如果是字符串Tag，先转换为数字
			const tagNumber = skillTagToNumber[tag];
			if (tagNumber) {
				const tagText = tagToText[tagNumber];
				// 如果 tagText 是空字串，返回空白
				if (tagText === "") {
					return "";
				}
				return tagText || tag;
			}
			return tag; // 如果转换失败，直接返回原Tag
		} else if (typeof tag === "number") {
			// 如果是数字Tag，直接查找对应的文字
			const tagText = tagToText[tag];
			// 如果 tagText 是空字串，返回空白
			if (tagText === "") {
				return "";
			}
			return tagText || tag.toString();
		}
		return "未知";
	};

	if (characterData.Skills) {
		const skills = characterData.Skills;

		// 按技能类型分组处理技能
		const skillGroups: { [key: string]: any[] } = {};

		// 遍历所有技能，按Type分组，跳过同名称同Type的重复技能
		const processedSkills = new Set<string>(); // 用于记录已处理的技能名称+Type组合

		Object.values(skills).forEach((skill: any) => {
			if (skill && skill.Level && skill.SimpleDesc) {
				const skillType = skill.Type || "Passive"; // 如果Type为null，归类为Passive
				const skillKey = `${skillType}_${skill.Name || skillTypeToText[skillType]}`; // 创建唯一键

				// 如果已经处理过同名称同Type的技能，跳过
				if (processedSkills.has(skillKey)) {
					return;
				}

				// 标记为已处理
				processedSkills.add(skillKey);

				if (!skillGroups[skillType]) {
					skillGroups[skillType] = [];
				}
				skillGroups[skillType].push(skill);
			}
		});

		// 处理每种类型的技能
		Object.entries(skillGroups).forEach(([skillType, skillList]) => {
			// 根据技能类型设置默认等级
			let defaultLevel = 1;
			if (skillType === "Normal") defaultLevel = 6;
			else if (
				skillType === "BPSkill" ||
				skillType === "Ultra" ||
				skillType === "Passive"
			)
				defaultLevel = 10;
			else if (skillType === "Maze") defaultLevel = 1;

			// 根据技能类型设置图标URL
			let iconUrl = "";
			if (skillType === "Normal") {
				iconUrl = `https://api.hakush.in/hsr/UI/skillicons/SkillIcon_${characterId}_Normal.webp`;
			} else if (skillType === "BPSkill") {
				iconUrl = `https://api.hakush.in/hsr/UI/skillicons/SkillIcon_${characterId}_BP.webp`;
			} else if (skillType === "Ultra") {
				iconUrl = `https://api.hakush.in/hsr/UI/skillicons/SkillIcon_${characterId}_Ultra.webp`;
			} else if (skillType === "Maze") {
				iconUrl = `https://api.hakush.in/hsr/UI/skillicons/SkillIcon_${characterId}_Maze.webp`;
			} else if (skillType === "Passive") {
				iconUrl = `https://api.hakush.in/hsr/UI/skillicons/SkillIcon_${characterId}_Passive.webp`;
			}

			// 合并同类型技能的描述
			let combinedDescription = "";
			let combinedTags = new Set<string>();

			skillList.forEach((skill: any, index: number) => {
				const skillLevel = defaultLevel;
				const levelData = skill.Level[skillLevel];

				if (levelData && levelData.ParamList) {
					const processedDesc = processSkillDescription(
						skill.SimpleDesc,
						levelData.ParamList,
						skillLevel
					);

					// 添加技能名称和描述
					if (index > 0) combinedDescription += "\n\n";

					// 获取技能标签
					const skillTag = getTagText(skill.Tag);
					const tagDisplay =
						skillTag && skillTag !== ""
							? ` [${s2t(skillTag)}]`
							: "";

					combinedDescription += `【${s2t(skill.Name) || skillTypeToText[skillType]}】[b8a37a]${tagDisplay}[/b8a37a]\n${s2t(processedDesc)}`;

					// 收集所有标签
					const tag = getTagText(skill.Tag);
					if (tag && tag !== "") {
						combinedTags.add(tag);
					}
				}
			});

			// 只添加一个合并后的技能条目
			if (combinedDescription) {
				allSkills.push({
					name: skillTypeToText[skillType] || skillType,
					type: skillType,
					level: defaultLevel,
					description: combinedDescription,
					tag: Array.from(combinedTags).join(", "),
					iconUrl: iconUrl
				});
			}
		});
	}

	// 计算技能描述所需的总高度
	const calculateSkillPanelHeight = (
		skills: Array<{
			name: string;
			type: string;
			level: number;
			description: string;
			tag: string;
			iconUrl: string;
		}>
	) => {
		if (skills.length === 0) {
			return rightPanelConfig.panelHeight; // 最小高度
		}

		let totalHeight = 60; // 标题高度
		const maxWidth = rightPanelConfig.panelWidth - 100; // 留出左右边距

		for (const skill of skills) {
			if (!skill) continue;

			// 技能图标和名称区域高度
			totalHeight += 50;

			// 计算技能描述的行数
			if (skill.description) {
				const description = skill.description;

				// 检查是否有颜色标记
				const colorRegex = /\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]/g;
				const hasColor = colorRegex.test(description);

				if (hasColor) {
					// 有颜色标记，需要更复杂的行数计算
					let lineCount = 0;
					let currentLine = "";

					// 移除颜色标记来计算纯文本长度
					const plainText = description.replace(
						/\[([0-9a-fA-F]{6})\](.*?)\[\/\1\]/g,
						"$2"
					);
					const words = plainText.split("");

					for (const word of words) {
						if (word === undefined) continue;

						const testLine = currentLine + word;
						ctx.font =
							"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
						const metrics = ctx.measureText(testLine);

						if (metrics.width > maxWidth && currentLine !== "") {
							currentLine = word;
							lineCount++;
						} else {
							currentLine = testLine;
						}
					}

					// 最后一行
					if (currentLine) {
						lineCount++;
					}

					totalHeight += lineCount * 18;
				} else {
					// 没有颜色标记，使用原来的简单计算
					const words = description.split("");
					let line = "";
					let lineCount = 0;

					for (const word of words) {
						if (word === undefined) continue;

						const testLine = line + word;
						ctx.font =
							"16px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
						const metrics = ctx.measureText(testLine);

						if (metrics.width > maxWidth && line !== "") {
							line = word;
							lineCount++;
						} else {
							line = testLine;
						}
					}

					// 最后一行
					if (line) {
						lineCount++;
					}

					// 描述文本高度
					totalHeight += lineCount * 18;
				}
			}

			// 技能间距
			totalHeight += 15;
		}

		// 添加底部边距
		totalHeight += 20;

		// 确保最小高度为一行面板高度
		return Math.max(totalHeight, rightPanelConfig.panelHeight);
	};

	// 创建跨越1列但高度根据内容动态调整的技能面板
	const mergedSkillPanel = {
		x: skillPanel.x,
		y: skillPanel.y,
		width: rightPanelConfig.panelWidth,
		height: calculateSkillPanelHeight(allSkills)
	};

	// 計算推薦隊伍面板的位置和高度
	const teamPanel = {
		x: calculatePanelPosition(2, 0).x,
		y: calculatePanelPosition(2, 0).y,
		width: rightPanelConfig.panelWidth * 2 + rightPanelConfig.spacing,
		height: rightPanelConfig.panelHeight
	};

	// 計算左側三格（光錐面板、遺器面板、推薦隊伍面板）的總高度
	// 光錐面板高度 + 遺器面板高度 + 推薦隊伍面板高度 + 間距
	const leftThreePanelsTotalHeight =
		rightPanelConfig.panelHeight + // 光錐面板
		rightPanelConfig.panelHeight + // 遺器面板
		rightPanelConfig.panelHeight + // 推薦隊伍面板
		rightPanelConfig.spacing * 2; // 兩個間距

	// 確保技能面板高度至少與左側三格推薦的最終高度相同
	// 技能面板需要跨越兩行（光錐面板的行和遺器面板的行）
	const minSkillPanelHeight =
		rightPanelConfig.panelHeight * 2 + rightPanelConfig.spacing;

	// 取左側三格總高度和最小技能面板高度的最大值
	const requiredHeight = Math.max(
		leftThreePanelsTotalHeight,
		minSkillPanelHeight
	);

	mergedSkillPanel.height = Math.max(mergedSkillPanel.height, requiredHeight);

	// 绘制合并的技能面板
	await drawMergedSkillPanel(
		"技能信息",
		allSkills,
		mergedSkillPanel.x,
		mergedSkillPanel.y,
		mergedSkillPanel.width,
		mergedSkillPanel.height
	);

	// 绘制光锥图片面板 (第1行第1列)
	await drawLightconePanel(
		"推薦光錐",
		characterData.Lightcones || [],
		lightconePanel.x,
		lightconePanel.y
	);

	// 绘制遗器推荐面板 (第2行，跨越2列)
	const relicPanel = {
		x: calculatePanelPosition(1, 0).x,
		y: calculatePanelPosition(1, 0).y,
		width: rightPanelConfig.panelWidth * 2 + rightPanelConfig.spacing,
		height: rightPanelConfig.panelHeight
	};
	await drawRelicPanel(
		"推薦遺器",
		characterData.Relics || {},
		relicPanel.x,
		relicPanel.y
	);

	// 绘制推荐队伍面板 (第3行，跨越2列)
	if (characterData.Teams && characterData.Teams.length > 0) {
		await drawTeamPanel(characterData.Teams, teamPanel.x, teamPanel.y);
	} else {
		// 如果没有Teams数据，显示默认信息
		await drawDataPanel(
			"推薦隊伍",
			["暂无推荐队伍数据", "请检查角色配置文件"],
			teamPanel.x,
			teamPanel.y
		);
	}

	// 计算所需的最大宽度
	const calculateRequiredWidth = () => {
		let maxWidth = 260; // 最小宽度

		// 计算角色名称宽度
		ctx.font = "bold 36px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
		const nameWidth = ctx.measureText(
			s2t(characterData.Name) || "未知角色"
		).width;

		// 计算元素图标和命途图标的总宽度
		let iconWidth = 0;
		if (characterData.DamageType) {
			iconWidth += 42 + 10; // 元素图标宽度 + 间距
		}
		if (characterData.BaseType) {
			iconWidth += 36 + 10; // 命途图标宽度 + 间距
		}

		// 计算总宽度：名称 + 图标 + 左右边距
		const totalContentWidth = nameWidth + iconWidth + 40; // 40 = 左右各20px边距

		// 计算星数背景宽度
		if (characterData.Rarity) {
			const rarity = characterData.Rarity.includes("5") ? 5 : 4;
			const starSize = 36;
			const starBackgroundWidth = starSize * rarity * 1.75;
			maxWidth = Math.max(maxWidth, starBackgroundWidth + 40); // 40 = 左右各20px边距
		}

		// 计算所有 Rank Name 的宽度，找到最长的
		let maxRankWidth = 0;
		if (characterData.Ranks) {
			ctx.font = "italic 24px 'FourthWorld', Arial, sans-serif";
			const rankKeys = Object.keys(characterData.Ranks);
			if (rankKeys.length > 0) {
				for (const rankKey of rankKeys) {
					const rank =
						characterData.Ranks[
							rankKey as keyof typeof characterData.Ranks
						];
					if (rank && rank.Name) {
						const rankWidth = ctx.measureText(rank.Name).width;
						maxRankWidth = Math.max(maxRankWidth, rankWidth);
					}
				}
			}
		}

		// 计算 Path 名称的宽度
		let pathWidth = 0;
		if (characterData.BaseType) {
			ctx.font = "bold 20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
			const pathName = tr(
				`path_${baseTypeToPathMap[characterData.BaseType.toLowerCase() as keyof typeof baseTypeToPathMap]}`
			);
			pathWidth = ctx.measureText(pathName).width;
		}

		// 使用最长的文本作为宽度基准：Rank Name 或 Path
		const maxTextWidth = Math.max(maxRankWidth, pathWidth);
		if (maxTextWidth > 0) {
			maxWidth = Math.max(maxWidth, maxTextWidth + 40); // 40 = 左右各20px边距
		}

		return Math.max(maxWidth, totalContentWidth) + 15;
	};

	// 添加角色信息面板 (角色卡片中间)
	const infoPanelX = 5; // 居中位置
	const infoPanelY = avatarY + characterAvatarHeight / 2 + 300; // 角色头像中间位置
	const infoPanelWidth = calculateRequiredWidth();
	const infoPanelHeight = 85; // 减少名条高度从120到80

	ctx.fillStyle = "#1a1a1a";
	ctx.fillRect(infoPanelX, infoPanelY, infoPanelWidth, infoPanelHeight);

	// 为角色信息面板添加左侧装饰条 - 使用相同的颜色配置
	let infoDecoratorColor = "#b8a37a"; // 默认金色

	// 优先使用角色配置的颜色
	if (characterOffset[characterId]?.decoratorColor) {
		infoDecoratorColor = characterOffset[characterId].decoratorColor;
	} else if (
		characterOffset[characterId]?.forceElementType &&
		elementDecoratorColors[characterOffset[characterId].forceElementType]
	) {
		// 使用强制元素类型颜色
		infoDecoratorColor =
			elementDecoratorColors[
				characterOffset[characterId].forceElementType
			];
	} else if (
		characterData.DamageType &&
		elementDecoratorColors[
			characterData.DamageType as keyof typeof elementDecoratorColors
		]
	) {
		// 如果没有配置，则根据DamageType自动选择颜色
		infoDecoratorColor =
			elementDecoratorColors[
				characterData.DamageType as keyof typeof elementDecoratorColors
			];
	}

	// 生成渐变颜色变体
	const infoPrimaryColor = infoDecoratorColor;
	const infoLightColor = adjustBrightness(infoDecoratorColor, 1.2);
	const infoDarkColor = adjustBrightness(infoDecoratorColor, 0.8);

	// 绘制装饰条
	ctx.fillStyle = infoPrimaryColor;
	ctx.fillRect(
		infoPanelX - 1, // 位置：left: -1px
		infoPanelY, // 位置：top: 0px
		5, // 宽度：width: 3px
		infoPanelHeight // 高度：覆盖整个面板高度
	);

	// 添加装饰条的渐变效果
	const infoBarGradient = ctx.createLinearGradient(
		infoPanelX - 1,
		infoPanelY,
		infoPanelX - 1,
		infoPanelY + infoPanelHeight
	);
	infoBarGradient.addColorStop(0, infoLightColor); // 顶部稍亮
	infoBarGradient.addColorStop(0.5, infoPrimaryColor); // 中间主色
	infoBarGradient.addColorStop(1, infoDarkColor); // 底部稍暗

	ctx.fillStyle = infoBarGradient;
	ctx.fillRect(infoPanelX - 1, infoPanelY, 3, infoPanelHeight);

	// 角色名称（更大字体）
	ctx.font = "bold 36px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
	ctx.fillStyle = "#ffffff";
	ctx.fillText(
		characterData.Name == "{NICKNAME}"
			? tr("MainCharacter")
			: s2t(characterData.Name),
		infoPanelX + 20,
		infoPanelY + 40
	);

	// 绘制稀有度星星（在名称下方）
	if (characterData.Rarity) {
		const rarity = characterData.Rarity.includes("5") ? 5 : 4;
		const starSize = 36; // 稍微减小星数大小
		// 在名称下方繪製一個左至右漸淡的黑色背景
		const gradient = ctx.createLinearGradient(
			infoPanelX,
			0,
			infoPanelX + starSize * rarity * 1.75,
			0
		);
		gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.fillStyle = gradient;
		ctx.fillRect(
			infoPanelX,
			infoPanelY + infoPanelHeight + 10,
			starSize * rarity * 1.75,
			starSize + starSize / 5
		);

		// 在黑色背景中绘制星数
		const startX = infoPanelX + 20; // 从左侧开始
		const startY =
			infoPanelY + infoPanelHeight + 10 + (starSize + starSize / 5) / 2; // 在背景中央
		const starImage = await getCachedImage(
			"./src/assets/image/forgottenhall/star2.png"
		);

		for (let i = 0; i < rarity; i++) {
			ctx.drawImage(
				starImage,
				startX + i * (starSize + 5), // 调整间距
				startY - starSize / 2,
				starSize,
				starSize
			);
		}
	}

	// 绘制命途和元素图标
	if (characterData.DamageType) {
		try {
			const elementIconSize = 42;
			const elementIcon = await getCachedImage(
				`./src/assets/image/element/${characterData.DamageType.toLowerCase()}.png`
			);
			ctx.drawImage(
				elementIcon,
				0,
				0,
				elementIcon.width,
				elementIcon.height,
				infoPanelX +
					20 +
					ctx.measureText(s2t(characterData.Name) || "未知角色")
						.width +
					10, // 在属性文字后面
				infoPanelY + 5, // 与名字对齐
				elementIconSize,
				elementIconSize
			);
		} catch (error) {
			console.error("Error loading element icon:", error);
		}
	}

	if (characterData.BaseType) {
		try {
			const pathIconSize = 36;
			const pathIcon = await getCachedImage(
				`./src/assets/image/icon/path/${baseTypeToPathMap[characterData.BaseType.toLowerCase() as keyof typeof baseTypeToPathMap]}.png`
			);

			ctx.drawImage(
				pathIcon,
				0,
				0,
				pathIcon.width,
				pathIcon.height,
				infoPanelX +
					20 +
					ctx.measureText(s2t(characterData.Name) || "未知角色")
						.width +
					42 +
					10, // 在元素图标后面
				infoPanelY + 8, // 与名字对齐
				pathIconSize,
				pathIconSize
			);
		} catch (error) {
			console.error("Error loading path icon:", error);
		}
	}

	// 在星数下方显示随机的 Ranks Name（斜体 FourthWorld 字体）
	if (characterData.Ranks) {
		const rankKeys = Object.keys(characterData.Ranks);
		if (rankKeys.length > 0) {
			const randomRankKey =
				rankKeys[Math.floor(Math.random() * rankKeys.length)];
			const randomRank =
				characterData.Ranks[
					randomRankKey as keyof typeof characterData.Ranks
				];

			if (randomRank && randomRank.Name) {
				ctx.font = "italic 24px 'FourthWorld', Arial, sans-serif";
				ctx.fillStyle = "#b8a37a"; // 使用金色
				ctx.fillText(
					s2t(randomRank.Name),
					infoPanelX + 20,
					infoPanelY + 72.5 // 调整位置，适应新的名条高度
				);
			}
		}
	}

	ctx.font = "bold 20px 'YaHei', 'URW DIN Arabic', Arial, sans-serif";
	ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
	const text = "由星鐵小助手生成";
	ctx.fillText(
		text,
		canvasWidth - ctx.measureText(text).width - 10,
		canvasHeight - 10
	);

	return canvas.toBuffer("image/webp");
}

export async function getCharacterAutocompleteOptions(
	input: string,
	tr: TranslationFunction,
	locale: string = "en"
) {
	try {
		const characterList = await getCharacterList();
		const choices = [];

		for (const [id, character] of Object.entries(characterList)) {
			const char = character as any;

			let name: string;
			name = locale === "en" ? char.en : s2t(char.cn) || id;
			if (name === "{NICKNAME}")
				name = `${tr("MainCharacter")} (${tr(
					`element_${char.damageType?.toLowerCase()}`
				)}•${tr(
					`path_${baseTypeToPathMap[char.baseType?.toLowerCase() as keyof typeof baseTypeToPathMap]}`
				)})`;

			if (
				name.toLowerCase().includes(input.toLowerCase()) ||
				id.includes(input)
			) {
				choices.push({
					name: `${name} (${id})`,
					value: id
				});
			}
		}

		return choices.slice(0, 25);
	} catch (error) {
		console.error("Error in getCharacterAutocompleteOptions:", error);
		return [];
	}
}
