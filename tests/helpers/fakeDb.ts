/**
 * Minimal in-memory implementation of the quick.db subset used by
 * accountStore. Supports dotted keys ("123.account.0.uid"). Sync API
 * wrapped in promises to match quick.db.
 */
export interface FakeDb {
	get<T = unknown>(key: string): Promise<T | undefined>;
	set<T = unknown>(key: string, value: T): Promise<void>;
	delete(key: string): Promise<void>;
	has(key: string): Promise<boolean>;
	_dump(): Record<string, unknown>;
}

function getPath(obj: any, parts: string[]): any {
	let cur = obj;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = cur[p];
	}
	return cur;
}

function setPath(obj: any, parts: string[], value: any): void {
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i]!;
		if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
		cur = cur[p];
	}
	cur[parts[parts.length - 1]!] = value;
}

function deletePath(obj: any, parts: string[]): void {
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i]!;
		if (cur == null || typeof cur !== "object") return;
		cur = cur[p];
	}
	if (cur && typeof cur === "object") delete cur[parts[parts.length - 1]!];
}

export function createFakeDb(initial: Record<string, unknown> = {}): FakeDb {
	const store: Record<string, unknown> = JSON.parse(JSON.stringify(initial));
	return {
		async get<T>(key: string) {
			return getPath(store, key.split(".")) as T | undefined;
		},
		async set<T>(key: string, value: T) {
			setPath(store, key.split("."), value);
		},
		async delete(key: string) {
			deletePath(store, key.split("."));
		},
		async has(key: string) {
			return getPath(store, key.split(".")) !== undefined;
		},
		_dump() {
			return JSON.parse(JSON.stringify(store));
		}
	};
}
