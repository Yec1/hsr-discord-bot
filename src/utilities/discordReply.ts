import type { Interaction } from "discord.js";

export async function replyOrfollowUp(
	interaction: Interaction,
	options: any
): Promise<any> {
	if ("replied" in interaction && interaction.replied) {
		return interaction.editReply(options);
	}
	if ("deferred" in interaction && interaction.deferred) {
		return interaction.followUp(options);
	}
	if ("reply" in interaction) return interaction.reply(options);
}
