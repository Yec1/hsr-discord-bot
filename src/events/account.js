import { client } from "../index.js";
import {
	EmbedBuilder,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	Events,
	StringSelectMenuBuilder
} from "discord.js";
import { i18nMixin, toI18nLang } from "../services/i18n.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { player } from "../services/request.js";

import { AxiosError } from "axios";

const db = client.db;

async function validateCookie(cookie) {
	const re = /[^; \"]{30,}/;
	const reNum = /[0-9]{5,}/;
	const reTokenV2 = /[^; \"]{10,}/;
	const reLtmidV2 = /[^; \"]{5,}/;

	let match;
	let cookie_token = (match = cookie.match(`cookie_token=${re.source}`))
		? match[0]
		: null;
	let account_id = (match = cookie.match(`account_id=${reNum.source}`))
		? match[0]
		: null;
	let ltoken = (match = cookie.match(`ltoken=${re.source}`))
		? match[0]
		: (match = cookie.match(`ltoken_v2=${reLtmidV2.source}`))
		? match[0]
		: null;
	let ltuid = (match = cookie.match(`ltuid=${reNum.source}`))
		? match[0]
		: (match = cookie.match(`ltuid_v2=${reNum.source}`))
		? match[0]
		: null;

	let mi18nLang = (match = cookie.match(`mi18nLang=${re.source}`))
		? match[0]
		: null;

	let cookie_token_v2 = (match = cookie.match(
		`cookie_token_v2=${reTokenV2.source}`
	))
		? match[0]
		: null;
	let account_id_v2 = (match = cookie.match(`account_id_v2=${reNum.source}`))
		? match[0]
		: null;
	let ltoken_v2 = (match = cookie.match(`ltoken_v2=${reTokenV2.source}`))
		? match[0]
		: null;
	let ltuid_v2 = (match = cookie.match(`ltuid_v2=${reNum.source}`))
		? match[0]
		: null;
	let ltmid_v2 = (match = cookie.match(`ltmid_v2=${reLtmidV2.source}`))
		? match[0]
		: null;
	let account_mid_v2 = (match = cookie.match(
		`account_mid_v2=${reLtmidV2.source}`
	))
		? match[0]
		: null;

	let cookie_list = [];

	if (cookie_token && account_id) cookie_list.push(cookie_token, account_id);
	const tokens = [
		ltoken,
		ltuid,
		cookie_token_v2,
		account_id_v2,
		ltoken_v2,
		ltuid_v2,
		ltmid_v2,
		account_mid_v2,
		mi18nLang
	];
	for (let token of tokens) if (token !== null) cookie_list.push(token);
	return cookie_list.length === 0 ? null : cookie_list.join(" ");
}


client.on(Events.InteractionCreate, async interaction => {
	const tr = i18nMixin(
		(await db.has(`${interaction.user.id}.locale`))
			? await db.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	if (interaction.isStringSelectMenu()) {
		if (!interaction.customId.startsWith("uid")) return;

		if (!(await db.has(`${interaction.user.id}.account`)))
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("account_nonAcc")}`)
				],
				ephemeral: true
			});

		if (interaction.customId == "uid_edit") {
			await interaction.update({ fetchReply: true }).catch(() => {});
			const i = interaction.values[0];

			await interaction.editReply({
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("account_selectEdit"))
							.setCustomId("uid_edit2")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								{
									label: "UID",
									value: `uid-${i}`
								},
								{
									label: "Cookie",
									value: `cookie-${i}`
								}
							)
					)
				],
				ephemeral: true
			});
			return;
		} else if (interaction.customId == "uid_edit2") {
			const [option, i] = interaction.values[0].split("-");

			if (option == "cookie")
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId(`cookie_set-${i}`)
						.setTitle(tr("cookie_set"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("cookie")
									.setLabel(tr("cookie_paste"))
									.setPlaceholder("Cookie")
									.setStyle(TextInputStyle.Paragraph)
									.setRequired(false)
									.setMinLength(50)
									.setMaxLength(2000)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("ltoken")
									.setLabel(tr("cookie_ltoken"))
									.setPlaceholder("v2_...")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(10)
									.setMaxLength(1000)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("ltuid")
									.setLabel(tr("cookie_ltuid"))
									.setPlaceholder("30...")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(1)
									.setMaxLength(30)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("cookie_token")
									.setLabel("CookieToken")
									.setPlaceholder("v2_...")
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMinLength(10)
									.setMaxLength(1000)
							)
						)
				);
			if (option == "uid")
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId(`uidEdit-${i}`)
						.setTitle(tr("account_uidTitle"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId("uid")
									.setLabel(tr("account_uidDesc"))
									.setPlaceholder("e.g. 809279679")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
									.setMinLength(9)
									.setMaxLength(10)
							)
						)
				);
		} else if (interaction.customId == "uid_del") {
			await interaction.update({ fetchReply: true }).catch(() => {});

			const i = interaction.values[0];

			const accounts =
				(await db.get(`${interaction.user.id}.account`)) ?? "";
			const uid = accounts[i].uid;

			if (accounts.length <= 1)
				await db.delete(`${interaction.user.id}.account`);
			else {
				accounts.splice(i, 1);
				await db.set(`${interaction.user.id}.account`, accounts);
			}

			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(`${tr("account_del")} \`${uid}\``)
				],
				components: [],
				ephemeral: true
			});
		} else if (interaction.customId == "uid_cookieSet") {
			const i = interaction.values[0];

			await interaction.showModal(
				new ModalBuilder()
					.setCustomId(`cookie_set-${i}`)
					.setTitle(tr("cookie_set"))
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("cookie")
								.setLabel(tr("cookie_paste"))
								.setPlaceholder("Cookie")
								.setStyle(TextInputStyle.Paragraph)
								.setRequired(false)
								.setMinLength(50)
								.setMaxLength(2000)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("ltoken")
								.setLabel(tr("cookie_ltoken"))
								.setPlaceholder("v2_...")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(10)
								.setMaxLength(1000)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("ltuid")
								.setLabel(tr("cookie_ltuid"))
								.setPlaceholder("30...")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(1)
								.setMaxLength(30)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("cookie_token")
								.setLabel("CookieToken")
								.setPlaceholder("v2_...")
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
								.setMinLength(10)
								.setMaxLength(1000)
						)
					)
			);
		}
	}

	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith("cookie_set")) {
			const i = interaction.customId.split("-")[1];
			const ltoken = interaction.fields.getTextInputValue("ltoken") || "";
			const ltuid = interaction.fields.getTextInputValue("ltuid") || "";
			const cookie_token =
				interaction.fields.getTextInputValue("cookie_token") || "";
			const cookie =
				interaction.fields.getTextInputValue("cookie") ||
				`ltoken_v2=${ltoken}; ltuid_v2=${ltuid}${
					cookie_token ? `; cookie_token_v2=${cookie_token}` : ""
				}`;

			const trimed_cookie = await validateCookie(cookie);

			if (trimed_cookie == null)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(`${tr("cookie_failed")}`)
					],
					ephemeral: true
				});

			try {
				const hsr = new HonkaiStarRail({
					cookie: cookie,
					lang: (await db?.has(`${interaction.user.id}.locale`))
						? (await db?.get(`${interaction.user.id}.locale`)) ==
							"tw"
							? LanguageEnum.TRADIIONAL_CHINESE
							: LanguageEnum.ENGLISH
						: interaction.locale == "zh-TW"
							? LanguageEnum.TRADIIONAL_CHINESE
							: LanguageEnum.ENGLISH
				});

				await hsr.daily.info();
				const account =
					(await db.get(`${interaction.user.id}.account`)) ?? "";

				account[i].cookie = cookie;
				await db.set(`${interaction.user.id}.account`, account);

				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#F6F1F1")
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
							)
							.setTitle(
								tr("cookie_sus", {
									z: `${account[i].uid}`
								})
							)
					],
					ephemeral: true
				});
			} catch (e) {
				replyOrfollowUp(interaction, {
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("cookie_failed"))
							.setDescription(`${tr("err_code")}${e}`)
					],
					ephemeral: true
				});
			}
		} else if (interaction.customId == "card_set") {
			await interaction.deferUpdate().catch(() => {});
			const userdb = await db.get(`${interaction.user.id}`);
			const bg = interaction.fields.getTextInputValue("bg");
			const image = interaction.fields.getTextInputValue("image");

			if (userdb?.premium && bg) {
				try {
					await interaction.followUp({
						embeds: [
							new EmbedBuilder()
								.setTitle(tr("card_setBG"))
								.setDescription(`${tr("card_setDesc")}`)
								.setThumbnail(
									"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
								)
								.setImage(bg)
						],
						ephemeral: true
					});

					await db.set(`${interaction.user.id}.bg`, bg);
				} catch (e) {}
			} else if (userdb?.premium && bg == "" && userdb?.bg) {
				await interaction.followUp({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("card_delete"))
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
							)
					],
					ephemeral: true
				});

				await db.delete(`${interaction.user.id}.bg`);
			}

			if (image) {
				try {
					await interaction.followUp({
						embeds: [
							new EmbedBuilder()
								.setTitle(tr("card_setImage"))
								.setDescription(`${tr("card_setDesc")}`)
								.setThumbnail(
									"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
								)
								.setImage(image)
						],
						ephemeral: true
					});

					await db.set(`${interaction.user.id}.image`, image);
				} catch (e) {}
			} else if (image == "" && userdb?.image) {
				await interaction.followUp({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("card_delete"))
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
							)
					],
					ephemeral: true
				});

				await db.delete(`${interaction.user.id}.image`);
			}
		} else if (interaction.customId.startsWith("uidEdit")) {
			await interaction.deferReply({ ephemeral: true });

			const i = interaction.customId.split("-")[1];
			const uid = interaction.fields.getTextInputValue("uid");
			const playerData = await player(uid, interaction);

			if (playerData.detail == "Invalid uid")
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(
								tr("profile_failed", {
									z: `\`${uid}\``
								})
							)
					]
				});

			const accounts =
				(await db.get(`${interaction.user.id}.account`)) ?? "";

			if (accounts.some(account => account.uid == uid))
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(`${tr("account_alreadySet")}`)
					]
				});

			accounts[i].uid = uid;

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(`${tr("uid_sus")} \`${uid}\`！`)
				]
			});

			await db.set(`${interaction.user.id}.account`, accounts);
		} else if (interaction.customId == "uid_set") {
			await interaction.deferReply({ ephemeral: true });

			const uid = interaction.fields.getTextInputValue("uid");
			try {
				const playerData = await player(uid, interaction);
				if (playerData.detail == "Invalid uid")
					return await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setConfig("#E76161")
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(
									tr("profile_failed", {
										z: `\`${uid}\``
									})
								)
						]
					});
			} catch (e) {
				if (e instanceof AxiosError) {
					await interaction.followUp({
						ephemeral: true,
						content: `未知的UID`,
					})
				}
				throw e;
			}

			if (await db.has(`${interaction.user.id}.account`)) {
				if ((await db.get(`${interaction.user.id}.account`)).length > 3)
					return await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setConfig("#E76161")
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(`${tr("account_limit")}`)
						]
					});

				const accounts = await db.get(`${interaction.user.id}.account`);

				if (accounts.some(account => account.uid == uid))
					return await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setConfig("#E76161")
								.setThumbnail(
									"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
								)
								.setTitle(`${tr("account_alreadySet")}`)
						]
					});
			}

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#F6F1F1")
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
						)
						.setTitle(`${tr("uid_sus")} \`${uid}\`！`)
				]
			});
			await db.push(`${interaction.user.id}.account`, {
				uid: uid,
				cookie: ""
			});
		}
	}
});
