const { QuickDB } = require("quick.db");
const path = require("path");

async function debug() {
	const dbPath = path.resolve(__dirname, "../endfield/json.sqlite");
	console.log(`Checking DB at: ${dbPath}`);

	const endfieldDb = new QuickDB({ filePath: dbPath });
	const all = await endfieldDb.all();

	console.log(`Total Keys: ${all.length}`);

	// Sample prefixes to understand structure
	const prefixes = new Set();
	all.forEach(item => {
		const parts = item.id.split(/[.:]/);
		if (parts.length > 0) prefixes.add(parts[0]);
	});

	console.log("Account-like keys (283946584461410305):");
	const targetUserId = "283946584461410305";
	const userKeys = all.filter(item => item.id.includes(targetUserId));
	userKeys.forEach(k => console.log(`  - ${k.id}`));

	console.log("Unique Prefixes Found:", Array.from(prefixes));
}

debug();
