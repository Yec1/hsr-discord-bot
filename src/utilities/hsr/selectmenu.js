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

	const leaderboardData = (await db.get("LeaderBoard")) || {};

	// 过滤掉没有分数记录的角色
	const charactersWithScores = Object.values(leaderboardData).filter(
		character => character.score && character.score.length > 0
	);

	// 按角色名称排序
	const sortedCharacters = charactersWithScores.sort((a, b) => {
		const nameA = localeJson[a.id]?.name || a.id;
		const nameB = localeJson[b.id]?.name || b.id;
		return nameA.localeCompare(nameB);
	});

	const allCharacterOptions = sortedCharacters.map(character => {
		const elementId =
			character.element?.id || character.element || "physical";
		const elementKey =
			elementId && typeof elementId === "string"
				? elementId.toLowerCase()
				: "physical";

		return {
			emoji: emoji[elementKey] || emoji.physical, // 如果找不到对应的emoji，使用物理属性作为默认值
			label: `${
				localeJson[character.id]?.name == "{NICKNAME}"
					? tr("MainCharacter")
					: localeJson[character.id]?.name || character.id
			}`,
			value: `${character.id}`
		};
	});

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

function createChunkedSelectMenus(options, placeholder, customIdPrefix) {
	const chunkSize = 25;
	const selectMenus = [];
	for (let i = 0; i < options.length; i += chunkSize) {
		const chunk = options.slice(i, i + chunkSize);
		const menu = new StringSelectMenuBuilder()
			.setPlaceholder(
				placeholder +
					(options.length > chunkSize
						? ` (${i + 1}~${i + chunk.length})`
						: "")
			)
			.setCustomId(`${customIdPrefix}-${Math.floor(i / chunkSize)}`)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(chunk);
		selectMenus.push(menu);
	}
	return selectMenus;
}

export { getSelectMenu, createChunkedSelectMenus };
