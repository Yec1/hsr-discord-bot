function firstMatch(text, matchExpression) {
	const matchResult = text.match(matchExpression);
	return matchResult == null ? matchResult : matchResult[0];
}

function validateCookie(cookie) {
	const re = /[^; \"]{30,}/;
	const reNum = /[0-9]{5,}/;
	const reTokenV2 = /[^; \"]{10,}/;
	const reLtmidV2 = /[^; \"]{5,}/;

	const matchExpressions = [
		`ltoken=${re.source}`,
		`ltuid=${reNum.source}`,
		`cookie_token_v2=${reTokenV2.source}`,
		`account_id_v2=${reNum.source}`,
		`ltoken_v2=${reTokenV2.source}`,
		`ltuid_v2=${reNum.source}`,
		`ltmid_v2=${reLtmidV2.source}`,
		`account_mid_v2=${reLtmidV2.source}`,
		`mi18nLang=${re.source}`,
	]

	const text = matchExpressions
		.map(x => firstMatch(cookie, x))
		.filter(x => x != null)
		.join(" ");

	return text == "" ? null : text;

}

export { validateCookie };
