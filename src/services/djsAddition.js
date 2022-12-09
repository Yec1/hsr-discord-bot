import { EmbedBuilder } from "discord.js";
import { client } from "../index.js";

const text = ["Hello World!", "讓Discord更方便"];

Object.defineProperties(EmbedBuilder.prototype, {
	setConfig: {
		value: function (footer) {
			return this.setColor(parseInt("CFF2FF", 16)).setFooter({
				text:
					"iCE - " + footer ||
					text[Math.floor(Math.random() * text.length)],
				iconURL: client.user.displayAvatarURL()
			});
		},
		enumerable: false
	},
	addField: {
		value: function (name, value, inline = false) {
			return this.addFields({
				name,
				value,
				inline
			});
		},
		enumerable: false
	}
});
