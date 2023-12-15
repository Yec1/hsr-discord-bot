import {
	CommandInteraction,
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	EmbedBuilder
} from "discord.js";

export default {
	data: new ContextMenuCommandBuilder()
		.setName("redeem")
		.setNameLocalizations({
			"zh-TW": "兌換禮包碼"
		})
		.setType(ApplicationCommandType.Message),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		let code = interaction.targetMessage?.content;
		let codes = [];

		code = code?.replace(
			/(https:\/\/){0,1}hsr.hoyoverse.com(\/.*){0,1}\/gift\?code=/,
			""
		);
		codes = code?.match(/[A-Za-z0-9]{5,30}/g);
		codes = codes?.slice(0, 5);

		if (!codes)
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("redeem_failed")}`)
				],
				ephemeral: true
			});

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(`${emoji.s900001} ${tr("redeem_sus")}`)
					.setDescription(
						`${codes
							.map(
								(code, index) =>
									`**${
										index + 1
									}** \`•\` [${code}](https://hsr.hoyoverse.com/gift?code=${code})`
							)
							.join("\n")}`
					)
			]
		});
	}
};
