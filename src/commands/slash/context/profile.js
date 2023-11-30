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
			return replyOrfollowUp(interaction, {
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

		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(tr("profile_Searching"))
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});

		const playerData = await player(uid, interaction);

		if (playerData.detail)
			return replyOrfollowUp(interaction, {
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
		handleDrawRequest(user, playerData, interaction, tr, emoji);
	}
};

async function handleDrawRequest(user, playerData, interaction, tr, emoji) {
	const drawTask = async () => {
		try {
			const characters =
				(await loadCharacters(playerData.player.uid)) ||
				playerData.characters;

			const imageBuffer = await mainPage(playerData, interaction);
			const image = new AttachmentBuilder(imageBuffer, {
				name: `${playerData.player.uid}.png`
			});

			replyOrfollowUp(interaction, {
				embeds: [],
				// embeds: [
				//   new EmbedBuilder()
				//     .setConfig("#F6F1F1")
				//     .setAuthor({
				//       name: playerData.player.uid,
				//       iconURL: image_Header + "/" + playerData.player.avatar.icon,
				//     })
				//     .setTitle(playerData.player.nickname)
				//     .setDescription(
				//       `\`\`\`md\n ${
				//         playerData.player.signature == ""
				//           ? tr("profile_nonSign")
				//           : playerData.player.signature
				//       } \n\`\`\``
				//     )
				//     .addFields(
				//       {
				//         name: `${emoji.level} ${tr("profile_tLevel")} ${
				//           playerData.player.level
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.world} ${tr("profile_qLevel")} ${
				//           playerData.player.world_level
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.friends} ${tr("profile_friends")} ${
				//           playerData.player.friend_count
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.avatar} ${tr("profile_characters")} ${
				//           playerData.player.space_info.avatar_count
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.lightcone} ${tr("profile_lightcone")} ${
				//           playerData.player.space_info.light_cone_count
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.book} ${tr("profile_achievement")} ${
				//           playerData.player.space_info.achievement_count
				//         }`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.activity} ${tr("profile_forgottenHall")}`,
				//         value: "\u200b",
				//         inline: false,
				//       },
				//       {
				//         name: `${emoji.AbyssIcon01} ${tr("profile_memory")} ${
				//           playerData.player.space_info.challenge_data.maze_group_index
				//         }/15`,
				//         value: "\u200b",
				//         inline: true,
				//       },
				//       {
				//         name: `${emoji.AbyssIcon02} ${tr("profile_memoryOfChaos")} ${
				//           playerData.player.space_info.challenge_data.maze_group_id
				//         }/10`,
				//         value: "\u200b",
				//         inline: true,
				//       }
				//     )
				//     .setThumbnail(image_Header + "/" + playerData.characters[0].icon),
				// ],
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
			replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(
							`${tr("draw_fail")}\n${tr("err_code")}${error}`
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
		replyOrfollowUp(interaction, {
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(
						`${tr("draw_wait", {
							z: drawQueue.length
						})}`
					)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});
}
