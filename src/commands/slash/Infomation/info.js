import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ComponentType,
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
		var page2;
		function refresh(i) {
			page2 = new EmbedBuilder()
				.setConfig()
				.setDescription(`\`\`\`${tr("botDesc")}\`\`\``)
				.addField(
					tr("botUptime"), //上線時間
					msToHMS(client.uptime),
					true
				)
				.addField(
					tr("latency"), //延遲
					`${Math.abs(Date.now() - i.createdTimestamp)}ms`,
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

		const Page1 = new EmbedBuilder()
			.setConfig()
			.setDescription(`\`\`\`${tr("botDesc")}\`\`\``)
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
		refresh(interaction);
		await interaction.reply({
			embeds: [Page1],
			components: [row]
		});

		const filter = _ => true;

		const collector = interaction.channel.createMessageComponentCollector({
			filter,
			componentType: ComponentType.Button
		});

		collector.on("collect", interaction => {
			if (!interaction.isButton()) return;
			if (interaction.customId === "info_s_switch") {
				refresh(interaction);
				let pages = [Page1, page2];
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
