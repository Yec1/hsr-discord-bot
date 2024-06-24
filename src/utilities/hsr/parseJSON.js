// const axios = require("axios");
// import { Logger } from "./logger.js";

const cleanText = text => {
	return text
		.replace(/[^\w\s-]/g, "")
		.toLowerCase()
		.replace(/\s+/g, "-");
};

import localBannerJSON from "../../assets/banners.json" assert { type: "json" };
import localCharJSON from "../../assets/char.json" assert { type: "json" };
import localWeaponJSON from "../../assets/weapons.json" assert { type: "json" };

const bannerJSON = localBannerJSON;
const charJSON = localCharJSON.reduce((acc, item) => {
	acc[cleanText(item.name)] = item;
	return acc;
}, {});
const weaponJSON = localWeaponJSON.reduce((acc, item) => {
	acc[cleanText(item.name)] = item;
	return acc;
}, {});

// let charJSON = {};
// let weaponJSON = {};
// let bannerJSON = {};

// async function fetchData() {
// try {
//   const urls = [
//     "https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/banners.json",
//     "https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/char.json",
//     "https://raw.githubusercontent.com/mikeli0623/star-rail-warp-sim/master/src/assets/data/weapons.json",
//   ];
//   const responses = await Promise.all(urls.map((url) => axios.get(url)));
//   bannerJSON = responses[0].data;
//   charJSON = responses[1].data.reduce((acc, item) => {
//     acc[cleanText(item.name)] = item;
//     return acc;
//   }, {});
//   weaponJSON = responses[2].data.reduce((acc, item) => {
//     acc[cleanText(item.name)] = item;
//     return acc;
//   }, {});
// } catch (error) {
// new Logger("網路請求").info(`錯誤訊息：${error}`);
// charJSON = require(`./assets/char.json`);
// weaponJSON = require(`./assets/weapons.json`);
// bannerJSON = require(`./assets/banners.json`);
// }
// }

// fetchData();

function isChar(item) {
	return Object.keys(charJSON).includes(cleanText(item));
}

function getName(item) {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.name;
}

function getRarity(item) {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.rarity;
}

function getPath(item, lang = "zh") {
	const json = isChar(item) ? charJSON : weaponJSON;
	return json[cleanText(item)]?.path;
}

function getElement(name) {
	return charJSON[cleanText(name)]?.element || "";
}

function getTitle(vers, type, lang) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.title[lang];
}

function getRateUpFive(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.rateUpFive || [];
}

function getRateUpFour(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.rateUpFour || [];
}

function getPoolFiveChar(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFiveChar || [];
}

function getPoolFiveWeap(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFiveWeap || [];
}

function getPoolFourChar(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFourChar || [];
}

function getPoolFourWeap(vers, type) {
	const key = bannerJSON.find(
		item => item.vers.includes(vers) && item.type === type
	);
	return key?.poolFourWeap || [];
}

export {
	isChar,
	getName,
	getRarity,
	getPath,
	getElement,
	getTitle,
	getRateUpFive,
	getRateUpFour,
	getPoolFiveChar,
	getPoolFiveWeap,
	getPoolFourChar,
	getPoolFourWeap
};
