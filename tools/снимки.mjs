import { chromium } from '/Users/nick/.local/node/lib/node_modules/playwright/index.mjs';
const ПАПКА = '/Users/nick/Desktop/Волосы/снимки-сайта/правка-18';
const б = await chromium.launch();
const кадры = [
  { имя: 'ПК-верх',        адрес: 'http://localhost:4321/index.html', ш: 1440, в: 900,  прокрутка: 0 },
  { имя: 'ПК-шапка-села',  адрес: 'http://localhost:4321/index.html', ш: 1440, в: 900,  прокрутка: 900 },
  { имя: 'ПК-стык-секций', адрес: 'http://localhost:4321/index.html', ш: 1440, в: 900,  прокрутка: 2100 },
  { имя: 'Телефон-верх',   адрес: 'http://localhost:4321/index.html', ш: 390,  в: 844,  прокрутка: 0, моб: true },
  { имя: 'Телефон-шапка',  адрес: 'http://localhost:4321/index.html', ш: 390,  в: 844,  прокрутка: 800, моб: true },
  { имя: 'Планшет-верх',   адрес: 'http://localhost:4321/index.html', ш: 820,  в: 1180, прокрутка: 0 },
  { имя: 'Планшет-шапка',  адрес: 'http://localhost:4321/index.html', ш: 820,  в: 1180, прокрутка: 900 },
  { имя: 'Магазин-ПК',     адрес: 'http://localhost:4322/index.html', ш: 1440, в: 900,  прокрутка: 700 },
  { имя: 'Магазин-телефон',адрес: 'http://localhost:4322/katalog.html', ш: 390, в: 844, прокрутка: 500, моб: true },
];
for (const к of кадры) {
  const ctx = await б.newContext({ viewport: { width: к.ш, height: к.в }, deviceScaleFactor: 2, isMobile: !!к.моб, hasTouch: !!к.моб });
  const с = await ctx.newPage();
  await с.goto(к.адрес, { waitUntil: 'load', timeout: 25000 });
  await с.waitForTimeout(1200);
  if (к.прокрутка) { await с.evaluate(y => window.scrollTo(0, y), к.прокрутка); await с.waitForTimeout(1100); }
  await с.screenshot({ path: `${ПАПКА}/${к.имя}.png` });
  console.log('снято', к.имя);
  await ctx.close();
}
await б.close();
