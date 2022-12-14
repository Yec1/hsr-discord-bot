import { client } from "../index.js";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder } from "discord.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";
import { i18nMixin, tl3 } from "../services/i18n.js";
import { getComponent } from "../services/components.js";

client.on("interactionCreate", async interaction => {
	const p = await UserProfile(interaction);
	await p.checkAndUpdate();

	const g = await GuildProfile(interaction);
	await g.checkAndUpdate();

	const tr = i18nMixin(g.lang || tl3(interaction.locale) || "en");

	if (!interaction.customId) return;
	if (interaction.isButton()) {
		if (interaction.customId.startsWith("music_s_"))
			await interaction.deferUpdate({ ephemeral: true }).catch(() => {});
		else return;
	}

	const id = interaction.customId.replace("music_s_", "");
	if (!interaction.member.voice.channel) {
		return interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setDescription(
						`${client.emoji.warning} \`${interaction.user.tag}\` ` +
							tr("musicNotinChannel")
					)
			],
			ephemeral: true
		});
	}
	const queue = client.music.get(interaction.guild.id);
	if (
		!queue &&
		(id === "pause" ||
			id === "resume" ||
			id === "skip" ||
			id === "back" ||
			id === "stop" ||
			id === "loop" ||
			id === "loopt" ||
			id === "loopq")
	)
		return interaction.message.edit({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setDescription(
						`${client.emoji.cross} ${tr("musicNoSong")}`
					)
			],
			components: []
		});
	const { resume, back, stop, skip, loop, pause } = getComponent("music", tr);

	if (id === "pause" || id === "resume") {
		queue.pause();
		return interaction.message.edit({
			embeds: [embed(queue)],
			components: [check(queue)]
		});
	}
	if (id === "stop") {
		queue.destroy();
		return interaction.message.edit({
			components: []
		});
	}
	if (id === "skip") {
		queue.next();
		return interaction.message.edit({
			components: []
		});
	}
	// if(id === "back"){
	//     if (!queue.previousTracks[1]) return interaction.reply({ embeds: [
	//         new EmbedBuilder()
	//             .setConfig()
	//             .setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongPre'))
	//         ]
	//     })
	//     await queue.back();
	//     return interaction.message.edit({
	//         embeds: [
	//             new EmbedBuilder()
	//                 .setConfig()
	//                 .setDescription(`\`${interaction.user.tag}\` ` + tr('musicPre') +  ` **${queue.current.title}** `)
	//         ],
	//         components: []
	//     })
	// }
	// if(id === "loop"){
	//     await queue.setRepeatMode(1);
	//     return interaction.message.edit({
	//         embeds: [
	//             embed(queue, track)
	//         ],
	//         components: [
	//             check(queue)
	//         ]
	//     })
	// }
	// if(id === "loopt"){
	//     await queue.setRepeatMode(2);
	//     return interaction.message.edit({
	//         embeds: [
	//             embed(queue, track)
	//         ],
	//         components: [
	//             check(queue)
	//         ]
	//     })
	// }
	// if(id === "loopq"){
	//     await queue.setRepeatMode(0);
	//     return interaction.message.edit({
	//         embeds: [
	//             embed(queue, track)
	//         ],
	//         components: [
	//             check(queue)
	//         ]
	//     })
	// }
	function embed(queue) {
		var song = queue.nowplaying();
		const embed = new EmbedBuilder()
			.setConfig()
			.setTitle(song.info.title || "-")
			.setURL(song.info.url)
			.setImage(song.info.thumbnails[song.info.thumbnails.length - 1].url)
			.addField(tr("requestby"), `> ${song.member || this.member}`, true)
			.addField(tr("duration"), `> ${song.info.durationRaw}`, true);
		return embed;
	}

	function check(queue) {
		var row = new ActionRowBuilder();
		/*if(queue.repeatMode === 0)*/ queue.paused
			? row.addComponents(resume, back, stop, skip, loop)
			: row.addComponents(pause, back, stop, skip, loop);
		// else if(queue.repeatMode === 1) queue.paused? row.addComponents(resume, back, stop, skip, loopt) : row.addComponents(pause, back, stop, skip, loopt)
		// else if(queue.repeatMode === 2) queue.paused? row.addComponents(resume, back, stop, skip, loopq) : row.addComponents(pause, back, stop, skip, loopq)
		return row;
	}
});
