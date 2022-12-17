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
		// .addSubcommand(subcommand =>
		// 	subcommand
		// 		.setName("previous")
		// 		.setDescription("Play previous music!")
		// 		.setNameLocalizations({
		// 			"zh-TW": "返回",
		// 			ja: "previous"
		// 		})
		// 		.setDescriptionLocalizations({
		// 			"zh-TW": "播放前一首音樂！",
		// 			ja: "undefined"
		// 		})
		// )
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
				.setName("volume")
				.setDescription("Change the play volume!")
				.setNameLocalizations({
					"zh-TW": "音量",
					ja: "volume"
				})
				.setDescriptionLocalizations({
					"zh-TW": "更改播放的音量數值",
					ja: "undefined"
				})
				.addIntegerOption(Integer =>
					Integer.setName("number")
						.setDescription("You want to set the volume")
						.setNameLocalizations({
							"zh-TW": "數值",
							ja: "number"
						})
						.setDescriptionLocalizations({
							"zh-TW": "你想更改的音量",
							ja: "undefined"
						})
						.setRequired(true)
				)
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
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("loop")
				.setDescription("Change how playlist loop")
				.setNameLocalizations({
					"zh-TW": "循環",
					ja: "loop"
				})
				.setDescriptionLocalizations({
					"zh-TW": "更改歌單循環方式",
					ja: "undefined"
				})
				.addStringOption(option =>
					option
						.setName("select")
						.setDescription("Select a loop mode")
						.setNameLocalizations({
							"zh-TW": "選擇",
							ja: "select"
						})
						.setDescriptionLocalizations({
							"zh-TW": "選擇循環的模式",
							ja: "undefined"
						})
						.setRequired(true)
						.addChoices(
							{
								name: "off",
								name_localizations: {
									"zh-TW": "無",
									ja: "undefined"
								},
								value: "off"
							},
							{
								name: "track",
								name_localizations: {
									"zh-TW": "單曲",
									ja: "undefined"
								},
								value: "track"
							},
							{
								name: "queue",
								name_localizations: {
									"zh-TW": "歌單",
									ja: "undefined"
								},
								value: "queue"
							}
						)
				)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		const emoji = client.emoji;
		if (!interaction.member.voice.channel) {
			return interaction.reply({
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

		if (args[0] !== "play") {
			if (!queue)
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(
								`${emoji.cross} <@${interaction.user.id}> ` +
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
									`${emoji.cross} <@${interaction.user.id}> ` +
										tr("musicNoSong")
								)
						],
						ephemeral: true
					});
			}
		}
		if (args[0] == "play") {
			const song = interaction.options.getString("music");
			if (song.length > 99) {
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setDescription(tr("musicQueryTooLont"))
							.setConfig()
					],
					ephemeral: true
				});
			}
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
			queue.pause(queue);
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`${
								queue.paused
									? `${emoji.pause} ${tr("musicPause")}`
									: `${emoji.play} ${tr("musicResume")}`
							}`
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "skip") {
			const song = queue.nowplaying();
			queue.next();
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`${emoji.check} <@${interaction.user.id}> ${tr(
								"musicSkip"
							)}\n[${song.info.title}](${song.info.url})`
						)
						.setThumbnail(
							song.info.thumbnails[
								song.info.thumbnails.length - 1
							].url
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "volume") {
			const number = interaction.options.getInteger("number");
			if (number < 0 || number > 200)
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setDescription(
								`${emoji.cross} <@${interaction.user.id}> ${tr(
									"musicVolumeErr"
								)}`
							)
							.setConfig()
					],
					ephemeral: true
				});
			queue.volume(number);
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`${emoji.check} <@${interaction.user.id}> ${tr(
								"musicChange"
							)} ${number}%`
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "stop") {
			queue.destroy();
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`${emoji.check} <@${interaction.user.id}> ${tr(
								"musicStop"
							)}`
						)
						.setConfig()
				],
				ephemeral: false
			});
		} else if (args[0] == "loop") {
			const mode = interaction.options.getString("select");
			if (mode === "off") queue.loop = 0;
			else if (mode === "track") queue.loop = 1;
			else if (mode === "queue") queue.loop = 2;
		} /* else if (args[0] == "previous") {
			queue.previous();
		} */ else if (args[0] == "queue") {
			var page = 0;
			var list, mapping, pages, embed;

			/*
				addField Queue
			*/
			// eslint-disable-next-line no-inner-declarations
			// function getEmbed() {
			// 	embed = new EmbedBuilder().setThumbnail(
			// 		interaction.guild.iconURL({
			// 			size: 4096,
			// 			dynamic: true
			// 		})
			// 	);
			// 	list = queue.check(embed);
			// 	if (list === false) {
			// 		pages = 0;
			// 		return embed
			// 			.setConfig(`${tr("page")} ${page + 1}/1`)
			// 			.setDescription(tr("queue_no_song"));
			// 	} else if (list.length === 1) {
			// 		pages = 0;
			// 		page = 1;
			// 		return embed.setConfig(`${tr("page")} ${page}/1`);
			// 	}
			// 	mapping = load.chunk(list, 9);
			// 	pages = mapping.map(s => s.join(" "));
			// 	return embed.setConfig(
			// 		`${tr("page")} ${page + 1}/${pages.length}`
			// 	);
			// }

			/*
				setDescription Queue
			*/
			function getEmbed() {
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
					.setEmoji(emoji.back)
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId("queue_next")
					.setEmoji(emoji.skip)
					.setStyle(1)
			]);

			getEmbed();
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
					getEmbed();
					return interaction.message.edit({
						embeds: [embed],
						components: [row]
					});
				}
				if (interaction.customId === "queue_back") {
					page = page > 0 ? --page : pages.length - 1;
					getEmbed();
					return interaction.message.edit({
						embeds: [embed],
						components: [row]
					});
				}
			});
		}
	}
};
