import { EventEmitter } from "events";
import { Client } from "discord.js";
import { i18nMixin } from "./i18n.js";

/**
 * class for global music handling. should be in the client.
 * @extends {EventEmitter}
 */
class MusicManager {}

/**
 * class for guild music queue.
 * @extends {EventEmitter}
 */
class Queue extends EventEmitter {
	/**
	 * client object, from the channel instance given.
	 * @type {Client}
	 */
	client;

	/**
	 * guild object, from the channel instance given.
	 */
	guild;

	/**
	 * channel object. this is where music annoucements will be made
	 */
	channel;

	/**
	 * translate object where strings will use to handle during the context.
	 * defaults to english if no translate handler is given
	 */
	tr = i18nMixin("en");

	constructor(channel) {
		super();
	}
}
