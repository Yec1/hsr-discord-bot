import { MongoDriver } from "quickmongo";
import { QuickDB } from "quick.db";
import { webServerDb } from "./server.js";
import { Logger } from "../services/logger.js";

// Connect to database
// Return database instance
export async function connectDb() {
	try {
		// Connect to mongodb
		const driver = new MongoDriver("mongodb://127.0.0.1/quickdb");
		await driver.connect();
		// Initialize quickdb
		const db = new QuickDB({ driver });

		new Logger("Webserver").info("Connect to database!");

		return db;
	} catch (error) {
		new Logger("Webserver").error(
			`Failed to connect to database! Error msg:${error}`
		);
	}
}

// Get the user account and language preference from database
export async function getUserDetails(discordId) {
	try {
		const userData = await webServerDb.get(discordId);

		// Throw error if cookie is empty
		if (userData.account[0].cookie.length === 0)
			throw new Error("Cookie is empty. Please set your cookie.");

		// Parse cookies and language preference
		let userDetails = {
			cookie: userData.account[0].cookie
		};
		if (userData.locale) userDetails.lang = userData.locale;

		return userDetails;
	} catch (error) {
		new Logger("Webserver").error(`Failed to fetch user data! ${error}`);
		throw new Error(error);
	}
}
