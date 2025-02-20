import en from "../../assets/languages/en.js";
import tw from "../../assets/languages/tw.js";
import cn from "../../assets/languages/cn.js";

const langs = { en, tw, cn };

export function i18nMixin(lang) {
	lang = langs[lang] ? lang : "en";

	if (lang !== "en" && !langs[lang]) {
		console.error(
			`[i18n] The language "${lang}" is not supported, fallback to "en".`
		);
	}

	return function i18n(string, options, ...args) {
		let str = langs[lang][string] ?? langs.en[string];
		if (str === undefined) return;

		if (typeof str === "function") return str(options, ...args);
		if (typeof str !== "string") return str;

		// 替換對應的 key-value
		if (isObj(options)) {
			for (const [key, value] of Object.entries(options)) {
				str = str.replaceAll(`<${key}>`, `${value}`);
			}
		}

		// 若 options 是字串，加入 args
		if (typeof options === "string") args.unshift(options);

		// 處理 %s 和 %index%
		if (args.length > 0) {
			str = str.replace(/%s/g, () => args.shift() || "");
			args.forEach((value, index) => {
				str = str.replaceAll(`%${index}%`, `${value}`);
			});
		}

		return str;
	};
}

export function toI18nLang(str) {
	if (typeof str !== "string") return "en";
	return str.startsWith("zh") ? "tw" : "en";
}

function isObj(value) {
	return value && typeof value === "object" && !(value instanceof Array);
}
