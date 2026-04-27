import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Config {
	TOKEN: string;
	TEST_TOKEN: string;
	CMDWEBHOOK: string;
	JLWEBHOOK: string;
	LOGWEBHOOK: string;
	FBWEBHOOK: string;
	ERRWEBHOOK: string;
	AUTHTOKEN: string;
	WEBSERVER_PORT: number;
	DEVIDS: string[];
	PROXY_URL?: string;
	/** Vercel proxy API base URL, e.g. https://your-project.vercel.app */
	PROXY_API_URL?: string;
	/** Bearer token to authenticate with the Vercel proxy */
	PROXY_API_TOKEN?: string;
	/** Public URL of the web-login app (Vercel), used in /account button */
	WEB_LOGIN_URL?: string;
	/** Supabase project URL — used to pull pending logins from web-login */
	SUPABASE_URL?: string;
	/** Supabase service_role key (server-side only) */
	SUPABASE_SERVICE_ROLE_KEY?: string;
	/** AES-256-CBC key used to decrypt cookies pulled from Supabase.
	 *  Must match SESSION_SECRET in the web-login .env. */
	WEB_LOGIN_SESSION_SECRET?: string;
}

let config: Config | null = null;

/**
 * Build config from process.env, treating env as the source of truth.
 * Returns a partial config — only keys that are actually set in env are included.
 */
function readFromEnv(): Partial<Config> {
	const env = process.env;
	const out: Partial<Config> = {};

	// String fields
	const stringKeys = [
		"TOKEN",
		"TEST_TOKEN",
		"CMDWEBHOOK",
		"JLWEBHOOK",
		"LOGWEBHOOK",
		"FBWEBHOOK",
		"ERRWEBHOOK",
		"AUTHTOKEN",
		"PROXY_URL",
		"PROXY_API_URL",
		"PROXY_API_TOKEN",
		"WEB_LOGIN_URL",
		"SUPABASE_URL",
		"SUPABASE_SERVICE_ROLE_KEY",
		"WEB_LOGIN_SESSION_SECRET",
	] as const;

	for (const key of stringKeys) {
		const value = env[key];
		if (value !== undefined && value !== "") {
			(out as Record<string, unknown>)[key] = value;
		}
	}

	// Number field: WEBSERVER_PORT
	if (env.WEBSERVER_PORT) {
		const n = Number(env.WEBSERVER_PORT);
		if (!Number.isNaN(n)) out.WEBSERVER_PORT = n;
	}

	// Array field: DEVIDS — comma-separated string in env, e.g. "111,222,333"
	if (env.DEVIDS) {
		out.DEVIDS = env.DEVIDS.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	return out;
}

/**
 * Load config.json from cwd if it exists. Returns {} if absent (no longer
 * fatal — env-only deployment is supported).
 */
function readFromFile(): Partial<Config> {
	const configPath = join(process.cwd(), "config.json");
	if (!existsSync(configPath)) return {};

	try {
		const content = readFileSync(configPath, "utf8");
		return JSON.parse(content) as Partial<Config>;
	} catch (error) {
		throw new Error(`读取配置文件失败: ${error}`);
	}
}

export function loadConfig(): Config {
	if (config) {
		return config;
	}

	// env wins; config.json fills gaps. Either source alone may be enough.
	const fromFile = readFromFile();
	const fromEnv = readFromEnv();
	const merged = { ...fromFile, ...fromEnv } as Config;

	// Sanity: TOKEN is the one truly mandatory key for the bot to start.
	if (!merged.TOKEN) {
		throw new Error(
			"配置加载失败: TOKEN is required (set via env TOKEN or config.json)",
		);
	}

	config = merged;
	return config;
}

export function getConfig(): Config {
	const loadedConfig = loadConfig();
	if (!loadedConfig) {
		throw new Error("配置加载失败");
	}
	return loadedConfig;
}

// 为了兼容性，也提供环境变量风格的访问
export function getEnv(key: string): string | undefined {
	const config = loadConfig();
	return config[key as keyof Config] as string;
}
