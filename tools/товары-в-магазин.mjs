#!/usr/bin/env node
/**
 * Товары → сайт-магазин.
 *
 * Берёт товары из любого доступного источника и кладёт их в
 * site-shop/js/products.data.js — файл, который каталог подхватывает сам.
 *
 * Источники, по порядку проверки:
 *   1. bot/данные/товары.json      — то, что собрал телеграм-бот из темы «Товары»
 *   2. импорт/result.json          — выгрузка истории чата из Telegram Desktop
 *      (правой кнопкой по чату → «Экспорт истории чата» → формат JSON)
 *   3. импорт/товары.md            — просто список текстом, по одному товару на абзац
 *
 * Запуск:  node tools/товары-в-магазин.mjs
 *          node tools/товары-в-магазин.mjs --тема "Товары"   (какую тему брать из выгрузки)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЫХОД = path.join(КОРЕНЬ, 'site-shop', 'js', 'products.data.js');
const ФОТО_ВЫХОД = path.join(КОРЕНЬ, 'site-shop', 'assets', 'photo', 'tovary');

const аргТема = (() => {
  const i = process.argv.indexOf('--тема');
  return i > -1 ? process.argv[i + 1] : 'Товары';
})();

/* ---------- разбор одного описания ---------- */

const разборЦены = s => {
  const m = String(s).match(/(\d[\d\s.,]{1,10})\s*(?:₽|руб|р\.|rub)/i) || String(s).match(/(?:₽|руб)\s*(\d[\d\s.,]{1,10})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[\s.]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function разобрать(текст, id) {
  const строки = String(текст).split('\n').map(s => s.trim()).filter(Boolean);
  const т = { id, title: '', subtitle: '', brand: '', volume: '', price: null,
              article: '', forWhom: '', notFor: '', why: '', how: '', task: [], raw: текст };

  for (const с of строки) {
    const m = с.match(/^([А-Яа-яЁёA-Za-z ]{3,24})\s*[:—–-]\s*(.+)$/);
    if (!m) continue;
    const поле = m[1].toLowerCase().trim(), v = m[2].trim();
    if (/^назв|^товар|^продукт|^наимен/.test(поле)) т.title ||= v;
    else if (/бренд|марк|производ/.test(поле)) т.brand ||= v;
    else if (/объ[её]м|фасов|вес/.test(поле)) т.volume ||= v;
    else if (/цен|стоим|прайс/.test(поле)) т.price ??= разборЦены(v);
    else if (/артикул|код|sku|штрих/.test(поле)) т.article ||= v;
    else if (/кому|подход|для кого/.test(поле)) т.forWhom ||= v;
    else if (/не подход|кому не|противопок/.test(поле)) т.notFor ||= v;
    else if (/зачем|почему|эффект|действ/.test(поле)) т.why ||= v;
    else if (/как приме|примен|способ|использ/.test(поле)) т.how ||= v;
    else if (/опис|состав/.test(поле)) т.subtitle ||= v;
  }

  if (!т.title) т.title = строки[0] || 'Без названия';
  т.price ??= разборЦены(текст);
  if (!т.volume) { const o = текст.match(/(\d[\d.,]*)\s*(мл|ml|г|гр|g|л|кг|kg)\b/i); if (o) т.volume = `${o[1]} ${o[2].toLowerCase()}`; }
  if (!т.subtitle) т.subtitle = строки.slice(1).join(' ').slice(0, 140);

  // задача из диагностики — по ключевым словам в тексте
  const н = текст.toLowerCase();
  if (/кератин|ботокс|после процедур/.test(н)) т.task.push('after');
  if (/сух|ломк|секут|тускл/.test(н)) т.task.push('dry');
  if (/жирн|корни|себум|перхот|кожа головы/.test(н)) т.task.push('scalp');
  if (/осветл|блонд|обесцвеч/.test(н)) т.task.push('bleached');
  if (/пуш|электриз|непослуш/.test(н)) т.task.push('frizz');
  if (/укладк|фен|термо|стайлинг/.test(н)) т.task.push('style');
  if (!т.task.length) т.task.push('dry');
  т.task = [...new Set(т.task)];

  return т;
}

/* ---------- источники ---------- */

function изБота() {
  const p = path.join(КОРЕНЬ, 'bot', 'данные', 'товары.json');
  if (!fs.existsSync(p)) return null;
  const сырые = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!сырые.length) return null;
  return сырые.map((с, i) => {
    const т = разобрать(с.исходныйТекст || с.название || '', с.id || `t${i + 1}`);
    т.photos = (с.фото || []).map(ф => ({ откуда: path.join(КОРЕНЬ, 'bot', 'фото-товаров', ф), имя: ф }));
    return т;
  });
}

function изВыгрузки() {
  const p = path.join(КОРЕНЬ, 'импорт', 'result.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const сообщения = j.messages || [];

  // находим тему: у Telegram это сообщение с action 'topic_created'
  const тема = сообщения.find(m => m.action === 'topic_created' && (m.title || '').trim().toLowerCase() === аргТема.toLowerCase());
  const idТемы = тема ? тема.id : null;

  const свои = сообщения.filter(m => {
    if (m.type !== 'message') return false;
    if (idТемы == null) return true;                     // тем нет — берём всё
    return m.reply_to_message_id === idТемы || m.id === idТемы || m.topic_id === idТемы;
  });

  const текстОт = m => Array.isArray(m.text)
    ? m.text.map(x => (typeof x === 'string' ? x : x.text || '')).join('')
    : (m.text || '');

  // склейка альбомов: подряд идущие сообщения с фото без текста прилипают к предыдущему
  const карточки = [];
  for (const m of свои) {
    const t = текстОт(m).trim();
    const фото = m.photo ? path.join(path.dirname(p), m.photo) : null;
    if (!t && фото && карточки.length) { карточки.at(-1).фото.push(фото); continue; }
    if (!t && !фото) continue;
    карточки.push({ текст: t, фото: фото ? [фото] : [], дата: m.date });
  }

  if (!карточки.length) return null;
  return карточки.map((к, i) => {
    const т = разобрать(к.текст, `t${String(i + 1).padStart(3, '0')}`);
    т.photos = к.фото.map((ф, j) => ({ откуда: ф, имя: `${т.id}-${j + 1}${path.extname(ф) || '.jpg'}` }));
    return т;
  });
}

function изТекста() {
  const p = path.join(КОРЕНЬ, 'импорт', 'товары.md');
  if (!fs.existsSync(p)) return null;
  const куски = fs.readFileSync(p, 'utf8').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (!куски.length) return null;
  return куски.map((к, i) => ({ ...разобрать(к, `t${String(i + 1).padStart(3, '0')}`), photos: [] }));
}

/* ---------- запись ---------- */

const источники = [['телеграм-бот', изБота], ['выгрузка Telegram Desktop', изВыгрузки], ['список текстом', изТекста]];
let товары = null, откуда = null;
for (const [имя, ф] of источники) {
  try { const r = ф(); if (r && r.length) { товары = r; откуда = имя; break; } }
  catch (e) { console.log(`источник «${имя}» не прочитался: ${e.message}`); }
}

if (!товары) {
  console.log('Товаров нигде нет. Нужен один из источников:');
  console.log('  1) бот собрал их из темы «Товары»  → bot/данные/товары.json');
  console.log('  2) выгрузка чата Telegram Desktop  → импорт/result.json');
  console.log('  3) просто список текстом          → импорт/товары.md');
  process.exit(2);
}

fs.mkdirSync(ФОТО_ВЫХОД, { recursive: true });
let фотоСкопировано = 0;
for (const т of товары) {
  т.photo = null;
  for (const ф of (т.photos || [])) {
    if (!fs.existsSync(ф.откуда)) continue;
    fs.copyFileSync(ф.откуда, path.join(ФОТО_ВЫХОД, ф.имя));
    фотоСкопировано++;
    т.photo ||= `assets/photo/tovary/${ф.имя}`;
  }
  delete т.photos;
}

const данные = товары.map(т => ({
  id: т.id, title: т.title, subtitle: т.subtitle, brand: т.brand, volume: т.volume,
  price: т.price, article: т.article, task: т.task,
  forWhom: т.forWhom, notFor: т.notFor, why: т.why, how: т.how,
  photo: т.photo || 'assets/photo/care-bottle.jpg',
}));

fs.writeFileSync(ВЫХОД,
`/* Собрано автоматически: tools/товары-в-магазин.mjs
   Источник: ${откуда}
   Дата: ${new Date().toISOString().slice(0, 10)}
   Руками не править — правьте источник и запускайте скрипт заново. */
window.HAIRID_PRODUCTS = ${JSON.stringify(данные, null, 2)};
`);

const безЦены = данные.filter(т => т.price == null).length;
console.log(`Источник: ${откуда}`);
console.log(`Товаров: ${данные.length} | фото скопировано: ${фотоСкопировано} | без цены: ${безЦены}`);
console.log(`Записано: ${path.relative(КОРЕНЬ, ВЫХОД)}`);
if (безЦены) console.log('ВНИМАНИЕ: у части товаров не распозналась цена — проверьте исходный текст.');
