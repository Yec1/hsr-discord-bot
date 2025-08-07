import express, { Request, Response } from "express";
import Logger from "@/utilities/core/logger.js";
import { QuickDB } from "quick.db";
// import { MongoDriver } from "quickmongo";

interface UserData {
	account: Array<{
		cookie: string;
	}>;
	locale?: string;
}

interface UserDetails {
	cookie: string;
	lang?: string;
}

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
app.get("/", (req: Request, res: Response) => {
	res.json({ status: 200 });
});

app.use(express.json());

// Api route for creating mmt
app.get("/:userid", async (req: Request, res: Response) => {
	const { userid } = req.params;
	if (userid === "favicon.ico") return;
	const authHeader = req.headers.authorization;
	if (authHeader) {
		const token = authHeader.split(" ")[1];

		if (token && token === process.env.AUTHTOKEN) {
			new Logger("網站").command(`${userid} 請求用戶資料`);

			try {
				const userData = (await db.get(userid || "")) as UserData;

				// Throw error if cookie is empty
				if (
					!userData?.account?.[0]?.cookie ||
					userData.account[0].cookie.length === 0
				)
					throw new Error("無已設定帳號，請綁定帳號 Cookie");

				// Parse cookies and language preference
				let userDetails: UserDetails = {
					cookie: userData.account[0].cookie
				};
				if (userData.locale) userDetails.lang = userData.locale;
				res.status(200).json(userDetails);
			} catch (error) {
				new Logger("網站").error(
					`抓取用戶資料時發生錯誤！錯誤訊息：${error}`
				);
				res.status(500).json({ message: (error as Error).message });
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
