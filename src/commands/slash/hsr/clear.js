import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("clear-cache")
		.setDescription(
			"Clear data already stored in the database,its impossible to return!"
		)
		.setNameLocalizations({
			"zh-TW": "清除緩存"
		})
		.setDescriptionLocalizations({
			"zh-TW": "清除已儲存於資料庫的資料，這是無法返回！"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await db?.delete(`${interaction.user.id}`);

		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig("F6F1F1")
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1149971549131124778/march-7th-astral-express.png"
					)
					.setTitle(tr("clear_cache"))
			],
			ephemeral: true
		});
	}
};
