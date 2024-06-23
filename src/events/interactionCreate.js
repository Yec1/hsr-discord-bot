import { client } from "../index.js";
import { ApplicationCommandOptionType } from "discord.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";
import {
	Events,
	EmbedBuilder,
	WebhookClient,
	ChannelType,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} from "discord.js";
import emoji from "../assets/emoji.js";
import { Logger } from "../utilities/core/logger.js";

const db = client.db;
const webhook = new WebhookClient({ url: process.env.CMDWEBHOOK });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.channel.type == ChannelType.DM) return;

	const i18n = i18nMixin(
		(await db?.has(`${interaction.user.id}.locale`))
			? await db?.get(`${interaction.user.id}.locale`)
			: toI18nLang(interaction.locale) || "en"
	);

	if (interaction.isButton()) {
		await interaction.deferUpdate().catch(() => {});
	}

	if (interaction.isCommand()) {
		const command = client.commands.slash.get(interaction.commandName);
		if (!command)
			return interaction.followUp({
				content: "An error has occured",
				ephemeral: true
			});

		if (command.data.name != "account" || command.data.name != "warp") {
		} else
			await interaction
				.deferReply({
					/*ephemeral: false*/
				})
				.catch(() => {});

		const args = [];

		for (let option of interaction.options.data) {
			if (option.type === ApplicationCommandOptionType.Subcommand) {
				if (option.name) args.push(option.name);
				option.options?.forEach(x => {
					if (x.value) args.push(x.value);
				});
			} else if (option.value) args.push(option.value);
		}

		try {
			command.execute(client, interaction, args, i18n, db, emoji);

			if (
				interaction.member.roles.cache.has("1012968415964704768") &&
				!(await db.has(`${interaction.user.id}.premium`))
			)
				await db.set(`${interaction.user.id}.premium`, true);

			const time = `花費 ${(
				(Date.now() - interaction.createdTimestamp) /
				1000
			).toFixed(2)} 秒`;

			new Logger("指令").command(
				`${interaction.user.displayName}(${interaction.user.id}) 執行 ${command.data.name} - ${time}`
			);

			if (
				(await db.get(`${interaction.user.id}.premium`)) != true &&
				Math.floor(Math.random() * 100) < 10
			) {
				await interaction.fetchReply().catch(() => {});
				if (Math.floor(Math.random() * 100) <= 50) {
					interaction.followUp({
						embeds: [
							new EmbedBuilder()
								.setColor("#FFA042")
								.setDescription(
									"## MEPay魔儲，多位知名實況主推薦，全台最大遊戲儲值平台。想要既安全又便宜課金？\n\n### 使用我的註冊連結，即可獲得折價券以及抽獎資格！\n\n## [前往 MEPay 魔儲](https://www.mepay.com.tw/auth?rcode=yeci)"
								)
								.setImage(
									"https://media.discordapp.net/attachments/1179006627026833478/1204445667297198080/IMG_1054.png"
								)
						],
						ephemeral: true
					});
				} else {
					interaction.followUp({
						embeds: [
							new EmbedBuilder()
								.setColor("#A6FFA6")
								.setDescription(
									"## 想要免費獲得課金機會嗎？現在加入 Discord 伺服器，即可參加抽獎活動！\n\n## [前往 Discord 伺服器](https://discord.gg/mPCEATJDve)"
								)
								.setImage(
									"https://cdn.discordapp.com/attachments/1162357148890705941/1231228631032791060/imageaa_1.png"
								)
						],
						ephemeral: true
					});
				}
			}

			webhook.send({
				embeds: [
					new EmbedBuilder()
						.setTimestamp()
						.setAuthor({
							iconURL: interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							}),
							name: `${interaction.user.username} - ${interaction.user.id}`
						})
						.setThumbnail(
							interaction.guild.iconURL({
								size: 4096,
								dynamic: true
							})
						)
						.setDescription(
							`\`\`\`${interaction.guild.name} - ${interaction.guild.id}\`\`\``
						)
						.addField(
							command.data.name,
							`${
								interaction.options._subcommand
									? `> ${interaction.options._subcommand}`
									: "\u200b"
							}`,
							true
						)
				]
			});
		} catch (e) {
			new Logger("指令").error(`錯誤訊息：${e.message}`);
			await interaction.reply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	} else if (interaction.isContextMenuCommand()) {
		const command = client.commands.slash.get(interaction.commandName);
		if (!command) return;
		try {
			command.execute(client, interaction);
		} catch (e) {
			new Logger("指令").error(`錯誤訊息：${e.message}`);
			await interaction.reply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	}
});
