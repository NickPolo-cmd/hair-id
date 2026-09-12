// Итоговая проверка обоих сайтов одной командой.
//
// Зачем отдельный файл. Эти проверки писались по ходу работы во временной
// папке сессии и вместе с ней пропадали: следующая проверка начиналась
// с написания скрипта заново. Проверка, которую нельзя повторить завтра,
// не проверка, а разовый замер. Здесь они живут в проекте.
//
// Что проверяется:
//   1. Собранная версия docs/ — каждая страница: битые запросы, сбои,
//      ошибки в консоли, заголовок, описание для поиска, пустые контейнеры,
//      внутренние записки, попавшие наружу.
//   2. Скорость прокрутки — сколько раз за кадр браузер вынужден
//      пересчитывать раскладку. Это главный источник подёргивания.
//   3. Заказ в магазине — цены у всех товаров, итог, испорченное
//      и недоступное хранилище, попытка подсунуть чужой код.
//
// Запуск: node tools/проверка-сайта.mjs
// Серверы поднимаются сами и гасятся в конце. Код возврата 1, если есть беды.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ПУТЬ_PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ||
  '/Users/nick/.local/node/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(ПУТЬ_PLAYWRIGHT);

const ТИПЫ = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

function поднять(папка, порт) {
  const корень = path.join(КОРЕНЬ, папка);
  const сервер = http.createServer((req, res) => {
    let п = decodeURIComponent(req.url.split('?')[0]);
    if (п.endsWith('/')) п += 'index.html';
    const файл = path.join(корень, п);
    if (!файл.startsWith(корень)) { res.writeHead(403).end('нет'); return; }
    fs.readFile(файл, (е, д) => {
      if (е) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('не найдено'); return; }
      res.writeHead(200, { 'Content-Type': ТИПЫ[path.extname(файл).toLowerCase()] || 'application/octet-stream' });
      res.end(д);
    });
  });
  return new Promise((г) => сервер.listen(порт, () => г(сервер)));
}

const бед = [];
const беда = (т) => { бед.push(т); console.log('  БЕДА: ' + т); };

for (const папка of ['docs', 'site-shop']) {
  if (!fs.existsSync(path.join(КОРЕНЬ, папка))) {
    console.error('Нет папки ' + папка + '. Соберите сайт: node tools/сборка-для-github.mjs <адрес>');
    process.exit(1);
  }
}

const серверы = [await поднять('docs', 4423), await поднять('site-shop', 4422)];
const браузер = await chromium.launch();

// ---------------------------------------------------------------------------
// 1. Собранная версия: каждая страница целиком
// ---------------------------------------------------------------------------
console.log('\n=== СОБРАННАЯ ВЕРСИЯ ===');
{
  const к = await браузер.newContext({ viewport: { width: 1440, height: 900 } });
  const страницы = fs.readdirSync(path.join(КОРЕНЬ, 'docs'))
    .filter((н) => н.endsWith('.html')).map((н) => '/' + н)
    .concat(fs.readdirSync(path.join(КОРЕНЬ, 'docs', 'shop'))
      .filter((н) => н.endsWith('.html')).map((н) => '/shop/' + н));

  for (const п of страницы) {
    const с = await к.newPage();
    const битые = [], сбои = [], ошибки = [];
    с.on('response', (о) => { if (о.status() >= 400) битые.push(о.status() + ' ' + о.url().replace('http://localhost:4423', '')); });
    с.on('pageerror', (e) => сбои.push(String(e).slice(0, 140)));
    с.on('console', (м) => { if (м.type() === 'error') ошибки.push(м.text().slice(0, 140)); });
    await с.goto('http://localhost:4423' + п, { waitUntil: 'networkidle' });
    await с.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await с.waitForTimeout(1000);

    const r = await с.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      заголовок: (document.title || '').length,
      описание: !!document.querySelector('meta[name="description"]'),
      // Служебные печатные листы закрыты от поиска — описание им не нужно.
      отПоиска: !!document.querySelector('meta[name="robots"][content*="noindex"]'),
      пустые: [...document.querySelectorAll('#shop-grid, #shop-sets')].filter((э) => !э.children.length).length,
      записки: document.documentElement.innerHTML.includes('Заметка для владельца'),
    }));

    const п2 = [];
    if (битые.length) п2.push('битых запросов ' + битые.length + ': ' + битые[0]);
    if (сбои.length) п2.push('сбой: ' + сбои[0]);
    if (ошибки.length) п2.push('ошибка в консоли: ' + ошибки[0]);
    if (r.h1 !== 1) п2.push('заголовков h1: ' + r.h1);
    if (!r.заголовок) п2.push('нет заголовка страницы');
    if (!r.описание && !r.отПоиска) п2.push('нет описания для поиска');
    if (r.пустые) п2.push('пустых контейнеров: ' + r.пустые);
    if (r.записки) п2.push('внутренняя записка попала на сайт');

    if (п2.length) беда(п + ' — ' + п2.join('; '));
    await с.close();
  }
  console.log('  страниц проверено: ' + страницы.length);
  await к.close();
}

// ---------------------------------------------------------------------------
// 2. Скорость: обращения к раскладке за кадр прокрутки
// ---------------------------------------------------------------------------
console.log('\n=== СКОРОСТЬ ПРОКРУТКИ ===');
{
  // Норма: браузер не должен пересчитывать раскладку в кадре вообще.
  // Единицы на кадр терпимы, десятки — это уже подёргивание на телефоне.
  const ПОРОГ = 2;
  const к = await браузер.newContext({ viewport: { width: 1440, height: 900 } });
  await к.addInitScript(() => {
    window.__рамок = 0;
    const о = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (window.__считаем) window.__рамок++;
      return о.apply(this, arguments);
    };
  });

  for (const п of ['/index.html', '/uslugi.html', '/shop/katalog.html']) {
    const с = await к.newPage();
    await с.goto('http://localhost:4423' + п, { waitUntil: 'networkidle' });
    await с.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await с.waitForTimeout(1200);
    const r = await с.evaluate(async () => {
      window.__рамок = 0; window.__считаем = true;
      let кадров = 0;
      await new Promise((г) => {
        let y = 0;
        (function ш() {
          y += 60; window.scrollTo(0, y); кадров++;
          if (y < Math.min(document.documentElement.scrollHeight, 8000)) requestAnimationFrame(ш);
          else г();
        })();
      });
      window.__считаем = false;
      return { наКадр: +(window.__рамок / кадров).toFixed(2), кадров: кадров };
    });
    console.log('  ' + п.padEnd(22) + 'обращений к раскладке на кадр: ' + r.наКадр);
    if (r.наКадр > ПОРОГ) беда(п + ': ' + r.наКадр + ' обращений к раскладке на кадр, норма до ' + ПОРОГ);
    await с.close();
  }
  await к.close();
}

// ---------------------------------------------------------------------------
// 3. Заказ в магазине
// ---------------------------------------------------------------------------
console.log('\n=== ЗАКАЗ В МАГАЗИНЕ ===');
{
  const к = await браузер.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const с = await к.newPage();
  const ошибки = [];
  с.on('pageerror', (e) => ошибки.push(String(e).slice(0, 140)));
  await с.goto('http://localhost:4422/katalog.html', { waitUntil: 'networkidle' });

  const цены = await с.evaluate(() => (window.HAIRID_PRODUCTS || [])
    .map((p) => ({ id: p.id, цена: p.price, объёмов: (p.prices || []).length })));
  console.log('  товаров: ' + цены.length +
    ', с ценой: ' + цены.filter((p) => p.цена != null).length +
    ', с ценами по объёмам: ' + цены.filter((p) => p.объёмов).length);
  const безЦены = цены.filter((p) => p.цена == null);
  if (безЦены.length) беда('без цены: ' + безЦены.map((p) => p.id).join(', '));

  const карточек = await с.locator('#shop-grid .product').count();
  console.log('  карточек нарисовано: ' + карточек);
  if (карточек < цены.length) беда('карточек ' + карточек + ' при ' + цены.length + ' товарах');

  // Итог заказа
  const первый = await с.evaluate(() => window.HAIRID_PRODUCTS[0]);
  await с.evaluate((id) => localStorage.setItem('hairid-shop-cart', JSON.stringify({ [id]: 2 })), первый.id);
  await с.reload({ waitUntil: 'networkidle' });
  const итог = await с.evaluate(() => {
    const э = document.getElementById('cart-total');
    return э ? э.textContent.replace(/\s/g, '') : null;
  });
  const ждём = String(первый.price * 2);
  console.log('  итог за две штуки: ожидали ' + ждём + ', на экране ' + итог);
  if (!итог || !итог.includes(ждём)) беда('итог заказа не сходится');

  // Испорченное хранилище
  await с.evaluate(() => localStorage.setItem('hairid-shop-cart', '{сломано'));
  await с.reload({ waitUntil: 'networkidle' });
  if (ошибки.length) беда('падает на испорченном хранилище: ' + ошибки[0]);

  // Недоступное хранилище
  const к2 = await браузер.newContext({ viewport: { width: 390, height: 844 } });
  const с2 = await к2.newPage();
  const ош2 = [];
  с2.on('pageerror', (e) => ош2.push(String(e).slice(0, 140)));
  await с2.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('нет доступа'); } });
  });
  await с2.goto('http://localhost:4422/katalog.html', { waitUntil: 'networkidle' });
  const карт2 = await с2.locator('#shop-grid .product').count();
  console.log('  без хранилища карточек: ' + карт2 + ', сбоев: ' + ош2.length);
  if (ош2.length) беда('падает без хранилища: ' + ош2[0]);
  await к2.close();

  // Чужой код в данных
  await с.evaluate(() => {
    window.HAIRID_PRODUCTS.push({ id: 'x', name: '<img src=x onerror="window.__взлом=1">', price: 1 });
  });
  await с.reload({ waitUntil: 'networkidle' });
  const взлом = await с.evaluate(() => !!window.__взлом);
  console.log('  чужой код из данных исполнился: ' + взлом);
  if (взлом) беда('чужой код из данных товара исполняется');
  await к.close();
}

await браузер.close();
for (const сервер of серверы) сервер.close();

console.log('\n' + (бед.length ? 'ВСЕГО БЕД: ' + бед.length : 'Бед нет.'));
process.exit(бед.length ? 1 : 0);
