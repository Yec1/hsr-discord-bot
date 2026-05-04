import { client, database } from "@/index.js";
import { Events } from "discord.js";
import {
	filterVersionChoices,
	getLastVersionChoices
} from "@/utilities/index.js";
import { getCharacterAutocompleteOptions } from "@/utilities/hsr/atlas.js";
import { createTranslator, toI18nLang } from "@/utilities/core/i18n.js";
import { drainPendingLogins } from "@/utilities/webhookLogin.js";

interface Account {
	uid: string;
	nickname?: string;
}

client.on(Events.InteractionCreate, async (interaction: any) => {
	if (!interaction.isAutocomplete()) return;

	const focusedOption = interaction.options.getFocused(true);
	const { name: optionName, value: userInput } = focusedOption;

	if (optionName === "account") {
		// Drain any pending web-logins so newly bound accounts appear immediately.
		try {
			await drainPendingLogins(interaction.user.id);
		} catch {}

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

	if (optionName === "character") {
		const tr = createTranslator(toI18nLang(interaction.locale));

		try {
			const locale =
				interaction.locale === "zh-TW"
					? "tw"
					: interaction.locale === "zh-CN"
						? "cn"
						: "en";
			const choices = await getCharacterAutocompleteOptions(
				userInput,
				tr,
				locale
			);
			await interaction.respond(choices);
		} catch (error) {
			console.error("Error in character autocomplete:", error);
			await interaction.respond([]);
		}
		return;
	}
});
