import { Message, EmbedBuilder } from "discord.js";
import autoDailySign from "@/utilities/hsr/autoDaily.js";

export default {
	name: "autodaily",
	execute: async (message: Message, args: string[]) => {
		const input = args[0]?.toLowerCase();

		if (!input) {
			return message.reply({
				content: "請輸入欲觸發的時段，例如 `autodaily 16` 或 `autodaily all`。"
			});
		}

		let label = "";
		let targetText = "";
		let manualHours: number[] = [];
		let triggerAll = false;

		if (input === "all") {
			triggerAll = true;
			label = "手動整日";
			targetText = "今天整天";
		} else {
			const parsedHour = parseInt(input, 10);

			if (Number.isNaN(parsedHour) || parsedHour < 0 || parsedHour > 23) {
				return message.reply({
					content: "請輸入 0-23 之間的整點數值，或使用 `all`。"
				});
			}

			const hourLabel = `${parsedHour.toString().padStart(2, "0")}:00`;
			manualHours = [parsedHour];
			label = `手動 ${hourLabel}`;
			targetText = `今天 ${hourLabel}`;
		}

		await message.reply({ content: `⏳ 開始執行自動簽到（${targetText}），請稍候...` });

		try {
			const stats = await autoDailySign({
				manualHours,
				all: triggerAll,
				label,
				initiatedBy: message.author.id
			});

			const lines = [
				`目標時段：${targetText}`,
				`總共執行：\`${stats.total}\``,
				`成功：\`${stats.success}\``,
				`已簽到：\`${stats.signed}\``,
				`跳過：\`${stats.skipped}\``,
				`失敗：\`${stats.failed}\``
			];

			if (stats.total === 0) {
				lines.push("沒有符合條件的帳號需要觸發。");
			}

			return message.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(triggerAll ? 0x6bbf59 : 0x4c9aff)
						.setTitle("自動簽到手動觸發完成")
						.setDescription(lines.join("\n"))
						.setTimestamp()
				]
			});
		} catch (error) {
			return message.reply({
				content: `觸發自動簽到時發生錯誤：${(error as Error).message}`
			});
		}
	}
};
