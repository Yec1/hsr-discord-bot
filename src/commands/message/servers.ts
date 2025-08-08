import { Message, EmbedBuilder, Guild } from "discord.js";
import { cluster } from "@/index.js";

export default {
	name: "servers",
	/**
	 * 顯示機器人所在的伺服器人數前20多的伺服器
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (message: Message, args: string[]) => {
		try {
			// 獲取所有 clusters 的伺服器資料
			const allGuildsData = await cluster.broadcastEval((c: any) =>
				c.guilds.cache.map((guild: Guild) => ({
					id: guild.id,
					name: guild.name,
					memberCount: guild.memberCount,
					ownerId: guild.ownerId,
					iconURL: guild.iconURL()
				}))
			);

			// 合併所有 clusters 的伺服器資料
			const allGuilds = allGuildsData.flat();

			// 按成員數量排序，取前20名
			const topServers = allGuilds
				.sort((a, b) => b.memberCount - a.memberCount)
				.slice(0, 20);

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
					text: `總伺服器數量: ${allGuilds.length} | 總成員數量: ${allGuilds.reduce((acc, guild) => acc + guild.memberCount, 0).toLocaleString()}`
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
			if (firstServer?.iconURL) {
				embed.setThumbnail(firstServer.iconURL);
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
