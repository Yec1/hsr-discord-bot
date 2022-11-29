import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { getSFWImage } from 'waifu.pics-wrapper'


export default {
	data: new SlashCommandBuilder()
		.setName("pictures")
		.setDescription("Get some pictures")
		.setNameLocalizations({
			"zh-TW": "圖片",
			ja: "undefined"
		})
		.setDescriptionLocalizations({
			"zh-TW": "召喚一些圖片",
			ja: "undefined"
		})
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Pictures category')
                .setNameLocalizations({
                    "zh-TW": "類型",
                    ja: "undefined"
                })
                .setDescriptionLocalizations({
                    "zh-TW": "圖片的類型",
                    ja: "undefined"
                })
                .setRequired(true)
                .addChoices(
                    {
                        name: 'waifu',
                        name_localizations: {
                            "zh-TW": "老婆",
                            ja: "undefined"
                        },
                        value: 'waifu'
                    },
                    {
                        name: 'neko',
                        name_localizations: {
                            "zh-TW": "貓娘",
                            ja: "undefined"
                        },
                        value: 'neko'
                    }                    
                )
        ),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, tr) {
        await interaction.editReply({ embeds: [
                new EmbedBuilder()
                    .setConfig()
                    .setImage(
                        await getSFWImage(
                            interaction.options.getString('category')
                    )
                )
            ]
        })
	}
};
