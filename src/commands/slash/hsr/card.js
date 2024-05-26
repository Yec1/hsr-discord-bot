import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";
import Queue from "queue";
import { cardImage } from "../../../services/profile.js";

const drawQueue = new Queue({ autostart: true });

export default {
	data: new SlashCommandBuilder()
		.setName("card")
		.setDescription("Showcase yourself!")
		.setNameLocalizations({
			"zh-TW": "卡片"
		})
		.setDescriptionLocalizations({
			"zh-TW": "展示自己！"
		})
		.addSubcommand(subcommand =>
			subcommand
				.setName("view")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "查看"
				})
				.addUserOption(option =>
					option
						.setName("user")
						.setDescription("...")
						.setNameLocalizations({
							"zh-TW": "使用者"
						})
						.setDescriptionLocalizations({
							"zh-TW": "..."
						})
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("setting")
				.setDescription("...")
				.setNameLocalizations({
					"zh-TW": "設置"
				})
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr, db, emoji) {
		const cmd = interaction.options.getSubcommand();
		if (cmd == "view") {
			await interaction.deferReply();
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(tr("profile_imageLoading"))
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});

			const user =
				interaction.options.getUser("user") ?? interaction.user;

			handleDrawRequest(user, interaction, tr);
		} else if (cmd == "setting") {
			const userdb = await db.get(`${interaction.user.id}`);

			await interaction.showModal(
				new ModalBuilder()
					.setCustomId("card_set")
					.setTitle("設定卡片")
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("bg")
								.setLabel("設置背景圖片 (需要 Premium)")
								.setPlaceholder(".jpg .png .webp...")
								.setValue(`${userdb?.bg ? userdb.bg : ""}`)
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
								.setCustomId("image")
								.setLabel("設置左側圖片")
								.setPlaceholder(".jpg .png .webp...")
								.setValue(
									`${userdb?.image ? userdb.image : ""}`
								)
								.setStyle(TextInputStyle.Short)
								.setRequired(false)
						)
					)
			);
		}
	}
};

async function handleDrawRequest(user, interaction, tr) {
	const drawTask = async () => {
		try {
			const imageBuffer = await cardImage(user, interaction);
			if (imageBuffer == null) throw new Error(tr("draw_NoData"));

			const image = new AttachmentBuilder(imageBuffer, {
				name: `${user.id}.png`
			});

			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: `${interaction.user.username}`,
							iconURL: `${interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							})}`
						})
						.setImage(`attachment://${image.name}`)
				],
				components: [],
				files: [image]
			});
		} catch (error) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setConfig()
						.setTitle(
							`${tr("draw_fail")}\n${tr("err_code")}${
								error.message
							}`
						)
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
						)
				]
			});
		}
	};

	drawQueue.push(drawTask);

	if (drawQueue.length != 1)
		interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setConfig()
					.setTitle(
						`${tr("draw_wait", {
							z: drawQueue.length - 1
						})}`
					)
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1119941063780601856/hertaa1.gif"
					)
			]
		});
}
