import { Message, EmbedBuilder } from "discord.js";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { client, database } from "@/index.js";
import emoji from "@/assets/emoji.js";
import { loadAccounts } from "@/utilities/accountStore.js";

interface AutoDaily {
	time: string;
}

interface AutoNotify {
	stamina: string;
}

function parseCookieMap(cookie: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const part of cookie.split(";")) {
		const [k, ...rest] = part.trim().split("=");
		if (k && rest.length > 0) map[k.trim()] = rest.join("=").trim();
	}
	return map;
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

		if (!id) {
			return message.reply({
				content: "請提供用戶ID！"
			});
		}

		const exists = await database.has(`${id}`);
		if (!exists)
			return message.reply({
				content: `沒有 ${id} 的資料！`
			});

		const user = await client.users.fetch(id);
		const daily = (await database.get(`autoDaily.${id}`)) as AutoDaily;
		const notify = (await database.get(`autoNotify.${id}`)) as AutoNotify;

		// Load accounts via the new hoyolabs format (with legacy migration fallback)
		const store = await loadAccounts(database, id);
		const hoyolabs = store.hoyolabs;

		// Build a flat list of accounts for the dropdown menus (legacy-compatible)
		const flatAccounts = hoyolabs.flatMap(h =>
			h.characters.map(c => ({
				uid: c.uid,
				nickname: c.nickname ?? undefined,
				cookie: h.cookie,
				ltuid_v2: h.ltuid_v2,
				hoyolabName: h.hoyolabName,
				invalid: c.invalid || h.invalid
			}))
		);

		const hasAccounts = flatAccounts.length > 0;

		const cookieKeys = ["ltoken_v2", "ltuid_v2", "cookie_token_v2", "account_mid_v2"];

		// Build embed fields: group by hoyolab account, then list characters
		const accountFields = hoyolabs.length === 0
			? [{ name: "❌ `沒有帳號`", value: "\u200b", inline: true }]
			: hoyolabs.flatMap(h => {
				const cookieMap = parseCookieMap(h.cookie);
				const hoyolabHeader = {
					name: `__Hoyolab 帳號__: \`${h.ltuid_v2}\`${h.hoyolabName ? ` (${h.hoyolabName})` : ""}${h.invalid ? " ❌" : ""}`,
					value: cookieKeys
						.filter(k => cookieMap[k])
						.map(k => `**${k}**: \`${cookieMap[k]}\``)
						.join("\n") || "`無 Cookie 資訊`",
					inline: false
				};
				const charFields = h.characters.length === 0
					? [{ name: "　└ 無角色", value: "\u200b", inline: false }]
					: h.characters.map(c => ({
						name: `　└ ${emoji.avatarIcon} ${c.uid}${c.nickname ? ` - ${c.nickname}` : ""}${c.invalid ? " ❌" : ""}`,
						value: c.region_name ? `地區：${c.region_name}` : (c.region ?? "`未知地區`"),
						inline: true
					}));
				return [hoyolabHeader, ...charFields];
			});

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
					.addFields(...accountFields)
			],
			components: hasAccounts
				? [
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.setCustomId("account_EditAccountSelect")
								.setPlaceholder("選擇帳號（編輯 UID/Cookie）")
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									...flatAccounts.map((account, index) => ({
										label: `${account.uid}${account.nickname ? ` - ${account.nickname}` : ""}`,
										value: `${index}`
									}))
								)
						),
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.setCustomId("account_SetUserCookieSelect")
								.setPlaceholder("選擇帳號（直接設定 Cookie）")
								.setMinValues(1)
								.setMaxValues(1)
								.addOptions(
									...flatAccounts.map((account, index) => ({
										label: `${account.uid}${account.nickname ? ` - ${account.nickname}` : ""}`,
										value: `${index}`
									}))
								)
						)
					]
				: []
		});
	}
};
