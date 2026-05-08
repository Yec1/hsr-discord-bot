import { client, cluster } from "@/index.js";
import { Events, WebhookClient, EmbedBuilder, Guild } from "discord.js";
import moment from "moment";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();
const webhook = new WebhookClient({ url: config.JLWEBHOOK || "" });

client.on(Events.GuildDelete, async (guild: Guild) => {
	const totalGuilds = client.guilds.cache.size;

	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setColor("#ED4245")
				.setThumbnail(guild.iconURL())
				.setTitle("伺服器離開了")
				.addFields({
					name: "名稱",
					value: `\`${guild.name}\``,
					inline: false
				})
				.addFields({
					name: "ID",
					value: `\`${guild.id}\``,
					inline: false
				})
				.addFields({
					name: "擁有者",
					value: `<@${guild.ownerId}>`,
					inline: false
				})
				.addFields({
					name: "人數",
					value: `\`${guild.memberCount}\` 個成員`,
					inline: false
				})
				.addFields({
					name: "建立時間",
					value: `<t:${moment(guild.createdAt).unix()}:F>`,
					inline: false
				})
				.addFields({
					name: `${client.user?.username || "Bot"} 的伺服器數量`,
					value: `\`${totalGuilds}\` 個伺服器`,
					inline: false
				})
				.setTimestamp()
		]
	});
});
