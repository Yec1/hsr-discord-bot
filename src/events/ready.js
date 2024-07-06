import { client } from "../index.js";
import { Events, ActivityType } from "discord.js";
import { Logger } from "../utilities/core/logger.js";
import autoDailySign from "../utilities/hsr/autoDaily.js";
import autoRedeem from "../utilities/hsr/autoRedeem.js";
import schedule from "node-schedule";

async function updatePresence() {
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
}

client.on(Events.ClientReady, async () => {
	new Logger("系統").success(`${client.user.tag} 已經上線！`);
	autoDailySign();
	autoRedeem();

	if ((await client.db.get("autoNotify")) == null) {
		await client.db.set("autoNotify", {
			"283946584461410305": {
				channelId: "1125008836860837938",
				tag: false,
				stamina: 220
			}
		});
	}

	schedule.scheduleJob("0 * * * *", function () {
		if (client.cluster.id == 0) {
			autoDailySign();
			autoRedeem();
		}
	});

	setInterval(updatePresence, 10000);
});
