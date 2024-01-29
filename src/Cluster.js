import dotenv from "dotenv";
import fs from "fs";
Object.assign(process.env, dotenv.parse(fs.readFileSync("./.env")));

import { ClusterManager, HeartbeatManager } from "discord-hybrid-sharding";
import { Logger } from "./services/logger.js";

const manager = new ClusterManager(`${process.cwd()}/src/index.js`, {
	totalShards: "auto",
	totalClusters: 5,
	shardsPerClusters: 5,
	mode: "worker",
	token:
		process.env.NODE_ENV === "dev"
			? process.env.TESTOKEN
			: process.env.TOKEN,
	restarts: {
		max: 5,
		interval: 1000 * 60 * 60 * 2
	}
});

manager.extend(
	new HeartbeatManager({
		interval: 2000,
		maxMissedHeartbeats: 5
	})
);

manager.on("clusterCreate", cluster => {
	cluster.on("ready", () => {
		new Logger("分片").info(`已啟動 Cluster #${cluster.id}`);
	});

	cluster.on("reconnecting", () => {
		new Logger("分片").info(`重新連接集群 #${cluster.id} 至 Discord WS`);
	});

	cluster.on("death", () => {
		new Logger("分片").info(`重新聚類集群 ${cluster.id}`);
		manager.recluster?.start();
	});
});

manager.spawn().then(() => {
	setInterval(async () => {
		await manager.broadcastEval(
			`this.ws.status && this.isReady() ? this.ws.reconnect() : 0`
		);
	}, 60000);
});
