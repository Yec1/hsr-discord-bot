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
import { trimCookie } from "../services/cookie.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { player } from "../services/request.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

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

			return await interaction.editReply({
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
									.setRequired(true)
									.setMinLength(50)
									.setMaxLength(2000)
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

			return await interaction.editReply({
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
								.setRequired(true)
								.setMinLength(50)
								.setMaxLength(2000)
						)
					)
			);
		}
	}

	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith("cookie_set")) {
			const i = interaction.customId.split("-")[1];
			const cookie = interaction.fields.getTextInputValue("cookie");

			const trimed_cookie = await trimCookie(cookie);

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
