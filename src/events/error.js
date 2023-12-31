import { client } from "../index.js";
import { WebhookClient, EmbedBuilder } from "discord.js";
import { Logger } from "../services/logger.js";

const webhook = new WebhookClient({
	url: client.config.ERRWEBHOOK
});

client.on("error", error => {
	new Logger("系統").error(`錯誤訊息：${error.message}`);
	webhook.send({
		embeds: [
			new EmbedBuilder().setTimestamp().setDescription(`${error.message}`)
		]
	});
});

client.on("warn", error => {
	new Logger("系統").warn(`警告訊息：${error.message}`);
});

process.on("unhandledRejection", error => {
	new Logger("系統").error(`錯誤訊息：${error.message}`);
	webhook.send({
		embeds: [
			new EmbedBuilder().setTimestamp().setDescription(`${error.message}`)
		]
	});
});

process.on("uncaughtException", console.error);
