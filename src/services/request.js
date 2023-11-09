import axios from "axios";
import { QuickDB } from "quick.db";
const db = new QuickDB();

const color = {
	0: "#AAC8A7",
	60: "#C3EDC0",
	100: "#FDFFAE",
	140: "#FFCF96",
	180: "#FF8080",
	220: "#BB2525"
};

async function player(uid, interaction) {
	return await fetch(
		`https://api.mihomo.me/sr_info_parsed/${uid}${
			(await db?.has(`${interaction?.user.id}.locale`))
				? (await db?.get(`${interaction.user.id}.locale`)) == "tw"
					? "?lang=cht"
					: "?lang=en"
				: interaction
				? interaction.locale == "zh-TW"
					? "?lang=cht"
					: "?lang=en"
				: "?lang=cht"
		}`
	).then(response => response.json());
}

async function getNews(lang, type) {
	return await axios({
		headers: { Origin: "https://www.hoyolab.com", "X-Rpc-Language": lang },
		method: "get",
		url: "https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList",
		params: { gids: 6, page_size: 25, type: type }
	}).then(response => response.data);
}

function staminaColor(stamina) {
	let selectedColor = null;

	for (const key in color)
		if (stamina >= parseInt(key)) selectedColor = color[key];

	return selectedColor;
}

export { player, getNews, staminaColor };
