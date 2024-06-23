import { client } from "../../index.js";
import axios from "axios";
import emoji from "../../assets/emoji.js";
import { toI18nLang } from "../core/i18n.js";
import { getUserLang } from "../utilities.js";
import { StringSelectMenuBuilder } from "discord.js";

const db = client.db;

async function getSelectMenu(interaction, tr, type) {
	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";

	const responses = await axios.get(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
			locale == "tw" ? "cht" : "en"
		}/characters.json`
	);
	const localeJson = responses.data;

	const leaderboardData = (await db.get("LeaderBoard")) || [];

	const allCharacterOptions = Object.values(leaderboardData).map(
		character => {
			return {
				emoji: emoji[character.element.id.toLowerCase()],
				label: `${
					localeJson[character.id].name == "{NICKNAME}"
						? tr("MainCharacter")
						: localeJson[character.id].name
				}`,
				value: `${character.id}`
			};
		}
	);

	const chunkSize = 25;
	const startIndexes = Array.from(
		{ length: Math.ceil(allCharacterOptions.length / chunkSize) },
		(_, index) => index * chunkSize + 1
	);

	const characterOptionChunks = Array.from(
		{ length: startIndexes.length },
		(_, index) => {
			const start = startIndexes[index] - 1;
			const end = Math.min(start + chunkSize, allCharacterOptions.length);
			return allCharacterOptions.slice(start, end);
		}
	);

	const selectMenus = characterOptionChunks.map((optionsChunk, index) => {
		const startIndex = startIndexes[index];
		const endIndex = Math.min(
			startIndex + chunkSize - 1,
			allCharacterOptions.length
		);

		return new StringSelectMenuBuilder()
			.setPlaceholder(
				`${type == "leaderboard" ? tr("leaderboard_Character") : tr("guide_Character")} ${tr(
					"leaderboard_CharacterRange",
					{
						s: startIndex,
						e: endIndex
					}
				)}`
			)
			.setCustomId(
				`${type == "leaderboard" ? "leaderboard" : "guide"}-${index}`
			)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(optionsChunk);
	});

	return selectMenus;
}

export { getSelectMenu };
