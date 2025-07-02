import { readdir } from "fs/promises";
import { join, extname } from "path";

export async function getAllJsFiles(dir) {
  let files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getAllJsFiles(fullPath));
    } else if (extname(entry.name) === ".js") {
      files.push(fullPath);
    }
  }

  return files;
}
