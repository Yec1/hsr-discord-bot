import { client } from "./index.js";
import { Collection } from "discord.js";
import { ClusterClient } from "discord-hybrid-sharding";
import { QuickDB } from "quick.db";
import Logger from "./utilities/core/logger.js";
import { ApplicationCommandType } from "discord.js";
import { getAllJsFiles } from "./utilities/getAllJsFiles.js";

// Client Variables
client.db = new QuickDB();
client.cluster = new ClusterClient(client);
client.commands = { slash: new Collection(), message: new Collection() };
if (client.cluster.id == 0) await import("./server.js");

async function getMessageCommands(client, messageCommandPaths) {
	const result = [];

	for (let path of messageCommandPaths) {
		const file = (await import(`file://${path}`))?.default;
		const splitted = path.split("/");
		const folder = splitted[splitted.length - 2];

		if (file.name) {
			const properties = { folder, ...file };
			client.commands.message.set(file.name, properties);
			result.push(file);
		}
	}

	return result;
}

async function bindEvents() {
	const paths = await getAllJsFiles(`${process.cwd()}/src/events`);

	for (let path of paths) {
		await import(`file://${path}`);
	}

	return paths;
}

async function getSlashCommands(client, slashCommandPaths) {
	const result = [];

	for (let path of slashCommandPaths) {
		const file = (await import(`file://${path}`))?.default;

		if ("data" in file && "execute" in file) {
			client.commands.slash.set(file.data.name, file);
		} else {
			new Logger("系統").error(
				`${path} 處的指令缺少必要的「資料」或「執行」屬性`
			);
		}
		client.commands.slash.set(file.name, file);

		if (
			[
				ApplicationCommandType.Message,
				ApplicationCommandType.User
			].includes(file.type)
		)
			delete file.description;

		result.push(file.data);
	}

	return result;
}

export async function load(client) {
	// Message command
	const messageCommandPaths = await getAllJsFiles(
		`${process.cwd()}/src/commands/message`
	);
	const messageCommands = await getMessageCommands(
		client,
		messageCommandPaths
	);

	// Slash command
	const slashCommandPaths = await getAllJsFiles(
		`${process.cwd()}/src/commands/slash`
	);
	const slashCommands = await getSlashCommands(client, slashCommandPaths);

	// Event
	const eventPaths = await bindEvents();

	new Logger("系統").success(
		`已載入 ${eventPaths.length} 事件、${slashCommands.length} 斜線指令、${messageCommands.length} 訊息指令`
	);

	client.on("ready", async () => {
		await client.application.commands.set(slashCommands);
	});
}

await load(client);

client.login(
	process.env.NODE_ENV === "dev" ? process.env.TESTOKEN : process.env.TOKEN
);
