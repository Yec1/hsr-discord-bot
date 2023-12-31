<a href="https://forum.gamer.com.tw/C.php?bsn=72822&snA=3548&subbsn=0&page=1&s_author=&gothis=29007#29007">
    <img src="https://cdn.discordapp.com/avatars/895191125512581171/57c74708ddaf7991500ce26e52335d27.webp" alt="hsr logo" title="hsr" align="right" height="128" />
</a>

# 星穹鐵道 Discord Bot

:star: 在GitHub上給我們點星星吧 — 這會給予我們很大的動力！

你可以自由的將本專案進行更改，只需在 網站/或任何形式的公開文件 中放入原機器人及原作者網址

You are free to make changes to this project, just include the original bot and original author's URL in the website or any form of public documentation.

## 連結
* <a href="https://discord.com/api/oauth2/authorize?client_id=895191125512581171&permissions=412317240384&scope=applications.commands bot">邀請連結</a>
* <a href="https://discordservers.tw/bots/895191125512581171"><b>DiscordTW</b></a>
* <a href="https://discord.gg/mPCEATJDve"><b>支援伺服器</b></a>

## 使用 星鐵小助手 可以讓您快速在Discord 上使用
* <b>UID 查詢玩家個人資料</b>：查看放置在漫遊簽證上角色的 <b>儀器</b>、<b>行跡</b>和<b>光錐</b>等級
* <b>每日自動簽到
* <b>每小時自動偵測體力和委託狀態</b>：若體力<b>大於 0 ~ 240</b> 時或者 <b>委託完成 </b>時會自動通知
* <b>獲取當期的躍遷紀錄
* <b>模擬每個版本的限定躍遷</b>：目前可模擬版本為 <b>1.0.0 ~ 2.0.1</b> (更新時間 2023/12/27)
* <b>兌換禮包碼
* <b>忘卻之庭紀錄</b>：可以查詢自己或別人的混沌回憶每層樓紀錄
* <b>排行榜</b>：可以列出每位角色遺器評分前十名
* <b>指南</b>：查看各角色配配隊等

## Cookie 使用須知
當您使用星鐵小助手的自動簽到、自動通知、角色總覽、忘卻之庭紀錄功能時會需要 Hoyolab 帳號的 Cookie，當您設置 Cookie 後代表您已同意機器人使用 Cookie 來為您提供服務，星鐵小助手保證不會以提供服務以外的情況下使用 Cookie。
### 以下幾點關於 Cookie 的說明
* Cookie 不能夠登入您的遊戲帳號
* Cookie 只能夠幫您獲取遊戲上的資料，例如：便籤、忘卻之庭、簽到、角色等
* 您隨時能使用指令來刪除儲存在星鐵小助手的 Cookie

## 展示
<img src="https://cdn.discordapp.com/attachments/1148490547523235871/1186544299500912721/809279679.png">
<img src="https://cdn.discordapp.com/attachments/1149960935654559835/1187405599298826371/809279679.png">
<img src="https://cdn.discordapp.com/attachments/1149960935654559835/1187405728873447434/image.png">
<img src="https://cdn.discordapp.com/attachments/1149960935654559835/1187405852743839875/image.png">
<img src="https://cdn.discordapp.com/attachments/1149960935654559835/1187406129182015528/726e55d5ba1fc5ed.png">
<img src="https://cdn.discordapp.com/attachments/1148490547523235871/1187385711343710300/a30fdb3ca5446ff0.png">

## Installation 自己架設機器人

- [Node.js](https://nodejs.org/) 16 or higher
- [npm](https://www.npmjs.com/)

```bash
# Clone this repo.
git clone https://github.com/Yec1/HSRre.git

# Enter the repository.
cd HSRre

# Install dependencies.
npm install / yarn install

# Build Package
cd node_modules/hoyoapi
npm install / yarn install
npm run build / yarn build
```

## Usage

```bash
# Fill env & emoji - If you don't need it, you can delete it
Rename .env.example to .env and fill your bot token.

# Start Bot
node . or node ./src/Cluster.js
```

## References

* [StarRailRes](https://github.com/Mar-7th/StarRailRes)
* [StarRailScore](https://github.com/Mar-7th/StarRailScore)
* [star-rail-warp-sim](https://github.com/mikeli0623/star-rail-warp-sim)
* [mihomo](https://api.mihomo.me/)
