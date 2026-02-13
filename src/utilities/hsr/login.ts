import NodeRSA from "node-rsa";

function encrypt(source: string): string {
	const publicKeyPem = `
    -----BEGIN PUBLIC KEY-----
    MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4PMS2JVMwBsOIrYWRluY
    wEiFZL7Aphtm9z5Eu/anzJ09nB00uhW+ScrDWFECPwpQto/GlOJYCUwVM/raQpAj
    /xvcjK5tNVzzK94mhk+j9RiQ+aWHaTXmOgurhxSp3YbwlRDvOgcq5yPiTz0+kSeK
    ZJcGeJ95bvJ+hJ/UMP0Zx2qB5PElZmiKvfiNqVUk8A8oxLJdBB5eCpqWV6CUqDKQ
    KSQP4sM0mZvQ1Sr4UcACVcYgYnCbTZMWhJTWkrNXqI8TMomekgny3y+d6NX/cFa6
    6jozFIF4HCX5aW8bp8C8vq2tFvFbleQ/Q3CU56EWWKMrOcpmFtRmC18s9biZBVR/
    8QIDAQAB
    -----END PUBLIC KEY-----
    `;

	const key = new NodeRSA(publicKeyPem);
	key.setOptions({ encryptionScheme: "pkcs1" });

	return key.encrypt(source, "base64");
}

interface LoginResult {
	cookie: string | null;
	error: Error | null;
}

async function loginAccount(
	account: string,
	password: string,
	captchaResult?: any
): Promise<any> {
	const URL =
		"https://passport-api-sg.hoyolab.com/account/ma-passport/api/webLoginByPassword";

	const payload = {
		account: encrypt(account),
		password: encrypt(password),
		token_type: 6
	};

	const headers: Record<string, string> = {
		accept: "application/json, text/plain, */*",
		"content-type": "application/json",
		"x-rpc-app_id": "c9oqaq3s3gu8",
		"x-rpc-client_type": "4",
		"x-rpc-sdk_version": "2.49.0",
		"x-rpc-aigis_v4": "true",
		"x-rpc-game_biz": "bbs_oversea",
		"x-rpc-language": "zh-tw",
		"x-rpc-source": "v2.webLogin",
		"x-rpc-device_id": "59898f79-b602-48c7-9af4-38e7d6f8a659",
		"x-rpc-device_fp": "38d7f38a087c3",
		"x-rpc-device_model": "Chrome 144.0.0.0",
		"x-rpc-device_name": "Chrome",
		"x-rpc-device_os": "Windows 10 64-bit",
		Origin: "https://account.hoyolab.com",
		Referer: "https://account.hoyolab.com/"
	};

	if (captchaResult) {
		console.log(
			"[Login] Constructing Aigis header with:",
			JSON.stringify(captchaResult, null, 2)
		);
		const { session_id } = captchaResult;

		const isV4 = !!captchaResult.lot_number;
		// v10: Respect riskType from server (likely 1 for hybrid), fallback to 2 for v4
		const mmtType = Number(captchaResult.riskType) || (isV4 ? 2 : 1);

		const aigisPayload = {
			session_id: session_id,
			mmt_type: mmtType,
			data: JSON.stringify(
				isV4
					? {
							gt:
								captchaResult.captcha_id ||
								captchaResult.geetestId,
							captcha_id:
								captchaResult.captcha_id ||
								captchaResult.geetestId,
							lot_number: captchaResult.lot_number,
							pass_token: captchaResult.pass_token,
							gen_time: captchaResult.gen_time,
							captcha_output: captchaResult.captcha_output,
							use_v4: true,
							risk_type: captchaResult.risk_type,
							success: 1,
							new_captcha: 1
						}
					: {
							geetest_challenge: captchaResult.geetest_challenge,
							geetest_validate: captchaResult.geetest_validate,
							geetest_seccode: captchaResult.geetest_seccode,
							success: 1,
							new_captcha: 1
						}
			)
		};

		// Revert to Base64 encoding for v10 (Passport API expectation)
		headers["x-rpc-aigis"] = Buffer.from(
			JSON.stringify(aigisPayload)
		).toString("base64");

		console.log(
			"[Login-V4-v10] Final Aigis Header (Base64 + Server mmtType):",
			JSON.stringify(aigisPayload, null, 2)
		);
	}

	try {
		const response = await fetch(URL, {
			method: "POST",
			headers: headers,
			body: JSON.stringify(payload)
		});

		const responseData: any = await response.json();

		console.log(
			"[Login] Response data:",
			JSON.stringify(responseData, null, 2)
		);

		// Check for Geetest - retcode -3101 or 1034 means captcha required
		if (responseData.retcode === -3101 || responseData.retcode === 1034) {
			const aigisHeader = response.headers.get("x-rpc-aigis");
			console.log(
				"[Login] Captcha required. Retcode:",
				responseData.retcode
			);
			console.log(
				"[Login] Response Data:",
				JSON.stringify(responseData, null, 2)
			);
			console.log("[Login] Aigis Header:", aigisHeader);

			if (aigisHeader) {
				const aigisData = JSON.parse(aigisHeader);
				// aigisData.data is a JSON string, need to parse it again
				const captchaData =
					typeof aigisData.data === "string"
						? JSON.parse(aigisData.data)
						: aigisData.data;

				console.log(
					"[Login] Full Aigis Data:",
					JSON.stringify(aigisData, null, 2)
				);
				console.log(
					"[Login] Parsed Captcha Data:",
					JSON.stringify(captchaData, null, 2)
				);

				return {
					captcha: true,
					data: {
						captcha: {
							geetestId: captchaData.gt,
							challenge: captchaData.challenge,
							riskType: aigisData.mmt_type,
							risk_type: captchaData.risk_type,
							success: captchaData.success,
							new_captcha: captchaData.new_captcha,
							aigisSessionId: aigisData.session_id
						}
					}
				};
			}
		}

		if (responseData.retcode !== 0) {
			console.error("[Login] Hoyoverse Login Failed:", responseData);
			throw new Error(
				`登入失敗: ${responseData.message || responseData.retcode}`
			);
		}

		const result = response.headers;
		const cookie = parseCookie(result.get("set-cookie") || "");

		return {
			cookie,
			uid: responseData.data.account_info.weblogin_token, // Dummy as we usually detect UID later
			nickname: responseData.data.account_info.email
		};
	} catch (error) {
		throw error;
	}
}

function parseCookie(cookie: string): string {
	const cookieArray = cookie.split(";");
	const parsedCookie: Record<string, string> = {};

	for (const cookie of cookieArray) {
		const [key, value] = cookie.split("=");
		const cleanKey = key?.trim().replace("Secure, ", "") || "";
		if (value !== undefined) {
			parsedCookie[cleanKey] = value;
		}
	}

	let res = "";
	if (parsedCookie.ltoken_v2) res += `ltoken_v2=${parsedCookie.ltoken_v2}; `;
	if (parsedCookie.ltuid_v2) res += `ltuid_v2=${parsedCookie.ltuid_v2}; `;
	if (parsedCookie.cookie_token_v2)
		res += `cookie_token_v2=${parsedCookie.cookie_token_v2}; `;
	if (parsedCookie.account_mid_v2)
		res += `account_mid_v2=${parsedCookie.account_mid_v2}; `;

	return res;
}

export default loginAccount;
