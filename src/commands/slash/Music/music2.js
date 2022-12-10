import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { Queue } from "../../../services/music.js";

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
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setDescription(
							`\`${interaction.user.tag}\` ` +
								tr("musicNotinChannel")
						)
				],
				ephemeral: true
			});
		}
		const queue = client.music.get(interaction.guild.id);
		if (args[0] !== "play") {
			if (!queue)
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(
								`\`${interaction.user.tag}\` ` +
									tr("musicNoSong")
							)
					],
					ephemeral: true
				});
		}
		if (args[0] == "play") {
			const song = interaction.options.getString("music");
			if (client.music.has(interaction.guild.id))
				client.music.get(interaction.guild.id).play(song);

			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(tr("musicSearch"))
						.setConfig()
				],
				ephemeral: true
			});
			new Queue(
				{
					vc: interaction.member.voice.channel,
					channel: interaction.channel,
					member: interaction.member
				},
				{ tr }
			).play(song);
		} else if (args[0] == "resume" || args[0] == "pause") {
			queue.pause();
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							queue.paused ? tr("musicPause") : tr("musicResume")
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "skip") {
			queue.next();
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(tr("musicSkip"))
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "stop") {
			queue.destroy();
		}
	}
};
