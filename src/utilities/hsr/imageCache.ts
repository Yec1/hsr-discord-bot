import { loadImage } from "@napi-rs/canvas";

const MAX_ENTRIES = 100;
const cache = new Map<string, Promise<any>>();

// ponytail: one bounded process-wide cache; split by renderer only if eviction contention is measured.
export function getSharedImage(path: string): Promise<any> {
	const cached = cache.get(path);
	if (cached) {
		cache.delete(path);
		cache.set(path, cached);
		return cached;
	}

	const pending = loadImage(path).catch(error => {
		if (cache.get(path) === pending) cache.delete(path);
		throw error;
	});
	if (cache.size >= MAX_ENTRIES) {
		const firstKey = cache.keys().next().value;
		if (firstKey) cache.delete(firstKey);
	}
	cache.set(path, pending);
	return pending;
}

export function clearSharedImageCache(): void {
	cache.clear();
}
