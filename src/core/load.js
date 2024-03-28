import _glob from "glob";
import { promisify } from "util";
import { ApplicationCommandType } from "discord.js";
import { Logger } from "../services/logger.js";

const glob = promisify(_glob);

async function getMessageCommands(client, messageCommandPaths) {
	const result = [];
	for (let path of messageCommandPaths) {
		const file = (await import(`file://${path}`))?.default;
		const splitted = path.split("/");
		// why -2?
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
	const paths = await glob(`${process.cwd()}/src/events/*.js`);
	for (let path of paths) {
		console.log(path);
		await import(`file://${path}`);
	}
	return paths 
} 

async function getSlashCommands(client, slashs) {
	const slashArr = [];
	for (let dir of slashs) {
		const file = (await import(`file://${dir}`))?.default;
		if ("data" in file && "execute" in file) {
			client.commands.slash.set(file.data.name, file);
		} else {
			new Logger("系統").error(
				`${dir} 處的指令缺少必要的「資料」或「執行」屬性`
			);
		}
		client.commands.slash.set(file.name, file);


		// why do we need this?
		if (
			[
				ApplicationCommandType.Message,
				ApplicationCommandType.User
			].includes(file.type)
		)
			delete file.description;
		slashArr.push(file.data);
	}
	return slashArr;
}

export async function load(client) {
	const messageCommandPaths = await glob(
		`${process.cwd()}/src/commands/message/**/*.js`
	);

	const messageCommands = await getMessageCommands(client, messageCommandPaths);	

	const eventPaths = await bindEvents();

	const slashCommandPaths = await glob(
		`${process.cwd()}/src/commands/slash/**/*.js`
	);

	const slashCommands = await getSlashCommands(client, slashCommandPaths);

	new Logger("系統").success(
		`已載入 ${eventPaths.length} 事件、${slashCommands.length} 斜線指令、${messageCommands.length} 訊息指令`
	);


	client.on("ready", async () => {
		await client.application.commands.set(slashCommands);
	});
}
