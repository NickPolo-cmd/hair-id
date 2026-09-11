// Статические карточки товаров и наборов прямо в разметке.
//
// ЗАЧЕМ. Каталог рисует JavaScript. Без него в исходнике страницы нет ни одного
// названия товара — поисковый робот и читалка для незрячих видят пустоту.
// В katalog.html карточки уже были вписаны руками, но с ценами «по запросу»,
// и после появления настоящих цен разметка начала врать: человек видит 1 850 ₽,
// поисковик — «цена по запросу». На главной магазина и на странице наборов
// статики не было вовсе: три ключевых блока — пустые контейнеры.
//
// ЧТО ДЕЛАЕТ. Собирает разметку из site-shop/js/products.data.js и вписывает
// её между метками на трёх страницах. js/catalog.js при загрузке перерисует
// те же карточки теми же данными — дублей на экране не будет.
//
// Запуск: node tools/статика-каталога.mjs
// Повторный запуск безопасен: содержимое между метками заменяется целиком.
//
// ВАЖНО: гонять после каждой правки товаров или цен, то есть сразу за
// node tools/товары-в-магазин2.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function читатьТовары() {
  const путь = path.join(КОРЕНЬ, 'site-shop', 'js', 'products.data.js');
  const исходник = fs.readFileSync(путь, 'utf8');
  const якорь = исходник.indexOf('[');
  if (якорь === -1) {
    console.error('Не разобрался в products.data.js: не нашёл начало списка.');
    process.exit(1);
  }
  try {
    return JSON.parse(исходник.slice(якорь).replace(/;\s*$/, ''));
  } catch (e) {
    console.error('Не разобрался в products.data.js: ' + e.message);
    process.exit(1);
  }
}

// Наборы объявлены в самом catalog.js — вытаскиваем их оттуда, чтобы
// не держать второй список и не расходиться с ним.
function читатьНаборы() {
  const путь = path.join(КОРЕНЬ, 'site-shop', 'js', 'catalog.js');
  const т = fs.readFileSync(путь, 'utf8');
  const начало = т.indexOf('var SETS = [');
  if (начало === -1) return [];
  const открытие = т.indexOf('[', начало);
  let скобки = 0, конец = открытие;
  for (let i = открытие; i < т.length; i++) {
    if (т[i] === '[') скобки++;
    if (т[i] === ']') { скобки--; if (скобки === 0) { конец = i; break; } }
  }
  const кусок = т.slice(открытие, конец + 1)
    .replace(/(\w+)\s*:/g, '"$1":')          // ключи без кавычек
    .replace(/'/g, '"')                       // одинарные кавычки
    .replace(/,(\s*[}\]])/g, '$1');           // висящие запятые
  try { return JSON.parse(кусок); } catch { return []; }
}

const экр = (з) => String(з === null || з === undefined ? '' : з)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const деньги = (n) => (n === null || n === undefined)
  ? 'Цена по запросу'
  : Number(n).toLocaleString('ru-RU') + ' ₽';

// Те же объёмы, что разбирает catalog.js: «318 / 518 / 738 мл».
function объёмы(volume) {
  const raw = String(volume || '');
  if (raw.indexOf('/') === -1) return [];
  const части = raw.split('/').map((v) => v.trim()).filter(Boolean);
  const единица = (части[части.length - 1].match(/[^\d\s.,]+$/) || [''])[0];
  return части.map((v) => /[^\d\s.,]/.test(v) ? v : (единица ? v + ' ' + единица : v));
}

function карточкаТовара(p, отступ) {
  const о = ' '.repeat(отступ);
  const список = объёмы(p.volume);
  const ценник = (p.prices && p.prices.length && список.length > 1)
    ? '<ul class="product__prices">' + список.map((v, i) =>
        '<li><span>' + экр(v) + '</span><b>' + деньги(p.prices[i]) + '</b></li>').join('') + '</ul>'
    : '';

  return [
    о + '<article class="product" id="' + экр(p.id) + '" data-product="' + экр(p.id) + '" data-card-link>',
    о + '  <div class="product__media"><img src="' + экр(p.photo) + '" alt="' + экр(p.title) +
        '" width="800" height="600" loading="lazy"></div>',
    о + '  <div class="product__body">',
    о + '    <h3>' + экр(p.title) + '</h3>',
    о + '    <p class="product__subtitle">' + экр(p.subtitle) + '</p>',
    p.forWhom ? о + '    <p class="product__for"><b>Кому:</b> ' + экр(p.forWhom) + '</p>' : null,
    (p.notFor && p.notFor !== '—')
      ? о + '    <p class="product__notfor"><b>Кому не подойдёт:</b> ' + экр(p.notFor) + '</p>' : null,
    о + '    <details class="product__more"><summary>Почему это работает</summary>',
    о + '      <p>' + экр(p.why) + '</p>',
    о + '      <p><b>Как пользоваться.</b> ' + экр(p.how) + '</p>',
    о + '    </details>',
    ценник ? о + '    ' + ценник : null,
    о + '    <div class="product__foot">',
    о + '      <span class="product__price">' + деньги(p.price) +
        (список.length ? '' : '<i>' + экр(p.volume) + '</i>') + '</span>',
    о + '    </div>',
    о + '  </div>',
    о + '</article>',
  ].filter(Boolean).join('\n');
}

function карточкаНабора(s, поId, отступ) {
  const о = ' '.repeat(отступ);
  const имена = (s.items || []).map((i) => поId[i] && поId[i].title).filter(Boolean);
  return [
    о + '<article class="set" data-reveal="up" data-card-link>',
    о + '  <div class="set__media"><img src="' + экр(s.photo) + '" alt="' + экр(s.title) +
        '" width="800" height="600" loading="lazy"></div>',
    о + '  <div class="set__body">',
    о + '    <h3>' + экр(s.title) + '</h3>',
    s.subtitle ? о + '    <p class="set__subtitle">' + экр(s.subtitle) + '</p>' : null,
    имена.length ? о + '    <ul class="set__items">' +
      имена.map((н) => '<li>' + экр(н) + '</li>').join('') + '</ul>' : null,
    о + '    <p class="set__price">' + деньги(s.price) + '</p>',
    о + '  </div>',
    о + '</article>',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------

const ТОВАРЫ = читатьТовары();
const НАБОРЫ = читатьНаборы();
const поId = Object.fromEntries(ТОВАРЫ.map((т) => [т.id, т]));

// Что во что вписываем: страница, id контейнера, чем наполнить.
const ЗАДАНИЯ = [
  { файл: 'katalog.html', id: 'shop-grid', что: 'товары' },
  { файл: 'index.html',   id: 'shop-grid', что: 'товары', сколько: 9 },
  { файл: 'index.html',   id: 'shop-sets', что: 'наборы' },
  { файл: 'nabory.html',  id: 'shop-sets', что: 'наборы' },
];

let всего = 0;
for (const з of ЗАДАНИЯ) {
  const путь = path.join(КОРЕНЬ, 'site-shop', з.файл);
  if (!fs.existsSync(путь)) { console.log('нет файла: ' + з.файл); continue; }
  let страница = fs.readFileSync(путь, 'utf8');

  // Ищем открывающий тег контейнера и его закрытие.
  const реОткрытие = new RegExp('<div[^>]*id="' + з.id + '"[^>]*>');
  const м = реОткрытие.exec(страница);
  if (!м) { console.log(з.файл + ': контейнер #' + з.id + ' не найден'); continue; }

  const началоСодержимого = м.index + м[0].length;

  // Закрытие контейнера ищем с учётом вложенности: внутри карточек свои
  // <div>, и первый же встреченный </div> — это конец фотографии, а не сетки.
  // На этом я уже споткнулся: разметка каталога развалилась.
  let глубина = 1;
  let конец = -1;
  const теги = /<div\b[^>]*>|<\/div>/g;
  теги.lastIndex = началоСодержимого;
  let тег;
  while ((тег = теги.exec(страница)) !== null) {
    глубина += тег[0] === '</div>' ? -1 : 1;
    if (глубина === 0) { конец = тег.index; break; }
  }
  if (конец === -1) { console.log(з.файл + ': не нашёл закрытие #' + з.id); continue; }

  // Отступ берём по строке с открывающим тегом, чтобы вложенность не съехала.
  const строкаНачала = страница.lastIndexOf('\n', м.index) + 1;
  const отступ = м.index - строкаНачала + 2;

  let содержимое;
  if (з.что === 'товары') {
    const список = з.сколько ? ТОВАРЫ.slice(0, з.сколько) : ТОВАРЫ;
    содержимое = список.map((т) => карточкаТовара(т, отступ)).join('\n');
    всего += список.length;
  } else {
    содержимое = НАБОРЫ.map((н) => карточкаНабора(н, поId, отступ)).join('\n');
    всего += НАБОРЫ.length;
  }

  const было = страница;
  страница = страница.slice(0, началоСодержимого) + '\n' + содержимое + '\n' +
    ' '.repeat(отступ - 2) + страница.slice(конец);

  // Страховка от того, на чём я уже ошибся: если теги перестали сходиться,
  // файл не записывается вовсе — лучше не сделать, чем сломать разметку.
  const счёт = (т, ре) => (т.match(ре) || []).length;
  for (const [имя, реОткр, реЗакр] of [['div', /<div\b/g, /<\/div>/g], ['article', /<article\b/g, /<\/article>/g]]) {
    if (счёт(страница, реОткр) !== счёт(страница, реЗакр)) {
      console.error(з.файл + ': теги <' + имя + '> перестали сходиться — ' +
        счёт(страница, реОткр) + ' против ' + счёт(страница, реЗакр) + '. Файл не тронут.');
      страница = было;
      break;
    }
  }
  if (страница === было) continue;
  fs.writeFileSync(путь, страница);
  console.log(з.файл + ' → #' + з.id + ': ' +
    (з.что === 'товары' ? (з.сколько ? з.сколько : ТОВАРЫ.length) : НАБОРЫ.length) + ' карточек');
}

console.log('Всего карточек вписано: ' + всего);
console.log('Товаров с ценой: ' + ТОВАРЫ.filter((т) => т.price !== null && т.price !== undefined).length +
  ' из ' + ТОВАРЫ.length + ', из них с тремя ценами: ' + ТОВАРЫ.filter((т) => т.prices).length);
