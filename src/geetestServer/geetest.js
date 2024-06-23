import crypto from "crypto";

// Create a dynamic secret for geetest API endpoint.
function createDs() {
	const t = Math.floor(Date.now() / 1000);
	const r = Math.floor(Math.random() * 100000 + 100000);
	const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
	const q = "is_high=false";
	const h = crypto
		.createHash("md5")
		.update(`salt=${salt}&t=${t}&r=${r}&b=&q=${q}`)
		.digest("hex");
	const dt = `${t},${r},${h}`;
	return dt;
}

// Creates geetest, return mmt data
export async function createMmt(cookie) {
	const headers = {
		DS: createDs(),
		cookie: cookie,
		"x-rpc-challenge_path":
			"https://bbs-api-os.hoyolab.com/game_record/app/hkrpg/api/challenge",
		"x-rpc-app_version": "2.55.0",
		"x-rpc-challenge_game": "6",
		"x-rpc-client_type": "5"
	};
	const url =
		"https://sg-public-api.hoyolab.com/event/toolcomsrv/risk/createGeetest?is_high=true&app_key=hkrpg_game_record";

	// Get mmt data
	const response = await fetch(url, {
		method: "GET",
		headers: headers
	});
	const mmt = await response.json();

	// Throw error when fail to get mmt
	if (mmt.retcode != 0) {
		throw new Error({
			message: `Error：Failed to create mmt: ${data.message}, retcode: ${data.retcode}`
		});
	}

	return mmt.data;
}

// Verify geetest result
export async function verifyMmt(result, cookie) {
	const headers = {
		DS: createDs(),
		"x-rpc-challenge_path":
			"https://bbs-api-os.hoyolab.com/game_record/app/hkrpg/api/challenge",
		"x-rpc-app_version": "2.55.0",
		"x-rpc-challenge_game": "6",
		"x-rpc-client_type": "5",
		cookie: cookie
	};
	const url =
		"https://sg-public-api.hoyolab.com/event/toolcomsrv/risk/verifyGeetest";

	result.app_key = "hkrpg_game_record";

	// Verify geetest output
	const verifyResponse = await fetch(url, {
		method: "POST",
		headers: headers,
		body: JSON.stringify(result)
	});

	const verifyResult = await verifyResponse.json();

	// Raise error if verification failed
	if (verifyResult.retcode != 0) {
		const retcode = verifyResult.retcode;
		throw new Error({ message: `retcode ${retcode}` });
	}
}
