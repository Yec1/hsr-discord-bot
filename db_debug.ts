import { QuickDB } from "quick.db";
import path from "path";

async function debug() {
	const token = "j3u8b3ciqrr2lp2v4zk9i";
	const dbPath = path.resolve(__dirname, "../endfield/json.sqlite");
	console.log(`Checking DB at: ${dbPath}`);

	const endfieldDb = new QuickDB({ filePath: dbPath });

	const session = await endfieldDb.get(`profile_edit_token:${token}`);
	console.log("Session:", JSON.stringify(session, null, 2));

	if (session) {
		const userId = session.userId;
		const accounts = await endfieldDb.get(`${userId}.accounts`);
		console.log(
			`Accounts for ${userId}:`,
			accounts
				? Array.isArray(accounts)
					? accounts.length
					: "Not an array"
				: "NONE"
		);

		if (accounts && Array.isArray(accounts) && accounts.length > 0) {
			console.log(
				"First Account Info:",
				JSON.stringify(accounts[0].info, null, 2)
			);
		} else {
			// Check all keys for this user
			const all = await endfieldDb.all();
			const userKeys = all.filter(item => item.id.startsWith(userId));
			console.log(
				`Other keys for this user:`,
				userKeys.map(k => k.id)
			);
		}
	} else {
		console.log("No session found for this token.");
		// List some tokens
		const all = await endfieldDb.all();
		const tokens = all.filter(item =>
			item.id.startsWith("profile_edit_token:")
		);
		console.log(
			`Available tokens:`,
			tokens.map(k => k.id)
		);
	}
}

debug();
