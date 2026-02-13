const { QuickDB } = require("quick.db");
const path = require("path");

async function debug() {
	const dbPath = path.resolve(__dirname, "../endfield/json.sqlite");
	const endfieldDb = new QuickDB({ filePath: dbPath });

	// Check multiple tokens from the log
	const tokens = ["lg4soswagicaev8b50dorh", "7yvk0lentnd616kpge845d"];

	for (const token of tokens) {
		const session = await endfieldDb.get(`profile_edit_token:${token}`);
		console.log(`Token: ${token}`);
		console.log(`Session:`, JSON.stringify(session, null, 2));
		if (session) {
			console.log(`userId type: ${typeof session.userId}`);
			console.log(`userId value: ${session.userId}`);

			const accounts = await endfieldDb.get(`${session.userId}.accounts`);
			console.log(
				`Accounts found with session.userId:`,
				accounts ? "YES" : "NO"
			);

			const accountsStr = await endfieldDb.get(
				`${String(session.userId)}.accounts`
			);
			console.log(
				`Accounts found with String(session.userId):`,
				accountsStr ? "YES" : "NO"
			);
		}
		console.log("---");
	}
}

debug();
