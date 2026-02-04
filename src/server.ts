import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import Logger from "@/utilities/core/logger.js";
import { QuickDB } from "quick.db";

import { getConfig } from "@/utilities/core/config.js";
const config = getConfig();

const db = new QuickDB();
const app = express();
const PORT = config.WEBSERVER_PORT || 3000;

// Designation: Central Verification Hub Master
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const sessions = new Map<string, WebSocket>();

wss.on("connection", ws => {
	ws.on("message", message => {
		try {
			const data = JSON.parse(message.toString());
			if (data.type === "register") {
				sessions.set(data.sessionId, ws);
				// Set timeout to cleanup
				setTimeout(
					() => sessions.delete(data.sessionId),
					15 * 60 * 1000
				);
			}
		} catch (e) {
			// Ignore invalid messages
		}
	});

	ws.on("close", () => {
		for (const [sid, conn] of sessions.entries()) {
			if (conn === ws) sessions.delete(sid);
		}
	});
});

app.use(express.json());

// Show server state
app.get("/", (req: Request, res: Response) => {
	res.json({ status: 200, role: "Verification Hub" });
});

// Serve verify.html
app.get("/verify", (req: Request, res: Response) => {
	const filePath = path.resolve(process.cwd(), "verify.html");
	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.status(500).send("Error loading verify.html");
			return;
		}
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(data);
	});
});

// Geetest callback
app.post("/callback", (req: Request, res: Response) => {
	const { sessionId, result } = req.body;
	const botWs = sessions.get(sessionId);
	if (botWs && botWs.readyState === WebSocket.OPEN) {
		botWs.send(JSON.stringify({ type: "result", sessionId, result }));
		sessions.delete(sessionId);
		res.json({ success: true });
	} else {
		res.status(404).json({
			success: false,
			message: "Bot connection not found for this session"
		});
	}
});

// Api route for creating mmt
app.get("/api/user/:userid", async (req: Request, res: Response) => {
	const { userid } = req.params;
	if (userid === "favicon.ico") return;
	const authHeader = req.headers.authorization;
	if (authHeader) {
		const token = authHeader.split(" ")[1];

		if (token && token === process.env.AUTHTOKEN) {
			new Logger("網站").command(`${userid} 請求用戶資料`);

			try {
				const userData = (await db.get(
					(Array.isArray(userid) ? userid[0] : userid) || ""
				)) as any;

				if (
					!userData?.account?.[0]?.cookie ||
					userData.account[0].cookie.length === 0
				)
					throw new Error("無已設定帳號，請綁定帳號 Cookie");

				res.status(200).json({
					cookie: userData.account[0].cookie,
					lang: userData.locale
				});
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

server.listen(PORT, () => {
	new Logger("網站").info(`Verification Hub running on PORT ${PORT}`);
});
