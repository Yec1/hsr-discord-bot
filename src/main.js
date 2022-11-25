import config from "./config.js";
import { client } from "./index.js";

import { Loader } from "./core/loader.js";

// Global Variables
client.config = config;

client.loader = new Loader(client);
await client.loader.load();

client.login(client.config.token);
