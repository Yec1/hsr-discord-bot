import {
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
					// {
					// 	name: "🔥Login with account and password🔥",
					// 	name_localizations: {
					// 		"zh-TW": "🔥帳號密碼登入🔥"
					// 	},
					// 	value: "LoginAccount"
					// },
					{
						name: "❓ How to set up account",
						name_localizations: {
							"zh-TW": "❓ 如何設定帳號"
						},
						value: "HowToSetUpAccount"
					},
					{
						name: "① Set UID",
						name_localizations: {
							"zh-TW": "① 設定 UID"
						},
						value: "SetUserID"
					},
					{
						name: "② Set Cookie",
						name_localizations: {
							"zh-TW": "② 設定 Cookie"
						},
						value: "SetUserCookie"
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
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_HowToSetUpAccount"))
							.setColor(getRandomColor() as any)
							.setDescription(tr("account_HowToSetUpAccountDesc"))
							.setImage(
								"https://media.discordapp.net/attachments/1149960935654559835/1185194443322687528/cookieT.png"
							)
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			case "LoginAccount":
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("account_LoginAccountModal")
						.setTitle(tr("account_LoginAccount"))
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(
										"account_LoginAccountModalField"
									)
									.setLabel(tr("account_LoginAccountDesc"))
									.setPlaceholder("example@gmail.com")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(
										"account_LoginAccountModalField2"
									)
									.setLabel(tr("account_LoginAccountDesc2"))
									.setPlaceholder("mypassword")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
							)
						)
				);
				return;
			case "SetUserID":
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId("account_SetUserIDModal")
						.setTitle(tr("account_SetUserID"))
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId("account_SetUserIDModalField")
									.setLabel(tr("account_SetUserIDDesc"))
									.setPlaceholder("e.g. 809279679")
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
									.setMinLength(9)
									.setMaxLength(10)
							)
						)
				);
				return;
			case "SetUserCookie":
				if (!hasAccount)
					return failedReply(interaction, tr("account_NoAccount"));
				interaction.reply({
					components: [
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.setPlaceholder(
									tr("account_SelectAccountSetCookie")
								)
								.setCustomId("account_SetUserCookieSelect")
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									accounts.map((account, index) => ({
										emoji: emoji.avatarIcon,
										label: `${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
										value: `${index}`
									}))
								)
						)
					],
					flags: MessageFlags.Ephemeral
				} as any);
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
