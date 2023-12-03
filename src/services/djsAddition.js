import { EmbedBuilder } from "discord.js";

Object.defineProperties(EmbedBuilder.prototype, {
	addField: {
		value: function (name, value, inline = false) {
			return this.addFields({
				name,
				value,
				inline
			});
		},
		enumerable: false
	},
	setConfig: {
		value: function (color) {
			return this.setColor(color || "#272829");
		}
	}
});

global.replyOrfollowUp = async function (interaction, ...args) {
	if (interaction.replied) return await interaction.editReply(...args);
	if (interaction.deferred) return await interaction.followUp(...args);
	return await interaction.reply(...args);
};
