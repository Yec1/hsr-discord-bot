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
	ButtonBuilder,
	ButtonStyle,
	MessageFlags
} from "discord.js";
import { failedReply, getRandomColor } from "@/utilities/index.js";
import { TranslationFunction } from "@/types/index.js";
import emoji from "@/assets/emoji.js";
import { database } from "@/index.js";
import { getConfig } from "@/utilities/core/config.js";
import { drainPendingLogins } from "@/utilities/webhookLogin.js";
import { getAllCharacters, type Character, type Hoyolab } from "@/utilities/accountStore.js";

function formatRelativeFromIso(iso: string | undefined): string {
	if (!iso) return "—";
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diffSec = Math.floor((Date.now() - t) / 1000);
	if (diffSec < 60) return `${diffSec}s ago`;
	if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
	if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
	return `${Math.floor(diffSec / 86400)}d ago`;
}

function buildCharacterEmbed(
	character: Character,
	_hoyolab: Hoyolab,
	tr: TranslationFunction
): EmbedBuilder {
	const titleGame = character.game_name ?? "Honkai: Star Rail";
	const lvLabel = tr("account_View_LvShort");
	const titleLevel = character.level !== undefined ? `${lvLabel} ${character.level}` : "";
	const title = titleLevel ? `${titleGame} · ${titleLevel}` : titleGame;
	const nickname = character.nickname ?? "";
	const description = `${nickname ? `**${nickname}** · ` : ""}UID \`${character.uid}\``;

	const embed = new EmbedBuilder()
		.setColor(getRandomColor() as any)
		.setTitle(title)
		.setDescription(description);

	if (character.logo) embed.setThumbnail(character.logo);
	if (character.cover) embed.setImage(character.cover);

	const regionVal = character.region_name ?? character.region ?? "—";
	embed.addFields({ name: tr("account_View_Region"), value: regionVal, inline: true });

	const stats = character.stats ?? [];
	if (stats.length > 0) {
		for (const s of stats.slice(0, 4)) {
			embed.addFields({ name: s.name || "—", value: s.value || "—", inline: true });
		}
	}

	const linked = tr("account_View_Linked");
	const lastSync = character.enrichedAt
		? ` · ${tr("account_View_LastSync", { time: formatRelativeFromIso(character.enrichedAt) })}`
		: "";
	embed.setFooter({ text: `🔗 ${linked}${lastSync}` });

	return embed;
}

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
					},
					{
						name: "🌐 Bind Account via Web Login (Most Secure)",
						name_localizations: {
							"zh-TW": "🌐 綁定帳號 (網頁登入 - 最安全)"
						},
						value: "BindAccountByWebLogin"
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

		// Pull any pending web-logins from Supabase before reading local DB.
		// Fast no-op when Supabase is unconfigured or queue is empty.
		try {
			const bound = await drainPendingLogins(userId);
			if (bound.length > 0) {
				console.log(`[/account] drain bound ${bound.length} account(s) for ${userId}`);
			}
		} catch (e: any) {
			console.error(`[/account] drainPendingLogins threw: ${e?.message ?? e}`);
			/* never block /account on a queue read */
		}

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
									.setLabel("ltmid_v2")
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
									.setLabel(
										tr("account_LoginAccountModalField")
									)
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
			case "BindAccountByWebLogin": {
				const config = getConfig();
				const webLoginUrl = config.WEB_LOGIN_URL;
				if (!webLoginUrl) {
					return failedReply(
						interaction,
						"Web login is not configured on this bot."
					);
				}
				// Map Discord interaction locale → web app locale (en | zh-TW)
				const rawLocale = String(interaction.locale ?? "").toLowerCase();
				const webLang =
					rawLocale === "zh-tw" || rawLocale === "zh-cn" || rawLocale === "zh"
						? "zh-TW"
						: "en";
				const langQs = webLang === "en" ? "" : `&lang=${webLang}`;
				const url = `${webLoginUrl.replace(/\/$/, "")}/login?botId=hsr${langQs}`;
				const button = new ButtonBuilder()
					.setLabel(tr("account_WebLoginButton"))
					.setURL(url)
					.setStyle(ButtonStyle.Link);
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("account_WebLoginTitle"))
							.setDescription(tr("account_WebLoginDesc"))
							.setColor(getRandomColor() as any)
					],
					components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							button
						) as any
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}
			case "ViewAccount": {
				const characters = await getAllCharacters(database as any, userId);
				if (characters.length === 0) {
					interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(getRandomColor() as any)
								.setAuthor({
									name: tr("account_ListOfAccount", {
										Username: interaction.user.username
									}),
									iconURL: interaction.user.displayAvatarURL({
										size: 4096
									})
								})
								.setDescription(`❌ \`${tr("account_NoAccount")}\``)
						]
					});
					return;
				}

				const embeds = characters.slice(0, 10).map(c => {
					// getAllCharacters returns Character & { ltuid_v2, cookie } — split for builder
					const { ltuid_v2, cookie, ...charOnly } = c;
					const hoyolab: Hoyolab = {
						ltuid_v2,
						cookie,
						hoyolabName: null,
						lastUpdate: charOnly.lastUpdate,
						invalid: charOnly.invalid,
						characters: []
					};
					return buildCharacterEmbed(charOnly as Character, hoyolab, tr);
				});

				// Lead author embed if user has > 0 characters — keep the username header.
				if (embeds.length > 0) {
					embeds[0]!.setAuthor({
						name: tr("account_ListOfAccount", {
							Username: interaction.user.username
						}),
						iconURL: interaction.user.displayAvatarURL({ size: 4096 })
					});
				}

				interaction.editReply({ embeds });
				return;
			}
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
