/**
 * Routing tests for drainPendingLogins.
 *
 * Note on mocking: the spec called for `jest.unstable_mockModule` + top-level
 * `await import(...)` (the ESM mocking pattern). Tests in this repo compile
 * under `tsconfig.test.json` with `module: commonjs`, which forbids top-level
 * await and treats `unstable_mockModule` as a no-op for synchronous imports.
 * We use the equivalent CJS pattern (`jest.mock` factories) — same semantics,
 * mocks are hoisted above the imports of the module under test.
 */
import type { jest as JestType } from "@jest/globals";

const mockFetchPendingLogins = jest.fn() as jest.Mock<any>;
const mockMarkConsumed = jest.fn() as jest.Mock<any>;
const mockDecryptString = jest.fn((s: string) => `decrypted(${s})`) as jest.Mock<any>;
const mockGetUserGameInfo = jest.fn() as jest.Mock<any>;
const mockUpdateAccountInfo = jest.fn() as jest.Mock<any>;
const mockUpsertHoyolab = jest.fn() as jest.Mock<any>;
const mockUpsertCharacter = jest.fn() as jest.Mock<any>;
const mockUserSend = jest.fn() as jest.Mock<any>;
const mockUsersFetch = jest.fn(async () => ({ send: mockUserSend })) as jest.Mock<any>;
const mockDbGet = jest.fn(async () => []) as jest.Mock<any>;

jest.mock("@/utilities/core/supabase.js", () => ({
	fetchPendingLogins: (...a: any[]) => mockFetchPendingLogins(...a),
	markConsumed: (...a: any[]) => mockMarkConsumed(...a),
	decryptString: (...a: any[]) => mockDecryptString(...a)
}));
jest.mock("@/utilities/index.js", () => ({
	getUserGameInfo: (...a: any[]) => mockGetUserGameInfo(...a),
	updateAccountInfo: (...a: any[]) => mockUpdateAccountInfo(...a)
}));
jest.mock("@/utilities/accountStore.js", () => ({
	upsertHoyolab: (...a: any[]) => mockUpsertHoyolab(...a),
	upsertCharacter: (...a: any[]) => mockUpsertCharacter(...a)
}));
jest.mock("@/utilities/core/config.js", () => ({
	getConfig: () => ({ DEVIDS: [] })
}));
jest.mock("@/utilities/core/logger.js", () => ({
	__esModule: true,
	default: class {
		info() {}
		warn() {}
		error() {}
	}
}));
jest.mock("@/index.js", () => ({
	database: {
		get: (...a: any[]) => mockDbGet(...a)
	},
	client: {
		users: { fetch: (...a: any[]) => mockUsersFetch(...a) }
	}
}));

import { drainPendingLogins } from "@/utilities/webhookLogin";

beforeEach(() => {
	jest.clearAllMocks();
	mockDbGet.mockImplementation(async () => []);
	mockDecryptString.mockImplementation((s: string) => `decrypted(${s})`);
	mockUsersFetch.mockImplementation(async () => ({ send: mockUserSend }));
});

function row(opts: { id: number; enriched?: any }) {
	return {
		id: opts.id,
		discord_id: "u1",
		ltuid_v2: "L1",
		encrypted_cookies: "enc",
		hoyo_account: null,
		enriched: opts.enriched ?? null,
		created_at: "2026-04-27T00:00:00.000Z"
	};
}

const HSR_GAME_ID = 6;

describe("drainPendingLogins routing", () => {
	it("uses bindFromEnriched (no getUserGameInfo) when enriched has matching HSR card", async () => {
		mockFetchPendingLogins.mockResolvedValueOnce([
			row({
				id: 1,
				enriched: {
					ltuid_v2: "L1",
					cards: [
						{
							game_id: HSR_GAME_ID,
							game_role_id: "800111111",
							nickname: "Sloop",
							level: 70,
							region: "prod_official_usa",
							region_name: "America",
							game_name: "Honkai: Star Rail",
							logo: "logo.png",
							background_image_v2: "cov2.png",
							data: [
								{ name: "Active days", value: "120" },
								{ name: "Avatars", value: "45" },
								{ name: "Light Cones", value: "80" },
								{ name: "Achievements", value: "320" },
								{ name: "Extra", value: "ignored" }
							]
						}
					],
					fetched_at: "2026-04-27T00:00:00.000Z"
				}
			})
		]);

		const out = await drainPendingLogins("u1");

		expect(mockGetUserGameInfo).not.toHaveBeenCalled();
		expect(mockUpsertHoyolab).toHaveBeenCalledTimes(1);
		expect(mockUpsertCharacter).toHaveBeenCalledTimes(1);
		const charArg = (mockUpsertCharacter.mock.calls[0] as any[])[3];
		expect(charArg.uid).toBe("800111111");
		expect(charArg.level).toBe(70);
		expect(charArg.region_name).toBe("America");
		expect(charArg.cover).toBe("cov2.png");
		expect(charArg.stats).toHaveLength(4); // capped at 4
		expect(out).toHaveLength(1);
		expect(out[0]!.uid).toBe("800111111");
		expect(mockMarkConsumed).toHaveBeenCalledWith(1);
	});

	it("uses bindHoyolabOnly when enriched present but no HSR card", async () => {
		mockFetchPendingLogins.mockResolvedValueOnce([
			row({
				id: 2,
				enriched: {
					ltuid_v2: "L1",
					cards: [
						{
							game_id: 8, // ZZZ, not HSR
							game_role_id: "1500111111",
							nickname: "Z",
							level: 50,
							region: "prod_gf_jp",
							region_name: "Asia",
							data: []
						}
					],
					fetched_at: "2026-04-27T00:00:00.000Z"
				}
			})
		]);

		const out = await drainPendingLogins("u1");

		expect(mockGetUserGameInfo).not.toHaveBeenCalled();
		expect(mockUpsertHoyolab).toHaveBeenCalledTimes(1);
		expect(mockUpsertCharacter).not.toHaveBeenCalled();
		expect(out).toHaveLength(0); // hoyolabOnly results filtered from BindResult[]
		expect(mockMarkConsumed).toHaveBeenCalledWith(2);
	});

	it("falls back to bindCookieToUser path when enriched is null", async () => {
		mockFetchPendingLogins.mockResolvedValueOnce([row({ id: 3, enriched: null })]);
		mockGetUserGameInfo.mockResolvedValueOnce({
			uid: "800999999",
			nickname: "Legacy"
		});

		const out = await drainPendingLogins("u1");

		expect(mockGetUserGameInfo).toHaveBeenCalledTimes(1);
		expect(mockUpdateAccountInfo).toHaveBeenCalledTimes(1);
		expect(out).toHaveLength(1);
		expect(out[0]!.uid).toBe("800999999");
		expect(mockMarkConsumed).toHaveBeenCalledWith(3);
	});
});

// Suppress unused-type-import warning; kept for potential future strictness.
type _Unused = typeof JestType;
