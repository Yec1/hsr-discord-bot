import {
	ActionRowBuilder,
	AttachmentBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import { drawFloorImage } from "@/utilities/hsr/forgottenhall.js";
import {
	drawInQueueReply,
	getRandomColor,
	getUserHSRData
} from "@/utilities/index.js";
import type { TranslationFunction } from "@/types/index.js";

const searchingThumbnail =
	"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png";
const errorThumbnail =
	"https://cdn.discordapp.com/attachments/1057244827688910850/1149967646884905021/1689079680rzgx5_icon.png";

export async function handleForgottenHall(
	interaction: StringSelectMenuInteraction,
	tr: TranslationFunction,
	value: string,
	drawQueue: { length: number; push(task: () => Promise<void>): unknown },
	drawQueueMax: number
): Promise<void> {
	await interaction.update({
		embeds: [
			new EmbedBuilder()
				.setTitle(tr("Searching"))
				.setColor(getRandomColor() as any)
				.setThumbnail(searchingThumbnail)
		],
		components: []
	});

	const drawTask = async () => {
		try {
			const [userId, mode, time, floorIndex] = value.split("-");
			const hsr = await getUserHSRData(interaction, tr, userId || "", 0);
			if (!hsr) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setTitle(tr("DrawError"))
							.setDescription("無法取得遊戲資料")
							.setThumbnail(errorThumbnail)
					]
				});
				return;
			}

			const modeNumber = Number.parseInt(mode || "0");
			const timeNumber = Number.parseInt(time || "0");
			const floorNumber = Number.parseInt(floorIndex || "0");
			const res = await hsr.record.forgottenHall(modeNumber, timeNumber);
			if (res.has_data == false) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor("#E76161")
							.setThumbnail(errorThumbnail)
							.setTitle(tr("forgottenHall_NonData"))
							.setDescription(tr("forgottenHall_NonDataDesc"))
					]
				});
				return;
			}

			const floor = res.all_floor_detail[floorNumber];
			const imageBuffer = await drawFloorImage(
				tr,
				hsr.uid?.toString() || "",
				res as any,
				modeNumber,
				floor
			);
			if (!imageBuffer) throw new Error(tr("profile_NoImageData"));

			const image = new AttachmentBuilder(imageBuffer, {
			name: `${floor?.maze_id || "floor"}.webp`
		});
			const commonParams = { s: `${floor?.star_num || 0}` };
			await interaction.editReply({
				content: "",
				embeds: [],
				files: [image],
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						new StringSelectMenuBuilder()
							.setPlaceholder(tr("forgottenHall_SelectFloor"))
							.setCustomId("forgottenHall_Floor")
							.setMinValues(1)
							.setMaxValues(1)
							.addOptions(
								res.all_floor_detail.map((nextFloor: any, index: number) => {
									const floorScore = (node: any) =>
										Number.parseInt(node?.score) || 0;
									const totalScore =
										floorScore(nextFloor.node_1) +
										floorScore(nextFloor.node_2) +
										floorScore(nextFloor.node_3);
									return {
										label: `${nextFloor.name.replace(/<\/?[^>]+(>|$)/g, "")}`,
										description:
											modeNumber === 3
												? tr("forgottenHall_FloorFormat3", {
													...commonParams,
													z: `${totalScore}`
												})
												: modeNumber === 2
													? tr("forgottenHall_FloorFormat2", {
															...commonParams,
															r: `${nextFloor.round_num}`,
															z: `${totalScore}`
														})
													: tr("forgottenHall_FloorFormat1", {
															...commonParams,
															r: `${nextFloor.round_num}`
														}),
										value: `${userId}-${mode}-${time}-${index}`
									};
								})
							)
					)
				]
			});
		} catch (error) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle(tr("DrawError"))
						.setDescription(`\`${error}\``)
						.setThumbnail(errorThumbnail)
				]
			});
		}
	};

	if (drawQueue.length >= drawQueueMax) {
		await interaction
			.editReply({ content: "⚠️ 繪製佇列已滿，請稍後再試。" })
			.catch(() => {});
		return;
	}
	drawQueue.push(drawTask);
	if (drawQueue.length !== 1) {
		await drawInQueueReply(
			interaction as any,
			tr("DrawInQueue", { position: drawQueue.length - 1 })
		);
	}
}
