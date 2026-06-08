// src/commands/slash/hsr/profilebg.ts
// 讓使用者選擇個人簡介的背景圖

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder
} from "discord.js";
import type { TranslationFunction } from "@/types/index.js";
import {
	getBgPool,
	setUserBgPref,
	refreshBgWallpapers
} from "@/utilities/hsr/wallpaperManager.js";

export default {
	data: new SlashCommandBuilder()
		.setName("profilebg")
		.setDescription("Set your profile background image")
		.setNameLocalizations({
			"zh-TW": "簡介背景"
		})
		.setDescriptionLocalizations({
			"zh-TW": "設定你的個人簡介背景圖片"
		}),

	async execute(
		interaction: ChatInputCommandInteraction,
		tr: TranslationFunction
	) {
		await interaction.deferReply({ ephemeral: true });

		// Ensure the pool is populated
		let pool = await getBgPool();
		if (pool.length === 0) {
			await refreshBgWallpapers();
			pool = await getBgPool();
		}

		if (pool.length === 0) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setDescription("❌ 目前沒有可用的背景圖片，請稍後再試")
				]
			});
			return;
		}

		// Build select menu options (max 25)
		const options = [
			{
				label: "🎲 隨機（每日更換）",
				value: "random",
				description: "每天自動從官方新聞選一張背景"
			},
			...pool.slice(0, 24).map((article, i) => ({
				label: article.title.length > 100
					? article.title.slice(0, 97) + "..."
					: article.title,
				value: `fixed:${i}`,
				description: "固定此圖為個人簡介背景"
			}))
		];

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor("#7B8CDE")
					.setTitle("🖼️ 選擇個人簡介背景")
					.setDescription(
						"背景圖片來源：崩壞：星穹鐵道官方新聞（預告 & 版本更新）\n\n請從下方選單選擇你想要的背景："
					)
						.setImage(pool[0]?.url ?? null)
			],
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId(`profilebg_select:${interaction.user.id}`)
						.setPlaceholder("選擇背景圖片...")
						.addOptions(options)
				)
			]
		});
	}
};
