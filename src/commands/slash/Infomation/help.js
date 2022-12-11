import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ComponentType,
	ActionRowBuilder,
	StringSelectMenuBuilder 
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("List of my commands")
		.setNameLocalizations({
			"zh-TW": "幫助",
			ja: "help"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看機器人選單",
			ja: "List of my commands"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setConfig("Welcome to the help panel.")
					.setDescription(
						"Im a fully functional multipurpose bot! \n\nUnlock exclusive benefits by purchasing a premium membership: **[Buy Premium](https://nothing.here)** \n\n**All Link:** [Support](https://discord.gg/tGQCdQZUqR)"
					)
			],
			allowedMentions: { repliedUser: false },
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('help-menu')
						.setPlaceholder('Please Select a Category')
						.addOptions([
							{
								label: `Info`,
								value: `info`,
								description: `List of my commands`,
								emoji: `ℹ`,
							},
						]),
				)
			]
		});

		const filter = interaction =>
			interaction.user.id === interaction.member.id;

		const collector = interaction.channel.createMessageComponentCollector({
			filter,
			componentType: ComponentType.SelectMenu,
			max: 10
		});

		collector.on("collect", interaction => {
			if (interaction.values[0] === "info") {
				interaction.reply({ embeds: [
						new EmbedBuilder()
							.setConfig("Commands")
							.addField("Hello", "Heres my second page", true)
					], 
					ephemeral: true 
				});
			}
		});
	}
};
