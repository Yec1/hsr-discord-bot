import { client } from "../index.js";
import { i18nMixin, toI18nLang } from "../services/i18n.js";
import {
	AttachmentBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	Events
} from "discord.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";
import { indexImage } from "../services/forgottenHall.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isStringSelectMenu()) return;
	const tr = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	if (interaction.customId === "forgottenHall_Floor") {
		await interaction.update({ fetchReply: true });
		const [userId, i] = interaction.values[0].split("-");

		const hsr = new HonkaiStarRail({
			cookie: (await db.has(`${userId}.account`))
				? (await db.get(`${userId}.account`))[0].cookie
				: await db.get(`${userId}.cookie`),
			lang: (await db?.has(`${interaction.user.id}.locale`))
				? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
					? LanguageEnum.TRADIIONAL_CHINESE
					: LanguageEnum.ENGLISH
				: interaction.locale == "zh-TW"
				? LanguageEnum.TRADIIONAL_CHINESE
				: LanguageEnum.ENGLISH,
			uid: (await db.has(`${userId}.account`))
				? (await db.get(`${userId}.account`))[0].uid
				: await db.get(`${userId}.uid`)
		});

		const res = await hsr.record.forgottenHall();
		const floor = res.all_floor_detail[i];
		const imageBuffer = await indexImage(hsr.uid, res, floor, interaction);
		const image = new AttachmentBuilder(imageBuffer, {
			name: `${floor.name}.png`
		});

		await interaction.editReply({
			files: [image],
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("forgottenHall_selectFloor"))
						.setCustomId("forgottenHall_Floor")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							res.all_floor_detail.map((floor, i) => {
								return {
									label: `${floor.name.replace(
										/<\/?[^>]+(>|$)/g,
										""
									)}`,
									description: `${tr("forgottenHall_desc", {
										s: `${floor.star_num}`,
										r: `${floor.round_num}`
									})}`,
									value: `${userId}-${i}`
								};
							})
						)
				)
			]
		});
	}
});
