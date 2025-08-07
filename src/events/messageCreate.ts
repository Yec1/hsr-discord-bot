import { client, commands } from "@/index.js";
import { Events, Message } from "discord.js";

const userIds: string[] = ["283946584461410305", "878830839822176287"];

client.on(Events.MessageCreate, async (message: Message) => {
	const prefix = `<@${client.user?.id}>`;
	if (
		message.author.bot ||
		!message.guild ||
		!message.content.toLowerCase().startsWith(prefix) ||
		!userIds.includes(message.author.id)
	)
		return;

	const [cmd, ...args] = message.content
		.slice(prefix.length)
		.trim()
		.split(/ +/g);

	const command =
		commands.message.get(cmd?.toLowerCase() || "") ||
		commands.message.find((c: any) =>
			c.aliases?.includes(cmd?.toLowerCase())
		);

	if (command) await command.execute(message, args);
});
