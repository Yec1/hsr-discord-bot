import config from "./config.js";
import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Database } from "quickmongo";
import { Player } from 'discord-player';
import "discord-player/smoothVolume";

// Global Variables
client.config = config;
client.db = new Database(client.config.mongoURL);
client.player = new Player(client);
client.loader = new Loader(client);
await client.loader.load();



client.login(client.config.token);
