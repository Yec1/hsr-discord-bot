# 光锥数据本地优先加载功能

## 概述

本功能确保光锥（Light Cone）数据优先使用本地文件，提高加载速度和稳定性。

## 功能特点

### 1. 本地优先策略
- **优先检查本地文件**：首先检查 `./src/assets/light_cone_ranks.json` 是否存在
- **快速本地加载**：如果本地文件存在，直接从本地加载，无需网络请求
- **自动下载备份**：如果本地文件不存在，自动从远程下载并保存到本地

### 2. 智能错误处理
- **文件损坏检测**：自动检测本地文件是否损坏（JSON解析错误）
- **自动修复**：如果本地文件损坏，自动删除并重新下载
- **详细日志**：提供详细的加载过程日志，便于调试

### 3. 缓存机制
- **内存缓存**：加载的数据会缓存在内存中，重复访问时直接返回缓存
- **缓存状态查询**：可以查询当前缓存状态和缓存的文件列表

## 使用方法

### 基本使用

```typescript
import { loadLightConeData } from './src/utilities/hsr/jsonManager.js';

// 加载光锥数据（优先使用本地文件）
const lightConeData = await loadLightConeData();
```

### 在 profile.ts 中的使用

```typescript
// 使用专门的光锥数据加载函数，优先使用本地文件
let lightConeEffect: any = {};
try {
    lightConeEffect = await loadLightConeData() || {};
} catch (error) {
    console.warn("Failed to load light_cone_ranks.json:", error);
}
```

## 文件路径配置

光锥数据的配置在 `jsonManager.ts` 中定义：

```typescript
LIGHT_CONE_RANKS: {
    localPath: "./src/assets/light_cone_ranks.json",
    remoteUrl: "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cht/light_cone_ranks.json",
    fileName: "light_cone_ranks.json"
}
```

## 加载流程

1. **检查缓存**：首先检查内存缓存中是否已有数据
2. **检查本地文件**：检查本地文件是否存在且可读
3. **本地加载**：如果本地文件存在，直接加载并缓存
4. **远程下载**：如果本地文件不存在，从远程下载
5. **保存本地**：下载成功后保存到本地文件
6. **错误处理**：如果本地文件损坏，删除并重新下载

## 日志输出

系统会输出详细的加载过程日志：

```
[JSON] Loading light cone data with local priority...
[JSON] Light cone local file found, loading...
[JSON] ✓ Light cone data loaded from local successfully
```

或者：

```
[JSON] Light cone local file not found, using standard loading...
[JSON] Local file not found, downloading light_cone_ranks.json from remote...
[JSON] ✓ Successfully downloaded and saved light_cone_ranks.json to local
```

## 测试

运行测试脚本验证功能：

```bash
node test-lightcone.js
```

测试脚本会检查：
- 本地文件状态
- 数据加载性能
- 缓存功能
- 重复加载的一致性

## 优势

1. **性能提升**：本地文件加载比网络请求快得多
2. **稳定性增强**：减少对网络连接的依赖
3. **自动管理**：自动处理文件损坏和重新下载
4. **详细监控**：提供详细的加载过程日志
5. **缓存优化**：内存缓存避免重复加载

## 注意事项

1. 确保 `./src/assets/` 目录存在且有写入权限
2. 首次运行时会从远程下载文件，需要网络连接
3. 如果远程文件无法访问，系统会返回 null
4. 建议定期更新本地文件以获取最新的光锥数据
