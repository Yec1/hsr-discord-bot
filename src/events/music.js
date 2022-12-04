import { client } from "../index.js" 
import { 
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder
} from "discord.js";

function embed(queue, type){
    return new EmbedBuilder()
    .setConfig()
    .setTitle(type.name)
    .setURL(type.url)
    .setImage(type.thumbnail)
    .addField(
        tr('volume'),
        `> **${queue.volume}%**`,
        true
    )
    .addField(
        tr('duration'),
        `> ${type.formattedDuration}`,
        true
    )
    .addField(
        tr('requestby'),
        `> ${type.member}`,
        true
    )
}

    const loop = new ButtonBuilder()
      .setEmoji(`🔄`)
      .setCustomId('loop')
      .setLabel(tr('none'))
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
        .setLabel(tr('pause'))
        .setCustomId('pause')
        .setStyle(3);;

      const resume = new ButtonBuilder()
        .setEmoji(`▶`)
        .setLabel(tr('resume'))
        .setCustomId('resume')
        .setStyle(3);

      const loopt = new ButtonBuilder()
        .setEmoji(`🔂`)
        .setCustomId('loopt')
        .setLabel(tr('track'))
        .setStyle(3);

      const loopq = new ButtonBuilder()
        .setEmoji(`🔁`)
        .setCustomId('loopq')
        .setLabel(tr('queue'))
        .setStyle(3);

function check(queue){
    var row = new ActionRowBuilder()
    if(queue.repeatMode === 0) if (queue.paused) row.addComponents(resume, back, stop, skip, loop); else row.addComponents(pause, back, stop, skip, loop)
    else if(queue.repeatMode === 1) if (queue.paused) row.addComponents(resume, back, stop, skip, loopt); else row.addComponents(pause, back, stop, skip, loopt)
    else if(queue.repeatMode === 2) if (queue.paused) row.addComponents(resume, back, stop, skip, loopq); else row.addComponents(pause, back, stop, skip, loopq)
    return row;
            
}

client.distube
    .on('playSong', (queue, song) => {
        queue.textChannel.send({ 
            embeds: [
                embed(queue, song)
            ],
            components: [
                check(queue)
            ]
        })
    })
    .on('addSong', (queue, song) =>
        queue.textChannel.send({ embeds:[
                embed(queue, song)
            ]
        })
    )
    .on('addList', (queue, playlist) =>
        queue.textChannel.send({ embeds: [
                embed(queue, playlist)
            ]
        })
    )
    .on('error', (channel, e) => {
        if (channel) channel.send(`An error encountered: ${e.toString().slice(0, 1974)}`)
        else console.error(e)
    })
    .on('empty', channel => channel.send(tr('musicEmpty')))
    .on('finish', queue => 
        queue.textChannel.send({ embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(tr('musicPlayed'))
            ]
        })
    )
    //.on('searchNoResult', (message, query) =>
    // message.channel.send(`No result found for \`${query}\`!`)
    // )
    // .on("searchResult", (message, result) => {
    //     let i = 0
    //     message.channel.send(
    //         `**Choose an option from below**\n${result
    //             .map(song => `**${++i}**. ${song.name} - \`${song.formattedDuration}\``)
    //             .join("\n")}\n*Enter anything else or wait 60 seconds to cancel*`
    //     )
    // })
    // .on("searchCancel", message => message.channel.send(`${client.emotes.error} | Searching canceled`))
    // .on("searchInvalidAnswer", message =>
    //     message.channel.send(
    //         `${client.emotes.error} | Invalid answer! You have to enter the number in the range of the results`
    //     )
    // )
    // .on("searchDone", () => {})

client.on('interactionCreate', async (interaction) => {
    if(!interaction.isButton()) return;
    const queue = client.distube.getQueue(interaction)
    if(!queue) return interaction.message.edit({ embeds: [
        /*
			TODO: ephemeral
		*/
            new EmbedBuilder()
                .setConfig()
                .setDescription(tr('musicNoSong'))
        ]
    });
    const track = queue.songs[0];
    if(interaction.customId === "pause"){
        await queue.pause()
        return interaction.message.edit({ 
            embeds: [
                embed(queue, track)
            ], 
            components: [
                check(queue)
            ]
        })
    }
    if(interaction.customId === "resume"){
        await queue.resume()
        return interaction.message.edit({ 
            embeds: [
                embed(queue, track)
            ], 
            components: [
                check(queue)
            ]
        })
    }
    if(interaction.customId === "stop"){
        await queue.stop()
        return interaction.message.edit({ 
            embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicStop'))
            ], 
            components: []
        })
    }
    if(interaction.customId === "skip"){
        /*
            TODO: ephemeral
        */
        if (queue.songs.length === 1 && queue.autoplay === false) return interaction.channel.send({ embeds: [ 
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongNext'))
            ],
            ephemeral: true
        })
        var song = await queue.skip()
        return interaction.message.edit({ 
            embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicSkip'))
            ], 
            components: []
        })
    }
    if(interaction.customId === "back"){
        /*
            TODO: ephemeral
        */
        if (queue.previousSongs.length == 0) return interaction.channel.send({ embeds: [
            new EmbedBuilder()
                .setConfig()
                .setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongPre'))
            ],
            ephemeral: true
        })
        var song = await queue.previous()
        return interaction.message.edit({ 
            embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicPre') +  ` ${song.name}`)
            ],
            components: []
        })
    }
    if(interaction.customId === "loop"){
        await queue.setRepeatMode(1);
        return interaction.message.edit({ 
            embeds: [
                embed(queue, track)
            ], 
            components: [
                check(queue)
            ]
        })
    }
    if(interaction.customId === "loopt"){
        await queue.setRepeatMode(2);
        return interaction.message.edit({ 
            embeds: [
                embed(queue, track)
            ], 
            components: [
                check(queue)
            ]
        })
    }
    if(interaction.customId === "loopq"){
        await queue.setRepeatMode(0);
        return interaction.message.edit({ 
            embeds: [
                embed(queue, track)
            ], 
            components: [
                check(queue)
            ]
        })
    }
})