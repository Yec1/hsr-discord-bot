import { ButtonBuilder } from "discord.js";

export function getComponent(str, tr, emoji) {
	if (str === "music") {
		const loop = new ButtonBuilder()
			.setCustomId("music_s_loop")
			.setLabel(tr("none"))
			.setStyle(3);

		const back = new ButtonBuilder()
			.setEmoji(emoji.back)
			.setCustomId("music_s_back")
			.setStyle(2);

		const stop = new ButtonBuilder()
			.setEmoji(emoji.stop)
			.setCustomId("music_s_stop")
			.setStyle(4);

		const skip = new ButtonBuilder()
			.setEmoji(emoji.skip)
			.setCustomId("music_s_skip")
			.setStyle(2);

		const pause = new ButtonBuilder()
			.setEmoji(emoji.pause)
			.setLabel(tr("pause"))
			.setCustomId("music_s_pause")
			.setStyle(3);

		const resume = new ButtonBuilder()
			.setEmoji(emoji.play)
			.setLabel(tr("resume"))
			.setCustomId("music_s_resume")
			.setStyle(3);

		const loopt = new ButtonBuilder()
			.setEmoji(emoji.loopt)
			.setCustomId("music_s_loopt")
			.setLabel(tr("track"))
			.setStyle(3);

		const loopq = new ButtonBuilder()
			.setEmoji(emoji.loopq)
			.setCustomId("music_s_loopq")
			.setLabel(tr("queue"))
			.setStyle(3);

		return {
			loop,
			skip,
			back,
			stop,
			pause,
			resume,
			loopt,
			loopq
		};
	}
}
