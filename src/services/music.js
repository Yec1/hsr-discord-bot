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
 * this manages most playing
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

	/**
	 * the latest requestor of this guild queue.
	 */
	member;

	/**
	 * pending connection.
	 */
	connection;

	/**
	 * @type {AudioPlayer}
	 */
	player;

	/**
	 * @type {boolean}
	 */
	paused = false;

	/**
	 * translate object where strings will use to handle during the context.
	 * defaults to english if no translate handler is given
	 * @type {(string: string) => any}
	 */
	tr = i18nMixin("en");

	/**
	 * queue of songs.
	 * the 0 index is always the nowplaying audio.
	 * @type {{ stream: any, info: YouTubeVideo, by: any }[]}
	 */
	queue = [];

	constructor({ vc, channel, member }, { tr } = {}) {
		super();
		// if (!(channel instanceof Channel))
		// 	throw new Error("given channel not a instance of channel");
		if (!(vc instanceof VoiceChannel))
			throw new Error("given channel not a instance of channel");

		this.member = member;
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

		this.player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play
			}
		});

		this.connection.subscribe(this.player);
	}

	/**
	 * either pauses or resumes the player.
	 */
	pause() {
		if (this.player.paused) {
			this.player.unpause(true);
			this.paused = false;
		} else {
			this.player.pause(true);
			this.paused = true;
		}
	}

	checkNext() {
		this.queue.splice(0, 1);
		if (this.queue.length == 0) this.destroy();
		else this.__play();
	}

	destroy() {
		this.player.stop();
		this.client.music.delete(this.guild.id, this);
	}

	next() {
		this.player.stop();
		this.checkNext();
	}

	/**
	 * this starts 0st index audio.
	 * @private
	 */
	async __play() {
		const song = this.queue[0];

		this.channel.send({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(song.info.title || "-")
					.setURL(song.info.url)
					.setImage(song.info.thumbnails[0].url)
					.addField(
						this.tr("requestby"),
						`> ${song.member || this.member}`,
						true
					)
					.addField(
						this.tr("duration"),
						`> ${song.info.durationRaw}`,
						true
					)
			]
		});

		let resource = createAudioResource(song.stream.stream, {
			inputType: song.stream.type,
			inlineVolume: true
		});

		this.player.play(resource);
		try {
			await entersState(this.player, AudioPlayerStatus.Playing, 5_000);
		} catch (error) {
			console.error(error);
		}

		const i = this;
		const fn = () => {
			i.checkNext();
			i.player.off(AudioPlayerStatus.Idle);
		};
		this.player.on(AudioPlayerStatus.Idle, fn);
	}

	async play(urlOrQuery, { member } = {}) {
		if (member) this.member = member;
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

			this.queue.push({
				stream: await play.stream(song.url),
				info: song,
				member: this.member
			});
			this.__play();
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
			content: `<@${this.member.id}>`,
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
					i.user.id === this.member.id,
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
