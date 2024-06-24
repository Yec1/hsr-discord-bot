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
import {
	getRandomColor,
	getUserLang,
	drawInQueueReply
} from "../utilities/utilities.js";
import { warpLog, warpLogImage } from "../utilities/hsr/warp.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";
import Queue from "queue";

const db = client.db;
const drawQueue = new Queue({ autostart: true });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isModalSubmit()) {
		const locale = await getUserLang(interaction.user.id);
		const tr = i18nMixin(toI18nLang(locale) || "en");

		if (interaction.customId == "simulator-set") {
			const current =
				interaction.fields.getTextInputValue("simset_pityFive");
			const soft = interaction.fields.getTextInputValue("simset_soft");
			const max = interaction.fields.getTextInputValue("simset_max");
			const chance =
				interaction.fields.getTextInputValue("simset_chance");
			const rateup =
				interaction.fields.getTextInputValue("simset_rateup");

			const inputMappings = {
				current: tr("Current"),
				soft: tr("Soft"),
				max: tr("Max"),
				chance: tr("Chance"),
				rateup: tr("Rateup")
			};

			const invalidInputs = Object.keys(inputMappings)
				.filter(field => isNaN(eval(field)))
				.map(field => inputMappings[field]);

			if (invalidInputs.length > 0)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(
								tr("warp_SimSetError", {
									z: invalidInputs.join(", ")
								})
							)
					],
					ephemeral: true
				});

			if (chance < 0 || chance > 1)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_SimSetChanceError"))
					],
					ephemeral: true
				});

			if (rateup < 0 || rateup > 1)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_SimSetRateUpError"))
					],
					ephemeral: true
				});

			await db.set(`${interaction.user.id}.sim.pityFive`, current);
			await db.set(`${interaction.user.id}.sim.soft`, soft);
			await db.set(`${interaction.user.id}.sim.max`, max);
			await db.set(`${interaction.user.id}.sim.chance`, chance);
			await db.set(`${interaction.user.id}.sim.rateup`, rateup);

			const simdb = await db.get(`${interaction.user.id}.sim`);

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor())
						.setTitle(tr("warp_SimSetSus"))
						.setThumbnail(interaction.user.displayAvatarURL())
						.addFields(
							{
								name: tr("Current"),
								value: `${simdb?.pityFive || "0"}`,
								inline: true
							},
							{
								name: tr("Soft"),
								value: `${simdb?.soft || "75"}`,
								inline: true
							},
							{
								name: tr("Max"),
								value: `${simdb?.max || "90"}`,
								inline: true
							},
							{
								name: tr("Chance"),
								value: `${simdb?.chance * 100 || "0.6"}%`,
								inline: true
							},
							{
								name: tr("Rateup"),
								value: `${simdb?.rateup * 100 || "50"}%`,
								inline: true
							},
							{
								name: tr("Guarantee"),
								value:
									simdb?.guaranteeFive == "true"
										? tr("True")
										: tr("False"),
								inline: true
							}
						)
				],
				ephemeral: true
			});
		}

		if (interaction.customId == "warp_query") {
			const url = interaction.fields.getTextInputValue("warpUrl");

			await interaction.deferReply();
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor())
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				],
				fetchReply: true
			});
			const warpResults = await warpLog(url, interaction, tr);

			if (!warpResults)
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_Error"))
							.setDescription(tr("warp_ErrorDesc"))
					]
				});

			async function handleDrawRequest(
				interaction,
				tr,
				datas,
				title,
				type
			) {
				const drawTask = async () => {
					try {
						const imageBuffer = await warpLogImage(
							interaction,
							tr,
							datas,
							title
						);
						if (imageBuffer == null)
							throw new Error(tr("draw_NoData"));

						const image = new AttachmentBuilder(imageBuffer, {
							name: `warplog.png`
						});

						interaction.editReply({
							embeds: [
								new EmbedBuilder().setImage(
									`attachment://${image.name}`
								)
							],
							components: [
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder()
										.setCustomId("WarpMenu")
										.setPlaceholder(
											tr("warp_SelectMenuTitle")
										)
										.addOptions(
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_TypeCharacter")
												)
												.setValue("character"),
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_TypeLightcone")
												)
												.setValue("lightcone"),
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr("warp_TypeRegular")
												)
												.setValue("regular")
										)
								)
							],
							files: [image]
						});
					} catch (error) {
						interaction.editReply({
							embeds: [
								new EmbedBuilder()
									.setColor("#E76161")
									.setTitle(tr("DrawError"))
									.setDescription(`\`${error}\``)
									.setThumbnail(
										"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
									)
							],
							fetchReply: true
						});
					}
				};

				drawQueue.push(drawTask);

				if (drawQueue.length !== 1) {
					drawInQueueReply(
						interaction,
						tr("DrawInQueue", { position: drawQueue.length - 1 })
					);
				}
			}

			const resMessage = await interaction.editReply({
				embeds: [],
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
							.setCustomId("WarpMenu")
							.setPlaceholder(tr("warp_SelectMenuTitle"))
							.addOptions(
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_TypeCharacter"))
									.setValue("character"),
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_TypeLightcone"))
									.setValue("lightcone"),
								new StringSelectMenuOptionBuilder()
									.setLabel(tr("warp_TypeRegular"))
									.setValue("regular")
							)
					)
				]
			});

			const collector = resMessage.createMessageComponentCollector({
				time: 30 * 60 * 1000,
				componentType: ComponentType.StringSelect
			});

			collector.on("collect", async interaction => {
				const type = interaction.values[0];
				await interaction.deferUpdate({ fetchReply: true });
				interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("Searching"))
							.setColor(getRandomColor())
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
							)
					]
				});
				switch (type) {
					case "character":
						handleDrawRequest(
							interaction,
							tr,
							warpResults.character,
							tr("warp_TypeCharacter"),
							type
						);
						break;
					case "lightcone":
						handleDrawRequest(
							interaction,
							tr,
							warpResults.light_cone,
							tr("warp_TypeLightcone"),
							type
						);
						break;
					case "regular":
						handleDrawRequest(
							interaction,
							tr,
							warpResults.regular,
							tr("warp_TypeRegular"),
							type
						);
						break;
				}
			});
		}
	}
});
