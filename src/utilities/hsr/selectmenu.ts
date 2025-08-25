import { database } from "@/index.js";
import axios from "axios";
import emoji from "@/assets/emoji.js";
import { toI18nLang } from "@/utilities/core/i18n.js";
import { getUserLang } from "@/utilities/index.js";
import { StringSelectMenuBuilder, CommandInteraction } from "discord.js";
import {
	loadLightConeNamesData,
	loadCharacterNamesData
} from "@/utilities/hsr/jsonManager.js";

interface LocaleJson {
	[key: string]: {
		name: string;
		path?: string;
		element?: string;
	};
}

// 移除原有的简单缓存，使用JSON缓存系统
async function getCharacters(locale: string): Promise<LocaleJson> {
	try {
		// 使用新的JSON缓存系统
		const characterData = await loadCharacterNamesData(locale);
		return characterData || {};
	} catch (error) {
		console.error(
			`Error fetching character names for locale ${locale}:`,
			error
		);
		return {};
	}
}

export async function getLightconeNameById(
	lightconeId: string
): Promise<string | null> {
	try {
		const lightcones = await loadLightConeNamesData();
		return lightcones[lightconeId].cn || lightcones[lightconeId].en;
	} catch (error) {
		console.error(
			`Error getting lightcone name for ID ${lightconeId}:`,
			error
		);
		return null;
	}
}

export async function getCharacterSimplyData(
	characterId: string,
	locale: string
): Promise<{
	name: string | null;
	path: string | null;
	element: string | null;
}> {
	try {
		const characters = await getCharacters(locale);
		return {
			name: characters[characterId]?.name || null,
			path: characters[characterId]?.path || null,
			element: characters[characterId]?.element || null
		};
	} catch (error) {
		console.error(
			`Error getting character name for ID ${characterId}:`,
			error
		);
		return {
			name: null,
			path: null,
			element: null
		};
	}
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

	const localeJson = await getCharacters(locale);
	const leaderboardData = (await database.get("LeaderBoard")) || {};
	const charactersWithScores = Object.values(leaderboardData).filter(
		(character: any) => character.score && character.score.length > 0
	);

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
			emoji: (emoji as any)[elementKey] || emoji.physical,
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
