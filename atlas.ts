import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { handleCharacterAtlas } from "@/utilities/hsr/atlas.js";
import type { TranslationFunction } from "@/types/index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("atlas")
		.setDescription("Query character atlas and other game data")
		.setNameLocalizations({
			"zh-TW": "圖鑑"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查詢角色圖鑑和其他遊戲資料"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("character")
				.setDescription("Query character information")
				.setNameLocalizations({
					"zh-TW": "角色"
				})
				.setDescriptionLocalizations({
					"zh-TW": "查詢角色資訊"
				})
				.addStringOption(option =>
					option
						.setName("character")
						.setDescription("Character name or ID")
						.setNameLocalizations({
							"zh-TW": "角色"
						})
						.setDescriptionLocalizations({
							"zh-TW": "角色名稱或ID"
						})
						.setRequired(true)
						.setAutocomplete(true)
				)
		),

	/**
	 * Execute the atlas command
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === "character") {
			const character = interaction.options.getString("character", true);
			await handleCharacterAtlas(interaction, tr, character);
		}
	}
};
