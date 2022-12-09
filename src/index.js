import dotenv from "dotenv";
import fs from "fs";

if (process.env.NODE_ENV === "dev") {
	Object.assign(
		process.env,
		dotenv.parse(fs.readFileSync("./.env.development"))
	);
} else {
	Object.assign(
		process.env,
		dotenv.parse(fs.readFileSync("./.env.production"))
	);
}
// if (!process.env.YARN_WRAP_OUTPUT)
// 	console.log(
// 		// eslint-disable-next-line quotes
// 		'it is suggested to install yarn and use their command to start.\ninstall yarn and do "yarn start"!'
// 	);

import "./services/index.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.MessageContent
	],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.User,
		Partials.GuildMember,
		Partials.Reaction
	],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false
	}
});

export { client };
import("./main.js");
