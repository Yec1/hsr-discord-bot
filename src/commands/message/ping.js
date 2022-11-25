import { Client, Message } from "discord.js";

export default {
	name: "ping",
	alias: ["p"],
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @param {String[]} args
	 */
	run: async (client, message, args) => {
		message.channel.send(`${client.ws.ping} ws ping`);
	}
};
