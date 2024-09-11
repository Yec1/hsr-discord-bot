import { client } from "../index.js";
import { Events } from "discord.js";
import {
	createChoiceOption,
	filterVersionChoices,
	getLastVersionChoices
} from "../utilities/utilities.js"; // 假設你有 getLastVersionChoices 函數
const db = client.db;

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isAutocomplete()) return;
	const { options, user, locale } = interaction;
	const optionName = options._hoistedOptions[0].name;

	if (optionName == "account") {
		const userAccounts = await db.get(`${user.id}.account`);
		if (!userAccounts) return;

		const choices = [];
		for (const account of userAccounts) {
			choices.push({
				name: `${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
				value: `${userAccounts.indexOf(account)}`
			});
		}

		await interaction.respond(choices);
	}

	if (optionName == "version") {
		const userInput = interaction.options.getString("version", true);

		// 篩選選項
		const filteredChoices = userInput
			? filterVersionChoices(userInput)
			: getLastVersionChoices(25);

		const choices = filteredChoices.map(choice => ({
			name:
				locale === "zh-TW"
					? `${choice.value} - ${choice.localName}`
					: `${choice.value} - ${choice.name}`,
			value: choice.value
		}));

		await interaction.respond(choices);
	}
});
