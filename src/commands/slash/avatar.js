import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("avatar")
		.setDescription("Get users avatar")
		.setNameLocalizations({
			"zh-TW": "頭貼",
		})
		.setDescriptionLocalizations({
			"zh-TW": '查看用戶的頭貼',
		})
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription("User who you want to get avatar")
                .setNameLocalizations({
                    "zh-TW": "用戶",
                })
                .setDescriptionLocalizations({
                    "zh-TW": `你想查看頭貼的用戶`,
                })
                .setRequired(true)
        ),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction) {
        const member = interaction.guild.members.cache.get(interaction.options.getUser('user').id)
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
                    .setImage(member.user.displayAvatarURL({ size: 4096, dynamic: true }))
                    .setConfig()
			],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setLabel('完整圖片')
                    .setEmoji('🖼️')
                    .setURL(member.user.displayAvatarURL({ size: 4096, dynamic: true }))
                    .setStyle(5)
                )
            ]

		});
	}
};