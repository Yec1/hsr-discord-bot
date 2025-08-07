import { fileURLToPath } from "url";
import { dirname } from "path";
import { ClusterManager, HeartbeatManager } from "discord-hybrid-sharding";
import Logger from "@/utilities/core/logger.js";
import { getConfig } from "@/utilities/core/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = getConfig();
const token = process.env.NODE_ENV === "dev" ? config.TEST_TOKEN : config.TOKEN;

if (!token) {
	throw new Error("Discord token is required");
}
/**
 * @description 分片管理器 */
const clusterManager = new ClusterManager(`${__dirname}/index.js`, {
	totalShards: "auto",
	totalClusters: 5,
	mode: "worker",
	token,
	restarts: {
		max: 5,
		interval: 1000 * 60 * 60 * 2
	}
});

clusterManager.extend(
	new HeartbeatManager({ interval: 2000, maxMissedHeartbeats: 5 })
);

clusterManager.on("clusterCreate", cluster => {
	cluster.on("ready", () => {
		new Logger("分片").info(`已啟動分片 #${cluster.id}`);
	});

	cluster.on("reconnecting", () => {
		new Logger("分片").info(`重新連接分片 #${cluster.id} • Discord WS`);
	});

	cluster.on("death", () => {
		new Logger("分片").info(`重新啟動分片 ${cluster.id}`);
		clusterManager.recluster?.start();
	});
});

(async () => {
	await clusterManager.spawn();
	setInterval(
		() =>
			clusterManager.broadcastEval(
				`this.ws.status && this.isReady() ? this.ws.reconnect() : 0`
			),
		60_000
	);
})();
