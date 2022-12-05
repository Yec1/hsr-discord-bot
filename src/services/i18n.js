import en from "../assets/languages/en.js";
import tw from "../assets/languages/tw.js";
import jp from "../assets/languages/jp.js";

const langs = { en, tw, jp};

export function i18nMixin(lang) {
	if (!Object.keys(langs).includes(lang))
		throw new Error("No lang specified found!");
	return function i18n(string, options, ...args) {
		let str = langs[lang][string] ?? langs["en"][string];
		if (str == undefined) return void 0;
		if (typeof str == "function") return str(options, ...args);
		else if (typeof str != "string") return str;
		else {
			if (options)
				for (let [key, value] of Object.entries(options))
					str = str.replace(`<${key}>`, `${value}`);
			if (args)
				for (let [index, value] of Object.entries(args))
					str = str
						.replace("%s", `${value}`)
						.replace(`%${index}%`, `${value}`);
		}
		return str;
	};
}
export function tl3(str) {
	if (str.startsWith("zh")) return "tw";
}
