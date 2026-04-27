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

export function loadConfig(): Config {
	if (config) {
		return config;
	}

	// 修复路径问题，使用相对于项目根目录的路径
	const configPath = join(process.cwd(), "config.json");

	if (!existsSync(configPath)) {
		throw new Error(`配置文件不存在: ${configPath}`);
	}

	try {
		const configContent = readFileSync(configPath, "utf8");
		config = JSON.parse(configContent);
		if (!config) {
			throw new Error("配置文件解析失败");
		}
		return config;
	} catch (error) {
		throw new Error(`读取配置文件失败: ${error}`);
	}
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
