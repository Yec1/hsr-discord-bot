import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ComponentType,
	ActionRowBuilder,
	ButtonBuilder,
	Client
} from "discord.js";
import pretty_ms from "pretty-ms";
import os from "os";

export default {
	data: new SlashCommandBuilder()
		.setName("infol")
		.setDescription("Information of bot")
		.addSubcommandGroup(subcommand =>
			subcommand
				.setName("aa")
				.setDescription("bb")
				.addSubcommand(subcommand =>
					subcommand.setName("sb").setDescription("asdf")
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		console.log(args);
	}
};
