import { client } from "../index.js";
import {
	CommandInteraction,
	ApplicationCommandOptionType,
	range
} from "discord.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";
import { i18nMixin, tl3 } from "../services/i18n.js";

client.on("interactionCreate", async interaction => {
	const p = await UserProfile(interaction);
	await p.checkAndUpdate();

	const g = await GuildProfile(interaction);
	await g.checkAndUpdate();

	const i18n = i18nMixin(g.lang || tl3(interaction.locale) || "en");
	if (interaction.isButton()) {
		await interaction.deferUpdate().catch(() => {});
	}
	if (interaction.isCommand()) {
		//await interaction.deferReply({ /*ephemeral: false*/ }).catch(() => {});

		const command = client.commands.slash.get(interaction.commandName);
		if (!command)
			return interaction.followUp({
				content: "An error has occured",
				ephemeral: true
			});

		const args = [];

		for (let option of interaction.options.data) {
			if (option.type === ApplicationCommandOptionType.Subcommand) {
				if (option.name) args.push(option.name);
				option.options?.forEach(x => {
					if (x.value) args.push(x.value);
				});
			} else if (option.value) args.push(option.value);
		}
		interaction.member = interaction.guild.members.cache.get(
			interaction.user.id
		);

		try {
			command.execute(client, interaction, args, i18n);
		} catch (e) {
			interaction.editReply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	} else if (interaction.isContextMenuCommand()) {
		await interaction.deferReply({ ephemeral: false });
		const command = client.commands.slash.get(interaction.commandName);
		if (!command) return;
		try {
			command.execute(client, interaction);
		} catch (e) {
			interaction.editReply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	}
});
