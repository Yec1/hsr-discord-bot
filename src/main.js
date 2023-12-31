import config from "./config.js";
import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Collection } from "discord.js";
import { ClusterClient } from "discord-hybrid-sharding";

// Global Variables
client.config = config;
client.cluster = new ClusterClient(client);
client.commands = {
	slash: new Collection(),
	message: new Collection()
};
client.loader = new Loader(client);
await client.loader.load();

client.login(process.env.TOKEN);
