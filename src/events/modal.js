import { client } from "../index.js";
import { AxiosError } from "axios";
import { Events, EmbedBuilder } from "discord.js";
import { HonkaiStarRail } from "@yeci226/hoyoapi";
import {
	getUserLang,
	requestPlayerDataEnka,
	getUserGameInfo
} from "../utilities/utilities.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";
import loginAccount from "../utilities/hsr/login.js";

const db = client.db;

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isModalSubmit()) return;

	const { locale, customId, fields } = interaction;
	const userLocale = await getUserLang(interaction.user.id);
	const tr = i18nMixin(userLocale || toI18nLang(locale) || "en");

	if (customId.startsWith("accountEdit"))
		handleAccountEdit(interaction, tr, customId, fields);
	if (customId == "account_LoginAccountModal")
		handleAccountLogin(interaction, tr, fields);
	if (customId == "account_SetUserIDModal")
		handleUidSet(interaction, tr, fields);
	if (customId.startsWith("cookie_set"))
		handleCookieSet(interaction, tr, customId, fields);
});

async function handleAccountLogin(interaction, tr, fields) {
	const email = fields.getTextInputValue("account_LoginAccountModalField");
	const password = fields.getTextInputValue(
		"account_LoginAccountModalField2"
	);
	await interaction.deferReply({ ephemeral: true });
	try {
		// Make sure Email is correct
		const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
		if (!emailRegex.test(email)) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(tr("account_LoginFailedDesc"))
						.setColor("#E76161")
				]
			});
		}

		const { cookie, error } = (await loginAccount(email, password)) || "";
		if (error || !cookie) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(
							`${tr("account_LoginFailedDesc")}\n\n\`${error}\``
						)
						.setColor("#E76161")
				]
			});
		}

		const { uid, nickname } = await getUserGameInfo(cookie);
		const existedAccounts =
			(await db.get(`${interaction.user.id}.account`)) || [];

		// 清除過期標記
		await db.delete(`${uid}.cookieExpired`);

		// 檢查是否已經綁定過這個UID
		const existingAccountIndex = existedAccounts.findIndex(
			account => account.uid == uid
		);

		if (existingAccountIndex !== -1) {
			// 如果已經綁定過，直接更新該帳號的Cookie
			existedAccounts[existingAccountIndex].cookie = cookie;
			existedAccounts[existingAccountIndex].nickname = nickname;

			await db.set(`${interaction.user.id}.account`, existedAccounts);

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(tr("account_LoginSuccess"))
						.setDescription(
							tr("account_LoginSuccessDesc", { z: `${uid}` })
						)
				]
			});
		} else {
			// 如果是新帳號，檢查數量限制
			if (existedAccounts.length >= 5) {
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_LimitExceeded"))
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
			}

			// 添加新帳號
			await db.push(`${interaction.user.id}.account`, {
				uid: uid,
				cookie: cookie,
				nickname: nickname
			});

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(tr("account_LoginSuccess"))
				]
			});
		}
	} catch (error) {
		console.log(error);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("account_LoginFailed"))
					.setDescription(tr("account_LoginFailedDesc"))
					.setColor("#E76161")
			]
		});
	}
}

async function handleAccountEdit(interaction, tr, customId, fields) {
	await interaction.deferReply({ ephemeral: true });
	const accountIndex = customId.split("-")[1];
	const uid = fields.getTextInputValue("uid");
	const data = await requestPlayerDataEnka(uid);
	if (!data.playerData?.detailInfo?.uid)
		return interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("profile_UidNotFound") + " - " + uid)
			]
		});

	const accounts = (await db.get(`${interaction.user.id}.account`)) ?? "";

	if (accounts.some(account => account.uid == uid))
		return interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("account_AlreadySet", { z: `${uid}` }))
			]
		});

	accounts[accountIndex].uid = uid;

	interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor("#F6F1F1")
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
				)
				.setTitle(tr("account_UidSetSuccess", { z: `${uid}` }))
		]
	});

	await db.set(`${interaction.user.id}.account`, accounts);
}

async function handleUidSet(interaction, tr, fields) {
	await interaction.deferReply({ ephemeral: true });
	const uid = fields.getTextInputValue("account_SetUserIDModalField");
	try {
		const data = await requestPlayerDataEnka(uid);
		if (!data.playerData?.detailInfo?.uid)
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("profile_UidNotFound") + " - " + uid)
				]
			});
	} catch (e) {
		if (e instanceof AxiosError) {
			await interaction.followUp({
				ephemeral: true,
				content: `未知的UID - \`${e}\``
			});
		}
		throw e;
	}

	if (await db.has(`${interaction.user.id}.account`)) {
		const accounts = await db.get(`${interaction.user.id}.account`);
		if (accounts.length >= 5)
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("account_LimitExceeded")} `)
				]
			});

		if (accounts.some(account => account.uid == uid))
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(
							`${tr("account_AlreadySet", { z: `${uid}` })}`
						)
				]
			});
	}

	interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor("#F6F1F1")
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
				)
				.setTitle(`${tr("account_UidSetSuccess", { z: `${uid}` })}`)
		]
	});
	await db.push(`${interaction.user.id}.account`, { uid: uid, cookie: "" });
}

async function handleCookieSet(interaction, tr, customId, fields) {
	const accountIndex = customId.split("-")[1];
	const ltoken = `ltoken_v2=${fields.getTextInputValue("ltoken")}; ` || "";
	const ltuid = `ltuid_v2=${fields.getTextInputValue("ltuid")}; ` || "";
	const cookieToken =
		`cookie_token_v2=${fields.getTextInputValue("cookieToken")}; ` || "";
	const accountMid =
		`account_mid_v2=${fields.getTextInputValue("accountMid")}; ` || "";
	const cookie = ltoken + ltuid + cookieToken + accountMid;
	const account = (await db.get(`${interaction.user.id}.account`)) ?? "";

	try {
		const hsr = new HonkaiStarRail({ cookie: cookie });
		await hsr.daily.info();

		// 清除過期標記
		await db.delete(`${account[accountIndex].uid}.cookieExpired`);

		account[accountIndex].cookie = cookie;
		await db.set(`${interaction.user.id}.account`, account);

		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(
						tr("account_CookieSetSuccess", {
							z: `${account[accountIndex].uid}`
						})
					)
			],
			ephemeral: true
		});
	} catch (error) {
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						tr("account_CookieSetFailed", {
							z: `${account[accountIndex].uid}`
						})
					)
					.setDescription(
						tr("account_CookieSetFailedDesc") +
							"\n\n" +
							"`" +
							error.message +
							"`"
					)
					.setColor("#E76161")
			]
		});
	}
}
