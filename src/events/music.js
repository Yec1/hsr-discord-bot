import { client } from "../index.js";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder } from "discord.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";
import { i18nMixin, tl3 } from "../services/i18n.js";
import { getComponent } from "../services/components.js";
const emoji = client.emoji;

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
						`${emoji.warning} <@${interaction.user.id}> ` +
							tr("musicNotinChannel")
					)
			],
			ephemeral: true
		});
	}
	const queue = client.music.get(interaction.guild.id);
	const song = queue.nowplaying();
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
			components: []
		});
	const { resume, back, stop, skip, loop, pause } = getComponent(
		"music",
		tr,
		emoji
	);

	if (id === "pause" || id === "resume") {
		queue.pause(queue);
		return interaction.message.edit({
			embeds: [embed(queue)],
			components: [check(queue)]
		});
	}
	if (id === "stop") {
		queue.destroy();
		interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setDescription(
						`${emoji.check} <@${interaction.user.id}> ${tr(
							"musicStop"
						)}`
					)
					.setConfig()
			],
			components: []
		});
	}
	if (id === "skip") {
		queue.next();
		interaction.followUp({
			embeds: [
				new EmbedBuilder()
					.setDescription(
						`${emoji.check} <@${interaction.user.id}> ${tr(
							"musicSkip"
						)}\n[${song.info.title}](${song.info.url})`
					)
					.setThumbnail(
						song.info.thumbnails[song.info.thumbnails.length - 1]
							.url
					)
					.setConfig()
			],
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
