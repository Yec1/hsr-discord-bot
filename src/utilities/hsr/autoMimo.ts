import { client, database, cluster } from "@/index.js";
import { sendRestMessage } from "@/utilities/core/sendRestMessage.js";
import { Client, EmbedBuilder } from "discord.js";
import Logger from "@/utilities/core/logger.js";
import { createTranslator } from "@/utilities/core/i18n.js";
import {
	getUserLang,
	getRandomColor,
	autoRefreshCookie,
	getUserCookie
} from "@/utilities/index.js";

const CONFIG = {
	BASE_URL: "https://sg-public-api.hoyolab.com/event/e2023mimotravel",
	GAME_ID: 6, // HSR
	TAIPEI_TIMEZONE: "Asia/Taipei",
	DEFAULT_LANGUAGE: "zh-tw"
};

interface MimoTask {
	id: number;
	name: string;
	status: number; // 0: uncompleted, 1: completed, 2: claimed
	is_finish: boolean;
	task_type: number;
}

class AutoMimoSystem {
	private logger: Logger;
	private db: any;

	constructor() {
		this.logger = new Logger("Mimo 旅途");
		this.db = database;
	}

	async getVersionId(lang: string): Promise<string | null> {
		try {
			const res = await fetch(`${CONFIG.BASE_URL}/index?lang=${lang}`, {
				method: "GET"
			});
			const data = (await res.json()) as any;
			if (data.retcode !== 0) return null;

			const game = data.data.list?.find(
				(g: any) => g.game_id === CONFIG.GAME_ID
			);
			return game?.version_id || null;
		} catch (error) {
			this.logger.error(`獲取 version_id 失敗: ${(error as any).message}`);
			return null;
		}
	}

	async getTaskList(
		cookie: string,
		versionId: string,
		lang: string
	): Promise<MimoTask[]> {
		try {
			const params = new URLSearchParams({
				game_id: String(CONFIG.GAME_ID),
				lang,
				version_id: versionId
			});
			const res = await fetch(`${CONFIG.BASE_URL}/task-list?${params}`, {
				method: "GET",
				headers: { Cookie: cookie }
			});
			const data = (await res.json()) as any;
			return data.data?.list || [];
		} catch (error) {
			this.logger.error(`獲取任務列表失敗: ${(error as any).message}`);
			return [];
		}
	}

	async finishTask(
		cookie: string,
		versionId: string,
		lang: string,
		taskId: number
	): Promise<boolean> {
		try {
			const res = await fetch(`${CONFIG.BASE_URL}/finish-task`, {
				method: "POST",
				headers: {
					Cookie: cookie,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					game_id: CONFIG.GAME_ID,
					lang,
					version_id: versionId,
					task_id: taskId
				})
			});
			const data = (await res.json()) as any;
			return data.retcode === 0;
		} catch (error) {
			return false;
		}
	}

	async claimPoint(
		cookie: string,
		versionId: string,
		lang: string,
		taskId: number
	): Promise<boolean> {
		try {
			const params = new URLSearchParams({
				game_id: String(CONFIG.GAME_ID),
				lang,
				version_id: versionId,
				task_id: String(taskId)
			});
			const res = await fetch(`${CONFIG.BASE_URL}/receive-point?${params}`, {
				method: "GET",
				headers: { Cookie: cookie }
			});
			const data = (await res.json()) as any;
			return data.retcode === 0;
		} catch (error) {
			return false;
		}
	}

	async processUser(userId: string, data: any) {
		const lang = (await getUserLang(userId)) || CONFIG.DEFAULT_LANGUAGE;
		const tr = createTranslator(lang);
		const accounts = await this.db.get(`${userId}.account`);
		if (!accounts?.length) return;

		const versionId = await this.getVersionId(lang);
		if (!versionId) return;

		let totalClaimed = 0;

		for (let i = 0; i < accounts.length; i++) {
			const account = accounts[i];
			if (!account?.cookie) continue;

			let cookie = account.cookie;
			let tasks = await this.getTaskList(cookie, versionId, lang);

			// 如果未登入，嘗試刷新一次
			if (!tasks.length) {
				const refresh = await autoRefreshCookie(userId, i, cookie);
				if (refresh.success) {
					cookie =
						refresh.newCookie ||
						(await getUserCookie(userId, i)) ||
						cookie;
					tasks = await this.getTaskList(cookie, versionId, lang);
				}
			}

			if (!tasks.length) continue;

			for (const task of tasks) {
				if (task.status === 0) {
					// 嘗試完成 (目前只做簡單的點擊類，例如 status 為 0 的通常需要點擊)
					// 大部分的 mimo 任務點一下 finish-task 就能完成
					await this.finishTask(cookie, versionId, lang, task.id);
					// 完成後再拿一次列表確認狀態 (或者直接嘗試領取)
					if (await this.claimPoint(cookie, versionId, lang, task.id)) {
						totalClaimed++;
					}
				} else if (task.status === 1) {
					// 已完成未領取
					if (await this.claimPoint(cookie, versionId, lang, task.id)) {
						totalClaimed++;
					}
				}
			}
		}

		if (totalClaimed > 0 && data.channelId) {
			const tag = data.tag === "true" ? `<@${userId}>` : "";
			const embed = new EmbedBuilder()
				.setColor(getRandomColor() as any)
				.setTitle(tr("mimo_Title"))
				.setDescription(
					tr("mimo_Success", { count: totalClaimed })
				)
				.setThumbnail(
					"https://img-os-static.hoyolab.com/communityWeb/upload/79893d56b06e901a1829e0066b6c0388.png"
				)
				.setTimestamp();

			try {
				await sendRestMessage(data.channelId, {
					...(tag && { content: tag }),
					embeds: [embed.toJSON()]
				});
			} catch (e) {
				// ignore
			}
		}
	}
}

export default async function autoMimo() {
	const system = new AutoMimoSystem();
	const mimoData = await database.get("autoMimo");
	if (!mimoData) return;

	for (const userId of Object.keys(mimoData)) {
		try {
			await system.processUser(userId, mimoData[userId]);
		} catch (e) {
			// ignore
		}
	}
}
