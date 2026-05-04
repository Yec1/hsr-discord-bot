// Session status for multi-step verification (geetest → email verify)
export const sessionStatuses = new Map<
	string,
	{ status: string; [key: string]: any }
>();
