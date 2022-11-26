import { client } from "../index.js"
const guildLanguages = /* client.db.get(`lang-${interation.guild.id}`) ||*/ 'en';
import { translates } from '../languages/en.js'

export function translate(arg) {
	return translates(arg)
}
