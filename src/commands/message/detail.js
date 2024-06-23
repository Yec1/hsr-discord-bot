import { Client, Message, EmbedBuilder } from "discord.js";

export default {
	name: "detail",
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (client, message, args, emoji) => {
		const db = client.db;
		const id = args[0];
		const data = await db.get(`${id}`);

		if (!data)
			return message.reply({
				content: `沒有 ${id} 的資料！`
			});

		const user = await client.users.fetch(id);
		const daily = await db.get(`autoDaily.${id}`);
		const notify = await db.get(`autoNotify.${id}`);

		message.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle(user.username)
					.setThumbnail(user.displayAvatarURL())
					.addField("自動簽到", `${daily ? daily?.time : "未開啟"}`)
					.addField(
						"自動通知",
						`${notify ? notify?.stamina : "未開啟"}`
					)
					.addFields(
						...(data?.account?.map(account => ({
							name: `${emoji.avatarIcon} ${account.uid}`,
							value: `${
								account.cookie ? `🔗 \`已綁定\`` : "❌ `未綁定`"
							}`,
							inline: true
						})) ?? [
							{
								name: "❌ `沒有帳號`",
								value: "\u200b",
								inline: true
							}
						])
					)
			]
		});
	}
};
