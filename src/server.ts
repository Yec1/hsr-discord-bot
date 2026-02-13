import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import Logger from "@/utilities/core/logger.js";
import { QuickDB } from "quick.db";
import axios from "axios";
import crypto from "crypto";

import { getConfig } from "@/utilities/core/config.js";
const config = getConfig();

const db = new QuickDB();
const endfieldDb = new QuickDB({
	filePath: path.resolve(process.cwd(), "../endfield-discord-bot/json.sqlite")
});
const app = express();
const PORT = config.WEBSERVER_PORT || 3000;

const DEFAULT_ENDFIELD_TEMPLATE = {
	id: "default",
	name: "Default",
	authorId: "system",
	background: {
		url: "bg.08c7f0.png",
		overlay: "rgba(0, 0, 0, 0.4)"
	},
	canvas: { width: 2400, height: 1600, padding: 80 },
	elements: {
		avatar: {
			x: 80,
			y: 80,
			width: 180,
			height: 180,
			radius: 30,
			visible: true
		},
		name: { x: 300, y: 170, fontSize: 80, bold: true, visible: true },
		badge: { x: 300, y: 225, fontSize: 36, visible: true },
		statsGrid: {
			x: 80,
			y: 320,
			itemWidth: 537.5,
			height: 140,
			gap: 30,
			visible: true
		},
		missionBox: { x: 80, y: 480, width: 1558, height: 160, visible: true },
		authLevelBox: {
			x: 1658,
			y: 480,
			width: 662,
			height: 160,
			visible: true
		},
		realtimeTitle: { x: 150, y: 670, fontSize: 50, visible: true },
		staminaBox: { x: 80, y: 750, width: 750, height: 180, visible: true },
		activityBpBox: {
			x: 870,
			y: 750,
			width: 1450,
			height: 180,
			visible: true
		},
		operatorsTitle: { x: 80, y: 990, fontSize: 50, visible: true },
		operatorsGrid: {
			x: 80,
			y: 1020,
			cols: 10,
			gap: 15,
			charWidth: 210,
			charHeight: 270,
			visible: true
		}
	}
};

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
app.use((req, res, next) => {
	new Logger("網站").info(`[${req.ip}] ${req.method} ${req.url}`);
	next();
});

// Endfield Static Assets
app.use(
	"/assets",
	express.static(
		path.resolve(process.cwd(), "../endfield-discord-bot/src/assets")
	)
);
app.use(
	"/endfield/public",
	express.static(path.resolve(process.cwd(), "src/web/public"))
);

// Debug route to check headers
app.get("/debug", (req: Request, res: Response) => {
	res.json({
		status: 200,
		headers: req.headers,
		ip: req.ip,
		ips: req.ips,
		url: req.url,
		method: req.method
	});
});

// Show server state
app.get("/", (req: Request, res: Response) => {
	res.json({ status: 200, role: "Verification Hub" });
});

// Favicon fix
app.get("/favicon.ico", (req: Request, res: Response) => {
	res.status(204).end();
});

// Serve verify.html for different games
app.get("/:game/verify", (req: Request, res: Response) => {
	const { game } = req.params;
	console.log(
		`[Server] Request /${game}/verify from ${req.ip}. Params:`,
		req.query
	);
	let projectDir = "";

	switch (game) {
		case "hsr":
			projectDir = process.cwd();
			break;
		case "zzz":
			projectDir = path.resolve(process.cwd(), "../ZZZ");
			break;
		case "endfield":
			projectDir = path.resolve(process.cwd(), "../endfield-discord-bot");
			break;
		default:
			res.status(404).send("Game not found");
			return;
	}

	const filePath = path.resolve(projectDir, "verify.html");
	fs.readFile(filePath, (err, data) => {
		if (err) {
			console.error(
				`[Server] Error loading ${game} verify.html from ${filePath}:`,
				err
			);
			res.status(500).send(`Error loading ${game} verify.html`);
			return;
		}
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(data);
	});
});

// Backward compatibility or default route
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

import { createMmt, verifyMmt } from "@/utilities/core/geetest.js";

// Api route for creating mmt or getting user data
app.get("/geetest/mmt/:userid", async (req: Request, res: Response) => {
	const { userid } = req.params;
	if (!userid) {
		res.status(400).json({ message: "Missing userid" });
		return;
	}
	try {
		const userData = (await db.get(userid as string)) as any;
		const cookie = userData?.account?.[0]?.cookie;
		if (!cookie) throw new Error("User cookie not found");

		const mmtData = await createMmt(cookie);
		res.json(mmtData);
	} catch (error: any) {
		new Logger("伺服器").error(
			`Failed to create MMT for ${userid}: ${error.message}`
		);
		res.status(500).json({ message: error.message });
	}
});

// Verify geetest result for game record
app.post("/geetest/verify/:userid", async (req: Request, res: Response) => {
	const { userid } = req.params;
	if (!userid) {
		res.status(400).json({ message: "Missing userid" });
		return;
	}
	const { sessionId, result } = req.body;
	try {
		const userData = (await db.get(userid as string)) as any;
		const cookie = userData?.account?.[0]?.cookie;
		if (!cookie) throw new Error("User cookie not found");

		// 1. Verify with Hoyoverse API
		await verifyMmt(result, cookie);

		// 2. Notify the bot via WebSocket (if sessionId exists)
		if (sessionId) {
			const botWs = sessions.get(sessionId);
			if (botWs && botWs.readyState === WebSocket.OPEN) {
				botWs.send(
					JSON.stringify({ type: "result", sessionId, result })
				);
				sessions.delete(sessionId);
			}
		}

		res.json({ success: true });
	} catch (error: any) {
		new Logger("伺服器").error(
			`Verification failed for ${userid}: ${error.message}`
		);
		res.status(500).json({ message: error.message });
	}
});

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
					(userid as string) || ""
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

// --- Endfield Profile Editor Logic ---

const ENCRYPTION_KEY =
	"6492d77a82ec5a3d7e9b0845a9214b2d86f7c32e1a90b84c7d6e5f4c3b2a1a0d";

function decrypt(hash: string): string {
	if (!hash || typeof hash !== "string") return hash;
	const parts = hash.split(":");
	if (parts.length !== 3) return hash;
	try {
		const key = /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)
			? Buffer.from(ENCRYPTION_KEY, "hex")
			: crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
		const [ivHex, authTagHex, encryptedHex] = parts;
		if (!ivHex || !authTagHex || !encryptedHex) return hash;

		const iv = Buffer.from(ivHex, "hex");
		const authTag = Buffer.from(authTagHex, "hex");
		const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
		decipher.setAuthTag(authTag);
		let decrypted = decipher.update(encryptedHex, "hex", "utf8");
		decrypted += decipher.final("utf8");
		return decrypted;
	} catch (error) {
		return hash;
	}
}

function generateSignV2(
	path: string,
	content: string,
	timestamp: string,
	platform: string,
	vName: string,
	dId: string = "",
	providedSalt?: string
): string {
	const salt = providedSalt || "";
	const headerJson = `{"platform":"${platform}","timestamp":"${timestamp}","dId":"${dId}","vName":"${vName}"}`;
	const s = `${path}${content}${timestamp}${headerJson}`;
	const hmac = crypto.createHmac("sha256", salt).update(s).digest("hex");
	return crypto.createHash("md5").update(hmac).digest("hex");
}

app.get("/endfield/profile/edit", (req, res) => {
	res.sendFile(path.resolve(process.cwd(), "src/web/public/index.html"));
});

app.get("/endfield/api/proxy", async (req, res) => {
	const url = req.query.url as string;
	if (!url) return res.status(400).send("No URL");
	try {
		const response = await axios.get(url, { responseType: "arraybuffer" });
		const contentType = response.headers["content-type"];
		if (contentType) res.setHeader("Content-Type", contentType);
		res.send(response.data);
		return;
	} catch (e) {
		res.status(500).send("Proxy error");
		return;
	}
});

app.get("/endfield/api/illustrators", async (req, res) => {
	try {
		const dir = path.resolve(
			process.cwd(),
			"../endfield/src/assets/illustrators"
		);
		if (!fs.existsSync(dir)) return res.json([]);
		const files = await fs.promises.readdir(dir);
		res.json(
			files.filter(
				f =>
					f.toLowerCase().endsWith(".png") ||
					f.toLowerCase().endsWith(".jpg")
			)
		);
	} catch (e) {
		res.status(500).json({ error: "Failed to list illustrators" });
	}
});

app.get("/endfield/api/profile/:token", async (req, res) => {
	const token = req.params.token;
	try {
		const session = (await endfieldDb.get(
			`profile_edit_token:${token}`
		)) as any;
		if (!session || session.expiresAt < Date.now()) {
			return res.status(401).json({ error: "Invalid or expired token" });
		}

		// Activate session and extend expiry to 24h to prevent work loss
		if (!session.activated) {
			await endfieldDb.set(`profile_edit_token:${token}`, {
				...session,
				activated: true,
				expiresAt: Date.now() + 24 * 60 * 60 * 1000
			});
		}

		const userId = session.userId;
		let template = (await endfieldDb.get(
			`profile.${userId}.template`
		)) as any;
		if (!template) template = DEFAULT_ENDFIELD_TEMPLATE;

		const accounts = (await endfieldDb.get(`${userId}.accounts`)) as any;
		const account = accounts?.[0];

		if (!account)
			return res.status(404).json({ error: "Account not found" });

		// Decrypt sensitive fields
		const cred = decrypt(account.cred);
		const salt = decrypt(account.salt);

		// Fetch card detail from Skport
		const role = account.roles?.[0]?.roles?.[0];
		const uid = account.info?.id || account.roles?.[0]?.uid;

		if (!role || !uid)
			return res.status(404).json({ error: "Role/UID not found" });

		// Simple fetch for card detail
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const pathname = "/api/v1/game/endfield/card/detail";
		const query = `roleId=${role.roleId}&serverId=${role.serverId}&userId=${uid}`;

		const sign = generateSignV2(
			pathname,
			query,
			timestamp,
			"3",
			"1.0.0",
			"",
			salt
		);

		const cardRes = await axios.get(
			`https://zonai.skport.com${pathname}?${query}`,
			{
				headers: {
					cred: cred,
					timestamp: timestamp,
					sign: sign,
					platform: "3",
					vName: "1.0.0",
					"sk-language": "zh_Hant",
					"user-agent": "Mozilla/5.0"
				}
			}
		);

		res.json({
			template,
			detail: cardRes.data?.data?.detail,
			user: {
				id: userId,
				username: account.info?.nickname || "User"
			}
		});
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

app.post("/endfield/api/profile/:token/share", async (req, res) => {
	const token = req.params.token;
	try {
		const session = (await endfieldDb.get(
			`profile_edit_token:${token}`
		)) as any;
		if (!session || session.expiresAt < Date.now()) {
			return res.status(401).json({ error: "Invalid or expired token" });
		}

		// Extend session on every save/share to keep active users alive
		await endfieldDb.set(`profile_edit_token:${token}`, {
			...session,
			expiresAt: Date.now() + 15 * 60 * 1000
		});

		const { template } = req.body;
		if (!template)
			return res.status(400).json({ error: "Missing template" });

		const id = crypto.randomBytes(4).toString("hex"); // 8 chars UUID
		const sharedTemplate = {
			...template,
			id,
			authorId: session.userId,
			sharedAt: Date.now()
		};

		await endfieldDb.set(`profile.templates.${id}`, sharedTemplate);
		res.json({ success: true, id });
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

app.post("/endfield/api/profile/:token", async (req, res) => {
	const token = req.params.token;
	try {
		const session = (await endfieldDb.get(
			`profile_edit_token:${token}`
		)) as any;
		if (!session || session.expiresAt < Date.now()) {
			return res.status(401).json({ error: "Invalid or expired token" });
		}

		// Extend session on every save/share to keep active users alive
		await endfieldDb.set(`profile_edit_token:${token}`, {
			...session,
			expiresAt: Date.now() + 15 * 60 * 1000
		});

		const { template } = req.body;
		if (template === null) {
			await endfieldDb.delete(`profile.${session.userId}.template`);
		} else {
			await endfieldDb.set(
				`profile.${session.userId}.template`,
				template
			);
		}
		res.json({ success: true });
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

server.listen(PORT, () => {
	new Logger("網站").info(`Verification Hub running on PORT ${PORT}`);
});
