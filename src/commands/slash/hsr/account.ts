import {
	AttachmentBuilder,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	StringSelectMenuBuilder,
	MessageFlags
} from "discord.js";
import { failedReply, getRandomColor } from "@/utilities/index.js";
import { TranslationFunction } from "@/types/index.js";
import emoji from "@/assets/emoji.js";
import { database } from "@/index.js";

interface Account {
	uid: string;
	nickname?: string;
	cookie?: string;
}

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
						value: "HowToSetUpAccount"
					},
					{
						name: "🔗 Bind Account via Cookie",
						name_localizations: {
							"zh-TW": "🔗 綁定帳號 (直接提報 Cookie)"
						},
						value: "BindAccountByCookie"
					},
					{
						name: "🔸 View configured account",
						name_localizations: {
							"zh-TW": "🔸 檢視已設定帳號"
						},
						value: "ViewAccount"
					},
					{
						name: "⚙️ Edit configured account",
						name_localizations: {
							"zh-TW": "⚙️ 編輯已設定帳號"
						},
						value: "EditAccount"
					},
					{
						name: "❌ Delete configured account",
						name_localizations: {
							"zh-TW": "❌ 刪除已設定帳號"
						},
						value: "DeleteAccount"
					},
					{
						name: "🔐 Bind Account via Password (Recommended)",
						name_localizations: {
							"zh-TW": "🔐 綁定帳號 (帳密登入 - 推薦)"
						},
						value: "BindAccountByPassword"
					}
				)
		),
	/**
	 *
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	): Promise<void> {
		const command = interaction.options.getString("options");
		const userId = interaction.user.id;
		const accountKey = `${userId}.account`;
		const hasAccount = await database.has(accountKey);

		if (
			command == "ViewAccount" ||
			command == "EditAccount" ||
			command == "DeleteAccount"
		) {
			if (!hasAccount)
				return failedReply(interaction, tr("account_NoAccount"));
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		}

		const accounts = (await database.get(accountKey)) as Account[];

		switch (command) {
			case "HowToSetUpAccount":
				const guideImage = new AttachmentBuilder(
					"./src/assets/image/image.png",
					{
						name: "cookie-guide.png"
					}
				);
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_HowToSetUpAccount"))
							.setColor(getRandomColor() as any)
							.setDescription(tr("account_HowToSetUpAccountDesc"))
							.setImage("attachment://cookie-guide.png")
					],
					files: [guideImage],
					flags: MessageFlags.Ephemeral
				});
				return;
			case "BindAccountByCookie":
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("cookie_set_new")
						.setTitle(tr("account_SetUserCookie"))
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("ltoken_v2")
									.setLabel("ltoken_v2")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("ltuid_v2")
									.setLabel("ltuid_v2")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("cookie_token_v2")
									.setLabel("cookie_token_v2")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("account_mid_v2")
									.setLabel("account_mid_v2")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							)
						)
				);
				return;
			case "BindAccountByPassword":
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("cookie_login_password")
						.setTitle(tr("account_QuickLinkModal"))
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("account")
									.setLabel(tr("account_LoginAccountModalField"))
									.setPlaceholder("example@email.com")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("password")
									.setLabel(tr("account_LoginAccountDesc2"))
									.setPlaceholder("******")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							)
						)
				);
				return;
			case "ViewAccount":
				interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(getRandomColor() as any)
							.setAuthor({
								name: tr("account_ListOfAccount", {
									Username: interaction.user.username
								}),
								iconURL: `${interaction.user.displayAvatarURL({
									size: 4096
								})}`
							})
							.addFields(
								...accounts.map(account => ({
									name: `${emoji.avatarIcon} ${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
									value: `${
										account.cookie
											? `🔗 \`${tr("account_Linked")}\``
											: `❌ \`${tr("account_NotLinked")}\``
									}`,
									inline: true
								}))
							)
					]
				});
				return;
			case "EditAccount":
				interaction.editReply({
					components: [
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.setPlaceholder(tr("account_SelectAccountEdit"))
								.setCustomId("account_EditAccountSelect")
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									accounts.map((account, i) => {
										return {
											emoji: emoji.avatarIcon,
											label: `${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
											value: `${i}`
										};
									})
								)
						)
					],
					flags: MessageFlags.Ephemeral
				} as any);
				return;
			case "DeleteAccount":
				interaction.editReply({
					components: [
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.setPlaceholder(
									tr("account_SelectAccountDelete")
								)
								.setCustomId("account_DeleteAccountSelect")
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									accounts.map((account, i) => ({
										emoji: emoji.avatarIcon,
										label: `${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
										value: `${i}`
									}))
								)
						)
					],
					flags: MessageFlags.Ephemeral
				} as any);
				return;
		}
	}
};
