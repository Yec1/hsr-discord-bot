import { client } from "@/index.js";
import { WebhookClient, EmbedBuilder } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();
const webhook = new WebhookClient({
	url: config.ERRWEBHOOK || ""
});

function buildErrorEmbed(label: string, error: Error | unknown): EmbedBuilder {
	const err = error instanceof Error ? error : new Error(String(error));
	const stack = err.stack ? `\`\`\`\n${err.stack.slice(0, 3800)}\n\`\`\`` : "（無 stack trace）";
	return new EmbedBuilder()
		.setTimestamp()
		.setTitle(`[${label}] ${err.message.slice(0, 200)}`)
		.setDescription(stack)
		.setColor(0xff0000);
}

client.on("error", (error: Error) => {
	if ((error as NodeJS.ErrnoException).code === "ERR_IPC_CHANNEL_CLOSED") return;
	if (error.message === "Channel closed") return;
	console.error(error);
	new Logger("系統").error(`錯誤訊息：${error.message}`);
	webhook.send({ embeds: [buildErrorEmbed("client.error", error)] }).catch(console.error);
});

client.on("warn", (message: string) => {
	new Logger("系統").warn(`警告訊息：${message}`);
	webhook.send({
		embeds: [
			new EmbedBuilder().setTimestamp().setTitle("[client.warn]").setDescription(message.slice(0, 4000)).setColor(0xffaa00)
		]
	}).catch(console.error);
});

process.on("unhandledRejection", (error: Error) => {
	if ((error as NodeJS.ErrnoException).code === "ERR_IPC_CHANNEL_CLOSED") return;
	console.log(error);
	new Logger("系統").error(`錯誤訊息：${error instanceof Error ? error.stack ?? error.message : String(error)}`);
	webhook.send({ embeds: [buildErrorEmbed("unhandledRejection", error)] }).catch(console.error);
});

process.on("uncaughtException", (error) => {
	if ((error as NodeJS.ErrnoException).code === "ERR_IPC_CHANNEL_CLOSED") return;
	console.error(error);
});
