import { client } from "../index.js";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder } from "discord.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";
import { i18nMixin, tl3 } from "../services/i18n.js";

client.on("interactionCreate", async interaction => {
	const p = await UserProfile(interaction);
	await p.checkAndUpdate();

	const g = await GuildProfile(interaction);
	await g.checkAndUpdate();

	const tr = i18nMixin(g.lang || tl3(interaction.locale) || "en");
	if (interaction.isButton())
		await interaction.deferUpdate({ ephemeral: true }).catch(() => {});
	else return;
	const queue = client.music.get(interaction.guild.id);
	if(!queue && (
				interaction.customId === "pause" || 
				interaction.customId === "resume" || 
				interaction.customId === "skip" || 
				interaction.customId === "back" || 
				interaction.customId === "stop" ||
				interaction.customId === "loop" ||
				interaction.customId === "loopt" ||
				interaction.customId === "loopq"
			)
		) return interaction.message.edit({ embeds: [
	        new EmbedBuilder()
	            .setConfig()
	            .setDescription(tr('musicNoSong'))
	    ],
		components: []
	});
	const loop = new ButtonBuilder()
	.setEmoji(`🔄`)
	.setCustomId('loop')
	.setLabel(tr('none')) //tr('none')
	.setStyle(3);

	const back = new ButtonBuilder()
	  .setEmoji(`⏮`)
	  .setCustomId('back')
	  .setStyle(2);

	const stop = new ButtonBuilder()
	  .setEmoji(`⏹`)
	  .setCustomId('stop')
	  .setStyle(4);

	const skip = new ButtonBuilder()
	  .setEmoji(`⏭`)
	  .setCustomId('skip')
	  .setStyle(2)

	const pause = new ButtonBuilder()
	  .setEmoji(`⏸`)
	  .setLabel(tr('pause')) //tr('pause')
	  .setCustomId('pause')
	  .setStyle(3);;

	const resume = new ButtonBuilder()
	  .setEmoji(`▶`)
	  .setLabel(tr('resume')) //tr('resume')
	  .setCustomId('resume')
	  .setStyle(3);

	const loopt = new ButtonBuilder()
	  .setEmoji(`🔂`)
	  .setCustomId('loopt')
	  .setLabel(tr('track')) //tr('track')
	  .setStyle(3);

	const loopq = new ButtonBuilder()
	  .setEmoji(`🔁`)
	  .setCustomId('loopq')
	  .setLabel(tr('queue')) //tr('queue')
	  .setStyle(3);
	if(interaction.customId === "pause" || interaction.customId === "resume"){
	    queue.pause();
		return interaction.message.edit({
			embeds: [
			    embed(queue)
			],
			components: [
				check(queue)
			]
		})
	}
	if(interaction.customId === "stop"){
	    queue.destroy();
		return interaction.message.edit({
			components: []
		})
	}
	if(interaction.customId === "skip"){
	    queue.next()
		return interaction.message.edit({
			components: []
		})
	}
	// if(interaction.customId === "back"){
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
	// if(interaction.customId === "loop"){
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
	// if(interaction.customId === "loopt"){
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
	// if(interaction.customId === "loopq"){
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
	function embed(queue){
		var song = queue.nowplaying();
		const embed = new EmbedBuilder()
		.setConfig()
		.setTitle(song.info.title || "-")
		.setURL(song.info.url)
		.setImage(
			song.info.thumbnails[song.info.thumbnails.length - 1]
				.url
		)
		.addField(
			tr("requestby"), //this.tr("requestby")
			`> ${song.member || this.member}`,
			true
		)
		.addField(
			tr("duration"), //this.tr("duration")
			`> ${song.info.durationRaw}`,
			true
		)
		return embed;
	}
	
	function check(queue){
		var row = new ActionRowBuilder()
		/*if(queue.repeatMode === 0)*/ queue.paused? row.addComponents(resume, back, stop, skip, loop) : row.addComponents(pause, back, stop, skip, loop)
		// else if(queue.repeatMode === 1) queue.paused? row.addComponents(resume, back, stop, skip, loopt) : row.addComponents(pause, back, stop, skip, loopt)
		// else if(queue.repeatMode === 2) queue.paused? row.addComponents(resume, back, stop, skip, loopq) : row.addComponents(pause, back, stop, skip, loopq)
		return row;
	}
});
