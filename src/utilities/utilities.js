import { client } from "../index.js";
import { EmbedBuilder } from "discord.js";
import axios from "axios";
import emoji from "../assets/emoji.js";
import { HonkaiStarRail, LanguageEnum, HoyoAPIError } from "hoyoapi";
const BASE_URL = "https://bbs-api-os.hoyolab.com/community/post/wapi/";
const db = client.db;

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

export async function failedReply(interaction, title = "", description = "") {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor("#E76161")
		.setThumbnail(
			"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
		);

	if (description) embed.setDescription(description);

	interaction.reply({
		embeds: [embed],
		ephemeral: true,
		fetchReply: true
	});
}

export async function getUserUid(userId, index = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[index]?.uid || null;
}

export async function getUserCookie(userId, index = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[index]?.cookie || null;
}

export async function getUserLang(userId) {
	const langKey = `${userId}.locale`;

	const lang = await db.get(langKey);
	return lang || null;
}

export async function getUserHSRData(interaction, tr, userId) {
	const [cookie, userLang, uid] = await Promise.all([
		getUserCookie(userId),
		getUserLang(userId),
		getUserUid(userId)
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
					.setURL(`http://127.0.0.1:3000/geetest/${userId}`)
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
