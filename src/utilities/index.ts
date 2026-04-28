import {
	EmbedBuilder,
	Interaction,
	CommandInteraction,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} from "discord.js";
import axios from "axios";
import { join, extname } from "path";
import { readdir } from "fs/promises";
import crypto from "crypto";
import emoji from "@/assets/emoji.js";
import {
	HonkaiStarRail,
	LanguageEnum,
	HoyoAPIError,
	Hoyolab
} from "@yeci226/hoyoapi";
import { database } from "@/index.js";
import { loadConfig } from "@/utilities/core/config.js";
import { withProxy } from "@/utilities/core/proxy.js";
import {
	upsertHoyolab,
	upsertCharacter,
	extractLtuidFromCookie,
	fallbackBucketKey
} from "@/utilities/accountStore.js";
const config = loadConfig();

const BASE_URL = "https://bbs-api-os.hoyolab.com/community/post/wapi/";

interface VersionChoice {
	value: string;
	name: string;
	localName: string;
}

interface ChoiceOption {
	name: string;
	name_localizations: { "zh-TW": string };
	value: string;
}

interface CacheData {
	codes: any[];
	timestamp: number;
}

interface PlayerDataResponse {
	status: number;
	playerData: any;
}

interface PlayerActivityResponse {
	status: number;
	playerActivity: any;
}

interface AccountData {
	uid?: string;
	cookie?: string;
}

interface UserAccount {
	uid: string;
	cookie: string;
}

interface CookieUpdateResponse {
	error?: boolean;
	message?: string;
}

interface GameInfo {
	uid: string;
	nickname: string;
	level: number;
}

interface CacheStatus {
	exists: boolean;
	isExpired?: boolean;
	remainingHours?: number;
	codesCount?: number;
	lastUpdated?: string;
	message: string;
}

const versionChoices: VersionChoice[] = [
	{ value: "1.0.1", name: "Seele", localName: "希兒" },
	{ value: "1.0.2", name: "Jing-Yuan", localName: "景元" },
	{ value: "1.1.1", name: "Silver-Wolf", localName: "銀狼" },
	{ value: "1.1.2", name: "LuoCha", localName: "羅剎" },
	{ value: "1.2.1", name: "Blade", localName: "刃" },
	{ value: "1.2.2", name: "Kafka", localName: "卡芙卡" },
	{ value: "1.3.1", name: "Imbibitor Lunae", localName: "丹恆・飲月" },
	{ value: "1.3.2", name: "Fu Xuan", localName: "符玄" },
	{ value: "1.4.1", name: "Jing Liu", localName: "鏡流" },
	{ value: "1.4.2", name: "Topaz & Numdy", localName: "托帕&賬賬" },
	{ value: "1.5.1", name: "HuoHuo", localName: "霍霍" },
	{ value: "1.5.2", name: "Argenti", localName: "銀枝" },
	{ value: "1.6.1", name: "Ruan Mei", localName: "阮梅" },
	{ value: "1.6.2", name: "Dr. Ratio", localName: "真理醫生" },
	{ value: "2.0.1", name: "Black Swan", localName: "黑天鵝" },
	{ value: "2.0.2", name: "Sparkle", localName: "花火" },
	{ value: "2.1.1", name: "Acheron", localName: "黃泉" },
	{ value: "2.1.2", name: "Aventurine", localName: "砂金" },
	{ value: "2.2.1", name: "Robin", localName: "知更鳥" },
	{ value: "2.2.2", name: "Boothill", localName: "波提歐" },
	{ value: "2.3.1", name: "Firefly", localName: "流螢" },
	{ value: "2.3.2", name: "Jade", localName: "翡翠" },
	{ value: "2.4.1", name: "Yunli", localName: "雲離" },
	{ value: "2.4.2", name: "Jiaoqiu", localName: "椒丘" },
	{ value: "2.5.1", name: "Feixiao", localName: "飛霄" },
	{ value: "2.5.2", name: "Lingsha", localName: "靈砂" },
	{ value: "2.6.1", name: "Rappa", localName: "亂破" },
	{ value: "2.7.1", name: "Sunday", localName: "星期日" },
	{ value: "2.7.2", name: "Fugue", localName: "忘歸人" },
	{ value: "3.0.1", name: "The Herta", localName: "大黑塔" },
	{ value: "3.0.2", name: "Aglaea", localName: "阿格萊雅" },
	{ value: "3.1.1", name: "Tribbie", localName: "緹寶" },
	{ value: "3.1.2", name: "Mydei", localName: "萬敵" },
	{ value: "3.2.1", name: "Castorice", localName: "遐蝶" },
	{ value: "3.2.2", name: "Anaxa", localName: "那刻夏" },
	{ value: "3.3.1", name: "Hyacine", localName: "風堇" },
	{ value: "3.3.2", name: "Cipher", localName: "賽飛兒" },
	{ value: "3.4.1", name: "Phainon", localName: "白厄" }
];

/**
 * @description 獲取指定目錄下的所有 .js 文件
 * @param dir - 目錄路徑
 * @param exts - 可接受的文件擴展名
 * @returns 所有 .js 文件的路徑
 */
export async function getAllFiles(dir: string, exts: string[]) {
	let files: string[] = [];

	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files = files.concat(await getAllFiles(fullPath, exts));
		} else if (exts.includes(extname(entry.name))) {
			files.push(fullPath);
		}
	}

	return files;
}

export const createChoiceOption = ({
	value,
	name,
	localName
}: VersionChoice): ChoiceOption => ({
	name: `${value} - ${name}`,
	name_localizations: { "zh-TW": `${value} - ${localName}` },
	value
});

export const filterVersionChoices = (
	input: string,
	limit: number = 25
): VersionChoice[] => {
	return versionChoices
		.filter(
			choice =>
				choice.value.includes(input) ||
				choice.name.toLowerCase().includes(input.toLowerCase()) ||
				choice.localName.includes(input)
		)
		.slice(0, limit); // 只取前 limit 個
};

export const getLastVersionChoices = (limit: number = 25): VersionChoice[] => {
	return versionChoices.slice(-limit);
};

export const addVersionChoices = (option: any): any => {
	const lastChoices = getLastVersionChoices();
	lastChoices.forEach(choice =>
		option.addChoices(createChoiceOption(choice))
	);
	return option;
};

export async function getNewsList(lang: string, type: string): Promise<any> {
	return await axios({
		headers: {
			"x-rpc-app_version": "2.43.0",
			"x-rpc-client_type": 4,
			"X-Rpc-Language": lang
		},
		method: "get",
		url: BASE_URL + "getNewsList",
		params: { gids: 6, page_size: 25, type: type }
	}).then(response => response.data);
}

export async function getPostFull(lang: string, postId: string): Promise<any> {
	return await axios({
		headers: {
			"x-rpc-app_version": "2.43.0",
			"x-rpc-client_type": 4,
			"X-Rpc-Language": lang
		},
		method: "get",
		url: BASE_URL + "getPostFull",
		params: { gids: 6, post_id: postId }
	}).then(response => response.data.data);
}

export async function parsePostContent(content: string): Promise<string> {
	content = content.replace(/<br\s*\/?>/g, "\n");
	content = content.replace(/<\p[^>]*>/g, "\n");
	content = content.replace(/<\/p>/g, "");
	content = content.replace(/<\/?strong[^>]*>/g, "**");
	content = content.replace(/<\/?em[^>]*>/g, "*");
	content = content.replace(/<\/?span[^>]*>/g, "");
	content = content.replace(/<\/?div[^>]*>/g, "");
	content = content.replace(/<\/?img[^>]*>/g, "");
	content = content.replace(/<h4[^>]*>/g, "\n### ");
	content = content.replace(/<\/h4>/g, "");
	content = content.replace(/<h3[^>]*>/g, "\n## ");
	content = content.replace(/<\/h3>/g, "");
	content = content.replace(/&gt;/g, ">");
	content = content.replace(/&lt;/g, "<");
	content = content.replace(/&nbsp;/g, " ");

	content = content.replace(
		/<([a-z]+)\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/\1>/gi,
		(match: string, tag: string, href: string, text: string) =>
			href == text
				? `${emoji.link}${href}`
				: `${emoji.link}[${text}](${href})`
	);

	content = content.replace(
		/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/gi,
		(match: string, p1: string) => `### ${emoji.link}[影片](${p1})`
	);

	content = content.replace(/\s*class="[^"]*"/g, "");
	// content = content.replace(/\n\s*\n/g, "\n");

	return content;
}

export async function getRedeemCodes(): Promise<any[]> {
	// 檢查快取是否存在且未過期
	const cacheKey = "redeemCodesCache";
	const cachedData: CacheData | null = await database.get(cacheKey);
	const currentTime = Date.now();
	const oneDayInMs = 24 * 60 * 60 * 1000; // 24小時的毫秒數

	// 如果快取存在且未過期，直接返回快取的數據
	if (cachedData && currentTime - cachedData.timestamp < oneDayInMs) {
		const remainingTime = Math.floor(
			(oneDayInMs - (currentTime - cachedData.timestamp)) /
				(1000 * 60 * 60)
		); // 剩餘小時數
		console.log(`[快取] 使用快取的兌換碼數據，剩餘 ${remainingTime} 小時`);
		return cachedData.codes;
	}

	// 如果快取不存在或已過期，重新獲取數據
	console.log("[快取] 快取已過期或不存在，重新獲取兌換碼數據...");
	try {
		const res = await axios
			.get("https://hoyo-codes.seria.moe/codes?game=hkrpg")
			.then(response => response.data);

		// 將新數據存入快取
		await database.set(cacheKey, {
			codes: res.codes,
			timestamp: currentTime
		});

		console.log(`[快取] 成功獲取並快取 ${res.codes.length} 個兌換碼`);
		return res.codes;
	} catch (error: any) {
		console.error("[快取] API請求失敗:", error.message);
		// 如果API請求失敗但有快取數據，返回快取數據
		if (cachedData) {
			console.log("[快取] 使用過期的快取數據作為備用");
			return cachedData.codes;
		}
		// 如果沒有快取數據且API請求失敗，拋出錯誤
		throw error;
	}
}

export function secondsToHms(d: number, tr: (key: string) => string): string {
	d = Number(d);
	var h = Math.floor(d / 3600);
	var m = Math.floor((d % 3600) / 60);
	var s = Math.floor((d % 3600) % 60);

	var hDisplay = h > 0 ? h.toString().padStart(2, "0") + tr("Hour") : "";
	var mDisplay = m > 0 ? m.toString().padStart(2, "0") + tr("Minute") : "";
	var sDisplay = s > 0 ? s.toString().padStart(2, "0") + tr("Second") : "";

	if (!hDisplay && !mDisplay && !sDisplay) {
		sDisplay = "已完成";
	}

	return hDisplay + mDisplay + sDisplay;
}

export async function requestPlayerDataEnka(
	uid: string
): Promise<PlayerDataResponse> {
	const baseUrl = "https://enka.network/api/hsr/uid/";

	try {
		const response = await axios.get(baseUrl + uid);
		console.log(response.data);
		return { status: response.status, playerData: response.data };
	} catch (err: any) {
		return {
			status: 400,
			playerData: {
				detail: err.response?.data?.detail,
				message: err.message
			}
		};
	}
}

export async function requestPlayerData(
	uid: string,
	interaction?: Interaction
): Promise<PlayerDataResponse> {
	const userLocaleKey = `${interaction?.user?.id}.locale`;
	let langParam = "?lang=en";

	if (await database?.has(userLocaleKey)) {
		const storedLocale = await database.get(userLocaleKey);
		langParam = storedLocale === "tw" ? "?lang=cht" : "?lang=en";
	} else if (interaction && "locale" in interaction) {
		langParam =
			(interaction as any).locale === "zh-TW" ? "?lang=cht" : "?lang=en";
	}

	try {
		const response = await axios.get(
			`https://api.mihomo.me/sr_info_parsed/${uid}${langParam}`
		);
		return { status: response.status, playerData: response.data };
	} catch (err: any) {
		return {
			status: 400,
			playerData: {
				detail: err.response?.data?.detail,
				message: err.message
			}
		};
	}
}

export async function requestPlayerActivity(
	uid: string,
	interaction?: Interaction
): Promise<PlayerActivityResponse> {
	const userLocaleKey = `${interaction?.user?.id}.locale`;
	let langParam = "?lang=en";

	if (await database?.has(userLocaleKey)) {
		const storedLocale = await database.get(userLocaleKey);
		langParam = storedLocale === "tw" ? "?lang=cht" : "?lang=en";
	} else if (interaction && "locale" in interaction) {
		langParam =
			(interaction as any).locale === "zh-TW" ? "?lang=cht" : "?lang=en";
	}

	try {
		const response = await axios.get(
			`https://api.mihomo.me/sr_activity/${uid}${langParam}`
		);
		return { status: response.status, playerActivity: response.data };
	} catch (err: any) {
		return {
			status: 400,
			playerActivity: {
				detail: err.response?.data?.detail,
				message: err.message
			}
		};
	}
}

export async function drawInQueueReply(
	interaction: CommandInteraction,
	title: string = ""
): Promise<void> {
	await interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setTitle(title)
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
				)
		]
	}).catch(() => {});
}

const languageMapping: Record<string, LanguageEnum> = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	vi: LanguageEnum.VIETNAMESE,
	jp: LanguageEnum.JAPANESE,
	kr: LanguageEnum.KOREAN,
	fr: LanguageEnum.FRENCH,
	default: LanguageEnum.ENGLISH
};

export async function setupDefaultLang(
	userId: string,
	userSystemLang: string
): Promise<void> {
	const langMap: Record<string, string> = {
		"zh-TW": "tw",
		"zh-CN": "cn",
		ja: "jp",
		ko: "kr"
	};

	const langCode = langMap[userSystemLang] || userSystemLang;

	if (languageMapping[langCode])
		await database.set(`${userId}.locale`, langCode);
}

export async function failedReply(
	interaction: Interaction,
	title: string = "",
	description: string = ""
): Promise<void> {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor("#E76161")
		.setThumbnail(
			"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
		);

	if (description) embed.setDescription(description);

	replyOrfollowUp(interaction, {
		embeds: [embed],
		flags: MessageFlags.Ephemeral
	});
}

export async function getUserUid(
	userId: string,
	accountIndex: number = 0
): Promise<string | null> {
	const accountKey = `${userId}.account`;

	const account: UserAccount[] | null = await database.get(accountKey);
	return account?.[accountIndex]?.uid || null;
}

export async function getUserCookie(
	userId: string,
	accountIndex: number = 0
): Promise<string | null> {
	const accountKey = `${userId}.account`;

	const account: UserAccount[] | null = await database.get(accountKey);
	return account?.[accountIndex]?.cookie || null;
}

export async function getUserLang(userId: string): Promise<string | null> {
	const langKey = `${userId}.locale`;

	const lang: string | null = await database.get(langKey);
	return lang || null;
}

export async function getUserHSRData(
	interaction: Interaction,
	tr: (key: string, params?: any) => string,
	userId: string,
	accountIndex: number,
	options?: {
		suppressErrorReply?: boolean;
		validationType?: "record" | "daily" | "none";
	}
): Promise<HonkaiStarRail | null> {
	const [cookie, userLang, uid] = await Promise.all([
		getUserCookie(userId, accountIndex),
		getUserLang(userId),
		getUserUid(userId, accountIndex)
	]);

	const resolveLang = (
		prefLang: string | null,
		inter: Interaction | undefined
	): LanguageEnum => {
		switch (prefLang) {
			case "tw":
				return LanguageEnum.TRADIIONAL_CHINESE;
			case "cn":
				return LanguageEnum.SIMPLIFIED_CHINESE;
			case "en":
				return LanguageEnum.ENGLISH;
		}

		if (inter && "locale" in inter) {
			const loc = (inter as any).locale;
			if (loc === "zh-TW") return LanguageEnum.TRADIIONAL_CHINESE;
			if (loc === "zh-CN") return LanguageEnum.SIMPLIFIED_CHINESE;
		}

		return LanguageEnum.ENGLISH;
	};

	const lang = resolveLang(userLang, interaction);

	const isCookieAuthError = (err: any): boolean => {
		const code =
			err instanceof HoyoAPIError
				? err.code
				: (err?.code ?? err?.retcode);
		const message = `${err?.message || ""}`.toLowerCase();

		return (
			code === 10001 ||
			message.includes("please login") ||
			message.includes("login")
		);
	};

	try {
		const hsr = new HonkaiStarRail({
			cookie: cookie || "",
			lang: lang as any,
			uid: parseInt(uid || "")
		});

		if (options?.validationType === "none") {
			// 不進行 API 驗證
		} else if (options?.validationType === "record") {
			await hsr.record.note();
		} else {
			// 預設為 daily 驗證 (較寬鬆，不需要便箋權限)
			await hsr.daily.info();
		}

		return hsr;
	} catch (error: any) {
		// Cookie 授權失效時先嘗試自動刷新，再重試一次。
		if (cookie && isCookieAuthError(error)) {
			const refreshResult = await autoRefreshCookie(
				userId,
				accountIndex,
				cookie
			);

			if (refreshResult.success) {
				const retryCookie =
					refreshResult.newCookie ||
					(await getUserCookie(userId, accountIndex)) ||
					cookie;

				try {
					const retryHsr = new HonkaiStarRail({
						cookie: retryCookie,
						lang: lang as any,
						uid: parseInt(uid || "")
					});

					if (options?.validationType === "none") {
						// 不進行 API 驗證
					} else if (options?.validationType === "record") {
						await retryHsr.record.note();
					} else {
						// 預設為 daily 驗證
						await retryHsr.daily.info();
					}

					return retryHsr;
				} catch (retryError: any) {
					error = retryError;
				}
			}
		}

		const isHoyoAPIError = error instanceof HoyoAPIError;
		const errorCode = isHoyoAPIError
			? error.code
			: (error?.code ?? error?.retcode ?? error?.message ?? error);

		if (!options?.suppressErrorReply) {
			checkAccount(
				interaction,
				tr,
				userId,
				isHoyoAPIError && error.code == 10035
					? { ErrorCode: error.code }
					: {
							hasCookie: Boolean(cookie),
							Lang: lang,
							hasUid: uid != null,
							ErrorCode: errorCode
						}
			);
		}
		return null;
	}
}

interface AccountStats {
	ErrorCode?: number;
	hasCookie?: boolean;
	Lang?: LanguageEnum;
	hasUid?: boolean;
}

export function checkAccount(
	interaction: Interaction,
	tr: (key: string, params?: any) => string,
	userId: string,
	data: AccountStats
): void {
	if (data.ErrorCode == 10035) {
		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor("#FFE9D0")
					.setTitle("請先通過 Geetest 來繼續使用指令！")
					.setURL(
						`${(config as any).VERIFY_PUBLIC_URL || "https://verify.yeci.lol/hsr"}/verify?session=${Math.random().toString(36).substring(2, 12)}&userid=${userId}`
					)
			],
			flags: MessageFlags.Ephemeral
		});
	} else if (interaction.user?.id == userId) {
		const accountStats = data;
		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("AccountNotFound"))
					.setDescription(
						tr("AccountNotFoundDesc", {
							hasCookie: tr(
								accountStats.hasCookie ? "isSet" : "isNotSet"
							),
							hasUid: tr(
								accountStats.hasUid ? "isSet" : "isNotSet"
							)
						}) +
							"\n\n" +
							"`" +
							accountStats.ErrorCode +
							"`"
					)
			],
			flags: MessageFlags.Ephemeral
		});
	} else {
		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("NoSetAccount"))
			],
			flags: MessageFlags.Ephemeral
		});
	}
}

export async function updateCookie(
	userId: string,
	accountIndex: number,
	cookieObj: string
): Promise<CookieUpdateResponse | void> {
	// 檢查 cookieObj 是否為有效的字符串
	if (!cookieObj || typeof cookieObj !== "string") {
		throw new Error(
			`Invalid cookie object: expected string, got ${typeof cookieObj}`
		);
	}

	const webAPI =
		"https://webapi-os.account.hoyoverse.com/Api/fetch_cookie_accountinfo";
	const parsedCookie = Object.fromEntries(
		cookieObj
			.split(";")
			.map(item => item.trim())
			.filter(Boolean)
			.map(item => {
				const equalIdx = item.indexOf("=");
				if (equalIdx === -1) return [item, ""];
				return [item.slice(0, equalIdx), item.slice(equalIdx + 1)];
			})
	);

	const cookie = [
		`ltoken_v2=${parsedCookie.ltoken_v2}`,
		`ltuid_v2=${parsedCookie.ltuid_v2}`,
		parsedCookie.ltmid_v2 ? `ltmid_v2=${parsedCookie.ltmid_v2}` : ""
	]
		.filter(Boolean)
		.join("; ");

	const response = await fetch(webAPI, {
		method: "GET",
		headers: {
			Cookie: cookie,
			"x-rpc-signgame": "hkrpg"
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	let responseData: any;
	try {
		const responseText = await response.text();
		responseData = JSON.parse(responseText);
	} catch (error) {
		console.warn("Failed to parse response JSON:", error);
		return {
			error: true,
			message: "Failed to parse response data"
		};
	}

	if (responseData?.code !== 200)
		return {
			error: true,
			message: `Error: ${responseData.message || "Unknown error"}`
		};

	const newCookieToken = responseData.data.cookie_info.cookie_token;
	const accountKey = `${userId}.account`;
	const account: UserAccount[] | null = await database.get(accountKey);

	if (!account || !account[accountIndex]) {
		throw new Error("Account not found");
	}

	let originalCookie = account[accountIndex].cookie
		.split("; ")
		.filter(Boolean);

	let cookieTokenV2Exists = false;

	const updatedCookie = originalCookie.map(item => {
		if (item.startsWith("cookie_token_v2=")) {
			cookieTokenV2Exists = true;
			return `cookie_token_v2=${newCookieToken}`;
		}
		return item;
	});

	if (!cookieTokenV2Exists) {
		const finalCookie: string[] = [];
		let inserted = false;

		for (const item of updatedCookie) {
			finalCookie.push(item);
			if (!inserted && item.startsWith("ltuid_v2=")) {
				finalCookie.push(`cookie_token_v2=${newCookieToken}`);
				inserted = true;
			}
		}

		account[accountIndex].cookie = finalCookie.join("; ");
	} else {
		account[accountIndex].cookie = updatedCookie.join("; ");
	}

	await database.set(accountKey, account);
}

function generateDynamicSecret(): string {
	const salt = "IZPgfb0dRPtBeLuFkdDznSZ6f4wWt6y2"; // app_login salt
	const t = Math.floor(Date.now() / 1000);
	let r = "";
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 6; i++) {
		r += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	const hash = crypto
		.createHash("md5")
		.update(`salt=${salt}&t=${t}&r=${r}`)
		.digest("hex");
	return `${t},${r},${hash}`;
}

export async function updateAccountInfo(
	userId: string,
	{
		uid,
		cookie,
		nickname
	}: { uid: string; cookie: string; nickname?: string }
): Promise<void> {
	const ltuid = extractLtuidFromCookie(cookie) ?? fallbackBucketKey(cookie);
	await upsertHoyolab(database, userId, { ltuid_v2: ltuid, cookie });
	await upsertCharacter(database, userId, ltuid, {
		uid: String(uid),
		nickname: nickname ?? null,
		region: null,
		lastUpdate: new Date().toISOString(),
		invalid: false
	});
}

export async function updateTokensBySToken(
	userId: string,
	accountIndex: number,
	cookieMap: Record<string, string>,
	originalCookieArray: string[],
	uid?: string
): Promise<{ success: boolean; message: string; newCookie?: string }> {
	const stoken = cookieMap.stoken_v2;
	const mid = cookieMap.ltmid_v2 || cookieMap.mid;

	if (!stoken || !mid) {
		return {
			success: false,
			message: "Missing stoken_v2 or mid in cookie parameters"
		};
	}

	const url =
		"https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken";

	// We piece together the cookie for the request
	// (usually stoken_v2 and mid are enough for this endpoint)
	const requestCookie = `stoken_v2=${stoken}; mid=${mid};`;

	const response = await withProxy(config.PROXY_URL, () =>
		fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				ds: generateDynamicSecret(),
				"x-rpc-app_id": "c9oqaq3s3gu8",
				Cookie: requestCookie
			},
			body: JSON.stringify({ dst_token_types: [2, 4] }) // 2: ltoken_v2, 4: cookie_token_v2
		})
	);

	if (!response.ok) {
		return {
			success: false,
			message: `Failed to fetch updated tokens: HTTP ${response.status}`
		};
	}

	let data: any;
	try {
		data = await response.json();
	} catch (e) {
		return { success: false, message: "Failed to parse JSON response" };
	}

	if (data?.retcode !== 0 || !data?.data?.tokens) {
		return {
			success: false,
			message: `API Error: ${data?.message || data?.retcode}`
		};
	}

	let ltoken = "";
	let cookieToken = "";

	for (const tokenObj of data.data.tokens) {
		if (tokenObj.token_type === 2) ltoken = tokenObj.token;
		if (tokenObj.token_type === 4) cookieToken = tokenObj.token;
	}

	if (!ltoken && !cookieToken) {
		return {
			success: false,
			message: "No valid tokens found in the response"
		};
	}

	// Update original cookie parts
	let hasLtoken = false;
	let hasCookieToken = false;

	const updatedCookieArray = originalCookieArray.map(item => {
		if (item.startsWith("ltoken_v2=") && ltoken) {
			hasLtoken = true;
			return `ltoken_v2=${ltoken}`;
		}
		if (item.startsWith("cookie_token_v2=") && cookieToken) {
			hasCookieToken = true;
			return `cookie_token_v2=${cookieToken}`;
		}
		return item;
	});

	if (!hasLtoken && ltoken) updatedCookieArray.push(`ltoken_v2=${ltoken}`);
	if (!hasCookieToken && cookieToken)
		updatedCookieArray.push(`cookie_token_v2=${cookieToken}`);

	const finalCookie = updatedCookieArray.join("; ");

	const accountKey = `${userId}.account`;
	const account: UserAccount[] | null = await database.get(accountKey);

	if (account && account[accountIndex]) {
		account[accountIndex].cookie = finalCookie;
		await database.set(accountKey, account);

		if (uid) {
			await database.delete(`${uid}.cookieExpired`);
			await database.delete(`${uid}.needsCookieUpdate`);
			await database.delete(`${uid}.lastCookieRefreshAttempt`);
		}
	}

	return {
		success: true,
		message: "Token refreshed using stoken_v2",
		newCookie: finalCookie
	};
}

export async function autoRefreshCookie(
	userId: string,
	accountIndex: number,
	cookie: string
): Promise<{ success: boolean; message: string; newCookie?: string }> {
	const parseCookieMap = (cookieStr: string): Record<string, string> => {
		return Object.fromEntries(
			cookieStr
				.split(";")
				.map(item => item.trim())
				.filter(Boolean)
				.map(item => {
					const equalIdx = item.indexOf("=");
					if (equalIdx === -1) return [item, ""];
					return [item.slice(0, equalIdx), item.slice(equalIdx + 1)];
				})
		);
	};

	const extractLifecycleId = (rawValue: string | undefined): string => {
		if (!rawValue) return "";

		try {
			const decoded = decodeURIComponent(rawValue);
			const parsed = JSON.parse(decoded);
			return `${parsed?.value || ""}`;
		} catch {
			try {
				const parsed = JSON.parse(rawValue);
				return `${parsed?.value || ""}`;
			} catch {
				return "";
			}
		}
	};

	try {
		const accountKey = `${userId}.account`;
		const accounts = await database.get(accountKey);
		const uid = accounts?.[accountIndex]?.uid;
		const cookieMap = parseCookieMap(cookie);
		const deviceFp = cookieMap.DEVICEFP || "";
		const deviceId =
			cookieMap._HYVUUID || cookieMap._MHYUUID || `web-${Date.now()}`;
		const lifecycleId = extractLifecycleId(
			cookieMap.HYV_LOGIN_PLATFORM_LIFECYCLE_ID
		);

		const verifyLTokenUrl =
			"https://passport-api-sg.hoyolab.com/account/ma-passport/token/verifyLToken";
		const verifyLTokenResponse = await fetch(verifyLTokenUrl, {
			method: "POST",
			headers: {
				accept: "*/*",
				"accept-language":
					"zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
				"content-type": "application/json",
				origin: "https://act.hoyolab.com",
				referer: "https://act.hoyolab.com/",
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
				cookie,
				"x-rpc-age_gate": "true",
				"x-rpc-aigis_v4": "true",
				"x-rpc-app_id": "c9oqaq3s3gu8",
				"x-rpc-client_type": "4",
				"x-rpc-device_fp": deviceFp,
				"x-rpc-device_id": deviceId,
				"x-rpc-device_model": "Chrome 146.0.0.0",
				"x-rpc-device_name": "Chrome 146.0.0.0",
				"x-rpc-device_os": "Windows 10 64-bit",
				"x-rpc-domain_redirect": "true",
				"x-rpc-game_biz": "hkrpg_global",
				"x-rpc-language": "zh-tw",
				"x-rpc-lifecycle_id": lifecycleId,
				"x-rpc-referrer":
					"https://act.hoyolab.com/app/community-game-records-sea/rpg/index.html",
				"x-rpc-sdk_version": "2.49.0",
				"x-rpc-signgame": "hkrpg",
				"x-rpc-source": "v2.webLogin"
			},
			body: JSON.stringify({})
		});

		const verifyResult = (await verifyLTokenResponse.json()) as any;
		if (verifyResult?.code === 200 || verifyResult?.retcode === 0) {
			if (uid) {
				await database.delete(`${uid}.cookieExpired`);
				await database.delete(`${uid}.needsCookieUpdate`);
				await database.delete(`${uid}.lastCookieRefreshAttempt`);
			}
			return { success: true, message: "Cookie 驗證成功 (verifyLToken)" };
		}

		console.warn(
			`[autoRefreshCookie] [user=${userId}] verifyLToken 失敗: code=${verifyResult?.retcode ?? verifyResult?.code}, msg=${verifyResult?.message}`
		);

		// 如果驗證失敗，且有 stoken_v2，則嘗試透過 stoken_v2 強制更新 Token
		if (cookieMap.stoken_v2 && (cookieMap.ltmid_v2 || cookieMap.mid)) {
			const originalCookieArray = cookie.split("; ").filter(Boolean);
			const stokenResult = await updateTokensBySToken(
				userId,
				accountIndex,
				cookieMap,
				originalCookieArray,
				uid
			);
			if (stokenResult.success) {
				return stokenResult;
			}
			console.warn(
				`[autoRefreshCookie] [user=${userId}] stoken_v2 刷新失敗: ${stokenResult.message}`
			);
		} else {
			console.warn(
				`[autoRefreshCookie] [user=${userId}] 無 stoken_v2 可刷新，cookie fields: ${Object.keys(cookieMap).join(", ")}`
			);
		}

		// 以下為相容方案：如果沒有 stoken，或發生某些意外，仍然嘗試驗證與刷新
		const verifyUrl =
			"https://passport-api-sg.hoyoverse.com/account/ma-passport/token/verifyCookieToken";

		const response = await fetch(verifyUrl, {
			method: "POST",
			headers: {
				accept: "*/*",
				"accept-language":
					"zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
				"content-type": "application/json",
				origin: "https://hsr.hoyoverse.com",
				referer: "https://hsr.hoyoverse.com/",
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
				cookie,
				"x-rpc-app_id": "c9oqaq3s3gu8",
				"x-rpc-client_type": "4",
				"x-rpc-game_biz": "hkrpg_global",
				"x-rpc-signgame": "hkrpg"
			},
			body: JSON.stringify({})
		});

		const result = (await response.json()) as any;
		if (result?.code === 200 || result?.retcode === 0) {
			if (uid) {
				await database.delete(`${uid}.cookieExpired`);
				await database.delete(`${uid}.needsCookieUpdate`);
				await database.delete(`${uid}.lastCookieRefreshAttempt`);
			}
			return { success: true, message: "Cookie 驗證成功" };
		}

		const refreshResult = await updateCookie(userId, accountIndex, cookie);
		if (!(refreshResult as any)?.error) {
			if (uid) {
				await database.delete(`${uid}.cookieExpired`);
				await database.delete(`${uid}.needsCookieUpdate`);
				await database.delete(`${uid}.lastCookieRefreshAttempt`);
			}
			const refreshedAccounts = await database.get(accountKey);
			const newCookie = refreshedAccounts?.[accountIndex]?.cookie;
			return {
				success: true,
				message: "Cookie 已自動刷新",
				newCookie
			};
		}

		if (uid) {
			await database.set(`${uid}.needsCookieUpdate`, true);
		}

		return {
			success: false,
			message: (refreshResult as any)?.message || "Cookie 刷新失敗"
		};
	} catch (error: any) {
		const accounts = await database.get(`${userId}.account`);
		const uid = accounts?.[accountIndex]?.uid;
		if (uid) {
			await database.set(`${uid}.needsCookieUpdate`, true);
		}

		return {
			success: false,
			message: error.message
		};
	}
}

export function getRandomColor(): string {
	const letters = "0123456789ABCDEF";
	let color = "#";
	for (let i = 0; i < 6; i++)
		color += letters[Math.floor(Math.random() * 16)];

	return color;
}

export async function replyOrfollowUp(
	interaction: Interaction,
	options: any
): Promise<any> {
	if ("replied" in interaction && interaction.replied)
		return interaction.editReply(options);
	if ("deferred" in interaction && interaction.deferred)
		return await interaction.followUp(options);
	if ("reply" in interaction) return await interaction.reply(options);
}

export async function getUserGameInfo(
	cookie: string,
	gameId: number = 6 // 6 = Honkai: Star Rail
): Promise<GameInfo> {
	try {
		const hoyolab = new Hoyolab({ cookie });

		const recordList = await hoyolab.gameRecordCard();

		if (!Array.isArray(recordList) || recordList.length === 0) {
			throw new Error("gameRecordCard 回傳空資料");
		}

		// 優先用 game_id 過濾，fallback 用 game_biz
		let matched = recordList.find((item: any) => item.game_id === gameId);

		if (!matched) {
			// fallback: 嘗試用 game_biz 過濾
			matched = recordList.find(
				(item: any) =>
					item.game_biz === "hkrpg_global" ||
					item.game_biz === "hkrpg_cn"
			);
		}

		if (!matched) {
			throw new Error(
				`找不到 game_id=${gameId} 的遊戲紀錄 (共 ${recordList.length} 筆)`
			);
		}

		return {
			uid: matched.game_role_id,
			nickname: matched.nickname,
			level: matched.level
		};
	} catch (error: any) {
		console.error(`[getUserGameInfo] 取得遊戲資訊失敗: ${error.message}`);
		throw error;
	}
}

// 快取管理函數
export async function clearRedeemCodesCache(): Promise<void> {
	const cacheKey = "redeemCodesCache";
	await database.delete(cacheKey);
	console.log("[快取] 兌換碼快取已清除");
}

// 錯誤信息處理函數
export function getFriendlyErrorMessage(
	originalMessage: string | null,
	tr: (key: string) => string
): string {
	if (!originalMessage) return tr("error_RequestFailed");

	const lowerMessage = originalMessage.toLowerCase();

	// 精確匹配
	const exactMatches = [
		"Queue timeout, please refer to https://discord.gg/pkdTJ9svEh for more infomation",
		"Queue timeout"
	];

	if (exactMatches.some(match => originalMessage.includes(match))) {
		return tr("error_APIMaintenance");
	}

	// 模糊匹配映射表
	const errorPatterns = [
		{ pattern: "timeout", key: "error_RequestTimeout" },
		{ pattern: "network error", key: "error_NetworkError" },
		{ pattern: "server error", key: "error_ServerError" },
		{ pattern: "not found", key: "error_NotFound" },
		{ pattern: "invalid uid", key: "error_InvalidUID" },
		{ pattern: "rate limit", key: "error_RateLimit" }
	];

	// 查找匹配的錯誤模式
	const matchedPattern = errorPatterns.find(({ pattern }) =>
		lowerMessage.includes(pattern)
	);

	if (matchedPattern) {
		return tr(matchedPattern.key);
	}

	// 如果都沒有匹配到，返回原始信息
	return originalMessage;
}

export async function getRedeemCodesCacheStatus(): Promise<CacheStatus> {
	const cacheKey = "redeemCodesCache";
	const cachedData: CacheData | null = await database.get(cacheKey);
	const currentTime = Date.now();
	const oneDayInMs = 24 * 60 * 60 * 1000;

	if (!cachedData) {
		return {
			exists: false,
			message: "快取不存在"
		};
	}

	const timeDiff = currentTime - cachedData.timestamp;
	const isExpired = timeDiff >= oneDayInMs;
	const remainingHours = Math.floor(
		(oneDayInMs - timeDiff) / (1000 * 60 * 60)
	);

	return {
		exists: true,
		isExpired,
		remainingHours: isExpired ? 0 : remainingHours,
		codesCount: cachedData.codes.length,
		lastUpdated: new Date(cachedData.timestamp).toLocaleString("zh-TW"),
		message: isExpired
			? "快取已過期"
			: `快取有效，剩餘 ${remainingHours} 小時，包含 ${cachedData.codes.length} 個兌換碼`
	};
}
