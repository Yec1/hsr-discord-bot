import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ComponentType,
	ActionRowBuilder,
	SelectMenuBuilder
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
		const home = new EmbedBuilder()
			.setConfig("Welcome to the help panel.")
			.setDescription(
				"Im a fully functional multipurpose bot! \n\nUnlock exclusive benefits by purchasing a premium membership: **[Buy Premium](https://nothing.here)** \n\n**All Link:** [Support](https://discord.gg/tGQCdQZUqR)"
			);

		const info = new EmbedBuilder()
			.setConfig("Commands")
			.addField("Hello", "Heres my second page", true);

		const components = state => [
			new ActionRowBuilder().addComponents(
				new SelectMenuBuilder()
					.setCustomId("help-menu")
					.setPlaceholder("Please Select a Category")
					.setDisabled(state)
					.addOptions([
						{
							label: "Home",
							value: "home",
							description: "Go home",
							emoji: "🏠"
						},
						{
							label: "Info",
							value: "info",
							description: "See info commands",
							emoji: "ℹ"
						}
					])
			)
		];

		interaction.reply({
			embeds: [home],
			allowedMentions: { repliedUser: false },
			components: components(false)
		});

		const filter = interaction =>
			interaction.user.id === interaction.member.id;

		const collector = interaction.channel.createMessageComponentCollector({
			filter,
			componentType: ComponentType.SelectMenu,
			max: 10
		});

		collector.on("collect", interaction => {
			if (interaction.values[0] === "home") {
				interaction.reply({ embeds: [home], ephemeral: true });
			} else if (interaction.values[0] === "info") {
				interaction.reply({ embeds: [info], ephemeral: true });
			}
		});
	}
};
