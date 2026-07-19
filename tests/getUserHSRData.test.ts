jest.mock("@/index.js", () => ({
	database: {
		get: jest.fn(async (key: string) => (key.endsWith(".locale") ? "tw" : null)),
		set: jest.fn(),
		delete: jest.fn(),
		has: jest.fn(),
		all: jest.fn()
	}
}));

jest.mock("@/utilities/accountStore.js", () => ({
	getLegacyAccounts: jest.fn(async () => [
		{ uid: "800000001", cookie: "ltuid_v2=1; ltoken_v2=old" }
	]),
	getLegacyAccountAtIndex: jest.fn(),
	storeAccountBinding: jest.fn(),
	updateStoredCookie: jest.fn()
}));

jest.mock("@/utilities/core/config.js", () => ({
	loadConfig: jest.fn(() => ({}))
}));

jest.mock("@yeci226/hoyoapi", () => ({
	HonkaiStarRail: jest.fn(),
	Hoyolab: jest.fn(),
	HoyoAPIError: class HoyoAPIError extends Error {},
	LanguageEnum: {
		CHINESE_TRADITIONAL: "zh-tw",
		CHINESE_SIMPLIFIED: "zh-cn",
		ENGLISH: "en-us",
		JAPANESE: "ja-jp",
		KOREAN: "ko-kr",
		GERMAN: "de-de",
		FRENCH: "fr-fr",
		INDONESIAN: "id-id",
		PORTUGUESE: "pt-pt",
		RUSSIAN: "ru-ru",
		SPANISH: "es-es",
		THAI: "th-th",
		VIETNAMESE: "vi-vn"
	}
}));

import { HonkaiStarRail } from "@yeci226/hoyoapi";
import {
	getUserHSRData,
	withUserHSRRequest
} from "@/utilities/index.js";

const MockHonkaiStarRail = HonkaiStarRail as unknown as jest.Mock;
const interaction = { locale: "zh-TW" } as any;
const tr = (key: string) => key;

describe("getUserHSRData", () => {
	beforeEach(() => {
		MockHonkaiStarRail.mockReset();
	});

	it("constructs a client without issuing an implicit daily request", async () => {
		const dailyInfo = jest.fn();
		const client = { uid: 800000001, daily: { info: dailyInfo } };
		MockHonkaiStarRail.mockReturnValue(client);

		await expect(
			getUserHSRData(interaction, tr, "discord-user", 0)
		).resolves.toBe(client);
		expect(MockHonkaiStarRail).toHaveBeenCalledTimes(1);
		expect(dailyInfo).not.toHaveBeenCalled();
	});

	it("refreshes on an auth error and retries only the requested operation once", async () => {
		const firstClient = { uid: 800000001 };
		const retryClient = { uid: 800000001 };
		MockHonkaiStarRail
			.mockReturnValueOnce(firstClient)
			.mockReturnValueOnce(retryClient);

		const operation = jest
			.fn()
			.mockRejectedValueOnce({ code: 10001, message: "login expired" })
			.mockResolvedValueOnce("ok");
		const refreshCookie = jest.fn(async () => ({
			success: true,
			newCookie: "ltuid_v2=1; ltoken_v2=new"
		}));

		await expect(
			withUserHSRRequest(
				{
					interaction,
					tr,
					userId: "discord-user",
					accountIndex: 0
				},
				operation,
				refreshCookie as any
			)
		).resolves.toBe("ok");

		expect(refreshCookie).toHaveBeenCalledTimes(1);
		expect(operation).toHaveBeenNthCalledWith(1, firstClient);
		expect(operation).toHaveBeenNthCalledWith(2, retryClient);
	});
});
