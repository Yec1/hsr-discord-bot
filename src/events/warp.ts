import { client, database } from "@/index.js";
import {
	AttachmentBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
	Events,
	MessageComponentInteraction,
	MessageFlags
} from "discord.js";
import {
	getRandomColor,
	getUserLang,
	drawInQueueReply
} from "@/utilities/index.js";
import { warpLog, warpLogImage } from "@/utilities/hsr/warp.js";
import { createTranslator, toI18nLang } from "@/utilities/core/i18n.js";
import Queue from "queue";

interface Translation {
	(key: string, params?: Record<string, string>): string;
}

interface WarpResults {
	collaboration_character: any[];
	collaboration_light_cone: any[];
	character: any[];
	light_cone: any[];
	regular: any[];
}

const drawQueue = new Queue({ autostart: true });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isModalSubmit()) {
		const locale =
			(await getUserLang(interaction.user.id)) ||
			toI18nLang(interaction.locale) ||
			"en";
		const tr = createTranslator(locale);

		if (interaction.customId == "simulator-set") {
			const current =
				interaction.fields.getTextInputValue("simset_pityFive");
			const soft = interaction.fields.getTextInputValue("simset_soft");
			const max = interaction.fields.getTextInputValue("simset_max");
			const chance =
				interaction.fields.getTextInputValue("simset_chance");
			const rateup =
				interaction.fields.getTextInputValue("simset_rateup");

			const inputMappings: Record<string, string> = {
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
					flags: MessageFlags.Ephemeral
				});

			if (Number(chance) < 0 || Number(chance) > 1)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_SimSetChanceError"))
					],
					flags: MessageFlags.Ephemeral
				});

			if (Number(rateup) < 0 || Number(rateup) > 1)
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
							)
							.setTitle(tr("warp_SimSetRateUpError"))
					],
					flags: MessageFlags.Ephemeral
				});

			// promise all
			await Promise.all([
				database.set(`${interaction.user.id}.sim.pityFive`, current),
				database.set(`${interaction.user.id}.sim.soft`, soft),
				database.set(`${interaction.user.id}.sim.max`, max),
				database.set(`${interaction.user.id}.sim.chance`, chance),
				database.set(`${interaction.user.id}.sim.rateup`, rateup)
			]);

			const simdb = await database.get(`${interaction.user.id}.sim`);

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(getRandomColor() as any)
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
				flags: MessageFlags.Ephemeral
			});
		}

		if (interaction.customId == "warp_query") {
			const url = interaction.fields.getTextInputValue("warpUrl");

			await interaction.deferReply();
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(tr("Searching"))
						.setColor(getRandomColor() as any)
						.setThumbnail(
							"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
						)
				]
			});
			const warpResults = (await warpLog(
				url,
				interaction,
				tr
			)) as unknown as WarpResults;

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
				interaction: MessageComponentInteraction,
				tr: Translation,
				datas: any[],
				title: string,
				type: string
			): Promise<void> {
				const drawTask = async () => {
					try {
						const imageBuffer = await warpLogImage(
							tr,
							datas,
							title,
							interaction.user.id
						);

						if (!imageBuffer) {
							throw new Error(tr("draw_ImageGenerationFailed"));
						}

						const image = new AttachmentBuilder(imageBuffer, {
							name: `warplog.png`
						});

						interaction.editReply({
							embeds: [],
							components: [
								(new ActionRowBuilder() as any).addComponents(
									new StringSelectMenuBuilder()
										.setCustomId("WarpMenu")
										.setPlaceholder(
											tr("warp_SelectMenuTitle")
										)
										.addOptions(
											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr(
														"warp_TypeCollaborationCharacter"
													)
												)
												.setValue(
													"collaboration_character"
												),

											new StringSelectMenuOptionBuilder()
												.setLabel(
													tr(
														"warp_TypeCollaborationLightcone"
													)
												)
												.setValue(
													"collaboration_light_cone"
												),
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
						console.error("处理跃迁请求时出错:", error);
						interaction.editReply({
							embeds: [
								new EmbedBuilder()
									.setColor("#E76161")
									.setTitle(tr("DrawError"))
									.setDescription(
										`\`${(error as Error).message}\``
									)
									.setThumbnail(
										"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png"
									)
							]
						});
					}
				};

				drawQueue.push(drawTask);

				if (drawQueue.length !== 1) {
					drawInQueueReply(
						interaction as any,
						tr("DrawInQueue", {
							position: (drawQueue.length - 1).toString()
						})
					);
				}
			}

			const resMessage = await interaction.editReply({
				embeds: [],
				components: [
					(new ActionRowBuilder() as any).addComponents(
						new StringSelectMenuBuilder()
							.setCustomId("WarpMenu")
							.setPlaceholder(tr("warp_SelectMenuTitle"))
							.addOptions(
								new StringSelectMenuOptionBuilder()
									.setLabel(
										tr("warp_TypeCollaborationCharacter")
									)
									.setValue("collaboration_character"),
								new StringSelectMenuOptionBuilder()
									.setLabel(
										tr("warp_TypeCollaborationLightcone")
									)
									.setValue("collaboration_light_cone"),
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
				await interaction.deferUpdate().catch(() => {});
				interaction.message.edit({
					embeds: [
						new EmbedBuilder()
							.setTitle(tr("Searching"))
							.setColor(getRandomColor() as any)
							.setThumbnail(
								"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png"
							)
					],
					components: []
				});
				switch (type) {
					case "collaboration_character":
						handleDrawRequest(
							interaction,
							tr,
							warpResults.collaboration_character,
							tr("warp_TypeCollaborationCharacter"),
							type
						);
						break;
					case "collaboration_light_cone":
						handleDrawRequest(
							interaction,
							tr,
							warpResults.collaboration_light_cone,
							tr("warp_TypeCollaborationLightcone"),
							type
						);
						break;
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
	return;
});
