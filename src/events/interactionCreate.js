import { client } from "../index.js";
import { ApplicationCommandOptionType } from "discord.js";
import { i18nMixin, toI18nLang } from "../utilities/core/i18n.js";
import { Events, EmbedBuilder, WebhookClient, ChannelType } from "discord.js";
import emoji from "../assets/emoji.js";
import Logger from "../utilities/core/logger.js";
import { setupDefaultLang, getUserLang } from "../utilities/utilities.js";

const db = client.db;
const webhook = new WebhookClient({ url: process.env.CMDWEBHOOK });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.channel.type == ChannelType.DM) return;

	if (!(await getUserLang(interaction.user.id)))
		await setupDefaultLang(interaction.user.id, interaction.locale);

	const userLocale =
		(await getUserLang(interaction.user.id)) ||
		toI18nLang(interaction.locale) ||
		"en";
	const i18n = i18nMixin(userLocale);

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

			// if (
			// 	(await db.get(`${interaction.user.id}.premium`)) != true &&
			// 	Math.floor(Math.random() * 100) < 10
			// ) {
			// 	await interaction.fetchReply().catch(() => {});
			// 	interaction.followUp({
			// 		embeds: [
			// 			new EmbedBuilder()
			// 				.setColor("#A6FFA6")
			// 				.setDescription(
			// 					"## 星穹鐵道迎來二周年魔儲與你一同慶祝！\n" +
			// 						"## 🔶 購買遐蝶組合包，即可獲得組合包加碼贈送的福利\n" +
			// 						"賣場新增3個組合包品項，每個組合包都有額外贈送商品，還可以參加抽獎\n" +
			// 						"## 🔶 註冊新會員即領折價券\n" +
			// 						"4/9~4/29期間註冊成為魔儲會員，帳號內就會獲得一張鐵道賣場專用的百元折價券\n" +
			// 						"記得要用我的推薦碼【yeci】喔！！\n" +
			// 						"還有幸運骰子的超多精美獎品要送給大家，趕快點擊下面的連結去看看吧～\n" +
			// 						"https://www.mepay.com.tw/HonkaiStarRail?code=yeci\n\n" +
			// 						"---\n" +
			// 						"✨ 製作 BOT 不容易，如果覺得這些資訊有幫助，也歡迎在消費時選擇支持我喔，感謝大家的支持 ❤️\n\n" +
			// 						"## [前往 MEPay 魔儲](https://www.mepay.com.tw/auth?rcode=yeci)"
			// 				)
			// 				.setImage(
			// 					"https://media.discordapp.net/attachments/1231256542419095623/1359821836388532244/2c0c529c0a62dec0.png?ex=67f8e046&is=67f78ec6&hm=6fe169a79815f9d42b42dc620ecaab5b09c612475452a0dd7e7532993045ec21&=&format=webp&quality=lossless&width=960&height=960"
			// 				)
			// 		],
			// 		ephemeral: true
			// 	});
			// }

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
