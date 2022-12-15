import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ComponentType
} from "discord.js";
import { Queue } from "../../../services/music.js";
import load from "lodash";

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
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("queue")
				.setDescription("List the music queue")
				.setNameLocalizations({
					"zh-TW": "隊列",
					ja: "queue"
				})
				.setDescriptionLocalizations({
					"zh-TW": "查看音樂播放列表",
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
							`${client.emoji.warning} \`${interaction.user.tag}\` ` +
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
								`${client.emoji.cross} \`${interaction.user.tag}\` ` +
									tr("musicNoSong")
							)
					],
					ephemeral: true
				});
			else {
				if (
					queue.player._state.status === "idle" ||
					queue.player._state.status === "buffering"
				)
					return interaction.reply({
						embeds: [
							new EmbedBuilder()
								.setConfig()
								.setDescription(
									`${client.emoji.cross} \`${interaction.user.tag}\` ` +
										tr("musicNoSong")
								)
						],
						ephemeral: true
					});
			}
		}

		if (args[0] == "play") {
			const song = interaction.options.getString("music");
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(tr("musicSearch"))
						.setConfig()
				],
				ephemeral: true
			});

			if (queue)
				return void client.music.get(interaction.guild.id).play(song);

			return void new Queue(
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
							`${client.emoji.check} ${queue.paused}`
								? tr("musicPause")
								: tr("musicResume")
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
						.setDescription(
							`${client.emoji.check} ${tr("musicSkip")}`
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "stop") {
			queue.destroy();
		} /* else if (args[0] == "previous") {
			queue.previous();
		} */ else if (args[0] == "queue") {
			var page = 0;
			var embed, list, mapping, pages;

			function getEmbed(interaction) {
				list = queue.check();
				if (list === false) {
					pages = 0;
					return (embed = new EmbedBuilder()
						.setConfig(`${tr("page")} ${page + 1}/1`)
						.setDescription(tr("queue_no_song"))
						.setThumbnail(
							interaction.guild.iconURL({
								size: 4096,
								dynamic: true
							})
						));
				}
				mapping = load.chunk(list, 10);
				pages = mapping.map(s => s.join("\n"));
				return (embed = new EmbedBuilder()
					.setConfig(`${tr("page")} ${page + 1}/${pages.length}`)
					.setDescription(pages[page])
					.setThumbnail(
						interaction.guild.iconURL({
							size: 4096,
							dynamic: true
						})
					));
			}

			const row = new ActionRowBuilder().addComponents([
				new ButtonBuilder()
					.setCustomId("queue_back")
					.setEmoji("⬅")
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId("queue_next")
					.setEmoji("➡")
					.setStyle(1)
			]);

			getEmbed(interaction);
			const resp = await interaction.reply({
				embeds: [embed],
				components: [row]
			});

			const filter = i => true;

			const collector = resp.createMessageComponentCollector({
				filter,
				componentType: ComponentType.Button
			});

			collector.on("collect", interaction => {
				if (!interaction.isButton()) return;
				if (interaction.customId === "queue_next") {
					page = page + 1 < pages.length ? ++page : 0;
					getEmbed(interaction);
					return interaction.message.edit({
						embeds: [embed],
						components: [row]
					});
				}
				if (interaction.customId === "queue_back") {
					page = page > 0 ? --page : pages.length - 1;
					getEmbed(interaction);
					return interaction.message.edit({
						embeds: [embed],
						components: [row]
					});
				}
			});
		}
	}
};
