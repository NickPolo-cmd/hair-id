#!/usr/bin/env node
/**
 * Бот Hair ID (@hairidspb_bot)
 *
 * Делает две вещи:
 *   1. Отвечает на вопросы по тематике студии — через OpenRouter, строго по знания.md.
 *   2. Собирает товары из темы «Товары» группы Hair ID в данные/товары.json,
 *      фотографии складывает в фото-товаров/.
 *
 * Ключи НИКОГДА не лежат в коде:
 *   Telegram   — ~/.claude/hairid-bot-key.json, поле TELEGRAM_BOT_TOKEN
 *   OpenRouter — ~/.claude-code-router/config.json, провайдер openrouter, поле api_key
 *   Оба пути можно переопределить переменными HAIRID_BOT_KEY / OPENROUTER_KEY.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.dirname(fileURLToPath(import.meta.url));  // кириллица в пути: pathname пришёл бы закодированным
const ДАННЫЕ = path.join(КОРЕНЬ, 'данные');
const ФОТО = path.join(КОРЕНЬ, 'фото-товаров');
const ФАЙЛ_ТОВАРОВ = path.join(ДАННЫЕ, 'товары.json');
const ФАЙЛ_СОСТОЯНИЯ = path.join(ДАННЫЕ, 'состояние.json');
const ФАЙЛ_ЗНАНИЙ = path.join(КОРЕНЬ, 'знания.md');
const ЖУРНАЛ = path.join(ДАННЫЕ, 'журнал.log');

const МОДЕЛЬ = process.env.HAIRID_MODEL || 'inclusionai/ling-3.0-flash-sante:free';
const ЗАПАСНЫЕ = ['nex-agi/nex-n2.5-pro:free', 'google/gemma-4-31b-it:free', 'nex-agi/nex-n2.5-mini:free'];
const ИМЯ_ТЕМЫ = 'Товары';

fs.mkdirSync(ДАННЫЕ, { recursive: true });
fs.mkdirSync(ФОТО, { recursive: true });

/* ---------- ключи ---------- */

function телеграмТокен() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const p = process.env.HAIRID_BOT_KEY || path.join(os.homedir(), '.claude', 'hairid-bot-key.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).TELEGRAM_BOT_TOKEN;
}

function ключОпенроутера() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const p = process.env.OPENROUTER_KEY || path.join(os.homedir(), '.claude-code-router', 'config.json');
  if (!fs.existsSync(p)) return null;
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  const пров = (c.Providers || c.providers || []).find(x => (x.name || '').toLowerCase() === 'openrouter');
  return пров ? пров.api_key : null;
}

const ТОКЕН = телеграмТокен();
const API = `https://api.telegram.org/bot${ТОКЕН}`;

/* ---------- мелочи ---------- */

const журнал = (...а) => {
  const с = `${new Date().toISOString()} ${а.join(' ')}`;
  console.log(с);
  try { fs.appendFileSync(ЖУРНАЛ, с + '\n'); } catch {}
};

const читать = (ф, поум) => {
  try { return JSON.parse(fs.readFileSync(ф, 'utf8')); } catch { return поум; }
};
const писать = (ф, о) => fs.writeFileSync(ф, JSON.stringify(о, null, 2));

async function вызов(метод, тело = {}) {
  const r = await fetch(`${API}/${метод}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(тело),
  });
  return r.json();
}

/* ---------- ответы через OpenRouter ---------- */

const КЛЮЧ_OR = ключОпенроутера();

async function спроситьМодель(вопрос, история) {
  if (!КЛЮЧ_OR) return null;
  const знания = fs.readFileSync(ФАЙЛ_ЗНАНИЙ, 'utf8');
  const системный = `Ты — помощник студии волос Hair ID. Отвечай по-русски, коротко и по делу:
две-три фразы, без списков, если человек не попросил список. Без markdown-разметки.

Отвечай ТОЛЬКО на основании справки ниже. Если в справке нет ответа — так и скажи и
предложи написать или позвонить Ирине по номеру 8 994 426-99-44. Ничего не выдумывай:
не называй точных цен без диагностики, не ставь диагноз, не обещай результат заочно,
не назначай время записи.

Ты не Ирина, ты её помощник. Говори «Ирина», а не «я» про работу мастера.

=== СПРАВКА ===
${знания}
=== КОНЕЦ СПРАВКИ ===`;

  const сообщения = [{ role: 'system', content: системный }, ...история, { role: 'user', content: вопрос }];

  for (const модель of [МОДЕЛЬ, ...ЗАПАСНЫЕ]) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${КЛЮЧ_OR}`,
          'HTTP-Referer': 'https://hairid.netlify.app',
          'X-Title': 'Hair ID bot',
        },
        body: JSON.stringify({ model: модель, messages: сообщения, max_tokens: 400, temperature: 0.4 }),
      });
      const j = await r.json();
      const текст = j?.choices?.[0]?.message?.content?.trim();
      if (текст) return текст;
      журнал('модель', модель, 'без ответа:', JSON.stringify(j).slice(0, 200));
    } catch (e) {
      журнал('модель', модель, 'ошибка:', e.message);
    }
  }
  return null;
}

/* ---------- сбор товаров ---------- */

function разобратьТовар(текст) {
  // Понимаем и «Имя — 1200 ₽», и построчный формат «Название: …\nЦена: …»
  const т = { название: '', бренд: '', объём: '', цена: null, описание: '', артикул: '' };
  const строки = текст.split('\n').map(s => s.trim()).filter(Boolean);

  for (const с of строки) {
    const m = с.match(/^([А-Яа-яЁёA-Za-z ]{3,20})\s*[:—-]\s*(.+)$/);
    if (m) {
      const поле = m[1].toLowerCase().trim(), знач = m[2].trim();
      if (/назв|товар|продукт/.test(поле)) { т.название ||= знач; continue; }
      if (/бренд|марк|производ/.test(поле)) { т.бренд ||= знач; continue; }
      if (/объ[её]м|вес|мл|грамм|фасов/.test(поле)) { т.объём ||= знач; continue; }
      if (/цен|стоим|прайс/.test(поле)) { т.цена ??= разобратьЦену(знач); continue; }
      if (/артикул|код|sku/.test(поле)) { т.артикул ||= знач; continue; }
      if (/опис|состав|для чего|примен/.test(поле)) { т.описание ||= знач; continue; }
    }
  }
  if (!т.название) т.название = строки[0] || '';
  if (т.цена == null) т.цена = разобратьЦену(текст);
  if (!т.объём) { const o = текст.match(/(\d[\d.,]*)\s*(мл|ml|г|гр|g|л|kg|кг)\b/i); if (o) т.объём = `${o[1]} ${o[2]}`; }
  т.описание ||= строки.slice(1).join(' ').slice(0, 500);
  return т;
}

function разобратьЦену(s) {
  const m = s.match(/(\d[\d\s.,]{1,10})\s*(?:₽|руб|р\.|rub)/i) || s.match(/(?:₽|руб)\s*(\d[\d\s.,]{1,10})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[\s.]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function скачатьФайл(file_id, префикс) {
  const f = await вызов('getFile', { file_id });
  if (!f.ok) return null;
  const ext = path.extname(f.result.file_path) || '.jpg';
  const имя = `${префикс}${ext}`;
  const buf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${ТОКЕН}/${f.result.file_path}`)).arrayBuffer());
  fs.writeFileSync(path.join(ФОТО, имя), buf);
  return имя;
}

async function сохранитьТовар(m) {
  const текст = m.text || m.caption || '';
  const естьФайл = !!(m.photo || (m.document && /^image\//.test(m.document.mime_type || '')));
  // Служебные сообщения — вход в группу, создание темы, закрепления — не товары.
  if (!текст.trim() && !естьФайл) return null;

  const товары = читать(ФАЙЛ_ТОВАРОВ, []);
  const альбом = m.media_group_id || null;

  // Фото одного альбома клеим к одной карточке
  let карточка = альбом ? товары.find(t => t.альбом === альбом) : null;
  if (!карточка) {
    карточка = {
      id: `t${String(товары.length + 1).padStart(3, '0')}`,
      альбом,
      ...разобратьТовар(текст),
      фото: [],
      исходныйТекст: текст,
      дата: new Date(m.date * 1000).toISOString(),
      сообщение: m.message_id,
    };
    товары.push(карточка);
  } else if (текст && !карточка.исходныйТекст) {
    Object.assign(карточка, разобратьТовар(текст), { исходныйТекст: текст });
  }

  const файл = m.photo ? m.photo.at(-1) : (m.document && /^image\//.test(m.document.mime_type || '') ? m.document : null);
  if (файл) {
    const имя = await скачатьФайл(файл.file_id, `${карточка.id}-${карточка.фото.length + 1}`);
    if (имя) карточка.фото.push(имя);
  }

  писать(ФАЙЛ_ТОВАРОВ, товары);
  журнал('товар сохранён:', карточка.id, карточка.название.slice(0, 40), '| фото:', карточка.фото.length);
  return товары.length;
}

/* ---------- обработка сообщений ---------- */

const истории = new Map();          // чат → последние реплики
const состояние = читать(ФАЙЛ_СОСТОЯНИЯ, { offset: 0, темаТоваров: null, группа: null });

function этоТемаТоваров(m) {
  const имя = m.reply_to_message?.forum_topic_created?.name;
  if (имя && имя.trim().toLowerCase() === ИМЯ_ТЕМЫ.toLowerCase()) {
    состояние.темаТоваров = m.message_thread_id;
    состояние.группа = m.chat.id;
    писать(ФАЙЛ_СОСТОЯНИЯ, состояние);
    return true;
  }
  return состояние.темаТоваров != null && m.message_thread_id === состояние.темаТоваров;
}

async function обработать(up) {
  const m = up.message || up.channel_post || up.edited_message;
  if (!m) return;

  const группа = m.chat.type === 'group' || m.chat.type === 'supergroup';

  if (группа && этоТемаТоваров(m)) {
    const всего = await сохранитьТовар(m);
    if (/^\/итог/.test(m.text || '')) {
      await вызов('sendMessage', { chat_id: m.chat.id, message_thread_id: m.message_thread_id,
        text: `Собрано товаров: ${всего}. Файл: bot/данные/товары.json` });
    }
    return;
  }

  // Пересылка в личку — это старые товары из группы: Telegram не отдаёт боту
  // историю, зато пересланное сообщение приходит целиком. Так владелец может
  // одним движением передать всё, что было написано до появления бота.
  const переслано = !!(m.forward_origin || m.forward_from || m.forward_from_chat || m.forward_sender_name);
  if (!группа && (переслано || (m.photo && m.caption))) {
    const всего = await сохранитьТовар(m);
    if (всего && !m.media_group_id) {
      await вызов('sendMessage', { chat_id: m.chat.id,
        text: 'Принял в базу товаров. Всего: ' + всего + '. Можно слать дальше — я отвечу на каждое.' });
    }
    return;
  }

  const текст = (m.text || '').trim();
  if (!текст) return;

  if (/^\/start/.test(текст)) {
    return вызов('sendMessage', { chat_id: m.chat.id, message_thread_id: m.message_thread_id,
      text: 'Здравствуйте! Я помощник студии Hair ID. Спросите про услуги, цены, уход или как доехать — отвечу по тому, что знаю о студии. Записывает Ирина: 8 994 426-99-44.' });
  }
  if (/^\/товары/.test(текст)) {
    const т = читать(ФАЙЛ_ТОВАРОВ, []);
    return вызов('sendMessage', { chat_id: m.chat.id, message_thread_id: m.message_thread_id,
      text: `В базе ${т.length} товаров. Тема «Товары»: ${состояние.темаТоваров ?? 'ещё не найдена'}.` });
  }

  // В группе отвечаем только на обращение к боту
  if (группа) {
    const кНам = /@hairidspb_bot/i.test(текст) || m.reply_to_message?.from?.is_bot;
    if (!кНам) return;
  }

  await вызов('sendChatAction', { chat_id: m.chat.id, action: 'typing' });

  const ключИстории = `${m.chat.id}:${m.message_thread_id || 0}`;
  const история = истории.get(ключИстории) || [];
  const ответ = await спроситьМодель(текст.replace(/@hairidspb_bot/gi, '').trim(), история);

  const итог = ответ || 'Сейчас не могу ответить — подводит сервис ответов. Напишите или позвоните Ирине: 8 994 426-99-44.';
  история.push({ role: 'user', content: текст }, { role: 'assistant', content: итог });
  истории.set(ключИстории, история.slice(-8));

  await вызов('sendMessage', { chat_id: m.chat.id, message_thread_id: m.message_thread_id, text: итог });
}

/* ---------- цикл ---------- */

async function главный() {
  const me = await вызов('getMe');
  if (!me.ok) { журнал('не удалось подключиться к Telegram:', JSON.stringify(me)); process.exit(1); }
  журнал('бот запущен:', me.result.username, '| ответы ИИ:', КЛЮЧ_OR ? 'включены' : 'ВЫКЛЮЧЕНЫ, нет ключа OpenRouter');

  for (;;) {
    try {
      const u = await вызов('getUpdates', { offset: состояние.offset, timeout: 50, limit: 50 });
      if (!u.ok) { журнал('getUpdates:', JSON.stringify(u).slice(0, 200)); await пауза(5000); continue; }
      for (const up of u.result) {
        состояние.offset = up.update_id + 1;
        try { await обработать(up); } catch (e) { журнал('ошибка обработки:', e.message); }
      }
      if (u.result.length) писать(ФАЙЛ_СОСТОЯНИЯ, состояние);
    } catch (e) {
      журнал('цикл:', e.message);
      await пауза(5000);
    }
  }
}

const пауза = ms => new Promise(r => setTimeout(r, ms));
главный();
