import { client } from "../index.js";
import { Events } from "discord.js";
import emoji from "../assets/emoji.js";

const userIds = ["283946584461410305", "878830839822176287"];

client.on(Events.MessageCreate, async message => {
	const prefix = `<@${client.user.id}>`;
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
		client.commands.message.get(cmd.toLowerCase()) ||
		client.commands.message.find(c => c.alias?.includes(cmd.toLowerCase()));

	if (command) await command.execute(client, message, args, emoji);
});
