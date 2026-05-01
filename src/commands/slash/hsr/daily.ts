import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	MessageFlags
} from "discord.js";
import { getRandomColor, getUserHSRData } from "@/utilities/index.js";
import { buildHSRDailyCard } from "@/utilities/canvas/dailyCard.js";
import { database } from "@/index.js";
import { TranslationFunction } from "@/types/index.js";

// 类型定义
interface TimeChoice {
	name: string;
	value: string;
}

interface AutoDailyConfig {
	channelId: string;
	tag: string;
	time?: string;
	timeZone?: string;
}

interface DailyInfo {
	total_sign_day: number;
	month_last_day: boolean;
	sign_cnt_missed: number;
}

interface DailyReward {
	month: number;
}

interface DailyRewards {
	awards: Array<{
		name: string;
		cnt: number;
		icon: string;
	}>;
}

interface DailyClaimResponse {
	code: number;
	info: {
		is_sign: boolean;
	};
}

const timeChoices: TimeChoice[] = Array.from({ length: 24 }, (_, i) => ({
	name: i < 10 ? `0${i}` : `${i}`,
	value: `${i}`
}));

export default {
	data: new SlashCommandBuilder()
		.setName("daily")
		.setDescription("Daily check-in")
		.setNameLocalizations({
			"zh-TW": "每日簽到"
		})
		.setDescriptionLocalizations({
			"zh-TW": "領取每日簽到獎勵"
		})
		.addStringOption(option =>
			option
				.setName("account")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "帳號"
				})
				.setDescriptionLocalizations({
					"zh-TW": "..."
				})
				.setRequired(false)
				.setAutocomplete(true)
		)
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
		)
		.addStringOption(option =>
			option
				.setName("autosign")
				.setDescription(
					"Automatic check-in at 10am every morning, messages will be sent wherever command used!"
				)
				.setNameLocalizations({
					"zh-TW": "自動簽到"
				})
				.setDescriptionLocalizations({
					"zh-TW": "每天自動簽到，訊息會在使用指令的地方自動發送！"
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
		.addStringOption(option =>
			option
				.setName("time")
				.setDescription("Automatic check-in time")
				.setNameLocalizations({
					"zh-TW": "簽到時間"
				})
				.setDescriptionLocalizations({
					"zh-TW": "自動簽到的時間"
				})
				.setRequired(false)
				.addChoices(...timeChoices)
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
						"是否在自動簽到中標註，開啟這個也相當於開啟了自動簽到"
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
		),

	/**
	 *
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {TranslationFunction} tr
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	): Promise<any> {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const haveAccount = await database.get(
			`${interaction.user.id}.account`
		);
		if (!haveAccount) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
						)
						.setTitle(tr("daily_NonAccount"))
						.setDescription(tr("daily_NonAccountDesc"))
				]
			});
		}

		const accountIndex = interaction.options.getString("account") || "0";
		const user = interaction.options.getUser("user") ?? interaction.user;
		const auto = interaction.options.getString("autosign");
		const time = interaction.options.getString("time");
		const tag = interaction.options.getString("tag");

		if (auto === "off") {
			await database.delete(`autoDaily.${interaction.user.id}`);
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("autoDaily_Off"))
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
						)
				]
			});
		} else if (time || tag || auto === "on") {
			const existingConfig = (await database.get(
				`autoDaily.${interaction.user.id}`
			)) as AutoDailyConfig | null;

			const autoDailyConfig: AutoDailyConfig = {
				channelId: interaction.channel!.id,
				tag: tag || existingConfig?.tag || "false",
				time: time || existingConfig?.time || "13"
			};

			if (existingConfig?.timeZone) {
				autoDailyConfig.timeZone = existingConfig.timeZone;
			}

			await database.set(
				`autoDaily.${interaction.user.id}`,
				autoDailyConfig
			);

			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#A2CDB0")
						.setTitle(tr("autoDaily_On"))
						.setDescription(
							tr("autoDaily_Time", {
								time:
									"`" +
									(autoDailyConfig.time || "13") +
									":00`"
							}) +
								"\n" +
								tr("autoDaily_Tag", {
									z:
										autoDailyConfig.tag === "true"
											? "`" + tr("True") + "`"
											: "`" + tr("False") + "`"
								})
						)
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1120715314678730832/kuru.gif"
						)
				]
			});
		}

		const hsr = await getUserHSRData(
			interaction,
			tr,
			user.id,
			parseInt(accountIndex),
			{ validationType: "daily" }
		);
		if (!hsr) return;

		const info: DailyInfo = await hsr.daily.info();
		const reward: DailyReward = await hsr.daily.reward();
		const rewards: DailyRewards = await hsr.daily.rewards();
		const res: DailyClaimResponse = await hsr.daily.claim();

		if (res.code === -5003 || res.info.is_sign)
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("daily_Signed"))
				]
			});

		// info.total_sign_day is post-claim (already includes today)
		const idx = info.total_sign_day - 1; // 0-based index of today's reward
		const ystSign = rewards.awards[idx - 1];
		const todaySign = rewards.awards[idx] || rewards.awards[0];
		const nextSigns = [
			rewards.awards[idx + 1] || rewards.awards[0],
			rewards.awards[idx + 2] || rewards.awards[0],
			rewards.awards[idx + 3] || rewards.awards[0],
		];
		const mkReward = (r: any) => ({
			name: r?.name || "",
			count: r?.cnt ?? 1,
			...(r?.icon ? { icon: r.icon as string } : {}),
		});

		let cardFile: { attachment: Buffer; name: string } | null = null;
		try {
			const buf = await buildHSRDailyCard({
				uid: (hsr as any).uid?.toString() || "",
				nickname: interaction.user.displayName || "旅行者",
				status: "success",
				totalDays: info.total_sign_day,
				month: reward.month,
				signCntMissed: info.sign_cnt_missed,
				...(ystSign ? { yesterdayReward: { ...mkReward(ystSign), claimed: idx > 0 } } : {}),
				todayReward: mkReward(todaySign),
				nextRewards: [mkReward(nextSigns[0]), mkReward(nextSigns[1]), mkReward(nextSigns[2])],
			});
			cardFile = { attachment: buf, name: "daily-hsr.png" };
		} catch (e) {
			// fall through to embed-only reply
		}

		if (cardFile) {
			const { AttachmentBuilder } = await import("discord.js");
			const file = new AttachmentBuilder(cardFile.attachment, { name: cardFile.name });
			interaction.editReply({ files: [file] });
		} else {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#A2CDB0")
						.setTitle(tr("daily_SignSuccess"))
						.setThumbnail(todaySign?.icon || null)
						.setDescription(
							`${tr("daily_Description", { a: `**${todaySign?.name}** x${todaySign?.cnt}` })}`
						)
						.addFields(
							{
								name: tr("daily_Month"),
								value: `\`${reward.month}\` 月`,
								inline: true
							},
							{
								name: tr("daily_SignedDay", { z: `\`${info.total_sign_day}\`` }),
								value: "\u200b",
								inline: true
							},
							{
								name: tr("daily_MissedDay", { z: `\`${info.sign_cnt_missed}\`` }),
								value: "\u200b",
								inline: true
							}
						)
				]
			});
		}
	}
};
