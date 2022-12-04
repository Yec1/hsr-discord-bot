import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";

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
			/*
				TODO: ephemeral
			*/
			return interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNotinChannel'))
				],
				ephemeral: true
			})
		}
		if(args[0] !== "play") {
			/*
				TODO: ephemeral
			*/
			const queue = client.distube.getQueue(interaction)
			if (!queue) return interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` `+ tr('musicNoSong'))
				],
				ephemeral: true
			})
		}
		const queue = client.distube.getQueue(interaction)
		if (args[0] == "play") {
			const song = interaction.options.getString('music')
			client.distube.play(interaction.member.voice.channel, song, {
				member: interaction.member,
				textChannel: interaction.channel,
				interaction
			})
			await interaction.editReply({ 
				/*
					TODO: ephemeral
				*/
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicSearch'))
				],
				ephemeral: true
			})
		}
		if (args[0] == "stop") {
			queue.stop()
			return interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicStop'))
				]
			})
		}
		if (args[0] == "skip") {
			if (queue.songs.length === 1 && queue.autoplay === false) return interaction.editReply({ embeds: [
				/*
					TODO: ephemeral
				*/
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongNext'))
				],
				ephemeral: true
			})
        	var song = await queue.skip()
			await interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicSkip') + ` ${song.name}`)
				]
			})
		}
		if (args[0] == "skip") {
			if (queue.previousSongs.length == 0) return interaction.editReply({ embeds: [
				/*
					TODO: ephemeral
				*/
				new EmbedBuilder()
					.setConfig()
					.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoSongPre'))
				],
				ephemeral: true
			})
        	var song = await queue.previous()
			await interaction.message.edit({ 
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicPre') + ` ${song.name}`)
				]
			})
		}
		if (args[0] == "pause") {
			if (queue.paused) {
				queue.resume()
				return interaction.editReply({ embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(`\`${interaction.user.tag}\` ` + tr('musicResume'))
					]
				})
			}
			queue.pause()
			await interaction.editReply({ embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(`\`${interaction.user.tag}\` ` + tr('musicPause'))
				]
			})
		}
		if (args[0] == "resume") {
			if (queue.paused) {
				queue.resume()
				return interaction.editReply({ embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(`\`${interaction.user.tag}\` ` + tr('musicResume'))
					]
				})
			} else {
				return interaction.editReply({ embeds: [
					/*
						TODO: ephemeral
					*/
						new EmbedBuilder()
							.setConfig()
							.setDescription(`\`${interaction.user.tag}\` ` + tr('musicNoPause'))
					],
					ephemeral: true
				})
			}
		}
	}
};
