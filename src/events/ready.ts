import { client, cluster } from "@/index.js";
import { Events, ActivityType } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import autoDailySign from "@/utilities/hsr/autoDaily.js";
import autoRedeem from "@/utilities/hsr/autoRedeem.js";
import {
	setupLeaderboardMaintenance,
	setupImageCacheCleanup
} from "@/utilities/hsr/profile.js";
import { setupWarpImageCacheCleanup } from "@/utilities/hsr/warp.js";
import { setupNoteImageCacheCleanup } from "@/utilities/hsr/note.js";
import schedule from "node-schedule";

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

client.on(Events.ClientReady, async () => {
	new Logger("系統").success(`${client.user?.tag || "Bot"} 已經上線！`);
	if (cluster.id == 0) {
		autoDailySign();
		autoRedeem();
		setupLeaderboardMaintenance();
		setupImageCacheCleanup();
		setupWarpImageCacheCleanup();
		setupNoteImageCacheCleanup();

		schedule.scheduleJob("0 * * * *", function () {
			autoDailySign();
			autoRedeem();
		});

		schedule.scheduleJob("0 2 * * *", function () {
			setupLeaderboardMaintenance();
		});
	}

	setInterval(updatePresence, 10000);
});
