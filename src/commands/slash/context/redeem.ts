import {
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	EmbedBuilder,
	Client,
	MessageContextMenuCommandInteraction,
	MessageFlags
} from "discord.js";
import { TranslationFunction } from "@/types/index.js";
import emoji from "@/assets/emoji.js";

interface Translation {
	(key: string): string;
}

interface Emoji {
	s900001: string;
}

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
	async execute(
		interaction: MessageContextMenuCommandInteraction,
		tr: TranslationFunction
	): Promise<void> {
		let code = interaction.targetMessage?.content;
		let codes: string[] = [];

		code = code?.replace(
			/(https:\/\/){0,1}hsr.hoyoverse.com(\/.*){0,1}\/gift\?code=/,
			""
		);
		codes = code?.match(/[A-Za-z0-9]{5,30}/g) || [];
		codes = codes?.slice(0, 5);

		if (!codes || codes.length === 0) {
			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("redeem_failed")}`)
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
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
			],
			flags: MessageFlags.Ephemeral
		});
	}
};
