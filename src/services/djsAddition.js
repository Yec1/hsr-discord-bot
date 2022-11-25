import { EmbedBuilder } from "discord.js";
import { client } from "../index.js";

const text = ["你好", "讓Discord更方便"];

Object.defineProperties(EmbedBuilder.prototype, {
	setConfig: {
		value: function () {
			return this.setColor(parseInt("CFF2FF", 16)).setFooter({
				text: "iCE - " + text[Math.floor(Math.random() * text.length)],
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
