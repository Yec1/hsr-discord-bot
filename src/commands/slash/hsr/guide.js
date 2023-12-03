import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import { toI18nLang } from "../../../services/i18n.js";
import axios from "axios";

export default {
	data: new SlashCommandBuilder()
		.setName("guide")
		.setDescription("View guides for each character")
		.setNameLocalizations({
			"zh-TW": "指南"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看每個角色的指南"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await interaction.deferReply();

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_Searching"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});

		const locale = (await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en";

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
							? `${tr("mainCharacter")}`
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
				const end = Math.min(
					start + chunkSize,
					allCharacterOptions.length
				);
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
					`${tr("guide_character")} ${tr("character_placeholder", {
						s: startIndex,
						e: endIndex
					})}`
				)
				.setCustomId(`guide-${index}`)
				.setMinValues(1)
				.setMaxValues(1)
				.addOptions(optionsChunk);
		});

		await interaction.editReply({
			embeds: [],
			components: selectMenus.map(selectMenu => {
				return new ActionRowBuilder().addComponents(selectMenu);
			})
		});
	}
};
