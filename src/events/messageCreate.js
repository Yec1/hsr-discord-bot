import { client } from "../index.js";

client.on("messageCreate", async message => {
	if (
		message.author.bot ||
		!message.guild ||
		!message.content.toLowerCase().startsWith(client.config.prefix)
	)
		return;

	const [cmd, ...args] = message.content
		.slice(client.config.prefix.length)
		.trim()
		.split(/ +/g);

	const command =
		client.commands.message.get(cmd.toLowerCase()) ||
		client.commands.message.find(c => c.alias?.includes(cmd.toLowerCase()));

	if (!command) return;
	await command.run(client, message, args);
});
