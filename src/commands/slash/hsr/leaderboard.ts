import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder
} from "discord.js";
import { getRandomColor } from "@/utilities/index.js";
import { getSelectMenu } from "@/utilities/hsr/selectmenu.js";
import type { TranslationFunction } from "@/types/index.js";
import { database } from "@/index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription("View the relic score leaderboard for each character")
		.setNameLocalizations({
			"zh-TW": "排行榜"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看每個角色的遺器評分排行榜"
		}),
	/**
	 *
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	): Promise<void> {
		await interaction.deferReply();

		try {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor() as any)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				]
				// withResponse: true
			});

			const leaderboardData = await database.get("LeaderBoard");

			if (!leaderboardData || Object.keys(leaderboardData).length === 0) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("leaderboard_NoData") || "No Data")
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					],
					components: []
				});
				return;
			}

			const selectMenus = await getSelectMenu(
				interaction,
				tr,
				"leaderboard"
			);

			if (selectMenus.length === 0) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("leaderboard_NoData") || "No Data")
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					],
					components: []
				});
				return;
			}

			await interaction.editReply({
				embeds: [],
				components: selectMenus.map(selectMenu => {
					return new ActionRowBuilder().addComponents(selectMenu);
				}) as any
			});
		} catch (error) {
			console.error("Leaderboard error:", error);
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Error")
						.setDescription(
							`\`${(error as Error).message || error}\``
						)
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
				],
				components: []
			});
		}
	}
};
