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
		"x-rpc-game_biz": "bbs_oversea",
		"x-rpc-language": "zh-tw",
		"x-rpc-source": "v2.webLogin",
		"x-rpc-device_model": "Chrome 144.0.0.0",
		"x-rpc-device_name": "Chrome",
		"x-rpc-device_os": "Windows 10 64-bit",
		Origin: "https://account.hoyolab.com",
		Referer: "https://account.hoyolab.com/"
	};

	if (captchaResult) {
		headers["x-rpc-aigis"] = Buffer.from(
			JSON.stringify({
				data: JSON.stringify(captchaResult)
			})
		).toString("base64");
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

		// Check for Geetest - retcode -3101 means captcha required
		if (responseData.retcode === -3101) {
			const aigisHeader = response.headers.get("x-rpc-aigis");
			console.log("[Login] Aigis header:", aigisHeader);

			if (aigisHeader) {
				const aigisData = JSON.parse(aigisHeader);
				console.log(
					"[Login] Aigis data:",
					JSON.stringify(aigisData, null, 2)
				);

				// aigisData.data is a JSON string, need to parse it again
				const captchaData =
					typeof aigisData.data === "string"
						? JSON.parse(aigisData.data)
						: aigisData.data;

				console.log(
					"[Login] Captcha data:",
					JSON.stringify(captchaData, null, 2)
				);

				return {
					captcha: true,
					data: {
						captcha: {
							geetestId: captchaData.gt,
							challenge: captchaData.challenge,
							riskType: aigisData.mmt_type
						}
					}
				};
			}
		}

		if (responseData.retcode !== 0) {
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
