import { client, commands } from "@/index.js";
import { Events, Message } from "discord.js";
import type { MessageCommandType } from "@/types/index.js";
import { loadConfig } from "@/utilities/core/config.js";
const config = loadConfig();

client.on(Events.MessageCreate, async (message: Message) => {
	const prefix = `<@${client.user?.id}>`;
	if (
		message.author.bot ||
		!message.guild ||
		!message.content.toLowerCase().startsWith(prefix) ||
		!config.DEVIDS.includes(message.author.id)
	)
		return;

	const [cmd, ...args] = message.content
		.slice(prefix.length)
		.trim()
		.split(/ +/g);

	const command =
		commands.message.get(cmd?.toLowerCase() || "") ||
		commands.message.find((c: MessageCommandType) =>
			c.aliases?.includes(cmd?.toLowerCase() || "")
		);

	if (command) {
		await (command as any).execute(message, args);
	}
});
