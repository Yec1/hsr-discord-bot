export function argumentParser(msg, mode = false) {
	if (mode) {
		let [_, ...rest] = msg.split(/ +/);
		return [msg.split(/ +/)[0], rest.join(" ")];
	}
	// prettier-ignore
	return [...msg.matchAll(/(?<=^| )("?)(.+?)\1(?= |$)/g)].map(match => match[0].replaceAll("\"", ""));
}

export function emojiParser(pr) {
	const emojis = [];
	pr.replace(
		/<(?<animated>a)?:(?<name>\w{2,32}):(?<id>\d{17,20})>/g,
		(display, _1, _2, _3, _4, _5, group) =>
			void emojis.push({
				...group,
				animated: Boolean(group.animated ?? false),
				// prettier-ignore
				url: `https://cdn.discordapp.com/emojis/${group.id}.${group.animated ?? false ? "gif" : "png"}`,

				// prettier-ignore
				display
			}) ?? display
	);
	return emojis;
}
