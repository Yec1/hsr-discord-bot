import { QuickDB } from "quick.db";
const db = new QuickDB();

function getRandomColor() {
	const letters = "0123456789ABCDEF";
	let color = "#";
	for (let i = 0; i < 6; i++)
		color += letters[Math.floor(Math.random() * 16)];

	return color;
}

function roundRect(ctx, x, y, width, height, radius) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + width, y, x + width, y + height, radius);
	ctx.arcTo(x + width, y + height, x, y + height, radius);
	ctx.arcTo(x, y + height, x, y, radius);
	ctx.arcTo(x, y, x + width, y, radius);
	ctx.closePath();
}

async function calXP(id) {
	const userdb = await db.get(`${id}`);
	const upgradeFactor = 1.5;
	let {
		xp: currentXp = 0,
		level: currentLevel = 0,
		reqXp: nextLevelReqXp = Math.floor(
			Math.pow(upgradeFactor, currentLevel) * 100
		)
	} = userdb || {};

	currentXp += Math.floor(Math.random() * 5) + 1;

	if (currentXp >= nextLevelReqXp) {
		currentXp = 0;
		currentLevel++;
		nextLevelReqXp = Math.floor(
			Math.pow(upgradeFactor, currentLevel) * 100
		);
	}

	userdb.xp = currentXp;
	userdb.level = currentLevel;
	userdb.reqXp = nextLevelReqXp;

	await db.set(`${id}`, userdb);
}

export { getRandomColor, roundRect, calXP };
