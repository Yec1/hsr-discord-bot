import { client } from "./index.js";

import { Loader } from "./core/Loader.js";
import { Collection } from "discord.js";
import { ClusterClient } from "discord-hybrid-sharding";
import { QuickDB } from "quick.db";
import { Logger } from "./services/logger.js";
import { MongoDriver } from "quickmongo";
const driver = new MongoDriver("mongodb://127.0.0.1/quickdb");

driver
	.connect()
	.then(() => {
		client.db = new QuickDB({ driver });
		new Logger("系統").info("已連接至資料庫！");

		// const quickDB = new QuickDB();
		// const mongodbdb = new QuickDB({ driver });

		// try {
		// 	const quickDBData = await quickDB.all();
		// 	for (const key of quickDBData)
		// 		await mongodbdb.set(key.id, key.value);

		// 	new Logger("系統").info(
		// 		`資料庫已合併 ${quickDBData.length} 筆資料`
		// 	);
		// } catch (error) {
		// 	new Logger("系統").error(`資料庫合併失敗！錯誤訊息：${error}`);
		// }
	})
	.catch(error => {
		new Logger("系統").error(`連線至資料庫失敗！錯誤訊息：${error}`);
	});

// Global Variables
client.cluster = new ClusterClient(client);
client.commands = {
	slash: new Collection(),
	message: new Collection()
};
client.loader = new Loader(client);
await client.loader.load();

client.login(
	process.env.NODE_ENV === "dev" ? process.env.TESTOKEN : process.env.TOKEN
);
