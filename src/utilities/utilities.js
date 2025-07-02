import { client } from "../index.js";
import { EmbedBuilder } from "discord.js";
import axios from "axios";
import emoji from "../assets/emoji.js";
import { HonkaiStarRail, LanguageEnum, HoyoAPIError, Hoyolab } from "hoyoapi";
const BASE_URL = "https://bbs-api-os.hoyolab.com/community/post/wapi/";
const db = client.db;

const versionChoices = [
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

export const createChoiceOption = ({ value, name, localName }) => ({
	name: `${value} - ${name}`,
	name_localizations: { "zh-TW": `${value} - ${localName}` },
	value
});

export const filterVersionChoices = (input, limit = 25) => {
	return versionChoices
		.filter(
			choice =>
				choice.value.includes(input) ||
				choice.name.toLowerCase().includes(input.toLowerCase()) ||
				choice.localName.includes(input)
		)
		.slice(0, limit); // 只取前 limit 個
};

export const getLastVersionChoices = (limit = 25) => {
	return versionChoices.slice(-limit);
};

export const addVersionChoices = option => {
	const lastChoices = getLastVersionChoices();
	lastChoices.forEach(choice =>
		option.addChoices(createChoiceOption(choice))
	);
	return option;
};

export async function getNewsList(lang, type) {
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

export async function getPostFull(lang, postId) {
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

export async function parsePostContent(content) {
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
		(match, tag, href, text) =>
			href == text
				? `${emoji.link}${href}`
				: `${emoji.link}[${text}](${href})`
	);

	content = content.replace(
		/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/gi,
		(match, p1) => `### ${emoji.link}[影片](${p1})`
	);

	content = content.replace(/\s*class="[^"]*"/g, "");
	// content = content.replace(/\n\s*\n/g, "\n");

	return content;
}

export async function getRedeemCodes() {
	const res = await axios
		.get("https://hoyo-codes.seria.moe/codes?game=hkrpg")
		.then(response => response.data);

	return res.codes;
}

export function secondsToHms(d, tr) {
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

export async function requestPlayerData(uid, interaction) {
	const userLocaleKey = `${interaction?.user.id}.locale`;
	let langParam = "?lang=en";

	if (await db?.has(userLocaleKey)) {
		const storedLocale = await db.get(userLocaleKey);
		langParam = storedLocale === "tw" ? "?lang=cht" : "?lang=en";
	} else if (interaction) {
		langParam = interaction.locale === "zh-TW" ? "?lang=cht" : "?lang=en";
	}

	const response = await axios
		.get(`https://api.mihomo.me/sr_info_parsed/${uid}${langParam}`)
		.catch(err => {
			return { status: 400, data: null };
		});

	return { status: response.status, playerData: response.data };
}

export async function requestPlayerActivity(uid, interaction) {
	const userLocaleKey = `${interaction?.user.id}.locale`;
	let langParam = "?lang=en";

	if (await db?.has(userLocaleKey)) {
		const storedLocale = await db.get(userLocaleKey);
		langParam = storedLocale === "tw" ? "?lang=cht" : "?lang=en";
	} else if (interaction) {
		langParam = interaction.locale === "zh-TW" ? "?lang=cht" : "?lang=en";
	}

	const response = await axios
		.get(`https://api.mihomo.me/sr_activity/${uid}${langParam}`)
		.catch(err => {
			return { status: 400, data: null };
		});

	return { status: response.status, playerActivity: response.data };
}

export async function drawInQueueReply(interaction, title = "") {
	interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setTitle(title)
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
				)
		],
		fetchReply: true
	});
}

const languageMapping = {
	tw: LanguageEnum.TRADIIONAL_CHINESE,
	cn: LanguageEnum.SIMPLIFIED_CHINESE,
	vi: LanguageEnum.VIETNAMESE,
	jp: LanguageEnum.JAPANESE,
	kr: LanguageEnum.KOREAN,
	fr: LanguageEnum.FRENCH,
	default: LanguageEnum.ENGLISH
};

export async function setupDefaultLang(userId, userSystemLang) {
	const langMap = {
		"zh-TW": "tw",
		"zh-CN": "cn",
		ja: "jp",
		ko: "kr"
	};

	const langCode = langMap[userSystemLang] || userSystemLang;

	if (languageMapping[langCode]) await db.set(`${userId}.locale`, langCode);
}

export async function failedReply(interaction, title = "", description = "") {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor("#E76161")
		.setThumbnail(
			"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
		);

	if (description) embed.setDescription(description);

	replyOrfollowUp(interaction, {
		embeds: [embed],
		ephemeral: true,
		fetchReply: true
	});
}

export async function getUserUid(userId, accountIndex = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[accountIndex]?.uid || null;
}

export async function getUserCookie(userId, accountIndex = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[accountIndex]?.cookie || null;
}

export async function getUserLang(userId) {
	const langKey = `${userId}.locale`;

	const lang = await db.get(langKey);
	return lang || null;
}

export async function getUserHSRData(interaction, tr, userId, accountIndex) {
	const [cookie, userLang, uid] = await Promise.all([
		getUserCookie(userId, accountIndex),
		getUserLang(userId),
		getUserUid(userId, accountIndex)
	]);

	const lang =
		userLang === "tw" || interaction.locale === "zh-TW"
			? LanguageEnum.TRADIIONAL_CHINESE
			: LanguageEnum.ENGLISH;

	try {
		const hsr = new HonkaiStarRail({ cookie, lang, uid });
		await hsr.record.note();

		return hsr;
	} catch (error) {
		const isHoyoAPIError = error instanceof HoyoAPIError;
		const errorCode = isHoyoAPIError ? error.code : error;

		checkAccount(
			interaction,
			tr,
			userId,
			isHoyoAPIError && error.code == 10035
				? {
						ErrorCode: error.code
					}
				: {
						hasCookie: cookie != null,
						Lang: lang,
						hasUid: uid != null,
						ErrorCode: errorCode
					}
		);
		return null;
	}
}

export function checkAccount(interaction, tr, userId, data) {
	if (data.ErrorCode == 10035) {
		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor("#FFE9D0")
					.setTitle("請先通過 Geetest 來繼續使用指令！")
					.setURL(`https://yeci226.vercel.app/geetest/${userId}`)
			],
			ephemeral: true
		});
	} else if (interaction.user.id == userId) {
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
			ephemeral: true
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
			ephemeral: true
		});
	}
}

export async function updateCookie(userId, accountIndex, cookieObj) {
	const webAPI =
		"https://webapi-os.account.hoyoverse.com/Api/fetch_cookie_accountinfo";
	const parsedCookie = Object.fromEntries(
		cookieObj
			.split("; ")
			.filter(Boolean)
			.map(cookie => cookie.split("="))
	);

	const cookie = [
		`cookie_token_v2=${parsedCookie.cookie_token_v2}`,
		`account_id_v2=${parsedCookie.ltuid_v2}`
	].join("; ");

	const response = await fetch(webAPI, {
		method: "GET",
		headers: {
			Cookie: cookie
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const responseData = await response.json();
	if (responseData?.code !== 200)
		return {
			error: true,
			message: `Error: ${responseData.message || "Unknown error"}`
		};

	const newCookieToken = responseData.data.cookie_info.cookie_token;
	const accountKey = `${userId}.account`;
	const account = await db.get(accountKey);

	let originalCookie = account[accountIndex].cookie
		.split("; ")
		.filter(Boolean);

	let cookieTokenExists = false;

	const updatedCookie = originalCookie.map(item => {
		if (item.startsWith("cookie_token=")) {
			cookieTokenExists = true;
			return `cookie_token=${newCookieToken}`;
		}
		return item;
	});

	if (!cookieTokenExists) {
		const finalCookie = [];
		let inserted = false;

		for (const item of updatedCookie) {
			finalCookie.push(item);
			if (!inserted && item.startsWith("ltuid_v2=")) {
				finalCookie.push(`cookie_token=${newCookieToken}`);
				inserted = true;
			}
		}

		account[accountIndex].cookie = finalCookie.join("; ");
	} else {
		account[accountIndex].cookie = updatedCookie.join("; ");
	}

	await db.set(accountKey, account);
}

export function getRandomColor() {
	const letters = "0123456789ABCDEF";
	let color = "#";
	for (let i = 0; i < 6; i++)
		color += letters[Math.floor(Math.random() * 16)];

	return color;
}

global.replyOrfollowUp = async function (interaction, ...args) {
	if (interaction.replied) return interaction.editReply(...args);
	if (interaction.deferred) return await interaction.followUp(...args);
	return await interaction.reply(...args);
};

export async function getUserGameInfo(cookie, gameName = "Honkai: Star Rail") {
	const hoyolab = new Hoyolab({
		cookie
	});

	const gameRecord = await hoyolab.gameRecordCard();
	const filteredData = gameRecord.filter(item => item.game_name === gameName);

	return {
		uid: filteredData[0].game_role_id,
		nickname: filteredData[0].nickname,
		level: filteredData[0].level
	};
}
