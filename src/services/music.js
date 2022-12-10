import { EventEmitter } from "events";
// prettier-ignore
import _d from "discord.js";
const {
	Message,
	Channel,
	GuildBasedChannel,
	Client,
	Guild,
	Collection,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	VoiceChannel
} = _d;
import {
	createAudioPlayer,
	createAudioResource,
	StreamType,
	demuxProbe,
	AudioPlayer,
	joinVoiceChannel,
	NoSubscriberBehavior,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	getVoiceConnection,
	entersState
} from "@discordjs/voice";
import { i18nMixin } from "./i18n.js";
import play, { YouTubeVideo, yt_validate } from "play-dl";

/**
 * class for global music handling. should be in the client.
 * @extends {Collection}
 */
export class MusicManager extends Collection {}

/**
 * class for guild music queue.
 * @extends {EventEmitter}
 */
export class Queue extends EventEmitter {
	/**
	 * var to check is queue started.
	 * @type {boolean}
	 */
	started = false;
	/**
	 * client object, from the channel instance given.
	 * @type {Client}
	 */
	client;

	/**
	 * guild object, from the channel instance given.
	 * @type {Guild}
	 */
	guild;

	/**
	 * refered message or followups, used for replyment.
	 * @type {Message}
	 */
	msg;

	/**
	 * channel object. this is where music annoucements will be made
	 * @type {GuildBasedChannel}
	 */
	channel;

	connection;

	/**
	 * @type {AudioPlayer}
	 */
	player;

	/**
	 * @type {boolean}
	 */
	paused = false;

	initialMember;

	/**
	 * translate object where strings will use to handle during the context.
	 * defaults to english if no translate handler is given
	 * @type {(string: string) => any}
	 */
	tr = i18nMixin("en");

	/**
	 * queue of songs
	 * @type {{ stream: any, info: YouTubeVideo }[]}
	 */
	queue = [];

	constructor({ vc, channel, member }, { tr } = {}) {
		super();
		// if (!(channel instanceof Channel))
		// 	throw new Error("given channel not a instance of channel");
		if (!(vc instanceof VoiceChannel))
			throw new Error("given channel not a instance of channel");

		this.initialMember = member;
		this.channel = channel;
		this.client = channel.client;
		this.guild = channel.guild;
		if (tr && typeof tr == "function") this.tr = tr;
		this.client.music.set(this.guild.id, this);

		this.connection = joinVoiceChannel({
			channelId: vc.id,
			guildId: this.guild.id,
			adapterCreator: this.guild.voiceAdapterCreator
		});
	}

	/**
	 * either pauses or resumes the player.
	 */
	pause() {
		if (this.player.paused) this.player.unpause(true);
		else this.player.pause(true);
		this.paused = !this.paused;
	}

	checkNext() {}
	next() {}

	/**
	 * this **plays** the audio.
	 * @private
	 */
	async __play(n = 0) {
		const song = this.queue[n];
		let resource = createAudioResource(song.stream.stream, {
			inputType: song.stream.type,
			inlineVolume: true
		});

		const player = (this.player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play
			}
		}));

		this.connection.subscribe(player);
		player.play(resource);
		try {
			await entersState(player, AudioPlayerStatus.Playing, 5_000);
		} catch (error) {
			console.error(error);
		}

		const i = this;
		player.on(AudioPlayerStatus.Idle, () => {
			i.checkNext();
		});
	}

	async play(urlOrQuery) {
		if (
			urlOrQuery.startsWith("https") &&
			yt_validate(urlOrQuery) === "video"
		) {
			const song = await play.search(urlOrQuery, {
				limit: 1
			})[0];
			if (!song) return;
			this.queue.push({
				stream: await play.stream(urlOrQuery),
				info: song
			});
			this.__play(urlOrQuery);
		} else {
			let yt_info = await play.search(urlOrQuery, {
				limit: 5
			});
			if (yt_info.length == 0) {
				this.channel.send({
					embeds: [
						new EmbedBuilder()
							.setDescription(this.tr("musicNoRes"))
							.setConfig()
					]
				});
			}
			/**
			 * @type {YouTubeVideo}
			 */
			let song;
			if (yt_info.length > 1) song = await this.collectSong(yt_info);
			else song = yt_info[0];

			this.channel.send({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(song.title || "-")
						.setURL(song.url)
						.setImage(song.thumbnails[0].url)
						.addField(
							this.tr('volume'),
							`> **${0}%**`,
							true
						)
						.addField(
							this.tr('requestby'),
							`> ${this.initialMember}`,
							true
						)
						.addField(
							this.tr('duration'),
							`> ${song.durationRaw}`,
							true
						)
				]
			});
			this.queue.push({
				stream: await play.stream(song.url),
				info: song
			});
			this.__play(0);
		}
	}
	/**
	 * open a collector to collect which song to chose, else return the 1st option
	 * @type {(info: YouTubeVideo[]) => YouTubeVideo}
	 */
	async collectSong(info, { time } = { time: 50000 }) {
		const row = new ActionRowBuilder();

		info.forEach((_, i) =>
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`music_c_${i + 1}`)
					.setLabel(`${i + 1}`)
					.setStyle(ButtonStyle.Primary)
			)
		);
		/**
		 * @type {Message}
		 */
		const msg2 = await this.channel.send({
			content: `<@${this.initialMember.id}>`,
			embeds: [
				new EmbedBuilder()
					.setConfig(this.tr("chooseFooter"))
					.setTitle(this.tr("choose"))
					.setDescription(
						info
							.map(
								(v, i) =>
									`${i + 1}. [${v.title || "-"}](${v.url})`
							)
							.join("\n")
					)
			],
			components: [row]
		});
		try {
			/**
			 * @type {ButtonInteraction}
			 */
			const i = await msg2.awaitMessageComponent({
				filter: i =>
					i.customId.startsWith("music_c_") &&
					i.user.id === this.initialMember.id,
				time: 15000
			});
			const n = parseInt(i.customId.replace("music_c_"));
			await i.editReply({
				embed: [
					new EmbedBuilder().setConfig().setDescription(
						this.tr("receive", {
							z: `[${info[n].title || "-"}](${info[n].url})`
						})
					)
				]
			});
			return info[n];
		} catch {
			msg2.edit(
				this.tr("noReceive", {
					z: `[${info[0].title || "-"}](${info[0].url})`
				})
			);
			return info[0];
		}
	}
}
