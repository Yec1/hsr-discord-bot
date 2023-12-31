import { Client, Message, EmbedBuilder } from "discord.js";
import ms from "ms";

export default {
	name: "status",
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (client, message, args) => {
		const res = await client.cluster.broadcastEval(c => {
			return {
				clusterId: c.cluster.id,
				shardIds: [...c.cluster.ids.keys()],
				totalGuilds: c.guilds.cache.size,
				totalMembers: c.guilds.cache
					.map(g => g.memberCount)
					.reduce((a, b) => a + b, 0),
				ping: c.ws.ping,
				uptime: c.uptime,
				memoryUsage: Object.fromEntries(
					Object.entries(process.memoryUsage()).map(d => {
						d[1] = Math.floor((d[1] / 1024 / 1024) * 100) / 100;
						return d;
					})
				),
				allGuildsData: c.guilds.cache.map(guild => {
					return {
						id: guild.id,
						name: guild.name,
						ownerId: guild.ownerId,
						memberCount: guild.memberCount,
						channels: guild.channels.cache.map(c => {
							return { id: c.id, name: c.name };
						})
					};
				}),
				perShardData: [...c.cluster.ids.keys()].map(shardId => {
					return {
						shardId: shardId,
						ping: c.ws.shards.get(shardId)?.ping,
						uptime:
							Date.now() -
							(c.ws.shards.get(shardId)?.connectedAt || 0),
						guilds: c.guilds.cache.filter(
							x => x.shardId === shardId
						).size,
						members: c.guilds.cache
							.filter(x => x.shardId === shardId)
							.map(g => g.memberCount)
							.reduce((a, b) => a + b, 0)
					};
				})
			};
		});

		const shardDataArr = [...res.flatMap(x => x.perShardData)].sort(
			(a, b) => a.shardId - b.shardId
		);

		const embed = new EmbedBuilder().setConfig().setTitle("分片狀態");
		for (const shardData of shardDataArr) {
			embed.addField(
				`#${shardData.shardId}`,
				`延遲: ${shardData.ping} 毫秒\n上線時間: ${ms(
					shardData.uptime
				)}\n伺服器: ${shardData.guilds} 個伺服器\n使用者: ${
					shardData.members
				} 個使用者`,
				true
			);
		}

		message.reply({
			embeds: [embed]
		});
	}
};
