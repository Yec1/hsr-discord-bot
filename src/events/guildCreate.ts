import { client, cluster } from "@/index.js";
import { Events, WebhookClient, EmbedBuilder, Guild } from "discord.js";
import moment from "moment";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();
const webhook = new WebhookClient({ url: config.JLWEBHOOK || "" });

client.on(Events.GuildCreate, async (guild: Guild) => {
	let totalGuilds = 0;

	if (cluster) {
		try {
			const results = await cluster.broadcastEval(
				(c: any) => c.guilds.cache.size
			);
			totalGuilds = results.reduce(
				(prev: number, val: number) => prev + val,
				0
			);
		} catch {
			totalGuilds = client.guilds.cache.size;
		}
	} else {
		totalGuilds = client.guilds.cache.size;
	}

	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setColor(guild.memberCount > 100 ? "#FFFF80" : "#57F287")
				.setThumbnail(guild.iconURL())
				.setTitle("新的伺服器出現了")
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
