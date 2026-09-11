import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/nick/Desktop/Волосы';
const OUTPUT = path.join(ROOT, 'avito/фото-инфографика');
const WIDTH = 1080;
const HEIGHT = 1440;

// Факты без « · » выводятся целиком крупным значением, без добавления текста.
const CARDS = [
  ['01-holodnoe-vosstanovlenie.jpg', 'tg-015.jpg', 'Восстановление', 'Холодное восстановление без утюжка', ['около месяца · эффект', 'накопительно · курсом', 'без формальдегида']],
  ['02-vosstanovlenie-posle-osvetleniya.jpg', 'tg-013.jpg', 'После осветления', 'Восстановление осветлённых волос', ['курс · 5–10 визитов', 'раз в 1–2 недели', 'сначала диагностика']],
  ['03-pitanie-uvlazhnenie.jpg', 'tg-072.jpg', 'Уход', 'Питание, увлажнение и блеск', ['блеск · сразу', '2 недели · держится', 'до месяца · с уходом дома']],
  ['04-podbor-obraza.jpg', 'tg-003.jpg', 'Стилист', 'Разбор образа и гардероба', ['форма · стрижки', 'цвет · волос', 'стригу · в тот же день']],
  ['05-chelka-shtorka.jpg', 'tg-033.jpg', 'Стрижка', 'Чёлка-шторка под форму лица', ['1 минута · укладка феном', 'подберу · под лицо', 'покажу · как сушить']],
  ['06-pricheski.jpg', 'tg-041.jpg', 'Причёски', 'Причёска на свадьбу и торжество', ['до конца · вечера', 'гостям · и мамам невесты', 'репетиция · по желанию']],
  ['07-spa.jpg', 'tg-051.jpg', 'СПА', 'СПА для волос и кожи головы', ['6 шагов · за визит', '1,5 часа', '3–4 мытья · гладкость']],
  ['08-keratin.jpg', 'tg-059.jpg', 'Выпрямление', 'Кератиновое выпрямление волос', ['3–6 месяцев · эффект', 'без заломов', 'подбор · по пористости']],
  ['09-botoks.jpg', 'tg-010.jpg', 'Уход', 'Ботокс для волос без уколов', ['1,5–3 месяца · эффект', 'уколов · нет', 'для пористых · волос']],
  ['10-spasu-volosy.jpg', 'tg-031.jpg', 'Спасение', 'Волосы после осветления и смывки', ['сначала · диагностика', 'скажу честно · возьмусь или нет', 'программа · под ваш случай']],
  ['11-ochishchenie-kozhi.jpg', 'tg-019.jpg', 'Кожа головы', 'Пилинг кожи головы', ['жирные корни', 'сухая длина', 'накопительно · по коже']],
  ['12-schastie.jpg', 'tg-057.jpg', 'Уход', 'Счастье для волос за один визит', ['один визит · результат', 'около месяца · держится', 'мягкость · и блеск']],
].map(([file, photo, eyebrow, title, facts]) => ({ file, photo, eyebrow, title, facts }));

const escapeHTML = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jpegURI = (file) => `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;

function html(card, logo) {
  const photo = jpegURI(path.join(ROOT, 'фото-от-владельца', card.photo));
  const facts = card.facts.map((fact) => {
    const [value, label] = fact.split(' · ');
    return `<div class="fact"><div class="value">${escapeHTML(value)}</div>${label ? `<div class="label">${escapeHTML(label)}</div>` : ''}</div>`;
  }).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; }
    body { position: relative; background: #10160F; color: #FAF7F1; font-family: -apple-system, 'Helvetica Neue', Arial; }
    .photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
    .shade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(16,22,15,.88) 0%, rgba(16,22,15,.72) 26%, transparent 52%); }
    .text { position: absolute; left: 64px; right: 64px; bottom: 68px; }
    .eyebrow { font-size: 30px; line-height: 1.25; letter-spacing: .18em; color: #C9A75F; text-transform: uppercase; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 78px; font-weight: 700; line-height: 1.05; text-wrap: balance; }
    .rule { width: 96px; height: 2px; background: #C9A75F; margin: 28px 0; }
    .facts { display: flex; align-items: stretch; }
    .fact { flex: 1 1 0; min-width: min-content; padding: 0 16px; border-left: 1px solid rgba(201,167,95,.45); }
    .fact:first-child { padding-left: 0; border-left: 0; }
    .fact:last-child { padding-right: 0; }
    .value { font-size: 40px; font-weight: 700; line-height: 1.12; }
    .label { margin-top: 9px; font-size: 22px; line-height: 1.3; color: rgba(250,247,241,.72); }
    .logo { position: absolute; top: 48px; right: 48px; width: 128px; height: 128px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(16,22,15,.16); overflow: hidden; }
    .logo img { width: 96px; height: 96px; object-fit: contain; opacity: .92; }
  </style></head><body><img class="photo" src="${photo}" alt=""><div class="shade"></div>
  <div class="text"><div class="eyebrow">${escapeHTML(card.eyebrow)}</div><h1>${escapeHTML(card.title)}</h1><div class="rule"></div><div class="facts">${facts}</div></div>
  <div class="logo"><img src="${logo}" alt="Hair ID"></div></body></html>`;
}

async function measure(page) {
  return page.evaluate(({ width, height }) => {
    const text = document.querySelector('.text').getBoundingClientRect();
    const logo = document.querySelector('.logo').getBoundingClientRect();
    const heading = document.querySelector('h1');
    const style = getComputedStyle(heading);
    const inside = (r, outer) => r.left >= outer.left - .5 && r.top >= outer.top - .5 && r.right <= outer.right + .5 && r.bottom <= outer.bottom + .5;
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const frame = { left: 0, top: 0, right: width, bottom: height };
    const errors = [];
    if (!inside(text, frame)) errors.push('блок текста вне кадра');
    if (overlaps(text, logo)) errors.push('пересечение с логотипом');
    const lines = Math.round(heading.getBoundingClientRect().height / parseFloat(style.lineHeight));
    if (lines > 2) errors.push(`заголовок: ${lines} строки`);
    const leaves = [...document.querySelectorAll('.eyebrow, h1, .value, .label')];
    const bounds = leaves.map((element) => element.getBoundingClientRect());
    const inkBounds = [];
    leaves.forEach((element, index) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      if (!inside(bounds[index], text)) errors.push('элемент вне блока текста');
      const rects = [...range.getClientRects()];
      inkBounds.push(rects);
      for (const rect of rects) {
        // Метрики системного шрифта могут выступать по вертикали за line-height.
        // Проверяем ширину колонки, кадр и столкновения с другими текстами.
        if (rect.left < bounds[index].left - .5 || rect.right > bounds[index].right + .5 || !inside(rect, frame)) errors.push(`текст выходит за границы: ${element.textContent}`);
      }
      for (let j = index + 1; j < bounds.length; j++) {
        if (overlaps(bounds[index], bounds[j])) errors.push('элементы текста пересекаются');
      }
    });
    for (let i = 0; i < inkBounds.length; i++) {
      for (let j = i + 1; j < inkBounds.length; j++) {
        if (inkBounds[i].some((a) => inkBounds[j].some((b) => overlaps(a, b)))) errors.push('строки разных элементов пересекаются');
      }
    }
    return { fontSize: parseFloat(style.fontSize), lines, ok: errors.length === 0, errors: [...new Set(errors)] };
  }, { width: WIDTH, height: HEIGHT });
}

async function main() {
  const rows = [];
  let browser;
  try {
    const logo = jpegURI(path.join(ROOT, 'лого прозрачный.jpg'));
    fs.mkdirSync(OUTPUT, { recursive: true });
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    // Все ресурсы локальные; случайные сетевые запросы также запрещены.
    await page.route('**/*', (route) => /^(data:|about:)/.test(route.request().url()) ? route.continue() : route.abort());
    for (const card of CARDS) {
      try {
        await page.setContent(html(card, logo), { waitUntil: 'load' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((img) => img.decode()));
        });
        let result;
        for (const size of [78, 74, 70, 66, 62, 58, 56]) {
          await page.locator('h1').evaluate((element, fontSize) => { element.style.fontSize = `${fontSize}px`; }, size);
          result = await measure(page);
          if (result.lines <= 2) break;
        }
        const destination = path.join(OUTPUT, card.file);
        await page.screenshot({ path: destination, type: 'jpeg', quality: 90, fullPage: false, animations: 'disabled' });
        // Повторный замер после сохранения каждой карточки.
        result = await measure(page);
        rows.push({ 'файл': card.file, 'размер в КБ': +(fs.statSync(destination).size / 1024).toFixed(1), 'кегль заголовка': result.fontSize, 'текст в кадре': result.ok ? 'да' : 'нет' });
        if (!result.ok) {
          process.exitCode = 1;
          console.error(`${card.file}: ${result.errors.join('; ')}`);
        }
      } catch (error) {
        process.exitCode = 1;
        rows.push({ 'файл': card.file, 'размер в КБ': '—', 'кегль заголовка': '—', 'текст в кадре': 'нет' });
        console.error(`${card.file}: ${error.message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    console.table(rows);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
