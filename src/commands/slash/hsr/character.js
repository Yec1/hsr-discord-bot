import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";

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
		const uid = interaction.options.getInteger("uid")
			? interaction.options.getInteger("uid")
			: (await db.has(
					`${interaction.options.getUser("user")?.id}.account`
			  ))
			? (
					await db.get(
						`${interaction.options.getUser("user")?.id}.account`
					)
			  )[0].uid
			: (await db.has(`${interaction.options.getUser("user")?.id}.uid`))
			? await db.get(`${interaction.options.getUser("user")?.id}.uid`)
			: (await db.has(`${interaction.user.id}.account`))
			? (await db.get(`${interaction.user.id}.account`))[0].uid
			: (await db.has(`${interaction.user.id}.uid`))
			? await db.get(`${interaction.user.id}.uid`)
			: null;

		const user = interaction.options.getUser("user") ?? interaction.user;

		if (uid == null && user == interaction.user)
			return replyOrfollowUp(interaction, {
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("uid_non"))
						.setDescription(tr("uid_failedDesc"))
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

			const allCharacterOptions = characters.map((character, i) => {
				return {
					emoji: emoji[character.element],
					label: `${character.name} • ${tr("level2", {
						z: `${character.level} `
					})}`,
					value: `${user.id}-${i}`
				};
			});

			const chunkSize = 25;
			const characterOptionChunks = [];
			for (let i = 0; i < allCharacterOptions.length; i += chunkSize) {
				const chunk = allCharacterOptions.slice(i, i + chunkSize);
				characterOptionChunks.push(chunk);
			}

			const selectMenus = characterOptionChunks.map(
				(optionsChunk, index) => {
					const startIndex = index * chunkSize + 1;
					const endIndex = Math.min(
						startIndex + chunkSize - 1,
						allCharacterOptions.length
					);

					return new StringSelectMenuBuilder()
						.setPlaceholder(
							`${tr("profile_character")} ${tr(
								"character_placeholder",
								{
									s: startIndex,
									e: endIndex
								}
							)}`
						)
						.setCustomId(`characters-${index}`)
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(optionsChunk);
				}
			);

			replyOrfollowUp(interaction, {
				embeds: [],
				components: selectMenus.map(selectMenu => {
					return new ActionRowBuilder().addComponents(selectMenu);
				})
			});
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
