import {
	buildCardPoolCanvas,
	pairCardPools,
	type CardPoolData
} from "@/utilities/canvas/cardPoolCard";

describe("card pool canvas", () => {
	it("pairs role and equipment pools and renders a PNG", async () => {
		const pool = {
			id: "1",
			type: "CardPoolRole" as const,
			version: "4.4",
			time_info: { start_ts: "100", end_ts: "300", now: "200" },
			avatar_list: [
				{
					item_name: "Five",
					icon_url: "https://example.com/5.png",
					rarity: "5"
				},
				{
					item_name: "Four",
					icon_url: "https://example.com/4.png",
					rarity: "4"
				}
			],
			equip_list: []
		};
		const equipment = {
			...pool,
			id: "2",
			type: "CardPoolEquipment" as const,
			avatar_list: [],
			equip_list: pool.avatar_list.map(({ icon_url, ...item }) => ({
				...item,
				item_url: icon_url
			}))
		};

		const data: CardPoolData = {
			cur_game_version: "4.4",
			avatar_card_pool_list: [pool],
			equip_card_pool_list: [equipment]
		};

		expect(pairCardPools(data)).toHaveLength(1);
		const png = await buildCardPoolCanvas({
			...data,
			avatar_card_pool_list: [{ ...pool, avatar_list: [] }],
			equip_card_pool_list: [{ ...equipment, equip_list: [] }]
		});
		expect(png.subarray(1, 4).toString()).toBe("PNG");
	});
});
