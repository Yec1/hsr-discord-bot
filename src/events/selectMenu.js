import { client } from "../index.js";
import {
	Events,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder
} from "discord.js";
import { getNews } from "../services/request.js";
import { i18nMixin, toI18nLang } from "../services/i18n.js";

client.on(Events.InteractionCreate, async interaction => {
	const { locale, customId, values } = interaction;
	const tr = i18nMixin(toI18nLang(locale) || "en");

	if (customId === "news_type")
		await handleNewsTypeInteraction(interaction, tr, values);
	else if (customId === "news_post")
		await handleNewsPostInteraction(interaction, tr, values);
});

async function handleNewsTypeInteraction(interaction, tr, values) {
	await interaction.deferUpdate();
	const type = values[0];
	const newsData = await getNews(interaction.locale.toLowerCase(), type);

	const options = newsData.data.list.map((data, i) => {
		const date = new Date(data.post.created_at * 1000);
		const label =
			data.post.subject.length < 100
				? data.post.subject
				: data.post.subject.slice(0, 97).concat("...");
		const description = `${date.getUTCFullYear()} ${tr("year")} ${
			date.getUTCMonth() + 1
		} ${tr("month")} ${date.getUTCDate()} ${tr("day")}`;
		const value = `${type}-${i}`;

		return { label, description, value };
	});

	await interaction.message.edit({
		components: [
			new ActionRowBuilder().addComponents(
				createStringSelectMenu(tr("news_selpost"), "news_post", options)
			),
			new ActionRowBuilder().addComponents(
				createStringSelectMenu(tr("news_seltype"), "news_type", [
					{ label: tr("news_notice"), emoji: "🔔", value: "1" },
					{ label: tr("news_events"), emoji: "🔥", value: "2" },
					{ label: tr("news_info"), emoji: "🗞️", value: "3" }
				])
			)
		]
	});
}

async function handleNewsPostInteraction(interaction, tr, values) {
	await interaction.deferUpdate();
	const [type, index] = values[0].split("-");
	const newsData = await getNews(interaction.locale.toLowerCase(), type);
	const data = newsData.data.list[index];
	const date = new Date(data.post.created_at * 1000);

	await interaction.message.edit({
		embeds: [
			new EmbedBuilder()
				.setConfig(
					null,
					`${date.getUTCFullYear()} ${tr("year")} ${
						date.getUTCMonth() + 1
					} ${tr("month")} ${date.getUTCDate()} ${tr("day")}`
				)
				.setAuthor({
					iconURL: data.user.avatar_url ?? "",
					name: data.user.nickname ?? ""
				})
				.setTitle(data.post.subject ?? tr("none"))
				.setURL(`https://www.hoyolab.com/article/${data.post.post_id}`)
				.setDescription(
					data.post.content.length < 2000
						? data.post.content
						: data.post.content.slice(0, 1997).concat("...") ??
								`\`${tr("none")}\``
				)
				.setImage(data.image_list[0]?.url ?? data.cover_list[0]?.url)
		]
	});
}

function createStringSelectMenu(placeholder, customId, options) {
	return new StringSelectMenuBuilder()
		.setPlaceholder(placeholder)
		.setCustomId(customId)
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(options);
}
