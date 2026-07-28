export const AUTO_REDEEM_CRON = "20 * * * *";

interface RedeemCodeLike {
	code: string;
}

export function hasUnredeemedCodes(
	redeemedCodes: readonly string[],
	availableCodes: readonly RedeemCodeLike[]
): boolean {
	const redeemedCodeSet = new Set(redeemedCodes);
	return availableCodes.some(code => !redeemedCodeSet.has(code.code));
}
