import { client } from "../../index.js";
import { EmbedBuilder, WebhookClient } from "discord.js";
import { Logger } from "../core/logger.js";
import {
	getUserCookie,
	getUserLang,
	getUserUid,
	getRandomColor,
	getRedeemCodes
} from "../utilities.js";
import { i18nMixin } from "../core/i18n.js";
import { HonkaiStarRail, LanguageEnum } from "hoyoapi";

const db = client.db;
let success, failed, total;

export default async function autoRedeem() {
	const redeemData = await db.get("autoRedeem");
	const autoRedeem = Object.keys(redeemData);

	// Initialize the variables
	const nowTime = new Date().toLocaleString("en-US", {
		timeZone: "Asia/Taipei",
		hour: "numeric",
		hour12: false
	});
	total = 0;
	failed = 0;
	success = 0;

	// Loop through the autoRedeem array
	new Logger("自動執行").info(`已開始 ${nowTime} 點自動兌換`);
	const codesList = await getRedeemCodes();

	for (const id of autoRedeem) {
		const accounts = await db.get(`${id}.account`);
		for (const account of accounts) {
			let accountIndex = 0;
			if (getUserCookie(id, accountIndex) && getUserUid(id, accountIndex))
				await redeemCode(
					redeemData,
					codesList,
					id,
					account.uid,
					account.cookie
				);
			accountIndex++;
		}
	}

	// End
	UpdateStatistics(total, nowTime);
}

async function redeemCode(dailyData, codesList, userId, uid, cookie) {
	total++;
	const userRedeemedCodes = (await db.get(`${userId}.redeemedCodes`)) || [];

	if (!userRedeemedCodes.includes(codesList.code)) {
		const unRedeemedCodes = codesList.filter(
			code => !userRedeemedCodes.includes(code.code)
		);

		const locale = await getUserLang(userId);
		const tr = i18nMixin(locale || "en");
		const channelId = dailyData[userId].channelId;
		const tag = dailyData[userId].tag === "true" ? "<@" + userId + ">" : "";
		const embed = new EmbedBuilder().setColor(getRandomColor());
		const redeemedCode = [];
		let redeemSuccess = false;
		let description = `<@${userId}>`;
		let channel;

		try {
			channel = await client.channels.fetch(channelId);
		} catch (e) {}

		try {
			const hsr = new HonkaiStarRail({
				uid,
				cookie,
				lang:
					locale === "tw"
						? LanguageEnum.TRADIIONAL_CHINESE
						: LanguageEnum.ENGLISH
			});

			unRedeemedCodes.forEach(async code => {
				const res = await hsr.redeem.claim(code.code);
				if (res.retcode === 0) {
					userRedeemedCodes.push(code.code);
					redeemedCode.push(code);
					redeemSuccess = true;
					description += `\n### ${code.code}\n${code.rewards
						.map(
							(reward, index) =>
								`${index}. \`${tr(reward.reward)}${reward.count != null ? ` x${reward.count}` : ""}\``
						)
						.join("\n")}`;
				} else {
					description += `\n### ${code.code} \`${tr("redeem_Failed")}\`\n${res.message || ""}`;
					failed++;
				}

				await new Promise(r => setTimeout(r, 5000));
			});

			if (redeemSuccess) {
				success++;
				const firstCode = redeemedCode[0];

				sendMessage(channelId, {
					content: tag,
					embeds: [
						embed
							.setTitle(tr("Auto") + tr("redeem_Success"))
							.setThumbnail(firstCode.rewards[0].icon || "")
							.setDescription(description)
					]
				}).catch(() => {});
			}
		} catch (error) {
			console.log(error);
			console.log("兌換錯誤：" + error);
			failed++;
		}
	}
}

async function sendMessage(channelId, embed) {
	try {
		await client.cluster.broadcastEval(
			async (c, context) => {
				const channel = c.channels.cache.get(context.channelId);
				channel.send(context.embed).catch(() => {});
			},
			{
				context: { channelId: channelId, embed: embed },
				timeout: 10e3
			}
		);
	} catch (e) {}
}

function UpdateStatistics(total, nowTime) {
	new Logger("自動執行").success(
		`已結束 ${nowTime} 點自動兌換，已開啟此功能人數${total}人`
	);
}
