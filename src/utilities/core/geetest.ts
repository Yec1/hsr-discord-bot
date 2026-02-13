import crypto from "node:crypto";
import Logger from "./logger.js";

const logger = new Logger("GeetestUtil");

/**
 * Create a dynamic secret for geetest API endpoint.
 * Using the Hoyoverse mobile salt from the shared project.
 */
function createDs(): string {
	const t = Math.floor(Date.now() / 1000);
	const r = Math.floor(Math.random() * 100000 + 100000);
	const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
	const q = "is_high=false";
	const h = crypto
		.createHash("md5")
		.update(`salt=${salt}&t=${t}&r=${r}&b=&q=${q}`)
		.digest("hex");
	return `${t},${r},${h}`;
}

/**
 * Creates geetest, return mmt data (gt, challenge, etc.)
 * @param cookie Hoyoverse account cookie
 */
export async function createMmt(cookie: string): Promise<any> {
	const headers = {
		DS: createDs(),
		Cookie: cookie,
		"x-rpc-challenge_path":
			"https://bbs-api-os.hoyolab.com/game_record/app/hkrpg/api/challenge",
		"x-rpc-app_version": "2.55.0",
		"x-rpc-challenge_game": "6",
		"x-rpc-client_type": "5",
		Accept: "application/json, text/plain, */*",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
		Origin: "https://act.hoyolab.com",
		Referer: "https://act.hoyolab.com/"
	};

	const url =
		"https://sg-public-api.hoyolab.com/event/toolcomsrv/risk/createGeetest?is_high=true&app_key=hkrpg_game_record";

	try {
		logger.info(`Creating Geetest MMT session...`);
		const response = await fetch(url, { headers });
		const mmt = (await response.json()) as any;

		if (mmt.retcode !== 0) {
			logger.error(
				`Failed to create MMT: ${mmt.message} (retcode: ${mmt.retcode})`
			);
			throw new Error(`Failed to create MMT: ${mmt.message}`);
		}

		logger.success(`MMT session created successfully.`);
		return mmt.data;
	} catch (error: any) {
		logger.error(`Error in createMmt: ${error.message}`);
		throw error;
	}
}

/**
 * Verify geetest result with Hoyoverse risk API
 * @param result Geetest output (challenge, validate, seccode)
 * @param cookie Hoyoverse account cookie
 */
export async function verifyMmt(result: any, cookie: string): Promise<void> {
	const headers = {
		DS: createDs(),
		Cookie: cookie,
		"x-rpc-challenge_path":
			"https://bbs-api-os.hoyolab.com/game_record/app/hkrpg/api/challenge",
		"x-rpc-app_version": "2.55.0",
		"x-rpc-challenge_game": "6",
		"x-rpc-client_type": "5",
		"Content-Type": "application/json",
		Accept: "application/json, text/plain, */*",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
		Origin: "https://act.hoyolab.com",
		Referer: "https://act.hoyolab.com/"
	};

	const url =
		"https://sg-public-api.hoyolab.com/event/toolcomsrv/risk/verifyGeetest";

	// Ensure app_key is present in payload
	const payload = {
		...result,
		app_key: "hkrpg_game_record"
	};

	try {
		logger.info(`Verifying Geetest MMT result...`);
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(payload)
		});

		const verifyResult = (await response.json()) as any;

		if (verifyResult.retcode !== 0) {
			const retcode = verifyResult.retcode;
			const message = verifyResult.message || "Unknown error";
			logger.error(
				`Verification failed: ${message} (retcode: ${retcode})`
			);

			let errorMessage = `Verification failed (retcode ${retcode})`;
			switch (retcode) {
				case 30001:
					errorMessage =
						"Geetest verification failed - cookie may be expired or invalid request.";
					break;
				case 30002:
					errorMessage = "Invalid parameters.";
					break;
				case 30003:
					errorMessage = "Verification code expired.";
					break;
				default:
					errorMessage = `${message} (${retcode})`;
			}
			throw new Error(errorMessage);
		}

		logger.success(`Geetest MMT verification successful.`);
	} catch (error: any) {
		logger.error(`Error in verifyMmt: ${error.message}`);
		throw error;
	}
}
