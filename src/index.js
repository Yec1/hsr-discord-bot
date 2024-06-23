import dotenv from "dotenv";
import fs from "fs";
Object.assign(process.env, dotenv.parse(fs.readFileSync("./.env")));

import "./utilities/index.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getInfo } from "discord-hybrid-sharding";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
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
	},
	shards: getInfo().SHARD_LIST,
	shardCount: getInfo().TOTAL_SHARDS
});

export { client };
import("./main.js");
