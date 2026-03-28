import { client, database } from "@/index.js";
import { AxiosError } from "axios";
import {
	Events,
	EmbedBuilder,
	ModalSubmitInteraction,
	MessageFlags,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";
import { HonkaiStarRail } from "@yeci226/hoyoapi";
import {
	getUserLang,
	requestPlayerDataEnka,
	getUserGameInfo
} from "@/utilities/index.js";
import { createTranslator, toI18nLang } from "@/utilities/core/i18n.js";
import type { TranslationFunction } from "@/types/index.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();

interface Account {
	uid: string;
	cookie: string;
	nickname?: string;
}

interface GameInfo {
	uid: string;
	nickname: string;
}

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isModalSubmit()) return;

	const { locale, customId, fields } = interaction;
	const tr = createTranslator(
		(await getUserLang(interaction.user.id)) || toI18nLang(locale) || "en"
	);

	if (customId === "cookie_set_new") {
		await handleNewCookieSet(interaction, tr, fields);
	} else if (customId.startsWith("cookie_set-")) {
		await handleCookieSet(interaction, tr, customId, fields);
	}
});

async function handleNewCookieSet(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	fields: any
): Promise<void> {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const cookieRaw = fields.getTextInputValue("cookie") || "";
	const cookie = cookieRaw
		.replace(/^cookie\s*:\s*/i, "")
		.replace(/\r?\n/g, " ")
		.split(";")
		.map((part: string) => part.trim())
		.filter(Boolean)
		.join("; ");

	if (await database.has(`${interaction.user.id}.account`)) {
		const accounts: Account[] =
			(await database.get(`${interaction.user.id}.account`)) || [];
		if (
			!config.DEVIDS.includes(interaction.user.id) &&
			accounts.length >= 5
		) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("account_LimitExceeded")} `)
				]
			});
			return;
		}
	}

	try {
		const gameInfo = await getUserGameInfo(cookie);
		const uid = gameInfo.uid;

		const accounts: Account[] =
			(await database.get(`${interaction.user.id}.account`)) || [];

		if (accounts.some(acc => acc.uid === uid)) {
			await interaction.editReply({
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
			return;
		}

		accounts.push({
			uid: gameInfo.uid,
			nickname: gameInfo.nickname,
			cookie: cookie
		});

		await database.set(`${interaction.user.id}.account`, accounts);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(tr("account_CookieSetSuccess", { z: gameInfo.nickname }))
			]
		});
	} catch (error: any) {
		console.log(error);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("account_CookieSetFailed", { z: "Unknown" }))
					.setDescription(
						tr("account_CookieSetFailedDesc") +
							"\n\n`" +
							error.message +
							"`"
					)
					.setColor("#E76161")
			]
		});
	}
}

async function handleCookieSet(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	customId: string,
	fields: any
): Promise<void> {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const accountIndex = customId.split("-")[1];
	if (!accountIndex) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setTitle(tr("account_InvalidIndex"))
			]
		});
		return;
	}
	const cookieRaw = fields.getTextInputValue("cookie") || "";
	const cookie = cookieRaw
		.replace(/^cookie\s*:\s*/i, "")
		.replace(/\r?\n/g, " ")
		.split(";")
		.map((part: string) => part.trim())
		.filter(Boolean)
		.join("; ");
	const account: Account[] =
		(await database.get(`${interaction.user.id}.account`)) ?? [];

	const index = parseInt(accountIndex);
	if (!account[index]) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("account_CookieSetFailed", { z: "Unknown" }))
					.setDescription(tr("account_CookieSetFailedDesc"))
					.setColor("#E76161")
			]
		});
		return;
	}

	try {
		const gameInfo = await getUserGameInfo(cookie);

		// 清除過期標記
		await database.delete(`${account[index].uid}.cookieExpired`);

		account[index].cookie = cookie;
		account[index].uid = gameInfo.uid;
		account[index].nickname = gameInfo.nickname;
		await database.set(`${interaction.user.id}.account`, account);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(tr("account_CookieSetSuccess", { z: account[index].nickname }))
			]
		});
	} catch (error: any) {
		console.log(error);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						tr("account_CookieSetFailed", {
							z: `${account[index].uid}`
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
