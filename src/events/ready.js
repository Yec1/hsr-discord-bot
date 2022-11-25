import { client } from "../index.js";

client.on("ready", () =>
	console.log(`${client.user.tag} is up and ready to go!`)
);
