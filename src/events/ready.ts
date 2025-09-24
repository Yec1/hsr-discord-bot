import { client, cluster } from "@/index.js";
import { Events, ActivityType } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import autoDailySign from "@/utilities/hsr/autoDaily.js";
import autoRedeem from "@/utilities/hsr/autoRedeem.js";
import { setupLeaderboardMaintenance } from "@/utilities/hsr/profile.js";
import schedule from "node-schedule";

let presenceInterval: NodeJS.Timeout | null = null;
let hourlyJob: schedule.Job | null = null;
let dailyJob: schedule.Job | null = null;

async function updatePresence(): Promise<void> {
	const results = await cluster.broadcastEval(
		(c: any) => c.guilds.cache.size
	);
	const totalGuilds = results.reduce(
		(prev: number, val: number) => prev + val,
		0
	);

	client.user?.setPresence({
		activities: [
			{
				name: `${totalGuilds} 個伺服器`,
				type: ActivityType.Watching
			}
		],
		status: "online"
	});
}

client.once(Events.ClientReady, async () => {
	new Logger("系統").success(`${client.user?.tag || "Bot"} 已經上線！`);
	if (cluster.id == 0) {
		autoDailySign();
		autoRedeem();
		setupLeaderboardMaintenance();

		if (!hourlyJob) {
			hourlyJob = schedule.scheduleJob("0 * * * *", function () {
				autoDailySign();
				autoRedeem();
			});
		}

		if (!dailyJob) {
			dailyJob = schedule.scheduleJob("0 2 * * *", function () {
				setupLeaderboardMaintenance();
			});
		}
	}

	if (presenceInterval) clearInterval(presenceInterval);
	presenceInterval = setInterval(updatePresence, 10000);
});
