import { client } from "../index.js";
import { Events, ActivityType } from "discord.js";
import schedule from "node-schedule";
import notifyCheck from "./autonotify.js";
import dailyCheck from "./autodaily.js";
import { Logger } from "../services/logger.js";

async function updatePresence() {
	client.user.setPresence({
		activities: [
			{
				name: `${client.guilds.cache.size} 個伺服器`,
				type: ActivityType.Watching
			}
		],
		status: "online"
	});
}

client.on(Events.ClientReady, async () => {
	new Logger("系統").success(`${client.user.tag} 已經上線！`);
	dailyCheck();
	notifyCheck();

	schedule.scheduleJob("0 * * * *", function () {
		notifyCheck();
		dailyCheck();
	});

	setInterval(updatePresence, 10000);
});
