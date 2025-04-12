import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder
} from "discord.js";
import { getRandomColor } from "../../../utilities/utilities.js";
import { getSelectMenu } from "../../../utilities/hsr/selectmenu.js";

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
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await interaction.deferReply();

		try {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor())
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				],
				fetchReply: true
			});

			const leaderboardData = await db.get("LeaderBoard");

			if (!leaderboardData || Object.keys(leaderboardData).length === 0) {
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("leaderboard_NoData") || "No Data")
							.setDescription(
								tr("leaderboard_NoDataDesc") || "No Data"
							)
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					],
					components: []
				});
			}

			const selectMenus = await getSelectMenu(
				interaction,
				tr,
				"leaderboard"
			);

			if (selectMenus.length === 0) {
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("leaderboard_NoData"))
							.setDescription(tr("leaderboard_NoDataDesc"))
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
					],
					components: []
				});
			}

			interaction.editReply({
				embeds: [],
				components: selectMenus.map(selectMenu => {
					return new ActionRowBuilder().addComponents(selectMenu);
				})
			});
		} catch (error) {
			console.error("Leaderboard error:", error);
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Error"))
						.setDescription(`\`${error.message || error}\``)
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
