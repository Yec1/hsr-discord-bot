import express from "express";
import Logger from "./utilities/core/logger.js";
import { QuickDB } from "quick.db";
import { MongoDriver } from "quickmongo";

const db = new QuickDB();
const app = express();
const PORT = process.env.WEBSERVER_PORT || 3000;
// driver
// 	.connect()
// 	.then(() => {
// 		db = new QuickDB({ driver });
// 		new Logger("網站").command("已連接至資料庫！");
// 		// db = new QuickDB();
// 	})
// 	.catch(error => {
// 		new Logger("網站").command(`連線至資料庫失敗！錯誤訊息：${error}`);
// 	});

// Show server state
app.get("/", (req, res) => {
	res.json({ status: 200 });
});

app.use(express.json());

// Api route for creating mmt
app.get("/:userid", async (req, res) => {
	const { userid } = req.params;
	if (userid === "favicon.ico") return;
	const authHeader = req.headers.authorization;
	if (authHeader) {
		const token = authHeader.split(" ")[1];

		if (token === process.env.AUTHTOKEN) {
			new Logger("網站").command(`${userid} 請求用戶資料`);

			try {
				const userData = await db.get(userid);

				// Throw error if cookie is empty
				if (userData.account[0].cookie.length === 0)
					throw new Error("查無已綁定帳號，請先綁定帳號 Cookie！");

				// Parse cookies and language preference
				let userDetails = {
					cookie: userData.account[0].cookie
				};
				if (userData.locale) userDetails.lang = userData.locale;
				res.status(200).json(userDetails);
			} catch (error) {
				new Logger("網站").error(
					`抓取用戶資料時發生錯誤！錯誤訊息：${error}`
				);
				res.status(500).json({ message: error.message });
			}
		} else {
			res.status(401).send("Unauthorized");
		}
	} else {
		res.status(401).send("Unauthorized");
	}
});

app.listen(PORT, () => {
	new Logger("網站").info(`Server running on PORT ${PORT}`);
});
