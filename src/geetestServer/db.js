import { MongoDriver } from "quickmongo";
import { QuickDB } from "quick.db";
import { webServerDb } from "./server.js";
import { Logger } from "../utilities/core/logger.js";

// Connect to database
// Return database instance
export async function connectDb() {
	try {
		// Connect to mongodb
		const driver = new MongoDriver("mongodb://127.0.0.1/quickdb");
		await driver.connect();
		// Initialize quickdb
		const db = new QuickDB({ driver });

		new Logger("WebServer").info("已連接至資料庫！");

		return db;
	} catch (error) {
		new Logger("WebServer").error(`連線至資料庫失敗！錯誤訊息：${error}`);
	}
}

// Get the user account and language preference from database
export async function getUserDetails(discordId) {
	try {
		const userData = await webServerDb.get(discordId);

		// Throw error if cookie is empty
		if (userData.account[0].cookie.length === 0)
			throw new Error("查無已綁定帳號，請先綁定帳號 Cookie！");

		// Parse cookies and language preference
		let userDetails = {
			cookie: userData.account[0].cookie
		};
		if (userData.locale) userDetails.lang = userData.locale;

		return userDetails;
	} catch (error) {
		new Logger("WebServer").error(`抓取用戶資料失敗！${error}`);
		throw new Error(error);
	}
}
