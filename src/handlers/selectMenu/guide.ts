import axios from "axios";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	EmbedBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import { getRandomColor, getUserLang } from "@/utilities/index.js";
import { getSelectMenu } from "@/utilities/hsr/selectmenu.js";
import { toI18nLang } from "@/utilities/core/i18n.js";
import type { TranslationFunction } from "@/types/index.js";

const resourceBase =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master";

export async function handleGuide(
	interaction: StringSelectMenuInteraction,
	tr: TranslationFunction,
	id: string
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
				)
		],
		components: []
	});

	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";
	const characterData = await axios.get(
		`${resourceBase}/index_min/${locale === "tw" ? "cht" : "en"}/characters.json`
	);
	const selectMenus = await getSelectMenu(interaction as any, tr, "guide");
	const imageUrl = `${resourceBase}/guide/Nwflower/character_overview/${id}.png`;

	try {
		await axios.get(imageUrl);
	} catch {
		await interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						tr("guide_NonImage", {
							z: characterData.data[id]?.name || ""
						})
					)
					.setColor("#E76161")
					.setThumbnail(
						"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
					)
			],
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	await interaction.editReply({
		embeds: [],
		files: [new AttachmentBuilder(imageUrl, { name: `${id}.png` })],
		components: selectMenus.map(menu =>
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
		)
	});
}
