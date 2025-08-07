import tw from "@/assets/languages/tw.js";
import cn from "@/assets/languages/cn.js";
import en from "@/assets/languages/en.js";
import { LanguageStrings } from "@/types/lang.js";

const langs: { [key: string]: LanguageStrings } = {
	tw: tw,
	cn: cn,
	en: en
};

/**
 * @description 創建翻譯器
 * @param lang - 語言
 * @returns 翻譯器
 */
export function createTranslator(lang: string) {
	if (!Object.keys(langs).includes(lang)) {
		lang = "tw";
		// throw new Error('No lang specified found!');
	}

	return function i18n(
		string: string,
		options?: Record<string, string>,
		...args: any[]
	): string {
		let str =
			langs[lang]?.[string as keyof LanguageStrings] ??
			langs["tw"]?.[string as keyof LanguageStrings];
		if (!str) return string;

		// Handle string type translations
		if (options) {
			for (let [key, value] of Object.entries(options)) {
				str = str.replace(`<${key}>`, `${value}`);
			}
		}
		if (args) {
			for (let [index, value] of Object.entries(args)) {
				str = str.replace(`%${index}%`, `${value}`);
			}
		}
		return str;
	};
}

export function toI18nLang(str: string) {
	if (typeof str !== "string") return "en";
	return str.startsWith("zh") ? "tw" : "en";
}
