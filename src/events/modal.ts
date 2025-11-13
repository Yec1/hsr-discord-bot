import { client, database } from "@/index.js";
import { AxiosError } from "axios";
import {
	Events,
	EmbedBuilder,
	ModalSubmitInteraction,
	MessageFlags
} from "discord.js";
import { HonkaiStarRail } from "@yeci226/hoyoapi";
import {
	getUserLang,
	requestPlayerDataEnka,
	getUserGameInfo
} from "@/utilities/index.js";
import { createTranslator, toI18nLang } from "@/utilities/core/i18n.js";
import loginAccount from "@/utilities/hsr/login.js";
import type { TranslationFunction } from "@/types/index.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();
interface Account {
	uid: string;
	cookie: string;
	nickname?: string;
}

// 定义游戏信息类型
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

	if (customId.startsWith("accountEdit"))
		await handleAccountEdit(interaction, tr, customId, fields);
	if (customId == "account_LoginAccountModal")
		await handleAccountLogin(interaction, tr, fields);
	if (customId == "account_SetUserIDModal")
		await handleUidSet(interaction, tr, fields);
	if (customId.startsWith("cookie_set"))
		await handleCookieSet(interaction, tr, customId, fields);
});

async function handleAccountLogin(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	fields: any
): Promise<void> {
	const email = fields.getTextInputValue("account_LoginAccountModalField");
	const password = fields.getTextInputValue(
		"account_LoginAccountModalField2"
	);
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		// Make sure Email is correct
		const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
		if (!emailRegex.test(email)) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(tr("account_LoginFailedDesc"))
						.setColor("#E76161")
				]
			});
			return;
		}

		const { cookie, error } = await loginAccount(email, password);
		if (error || !cookie) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(
							`${tr("account_LoginFailedDesc")}\n\n\`${error?.message || "Unknown error"}\``
						)
						.setColor("#E76161")
				]
			});
			return;
		}

		const gameInfo: GameInfo = await getUserGameInfo(cookie);
		const { uid, nickname } = gameInfo;
		if (!uid || !nickname) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(tr("account_LoginFailedDesc"))
						.setColor("#E76161")
				]
			});
			return;
		}
		const existedAccounts: Account[] =
			(await database.get(`${interaction.user.id}.account`)) || [];

		// 清除過期標記
		if (uid) {
			await database.delete(`${uid}.cookieExpired`);
		}

		// 檢查是否已經綁定過這個UID
		const existingAccountIndex = existedAccounts.findIndex(
			account => account.uid == uid
		);

		if (existingAccountIndex !== -1) {
			// 如果已經綁定過，直接更新該帳號的Cookie
			existedAccounts[existingAccountIndex]!.cookie = cookie;
			existedAccounts[existingAccountIndex]!.nickname = nickname;

			await database.set(
				`${interaction.user.id}.account`,
				existedAccounts
			);

			await interaction.editReply({
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
			if (
				!config.DEVIDS.includes(interaction.user.id) &&
				existedAccounts.length >= 5
			) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_LimitExceeded"))
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					]
				});
				return;
			}

			// 添加新帳號
			await database.push(`${interaction.user.id}.account`, {
				uid: uid,
				cookie: cookie,
				nickname: nickname
			});

			await interaction.editReply({
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

async function handleAccountEdit(
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
					.setTitle("Invalid account index")
			]
		});
		return;
	}
	const uid = fields.getTextInputValue("uid");
	const data = await requestPlayerDataEnka(uid);
	if (!data.playerData?.detailInfo?.uid) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("profile_UidNotFound") + " - " + uid)
			]
		});
		return;
	}

	const accounts: Account[] =
		(await database.get(`${interaction.user.id}.account`)) ?? [];

	if (accounts.some(account => account.uid == uid)) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("account_AlreadySet", { z: `${uid}` }))
			]
		});
		return;
	}

	const index = parseInt(accountIndex);
	if (accounts[index]) {
		accounts[index].uid = uid;
	}

	await interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor("#F6F1F1")
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
				)
				.setTitle(tr("account_UidSetSuccess", { z: `${uid}` }))
		]
	});

	await database.set(`${interaction.user.id}.account`, accounts);
}

async function handleUidSet(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	fields: any
): Promise<void> {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const uid = fields.getTextInputValue("account_SetUserIDModalField");
	try {
		const data = await requestPlayerDataEnka(uid);
		if (!data.playerData?.detailInfo?.uid) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("profile_UidNotFound") + " - " + uid)
				]
			});
			return;
		}
	} catch (e) {
		if (e instanceof AxiosError) {
			await interaction.followUp({
				flags: MessageFlags.Ephemeral,
				content: `未知的UID - \`${e}\``
			});
		}
		throw e;
	}

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

		if (accounts.some(account => account.uid == uid)) {
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
	}

	await interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor("#F6F1F1")
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
				)
				.setTitle(`${tr("account_UidSetSuccess", { z: `${uid}` })}`)
		]
	});
	await database.push(`${interaction.user.id}.account`, {
		uid: uid,
		cookie: ""
	});
}

async function handleCookieSet(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	customId: string,
	fields: any
): Promise<void> {
	const accountIndex = customId.split("-")[1];
	if (!accountIndex) {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setTitle("Invalid account index")
			]
		});
		return;
	}
	const ltoken = `ltoken_v2=${fields.getTextInputValue("ltoken")}; ` || "";
	const ltuid = `ltuid_v2=${fields.getTextInputValue("ltuid")}; ` || "";
	const cookieToken =
		`cookie_token_v2=${fields.getTextInputValue("cookieToken")}; ` || "";
	const accountMid =
		`account_mid_v2=${fields.getTextInputValue("accountMid")}; ` || "";
	const cookie = ltoken + ltuid + cookieToken + accountMid;
	const account: Account[] =
		(await database.get(`${interaction.user.id}.account`)) ?? [];

	const index = parseInt(accountIndex);
	if (!account[index]) {
		await interaction.reply({
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
		const hsr = new HonkaiStarRail({ cookie: cookie });
		await hsr.daily.info();

		// 清除過期標記
		await database.delete(`${account[index].uid}.cookieExpired`);

		account[index].cookie = cookie;
		await database.set(`${interaction.user.id}.account`, account);

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(
						tr("account_CookieSetSuccess", {
							z: `${account[index].uid}`
						})
					)
			],
			flags: MessageFlags.Ephemeral
		});
	} catch (error: any) {
		console.log(error);
		await interaction.reply({
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
