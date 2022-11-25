import { range } from "discord.js";

global.random = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1) + min);
};
global.range = (start, end, step = 1) => {
	return Array.from(
		{ length: (end - start) / step + 1 },
		(_, index) => start + index * step
	);
};
