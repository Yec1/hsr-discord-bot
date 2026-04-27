import { client, database } from "@/index.js";
import { AxiosError } from "axios";
import {
	Events,
	EmbedBuilder,
	ModalSubmitInteraction,
	MessageFlags,
	ActionRowBuilder,
	ButtonInteraction
} from "discord.js";
import { AuthClient, HonkaiStarRail } from "@yeci226/hoyoapi";
import type { IAuthLoginResult } from "@yeci226/hoyoapi";
import { VerificationServer } from "@/utilities/core/VerificationServer.js";
import { sessionStatuses } from "@/server.js";
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

/**
 * Call the Vercel proxy to perform loginByPassword.
 * Falls back to direct AuthClient call if PROXY_API_URL is not set.
 */
async function proxyLoginByPassword(opts: {
	account: string;
	password: string;
	aigisHeaderObject?: string;
	deviceId?: string;
}): Promise<IAuthLoginResult> {
	const proxyUrl = config.PROXY_API_URL;
	if (proxyUrl) {
		const res = await fetch(`${proxyUrl}/api/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.PROXY_API_TOKEN}`,
			},
			body: JSON.stringify(opts),
		});
		const data = await res.json() as IAuthLoginResult;
		return data;
	}
	// Fallback: direct call (no IP protection)
	const { AuthClient } = await import("@yeci226/hoyoapi");
	const auth = new AuthClient();
	return auth.loginByPassword(opts);
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(errorMsg)), ms)
		),
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
		(await getUserLang(interaction.user.id)) || toI18nLang(interaction.locale) || "en"
	);

	const { customId, fields } = interaction;

	if (customId === "cookie_set_new") {
		await handleNewCookieSet(interaction, tr, fields);
	} else if (customId === "cookie_login_password") {
		await handlePasswordLogin(interaction, tr, fields);
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
			const hsr = new HonkaiStarRail({ cookie, uid: parseInt(gameInfo.uid) });
			await withTimeout(hsr.daily.info(), 20000, "驗證超時，請稍後再試");
		} catch (dailyError: any) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("account_CookieSetFailed", { z: gameInfo.uid }))
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
					.setTitle(tr("account_CookieSetSuccess", { z: targetAccount.nickname }))
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

async function handlePasswordLogin(
	interaction: ModalSubmitInteraction,
	tr: TranslationFunction,
	fields: any,
	aigisHeader?: string,
	authArgs?: { account: string; password: string; deviceId?: string },
	sessionId?: string
): Promise<void> {
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}

	const account = authArgs?.account || (fields as any).getTextInputValue("account") || "";
	const password = authArgs?.password || (fields as any).getTextInputValue("password") || "";

	const result = await proxyLoginByPassword({
		account,
		password,
		...(aigisHeader !== undefined && { aigisHeaderObject: aigisHeader }),
		...(authArgs?.deviceId !== undefined && { deviceId: authArgs.deviceId }),
	});

	// 若本次登入流程有帳密，且遇到 require_geetest，暫存 userId <-> temp_cookie 到 quick.db
	const tempCookie = (result as any).temp_cookie;
	if (typeof result !== 'undefined' && result.status === "require_geetest" && account && password && tempCookie) {
		try {
			await database.set(`${interaction.user.id}.temp_cookie`, tempCookie);
		} catch (e) {
			console.error("[Geetest Debug] 無法暫存臨時 temp_cookie 到 DB:", e);
		}
	}

	if (result.status === "success" && result.cookies) {
		// Reuse logic to get game info and save
		try {
			const gameInfo = await getUserGameInfo(result.cookies);
			const uid = gameInfo.uid;

			const accounts: Account[] =
				(await database.get(`${interaction.user.id}.account`)) || [];

			const existingIndex = accounts.findIndex(acc => acc.uid === uid);
			if (existingIndex !== -1) {
				const existingAccount = accounts[existingIndex];
				if (existingAccount) {
					existingAccount.cookie = result.cookies;
					existingAccount.nickname = gameInfo.nickname;
				}
			} else {
				if (
					!config.DEVIDS.includes(interaction.user.id) &&
					accounts.length >= 5
				) {
					if (sessionId) sessionStatuses.set(sessionId, { status: "error", message: tr("account_LimitExceeded") });
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle(`${tr("account_LimitExceeded")} `)
						]
					});
					return;
				}
				accounts.push({
					uid: gameInfo.uid,
					nickname: gameInfo.nickname,
					cookie: result.cookies
				});
			}

			await database.set(`${interaction.user.id}.account`, accounts);

			if (sessionId) sessionStatuses.set(sessionId, { status: "done" });

			await interaction.editReply({
				content: null,
				components: [],
				embeds: [
					new EmbedBuilder()
						.setColor("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(
							tr("account_LoginSuccess", { z: gameInfo.nickname })
						)
						.setDescription(
							tr("account_LoginSuccessDesc", { z: gameInfo.uid })
						)
				]
			});
		} catch (e: any) {
			if (sessionId) sessionStatuses.set(sessionId, { status: "error", message: e.message });
			await interaction.editReply({
				content: null,
				components: [],
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("account_LoginFailed"))
						.setDescription(e.message)
						.setColor("#E76161")
				]
			});
		}
	} else if (result.status === "require_geetest") {
		console.log("[Geetest Debug] require_geetest result:", result);
		// Reuse the existing page session if one is active; otherwise create a new one
		const geetestSessionId = sessionId ?? randomUUID();
		let aigisData = (result.aigis_data || {}) as any;
		// 若 aigisData 為空，嘗試自動解析 aigis_header（格式為 "mmtType;base64Json"）
		if ((!aigisData || Object.keys(aigisData).length === 0) && result.aigis_header) {
			try {
				const parts = result.aigis_header.split(";");
				if (parts.length >= 2 && parts[1]) {
					const decoded = Buffer.from(parts[1], "base64").toString("utf8");
					const headerObj = JSON.parse(decoded);
					const inner = typeof headerObj.data === "string"
						? JSON.parse(headerObj.data)
						: (headerObj.data ?? {});
					aigisData = {
						...inner,
						session_id: headerObj.session_id,
						mmt_type: headerObj.mmt_type ?? parseInt(parts[0] ?? "2", 10),
						risk_type: inner.risk_type || "",
						gt: inner.gt || "",
						challenge: inner.challenge || "",
						new_captcha: inner.new_captcha ?? true
					};
				}
			} catch (e) {
				console.error("[Geetest Debug] Failed to parse aigis_header:", e);
				aigisData = {};
			}
		}
		const aigisHeaderRaw = result.aigis_header;

		if (!sessionId) {
			// First Geetest step — no page open yet, send a Discord button
			const webUrl =
				(config as any).WEBSITE_URL ||
				`http://localhost:${config.WEBSERVER_PORT || 3000}`;
			const verifyUrl = new URL(`${webUrl}/hsr/verify`);
			verifyUrl.searchParams.set("session", geetestSessionId);
			verifyUrl.searchParams.set("userid", interaction.user.id);
			verifyUrl.searchParams.set("captchaId", aigisData.gt || aigisData.captcha_id || "");
			verifyUrl.searchParams.set("challenge", aigisData.challenge || "");
			verifyUrl.searchParams.set("riskType", aigisData.mmt_type?.toString() || "2");
			verifyUrl.searchParams.set("risk_type", aigisData.risk_type || "");
			verifyUrl.searchParams.set("new_captcha", aigisData.new_captcha?.toString() || "true");
			verifyUrl.searchParams.set("aigisSessionId", aigisData.session_id || "");
			verifyUrl.searchParams.set("use_v4", aigisData.use_v4 ? "true" : "false");

			console.log("[Geetest Debug] verifyUrl:", verifyUrl.toString());

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("前往驗證")
					.setURL(verifyUrl.toString())
					.setStyle(ButtonStyle.Link)
			);
			await interaction.editReply({
				content: "⚠️ 此登入需要進行人機驗證，請點擊下方按鈕前往驗證頁面。",
				embeds: [],
				components: [row]
			});
		} else {
			// Subsequent Geetest — user is already on the verify page;
			// update session status so the page can re-initialize Geetest inline.
			sessionStatuses.set(geetestSessionId, {
				status: "needs_geetest",
				captchaId: aigisData.gt || aigisData.captcha_id || "",
				challenge: aigisData.challenge || "",
				riskType: aigisData.mmt_type?.toString() || "2",
				risk_type: aigisData.risk_type || "",
				new_captcha: aigisData.new_captcha?.toString() || "true",
				aigisSessionId: aigisData.session_id || "",
				use_v4: aigisData.use_v4 ? "true" : "false"
			});
		}

		// Listen for result
		VerificationServer.onResult(geetestSessionId, async (verificationResult: any) => {
			console.log("[Geetest Debug] verificationResult (raw from callback):", JSON.stringify(verificationResult));
			// Extract mmt_type: handle both "1;base64..." and direct JSON formats
			let mmtType = "2";
			if (aigisHeaderRaw) {
				if (aigisHeaderRaw.trimStart().startsWith("{")) {
					try { mmtType = String(JSON.parse(aigisHeaderRaw).mmt_type ?? 2); } catch {}
				} else {
					mmtType = aigisHeaderRaw.split(";")[0] ?? "2";
				}
			}

			// Build result data for the aigis header
			let resultData: any;
			if (aigisData.use_v4) {
				// v4: only include geetest solve fields; session_id stays in outer JSON only
				resultData = {
					captcha_id: verificationResult.captcha_id || aigisData.gt,
					lot_number: verificationResult.lot_number,
					pass_token: verificationResult.pass_token,
					gen_time: verificationResult.gen_time,
					captcha_output: verificationResult.captcha_output,
				};
			} else {
				// v3: spread all fields and add success markers
				resultData = { ...verificationResult };
				if (mmtType === "1") {
					resultData.success = 1;
					resultData.new_captcha = aigisData.new_captcha ?? true;
				}
			}

			// Correct format (from genshin.py source):
			// session_id;base64(JSON(mmt_data))
			const finalAigisHeader = `${aigisData.session_id};${Buffer.from(JSON.stringify(resultData)).toString("base64")}`;
			console.log("[Geetest Debug] resultData:", JSON.stringify(resultData));
			console.log("[Geetest Debug] finalAigisHeader:", finalAigisHeader);

			// Retry login with verification result, always passing geetestSessionId so
			// any follow-up step (email verify, another geetest) updates the same page session.
			await handlePasswordLogin(
				interaction,
				tr,
				fields,
				finalAigisHeader,
				{ account, password, ...(result.deviceId !== undefined && { deviceId: result.deviceId }) },
				geetestSessionId
			);
		});
	} else if ((result as any).status === "require_email_verify") {
		// HoYoverse auto-sends the code on -3239, so sendVerificationCode is just a resend.
		// If it fails (e.g. retcode -3101 requires Geetest to resend), the user still has the code —
		// proceed to the email input UI regardless.
		const auth2 = new AuthClient();
		const sendResult = await auth2.sendVerificationCode((result as any).action_ticket, (result as any).deviceId ?? "");
		if (sendResult.status === "rate_limited") {
			if (sessionId) sessionStatuses.set(sessionId, { status: "error", message: "驗證碼請求次數過多，請稍後再試。" });
			await interaction.editReply({
				content: null, components: [],
				embeds: [
					new EmbedBuilder()
						.setTitle("⏳ 請求過於頻繁")
						.setDescription("驗證碼請求次數已達上限，請等待數分鐘後再重新嘗試。")
						.setColor("#F59E0B")
				]
			});
			return;
		}
		// For other errors (including -3101 Geetest required for resend), fall through —
		// the code was already sent by HoYoverse automatically.

		const actionTicket = (result as any).action_ticket;
		const loginDeviceId = (result as any).deviceId;

		if (sessionId) {
			// Signal verify.html to show email input (same page, same session)
			sessionStatuses.set(sessionId, { status: "needs_email_verify" });

			const registerEmailHandler = () => {
				VerificationServer.onResult(sessionId, async (emailResult: any) => {
					const code: string = emailResult.code;
					// Clear stale state so polls get "processing" while we verify
					sessionStatuses.set(sessionId, { status: "processing" });
					const auth3 = new AuthClient();
					const verifyResult = await auth3.verifyActionTicket(actionTicket, code, loginDeviceId ?? "");
					if (verifyResult.status === "error") {
						// Let user retry: reset status and re-register
						sessionStatuses.set(sessionId, { status: "needs_email_verify", error: verifyResult.message });
						registerEmailHandler();
						return;
					}
					// Retry login with same device_id
					await handlePasswordLogin(interaction, tr, fields, undefined, {
						account,
						password,
						...(loginDeviceId !== undefined && { deviceId: loginDeviceId }),
					}, sessionId);
				});
			};
			registerEmailHandler();
		} else {
			// Direct email verify (no prior Geetest session) — create a new standalone session
			const emailSessionId = randomUUID();
			VerificationServer.registerSession(emailSessionId);
			sessionStatuses.set(emailSessionId, { status: "needs_email_verify" });

			const webUrl =
				(config as any).WEBSITE_URL ||
				`http://localhost:${config.WEBSERVER_PORT || 3000}`;
			// Use verify.html without captcha params; the page will detect needs_email_verify via polling
			const emailVerifyUrl = `${webUrl}/hsr/verify?session=${emailSessionId}`;

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("前往電子郵件驗證")
					.setURL(emailVerifyUrl)
					.setStyle(ButtonStyle.Link)
			);

			await interaction.editReply({
				content: "📧 此登入需要電子郵件驗證，請點擊下方按鈕前往驗證頁面輸入驗證碼。",
				embeds: [],
				components: [row]
			});

			const registerEmailHandler = () => {
				VerificationServer.onResult(emailSessionId, async (emailResult: any) => {
					const code: string = emailResult.code;
					sessionStatuses.set(emailSessionId, { status: "processing" });
					const auth3 = new AuthClient();
					const verifyResult = await auth3.verifyActionTicket(actionTicket, code, loginDeviceId ?? "");
					if (verifyResult.status === "error") {
						sessionStatuses.set(emailSessionId, { status: "needs_email_verify", error: verifyResult.message });
						registerEmailHandler();
						return;
					}
					await handlePasswordLogin(interaction, tr, fields, undefined, {
						account,
						password,
						...(loginDeviceId !== undefined && { deviceId: loginDeviceId }),
					}, emailSessionId);
				});
			};
			registerEmailHandler();
		}
	} else if ((result as any).status === "rate_limited") {
		if (sessionId) sessionStatuses.set(sessionId, { status: "error", message: "驗證碼請求次數過多，請稍後再試。" });
		await interaction.editReply({
			content: null, components: [],
			embeds: [
				new EmbedBuilder()
					.setTitle("⏳ 請求過於頻繁")
					.setDescription("驗證碼請求次數已達上限，請等待數分鐘後再重新嘗試登入。")
					.setColor("#F59E0B")
			]
		});
	} else {
		if (sessionId) sessionStatuses.set(sessionId, { status: "error", message: result.message || "未知錯誤" });
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(tr("account_LoginFailed"))
					.setDescription(result.message || "未知錯誤")
					.setColor("#E76161")
			]
		});
	}
}

