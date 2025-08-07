import { client, database } from "@/index.js";
import { Events } from "discord.js";
import {
	filterVersionChoices,
	getLastVersionChoices
} from "@/utilities/index.js";

interface Account {
	uid: string;
	nickname?: string;
}

client.on(Events.InteractionCreate, async (interaction: any) => {
	if (!interaction.isAutocomplete()) return;

	const focusedOption = interaction.options.getFocused(true);
	const { name: optionName, value: userInput } = focusedOption;

	if (optionName === "account") {
		const userAccounts = (await database.get(
			`${interaction.user.id}.account`
		)) as Account[];
		if (!userAccounts) return;

		const choices = [];
		for (const account of userAccounts) {
			choices.push({
				name: `${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
				value: `${userAccounts.indexOf(account)}`
			});
		}

		await interaction.respond(choices);
		return;
	}

	if (optionName === "version") {
		// 篩選?��?
		const filteredChoices = userInput
			? filterVersionChoices(userInput)
			: getLastVersionChoices(25);

		const choices = filteredChoices.map(choice => ({
			name:
				interaction.locale === "zh-TW"
					? `${choice.value} - ${choice.localName}`
					: `${choice.value} - ${choice.name}`,
			value: choice.value
		}));

		await interaction.respond(choices);
		return;
	}
});
