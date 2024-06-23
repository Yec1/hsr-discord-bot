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

		const selectMenus = await getSelectMenu(interaction, tr, "guide");

		interaction.editReply({
			embeds: [],
			components: selectMenus.map(selectMenu => {
				return new ActionRowBuilder().addComponents(selectMenu);
			})
		});
	}
};
