import config from "./config.js";
import emoji from "./emoji.js";
import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Database } from "quickmongo";
import { MusicManager } from "./services/music.js";

// Global Variables
client.config = config;
client.emoji = emoji;
client.db = new Database(process.env.MONGO);
await client.db.connect();
if (process.env.DB_TABLE) client.db = new client.db.table(process.env.DB_TABLE);
client.music = new MusicManager();
client.loader = new Loader(client);
await client.loader.load();

client.login(process.env.TOKEN);
