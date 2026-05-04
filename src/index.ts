import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";
import {
	Client,
	GatewayIntentBits,
	Partials,
	Collection,
	ApplicationCommandType
} from "discord.js";
import { ClusterClient, getInfo } from "discord-hybrid-sharding";
import { QuickDB } from "quick.db";
import { loadConfig } from "@/utilities/core/config.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 重要：discord.js 用的是它自己 nested 的 undici@6（@discordjs/rest/node_modules/undici）
// 不是 hsr-discord-bot 頂層的 undici@8。必須從 discord.js 解析的 undici 取 Agent，
// 否則設定的 dispatcher 跟 discord.js 用的是不同 npm 實例，完全沒有效果。
const require = createRequire(import.meta.url);
const discordUndiciPath = require.resolve("undici", {
	paths: [require.resolve("@discordjs/rest")]
});
const { Agent: DiscordUndiciAgent } = require(discordUndiciPath) as typeof import("undici");

// 解決 stale connection 問題（UND_ERR_SOCKET / "other side closed" with bytesWritten:0）：
// - keepAliveTimeout 設短一點，主動在 server 關閉 idle 連線前丟掉 client 端
// - keepAliveMaxTimeout 上限
// - connect.timeout 連線建立 timeout
const discordRestAgent = new DiscordUndiciAgent({
	keepAliveTimeout: 10_000,
	keepAliveMaxTimeout: 10_000,
	connect: {
		timeout: 30_000
	}
});

const config = loadConfig();

// Types
import type { MessageCommandType, SlashCommandType } from "@/types/index.js";

// Utilities
import { getAllFiles } from "@/utilities/index.js";
import Logger from "@/utilities/core/logger.js";

/**
 * @description Discord 客戶端
 */
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.User,
		Partials.GuildMember,
		Partials.Reaction
	],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false
	},
	rest: {
		timeout: 60000, // 60s，給圖片上傳足夠時間
		agent: discordRestAgent as any
	},
	shards: getInfo().SHARD_LIST,
	shardCount: getInfo().TOTAL_SHARDS
});

/**
 * @description 集群客戶端
 */
const cluster = new ClusterClient(client);

/**
 * @description 資料庫
 */
let database: QuickDB;

try {
	database = new QuickDB();
} catch (error) {
	new Logger("系統").error(`資料庫初始化失敗: ${error}`);
	process.exit(1);
}

/**
 * @description 指令集合
 */
const commands: {
	slash: Collection<string, SlashCommandType>;
	message: Collection<string, MessageCommandType>;
} = {
	slash: new Collection<string, SlashCommandType>(),
	message: new Collection<string, MessageCommandType>()
};

/**
 * @description 獲取訊息指令
 * @param paths - 訊息指令檔案路徑
 * @returns 訊息指令
 */
async function getMessageCommands(paths: string[]) {
	const result: MessageCommandType[] = [];

	for (let path of paths) {
		const fileUrl = `file://${path}`;
		const file = (await import(fileUrl))?.default;
		const splitted = path.split("/");
		const folder = splitted[splitted.length - 2];

		if (file.name) {
			const properties: MessageCommandType = { folder, ...file };
			commands.message.set(file.name, properties);
			result.push(properties);
		}
	}

	return result;
}

/**
 * @description 獲取斜線指令
 * @param paths - 斜線指令檔案路徑
 * @returns 斜線指令
 */
async function getSlashCommands(paths: string[]) {
	const result: any[] = [];

	for (let path of paths) {
		const fileUrl = `file://${path}`;
		const file = (await import(fileUrl))?.default;

		if (file.data && file.execute) {
			commands.slash.set(file.data.name, file);
		} else {
			new Logger("系統").error(
				`${path} 處的指令缺少必要的「資料」或「執行」屬性`
			);
		}

		if (
			file.type === ApplicationCommandType.Message ||
			file.type === ApplicationCommandType.User
		) {
			delete file.description;
		}

		result.push(file.data);
	}

	return result;
}

/**
 * @description 綁定事件
 * @param paths - 事件檔案路徑
 */
async function bindEvents(paths: string[]) {
	for (let path of paths) {
		const fileUrl = `file://${path}`;
		await import(fileUrl);
	}
}

/**
 * @description 載入指令
 */
export async function load() {
	try {
		// 訊息指令
		const messageCommandPaths = await getAllFiles(
			`${__dirname}/commands/message`,
			[".js"]
		);
		const messageCommands = await getMessageCommands(messageCommandPaths);

		// 斜線指令
		const slashCommandPaths = await getAllFiles(
			`${__dirname}/commands/slash`,
			[".js"]
		);
		const slashCommands = await getSlashCommands(slashCommandPaths);

		// 事件
		const eventPaths = await getAllFiles(`${__dirname}/events`, [".js"]);
		await bindEvents(eventPaths);

		new Logger("系統").success(
			`已載入 ${eventPaths.length} 事件、${slashCommands.length} 斜線指令、${messageCommands.length} 訊息指令`
		);

		client.once("ready", async () => {
			try {
				await client.application?.commands.set(slashCommands);
			} catch (error) {
				new Logger("系統").error(`設置斜線指令失敗: ${error}`);
			}
		});
	} catch (error) {
		new Logger("系統").error(`載入指令失敗: ${error}`);
		process.exit(1);
	}
}

client.login(process.env.NODE_ENV === "dev" ? config.TEST_TOKEN : config.TOKEN);

load();

export { client, database, cluster, commands };
