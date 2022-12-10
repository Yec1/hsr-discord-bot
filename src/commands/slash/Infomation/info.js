import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder
} from "discord.js";
import os from "os";
import { msToHMS } from "../../../services/msToHMS.js";

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
		var Page2;
		function refresh() {
			Page2 = new EmbedBuilder()
				.setConfig()
				.setImage("https://media.discordapp.net/attachments/1050727525644513322/1050727572595544144/snowed.png?width=1253&height=671")
				.setDescription(
					`\`\`\`${tr("botDesc")}\`\`\`` //你好！我是 iCE，一個提供多種功能的Discord機器人，按下下方按鈕以查看更多關於我的資訊
				)
				.addField(
					tr("botUptime"), //上線時間
					msToHMS(client.uptime),
					true
				)
				.addField(
					tr("latency"), //延遲
					client.ws.ping + `ms`,
					true
				)
				.addField(
					tr("botServers"), //伺服器數量
					`${client.guilds.cache.size} `,
					true
				)
				.addField(
					tr("botMemoryUsage"), //記憶體使用率
					getpercentage,
					true
				);
		}
		var curPage = 1;

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("infoswitch")
				.setLabel(tr("infoSwitch")) //切換
				.setStyle(2)
		);

		const row2 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("infoswitch")
				.setLabel(tr("infoSwitch")) //切換
				.setStyle(2),
			new ButtonBuilder()
				.setCustomId("inforefresh")
				.setLabel(tr("infoRefresh")) //刷新
				.setEmoji("🔄")
				.setStyle(1)
		);

		const Page1 = new EmbedBuilder()
			.setConfig()
			.setImage("https://media.discordapp.net/attachments/1050727525644513322/1050727572595544144/snowed.png?width=1253&height=671")
			.setDescription(
				`\`\`\`${tr("botDesc")}\`\`\`` //你好！我是 iCE，一個提供多種功能的Discord機器人，按下下方按鈕以查看更多關於我的資訊
			)
			.addField(
				tr("botDevs"), //機器人開發者
				`
                > [Yeci](https://github.com/yeci226)
                > [Mantou](https://github.com/Mantou1233)
                > [Cookie](https://github.com/Cooookie16)
                `
			);

		var usedMemory = os.totalmem() - os.freemem(),
			totalMemory = os.totalmem();
		var getpercentage = ((usedMemory / totalMemory) * 100).toFixed(2) + "%";
		refresh();
		await interaction.reply({
			embeds: [Page1],
			components: [row]
		});

		client.on("interactionCreate", interaction => {
			if (!interaction.isButton()) return;
			if (interaction.customId === "infoswitch") {
				refresh();
				let pages = [Page1, Page2];
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
			if (interaction.customId === "inforefresh") {
				refresh();
				return interaction.message.edit({
					embeds: [Page2],
					components: [row2]
				});
			}
		});
	}
};
