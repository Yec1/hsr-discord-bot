import {
	CommandInteraction,
	Embed,
	EmbedBuilder,
	SlashCommandBuilder
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("donate")
		.setDescription(
			"Like our features? You can support this project by sponsoring us!"
		)
		.setNameLocalizations({
			"zh-TW": "贊助"
		})
		.setDescriptionLocalizations({
			"zh-TW": "喜歡我們的功能嗎？您可以贊助我們支持這個項目！"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle(`${tr("donate_Title")}`)
					.setDescription(`${tr("donate_Desc")}`)
					.setImage(
						interaction.locale == "zh-TW"
							? "https://media.discordapp.net/attachments/1179006627026833478/1204445667297198080/IMG_1054.png"
							: "https://media.discordapp.net/attachments/1057244827688910850/1180770724370190447/donate.png"
					)
			],
			ephemeral: true
		});
	}
};
