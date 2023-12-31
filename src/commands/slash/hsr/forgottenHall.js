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
import Queue from "queue";

const drawQueue = new Queue({ autostart: true });

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

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("profile_Searching"))
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});

			const floor = res.all_floor_detail[0];

			await handleDrawRequest(
				hsr.uid,
				user.id,
				res,
				floor,
				interaction,
				tr
			);
		} catch (e) {
			const userdb = (await db?.has(`${user.id}.account`))
				? (await db?.get(`${user.id}.account`))[0]
				: await db?.get(`${user.id}`);

			const desc = [
				userdb?.cookie ? "" : tr("cookie_failedDesc"),
				userdb?.uid ? "" : tr("uid_failedDesc")
			]
				.filter(Boolean)
				.join("\n");

			replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("notify_failed"))
						.setDescription(
							`<@${user.id}>\n\n${desc}\n\n${tr("err_code")}${e}`
						)
				],
				ephemeral: true
			});
		}
	}
};

async function handleDrawRequest(uid, userId, res, floor, interaction, tr) {
	const drawTask = async () => {
		try {
			const imageBuffer = await indexImage(uid, res, floor, interaction);
			if (imageBuffer == null) throw new Error(tr("draw_NoData"));

			const image = new AttachmentBuilder(imageBuffer, {
				name: `${floor.name}.png`
			});

			await interaction.editReply({
				files: [image],
				embeds: [],
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
										value: `${userId}-${i}`
									};
								})
							)
					)
				]
			});
		} catch (error) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()

						.setTitle(
							`${tr("draw_fail")}\n${tr("err_code")}${
								error.message
							}`
						)
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length != 1)
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()

					.setTitle(
						`${tr("draw_wait", {
							z: drawQueue.length - 1
						})}`
					)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});
}
