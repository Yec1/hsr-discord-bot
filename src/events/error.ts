import { client } from "@/index.js";
import { WebhookClient, EmbedBuilder } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();
const webhook = new WebhookClient({
	url: config.ERRWEBHOOK || ""
});

client.on("error", (error: Error) => {
	console.error(error);
	new Logger("系統").error(`錯誤訊息：${error.message}`);
	webhook.send({
		embeds: [
			new EmbedBuilder().setTimestamp().setDescription(`${error.message}`)
		]
	});
});

client.on("warn", (message: string) => {
	new Logger("系統").warn(`警告訊息：${message}`);
});

process.on("unhandledRejection", (error: Error) => {
	console.log(error);
	new Logger("系統").error(`錯誤訊息：${error.message}`);
	webhook.send({
		embeds: [
			new EmbedBuilder().setTimestamp().setDescription(`${error.message}`)
		]
	});
});

process.on("uncaughtException", console.error);
