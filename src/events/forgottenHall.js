import { client } from "../index.js";
import { i18nMixin, toI18nLang } from "../services/i18n.js";
import {
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	Events,
	EmbedBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { indexImage } from "../services/forgottenHall.js";
import Queue from "queue";

const db = client.db;
const drawQueue = new Queue({ autostart: true });

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isStringSelectMenu()) return;
	const tr = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	if (interaction.customId === "forgottenHall_Floor") {
		await interaction.update({ fetchReply: true }).catch(() => {});
		const [userId, mode, time, i] = interaction.values[0].split("-");

		const hsr = new HonkaiStarRail({
			cookie: (await db.has(`${userId}.account`))
				? (await db.get(`${userId}.account`))[0].cookie
				: await db.get(`${userId}.cookie`),
			lang: (await db?.has(`${interaction.user.id}.locale`))
				? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
					? LanguageEnum.TRADIIONAL_CHINESE
					: LanguageEnum.ENGLISH
				: interaction.locale == "zh-TW"
					? LanguageEnum.TRADIIONAL_CHINESE
					: LanguageEnum.ENGLISH,
			uid: (await db.has(`${userId}.account`))
				? (await db.get(`${userId}.account`))[0].uid
				: await db.get(`${userId}.uid`)
		});

		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_Searching"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			],
			components: []
		});

		const res = await hsr.record.forgottenHall(
			parseInt(mode),
			parseInt(time)
		);
		const floor = res.all_floor_detail[i];

		await handleDrawRequest(
			hsr.uid,
			userId,
			mode,
			time,
			res,
			floor,
			interaction,
			tr
		);
	}
});

async function handleDrawRequest(
	uid,
	userId,
	mode,
	time,
	res,
	floor,
	interaction,
	tr
) {
	const drawTask = async () => {
		try {
			const imageBuffer = await indexImage(uid, res, mode, floor, tr);
			if (imageBuffer == null) throw new Error(tr("draw_NoData"));

			const image = new AttachmentBuilder(imageBuffer, {
				name: `${floor.maze_id}.png`
			});

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: `${interaction.user.username}`,
							iconURL: `${interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})}`
						})
						.setImage(`attachment://${image.name}`)
				],
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
										description:
											mode == 2
												? `${tr("forgottenHall_desc2", {
														s: `${floor.star_num}`,
														r: `${floor.round_num}`,
														z: `${
															(parseInt(
																floor.node_1
																	?.score
															) || 0) +
															(parseInt(
																floor.node_2
																	?.score
															) || 0)
														}`
													})}`
												: `${tr("forgottenHall_desc", {
														s: `${floor.star_num}`,
														r: `${floor.round_num}`
													})}`,
										value: `${userId}-${mode}-${time}-${i}`
									};
								})
							)
					)
				]
			});
		} catch (error) {
			interaction.editReply({
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
		interaction.editReply({
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
