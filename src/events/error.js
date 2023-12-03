import { client } from "../index.js";
import { WebhookClient, EmbedBuilder } from "discord.js";
const webhook = new WebhookClient({
	url: client.config.ERRWEBHOOK
});

client.on("error", error => {
	console.log(error);
	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setConfig()
				.setTimestamp()
				.setDescription(`${error}`)
		]
	});
});

client.on("warn", error => {
	console.log(error);
});

process.on("unhandledRejection", error => {
	console.log("Unhandled promise rejection:", error);
	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setConfig()
				.setTimestamp()
				.setDescription(`${error}`)
		]
	});
});

process.on("uncaughtException", console.error);
