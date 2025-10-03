import { Message, EmbedBuilder } from "discord.js";
import { database } from "@/index.js";
import { HonkaiStarRail } from "@yeci226/hoyoapi";
import { getUserGameInfo } from "@/utilities/index.js";

interface Account {
	uid: string;
	cookie: string;
	nickname?: string;
}

export default {
	name: "bind",
	execute: async (message: Message, args: string[]) => {
		const uid = (args?.[0] || "").trim();
		const cookie = args.slice(1).join(" ").trim();

		if (!uid || !/^[0-9]{9,10}$/.test(uid)) {
			return message.reply({
				content: "❌ 請提供正確的 UID（9-10 位數字）。"
			});
		}

		if (
			!cookie ||
			!cookie.includes("ltuid_v2=") ||
			!cookie.includes("ltoken_v2=")
		) {
			return message.reply({
				content:
					"❌ 請提供完整的 Cookie（至少包含 ltoken_v2 與 ltuid_v2）。"
			});
		}

		try {
			// 驗證 Cookie 可用
			const hsr = new HonkaiStarRail({ cookie });
			await hsr.daily.info();

			// 取得暱稱等資訊（以顯示用途）
			let nickname = "";
			try {
				const info = await getUserGameInfo(cookie);
				nickname = info?.nickname || "";
			} catch {}

			const userId = message.author.id;
			const accountKey = `${userId}.account`;
			const existedAccounts: Account[] =
				(await database.get(accountKey)) || [];

			// 若已存在同 UID，則更新 Cookie 與暱稱
			const existingIndex = existedAccounts.findIndex(
				acc => acc.uid === uid
			);
			if (existingIndex !== -1 && existedAccounts[existingIndex]) {
				existedAccounts[existingIndex].cookie = cookie;
				if (nickname)
					existedAccounts[existingIndex].nickname = nickname;
				await database.set(accountKey, existedAccounts);
			} else {
				await database.push(accountKey, { uid, cookie, nickname });
			}

			// 清除過期標記
			await database.delete(`${uid}.cookieExpired`);

			return message.reply({
				embeds: [
					new EmbedBuilder()
						.setColor("#F6F1F1")
						.setTitle("✅ 綁定成功")
						.setDescription(
							`UID: \`${uid}\`${nickname ? `\n暱稱: **${nickname}**` : ""}`
						)
				]
			});
		} catch (error: any) {
			console.error("bind command error:", error);
			return message.reply({
				embeds: [
					new EmbedBuilder()
						.setColor("#E76161")
						.setTitle("❌ 綁定失敗")
						.setDescription(
							`請確認 Cookie 是否有效，或稍後再試。\n\n\`${error?.message || String(error)}\``
						)
				]
			});
		}
	}
};
