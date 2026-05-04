import { client, database } from "@/index.js";
import {
	Events,
	EmbedBuilder,
	ModalSubmitInteraction,
	MessageFlags,
	ActionRowBuilder,
	ButtonInteraction
} from "discord.js";
import { HonkaiStarRail } from "@yeci226/hoyoapi";
import { randomUUID } from "node:crypto";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import {
	getUserLang,
	requestPlayerDataEnka,
	getUserGameInfo
} from "@/utilities/index.js";
import { createTranslator, toI18nLang } from "@/utilities/core/i18n.js";
import type { TranslationFunction } from "@/types/index.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();


function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	errorMsg: string
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(errorMsg)), ms)
		)
	]);
}

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

	const tr = createTranslator(
		(await getUserLang(interaction.user.id)) ||
			toI18nLang(interaction.locale) ||
			"en"
	);

	const { customId, fields } = interaction;

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

	const ltokenV2 = fields.getTextInputValue("ltoken_v2").trim();
	const ltuidV2 = fields.getTextInputValue("ltuid_v2").trim();
	const cookieTokenV2 = fields.getTextInputValue("cookie_token_v2").trim();
	const accountMidV2 = fields.getTextInputValue("account_mid_v2").trim();
	const cookie = `ltoken_v2=${ltokenV2}; ltuid_v2=${ltuidV2}; cookie_token_v2=${cookieTokenV2}; account_mid_v2=${accountMidV2}; account_id_v2=${accountMidV2}; ltmid_v2=${accountMidV2}`;

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
		const gameInfo = await withTimeout(
			getUserGameInfo(cookie),
			20000,
			"驗證超時，請稍後再試"
		);
		const uid = gameInfo.uid;

		// Validate the cookie works for daily check-in (not just game record lookup)
		try {
			const hsr = new HonkaiStarRail({ cookie, uid: parseInt(uid) });
			await withTimeout(hsr.daily.info(), 20000, "驗證超時，請稍後再試");
		} catch (dailyError: any) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("account_CookieSetFailed", { z: uid }))
						.setDescription(
							tr("account_CookieInvalidOrExpired") +
								"\n\n`" +
								(dailyError?.message ?? dailyError) +
								"`"
						)
				]
			});
			return;
		}

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
					.setTitle(
						tr("account_CookieSetSuccess", { z: gameInfo.nickname })
					)
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
	const ltokenV2 = fields.getTextInputValue("ltoken_v2").trim();
	const ltuidV2 = fields.getTextInputValue("ltuid_v2").trim();
	const cookieTokenV2 = fields.getTextInputValue("cookie_token_v2").trim();
	const accountMidV2 = fields.getTextInputValue("account_mid_v2").trim();
	const cookie = `ltoken_v2=${ltokenV2}; ltuid_v2=${ltuidV2}; cookie_token_v2=${cookieTokenV2}; account_mid_v2=${accountMidV2}; account_id_v2=${accountMidV2}; ltmid_v2=${accountMidV2}`;
	const account: Account[] =
		(await database.get(`${interaction.user.id}.account`)) ?? [];

	const index = parseInt(accountIndex);
	const targetAccount = account[index];
	if (!targetAccount) {
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
		const gameInfo = await withTimeout(
			getUserGameInfo(cookie),
			20000,
			"驗證超時，請稍後再試"
		);

		// Validate the cookie works for daily check-in
		try {
			const hsr = new HonkaiStarRail({
				cookie,
				uid: parseInt(gameInfo.uid)
			});
			await withTimeout(hsr.daily.info(), 20000, "驗證超時，請稍後再試");
		} catch (dailyError: any) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(
							tr("account_CookieSetFailed", { z: gameInfo.uid })
						)
						.setDescription(
							tr("account_CookieInvalidOrExpired") +
								"\n\n`" +
								(dailyError?.message ?? dailyError) +
								"`"
						)
				]
			});
			return;
		}

		// 清除過期標記
		await database.delete(`${targetAccount.uid}.cookieExpired`);

		targetAccount.cookie = cookie;
		targetAccount.uid = gameInfo.uid;
		targetAccount.nickname = gameInfo.nickname;
		await database.set(`${interaction.user.id}.account`, account);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(
						tr("account_CookieSetSuccess", {
							z: targetAccount.nickname
						})
					)
			]
		});
	} catch (error: any) {
		console.log(error);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						tr("account_CookieSetFailed", {
							z: `${targetAccount.uid}`
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