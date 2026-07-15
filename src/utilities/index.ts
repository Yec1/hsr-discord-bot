import {
	EmbedBuilder,
	Interaction,
	CommandInteraction,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} from "discord.js";
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
	getLegacyAccounts,
	getLegacyAccountAtIndex,
	storeAccountBinding,
	updateAccountCookieAtIndex
} from "@/utilities/accountStore.js";
import { getAllFilesFromFs } from "@/utilities/files.js";
import { parsePostContent as parseNewsPostContent } from "@/utilities/news.js";
import { replyOrfollowUp } from "@/utilities/discordReply.js";
const config = loadConfig();

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

interface AccountData {
	uid?: string;
	cookie?: string;
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
	return getAllFilesFromFs(dir, exts);
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

export { getNewsList, getPostFull } from "@/utilities/news.js";
export {
	getRedeemCodes,
	clearRedeemCodesCache,
	getRedeemCodesCacheStatus
} from "@/utilities/redeemCodes.js";
export {
	requestPlayerDataEnka,
	requestPlayerData,
	requestPlayerActivity
} from "@/utilities/hsr/playerData.js";
export { replyOrfollowUp } from "@/utilities/discordReply.js";

export async function parsePostContent(content: string): Promise<string> {
	return parseNewsPostContent(content);
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

export async function drawInQueueReply(
	interaction: CommandInteraction,
	title: string = ""
): Promise<void> {
	await interaction
		.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(title)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		})
		.catch(() => {});
}

const languageMapping: Record<string, LanguageEnum> = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	vi: LanguageEnum.VIETNAMESE,
	jp: LanguageEnum.JAPANESE,
	kr: LanguageEnum.KOREAN,
	fr: LanguageEnum.FRENCH,
	en: LanguageEnum.ENGLISH,
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
		ko: "kr",
		"en-US": "en",
		"en-GB": "en"
	};

	const langCode =
		langMap[userSystemLang] ||
		(userSystemLang.startsWith("zh") ? "tw" : "en");

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
	const account = await getLegacyAccounts(database, userId);
	return account?.[accountIndex]?.uid || null;
}

export async function getUserCookie(
	userId: string,
	accountIndex: number = 0
): Promise<string | null> {
	const account = await getLegacyAccounts(database, userId);
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
	const account = await getLegacyAccountAtIndex(database, userId, accountIndex);
	if (!account) {
		throw new Error("Account not found");
	}

	let originalCookie = account.cookie
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

		await updateAccountCookieAtIndex(
			database,
			userId,
			accountIndex,
			finalCookie.join("; ")
		);
	} else {
		await updateAccountCookieAtIndex(
			database,
			userId,
			accountIndex,
			updatedCookie.join("; ")
		);
	}
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
	await storeAccountBinding(database, userId, { uid, cookie, nickname: nickname ?? null });
}

export async function updateTokensBySToken(
	userId: string,
	accountIndex: number,
	cookieMap: Record<string, string>,
	originalCookieArray: string[],
	uid?: string
): Promise<{ success: boolean; message: string; newCookie?: string }> {
	const stoken = cookieMap.stoken;
	const cookieUid = cookieMap.ltuid_v2 || cookieMap.account_id_v2;
	const mid = cookieMap.ltmid_v2 || cookieMap.mid;

	if (!stoken || !mid || !cookieUid) {
		return {
			success: false,
			message: "Missing stoken, uid, or mid in cookie parameters"
		};
	}

	const url =
		"https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken";

	// Must send all identity cookies with key "stoken" (not "stoken_v2")
	const requestCookie =
		`stoken=${stoken}; ltuid_v2=${cookieUid}; ltmid_v2=${mid}; ` +
		`account_id_v2=${cookieUid}; account_mid_v2=${mid}; mid=${mid};`;

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
	const account = await updateAccountCookieAtIndex(
		database,
		userId,
		accountIndex,
		finalCookie
	);
	if (account) {
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

/**
 * Exchange stoken_v2 + mid for ltoken_v2 and cookie_token_v2.
 * Returns the enriched cookie string (original keys preserved, new tokens
 * appended/replaced), or null if the exchange fails.
 */
export async function getTokensFromSToken(
	cookieStr: string
): Promise<string | null> {
	const cookieMap: Record<string, string> = {};
	for (const part of cookieStr.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		cookieMap[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
	}

	const stoken = cookieMap["stoken"];
	const uid = cookieMap["ltuid_v2"] || cookieMap["account_id_v2"];
	const mid =
		cookieMap["ltmid_v2"] ||
		cookieMap["account_mid_v2"] ||
		cookieMap["mid"];
	if (!stoken || !mid || !uid) {
		return null;
	}

	const url =
		"https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken";
	// Must send all identity cookies; key must be "stoken" not "stoken_v2"
	const requestCookie =
		`stoken=${stoken}; ltuid_v2=${uid}; ltmid_v2=${mid}; ` +
		`account_id_v2=${uid}; account_mid_v2=${mid}; mid=${mid};`;

	let response: Response;
	try {
		response = await withProxy(config.PROXY_URL, () =>
			fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					ds: generateDynamicSecret(),
					"x-rpc-app_id": "c9oqaq3s3gu8",
					Cookie: requestCookie
				},
				body: JSON.stringify({ dst_token_types: [2, 4] })
			})
		);
	} catch (e: any) {
		return null;
	}

	if (!response.ok) {
		return null;
	}

	let data: any;
	try {
		data = await response.json();
	} catch {
		return null;
	}

	if (data?.retcode !== 0 || !data?.data?.tokens) {
		return null;
	}

	let ltoken = "";
	let cookieToken = "";
	for (const tokenObj of data.data.tokens) {
		if (tokenObj.token_type === 2) ltoken = tokenObj.token;
		if (tokenObj.token_type === 4) cookieToken = tokenObj.token;
	}
	if (!ltoken) return null;

	// Build enriched cookie: keep existing keys, replace/add new tokens
	const parts = cookieStr.split(/;\s*/).filter(Boolean);
	const has = (k: string) => parts.some(p => p.startsWith(k + "="));
	const replace = (k: string, v: string) =>
		parts.map(p => (p.startsWith(k + "=") ? `${k}=${v}` : p));

	let arr = has("ltoken_v2")
		? replace("ltoken_v2", ltoken)
		: [...parts, `ltoken_v2=${ltoken}`];
	if (cookieToken) {
		arr = has("cookie_token_v2")
			? arr.map(p =>
					p.startsWith("cookie_token_v2=")
						? `cookie_token_v2=${cookieToken}`
						: p
				)
			: [...arr, `cookie_token_v2=${cookieToken}`];
	}
	return arr.join("; ");
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
		const account = await getLegacyAccountAtIndex(database, userId, accountIndex);
		const uid = account?.uid;
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
			// ltoken_v2 is valid. If stoken is available, also refresh
			// cookie_token_v2 proactively — ltoken and cookie_token are separate
			// tokens with independent expiry, so a valid ltoken does NOT guarantee
			// that cookie_token_v2 (required for code redemption) is still valid.
			if (cookieMap.stoken && (cookieMap.ltmid_v2 || cookieMap.mid)) {
				const originalCookieArray = cookie.split("; ").filter(Boolean);
				const stokenResult = await updateTokensBySToken(
					userId,
					accountIndex,
					cookieMap,
					originalCookieArray,
					uid
				);
				if (stokenResult.success) {
					return { success: true, message: "Cookie 驗證成功並刷新 cookie_token_v2 (verifyLToken+stoken)" };
				}
				// stoken refresh failed — not fatal, ltoken is still valid
				console.warn(
					`[autoRefreshCookie] [user=${userId}] verifyLToken 成功但 stoken 刷新 cookie_token_v2 失敗: ${stokenResult.message}`
				);
			}
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
		if (cookieMap.stoken && (cookieMap.ltmid_v2 || cookieMap.mid)) {
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
				`[autoRefreshCookie] [user=${userId}] 無 stoken 可刷新，cookie fields: ${Object.keys(cookieMap).join(", ")}`
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
			const refreshedAccount = await getLegacyAccountAtIndex(
				database,
				userId,
				accountIndex
			);
			const newCookie = refreshedAccount?.cookie;
			return {
				success: true,
				message: "Cookie 已自動刷新",
				...(newCookie !== undefined && { newCookie })
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
		const account = await getLegacyAccountAtIndex(
			database,
			userId,
			accountIndex
		);
		const uid = account?.uid;
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

export async function getUserGameInfo(
	cookie: string,
	gameId: number = 6 // 6 = Honkai: Star Rail
): Promise<GameInfo> {
	try {
		// hoyolab-ts requires legacy ltuid/ltoken keys.
		// Web-login provides v2 keys (ltuid_v2, ltoken_v2); map them as aliases.
		let normalizedCookie = cookie;
		const cookieMap: Record<string, string> = {};
		for (const part of cookie.split(/;\s*/)) {
			const eq = part.indexOf("=");
			if (eq === -1) continue;
			cookieMap[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
		}
		const extras: string[] = [];
		if (
			!cookieMap["ltuid"] &&
			(cookieMap["ltuid_v2"] || cookieMap["account_id_v2"])
		)
			extras.push(
				`ltuid=${cookieMap["ltuid_v2"] ?? cookieMap["account_id_v2"]}`
			);
		if (!cookieMap["ltoken"] && cookieMap["ltoken_v2"])
			extras.push(`ltoken=${cookieMap["ltoken_v2"]}`);
		if (!cookieMap["ltmid_v2"] && cookieMap["account_mid_v2"])
			extras.push(`ltmid_v2=${cookieMap["account_mid_v2"]}`);
		if (extras.length) normalizedCookie = cookie + "; " + extras.join("; ");

		const hoyolab = new Hoyolab({ cookie: normalizedCookie });

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
