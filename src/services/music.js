import { EventEmitter } from "events";
// prettier-ignore
import _d from "discord.js";
import { getComponent } from "./components.js";
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
	VoiceChannel,
	StringSelectMenuBuilder,
	ComponentType
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
	pause(queue) {
		if (queue.paused) {
			this.player.unpause();
			this.paused = false;
		} else {
			this.player.pause();
			this.paused = true;
		}
	}

	nowplaying() {
		return this.queue[0];
	}

	check() {
		let list;
		if (this.queue[0] === undefined) {
			list = false;
		} else {
			list = this.queue.map(
				(song, i) =>
					`**${i + 1}** - [${song.info.title}](${
						song.info.url
					}) - \`${song.info.durationRaw}\` ` +
					this.tr("requestby") +
					` ${song.member}`
			);
		}
		return list;
	}

	checkNext() {
		this.queue.splice(0, 1);
		if (this.queue.length == 0) this.destroy();
		else this.__play();
	}

	destroy() {
		this.channel.send({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setDescription(
						`${this.client.emoji.check} ${this.tr("musicPlayed")}`
					)
			]
		});
		this.player.removeAllListeners(AudioPlayerStatus.Idle);
		this.player.stop();

		if (this.connection.state.status != "destroyed")
			this.connection.destroy();
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
		const { resume, back, stop, skip, loop, pause } = getComponent(
			"music",
			this.tr
		);

		var row = new ActionRowBuilder();
		/*if(queue.repeatMode === 0)*/ this.queue.paused
			? row.addComponents(resume, back, stop, skip, loop)
			: row.addComponents(pause, back, stop, skip, loop);
		// else if(queue.repeatMode === 1) queue.paused? row.addComponents(resume, back, stop, skip, loopt) : row.addComponents(pause, back, stop, skip, loopt)
		// else if(queue.repeatMode === 2) queue.paused? row.addComponents(resume, back, stop, skip, loopq) : row.addComponents(pause, back, stop, skip, loopq)

		if (!this.started) this.started = true;

		const song = this.queue[0];

		this.channel.send({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(song.info.title || "-")
					.setURL(song.info.url)
					.setImage(
						song.info.thumbnails[song.info.thumbnails.length - 1]
							.url
					)
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
			],
			components: [row]
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
			i.player.off(AudioPlayerStatus.Idle, fn);
		};
		this.player.on(AudioPlayerStatus.Idle, fn);
	}

	async play(urlOrQuery, { member } = {}) {
		if (member) this.member = member;
		let yt_info = await play.search(urlOrQuery, {
			limit: 10
		});
		if (yt_info.length == 0) {
			this.channel.send({
				embeds: [
					new EmbedBuilder()
						.setDescription(
							`${this.client.emoji.cross} ${this.tr(
								"musicNoRes"
							)}`
						)
						.setConfig()
				]
			});
		}
		/**
		 * @type {YouTubeVideo}
		 */
		let song;
		if (yt_info.length > 1)
			song = await this.collectSong(yt_info, {
				edit: this.started
			});
		else song = yt_info[0];

		this.queue.push({
			stream: await play.stream(song.url),
			info: song,
			member: this.member
		});
		if (!this.started) {
			this.__play();
		}
	}
	/**
	 * open a collector to collect which song to chose, else return the 1st option
	 * @type {(info: YouTubeVideo[]) => YouTubeVideo}
	 */
	async collectSong(info, { time, edit } = { time: 50000, edit: false }) {
		const menu = new StringSelectMenuBuilder()
			.setCustomId("music-menu")
			.setPlaceholder("Please Select a Music");
		info.forEach((v, i) => {
			menu.addOptions({
				label: v.title || "-",
				description: `${v.durationRaw} - ${v.channel?.name}`,
				value: `music_c_${i + 1}`
			});
		});
		/**
		 * @type {Message}
		 */
		const msg2 = await this.channel.send({
			content: `<@${this.member.id}>`,
			embeds: [
				new EmbedBuilder()
					.setConfig(this.tr("chooseFooter"))
					.setTitle(this.tr("choose"))
			],
			components: [new ActionRowBuilder().addComponents(menu)]
		});
		try {
			const i = await msg2.awaitMessageComponent({
				filter: i =>
					i.values[0].startsWith("music_c_") &&
					i.user.id === this.member.id,
				componentType: ComponentType.SelectMenu,
				time: 15000
			});
			const n = parseInt(i.values[0].replace("music_c_", "")) - 1;
			if (!edit)
				msg2.edit({
					content: "",
					embeds: [
						new EmbedBuilder().setConfig().setDescription(
							this.tr("receive", {
								z: `[${info[n].title || "-"}](${info[n].url})`
							})
						)
					],
					components: []
				});
			else
				msg2.edit({
					content: "",
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(
								this.tr(
									"addedToQueue",
									`[${info[n].title || "-"}](${info[n].url})`
								)
							)
					],
					components: []
				});
			return info[n];
		} catch (e) {
			if (!edit)
				msg2.edit({
					content: "",
					embeds: [
						new EmbedBuilder().setConfig().setDescription(
							this.tr("noReceive", {
								z: `[${info[0].title || "-"}](${info[0].url})`
							})
						)
					],
					components: []
				});
			else
				msg2.edit({
					content: "",
					embeds: [
						new EmbedBuilder()
							.setConfig()
							.setDescription(
								this.tr(
									"addedToQueue",
									`[${info[0].title || "-"}](${info[0].url})`
								)
							)
					],
					components: []
				});
			return info[0];
		}
	}
}
