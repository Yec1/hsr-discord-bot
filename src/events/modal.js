import { client } from "../index.js";
import { AxiosError } from "axios";
import { Events, EmbedBuilder } from "discord.js";
import { HonkaiStarRail } from "hoyoapi";
import { getUserLang, requestPlayerData } from "../utilities/utilities.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";

const db = client.db;

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isModalSubmit()) return;

	const { locale, customId, fields } = interaction;
	const userLocale = await getUserLang(interaction.user.id);
	const tr = i18nMixin(userLocale || toI18nLang(locale) || "en");

	if (customId.startsWith("accountEdit"))
		handleAccountEdit(interaction, tr, customId, fields);
	if (customId == "account_SetUserIDModal")
		handleUidSet(interaction, tr, fields);
	if (customId.startsWith("cookie_set"))
		handleCookieSet(interaction, tr, customId, fields);
});

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
		if (accounts.size >= 3)
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
	const ltoken = fields.getTextInputValue("ltoken") || "";
	const ltuid = fields.getTextInputValue("ltuid") || "";
	const cookie = `ltoken_v2=${ltoken}; ltuid_v2=${ltuid}`;

	try {
		const hsr = new HonkaiStarRail({
			cookie: cookie
		});
		await hsr.daily.info();

		const account = (await db.get(`${interaction.user.id}.account`)) ?? "";

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
							accountStats.ErrorCode +
							"`"
					)
					.setColor("#E76161")
			]
		});
	}
}
