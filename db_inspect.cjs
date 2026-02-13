const { QuickDB } = require("quick.db");
const path = require("path");

async function debug() {
	const dbPath = path.resolve(__dirname, "../endfield/json.sqlite");
	console.log(`Checking DB at: ${dbPath}`);

	const endfieldDb = new QuickDB({ filePath: dbPath });

	const targetUserId = "283946584461410305";
	const accounts = await endfieldDb.get(`${targetUserId}.accounts`);

	console.log(`Accounts Data:`, JSON.stringify(accounts, null, 2));
	console.log(`Type: ${typeof accounts}`);
	console.log(`IsArray: ${Array.isArray(accounts)}`);
	if (accounts) {
		console.log(`Length: ${accounts.length}`);
	}

	// Try reading with all() just in case get() is acting up
	const all = await endfieldDb.all();
	const specific = all.find(i => i.id === `${targetUserId}.accounts`);
	console.log(`All() result for key:`, specific ? "FOUND" : "NOT FOUND");
	if (specific) {
		console.log(`All() value:`, JSON.stringify(specific.value, null, 2));
	}
}

debug();
