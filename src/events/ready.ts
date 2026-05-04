import { client, cluster } from "@/index.js";
import { Events, ActivityType } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import autoDailySign from "@/utilities/hsr/autoDaily.js";
import autoRedeem from "@/utilities/hsr/autoRedeem.js";
import autoMimo from "@/utilities/hsr/autoMimo.js";
import { setupLeaderboardMaintenance } from "@/utilities/hsr/profile.js";
import schedule from "node-schedule";

let presenceInterval: NodeJS.Timeout | null = null;
let hourlyJob: schedule.Job | null = null;
let dailyJob: schedule.Job | null = null;
let isAutoRedeemRunning = false;
let isAutoDailyRunning = false;

async function runAutoRedeem(): Promise<void> {
	const logger = new Logger("自動兌換排程");
	if (isAutoRedeemRunning) {
		logger.info("上一輪自動兌換尚未完成，跳過本次觸發");
		return;
	}
	isAutoRedeemRunning = true;
	try {
		await autoRedeem();
	} catch (error: any) {
		logger.error(`自動兌換排程執行失敗: ${error?.message || error}`);
	} finally {
		isAutoRedeemRunning = false;
	}
}

async function runAutoDailySign(): Promise<void> {
	const logger = new Logger("自動簽到排程");
	if (isAutoDailyRunning) {
		logger.info("上一輪自動簽到尚未完成，跳過本次觸發");
		return;
	}
	isAutoDailyRunning = true;
	try {
		await autoDailySign();
	} catch (error: any) {
		logger.error(`自動簽到排程執行失敗: ${error?.message || error}`);
	} finally {
		isAutoDailyRunning = false;
	}
}

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
		runAutoDailySign();
		runAutoRedeem();
		autoMimo();
		setupLeaderboardMaintenance();

		if (!hourlyJob) {
			hourlyJob = schedule.scheduleJob("0 * * * *", function () {
				runAutoDailySign();
				autoMimo();
			});
		}

		if (!dailyJob) {
			dailyJob = schedule.scheduleJob("0 8 * * *", function () {
				runAutoRedeem();
				setupLeaderboardMaintenance();
			});
		}
	}

	if (presenceInterval) clearInterval(presenceInterval);
	presenceInterval = setInterval(updatePresence, 300_000);
});
