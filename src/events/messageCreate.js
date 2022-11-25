import { client } from "../index.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";

client.on("messageCreate", async message => {
	if (
		message.author.bot ||
		!message.guild ||
		!message.content.toLowerCase().startsWith(client.config.prefix)
	)
		return;

	const p = await UserProfile(message);
	await p.checkAndUpdate();

	const g = await GuildProfile(message);
	await g.checkAndUpdate();

	const [cmd, ...args] = message.content
		.slice(client.config.prefix.length)
		.trim()
		.split(/ +/g);

	const command =
		client.commands.message.get(cmd.toLowerCase()) ||
		client.commands.message.find(c => c.alias?.includes(cmd.toLowerCase()));

	if (!command) return;
	await command.execute(client, message, args);
});
