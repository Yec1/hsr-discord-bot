import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { getUserHSRData, getRandomColor } from "@/utilities/index.js";
import { handleNoteDraw } from "@/utilities/hsr/note.js";
import type { TranslationFunction } from "@/types/index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("note")
		.setDescription("View current stamina and expedition progress")
		.setNameLocalizations({
			"zh-TW": "即時便箋"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看當前體力和委託進度"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("check")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "查看"
				})
				.addStringOption(option =>
					option
						.setName("account")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "帳號"
						})
						.setRequired(false)
						.setAutocomplete(true)
				)
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setRequired(false)
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
		const subCommand = interaction.options.getSubcommand();
		if (subCommand == "check") {
			const targetUser =
				interaction.options.getUser("user") || interaction.user;
			const accountIndex =
				interaction.options.getString("account") || "0";

			const hsr = await getUserHSRData(
				interaction,
				tr,
				targetUser.id,
				parseInt(accountIndex),
				{ validationType: "record" }
			);
			if (hsr == null) return;

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor() as any)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				]
			});

			handleNoteDraw(interaction, tr, hsr as any);
		}
	}
};
