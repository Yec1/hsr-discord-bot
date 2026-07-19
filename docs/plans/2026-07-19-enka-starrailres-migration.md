# Enka + StarRailRes 完整取代 Mihomo Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 完全移除 HSR bot 對 Mihomo API／資料格式／活動 API 的依賴，公開 UID 查詢只使用 Enka 玩家資料與 StarRailRes 靜態資源；同時取消一般 HoYoLAB 指令執行前額外呼叫 `daily.info()` 的驗證流程。

**Architecture:** Enka client 只負責取得原始玩家資料；StarRailRes repository 只負責從本地快取載入多語系名稱、圖示與數值表；adapter 將兩者合併成 bot 內部唯一的 `PlayerData` 格式。HoYoLAB client 建立與 API 驗證分離，一般指令的第一個實際 API 呼叫就是驗證，不再先打 daily API。

**Tech Stack:** TypeScript 6、axios、Jest/ts-jest、Enka HSR API、Mar-7th/StarRailRes、現有 `JSONManager`、現有 Canvas profile renderer。

---

## 已確認的資料責任

| 資料 | 來源 | 備註 |
|---|---|---|
| UID、暱稱、開拓等級、均衡等級、頭像 ID | Enka `detailInfo` | 單次 UID API 回傳 |
| 成就數、角色數 | Enka `detailInfo.recordInfo` | 隱私設定未公開時允許缺省 |
| 展示角色、等級、星魂、光錐、遺器、行跡原始值 | Enka `detailInfo.avatarDetailList` | 公開查詢只能取得玩家展示角色，不宣稱是完整角色庫 |
| 角色、光錐、遺器名稱及圖示 | StarRailRes `index_new/{locale}` | 指令期間讀本地快取，不逐項打 GitHub |
| 角色／光錐升階數值 | StarRailRes promotion tables | 用於還原角色面板屬性 |
| 遺器主副詞條名稱與數值定義 | StarRailRes affix tables + Enka `_flat.props` | `_flat.props` 優先作為實際值 |
| 星魂與行跡名稱／圖示 | StarRailRes rank、skill、skill-tree tables | Enka 提供已解鎖狀態與等級 |
| 角色、命途、屬性與皮膚圖片 | StarRailRes 優先，Enka UI CDN fallback | 皮膚或 StarRailRes 尚未同步時才使用 Enka UI 圖片 |
| 近期活動資訊 | 移除 | Enka 沒有 Mihomo `/sr_activity` 的等價資料，禁止保留 Mihomo fallback |

## 核心限制

1. `https://api.mihomo.me/*` 必須完全消失。
2. 原始碼中的 `mihomo` 命名、註解及常數也一併清理，避免保留錯誤語意。
3. Enka 每次 UID 查詢只允許一個 HTTP request；角色清單與角色詳細頁共用 TTL cache／single-flight。
4. StarRailRes JSON 不得在每次指令執行時重新下載；由 `JSONManager` 本地優先、24 小時更新。
5. 公開 UID 流程只能顯示 Enka 回傳的展示角色。
6. 條件式光錐被動不加入靜態面板值；只計算角色基礎值、光錐基礎值、行跡常駐屬性與遺器明確屬性。
7. 一般 HoYoLAB 指令不得用 `daily.info()` 作通用驗證；綁定流程、自動簽到與 `/daily` 本身可使用 daily API，因為這些流程確實需要它。
8. 實作期間不得 `git reset` 現有未提交內容；只 stage 本計畫列出的檔案。
9. 不得自行重啟 PM2；測試只使用 build、Jest 與 dev process。啟動新的 `yarn dev` 前先關閉舊 dev process。

---

### Task 1: 建立 Enka fixture 與內部統一型別

**Objective:** 先固定 Enka 原始資料與 renderer 需要的 canonical `PlayerData` contract，避免 adapter 繼續使用 `any`。

**Files:**
- Create: `src/types/enkaHsr.ts`
- Create: `src/types/hsrProfile.ts`
- Create: `tests/fixtures/enka-hsr-profile.json`
- Create: `tests/enkaAdapter.test.ts`
- Later modify: `src/utilities/hsr/profile.ts`
- Later modify: `src/events/selectMenu.ts`

**Step 1: 建立去識別化 fixture**

從真實 Enka 回傳保留以下結構，但將 UID、暱稱與簽名改成測試值：

```ts
interface EnkaHsrResponse {
  uid: string;
  ttl?: number;
  region?: string;
  detailInfo?: {
    uid?: number;
    nickname?: string;
    level?: number;
    worldLevel?: number;
    headIcon?: number;
    recordInfo?: {
      avatarCount?: number;
      achievementCount?: number;
    };
    avatarDetailList?: EnkaAvatarDetail[];
  };
  message?: string;
}
```

Fixture 至少包含：一名角色、一個光錐、4 件洞穴遺器、2 件位面飾品、主副詞條、行跡、星魂，以及一個無資料／隱私關閉案例。

**Step 2: 定義 canonical profile 型別**

將 `profile.ts` 與 `events/selectMenu.ts` 重複的 `PlayerData`、`Character`、`Relic`、`LightCone`、`SkillTree` 移至 `src/types/hsrProfile.ts`。保留 renderer 現在真正讀取的欄位，不增加未使用的抽象層。

**Step 3: 寫失敗測試**

```ts
it("converts Enka player identity and displayed characters", async () => {
  const result = await adaptEnkaProfile(fixture, resources, "tw");
  expect(result.player.uid).toBe("800000001");
  expect(result.player.nickname).toBe("測試玩家");
  expect(result.characters).toHaveLength(1);
});
```

**Step 4: 驗證測試先失敗**

Run:

```bash
yarn jest tests/enkaAdapter.test.ts --runInBand
```

Expected: FAIL，因為 adapter 尚未建立。

**Step 5: Commit**

```bash
git add src/types/enkaHsr.ts src/types/hsrProfile.ts tests/fixtures/enka-hsr-profile.json tests/enkaAdapter.test.ts
git commit -m "test: define Enka HSR profile contract"
```

---

### Task 2: 建立 StarRailRes 本地資源 repository

**Objective:** 集中管理 Enka adapter 所需的 StarRailRes 表格，指令執行期間只讀記憶體／本地快取。

**Files:**
- Modify: `src/utilities/hsr/jsonManager.ts`
- Create: `src/utilities/hsr/starRailRes.ts`
- Create: `tests/starRailRes.test.ts`
- Runtime/cache files: `src/assets/data/starrailres_*.json`

**Step 1: 新增必要的 StarRailRes configs**

加入以下 `index_new` 資料集：

```text
characters
character_promotions
character_ranks
character_skills
character_skill_trees
light_cones
light_cone_promotions
relics
relic_sets
relic_main_affixes
relic_sub_affixes
properties
paths
elements
avatars
```

名稱相關表依 `cht`／`cn`／`en` 分開；純數值表只保存一份。所有 URL 以：

```text
https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/{locale}/{file}.json
```

為準。

**Step 2: 寫 repository 測試**

測試內容：

- `getCharacter("1502", "tw")` 能回傳名稱、稀有度、命途、元素、portrait。
- `getLightCone("21064", "tw")` 能回傳名稱與 icon。
- `getRelic("61301", "tw")` 能回傳名稱、稀有度、icon、main/sub affix table ID。
- 同一資源連續載入不會再次讀遠端。
- 遠端更新失敗時仍使用既有本地檔。

**Step 3: 建立一次性載入 API**

```ts
export async function loadStarRailRes(
  locale: "tw" | "cn" | "en"
): Promise<StarRailResBundle>;
```

`StarRailResBundle` 直接提供 map lookup，不讓 adapter 自己拼 URL 或重複讀檔。

**Step 4: 執行測試**

```bash
yarn jest tests/starRailRes.test.ts --runInBand
```

Expected: PASS，且第二次 lookup 無額外 HTTP request。

**Step 5: Commit**

```bash
git add src/utilities/hsr/jsonManager.ts src/utilities/hsr/starRailRes.ts tests/starRailRes.test.ts src/assets/data/starrailres_*.json
git commit -m "feat: add cached StarRailRes profile resources"
```

---

### Task 3: 建立單一 Enka client、TTL cache 與錯誤分類

**Objective:** 每個 UID 在有效 TTL 內只向 Enka 發出一次請求，並將錯誤轉成 bot 可判斷的固定類型。

**Files:**
- Replace/refactor: `src/utilities/hsr/playerData.ts`
- Modify: `src/utilities/index.ts`
- Create: `tests/enkaClient.test.ts`

**Step 1: 寫 client 測試**

Mock axios，涵蓋：

- 200 正常資料。
- Enka body 回傳 `ttl: 60` 時，60 秒內第二次呼叫命中 cache。
- 同 UID 兩個同時請求只產生一個 axios promise（single-flight）。
- 9 位數格式錯誤。
- 玩家不存在。
- 展示資料隱藏／沒有 `avatarDetailList`。
- HTTP 429。
- timeout／5xx。

**Step 2: 建立固定 error contract**

```ts
type EnkaErrorCode =
  | "INVALID_UID"
  | "PLAYER_NOT_FOUND"
  | "PROFILE_PRIVATE"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_RESPONSE";

interface EnkaPlayerResult {
  status: number;
  data?: EnkaHsrResponse;
  error?: { code: EnkaErrorCode; message: string };
}
```

**Step 3: 實作 request 與 cache**

```ts
const ENKA_HSR_URL = "https://enka.network/api/hsr/uid";
const inflight = new Map<string, Promise<EnkaPlayerResult>>();
const cache = new Map<string, { expiresAt: number; value: EnkaPlayerResult }>();
```

- axios timeout：15 秒。
- TTL 使用 Enka 回傳值，設合理下限／上限，避免 0 秒或異常長 cache。
- 不 `console.log(response.data)`，避免把玩家資料灌進 log。
- 不帶 Mihomo 的 `lang` query；語系由 StarRailRes adapter 處理。

**Step 4: 執行測試**

```bash
yarn jest tests/enkaClient.test.ts --runInBand
```

Expected: PASS，並驗證相同 UID 的 axios 呼叫次數為 1。

**Step 5: Commit**

```bash
git add src/utilities/hsr/playerData.ts src/utilities/index.ts tests/enkaClient.test.ts
git commit -m "feat: add cached Enka HSR client"
```

---

### Task 4: 實作玩家、角色與圖片 adapter

**Objective:** 將 Enka 玩家身分及展示角色骨架轉換成 canonical `PlayerData`，所有名稱與一般圖片使用 StarRailRes。

**Files:**
- Create: `src/utilities/hsr/enkaAdapter.ts`
- Modify: `tests/enkaAdapter.test.ts`

**Step 1: 補齊失敗測試**

驗證：

- `detailInfo.headIcon` 經 `avatars.json` 轉成 `icon/avatar/...png`。
- `recordInfo.avatarCount` → `space_info.avatar_count`。
- `recordInfo.achievementCount` → `space_info.achievement_count`。
- `avatarId` → 多語系角色名稱、稀有度、元素、命途、portrait／preview。
- `rank` → 星魂等級。
- `character_ranks.json` → 六個 `rank_icons`。
- StarRailRes 缺少新角色時不整張失敗：名稱退回角色 ID、圖片退回 Enka UI URL，並輸出一次警告。

**Step 2: 實作純函式 adapter**

```ts
export function adaptEnkaProfile(
  raw: EnkaHsrResponse,
  resources: StarRailResBundle
): PlayerData;
```

adapter 不自行打 HTTP，確保 fixture 可以完整測試。

**Step 3: 圖片優先順序**

1. StarRailRes local/remote path。
2. 現有本地 character portrait cache。
3. Enka UI CDN fallback（皮膚或 StarRailRes 尚未同步）。
4. 無圖片 placeholder；不得 throw 導致整個 profile 失敗。

**Step 4: 執行測試**

```bash
yarn jest tests/enkaAdapter.test.ts --runInBand
```

Expected: 玩家與角色基本欄位全部 PASS。

**Step 5: Commit**

```bash
git add src/utilities/hsr/enkaAdapter.ts tests/enkaAdapter.test.ts
git commit -m "feat: adapt Enka HSR player profiles"
```

---

### Task 5: 實作光錐、遺器、行跡與面板屬性轉換

**Objective:** 讓公開 UID 路徑的角色詳細卡、遺器評分與排行榜繼續使用完整資料，而不是只顯示角色名稱。

**Files:**
- Modify: `src/utilities/hsr/enkaAdapter.ts`
- Modify: `tests/enkaAdapter.test.ts`
- Verify compatibility: `src/utilities/hsr/relics.ts`
- Verify compatibility: `src/utilities/hsr/profile.ts`

**Step 1: 光錐測試與 mapping**

Enka：

```text
equipment.tid / level / promotion / rank / _flat.props
```

轉成：

```text
character.light_cone.id / name / level / rank / icon
```

名稱與 icon 取 StarRailRes，基礎 HP／ATK／DEF 使用 Enka `_flat.props`；若 `_flat` 缺失，才由 `light_cone_promotions` 計算：

```ts
value = promotionValue.base + promotionValue.step * (level - 1);
```

**Step 2: 遺器測試與 mapping**

- `tid` 查 `relics.json` 取得名稱、稀有度、icon、set ID。
- slot 1–4 → `relics`；slot 5–6 → `ornaments`。
- `mainAffixId` 與第一個 `_flat.props` 產生 `main_affix`。
- `subAffixList` 與後續 `_flat.props` 依序產生 `sub_affix`。
- `cnt`、`step` 原樣保存，讓現有 SRS 評分使用真實強化次數。
- property name、icon、是否百分比由 StarRailRes `properties.json` 統一格式化。

**Step 3: 行跡與技能測試**

- Enka `skillTreeList.pointId/level` 查 `character_skill_trees.json`。
- 產生 `skill_trees`：id、level、anchor、max_level、icon、啟用狀態。
- 由 `level_up_skills` 查 `character_skills.json` 產生主技能顯示資料。
- 記憶命途、歡愉與憶靈節點不能因固定四技能假設而消失。

**Step 4: 面板屬性測試**

建立可人工驗算的小型 fixture，分別驗證：

- 角色基礎 HP／ATK／DEF／SPD。
- 光錐基礎值。
- 遺器固定值與百分比值。
- 已啟用行跡常駐屬性。
- CRIT Rate／CRIT DMG 初始值。
- 百分比顯示格式。

聚合順序：

```text
base = character base + light-cone base
flat = relic/trace flat delta
affix ratio = relic/trace added ratio
final HP/ATK/DEF = base * (1 + ratio) + flat
final SPD = base SPD * (1 + SPD ratio) + SPD flat
其他比例屬性 = character default + trace + relic
```

不計算需要戰鬥條件才生效的光錐被動。

**Step 5: 遺器評分相容測試**

adapter 產生的角色交給現有 `getRelicsScore()`／`saveLeaderboard()`，確認：

- 不 throw。
- 六件遺器都可顯示。
- 主詞條權重可讀。
- 副詞條 `count`／`step` 不被捏造。

**Step 6: 執行測試**

```bash
yarn jest tests/enkaAdapter.test.ts --runInBand
```

Expected: identity、裝備、行跡、屬性、遺器評分全部 PASS。

**Step 7: Commit**

```bash
git add src/utilities/hsr/enkaAdapter.ts tests/enkaAdapter.test.ts
git commit -m "feat: map Enka HSR builds with StarRailRes"
```

---

### Task 6: 將 profile 與角色選單完全切換到 Enka

**Objective:** 公開 UID 的個人簡介、角色清單、角色詳細頁與排行榜全部使用 Enka adapter，並移除 activity 流程。

**Files:**
- Modify: `src/utilities/hsr/profile.ts`
- Modify: `src/events/selectMenu.ts`
- Modify: `src/utilities/index.ts`
- Modify: `src/utilities/hsr/playerData.ts`
- Modify: `src/types/hsrProfile.ts`
- Create: `tests/profileDataSource.test.ts`

**Step 1: 寫資料來源整合測試**

Mock Enka client 與 StarRailRes repository，驗證：

- 未綁定 UID 使用 Enka adapter。
- 綁定帳號且 `allcharacters=true` 仍優先使用 HoYoLAB。
- 綁定 Cookie 無法使用時 fallback 到 Enka，而不是任何 Mihomo endpoint。
- profile 初頁與點選角色詳細頁共用 Enka cache。
- Enka 沒有展示角色時回傳「請在遊戲內公開展示角色」的可理解訊息。

**Step 2: 修改公開 profile 分支**

用單一函式取代目前兩次 request：

```ts
const result = await getEnkaPlayerData(uid, locale);
```

刪除：

```ts
requestPlayerActivity(...)
PlayerActivityResponse
reqPlayerActivityStatus
```

**Step 3: 移除近期活動區塊**

- `drawMainImage()` 不再接收 `playerActivity`。
- 刪除活動 icon 預載與活動列繪圖。
- 調整下方角色區塊位置，避免留下空白。
- HoYoLAB 與 Enka profile 使用同一主畫面 layout。

**Step 4: 清理 Mihomo 語意**

以下名稱／註解改成中性或 StarRailRes：

```text
MIHOMO_CDN_BASE -> STAR_RAIL_RES_BASE
“mihomo path” -> “StarRailRes relative path”
“UID (mihomo) path” -> “public UID path”
```

刪除已不再需要的 `languageParam()`，語系只傳給 adapter／StarRailRes。

**Step 5: 執行測試**

```bash
yarn jest tests/profileDataSource.test.ts tests/enkaAdapter.test.ts --runInBand
```

Expected: PASS；mock 斷言中不存在 Mihomo request。

**Step 6: Commit**

```bash
git add src/utilities/hsr/profile.ts src/events/selectMenu.ts src/utilities/index.ts src/utilities/hsr/playerData.ts src/types/hsrProfile.ts tests/profileDataSource.test.ts
git commit -m "refactor: replace Mihomo profile flow with Enka"
```

---

### Task 7: 移除一般指令前的 `daily.info()` 驗證

**Objective:** 建立 HoYoLAB client 時不發出任何 API request；每個流程只執行它真正需要的 endpoint，且保留 auth refresh/retry 能力。

**Files:**
- Modify: `src/utilities/index.ts`
- Modify all `getUserHSRData()` callers:
  - `src/handlers/selectMenu/forgottenHall.ts`
  - `src/commands/slash/hsr/forgottenHall.ts`
  - `src/commands/slash/hsr/automimo.ts`
  - `src/events/selectMenu.ts`
  - `src/utilities/hsr/profile.ts`
  - `src/commands/slash/hsr/daily.ts`
  - `src/commands/slash/hsr/note.ts`
- Preserve intentional daily calls:
  - `src/events/modal.ts`
  - `src/commands/message/bind.ts`
  - `src/utilities/hsr/autoDaily.ts`
- Create: `tests/getUserHSRData.test.ts`

**Step 1: 寫 request-count 失敗測試**

驗證：

- 建立 HSR client 時 `daily.info()` 呼叫次數為 0。
- profile 只呼叫 `record.records()`／`record.characters()`。
- note 只呼叫 note 所需 API。
- forgotten hall 只呼叫對應 record/challenge API。
- `/daily` 的 `daily.info()` 只呼叫一次，不再「驗證一次 + 實際讀取一次」。
- auth error 時刷新 Cookie，重建 client，重試原本的 API operation，而不是改打 daily API。

**Step 2: 將 client 建立與 operation retry 分離**

建議 contract：

```ts
export async function getUserHSRData(...): Promise<HonkaiStarRail | null>;

export async function withUserHSRRequest<T>(
  context: UserHsrContext,
  operation: (hsr: HonkaiStarRail) => Promise<T>
): Promise<T | null>;
```

- `getUserHSRData()` 只讀帳號、Cookie、UID、語言並建立 client。
- `withUserHSRRequest()` 捕捉 auth error，執行現有 `autoRefreshCookie()`，然後只重試原本 operation 一次。
- 移除 `validationType: "record" | "daily" | "none"`，避免未來又變成隱藏 request。

**Step 3: `/daily` 去除重複 info request**

原本：

```text
getUserHSRData(validation=daily) -> daily.info()
execute -> daily.info() again
```

改成：

```text
getUserHSRData() -> no request
execute -> daily.info() once
```

`reward()`、`rewards()`、`claim()` 是 `/daily` 本身需要的請求，不算額外驗證。

**Step 4: 保留真正需要 daily 的流程**

- 綁定帳號時確認 Cookie 具有簽到能力：保留。
- `autoDaily`：保留。
- `/daily`：保留單次實際 `daily.info()`。
- 其他指令：不得出現 `daily.info()`。

**Step 5: 執行測試**

```bash
yarn jest tests/getUserHSRData.test.ts --runInBand
```

Expected: 所有 request-count 斷言 PASS。

**Step 6: Commit**

```bash
git add src/utilities/index.ts src/handlers/selectMenu/forgottenHall.ts src/commands/slash/hsr/forgottenHall.ts src/commands/slash/hsr/automimo.ts src/events/selectMenu.ts src/utilities/hsr/profile.ts src/commands/slash/hsr/daily.ts src/commands/slash/hsr/note.ts tests/getUserHSRData.test.ts
git commit -m "refactor: remove implicit daily API validation"
```

---

### Task 8: 完整清理、build、live smoke test 與視覺驗收

**Objective:** 證明 Mihomo 已完全移除、Enka adapter 可繪圖、沒有增加多餘 API 請求，且不影響既有 HoYoLAB 路徑。

**Files:**
- Modify as needed: translation JSON under `src/assets/i18n/` or current locale files
- Verify: all files under `src/`
- Verify: all tests under `tests/`

**Step 1: 靜態清理檢查**

Run:

```bash
rg -ni 'api\.mihomo\.me|sr_info_parsed|sr_activity|mihomo' src tests
```

Expected: 0 matches。

Run:

```bash
rg -n 'daily\.info\(' src
```

Expected: 只剩綁定、`/daily`、`autoDaily` 等確實需要 daily 的位置；一般 profile／note／forgotten hall 等不可出現。

**Step 2: 完整測試**

```bash
yarn test --runInBand
```

Expected: 全部 PASS。

**Step 3: Lint 與 build**

```bash
yarn lint
yarn build
```

Expected: exit code 0；沒有新增 TypeScript／ESLint error。

**Step 4: Enka live smoke test**

以一個已公開展示角色的 UID 呼叫 Enka：

- HTTP 200。
- adapter 回傳玩家與至少一名角色。
- 同 UID 立即第二次請求命中 cache。
- log 不輸出完整 Enka response。

Live API 只驗證連線；欄位正確性仍以 fixture test 為準，避免上游暫時故障造成測試不穩定。

**Step 5: Canvas 視覺驗收**

產出並人工檢查：

1. 公開 UID 個人簡介主圖。
2. 公開 UID 角色詳細圖。
3. 有 6 件遺器與光錐的角色。
4. 無光錐／遺器未滿的角色。
5. 記憶命途／憶靈角色。
6. 使用角色皮膚的角色。
7. 綁定 HoYoLAB 的完整角色路徑。

必查項目：繁中名稱、頭像、角色圖、元素／命途、星魂、屬性、光錐、六件遺器、主副詞條、行跡、排行榜分數，不可出現 `undefined`、hash 名稱或破圖。

**Step 6: dev 驗證**

先找出並關閉既有 HSR `yarn dev` process，再執行：

```bash
yarn dev
```

實際測試 `/profile`：

- 未綁定 UID。
- 已綁定預設完整角色。
- 已綁定但公開 UID 模式。
- Enka 不存在 UID。
- Enka rate-limit／timeout 的友善錯誤。

測試完成後關閉 dev process。不得重啟 PM2。

**Step 7: 最終 diff 檢查**

```bash
git status --short
git diff --check
git diff --stat
```

確認沒有 stage 使用者原本的無關修改、沒有 `.env`、DB、log 或生成圖檔。

**Step 8: Final commit（若前面尚未逐 task commit）**

```bash
git add <only migration files>
git commit -m "feat: migrate HSR profiles to Enka and StarRailRes"
```

---

## 完成定義（Definition of Done）

- [ ] `src/` 與 `tests/` 中找不到 Mihomo URL、endpoint、常數或註解。
- [ ] 公開 UID profile 只發出一個 Enka request，後續角色選單命中 TTL cache。
- [ ] StarRailRes 在指令期間不重複下載，資源缺失有 Enka UI fallback。
- [ ] 公開 UID 的主圖、角色圖、遺器評分與排行榜可正常使用。
- [ ] 公開 UID 不再顯示「近期活動」區塊。
- [ ] 一般 HoYoLAB 指令不會預先呼叫 `daily.info()`。
- [ ] `/daily` 僅執行一次 `daily.info()`。
- [ ] Cookie auth refresh 重試的是原本 operation，不借用 daily API 驗證。
- [ ] Fixture tests、完整 Jest、lint、build 全數通過。
- [ ] 已用 `yarn dev` 實測，但未重啟 PM2。

## 預期行為差異

1. 未綁定使用者可恢復查看公開 profile，但只看到遊戲內展示角色。
2. 「近期活動」會消失，因為 Enka 沒有可替代來源；這是刻意移除，不是資料載入失敗。
3. 新角色若 Enka 已支援但 StarRailRes 尚未同步，仍可顯示基本資料與 Enka 圖片 fallback，但名稱可能暫時退回 ID；log 應有一次明確警告。
4. 一般 HoYoLAB 指令會少一次 `daily.info()` request；`/daily` 也不再重複呼叫 info。
