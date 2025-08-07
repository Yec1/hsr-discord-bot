import { database } from "@/index.js";
import axios from "axios";
import emoji from "@/assets/emoji.js";
import { toI18nLang } from "@/utilities/core/i18n.js";
import { getUserLang } from "@/utilities/index.js";
import { StringSelectMenuBuilder, CommandInteraction } from "discord.js";

interface Character {
	id: string;
	score?: any[];
	element?:
		| {
				id?: string;
		  }
		| string;
}

interface LocaleJson {
	[key: string]: {
		name: string;
	};
}

async function getSelectMenu(
	interaction: CommandInteraction,
	tr: any,
	type: string
) {
	const locale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";

	const responses = await axios.get(
		`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/${
			locale == "tw" ? "cht" : "en"
		}/characters.json`
	);
	const localeJson = responses.data as LocaleJson;

	const leaderboardData = (await database.get("LeaderBoard")) || {};

	// 过滤掉没有分数记录的角色
	const charactersWithScores = Object.values(leaderboardData).filter(
		(character: any) => character.score && character.score.length > 0
	);

	// 按角色名称排序
	const sortedCharacters = charactersWithScores.sort((a: any, b: any) => {
		const nameA = localeJson[a.id]?.name || a.id;
		const nameB = localeJson[b.id]?.name || b.id;
		return nameA.localeCompare(nameB);
	});

	const allCharacterOptions = sortedCharacters.map((character: any) => {
		const elementId =
			character.element?.id || character.element || "physical";
		const elementKey =
			elementId && typeof elementId === "string"
				? elementId.toLowerCase()
				: "physical";

		return {
			emoji: (emoji as any)[elementKey] || emoji.physical, // 如果找不到对应的emoji，使用物理属性作为默认值
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
			const start = (startIndexes[index] || 0) - 1;
			const end = Math.min(start + chunkSize, allCharacterOptions.length);
			return allCharacterOptions.slice(start, end);
		}
	);

	const selectMenus = characterOptionChunks.map((optionsChunk, index) => {
		const startIndex = startIndexes[index] || 0;
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

interface SelectMenuOption {
	emoji?: string;
	label: string;
	value: string;
}

function createChunkedSelectMenus(
	options: SelectMenuOption[],
	placeholder: string,
	customIdPrefix: string
) {
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
