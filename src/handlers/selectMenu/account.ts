import {
	ActionRowBuilder,
	EmbedBuilder,
	ModalBuilder,
	MessageFlags,
	StringSelectMenuInteraction,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";
import { database } from "@/index.js";
import {
	getLegacyAccounts,
	removeCharacter
} from "@/utilities/accountStore.js";
import type { TranslationFunction } from "@/types/index.js";

function getCookieValue(cookie: string, key: string): string {
	return cookie.match(new RegExp(`${key}=([^;]+)`))?.[1]?.trim() ?? "";
}

export async function handleAccountAction(
	interaction: StringSelectMenuInteraction,
	tr: TranslationFunction,
	customId: string,
	value: string
): Promise<void> {
	const accounts = await getLegacyAccounts(database, interaction.user.id);
	if (accounts.length === 0) {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
					.setTitle(tr("account_nonAcc"))
			],
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	if (customId === "account_EditAccountSelect") {
		const accountIndex = value;
		const cookie = accounts[Number(accountIndex)]?.cookie ?? "";
		const fields = [
			["ltoken_v2", "ltoken_v2"],
			["ltuid_v2", "ltuid_v2"],
			["cookie_token_v2", "cookie_token_v2"],
			["account_mid_v2", "account_mid_v2"]
		] as const;

		await interaction.showModal(
			new ModalBuilder()
				.setCustomId(`cookie_set-${accountIndex}`)
				.setTitle(tr("account_SetUserCookie"))
				.addComponents(
					...fields.map(([id, label]) =>
						new ActionRowBuilder<TextInputBuilder>().addComponents(
							new TextInputBuilder()
								.setCustomId(id)
								.setLabel(label)
								.setStyle(TextInputStyle.Short)
								.setRequired(true)
								.setValue(getCookieValue(cookie, id))
						)
					)
				)
		);
		return;
	}

	if (customId === "account_DeleteAccountSelect") {
		await interaction.update({}).catch(() => {});
		const target = accounts[Number(value)];
		if (target) {
			await removeCharacter(database, interaction.user.id, target.uid);
		}

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(`${tr("account_DeletedSuccess")} \`${target?.uid ?? ""}\``)
			],
			components: []
		});
	}
}
