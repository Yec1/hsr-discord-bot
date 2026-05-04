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
	MessageFlags,
	ContainerBuilder,
	SectionBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	ThumbnailBuilder
} from "discord.js";
import { failedReply, getRandomColor } from "@/utilities/index.js";
import { TranslationFunction } from "@/types/index.js";
import emoji from "@/assets/emoji.js";
import { database } from "@/index.js";
import { getConfig } from "@/utilities/core/config.js";
import { getAllCharacters, getHoyolabs, type Character, type Hoyolab } from "@/utilities/accountStore.js";

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

function buildAccountComponents(
	characters: Array<Character & { ltuid_v2: string; cookie: string }>,
	hoyolabs: Hoyolab[],
	discordUsername: string,
	discordAvatarUrl: string,
	tr: TranslationFunction,
): ContainerBuilder {
	const container = new ContainerBuilder();

	const firstHoyolab = hoyolabs[0] ?? null;
	const hoyolabName = firstHoyolab?.hoyolabName ?? null;
	const hoyolabIcon = firstHoyolab?.hoyolabIcon ?? null;
	const ltuid = firstHoyolab?.ltuid_v2 ?? "—";

	const headerText = [
		`**${discordUsername}**`,
		hoyolabName
			? `${hoyolabName} · ltuid \`${ltuid}\``
			: `ltuid \`${ltuid}\``,
	].join("\n");

	const headerSection = new SectionBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(headerText),
	);
	headerSection.setThumbnailAccessory(
		new ThumbnailBuilder().setURL(hoyolabIcon ?? discordAvatarUrl),
	);
	container.addSectionComponents(headerSection);
	container.addSeparatorComponents(new SeparatorBuilder());

	for (let i = 0; i < characters.length; i++) {
		const c = characters[i]!;
		const gameName = c.game_name ?? "Honkai: Star Rail";
		const lvLabel = tr("account_View_LvShort");
		const levelStr = c.level !== undefined ? ` · ${lvLabel} ${c.level}` : "";
		const regionStr = c.region_name ?? c.region ?? "—";
		const nicknameStr = c.nickname ? `**${c.nickname}** · ` : "";
		const syncStr = c.enrichedAt
			? ` · ${tr("account_View_LastSync", { time: formatRelativeFromIso(c.enrichedAt) })}`
			: "";

		const charText = [
			`${nicknameStr}UID \`${c.uid}\``,
			`${gameName}${levelStr}`,
			`${tr("account_View_Region")}: ${regionStr}${syncStr}`,
		].join("\n");

		const charSection = new SectionBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(charText),
		);
		charSection.setThumbnailAccessory(
			new ThumbnailBuilder().setURL(c.logo ?? discordAvatarUrl),
		);
		container.addSectionComponents(charSection);

		if (i < characters.length - 1) {
			container.addSeparatorComponents(new SeparatorBuilder());
		}
	}

	return container;
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
					name: "🌐 Bind Account via Web Login",
					name_localizations: {
						"zh-TW": "🌐 綁定帳號 (網頁登入)"
					},
					value: "BindAccountByWebLogin"
				},
				{
					name: "🔗 Bind Account via Cookie",
					name_localizations: {
						"zh-TW": "🔗 綁定帳號 (Cookie)"
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
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			if (!hasAccount)
				return failedReply(interaction, tr("account_NoAccount"));
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
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(getRandomColor() as any)
							.setDescription(`❌ \`${tr("account_NoAccount")}\``)
					]
				});
				return;
			}

			const hoyolabs = await getHoyolabs(database as any, userId);
			const container = buildAccountComponents(
				characters.slice(0, 10),
				hoyolabs,
				interaction.user.username,
				interaction.user.displayAvatarURL({ size: 256 }),
				tr,
			);
			await interaction.editReply({
				flags: MessageFlags.IsComponentsV2,
				components: [container],
			} as any);
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
