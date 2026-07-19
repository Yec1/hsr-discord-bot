import axios from "axios";
import { access, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const imageDownloadCache = new Map<string, Promise<string | null>>();
const config = {
	remoteBase:
		"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/image/character_portrait/",
	localDir: "./src/assets/image/character_portrait",
	extension: ".png"
};

async function ensureImageDir(): Promise<void> {
	try {
		await access(config.localDir);
	} catch {
		await mkdir(config.localDir, { recursive: true });
	}
}

export async function downloadImage(
	_imageType: "character_portrait",
	imageId: string
): Promise<string | null> {
	const remoteUrl = `${config.remoteBase}${imageId}${config.extension}`;
	const localPath = `${config.localDir}/${imageId}${config.extension}`;
	const cacheKey = `character_portrait:${imageId}`;
	const cached = imageDownloadCache.get(cacheKey);
	if (cached) return cached;
	if (existsSync(localPath)) return localPath;

	const promise = (async () => {
		try {
			await ensureImageDir();
			const response = await axios.get(remoteUrl, {
				responseType: "arraybuffer",
				timeout: 10000
			});
			await writeFile(localPath, response.data);
			return localPath;
		} catch (error) {
			console.warn(
				`[Image Download] Failed to download character_portrait:${imageId}`,
				error
			);
			return null;
		} finally {
			imageDownloadCache.delete(cacheKey);
		}
	})();
	imageDownloadCache.set(cacheKey, promise);
	return promise;
}

export async function downloadImages(
	imageType: "character_portrait",
	imageIds: string[]
): Promise<void> {
	for (let i = 0; i < imageIds.length; i += 5) {
		await Promise.allSettled(
			imageIds.slice(i, i + 5).map(id => downloadImage(imageType, id))
		);
	}
}

export function downloadCharacterPortrait(characterId: string) {
	return downloadImage("character_portrait", characterId);
}

export function downloadCharacterPortraits(characters: Array<{ id: string }>) {
	return downloadImages(
		"character_portrait",
		characters.map(character => character.id)
	);
}
