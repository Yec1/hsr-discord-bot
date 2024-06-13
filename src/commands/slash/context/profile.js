import {
	CommandInteraction,
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder
} from "discord.js";
import { player } from "../../../services/request.js";
import {
	saveCharacters,
	loadCharacters,
	mainPage,
	saveLeaderboard
} from "../../../services/profile.js";
import Queue from "queue";

const drawQueue = new Queue({ autostart: true });

export default {
	data: new ContextMenuCommandBuilder()
		.setName("profile")
		.setNameLocalizations({
			"zh-TW": "查詢個人簡介"
		})
		.setType(ApplicationCommandType.User),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const uid = (await db.has(`${interaction.targetUser.id}.account`))
			? (await db.get(`${interaction.targetUser.id}.account`))[0].uid
			: (await db.has(`${interaction.targetUser.id}.uid`))
				? await db.get(`${interaction.targetUser.id}.uid`)
				: null;

		const user = interaction.options.getUser("user") ?? interaction.user;

		if (uid == null)
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(`${tr("uid_UserNonSet")}`)
				],
				ephemeral: true
			});

		await interaction.deferReply();

		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_Searching"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});

		handleDrawRequest(user, uid, interaction, tr, emoji);
	}
};

async function handleDrawRequest(user, uid, interaction, tr, emoji) {
	const drawTask = async () => {
		try {
			const playerData = await player(uid, interaction);

			if (playerData.detail)
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(
								tr("profile_failed", {
									z: `\`${uid}\``
								})
							)
					]
				});

			// saveCharacters(playerData);
			saveLeaderboard(playerData);

			const characters =
				// (await loadCharacters(playerData.player.uid)) ||
				playerData.characters;

			const imageBuffer = await mainPage(playerData, interaction);
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
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("profile_character"))
							.setCustomId("profile_characters")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								characters.map((character, i) => {
									return {
										emoji: emoji[
											character.element.id.toLowerCase()
										],
										label: `${character.name}`,
										value: `${playerData.player.uid}-${i}-${user.id}`
									};
								})
							)
					)
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
