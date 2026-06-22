import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import langs from '../dist/assets/languages/tw.js';

const modulePath = './dist/utilities/hsr/forgottenhall.js';
const patchedModulePath = './dist/utilities/hsr/forgottenhall.preview.mjs';

const source = await fs.readFile(modulePath, 'utf8');
const patched = source
  .replace('import { drawInQueueReply } from "../../utilities/index.js";', 'const drawInQueueReply = async (_interaction, fn) => await fn();')
  .replace('import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";', 'class EmbedBuilder {}\nclass AttachmentBuilder {}\nclass ActionRowBuilder {}\nclass StringSelectMenuBuilder {}')
  .replace('import { database } from "../../index.js";', 'const database = {};');
await fs.writeFile(patchedModulePath, patched);

const { drawForgottenHallImage } = await import(pathToFileURL(process.cwd() + '/dist/utilities/hsr/forgottenhall.preview.mjs').href);

const tr = (key, params = {}) => {
  let text = langs[key] ?? key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll(`<${k}>`, String(v));
  return text;
};

const response = {
  groups: [{
    schedule_id: 2029,
    begin_time: { year: 2026, month: 6, day: 1, hour: 4, minute: 0 },
    end_time: { year: 2026, month: 7, day: 13, hour: 4, minute: 0 },
    status: 'New',
    name_mi18n: '逐忘之潮',
    upper_boss: { name_mi18n: '進潮信潮的裁定者', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/c0e17d4c3044846eb8d8c3ea8e17d0c6.png' },
    lower_boss: { name_mi18n: '無垠列風的幻滅者', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/83c145f72f4bd1b7ee7f1290b8f3df13.png' },
    tierce_boss: { name_mi18n: '末日峽途的盜火者', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/28fdf4794660ac7737c5eb9406c7fd94.png' }
  }],
  star_num: 12,
  max_floor: '逐忘列風·難度04',
  battle_num: 2,
  has_data: true,
  all_floor_detail: [{
    name: '遺忘列風·難度04星啟模式',
    round_num: 3,
    star_num: 4,
    extra_star_num: 1,
    node_1: {
      challenge_time: { year: 2026, month: 6, day: 8, hour: 5, minute: 48 },
      avatars: [
        { id: 1407, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/0b80e2c12cbad2bc96cd8d9b6f76b95a.png', rarity: 5, element: 'quantum', rank: 6 },
        { id: 1211, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/b868f8ab4d0ca47acde703f8106dd345.png', rarity: 5, element: 'imaginary', rank: 0 },
        { id: 1404, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/cf42944f8f91cdef5360cb0dca81f04d.png', rarity: 5, element: 'fire', rank: 0 },
        { id: 1406, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/4d3c3dd08e1ecfe2c2f1f1e48890d1bb.png', rarity: 5, element: 'ice', rank: 1 }
      ],
      buff: { id: 1, name_mi18n: '論為笑談', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/d94f35a18b2980df167975faf7419598.png' },
      score: '3788'
    },
    node_2: {
      challenge_time: { year: 2026, month: 6, day: 8, hour: 5, minute: 50 },
      avatars: [
        { id: 1218, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/5f49fcbf7bf2c71d2eeb0eb3a4f5495a.png', rarity: 5, element: 'ice', rank: 2 },
        { id: 1409, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/4459630552fa374281787a9e8b8153ce.png', rarity: 5, element: 'wind', rank: 1 },
        { id: 1314, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/eefcc31bfc92f3c0f5aecadcb0fef6af.png', rarity: 5, element: 'ice', rank: 0 },
        { id: 1305, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/c36e93ed4fe15a7f09500d08c2401c4f.png', rarity: 4, element: 'fire', rank: 4 }
      ],
      buff: { id: 2, name_mi18n: '披堅執銳', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/9a6ff8d1e1a98caca090b27f87c7ba1c.png' },
      score: '3841'
    },
    node_3: {
      challenge_time: { year: 2026, month: 6, day: 8, hour: 5, minute: 55 },
      avatars: [
        { id: 1402, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/3c36d64231ee863692fc56f2cd96fd7a.png', rarity: 5, element: 'wind', rank: 1 },
        { id: 1401, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/84df72846995f6b245df3eb640ba6a8a.png', rarity: 5, element: 'wind', rank: 2 },
        { id: 1208, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/c2bb45b4d6fd66914318e403d315f0d9.png', rarity: 5, element: 'quantum', rank: 0 },
        { id: 1221, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/8d3df7b8d4ef1e47c023919f56cf1e4a.png', rarity: 5, element: 'physical', rank: 0 }
      ],
      buff: { id: 3, name_mi18n: '難易銘心', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/17ead63f4a340f80614bca8fcbb37f20.png' },
      score: '3878'
    },
    maze_id: 20304,
    is_fast: false,
    is_tierce: true
  }],
  max_floor_id: 20304,
  extra_star_num: 1
};

const floor3 = response.all_floor_detail[0];
const floor2 = structuredClone(floor3);
delete floor2.node_3;
floor2.star_num = 3;
delete floor2.extra_star_num;

const out3 = await drawForgottenHallImage(tr, '809279679', response, 3, floor3);
if (!out3) throw new Error('Failed to render 3-team apocalyptic preview');
await fs.writeFile('./preview-apocalyptic-3team.webp', out3);

const response2 = structuredClone(response);
response2.all_floor_detail[0] = floor2;
response2.extra_star_num = 0;
response2.groups[0].tierce_boss = null;
const out2 = await drawForgottenHallImage(tr, '809279679', response2, 3, floor2);
if (!out2) throw new Error('Failed to render 2-team apocalyptic preview');
await fs.writeFile('./preview-apocalyptic-2team.webp', out2);

console.log(JSON.stringify({ created: ['preview-apocalyptic-3team.webp', 'preview-apocalyptic-2team.webp'] }, null, 2));
