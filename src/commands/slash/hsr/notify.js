import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import moment from "moment-timezone";
import { staminaColor } from "../../../services/request.js";

export default {
	data: new SlashCommandBuilder()
		.setName("note")
		.setDescription("View current stamina and expedition progress")
		.setNameLocalizations({
			"zh-TW": "即時便箋"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看當前體力和委託進度"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("autonotify")
				.setDescription(
					"Automatic notification of stamina limit or expedition"
				)
				.setNameLocalizations({
					"zh-TW": "自動通知"
				})
				.setDescriptionLocalizations({
					"zh-TW":
						"自動通知體力額度或者委託，訊息會在使用指令的地方自動發送！"
				})
				.addStringOption(option =>
					option
						.setName("autonotify")
						.setDescription(
							"Automatic notification of stamina limit or expedition"
						)
						.setNameLocalizations({
							"zh-TW": "自動通知"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"自動通知體力額度或者委託，訊息會在使用指令的地方自動發送！"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "on"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "off"
							}
						)
				)
				.addIntegerOption(option =>
					option
						.setName("stamina")
						.setDescription(
							"Detect once every hour whether the current stamina is greater than the set value"
						)
						.setNameLocalizations({
							"zh-TW": "體力通知"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"每個小時偵測一次當前體力是否大於設置的值，大於則通知"
						})
						.setRequired(false)
						.setMaxValue(240)
						.setMinValue(0)
				)
				.addStringOption(option =>
					option
						.setName("expedition")
						.setDescription(
							"Whether to notify when the expedition can be claimed"
						)
						.setNameLocalizations({
							"zh-TW": "委託通知"
						})
						.setDescriptionLocalizations({
							"zh-TW": "委託可領取時是否通知"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "true"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "false"
							}
						)
				)
				.addStringOption(option =>
					option
						.setName("tag")
						.setDescription(
							"Whether mark in the automatic check-in, turn on this also turn on the automatic check-in"
						)
						.setNameLocalizations({
							"zh-TW": "標註"
						})
						.setDescriptionLocalizations({
							"zh-TW":
								"是否在自動通知中標註，開啟這個也相當於開啟了自動通知"
						})
						.setRequired(false)
						.addChoices(
							{
								name: "On",
								name_localizations: {
									"zh-TW": "開啟"
								},
								value: "true"
							},
							{
								name: "Off",
								name_localizations: {
									"zh-TW": "關閉"
								},
								value: "false"
							}
						)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("check")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "查看"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setRequired(false)
				)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const cmd = interaction.options.getSubcommand();
		if (cmd == "check") {
			const user =
				interaction.options.getUser("user") ?? interaction.user;
			try {
				const hsr = new HonkaiStarRail({
					cookie:
						(await db.has(`${user.id}.account`)) &&
						(await db.get(`${user.id}.account`))[0].cookie
							? (await db.get(`${user.id}.account`))[0].cookie
							: await db.get(`${user.id}.cookie`),
					lang: (await db?.has(`${interaction.user.id}.locale`))
						? (await db?.get(`${interaction.user.id}.locale`)) ==
						  "tw"
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

				await interaction.deferReply();

				const res = await hsr.record.note();

				let title = "";
				if (res.current_stamina + 10 >= res.max_stamina)
					title += ` ${tr("notify_staminaMax")}`;

				let isTitleAdded = false;
				for (let expedition of res.expeditions) {
					if (expedition.remaining_time === 0 && !isTitleAdded) {
						title += `${tr("notify_expeditionMax")}`;
						isTitleAdded = true;
					}
				}

				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig(staminaColor(res.current_stamina))
							.setThumbnail(
								user.displayAvatarURL({
									size: 4096,
									dynamic: true
								})
							)
							.setAuthor({
								name: `${tr("notify_title")} - ${hsr.uid}`,
								iconURL:
									"https://media.discordapp.net/attachments/1057244827688910850/1121043103831293992/NoviceBookIcon.png"
							})
							.addFields(
								{
									name: `${emoji.stamina} ${tr(
										"notify_stamina"
									)} ${res.current_stamina} / ${
										res.max_stamina
									} ** ** ${tr("notify_re")}${
										res.stamina_recover_time <= 0
											? `\`${tr("notify_reAll")}\``
											: `<t:${
													moment(new Date()).unix() +
													res.stamina_recover_time
											  }:R>`
									}`,
									value: "\u200b",
									inline: false
								},
								{
									name: `${emoji.reserve_stamina} ${tr(
										"notify_staminaBack"
									)} ${res.current_reserve_stamina} / 2400`,
									value: "\u200b",
									inline: false
								},
								{
									name: `${emoji.daily} ${tr(
										"notify_daily"
									)} ${res.current_train_score} / ${
										res.max_train_score
									}`,
									value: "\u200b",
									inline: false
								},
								{
									name: `${emoji.rogue} ${tr(
										"notify_rogue"
									)} ${res.current_rogue_score} / ${
										res.max_rogue_score
									}`,
									value: "\u200b",
									inline: false
								},
								{
									name: `${emoji.cocoon} ${tr(
										"notify_cocoon"
									)} ${res.weekly_cocoon_cnt} / ${
										res.weekly_cocoon_limit
									}`,
									value: "\u200b",
									inline: false
								},
								{
									name: `${emoji.epedition} ${tr(
										"notify_epedition"
									)} ${res.accepted_epedition_num} / ${
										res.total_expedition_num
									}`,
									value:
										res.expeditions.length != 0
											? res.expeditions
													.map(expedition => {
														return `• **${
															expedition.name
														}**：${
															expedition.remaining_time <=
															0
																? `\`${tr(
																		"notify_claim"
																  )}\``
																: `<t:${
																		moment(
																			new Date()
																		).unix() +
																		expedition.remaining_time
																  }:R>`
														}`;
													})
													.join("\n")
											: "\u200b",
									inline: false
								}
							)
					]
				});
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
								`<@${user.id}>\n\n${desc}\n\n${tr(
									"err_code"
								)}${e}`
							)
					],
					ephemeral: true
				});
			}
		}

		if (cmd == "autonotify") {
			try {
				const userdb = await db?.get(
					`autoNotify.${interaction.user.id}`
				);
				const auto = interaction.options.getString("autonotify");
				const stamina = interaction.options.getInteger("stamina");
				const expedition = interaction.options.getString("expedition");
				const tag = interaction.options.getString("tag");

				if (
					(userdb && !(stamina || expedition || tag)) ||
					auto == "off"
				) {
					await db.delete(`autoNotify.${interaction.user.id}`);
					return await interaction.reply({
						embeds: [
							new EmbedBuilder()
								.setConfig("#E76161")
								.setTitle(tr("autoNote_off"))
								.setThumbnail(
									"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
								)
						],
						ephemeral: true
					});
				}

				const userAccount = await db.get(
					`${interaction.user.id}.account`
				);

				if (!(userAccount?.[0].cookie && userAccount?.[0].uid))
					throw new Error();

				await db.set(`autoNotify.${interaction.user.id}`, {
					channelId: interaction.channel.id,
					tag: tag ? tag : false,
					stamina: stamina ? stamina : 230,
					expedition: expedition ? expedition : false
				});

				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#A2CDB0")
							.setTitle(tr("autoNote_on"))
							.setDescription(
								`${tr("autoNote_stamina", {
									z: stamina ? `\`${stamina}\`` : `\`170\``
								})}\n${tr("autoNote_expedition", {
									z:
										expedition == "true"
											? `\`${tr("true")}\``
											: `\`${tr("false")}\``
								})}\n${tr("autoNote_tag", {
									z:
										tag == "true"
											? `\`${tr("true")}\``
											: `\`${tr("false")}\``
								})}`
							)
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
							)
					],
					ephemeral: true
				});
			} catch (e) {
				const userdb = (await db?.has(`${interaction.user.id}.account`))
					? (await db?.get(`${interaction.user.id}.account`))[0]
					: await db?.get(`${interaction.user.id}`);

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
								`<@${interaction.user.id}>\n\n${desc}`
							)
					],
					ephemeral: true
				});
			}
		}
	}
};
