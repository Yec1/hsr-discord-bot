import { Client, Message, EmbedBuilder } from "discord.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

export default {
	name: "detail",
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (client, message, args, emoji) => {
		const code = args.join(" ").trim();
		if (!code.startsWith("```js") || !code.endsWith("```")) {
			return message.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(
							"代碼格式不正確，請以Markdown包含您的代碼。\n範例:\n```js\nconsole.log('Hi')\n```"
						)
				]
			});
		}

		function getEmbed(status, msg) {
			message.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()

						.setTitle(status)
						.setDescription(
							"**`INPUT:`**\n" +
								code +
								"\n\n**`OUTPUT:`**\n```js\n" +
								msg +
								"\n```"
						)
				]
			});
		}

		try {
			const cleanedCode = code.slice(5, -3);
			let output = undefined;
			console.log = (...args) =>
				(output = (output ? output : "") + args.join(" ") + "\n");
			const evaled = await eval(cleanedCode);

			getEmbed(
				"Success",
				output === undefined
					? require("util").inspect(evaled)
					: output.toString()
			);
		} catch (e) {
			getEmbed("Failed", e);
		}
	}
};
