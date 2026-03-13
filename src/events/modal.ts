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

import { VerificationServer } from "@/utilities/core/VerificationServer.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextInputBuilder
} from "discord.js";

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

		const loginRes = await loginAccount(email, password);

		if (loginRes.captcha) {
			// loginRes.data is the aigisData from x-rpc-aigis header
			const captchaData =
				loginRes.data?.data?.captcha || loginRes.data?.captcha;

			if (!captchaData) {
				console.error(
					"[Login] Invalid captcha data structure:",
					loginRes.data
				);
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_LoginFailed"))
							.setDescription(
								`${tr("account_LoginFailedDesc")}\n\n驗證碼資料格式錯誤，請稍後再試。`
							)
							.setColor("#E76161")
					]
				});
				return;
			}

			console.log(
				"[Modal] Captcha Data:",
				JSON.stringify(captchaData, null, 2)
			);
			const {
				geetestId,
				riskType,
				risk_type, // Capture the raw v4 string
				challenge,
				success,
				new_captcha,
				aigisSessionId
			} = captchaData;
			const sessionId = Math.random().toString(36).substring(2, 12);

			// If challenge is undefined/empty, it's likely Geetest v4 (mmt_type: 2)
			// But we should respect the server's original mmt_type (riskType)
			// when sending data back in the Aigis header.
			const finalRiskType = riskType;
			const config = (
				await import("@/utilities/core/config.js")
			).loadConfig();
			const baseUrl =
				(config as any).VERIFY_PUBLIC_URL ||
				`http://localhost:${config.WEBSERVER_PORT || 3000}`;

			// Generate a fake challenge UUID if missing (required for v4 init)
			// Simple UUID v4 generator
			const generatedChallenge =
				"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
					/[xy]/g,
					function (c) {
						const r = (Math.random() * 16) | 0,
							v = c == "x" ? r : (r & 0x3) | 0x8;
						return v.toString(16);
					}
				);

			const finalChallenge =
				challenge && challenge !== "undefined"
					? challenge
					: generatedChallenge;

			const params = new URLSearchParams({
				captchaId: geetestId,
				challenge: finalChallenge,
				session: sessionId
			});
			if (finalRiskType)
				params.append("riskType", finalRiskType.toString());
			if (risk_type) params.append("risk_type", risk_type); // Append the raw v4 string
			if (success !== undefined)
				params.append("success", success.toString());
			if (new_captcha !== undefined)
				params.append("new_captcha", new_captcha.toString());
			if (aigisSessionId) params.append("aigisSessionId", aigisSessionId);

			const verifyUrl = `${baseUrl}/verify?${params.toString()}`;

			VerificationServer.onResult(
				sessionId,
				async (captchaResult: any) => {
					try {
						const retryRes = await loginAccount(
							email,
							password,
							captchaResult
						);
						if (retryRes && (retryRes as any).captcha) {
							await interaction.followUp({
								content: "❌ 驗證逾期或失敗，請重新嘗試登入。",
								flags: MessageFlags.Ephemeral
							});
						} else if (retryRes) {
							await finalizeLogin(interaction, retryRes, tr);
						}
					} catch (e: any) {
						console.error("[Login] Captcha auto-retry failed:", e);
						await interaction.followUp({
							content: `❌ 驗證後登入失敗：\`${e.message}\``,
							flags: MessageFlags.Ephemeral
						});
					}
				}
			);

			const verifyBtn = new ButtonBuilder()
				.setLabel("進行驗證 (Verify)")
				.setURL(verifyUrl)
				.setStyle(ButtonStyle.Link);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				verifyBtn
			);

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("需要進行安全驗證")
						.setDescription(
							"為了保護您的帳號安全，請點擊下方按鈕在瀏覽器中完成 Geetest 驗證。驗證完成後，機器人將會自動繼續登入流程。"
						)
						.setColor("#FFE9D0")
				],
				components: [row as any]
			});
			return;
		}

		await finalizeLogin(interaction, loginRes, tr);
	} catch (error: any) {
		console.log(error);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("account_LoginFailed"))
					.setDescription(
						`${tr("account_LoginFailedDesc")}\n\n\`${error.message}\``
					)
					.setColor("#E76161")
			]
		});
	}
}

async function finalizeLogin(
	interaction: any,
	loginData: any,
	tr: TranslationFunction
) {
	const { cookie } = loginData;
	const gameInfo: GameInfo = await getUserGameInfo(cookie);
	const { uid, nickname } = gameInfo;

	if (!uid || !nickname) {
		const embed = new EmbedBuilder()
			.setTitle(tr("account_LoginFailed"))
			.setDescription(tr("account_LoginFailedDesc"))
			.setColor("#E76161");

		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [embed], components: [] });
		} else {
			await interaction.reply({
				embeds: [embed],
				flags: MessageFlags.Ephemeral
			});
		}
		return;
	}

	const existedAccounts: Account[] =
		(await database.get(`${interaction.user.id}.account`)) || [];

	await database.delete(`${uid}.cookieExpired`);

	const existingAccountIndex = existedAccounts.findIndex(
		account => account.uid == uid
	);

	if (existingAccountIndex !== -1) {
		existedAccounts[existingAccountIndex]!.cookie = cookie;
		existedAccounts[existingAccountIndex]!.nickname = nickname;
		await database.set(`${interaction.user.id}.account`, existedAccounts);

		const embed = new EmbedBuilder()
			.setColor("#F6F1F1")
			.setThumbnail(
				"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
			)
			.setTitle(tr("account_LoginSuccess"))
			.setDescription(tr("account_LoginSuccessDesc", { z: `${uid}` }));

		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [embed], components: [] });
		} else {
			await interaction.reply({
				embeds: [embed],
				flags: MessageFlags.Ephemeral
			});
		}
	} else {
		if (
			!config.DEVIDS.includes(interaction.user.id) &&
			existedAccounts.length >= 5
		) {
			const embed = new EmbedBuilder()
				.setTitle(tr("account_LimitExceeded"))
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
				);

			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({
					embeds: [embed],
					components: []
				});
			} else {
				await interaction.reply({
					embeds: [embed],
					flags: MessageFlags.Ephemeral
				});
			}
			return;
		}

		await database.push(`${interaction.user.id}.account`, {
			uid: uid,
			cookie: cookie,
			nickname: nickname
		});

		const embed = new EmbedBuilder()
			.setColor("#F6F1F1")
			.setThumbnail(
				"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
			)
			.setTitle(tr("account_LoginSuccess"));

		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [embed], components: [] });
		} else {
			await interaction.reply({
				embeds: [embed],
				flags: MessageFlags.Ephemeral
			});
		}
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
	if (!(data.playerData?.player?.uid || data.playerData?.detailInfo?.uid)) {
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
		if (
			!(data.playerData?.player?.uid || data.playerData?.detailInfo?.uid)
		) {
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
