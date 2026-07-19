import axios from "axios";
import {
	ActionRowBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import { database } from "@/index.js";
import emoji from "@/assets/emoji.js";
import { getRandomColor, getUserLang } from "@/utilities/index.js";
import { getSelectMenu } from "@/utilities/hsr/selectmenu.js";
import { toI18nLang } from "@/utilities/core/i18n.js";
import type { TranslationFunction } from "@/types/index.js";
import type { LeaderboardData } from "@/types/selectMenu.js";

const imageHeader =
	"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";

export async function handleLeaderboard(
	interaction: StringSelectMenuInteraction,
	tr: TranslationFunction,
	value: string
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

	const leaderboardData: LeaderboardData = (await database.get(
		`LeaderBoard.${value}`
	)) ?? {
		id: "",
		score: [],
		element: { color: "" },
		icon: ""
	};
	const firstPlace = leaderboardData.score[0];
	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";
	const response = await axios.get(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
			locale === "tw" ? "cht" : "en"
		}/characters.json`
	);
	const selectMenus = await getSelectMenu(
		interaction as any,
		tr,
		"leaderboard"
	);
	const embedTitle = `${emoji.crown} \`${firstPlace?.nickname || ""}\` ${
		firstPlace?.uid || ""
	} • ${tr("leaderboard_Score", { z: `${firstPlace?.score || 0}` })}`;
	const embedDescription =
		leaderboardData.score.length > 1
			? leaderboardData.score
					.slice(1)
					.map(
						(item, index) =>
							`**${index + 2}.** \`${item.nickname}\` ${
								item.uid
							} • ${tr("leaderboard_Score", { z: `${item.score}` })}`
					)
					.join("\n")
			: `\`${tr("None")}\``;

	await interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor(leaderboardData.element.color as any)
				.setAuthor({
					iconURL: firstPlace?.avatar.startsWith("http")
						? firstPlace.avatar
						: `${imageHeader}${firstPlace?.avatar || ""}`,
					name: tr("leaderboard_Title", {
						z:
							response.data[leaderboardData.id]?.name === "{NICKNAME}"
								? tr("MainCharacter")
								: response.data[leaderboardData.id]?.name || ""
					})
				})
				.setThumbnail(
					leaderboardData.icon.startsWith("http")
						? leaderboardData.icon
						: `${imageHeader}${leaderboardData.icon}`
				)
				.setTitle(embedTitle)
				.addFields({ name: "\u200b", value: "\u200b", inline: false })
				.setDescription(embedDescription)
		],
		components: selectMenus.map(selectMenu =>
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
		)
	});
}
