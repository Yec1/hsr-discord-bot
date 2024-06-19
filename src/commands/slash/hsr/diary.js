import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { GenshinImpact, HonkaiStarRail, LanguageEnum } from "hoyoapi";

export default {
	data: new SlashCommandBuilder()
		.setName("diary")
		.setDescription("...")
		.setNameLocalizations({
			"zh-TW": "開拓閱歷"
		})
		.setDescriptionLocalizations({
			"zh-TW": "..."
		})
		.addUserOption(option =>
			option
				.setName("user")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "使用者"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(false)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		await interaction.deferReply({ ephemeral: true });

		const user = interaction.options.getUser("user") ?? interaction.user;
		try {
			const hsr = new GenshinImpact({
				cookie:
					(await db.has(`${user.id}.account`)) &&
					(await db.get(`${user.id}.account`))[0].cookie
						? (await db.get(`${user.id}.account`))[0].cookie
						: await db.get(`${user.id}.cookie`),
				lang: (await db?.has(`${interaction.user.id}.locale`))
					? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
						? LanguageEnum.TRADIIONAL_CHINESE
						: LanguageEnum.ENGLISH
					: interaction.locale == "zh-TW"
						? LanguageEnum.TRADIIONAL_CHINESE
						: LanguageEnum.ENGLISH,
				uid:
					(await db.has(`${user.id}.account`)) &&
					(await db.get(`${user.id}.account`))[0].uid
						? (await db.get(`${user.id}.account`))[0].uid
						: await db.get(`${user.id}.uid`)
			});

			console.log((await db.get(`${user.id}.account`))[0].cookie);
			const detail = await hsr.diary.detail(1);
			console.log(`Detail: ${detail}`);
			const list = await hsr.diary.list();
			console.log(`List: ${list}`);
		} catch (e) {
			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("cookie_failed")}`)
						.setDescription(
							`<@${user.id}>\n\n${tr(
								"cookie_failedDesc"
							)}\n\n${tr("err_code")}${e}`
						)
				]
			});
		}
	}
};
