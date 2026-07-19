# HSR Discord Bot 整體優化與漸進式重構計畫

## 結論

採用 **整體優化 + 局部、可回退的漸進式重構**，不進行全面重寫。

目前程式可通過 TypeScript 靜態檢查、ESLint 與 49 項 Jest 測試。主要複雜度集中在幾個大型模組和帳號資料的相容層；直接重寫會同時危及 Discord 事件、Hoyolab Cookie、QuickDB 資料和 Canvas 圖片輸出。

## 已確認的基線

| 項目 | 現況 | 處理方式 |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` 通過 | 每階段必跑 |
| Jest | 49 通過 | 每次切片後重跑 |
| Lint | 已恢復並納入 TypeScript | 保持 curated baseline，逐步收斂規則 |
| 帳號資料 | canonical `hoyolabs` + legacy lazy migration | 讀寫統一由 `accountStore` 管理，寫入不再重建 `.account` |
| 最大模組 | `profile.ts` 約 4,500 行、`atlas.ts` 約 2,900 行、`forgottenhall.ts` 約 2,400 行、`selectMenu.ts` 約 1,500 行 | renderer 與 select-menu handler 逐塊拆出 |

### 已確認的相容契約

`webhookLogin` 對 enriched Hoyolab 資料保留既有帳號資訊；若資料中沒有 HSR 卡，才使用現有 Cookie 查詢遊戲 UID 並補綁定。既有 `.account` 使用者則由 `accountStore.loadAccounts` 首次讀取時遷移，不要求重新設定 Cookie。

## 最終目標架構

```text
events/          Discord event 路由與最少的協調
commands/        Slash / message command 的輸入解析與回覆
services/hsr/    Hoyolab、帳號、兌換、每日任務等用例
renderers/       profile、atlas、forgotten hall 的圖片繪製
repositories/    QuickDB 的帳號、排行榜與設定資料存取
utilities/       純共用小工具；不混入業務流程
```

這是目標方向，不要求先建立所有目錄。只有在第一個模組搬入時才建立對應目錄。

## 非目標與限制

- 不更換 Discord.js、QuickDB、Canvas、分片機制或資料庫。
- 不更換資料庫格式，直到所有 `.account` 讀寫都經過帳號資料入口。
- 不改變指令名稱、Discord 元件 custom ID、資料 key 或既有圖片視覺輸出，除非該任務明確包含它。
- 不建立 Service/Repository/Factory 抽象層來包裝單一函式；只抽出實際共享或可獨立測試的責任。
- Canvas 繪圖仍維持目前全域 `concurrency: 1`，先記錄耗時與記憶體，再考慮提高併發。提高併發可能造成記憶體尖峰。
- 每個 PR 只完成一個階段中的一個可驗收切片；不得混合依賴升級、視覺重設計與架構搬遷。

## Phase 0：建立可靠基線

### 0.1 決定並修正登入同步契約

**涉及檔案**

- `src/utilities/webhookLogin.ts`
- `tests/webhookLogin.test.ts`

**工作項目**

1. 確認「enriched 沒有 HSR 卡」是否應 fallback 查詢 HSR UID。
2. 讓實作、測試名稱、測試 assertions 與註解描述同一個行為。
3. 保留以下情況的測試：有 HSR 卡、沒有 enriched、解密失敗、綁定失敗不 consume、重複 consume。

**驗收**

```powershell
npm.cmd test -- --runInBand
```

所有測試通過。

### 0.2 恢復 lint，並讓它檢查 TypeScript

**涉及檔案**

- `package.json`
- 新增 `eslint.config.js` 或 `eslint.config.mjs`

**工作項目**

1. 使用 ESLint 10 的 flat config。
2. `lint` 腳本應涵蓋 `src/**/*.ts` 與 `tests/**/*.ts`，不再只指定 `.js`。
3. 初次導入只啟用不會造成大量機械重寫的規則：未使用變數、明確錯誤、匯入解析等。
4. 不要把格式化規則塞進 ESLint；格式維持由 Prettier 處理。

**驗收**

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
```

### 0.3 固定可重現的安裝方式

**涉及檔案**

- `README.md`
- `.gitignore`
- `package-lock.json` 或 `yarn.lock`（二選一）

**工作項目**

1. 選擇 npm 或 yarn，專案只保留一種 lockfile。
2. 將選用 lockfile 納入版本控制，不得由 `.gitignore` 忽略。
3. README 的安裝、測試、建置指令與實際 `package.json` 一致。
4. 不在此階段升級全部依賴。

**驗收**

在乾淨目錄可用選定的套件管理器安裝並跑完 test、lint、type check。

## Phase 1：帳號資料層收斂（最高優先）

### 問題

`src/utilities/accountStore.ts` 已定義新的 `hoyolabs -> characters` 結構；舊的 `${userId}.account` 陣列曾由許多 command、event 與 utility 直接讀寫，造成資料不同步風險。

### 目標

- `accountStore.ts` 成為所有帳號、Cookie、角色資料唯一寫入入口。
- 舊 `.account` 只在首次讀取時由 store lazy migration 轉成 canonical 結構，成功寫入後刪除舊 key。
- 所有讀取帳號的程式改為使用小而明確的 store 函式，而不是散落的 `database.get()`。

### 實施順序

1. 先列出 `.account` 的所有讀寫者，按功能分群：綁定、modal、autocomplete、兌換、每日任務、帳號指令、Cookie refresh。
2. 在 `accountStore.ts` 補足真正被重複需要的最小函式，例如：
   - 取得某使用者所有角色（已存在）
   - 依 UID 取得角色與其 Hoyolab 帳號（已存在）
   - 更新角色 Cookie／失效狀態
   - 移除單一角色或完整 Hoyolab 帳號
3. 每次只遷移一個功能群，搭配該功能的測試。
4. 所有讀寫都已改完後，停用 mirror；保留一次性 lazy migration 以相容既有使用者。
5. migration 採「先寫 canonical、成功後刪 legacy」順序；寫入失敗時保留舊資料。

### 不可做的事

- 不要在每個 command 各自轉換新舊資料格式。
- 不要在 canonical 寫入成功前刪除 `${userId}.account`。
- 不要把 Cookie 明文記錄到 logger 或測試輸出。

### 驗收

- 既有 `tests/accountStore.test.ts`、`tests/updateAccountInfo.test.ts`、`tests/webhookLogin.test.ts` 全數通過。
- 新增最少的回歸測試：同一 Hoyolab 多角色、Cookie 更新、刪除帳號、legacy 資料 lazy migration。
- 手動檢查：綁定、帳號清單、兌換碼、每日簽到、Cookie refresh。

## Phase 2：Canvas renderer 漸進拆分

### 範圍與順序

1. `src/utilities/hsr/profile.ts`
2. `src/utilities/hsr/atlas.ts`
3. `src/utilities/hsr/forgottenhall.ts`

### 拆分規則

保留目前對外函式名稱與呼叫點。例如 `handleProfileDraw` 的外部 API 不變，只將內部責任移出。

優先抽出下列真實可重用責任：

| 責任 | 建議位置 | 備註 |
| --- | --- | --- |
| 圖片下載、快取、失敗 fallback | `renderers/shared/imageCache.ts` | 統一 timeout、cache key、失敗處理 |
| 字型、文字換行、圓角與分隔線 | `renderers/shared/canvasPrimitives.ts` | 只放純繪圖 helper |
| profile 主卡、角色卡、全角色清單 | `renderers/profile/` | 每個檔案只繪製一個畫面 |
| 排行榜資料讀寫 | `repositories/leaderboard.ts` | 不與 Canvas 檔混在一起 |
| atlas API 載入與資料轉換 | `services/hsr/atlas.ts` | 圖片繪製留在 renderer |

### 每次拆分的安全流程

1. 先為原始輸入建立最小 fixture 或 assertion，固定輸出尺寸、關鍵文字、附件類型與失敗訊息。
2. 搬移一個責任，不同時調整版面與色彩。
3. 維持原本 queue 與對外函式。
4. 驗證指令能產生圖片，並人工比對改動前後代表性樣本。

### 不可做的事

- 不要一次拆完 4,000 多行。
- 不要先建立通用 `RendererFactory`、複雜 layout DSL 或多層 canvas wrapper。
- 不要未量測就把 queue concurrency 調高。

## Phase 3：Discord 互動路由收斂

### 問題

`src/events/selectMenu.ts` 同時處理許多不相關的 custom ID 與業務流程，使任何新增或修復都容易碰到其他互動。

本輪已將 account、guide、news、leaderboard、forgotten hall handler 移到
`src/handlers/selectMenu/`；原 custom ID 與路由入口保留不變。

### 目標

`selectMenu.ts` 最終只保留解析 custom ID 與分派：

```ts
if (customId.startsWith("profile:")) return handleProfileFilter(interaction);
if (customId.startsWith("account:")) return handleAccountAction(interaction);
// 其餘依功能群分派
```

### 實施順序

1. 先建立 custom ID 清單與目前 handler 對照表，禁止任意改名。
2. 依序搬移低耦合群組：news、guide、leaderboard、account、forgotten hall、profile。
3. 每搬一組就加入該群的 interaction routing 測試或最小 mock 測試。
4. 最後清除不再使用的 import、共用 mutable state 與重複錯誤回覆。

### 驗收

- 所有既有 select menu、按鈕、modal custom ID 仍可觸發原 handler。
- `selectMenu.ts` 僅保留路由與少量通用防護；業務實作不再塞回去。

## Phase 4：HTTP、錯誤與效能優化

### 4.1 HTTP 邊界

`src/utilities/index.ts` 曾混合檔案掃描、Discord 回覆、帳號存取、Hoyolab 認證、Cookie refresh、新聞與兌換碼請求；本輪已先移出檔案、新聞、兌換碼與玩家資料請求。

先按責任逐步移出：

- `services/hsr/hoyoClient.ts`：Hoyolab HTTP 請求與錯誤轉換（後續切片）。
- `services/hsr/cookieRefresh.ts`：Cookie / stoken refresh 流程（後續切片）。
- `utilities/news.ts`、`utilities/redeemCodes.ts`、`utilities/hsr/playerData.ts`：已移出的資料來源服務。
- `utilities/discordReply.ts`：`replyOrfollowUp`、失敗回覆等 Discord 共用行為（後續切片）。
- `utilities/files.ts`：`getAllFiles`，已完成。

不要在這階段統一 axios 與 fetch。先讓每個服務獨立、具測試；等 HTTP 行為被固定後再決定是否需要統一 client。

### 4.2 最小可觀測性

以現有 `Logger` 寫入結構化、不可含 Cookie 的欄位：

- 指令名稱與耗時
- 外部 API 名稱、HTTP status、耗時、重試次數
- Canvas renderer 名稱、耗時、輸出尺寸
- queue 長度與等待時間

先收集一週的實際資料，再決定是否要新增快取、調整 timeout 或改 queue 併發。

### 4.3 錯誤處理

- 將 command/event 的錯誤回覆收斂為一個共用 helper。
- 保留 root process 與 cluster 的錯誤記錄，但避免同一錯誤被多處重複吞掉。
- 使用者訊息只顯示安全、可行動的錯誤；詳細內容只進 logger。

## Phase 5：依賴與文件清理

### 依賴

先以實際 import、執行路徑與測試確認，再移除未使用套件。優先檢查：

- `cheerio`
- `mysql2`
- `node-rsa`
- `quickmongo`
- `react`
- `react-dom`
- `shx`

不要因為套件名稱未直接出現在 `src` 就直接刪除；先確認是否由 script、Vercel proxy、執行期動態載入或部署環境使用。

### 文件

- 修復 README 編碼與過期的安裝／啟動指令。
- 補上 `config.example.json` 欄位說明，絕不把真實 Token、Webhook、Supabase service key 放入範例。
- 以簡短表格記錄每個指令、資料 key 的用途與關鍵外部服務。

## 所有階段的共同驗收

每個可合併切片至少執行：

```powershell
npm.cmd test -- --runInBand
npx.cmd tsc --noEmit
npm.cmd run lint
```

如改到圖片 renderer，額外執行對應指令，人工檢查圖片尺寸、文字和主要版面。如改到帳號或 Cookie，額外檢查不會在 log、測試快照或 Discord 回覆中洩漏 Cookie。

## 建議 PR 切分

1. `fix: decide webhook enriched fallback contract and restore green tests`
2. `chore: restore TypeScript lint and reproducible install`
3. `refactor: route account reads through accountStore for binding and modal`
4. `refactor: route redeem and daily account reads through accountStore`
5. `refactor: extract profile image cache and canvas primitives`
6. `refactor: split profile renderers without visual changes`
7. `refactor: split select-menu handlers by feature`
8. `refactor: move Hoyolab HTTP and cookie refresh out of utilities index`
9. `chore: remove verified-unused dependencies and refresh documentation`

## 停止條件

若某一切片出現以下任一情況，停止擴大範圍並先修正：

- test、type check 或 lint 失敗。
- 同一帳號在新舊資料結構出現不同 Cookie、角色數或 invalid 狀態。
- Canvas 圖片版面、輸出尺寸或記憶體用量明顯退化。
- 需要修改未列入該 PR 的 Discord custom ID、資料 key 或資料庫格式。

## 完成定義

以下條件全部達成才算整體優化完成：

- CI 或等效本機流程可穩定執行 test、lint、type check。
- 帳號資料只有一個正式讀寫入口；legacy `.account` 僅保留一次性 lazy migration，canonical 寫入成功後即刪除。
- 四個大型檔案不再同時承擔路由、外部 API、資料庫與繪圖責任。
- 重要流程（綁定、Cookie refresh、每日簽到、兌換、profile、忘卻之庭）都有最小回歸驗證。
- 依實測資料完成必要的 HTTP／圖片快取優化，且沒有未驗證的併發調整。
