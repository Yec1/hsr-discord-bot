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
}

let config: Config | null = null;

export function loadConfig(): Config {
	if (config) {
		return config;
	}

	const configPath = join(__dirname, "../../../config.json");

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
