import config from "./config.js";
import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Database } from "quickmongo";

// Global Variables
client.config = config;
client.db = new Database(client.config.mongoURL);
client.loader = new Loader(client);
await client.loader.load();

client.login(client.config.token);
