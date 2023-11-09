import { client } from "../index.js";
import { Events, ActivityType } from "discord.js";
import schedule from "node-schedule";
import notifyCheck from "./autonotify.js";
import dailyCheck from "./autodaily.js";

client.on(Events.ClientReady, async () => {
	console.log(`[CLIENT] ${client.user.tag} 已經上線！`);

	const results = await client.cluster.broadcastEval(
		c => c.guilds.cache.size
	);
	const totalGuilds = results.reduce((prev, val) => prev + val, 0);

	client.user.setPresence({
		activities: [
			{
				name: `${totalGuilds} 個伺服器`,
				type: ActivityType.Watching
			}
		],
		status: "online"
	});

	dailyCheck();

	schedule.scheduleJob("0 * * * *", function () {
		notifyCheck();
		dailyCheck();
	});
});
