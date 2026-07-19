import {
	ActionRowBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import { getRandomColor } from "@/utilities/index.js";
import {
	getNewsList,
	getPostFull,
	parsePostContent
} from "@/utilities/news.js";
import type { TranslationFunction } from "@/types/index.js";
import type { NewsData, PostData } from "@/types/selectMenu.js";

const searchingThumbnail =
	"https://cdn.discordapp.com/attachments/1231256542419095623/1246723955084099678/Bailu.png";

export async function handleNews(
	interaction: StringSelectMenuInteraction,
	tr: TranslationFunction,
	value: string
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

	if (interaction.customId === "news_type") {
		const newsData: NewsData = await getNewsList(
			interaction.locale.toLowerCase(),
			value
		);

		await interaction.editReply({
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("news_SelectPost"))
						.setCustomId("news_post")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							newsData.data.list.map(data => {
								const date = new Date(data.post.created_at * 1000);
								return {
									label:
										data.post.subject.length < 100
											? data.post.subject
											: `${data.post.subject.slice(0, 97)}...`,
									description:
										date.getUTCFullYear() +
										tr("Year") +
										(date.getUTCMonth() + 1) +
										tr("Month") +
										date.getUTCDate() +
										tr("Day"),
									value: `${data.post.post_id}`
								};
							})
						)
				),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setPlaceholder(tr("news_SelectType"))
						.setCustomId("news_type")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(
							{ label: tr("news_Notice"), emoji: "🔔", value: "1" },
							{ label: tr("news_Events"), emoji: "🔥", value: "2" },
							{ label: tr("news_Info"), emoji: "🗞️", value: "3" }
						)
				)
			]
		});
		return;
	}

	if (interaction.customId !== "news_post") return;

	const postData: PostData = await getPostFull(
		interaction.locale.toLowerCase(),
		value
	);
	const { post, user, image_list, cover_list } = postData.post;
	const content = await parsePostContent(post.content);
	const date = new Date(post.created_at * 1000);

	await interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setColor(getRandomColor() as any)
				.setAuthor({
					iconURL: user.avatar_url ?? "",
					name: user.nickname ?? "",
					url: `https://www.hoyolab.com/accountCenter?id=${user.uid}`
				})
				.setTitle(post.subject ?? tr("None"))
				.setURL(`https://www.hoyolab.com/article/${post.post_id || ""}`)
				.setDescription(
					content.length < 4096
						? content
						: `${content.slice(0, 4093)}...`
				)
				.setFooter({
					text:
						date.getUTCFullYear() +
						tr("Year") +
						(date.getUTCMonth() + 1) +
						tr("Month") +
						date.getUTCDate() +
						tr("Day")
				})
				.setImage(image_list[0]?.url ?? cover_list[0]?.url ?? null)
		]
	});
}
