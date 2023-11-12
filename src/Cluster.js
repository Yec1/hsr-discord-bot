import dotenv from "dotenv";
import fs from "fs";
Object.assign(process.env, dotenv.parse(fs.readFileSync("./.env")));

import { ClusterManager, HeartbeatManager } from "discord-hybrid-sharding";

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
		console.log(`[SHARD] Launched Cluster ${cluster.id}`);
	});

	cluster.on("reconnecting", () => {
		console.log(`[SHARD] Reconnecting Cluster ${cluster.id} to discord WS`);
	});

	cluster.on("death", () => {
		console.log(`[SHARD] Reclustering Cluster ${cluster.id}`);
		manager.recluster?.start();
	});
});

manager.spawn({ timeout: -1 });
