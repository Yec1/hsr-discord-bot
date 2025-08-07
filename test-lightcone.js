// 测试光锥数据本地优先加载功能
import {
	loadLightConeData,
	JSONManager,
	JSON_CONFIGS
} from "./src/utilities/hsr/jsonManager.js";
import { existsSync, readFileSync } from "fs";

async function testLightConeLocalPriority() {
	console.log("=== 测试光锥数据本地优先加载功能 ===\n");

	const manager = JSONManager.getInstance();

	try {
		// 检查本地文件是否存在
		const localPath = JSON_CONFIGS.LIGHT_CONE_RANKS.localPath;
		const localExists = existsSync(localPath);

		console.log(`1. 检查本地文件状态:`);
		console.log(`   本地路径: ${localPath}`);
		console.log(`   文件存在: ${localExists ? "✓ 是" : "✗ 否"}`);

		if (localExists) {
			try {
				const localData = readFileSync(localPath, "utf-8");
				const parsedData = JSON.parse(localData);
				console.log(`   文件大小: ${localData.length} 字符`);
				console.log(`   数据项数: ${Object.keys(parsedData).length}`);
			} catch (error) {
				console.log(`   文件读取错误: ${error.message}`);
			}
		}

		// 测试加载光锥数据
		console.log("\n2. 测试加载光锥数据:");
		const startTime = Date.now();
		const lightConeData = await loadLightConeData();
		const endTime = Date.now();

		if (lightConeData) {
			console.log(`   ✓ 加载成功`);
			console.log(`   加载耗时: ${endTime - startTime}ms`);
			console.log(
				`   数据大小: ${JSON.stringify(lightConeData).length} 字符`
			);
			console.log(`   光锥数量: ${Object.keys(lightConeData).length}`);

			// 显示前几个光锥的示例
			const sampleKeys = Object.keys(lightConeData).slice(0, 3);
			console.log(`   示例光锥: ${sampleKeys.join(", ")}`);
		} else {
			console.log(`   ✗ 加载失败`);
		}

		// 测试缓存功能
		console.log("\n3. 测试缓存功能:");
		const cacheStatus = manager.getCacheStatus();
		console.log(`   缓存大小: ${cacheStatus.size}`);
		console.log(`   缓存键: ${cacheStatus.keys.join(", ")}`);

		// 测试重复加载（应该从缓存获取）
		console.log("\n4. 测试重复加载（缓存测试）:");
		const cacheStartTime = Date.now();
		const cachedData = await loadLightConeData();
		const cacheEndTime = Date.now();
		console.log(`   缓存加载耗时: ${cacheEndTime - cacheStartTime}ms`);
		console.log(
			`   数据一致性: ${lightConeData === cachedData ? "✓ 一致" : "✗ 不一致"}`
		);

		console.log("\n=== 测试完成 ===");
	} catch (error) {
		console.error("❌ 测试失败:", error);
	}
}

// 运行测试
testLightConeLocalPriority();
