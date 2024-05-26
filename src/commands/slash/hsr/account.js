import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	StringSelectMenuBuilder
} from "discord.js";

import {
	USER_ID_FIELD,
	SET_USER_ID_MODAL,
	SET_COOKIE_SELECT_MENU,
	EDIT_CONFIGURED_ACCOUNT_SELECT_MENU,
	DELETE_CONFIGURED_ACCOUNT_SELECT_MENU
} from "../../../services/account.js";

const HOW_TO_SET_UP_ACCOUNT = "how";
const SET_USER_ID = "set_Uid";
const SET_COOKIE = "setCookie";
const VIEW_ON_CONFIGURED_ACCOUNT = "viewSet";
const EDIT_CONFIGURED_ACCOUNT = "editSet";
const DELETE_CONFIGURED_ACCOUNT = "delSet";

export default {
	data: new SlashCommandBuilder()
		.setName("account")
		.setDescription("Setting, view, delete account")
		.setNameLocalizations({
			"zh-TW": "帳號"
		})
		.setDescriptionLocalizations({
			"zh-TW": "設置, 檢視, 刪除帳號"
		})
		.addStringOption(option =>
			option
				.setName("options")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "選項"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(true)
				.addChoices(
					{
						name: "❓ How to set up account",
						name_localizations: {
							"zh-TW": "❓ 如何設定帳號"
						},
						value: HOW_TO_SET_UP_ACCOUNT
					},
					{
						name: "① Set UID",
						name_localizations: {
							"zh-TW": "① 設定 UID"
						},
						value: SET_USER_ID
					},
					{
						name: "② Set Cookie",
						name_localizations: {
							"zh-TW": "② 設定 Cookie"
						},
						value: SET_COOKIE
					},
					{
						name: "🔸 View configured account",
						name_localizations: {
							"zh-TW": "🔸 檢視已設定帳號"
						},
						value: VIEW_ON_CONFIGURED_ACCOUNT
					},
					{
						name: "⚙️ Edit configured account",
						name_localizations: {
							"zh-TW": "⚙️ 編輯已設定帳號"
						},
						value: EDIT_CONFIGURED_ACCOUNT
					},
					{
						name: "❌ Delete configured account",
						name_localizations: {
							"zh-TW": "❌ 刪除已設定帳號"
						},
						value: DELETE_CONFIGURED_ACCOUNT
					}
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(_client, interaction, _args, tr, db, emoji) {
		const cmd = interaction.options.getString("options");
		const userId = interaction.user.id;

		if (
			cmd == VIEW_ON_CONFIGURED_ACCOUNT ||
			cmd == EDIT_CONFIGURED_ACCOUNT ||
			cmd == DELETE_CONFIGURED_ACCOUNT
		) {
			if (!(await db.has(`${userId}.account`)))
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

			await interaction.deferReply({ ephemeral: true }).catch(() => {});
		}

		const accounts = await db.get(`${userId}.account`);

		switch (cmd) {
			case HOW_TO_SET_UP_ACCOUNT:
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setTitle(tr("cookie_how"))
							.setImage(
								"https://media.discordapp.net/attachments/1149960935654559835/1185194443322687528/cookieT.png"
							)
							.setDescription(tr("cookie_desc"))
					],
					ephemeral: true
				});

				await interaction.followUp({
					content: "java+script: document.write(document.cookie)",
					ephemeral: true
				});
				return;
			case SET_COOKIE:
				if (await db.has(`${interaction.user.id}.account`)) {
					const accounts = await db.get(
						`${interaction.user.id}.account`
					);
					await interaction.reply({
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder()
									.setPlaceholder(
										`${tr("account_cookieSelectUID")}`
									)
									.setCustomId(SET_COOKIE_SELECT_MENU)
									.setMinValues(1)
									.setMaxValues(1)
									.addOptions(
										accounts.map((account, i) => ({
											emoji: `${emoji.avatarIcon}`,
											label: `${account.uid}`,
											value: `${i}`
										}))
									)
							)
						],
						ephemeral: true
					});
					return;
				}
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(`${tr("account_setUID")}`)
					],
					ephemeral: true
				});
				return;

			case SET_USER_ID:
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId(SET_USER_ID_MODAL)
						.setTitle(tr("account_uidTitle"))
						.addComponents(
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId(USER_ID_FIELD)
									.setLabel(tr("account_uidDesc"))
									.setPlaceholder("e.g. 809279679")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
									.setMinLength(9)
									.setMaxLength(10)
							)
						)
				);
				return;
			case VIEW_ON_CONFIGURED_ACCOUNT:
				interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setAuthor({
								name: `${interaction.user.username} ${tr(
									"account_listAcc"
								)}`,
								iconURL: `${interaction.user.displayAvatarURL({
									size: 4096,
									dynamic: true
								})}`
							})
							.addFields(
								...accounts.map(account => ({
									name: `${emoji.avatarIcon} ${account.uid}`,
									value: `${
										account.cookie
											? `🔗 \`${tr("account_linked")}\``
											: `❌ \`${tr("account_nolink")}\``
									}`,
									inline: true
								}))
							)
					]
				});
				return;
			case EDIT_CONFIGURED_ACCOUNT:
				interaction.editReply({
					components: [
						new ActionRowBuilder().addComponents(
							new StringSelectMenuBuilder()
								.setPlaceholder(tr("account_editUIDTitle"))
								.setCustomId(
									EDIT_CONFIGURED_ACCOUNT_SELECT_MENU
								)
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									accounts.map((account, i) => {
										return {
											emoji: `${emoji.avatarIcon}`,
											label: `${account.uid}`,
											value: `${i}`
										};
									})
								)
						)
					],
					ephemeral: true
				});
				return;
			case DELETE_CONFIGURED_ACCOUNT:
				interaction.editReply({
					components: [
						new ActionRowBuilder().addComponents(
							new StringSelectMenuBuilder()
								.setPlaceholder(tr("account_delUIDTitle"))
								.setCustomId(
									DELETE_CONFIGURED_ACCOUNT_SELECT_MENU
								)
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									accounts.map((account, i) => ({
										emoji: `${emoji.avatarIcon}`,
										label: `${account.uid}`,
										value: `${i}`
									}))
								)
						)
					],
					ephemeral: true
				});
				return;
		}
	}
};
