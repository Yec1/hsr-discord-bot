import { client } from "../index.js";
import { AxiosError } from "axios";
import { Events, EmbedBuilder } from "discord.js";
import { HonkaiStarRail } from "hoyoapi";
import {
	getUserLang,
	requestPlayerData,
	getUserGameUid
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
		const existedAccounts =
			(await db.get(`${interaction.user.id}.account`)) || [];
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

		const { uid, nickname } = await getUserGameUid(cookie);
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

		await db.push(`${interaction.user.id}.account`, {
			uid: uid,
			cookie: cookie,
			nickname: nickname
		});
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
	const data = await requestPlayerData(uid, interaction);
	if (!data.playerData?.player.uid)
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
					.setTitle(
						tr("account_AlreadySet", {
							z: `${uid}`
						})
					)
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
		const data = await requestPlayerData(uid, interaction);
		if (!data.playerData?.player.uid)
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
							`${tr("account_AlreadySet", {
								z: `${uid}`
							})}`
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
				.setTitle(
					`${tr("account_UidSetSuccess", {
						z: `${uid}`
					})}`
				)
		]
	});
	await db.push(`${interaction.user.id}.account`, {
		uid: uid,
		cookie: ""
	});
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
		const hsr = new HonkaiStarRail({
			cookie: cookie
		});
		await hsr.daily.info();

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
