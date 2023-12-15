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
						value: "how"
					},
					{
						name: "① Set UID",
						name_localizations: {
							"zh-TW": "① 設定 UID"
						},
						value: "setUid"
					},
					{
						name: "② Set Cookie",
						name_localizations: {
							"zh-TW": "② 設定 Cookie"
						},
						value: "setCookie"
					},
					{
						name: "🔸 View configured account",
						name_localizations: {
							"zh-TW": "🔸 檢視已設定帳號"
						},
						value: "viewSet"
					},
					{
						name: "⚙️ Edit configured account",
						name_localizations: {
							"zh-TW": "⚙️ 編輯已設定帳號"
						},
						value: "editSet"
					},
					{
						name: "❌ Delete configured account",
						name_localizations: {
							"zh-TW": "❌ 刪除已設定帳號"
						},
						value: "delSet"
					}
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const cmd = interaction.options.getString("options");
		const userId = interaction.user.id;

		if (cmd == "viewSet" || cmd == "editSet" || cmd == "delSet") {
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

			await interaction.deferReply({ ephemeral: true });
		}

		const accounts = await db.get(`${interaction.user.id}.account`);

		if (cmd == "how") {
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
		} else if (cmd == "setCookie") {
			if (!(await db.has(`${interaction.user.id}.account`)))
				return await interaction.reply({
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

			return await interaction.reply({
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(`${tr("account_cookieSelectUID")}`)
							.setCustomId("uid_cookieSet")
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
		} else if (cmd == "setUid") {
			await interaction.showModal(
				new ModalBuilder()
					.setCustomId("uid_set")
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
		} else if (cmd == "viewSet") {
			const accounts = await db.get(`${userId}.account`);

			await interaction.editReply({
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
		} else if (cmd == "editSet") {
			return await interaction.editReply({
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("account_editUIDTitle"))
							.setCustomId("uid_edit")
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
		} else if (cmd == "delSet") {
			return await interaction.editReply({
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("account_delUIDTitle"))
							.setCustomId("uid_del")
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
		}
	}
};
