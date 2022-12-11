import { EmbedBuilder } from "discord.js";
import { client } from "../index.js";

const text = ["Hello World!", "讓Discord更方便"];

Object.defineProperties(EmbedBuilder.prototype, {
	setConfig: {
		value: function (footer) {
			var texts = "iCE - ";
			if(footer === undefined) texts += text[Math.floor(Math.random() * text.length)]; else texts += footer
			return this.setColor(parseInt("CFF2FF", 16)).setFooter({
				text: texts,
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
