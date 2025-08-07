import { EmbedBuilder } from "discord.js";

Object.defineProperties(EmbedBuilder.prototype, {
	addField: {
		value: function (name: string, value: string, inline: boolean = false) {
			return this.addFields({
				name,
				value,
				inline
			});
		},
		enumerable: false
	}
});
