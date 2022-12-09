import config from "./config.js";
import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Database } from "quickmongo";

// Global Variables
client.config = config;
client.db = new Database(process.env.MONGO);
await client.db.connect();
if (process.env.DB_TABLE) client.db = new client.db.table(process.env.DB_TABLE);
client.loader = new Loader(client);
await client.loader.load();

client.login(process.env.TOKEN);
