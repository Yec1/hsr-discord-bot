export function cook(str) {
	return str.replaceAll("/", "\\");
}

export function uncook(str) {
	return str.replaceAll("\\", "/");
}
