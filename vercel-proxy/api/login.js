// Vercel serverless function: proxy login requests to Hoyoverse
// Deployed on Vercel so each request uses a different serverless IP,
// avoiding bot server IP rate limiting by Hoyoverse.

import { AuthClient } from "@yeci226/hoyoapi";

const API_TOKEN = process.env.API_TOKEN;

export default async function handler(req, res) {
	// Only allow POST
	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	// Validate bearer token
	const auth = req.headers["authorization"];
	if (!API_TOKEN || !auth || auth !== `Bearer ${API_TOKEN}`) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	const { account, password, aigisHeaderObject, deviceId } = req.body;

	if (!account || !password) {
		return res.status(400).json({ message: "Missing account or password" });
	}

	try {
		const client = new AuthClient();
		const result = await client.loginByPassword({
			account,
			password,
			...(aigisHeaderObject !== undefined && { aigisHeaderObject }),
			...(deviceId !== undefined && { deviceId }),
		});

		return res.status(200).json(result);
	} catch (error) {
		return res.status(500).json({
			status: "error",
			message: error.message || "Unknown error",
		});
	}
}
