import { client } from "../index.js";
import { WebhookClient, EmbedBuilder } from "discord.js";
import moment from "moment";
const webhook = new WebhookClient({ url: process.env.JLWEBHOOK });

client.on("guildCreate", guild => {
	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setThumbnail(guild.iconURL())
				.setTitle("新的伺服器出現了")
				.addField("名稱", `\`${guild.name}\``, false)
				.addField("ID", `\`${guild.id}\``, false)
				.addField("擁有者", `<@${guild.ownerId}>`, false)
				.addField("人數", `\`${guild.memberCount}\` 個成員`, false)
				.addField(
					"建立時間",
					`<t:${moment(guild.createdAt).unix()}:F>`,
					false
				)
				.addField(
					`${client.user.username} 的伺服器數量`,
					`\`${client.guilds.cache.size}\` 個伺服器`,
					false
				)
				.addField("ID", `\`${guild.id}\``, false)
				.setColor("#57F287")
				.setTimestamp()
		]
	});
});
