import { EmbedBuilder } from "discord.js";
import { client } from "../index.js";
import moment from "moment";

const day = [
	"星期天",
	"星期一",
	"星期二",
	"星期三",
	"星期四",
	"星期五",
	"星期六"
];

Object.defineProperties(EmbedBuilder.prototype, {
	setConfig: {
		value: function (footer) {
			const text = [
				"Hello World!",
				"讓Discord更方便",
				`今天是${day[moment().utcOffset(8).weekday()]}`,
				"點擊我的頭像查看更多資訊"
			];
			var texts = "iCE - ";
			if (footer === undefined)
				texts += text[Math.floor(Math.random() * text.length)];
			else texts += footer;
			return this.setColor(parseInt("CFF2FF", 16)).setFooter({
				text: texts,
				iconURL: client.user.displayAvatarURL()
			});
		},
		enumerable: false
	},
	addField: {
		value: function (name, value, inline = false) {
			return this.addFields({
				name,
				value,
				inline
			});
		},
		enumerable: false
	}
});
