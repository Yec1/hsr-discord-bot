import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	AttachmentBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { characterListImage } from "../../../services/profile.js";
import { player } from "../../../services/request.js";
import Queue from "queue";
const drawQueue = new Queue({ autostart: true });

export default {
	data: new SlashCommandBuilder()
		.setName("character")
		.setDescription("View simple information of all characters")
		.setNameLocalizations({
			"zh-TW": "角色總覽"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看全部角色的簡易資料"
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

		await replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_Searching"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});

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

			const characters = await hsr.record.characters();

			handleDrawRequest(hsr.uid, characters, interaction, tr);
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
							`${tr("cookie_failedDesc")}\n\n${tr(
								"err_code"
							)}${e}`
						)
				]
			});
		}
	}
};

async function handleDrawRequest(uid, characters, interaction, tr) {
	const drawTask = async () => {
		try {
			const playerData = await player(uid, interaction);

			const imageBuffer = await characterListImage(
				characters,
				playerData,
				tr
			);
			if (imageBuffer == null) throw new Error(tr("draw_NoData"));

			const image = new AttachmentBuilder(imageBuffer, {
				name: `${playerData.player.uid}.png`
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
				files: [image]
			});
		} catch (error) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(
							`${tr("draw_fail")}\n${tr("err_code")}${
								error?.response?.data?.detail ?? error.message
							}`
						)

						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
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
