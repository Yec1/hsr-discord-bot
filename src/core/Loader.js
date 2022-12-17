import _glob from "glob";
import { promisify } from "util";
import { Collection, ApplicationCommandType } from "discord.js";
import { uncook } from "../services/cook.js";

const glob = promisify(_glob);
export class Loader {
	constructor(client) {
		this.client = client;
	}
	async load() {
		const { db } = this.client;
		console.log(`connected to MongoDB, ping: ${await db.ping()}`);
		const messages = await glob(
			`${process.cwd()}/src/commands/message/**/*.js`
		);
		const msgArr = [];
		for (let dir of messages) {
			const file = (await import(`file://${dir}`))?.default;
			const splitted = dir.split("/");
			const directory = splitted[splitted.length - 2];

			if (file.name) {
				const properties = { directory, ...file };
				this.client.commands.message.set(file.name, properties);
				msgArr.push(file);
			}
		}

		const events = await glob(`${process.cwd()}/src/events/*.js`);
		for (let dir of events) {
			await import(`file://${dir}`);
		}

		const slashs = await glob(
			`${process.cwd()}/src/commands/slash/**/*.js`
		);

		const slashArr = [];
		for (let dir of slashs) {
			const file = (await import(`file://${dir}`))?.default;
			if ("data" in file && "execute" in file) {
				this.client.commands.slash.set(file.data.name, file);
			} else {
				console.log(
					`The command at ${dir} is missing a required "data" or "execute" property.`
				);
			}
			this.client.commands.slash.set(file.name, file);

			if (
				[
					ApplicationCommandType.Message,
					ApplicationCommandType.User
				].includes(file.type)
			)
				delete file.description;
			slashArr.push(file.data);
		}
		console.log(
			`Loaded ${events.length} events, ${slashArr.length} slashs, ${msgArr.length} message commands`
		);
		this.client.on("ready", async () => {
			await this.client.guilds.cache
				.get("1045302755557912666")
				.commands.set(slashArr);

			// Register for all the guilds the bot is in
			// await client.application.commands.set(arrayOfSlashCommands);
		});
	}
}
