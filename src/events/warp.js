import { client } from "../index.js";
import {
	AttachmentBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
	Events
} from "discord.js";
import { warpLog, warpLogImage } from "../services/warp.js";
import { i18nMixin, toI18nLang } from "../services/i18n.js";
import { QuickDB } from "quick.db";
import Queue from "queue";

const db = new QuickDB();
const drawQueue = new Queue({ autostart: true });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isModalSubmit()) {
		const tr = i18nMixin(
			(await db?.has(`${interaction.user.id}.locale`))
				? await db?.get(`${interaction.user.id}.locale`)
				: toI18nLang(interaction.locale) || "en"
		);
		if (interaction.customId == "warp_query") {
			const url = interaction.fields.getTextInputValue("warpUrl");

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("profile_Searching"))
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});

			const warpResults = await warpLog(url, interaction);

			if (!warpResults)
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setConfig("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_err"))
							.setDescription(tr("warp_errDesc"))
					]
				});

			async function handleDrawRequest(interaction, datas, title) {
				const drawTask = async () => {
					try {
						const imageBuffer = await warpLogImage(
							interaction,
							datas,
							title
						);
						if (imageBuffer == null)
							throw new Error(tr("draw_NoData"));

						const image = new AttachmentBuilder(imageBuffer, {
							name: `${title}.png`
						});

						// const description =
						//   datas?.data.length > 0
						//     ? datas.data
						//         .map(({ name, count }) => {
						//           const starEmoji =
						//             count <= 60 ? emoji.yellowStar : emoji.whiteStar;
						//           return `${starEmoji} ${name} \`${count}\` ${tr("warp")}`;
						//         })
						//         .join("\n")
						//     : tr("none");

						// if (description.length > 2048)
						//   description = description.slice(0, 2045) + "...";

						// const average = datas.average;
						// const sentenceMap = {
						//   0: tr("warp_0"),
						//   30: tr("warp_30"),
						//   50: tr("warp_50"),
						//   60: tr("warp_60"),
						//   80: tr("warp_80"),
						// };

						// let sentence = "";
						// for (const key in sentenceMap) {
						//   if (average > key) sentence = sentenceMap[key];
						//   else sentence = "\u200b";
						// }

						interaction.message.edit({
							embeds: [],
							// embeds: [
							//   new EmbedBuilder()
							//     .setConfig()
							//     .setTitle(`${emoji.DrawcardIcon} ${title}`)
							//     .setDescription(description)
							//     .setThumbnail(
							//       interaction.user.displayAvatarURL({
							//         size: 4096,
							//         dynamic: true,
							//       })
							//     )
							//     .addFields(
							//       {
							//         name: `${tr("total")} ${datas.total} ${tr("warp")} • ${
							//           emoji.s900001
							//         } ${datas.total * 160}`,
							//         value: "\u200b",
							//         inline: true,
							//       },
							//       {
							//         name: tr("warp_pity", {
							//           z: datas.pity,
							//         }),
							//         value: "\u200b",
							//         inline: true,
							//       },
							//       {
							//         name:
							//           average == 0
							//             ? tr("warp_nonAverage")
							//             : tr("warp_average", {
							//                 z: average,
							//               }),
							//         value: sentence,
							//         inline: true,
							//       }
							//     )
							//     .setImage(
							//       "https://media.discordapp.net/attachments/1057244827688910850/1120335669764554752/background.png"
							//     ),
							// ],
							components: [
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder()
										.setCustomId("WarpMenu")
										.setPlaceholder(
											tr("warp_selectMenuTitle")
										)
										.addOptions(
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_typeCharacter")
												)
												.setValue("character"),
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_typeLightcone")
												)
												.setValue("lightcone"),
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_typeRegular")
												)
												.setValue("regular")
										)
								)
							],
							files: [image]
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

			const res = await interaction.editReply({
				embeds: [],
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setCustomId("WarpMenu")
							.setPlaceholder(tr("warp_selectMenuTitle"))
							.addOptions(
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_typeCharacter"))
									.setValue("character"),
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_typeLightcone"))
									.setValue("lightcone"),
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_typeRegular"))
									.setValue("regular")
							)
					)
				]
			});

			const collector = res.createMessageComponentCollector({
				time: 30 * 60 * 1000,
				componentType: ComponentType.StringSelect
			});

			collector.on("collect", async interaction => {
				const type = interaction.values[0];
				await interaction.deferUpdate({ fetchReply: true });
				await interaction.message.edit({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setTitle(tr("profile_imageLoading"))
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1126170338850504704/a_08824a3a9df7a4c9acfc3c7777be4034.gif"
							)
					],
					components: []
				});
				switch (type) {
					case "character":
						handleDrawRequest(
							interaction,
							warpResults.character,
							tr("warp_typeCharacter")
						);
						break;
					case "lightcone":
						handleDrawRequest(
							interaction,
							warpResults.light_cone,
							tr("warp_typeLightcone")
						);
						break;
					case "regular":
						handleDrawRequest(
							interaction,
							warpResults.regular,
							tr("warp_typeRegular")
						);
						break;
				}
			});
		}
	}
});
