import { extname, join } from "node:path";
import { readdir } from "node:fs/promises";

export async function getAllFilesFromFs(
	dir: string,
	exts: string[]
): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await getAllFilesFromFs(fullPath, exts)));
		} else if (exts.includes(extname(entry.name))) {
			files.push(fullPath);
		}
	}
	return files;
}
