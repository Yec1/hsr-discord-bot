import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder
} from "discord.js";

import { UserProfile, GuildProfile } from "../../../core/Profile.js";

export default {
	data: new SlashCommandBuilder()
		.setName("db")
		.setDescription("test")
		.setNameLocalizations({
			"zh-TW": "數據庫"
		})
		.setDescriptionLocalizations({
			"zh-TW": "測試"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args) {
		const p = await UserProfile(interaction);
		p.testVal++;
		interaction.reply(`test: ${p.testVal}`);
		p.save();
	}
};
