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
		value: function (color, footer) {
			return this.setColor(
				color && color != null ? color : "#272829"
			).setFooter({
				text: footer || "想要支持我們嗎？您可以使用 /donate！"
			});
		}
	}
});

global.replyOrfollowUp = async function (interaction, ...args) {
	if (interaction.replied) return await interaction.editReply(...args);
	if (interaction.deferred) return await interaction.followUp(...args);
	return await interaction.reply(...args);
};
