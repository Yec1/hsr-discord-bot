import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Collection } from "discord.js";

// Global Variables
client.commands = {
	slash: new Collection(),
	message: new Collection()
};
client.loader = new Loader(client);
await client.loader.load();

client.login(process.env.TOKEN);
