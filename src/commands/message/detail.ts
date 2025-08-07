import { Message, EmbedBuilder } from "discord.js";
import { client, database } from "@/index.js";
import emoji from "@/assets/emoji.js";

interface Account {
	uid: string;
	nickname?: string;
	cookie?: string;
}

interface UserData {
	account?: Account[];
}

interface AutoDaily {
	time: string;
}

interface AutoNotify {
	stamina: string;
}

export default {
	name: "detail",
	/**
	 *
	 * @param {Message} message
	 * @param {String[]} args
	 */
	execute: async (message: Message, args: string[]) => {
		const id = args[0];
		const data = (await database.get(`${id}`)) as UserData;

		if (!id) {
			return message.reply({
				content: "請提供用戶ID！"
			});
		}

		if (!data)
			return message.reply({
				content: `沒有 ${id} 的資料！`
			});

		const user = await client.users.fetch(id);
		const daily = (await database.get(`autoDaily.${id}`)) as AutoDaily;
		const notify = (await database.get(`autoNotify.${id}`)) as AutoNotify;

		return message.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle(user.username)
					.setThumbnail(user.displayAvatarURL())
					.addFields(
						{
							name: "自動簽到",
							value: `${daily ? daily?.time : "未開啟"}`,
							inline: true
						},
						{
							name: "自動通知",
							value: `${notify ? notify?.stamina : "未開啟"}`,
							inline: true
						}
					)
					.addFields(
						...(data?.account?.map(account => ({
							name: `${emoji.avatarIcon} ${account.uid} ${account.nickname ? `- ${account.nickname}` : ""}`,
							value: `${account.cookie ? `🔗 \`已綁定\` \n\`\`\`${account.cookie}\n\`\`\`` : "❌ `未綁定`"}`,
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
