import {
	AttachmentBuilder,
	ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getHsrRegion, HTTPRequest } from "@yeci226/hoyoapi";
import {
	autoRefreshCookie,
	getUserCookie,
	getUserUid
} from "@/utilities/index.js";
import {
	buildCardPoolCanvas,
	type CardPoolData
} from "@/utilities/canvas/cardPoolCard.js";

const API_URL =
	"https://sg-act-public-api.hoyolab.com/event/game_record/hkrpg/api/get_act_calender";

async function fetchCardPools(cookie: string, lang: string, uid: string) {
	return new HTTPRequest(cookie)
		.setLang(lang)
		.setDs()
		.setReferer("https://act.hoyolab.com/")
		.setQueryParams({ server: getHsrRegion(Number(uid)), role_id: uid })
		.send(API_URL, "GET", 60);
}

export default {
	data: new SlashCommandBuilder()
		.setName("cardpool")
		.setDescription("Show all current and upcoming warp pools")
		.setNameLocalizations({ "zh-TW": "卡池" })
		.setDescriptionLocalizations({
			"zh-TW": "一次顯示全部當期與預告躍遷卡池"
		}),

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();

		let [cookie, uid] = await Promise.all([
			getUserCookie(interaction.user.id, 0),
			getUserUid(interaction.user.id, 0)
		]);
		if (!cookie || !uid) {
			await interaction.editReply(
				"請先使用 `/account` 綁定 HoYoLAB 帳號。"
			);
			return;
		}

		try {
			let result = await fetchCardPools(
				cookie,
				interaction.locale.toLowerCase(),
				uid
			);
			if (
				result.response.retcode === -10001 ||
				result.response.retcode === 10001
			) {
				const refreshed = await autoRefreshCookie(
					interaction.user.id,
					0,
					cookie
				);
				if (refreshed.success) {
					cookie =
						(await getUserCookie(interaction.user.id, 0)) || cookie;
					result = await fetchCardPools(
						cookie,
						interaction.locale.toLowerCase(),
						uid
					);
				}
			}

			if (result.response.retcode !== 0 || !result.response.data) {
				throw new Error(
					result.response.message ||
						`retcode ${result.response.retcode}`
				);
			}

			const data = result.response.data as CardPoolData;
			const image = new AttachmentBuilder(
				await buildCardPoolCanvas(data),
				{
					name: "card-pools.png"
				}
			);
			await interaction.editReply({
				files: [image]
			});
		} catch (error) {
			console.error("[CardPool] Failed to fetch card pools:", error);
			await interaction.editReply(
				`無法取得卡池資料：\`${(error as Error).message}\``
			);
		}
	}
};
