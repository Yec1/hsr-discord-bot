import axios from "axios";
import { clearEnkaCache, requestEnkaPlayer } from "@/utilities/hsr/playerData.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const response = {
	uid: "800000001",
	ttl: 60,
	detailInfo: { uid: 800000001, nickname: "測試玩家", level: 70, avatarDetailList: [{ avatarId: 1502 }] }
};

describe("requestEnkaPlayer", () => {
	beforeEach(() => clearEnkaCache());

	it("rejects invalid UID without an HTTP request", async () => {
		const result = await requestEnkaPlayer("123");
		expect(result.error?.code).toBe("INVALID_UID");
		expect(mockedAxios.get).not.toHaveBeenCalled();
	});

	it("uses Enka TTL cache for repeated requests", async () => {
		mockedAxios.get.mockResolvedValue({ data: response });
		const first = await requestEnkaPlayer("800000001");
		const second = await requestEnkaPlayer("800000001");
		expect(first.data?.detailInfo?.nickname).toBe("測試玩家");
		expect(second).toEqual(first);
		expect(mockedAxios.get).toHaveBeenCalledTimes(1);
	});

	it("coalesces concurrent requests for the same UID", async () => {
		let resolve!: (value: any) => void;
		mockedAxios.get.mockReturnValue(new Promise(r => { resolve = r; }));
		const a = requestEnkaPlayer("800000001");
		const b = requestEnkaPlayer("800000001");
		resolve({ data: response });
		await expect(Promise.all([a, b])).resolves.toHaveLength(2);
		expect(mockedAxios.get).toHaveBeenCalledTimes(1);
	});

	it("normalizes rate limits and private profiles", async () => {
		mockedAxios.get.mockRejectedValueOnce({ response: { status: 429 } });
		await expect(requestEnkaPlayer("800000001")).resolves.toMatchObject({ error: { code: "RATE_LIMITED" } });
		clearEnkaCache();
		mockedAxios.get.mockResolvedValueOnce({ data: { uid: "800000001", detailInfo: { nickname: "private" } } });
		await expect(requestEnkaPlayer("800000001")).resolves.toMatchObject({ error: { code: "PROFILE_PRIVATE" } });
	});
});
