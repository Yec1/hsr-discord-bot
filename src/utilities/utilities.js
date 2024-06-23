import { client } from "../index.js";
import { EmbedBuilder } from "discord.js";
import axios from "axios";
import { HonkaiStarRail, LanguageEnum, HoyoAPIError } from "hoyoapi";
const db = client.db;

async function requestPlayerData(uid, interaction) {
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

async function drawInQueueReply(interaction, title = "") {
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

async function failedReply(interaction, title = "", description = "") {
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

async function getUserUid(userId, index = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[index]?.uid || null;
}

async function getUserCookie(userId, index = 0) {
	const accountKey = `${userId}.account`;

	const account = await db.get(accountKey);
	return account?.[index]?.cookie || null;
}

async function getUserLang(userId) {
	const langKey = `${userId}.locale`;

	const lang = await db.get(langKey);
	return lang || null;
}

async function getUserHSRData(interaction, tr, userId) {
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

function checkAccount(interaction, tr, userId, data) {
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

function getRandomColor() {
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

export {
	requestPlayerData,
	drawInQueueReply,
	failedReply,
	getUserUid,
	getUserCookie,
	getUserLang,
	getUserHSRData,
	getRandomColor
};
