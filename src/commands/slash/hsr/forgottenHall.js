import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { indexImage } from "../../../services/forgottenHall.js";

export default {
	data: new SlashCommandBuilder()
		.setName("forgottenhall")
		.setDescription("View Chaos of Memory in the Forgotten Hall")
		.setNameLocalizations({
			"zh-TW": "忘卻之庭紀錄"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看忘卻之庭的渾沌回憶紀錄"
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
		const user = interaction.options.getUser("user") ?? interaction.user;
		try {
			const hsr = new HonkaiStarRail({
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

			const res = await hsr.record.forgottenHall();
			if (res.has_data == false)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("forgottenHall_noninfo"))
					],
					ephemeral: true
				});

			await interaction.deferReply();

			const floor = res.all_floor_detail[0];
			const imageBuffer = await indexImage(
				hsr.uid,
				res,
				floor,
				interaction
			);
			const image = new AttachmentBuilder(imageBuffer, {
				name: `${floor.name}.png`
			});

			await interaction.editReply({
				files: [image],
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("forgottenHall_selectFloor"))
							.setCustomId("forgottenHall_Floor")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								res.all_floor_detail.map((floor, i) => {
									return {
										label: `${floor.name.replace(
											/<\/?[^>]+(>|$)/g,
											""
										)}`,
										description: `${tr(
											"forgottenHall_desc",
											{
												s: `${floor.star_num}`,
												r: `${floor.round_num}`
											}
										)}`,
										value: `${user.id}-${i}`
									};
								})
							)
					)
				]
			});
		} catch (e) {
			let desc = "";
			const userdb = (await db?.has(`${user}.account`))
				? (await db?.get(`${user}.account`))[0]
				: await db?.get(`${user}`);
			userdb?.cookie ? "" : (desc += `${tr("cookie_failedDesc")}\n`);
			userdb?.uid ? "" : (desc += `${tr("uid_failedDesc")}\n`);

			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(`${tr("notify_failed")}`)
						.setDescription(
							`<@${user.id}>\n\n${desc}\n${tr("err_code")}${e}`
						)
				],
				ephemeral: true
			});
		}
	}
};
