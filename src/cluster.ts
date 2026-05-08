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
	totalClusters: "auto",
	mode: "worker",
	respawn: true,
	token,
	restarts: {
		max: 5,
		interval: 1000 * 60 * 60 * 2
	}
});

clusterManager.extend(
	new HeartbeatManager({ interval: 2000, maxMissedHeartbeats: 30 })
);

clusterManager.on("clusterCreate", cluster => {
	cluster.on("ready", () => {
		new Logger("分片").info(`已啟動分片 #${cluster.id}`);
		// 定期輸出記憶體使用量監控
		setInterval(
			() => {
				const memory = process.memoryUsage();
				new Logger("系統").info(
					`[Cluster #${cluster.id}] Memory Usage: RSS: ${(memory.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`
				);
			},
			1000 * 60 * 10
		);
	});

	cluster.on("reconnecting", () => {
		new Logger("分片").info(`重新連接分片 #${cluster.id} • Discord WS`);
	});

	cluster.on("death", () => {
		new Logger("分片").info(`重新啟動分片 ${cluster.id}`);
		clusterManager.recluster?.start();
	});
});

process.on("uncaughtException", error => {
	try {
		new Logger("集群").error(`未捕獲的異常: ${error}`);
	} catch {}
});

process.on("unhandledRejection", (reason, promise) => {
	try {
		new Logger("集群").error(`未處理的Promise拒絕: ${reason}`);
	} catch {}
});

(async () => {
	try {
		await clusterManager.spawn();
	} catch (error) {
		new Logger("集群").error(`啟動集群失敗: ${error}`);
		process.exit(1);
	}
})();
