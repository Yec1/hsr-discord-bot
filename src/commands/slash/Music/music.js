import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { QueryType } from 'discord-player';

export default {
	data: new SlashCommandBuilder()
		.setName("music")
		.setDescription("Music commands")
		.setNameLocalizations({
			"zh-TW": "音樂",
			ja: "music"
		})
		.setDescriptionLocalizations({
			"zh-TW": "關於音樂的指令",
			ja: "undefined"
		})
        .addSubcommand(subcommand =>
			subcommand
				.setName("play")
				.setDescription("Play the music!")
				.setNameLocalizations({
					"zh-TW": "播放",
					ja: "play"
				})
				.setDescriptionLocalizations({
					"zh-TW": "播放音樂！",
					ja: "undefined"
				})
				.addStringOption(string =>
					string
						.setName("music")
						.setDescription("Music you want to play")
						.setNameLocalizations({
							"zh-TW": "音樂",
							ja: "music"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想播放的音樂",
							ja: "undefined"
						})
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("stop")
				.setDescription("Stop the music!")
				.setNameLocalizations({
					"zh-TW": "停止",
					ja: "stop"
				})
				.setDescriptionLocalizations({
					"zh-TW": "停止音樂！",
					ja: "undefined"
			})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("skip")
				.setDescription("Skip the music!")
				.setNameLocalizations({
					"zh-TW": "跳過",
					ja: "skip"
				})
				.setDescriptionLocalizations({
					"zh-TW": "跳過當前音樂！",
					ja: "undefined"
			})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("previous")
				.setDescription("Play previous music!")
				.setNameLocalizations({
					"zh-TW": "返回",
					ja: "previous"
				})
				.setDescriptionLocalizations({
					"zh-TW": "播放前一首音樂！",
					ja: "undefined"
			})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("pause")
				.setDescription("Pause the music!")
				.setNameLocalizations({
					"zh-TW": "暫停",
					ja: "pause"
				})
				.setDescriptionLocalizations({
					"zh-TW": "暫停當前音樂！",
					ja: "undefined"
			})
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("resume")
				.setDescription("Resume the music!")
				.setNameLocalizations({
					"zh-TW": "繼續",
					ja: "resume"
				})
				.setDescriptionLocalizations({
					"zh-TW": "繼續當前音樂！",
					ja: "undefined"
			})
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		if (!interaction.member.voice.channel) {
			return interaction.reply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNotinChannel'))
				],
				ephemeral: true
			})
		}
		// if(args[0] !== "play") {
		// 	const queue = client.distube.getQueue(interaction)
		// 	if (!queue) return interaction.reply({ embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` `+ tr('musicNoSong'))
		// 		],
		// 		ephemeral: true
		// 	})
		// }
		// const queue = client.distube.getQueue(interaction)
		if (args[0] == "play") {
			const song = interaction.options.getString('music')
			const queue = await client.player.createQueue(interaction.guildId, {
				leaveOnEnd: true,
				leaveOnStop: true,
				leaveOnEmpty: true,
				leaveOnEmptyCooldown: 60 * 1000 * 3,
				autoSelfDeaf: true,
				initialVolume: 40,
				bufferingTimeout: 200,
				spotifyBridge: false,
				disableVolume: false,
				volumeSmoothness: false,
				onBeforeCreateStream: false,
				ytdlOptions: {
				  filter: "audioonly",
				  fmt: "mp3",
				  highWaterMark: 1 << 62,
				  liveBuffer: 1 << 62,
				  dlChunkSize: 0,
				  bitrate: 128,
				  quality: "lowestaudio",
				},
				metadata: interaction.channel,
			  });
			  const res = await client.player.search(song, {
				requestedBy: interaction.member,
				searchEngine: QueryType.AUTO
			  });

			  if (!res || !res.tracks.length) {
				return interaction.reply({ embeds: [
					new EmbedBuilder()
						.setDescription(tr("musicNoRes"))
						.setConfig()
					], 
					ephemeral: true 
				});
			  }
			  if (!queue.playing) {
				interaction.reply({ embeds: [
					new EmbedBuilder()
						.setDescription(tr("musicSearch"))
						.setConfig()
					], 
					ephemeral: true 
				});
			  }
			  try {
				if (!queue.connection) await queue.connect(interaction.member.voice.channel);
				if(res.playlist) { 
					queue.addTracks(res.tracks)
					queue.metadata.send({ embeds: [
							new EmbedBuilder()
								.setConfig()
								.setTitle(res.tracks[0].playlist.title)
								.setURL(res.tracks[0].playlist.url)
								.setImage(res.tracks[0].playlist.thumbnail.url)
								.addField(
									'Volume', //tr('volume')
									`> **${queue.volume}%**`,
									true
								)
								.addField(
									'Length', //tr('length')
									`> ${res.tracks.length}`,
									true
								)
								.addField(
									'Request By', //tr('requestby')
									`> ${res.tracks[0].requestedBy}`,
									true
								)
						]
					})
				} else queue.addTrack(res.tracks[0]);
				if (!queue.playing) await queue.play();
			  } catch(err){
				console.error(err);
				await queue.destroy();
				return await interaction.channel.send({ embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription("This media doesn't seem to be working right now, please try again later.")
					]
				});
			}
		}
		// if (args[0] == "stop") {
		// 	queue.stop()
		// 	return interaction.reply({ embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` ` + tr('musicStop'))
		// 		]
		// 	})
		// }
		// if (args[0] == "skip") {
		// 	if (queue.songs.length === 1 && queue.autoplay === false) return interaction.reply({ embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongNext'))
		// 		],
		// 		ephemeral: true
		// 	})
        // 	var song = await queue.skip()
		// 	await interaction.reply({ embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` ` + tr('musicSkip') + ` ${song.name}`)
		// 		]
		// 	})
		// }
		// if (args[0] == "skip") {
		// 	if (queue.previousSongs.length == 0) return interaction.reply({ embeds: [
		// 		new EmbedBuilder()
		// 			.setConfig()
		// 			.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongPre'))
		// 		],
		// 		ephemeral: true
		// 	})
        // 	var song = await queue.previous()
		// 	await interaction.message.edit({ 
		// 		embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` ` + tr('musicPre') + ` ${song.name}`)
		// 		]
		// 	})
		// }
		// if (args[0] == "pause") {
		// 	if (queue.paused) {
		// 		queue.resume()
		// 		return interaction.reply({ embeds: [
		// 				new EmbedBuilder()
		// 					.setConfig()
		// 					.setDescription(`\`${interaction.user.tag}\` ` + tr('musicResume'))
		// 			]
		// 		})
		// 	}
		// 	queue.pause()
		// 	await interaction.reply({ embeds: [
		// 			new EmbedBuilder()
		// 				.setConfig()
		// 				.setDescription(`\`${interaction.user.tag}\` ` + tr('musicPause'))
		// 		]
		// 	})
		// }
		// if (args[0] == "resume") {
		// 	if (queue.paused) {
		// 		queue.resume()
		// 		return interaction.reply({ embeds: [
		// 				new EmbedBuilder()
		// 					.setConfig()
		// 					.setDescription(`\`${interaction.user.tag}\` ` + tr('musicResume'))
		// 			]
		// 		})
		// 	} else {
		// 		return interaction.reply({ embeds: [
		// 				new EmbedBuilder()
		// 					.setConfig()
		// 					.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoPause'))
		// 			],
		// 			ephemeral: true
		// 		})
		// 	}
		// }
	}
};
