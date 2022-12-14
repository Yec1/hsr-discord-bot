import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ComponentType,
	ActionRowBuilder,
	ButtonBuilder
} from "discord.js";
import pretty_ms from "pretty-ms";
import os from "os";

export default {
	data: new SlashCommandBuilder()
		.setName("info")
		.setDescription("Information of bot")
		.setNameLocalizations({
			"zh-TW": "資訊",
			ja: "undefined"
		})
		.setDescriptionLocalizations({
			"zh-TW": "機器人的資訊",
			ja: "undefined"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
		var page2;
		function refresh(i) {
			var usedMemory = os.totalmem() - os.freemem(),
				totalMemory = os.totalmem();
			var getpercentage =
				((usedMemory / totalMemory) * 100).toFixed(2) + "%";
			page2 = new EmbedBuilder()
				.setConfig()
				.setImage(
					"https://media.discordapp.net/attachments/1050727525644513322/1052600155314077756/ice_banner.png?width=1253&height=671"
				)
				.setDescription(
					`\`\`\`${tr("botDesc")}\`\`\`` //你好！我是 iCE，一個提供多種功能的Discord機器人，按下下方按鈕以查看更多關於我的資訊
				)
				.addField(
					tr("botUptime"), //上線時間
					`${client.emoji.line2} ${pretty_ms(client.uptime, {
						colonNotation: true
					})}`,
					true
				)
				.addField(
					tr("latency"), //延遲
					`${client.emoji.line2} ${Math.abs(
						Date.now() - i.createdTimestamp
					)}ms`,
					true
				)
				.addField(
					tr("botServers"), //伺服器數量
					`${client.emoji.line2} ${client.guilds.cache.size} `,
					true
				)
				.addField(
					tr("botMemoryUsage"), //記憶體使用率
					`${client.emoji.line2} ${getpercentage}`,
					true
				);
		}
		var curPage = 1;

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("info_s_switch")
				.setLabel(tr("infoSwitch")) //切換
				.setStyle(2)
		);

		const row2 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("info_s_switch")
				.setLabel(tr("infoSwitch")) //切換
				.setStyle(2),
			new ButtonBuilder()
				.setCustomId("info_s_refresh")
				.setLabel(tr("infoRefresh")) //刷新
				.setEmoji("🔄")
				.setStyle(1)
		);

		const page1 = new EmbedBuilder()
			.setConfig()
			.setImage(
				"https://media.discordapp.net/attachments/1050727525644513322/1052600155314077756/ice_banner.png?width=1253&height=671"
			)
			.setDescription(
				`\`\`\`${tr("botDesc")}\`\`\`` //你好！我是 iCE，一個提供多種功能的Discord機器人，按下下方按鈕以查看更多關於我的資訊
			)
			.addField(
				tr("botDevs"), //機器人開發者
				`
                > [Yeci](https://github.com/yeci226)
                > [Mantou](https://github.com/Mantou1233)
                > [Cookie](https://github.com/Cooookie16)
                `,
				true
			);

		refresh(interaction);
		const resp = await interaction.reply({
			embeds: [page1],
			components: [row]
		});
		const filter = i => true;

		const collector = resp.createMessageComponentCollector({
			filter,
			componentType: ComponentType.Button
		});

		collector.on("collect", interaction => {
			if (!interaction.isButton()) return;
			if (interaction.customId === "info_s_switch") {
				refresh(interaction);
				let pages = [page1, page2];
				if (++curPage > pages.length) curPage = 1;
				if (curPage === 2)
					return interaction.message.edit({
						embeds: [pages[curPage - 1]],
						components: [row2]
					});
				else
					return interaction.message.edit({
						embeds: [pages[curPage - 1]],
						components: [row]
					});
			}
			if (interaction.customId === "info_s_refresh") {
				refresh(interaction);
				return interaction.message.edit({
					embeds: [page2],
					components: [row2]
				});
			}
		});
	}
};
