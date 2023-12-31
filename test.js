import { QuickDB } from "quick.db";
import { MongoDriver } from "quickmongo";

const mongoDriver = new MongoDriver("mongodb://127.0.0.1/quickdb");

async function connectToMongo() {
	try {
		await mongoDriver.connect();
		console.log("Connected to MongoDB!");
		await migrateData();
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
	}
}

async function migrateData() {
	const quickDB = new QuickDB();
	const mongodbdb = new QuickDB({ mongoDriver });

	try {
		const quickDBData = await quickDB.all();
		for (const key of quickDBData) await mongodbdb.set(key.id, key.value);

		console.log(
			`Data migration completed! Total ${quickDBData.length} datas`
		);
	} catch (error) {
		console.error("Error migrating data:", error);
	}

	console.log(await mongodbdb.all());
}

// 執行遷移
connectToMongo();
