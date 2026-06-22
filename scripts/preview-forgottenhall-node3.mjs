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
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`<${k}>`, String(v));
  }
  return text;
};

const response = {
  groups: [{
    schedule_id: 2024,
    begin_time: { year: 2026, month: 6, day: 22, hour: 4, minute: 0 },
    end_time: { year: 2026, month: 8, day: 3, hour: 4, minute: 0 },
    status: 'New',
    name_mi18n: '借虛成真',
    upper_boss: null,
    lower_boss: null,
    tierce_boss: null
  }],
  star_num: 12,
  max_floor: '借虛成真其四',
  battle_num: 2,
  has_data: true,
  all_floor_detail: [{
    name: '借虛成真其四星啟模式',
    round_num: 3,
    star_num: 4,
    node_1: {
      challenge_time: { year: 2026, month: 6, day: 22, hour: 12, minute: 53 },
      avatars: [
        { id: 1408, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/7d318b257430358b04e719a6714d86c0.png', rarity: 5, element: 'physical', rank: 2 },
        { id: 1313, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/25dbbbc5878d215e01fff773534ace25.png', rarity: 5, element: 'imaginary', rank: 0 },
        { id: 1412, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/bf3901934e9210717a46c6a69155d9a5.png', rarity: 5, element: 'wind', rank: 1 },
        { id: 1403, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/6d4c07fa8602822f99052f797de4d017.png', rarity: 5, element: 'quantum', rank: 1 }
      ],
      buff: { id: 3031359, name_mi18n: '觸技', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/17ead63f4a340f80614bca8fcbb37f20.png' },
      score: '40000'
    },
    node_2: {
      challenge_time: { year: 2026, month: 6, day: 22, hour: 12, minute: 59 },
      avatars: [
        { id: 1409, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/4459630552fa374281787a9e8b8153ce.png', rarity: 5, element: 'wind', rank: 1 },
        { id: 1415, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/a880fd7c3d35c8254d508e224dae2004.png', rarity: 5, element: 'ice', rank: 2 },
        { id: 1407, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/0b80e2c12cbad2bc96cd8d9b6f76b95a.png', rarity: 5, element: 'quantum', rank: 3 },
        { id: 1413, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/4afcdb24ffbb3dd954617ba4318b0639.png', rarity: 5, element: 'ice', rank: 0 }
      ],
      buff: { id: 3031361, name_mi18n: '變奏', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/9a6ff8d1e1a98caca090b27f87c7ba1c.png' },
      score: '40000'
    },
    maze_id: 20244,
    is_fast: false,
    node_3: {
      challenge_time: { year: 2026, month: 6, day: 22, hour: 13, minute: 4 },
      avatars: [
        { id: 1506, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/9edeaad1b283a01d5e3b85b362eeac2d.png', rarity: 5, element: 'imaginary', rank: 6 },
        { id: 1414, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/d4643f6b758c03ac5bbb1c9ee28b4f4e.png', rarity: 5, element: 'physical', rank: 0 },
        { id: 1501, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/5ee74ada4c2cc11d91b6ee7b92f5104f.png', rarity: 5, element: 'fire', rank: 0 },
        { id: 1502, level: 80, icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/4f824e1ae55486d99dc94371a602ee6e.png', rarity: 5, element: 'physical', rank: 1 }
      ],
      buff: { id: 3031362, name_mi18n: '笑韻', icon: 'https://act-webstatic.hoyoverse.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0a0ae/d94f35a18b2980df167975faf7419598.png' },
      score: '40000'
    },
    extra_star_num: 1,
    is_tierce: true
  }],
  max_floor_id: 20244,
  extra_star_num: 1
};

const floor3 = response.all_floor_detail[0];
const floor2 = structuredClone(floor3);
delete floor2.node_3;
floor2.star_num = 3;
delete floor2.extra_star_num;

const out3 = await drawForgottenHallImage(tr, '809279679', response, 2, floor3);
if (!out3) throw new Error('Failed to render 3-team preview');
await fs.writeFile('./preview-pure-fiction-3team.webp', out3);

const response2 = structuredClone(response);
response2.all_floor_detail[0] = floor2;
response2.extra_star_num = 0;
const out2 = await drawForgottenHallImage(tr, '809279679', response2, 2, floor2);
if (!out2) throw new Error('Failed to render 2-team preview');
await fs.writeFile('./preview-pure-fiction-2team.webp', out2);

console.log(JSON.stringify({ created: ['preview-pure-fiction-3team.webp', 'preview-pure-fiction-2team.webp'] }, null, 2));
