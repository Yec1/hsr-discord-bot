import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
} from "discord.js";
import { TranslationFunction } from "@/types/index.js";

const MAX_IMAGE_BYTES = 9 * 1024 * 1024; // 9 MB

async function attachmentToDataUri(url: string, size: number): Promise<string> {
	if (size > MAX_IMAGE_BYTES) {
		throw new Error(`圖片超過 9 MB 上限（${(size / 1024 / 1024).toFixed(1)} MB）`);
	}
	const response = await fetch(url);
	if (!response.ok) throw new Error(`圖片下載失敗（HTTP ${response.status}）`);
	const contentType = response.headers.get("content-type") || "image/png";
	const buffer = await response.arrayBuffer();
	const base64 = Buffer.from(buffer).toString("base64");
	return `data:${contentType};base64,${base64}`;
}

export default {
	data: new SlashCommandBuilder()
		.setName("bot-profile")
		.setDescription("Manage bot guild-specific profile (admin only)")
		.setNameLocalizations({ "zh-TW": "機器人設定" })
		.setDescriptionLocalizations({ "zh-TW": "管理機器人在此伺服器的個人資料（僅管理員）" })
		.addSubcommand(sub =>
			sub
				.setName("avatar")
				.setDescription("Set bot guild-specific avatar")
				.setNameLocalizations({ "zh-TW": "頭像" })
				.setDescriptionLocalizations({ "zh-TW": "設定機器人在此伺服器的頭像" })
				.addAttachmentOption(op =>
					op
						.setName("image")
						.setDescription("Avatar image (PNG / JPG / GIF, max 9 MB)")
						.setNameLocalizations({ "zh-TW": "圖片" })
						.setDescriptionLocalizations({ "zh-TW": "頭像圖片（PNG / JPG / GIF，最大 9 MB）" })
						.setRequired(true),
				),
		)
		.addSubcommand(sub =>
			sub
				.setName("nickname")
				.setDescription("Set or reset bot nickname in this guild")
				.setNameLocalizations({ "zh-TW": "暱稱" })
				.setDescriptionLocalizations({ "zh-TW": "設定或重置機器人在此伺服器的暱稱" })
				.addStringOption(op =>
					op
						.setName("name")
						.setDescription("New nickname (leave empty to reset)")
						.setNameLocalizations({ "zh-TW": "名稱" })
						.setDescriptionLocalizations({ "zh-TW": "新暱稱（留空以重置）" })
						.setMaxLength(32)
						.setRequired(false),
				),
		)
		.addSubcommand(sub =>
			sub
				.setName("banner")
				.setDescription("Set bot guild-specific banner")
				.setNameLocalizations({ "zh-TW": "橫幅" })
				.setDescriptionLocalizations({ "zh-TW": "設定機器人在此伺服器的橫幅（建議 600×240）" })
				.addAttachmentOption(op =>
					op
						.setName("image")
						.setDescription("Banner image (PNG / JPG / GIF, recommended 600×240, max 9 MB)")
						.setNameLocalizations({ "zh-TW": "圖片" })
						.setDescriptionLocalizations({ "zh-TW": "橫幅圖片（PNG / JPG / GIF，建議 600×240，最大 9 MB）" })
						.setRequired(true),
				),
		)
		.addSubcommand(sub =>
			sub
				.setName("reset")
				.setDescription("Reset bot profile fields to default")
				.setNameLocalizations({ "zh-TW": "重置" })
				.setDescriptionLocalizations({ "zh-TW": "重置機器人的個人資料至預設" })
				.addStringOption(op =>
					op
						.setName("target")
						.setDescription("Which field to reset")
						.setNameLocalizations({ "zh-TW": "項目" })
						.setDescriptionLocalizations({ "zh-TW": "要重置的項目" })
						.addChoices(
							{ name: "頭像", value: "avatar" },
							{ name: "暱稱", value: "nickname" },
							{ name: "橫幅", value: "banner" },
							{ name: "全部", value: "all" },
						)
						.setRequired(true),
				),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

	async execute(
		interaction: ChatInputCommandInteraction,
		_tr: TranslationFunction,
	): Promise<any> {
		if (!(interaction.member?.permissions as any)?.has?.(PermissionFlagsBits.ManageGuild)) {
			return interaction.reply({ content: "❌ 你沒有管理伺服器的權限。", flags: MessageFlags.Ephemeral });
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const guild = interaction.guild;
		if (!guild) {
			return interaction.editReply("❌ 此指令只能在伺服器中使用。");
		}

		const subcommand = interaction.options.getSubcommand();
		const body: Record<string, any> = {};
		let successMsg = "";

		try {
			if (subcommand === "avatar") {
				const attachment = interaction.options.getAttachment("image", true);
				body.avatar = await attachmentToDataUri(attachment.url, attachment.size);
				successMsg = "✅ 頭像已更新！";
			} else if (subcommand === "nickname") {
				const name = interaction.options.getString("name") ?? null;
				body.nick = name ?? "";
				successMsg = name ? `✅ 暱稱已設定為 **${name}**` : "✅ 暱稱已重置。";
			} else if (subcommand === "banner") {
				const attachment = interaction.options.getAttachment("image", true);
				body.banner = await attachmentToDataUri(attachment.url, attachment.size);
				successMsg = "✅ 橫幅已更新！";
			} else if (subcommand === "reset") {
				const target = interaction.options.getString("target", true);
				if (target === "avatar" || target === "all") body.avatar = null;
				if (target === "nickname" || target === "all") body.nick = "";
				if (target === "banner" || target === "all") body.banner = null;
				const targetLabel: Record<string, string> = {
					avatar: "頭像",
					nickname: "暱稱",
					banner: "橫幅",
					all: "全部",
				};
				successMsg = `✅ 已重置：${targetLabel[target] ?? target}`;
			}

			await (interaction.client.rest as any).patch(`/guilds/${guild.id}/members/@me`, { body });
			await interaction.editReply({ content: successMsg });
		} catch (e: any) {
			const errMsg = e?.rawError?.message || e?.message || String(e);
			await interaction.editReply(`❌ 發生錯誤：${errMsg}`);
		}
	},
};
