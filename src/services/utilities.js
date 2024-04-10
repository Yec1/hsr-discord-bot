

function validateCookie(cookie) {
	const re = /[^; \"]{30,}/;
	const reNum = /[0-9]{5,}/;
	const reTokenV2 = /[^; \"]{10,}/;
	const reLtmidV2 = /[^; \"]{5,}/;

	let match;
	let cookie_token = (match = cookie.match(`cookie_token=${re.source}`))
		? match[0]
		: null;
	let account_id = (match = cookie.match(`account_id=${reNum.source}`))
		? match[0]
		: null;
	let ltoken = (match = cookie.match(`ltoken=${re.source}`))
		? match[0]
		: (match = cookie.match(`ltoken_v2=${reLtmidV2.source}`))
		? match[0]
		: null;
	let ltuid = (match = cookie.match(`ltuid=${reNum.source}`))
		? match[0]
		: (match = cookie.match(`ltuid_v2=${reNum.source}`))
		? match[0]
		: null;

	let mi18nLang = (match = cookie.match(`mi18nLang=${re.source}`))
		? match[0]
		: null;

	let cookie_token_v2 = (match = cookie.match(
		`cookie_token_v2=${reTokenV2.source}`
	))
		? match[0]
		: null;
	let account_id_v2 = (match = cookie.match(`account_id_v2=${reNum.source}`))
		? match[0]
		: null;
	let ltoken_v2 = (match = cookie.match(`ltoken_v2=${reTokenV2.source}`))
		? match[0]
		: null;
	let ltuid_v2 = (match = cookie.match(`ltuid_v2=${reNum.source}`))
		? match[0]
		: null;
	let ltmid_v2 = (match = cookie.match(`ltmid_v2=${reLtmidV2.source}`))
		? match[0]
		: null;
	let account_mid_v2 = (match = cookie.match(
		`account_mid_v2=${reLtmidV2.source}`
	))
		? match[0]
		: null;

	let cookie_list = [];

	if (cookie_token && account_id) cookie_list.push(cookie_token, account_id);
	const tokens = [
		ltoken,
		ltuid,
		cookie_token_v2,
		account_id_v2,
		ltoken_v2,
		ltuid_v2,
		ltmid_v2,
		account_mid_v2,
		mi18nLang
	];
	for (let token of tokens) if (token !== null) cookie_list.push(token);
	return cookie_list.length === 0 ? null : cookie_list.join(" ");
}

export { validateCookie };
