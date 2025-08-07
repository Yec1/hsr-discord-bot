import { Message, EmbedBuilder } from "discord.js";
import { client } from "@/index.js";

export default {
	name: "servers",
	/**
	 * 顯示機器人所在的伺服器人數前20多的伺服器
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (message: Message, args: string[]) => {
		try {
			// 獲取所有機器人所在的伺服器
			const guilds = client.guilds.cache;

			// 按成員數量排序，取前20名
			const topServers = guilds
				.sort((a, b) => b.memberCount - a.memberCount)
				.first(20);

			if (topServers.length === 0) {
				return message.reply({
					content: "❌ 無法獲取伺服器資訊！"
				});
			}

			// 創建嵌入訊息
			const embed = new EmbedBuilder()
				.setTitle("🏆 伺服器人數排行榜 (前20名)")
				.setColor("#FF6B6B")
				.setTimestamp()
				.setFooter({
					text: `總伺服器數量: ${guilds.size} | 總成員數量: ${guilds.reduce((acc, guild) => acc + guild.memberCount, 0).toLocaleString()}`
				});

			// 添加伺服器資訊
			const serverFields = topServers.map((guild, index) => {
				const rank = index + 1;
				const rankEmoji =
					rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}.`;

				return {
					name: `${rankEmoji} ${guild.name}`,
					value: `👥 **${guild.memberCount.toLocaleString()}** 成員\n🆔 ${guild.id}\n👑 ${guild.ownerId ? `<@${guild.ownerId}>` : "未知"}`,
					inline: true
				};
			});

			embed.addFields(serverFields);

			// 如果有伺服器圖標，設置為嵌入的縮圖
			const firstServer = topServers[0];
			if (firstServer?.iconURL()) {
				embed.setThumbnail(firstServer.iconURL()!);
			}

			return message.reply({
				embeds: [embed]
			});
		} catch (error) {
			console.error("獲取伺服器資訊時發生錯誤:", error);
			return message.reply({
				content: "❌ 獲取伺服器資訊時發生錯誤！"
			});
		}
	}
};
