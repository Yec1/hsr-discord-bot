import { client } from "../index.js" 
import { 
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder
} from "discord.js";
import { UserProfile, GuildProfile } from "../core/Profile.js";
import { i18nMixin, tl3 } from "../services/i18n.js";

    client.player
    .on('trackStart', (queue, track) => {
        // if(queue.npmessage && queue.npmessage.editable) {
        //     queue.npmessage.delete().catch(error=> {});
        // }
        if(queue.repeatMode === 1) {
            if(queue.npmessage && queue.npmessage.editable) {
                queue.npmessage.delete().catch(error=> {});
            }
        }
        queue.metadata.send({ 
            embeds: [
                embed(queue, track)
            ],
            components: [
                check(queue)
            ]
        })
        .then((msg) => {
             queue.npmessage = msg;
        })
    })
    .on('trackAdd', (queue, track) => {
        if(queue.tracks.length === 1) return;
        const embed = embed(queue, track)
        if(queue.tracks.length === 1){
            embed.addField(
                'Position', //tr('position')
                `> ${queue.tracks.length}`,
                true
            )
        }
        queue.metadata.send({ 
            embeds:[embed]
        }) 
    })
    .on('connectionError', (queue, error) => { 
        // if(queue.npmessage && queue.npmessage.editable) {
        //     queue.npmessage.delete().catch(error=> {});
        // }
        queue.metadata.send({ embeds: [
            new EmbedBuilder()
                .setDescription('I can\'t join your channel!') //tr("musicCantJoin")
                .setConfig()
            ]
        })
    })
    .on('error', (queue, e) => {
        console.error(e)
        if (queue) {
            if (queue.metadata) {
              return queue.metadata.send({ content: `An error encountered: ${e.toString().slice(0, 1974)}` }).catch(e => { })
            }
          }
    })
    .on('channelEmpty', (queue) => {
        // if(queue.npmessage && queue.npmessage.editable) {
        //     queue.npmessage.delete().catch(error=> {});
        // }
        queue.metadata.send({ embeds: [
            new EmbedBuilder()
                .setDescription('Voice channel is empty! Leaving the channel...') //tr("musicEmpty")
                .setConfig()
            ]
        })
    })
    .on('botDisconnect', (queue) => {
        // if(queue.npmessage && queue.npmessage.editable) {
        //     queue.npmessage.delete().catch(error=> {});
        // }
        queue.metadata.send({ embeds: [
            new EmbedBuilder()
                .setDescription('Voice channel is empty! Leaving the channel...') //tr("musicEmpty")
                .setConfig()
            ]
        })
    })
    // .on('trackEnd', (queue) => {
    //     if(queue.npmessage && queue.npmessage.editable) {
    //         queue.npmessage.delete().catch(error=> {});
    //     }
    // })
    .on('queueEnd', (queue) => {
        // if(queue.npmessage && queue.npmessage.editable) {
        //     queue.npmessage.delete().catch(error=> {});
        // }
        queue.metadata.send({ embeds: [
            new EmbedBuilder()
                .setDescription('All music has been played') //tr("musicPlayed")
                .setConfig()
            ]
        })
    })
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
    const p = await UserProfile(interaction);
	await p.checkAndUpdate();

	const g = await GuildProfile(interaction);
	await g.checkAndUpdate();

	const tr = i18nMixin(g.lang || tl3(interaction.locale) || "en");
    if(interaction.isButton()) await interaction.deferUpdate({ ephemeral: true }).catch(() => {}); else return;
    const queue = client.player.getQueue(interaction.guildId);
    if(!queue) return interaction.message.edit({ embeds: [
            new EmbedBuilder()
                .setConfig()
                .setDescription(tr('musicNoSong'))
        ]
    });
    const track = queue.current;
    if(interaction.customId === "pause"){
        queue.setPaused(true);
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
        queue.setPaused(false);
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
        await queue.destroy();
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
        await queue.skip()
        return interaction.message.edit({ 
            embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicSkip') + ` **${queue.current.title}** `)
            ], 
            components: []
        })
    }
    if(interaction.customId === "back"){
        if (!queue.previousTracks[1]) return interaction.reply({ embeds: [
            new EmbedBuilder()
                .setConfig()
                .setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongPre'))
            ]
        })
        await queue.back();
        return interaction.message.edit({ 
            embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setDescription(`\`${interaction.user.tag}\` ` + tr('musicPre') +  ` **${queue.current.title}** `)
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

function embed(queue, type){
    const embed = new EmbedBuilder()
    .setConfig()
    .setTitle(type.title)
    .setURL(type.url)
    .setImage(type.thumbnail)
    .addField(
        'Volume', //tr('volume')
        `> **${queue.volume}%**`,
        true
    )
    .addField(
        'Duration', //tr('duration')
        `> ${type.duration}`,
        true
    )
    .addField(
        'Request By', //tr('requestby')
        `> ${type.requestedBy}`,
        true
    )
    return embed;
}

    const loop = new ButtonBuilder()
      .setEmoji(`🔄`)
      .setCustomId('loop')
      .setLabel('None') //tr('none')
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
        .setLabel('Pause') //tr('pause')
        .setCustomId('pause')
        .setStyle(3);;

      const resume = new ButtonBuilder()
        .setEmoji(`▶`)
        .setLabel('Resume') //tr('resume')
        .setCustomId('resume')
        .setStyle(3);

      const loopt = new ButtonBuilder()
        .setEmoji(`🔂`)
        .setCustomId('loopt')
        .setLabel('Track') //tr('track')
        .setStyle(3);

      const loopq = new ButtonBuilder()
        .setEmoji(`🔁`)
        .setCustomId('loopq')
        .setLabel('Queue') //tr('queue')
        .setStyle(3);

function check(queue){
    var row = new ActionRowBuilder()
    if(queue.repeatMode === 0) if (queue.connection.paused) row.addComponents(resume, back, stop, skip, loop); else row.addComponents(pause, back, stop, skip, loop)
    else if(queue.repeatMode === 1) if (queue.connection.paused) row.addComponents(resume, back, stop, skip, loopt); else row.addComponents(pause, back, stop, skip, loopt)
    else if(queue.repeatMode === 2) if (queue.connection.paused) row.addComponents(resume, back, stop, skip, loopq); else row.addComponents(pause, back, stop, skip, loopq)
    return row;
            
}
