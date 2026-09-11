// Сплошная проверка обоих сайтов в настоящем браузере:
// три ширины экрана (телефон, планшет, компьютер), все страницы.
// Что смотрим: ошибки в консоли, горизонтальную прокрутку, битые картинки,
// мелкие зоны нажатия, перелёт логотипа, налезание элементов друг на друга.
import { chromium } from '/Users/nick/.local/node/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const ЭКРАНЫ = [
  { имя: 'телефон',    ширина: 375,  высота: 812,  мобильный: true },
  { имя: 'планшет',    ширина: 768,  высота: 1024, мобильный: true },
  { имя: 'планшет-гор', ширина: 1024, высота: 768, мобильный: false },
  { имя: 'компьютер',  ширина: 1440, высота: 900,  мобильный: false },
];

const СТРАНИЦЫ = [
  // Гео-страницы и диагностику добавили позже — и полгода они жили бы
  // без проверки: мелкая ссылка на одной из них нашлась только при
  // обходе живого сайта. Новая страница обязана попадать сюда сразу.
  ...['index', 'uslugi', 'raboty', 'o-mastere', 'kak-doehat', 'diagnostika',
      'keratin-toksovo', 'keratin-leskolovo', 'vosstanovlenie-oselki',
      'privacy', 'terms', 'card', 'cheatsheet']
      .map(и => ({ сайт: 'студия', адрес: `http://localhost:4321/${и}.html`, имя: и })),
  ...['index', 'katalog', 'nabory', 'kak-vybrat', 'o-mastere', 'privacy', 'terms']
      .map(и => ({ сайт: 'магазин', адрес: `http://localhost:4322/${и}.html`, имя: и })),
];

const отчёт = [];

const браузер = await chromium.launch();

for (const экран of ЭКРАНЫ) {
  const контекст = await браузер.newContext({
    viewport: { width: экран.ширина, height: экран.высота },
    deviceScaleFactor: 2,
    isMobile: экран.мобильный,
    hasTouch: экран.мобильный,
    userAgent: экран.мобильный
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });

  for (const стр of СТРАНИЦЫ) {
    const страница = await контекст.newPage();
    const ошибкиКонсоли = [];
    const сбои = [];
    страница.on('console', м => { if (м.type() === 'error') ошибкиКонсоли.push(м.text().slice(0, 300)); });
    страница.on('pageerror', e => сбои.push(String(e).slice(0, 300)));
    страница.on('requestfailed', з => {
      const u = з.url();
      if (u.startsWith('http://localhost')) сбои.push('не загрузилось: ' + u.replace(/^http:\/\/localhost:\d+/, ''));
    });

    let замер = { ошибка: null };
    try {
      await страница.goto(стр.адрес, { waitUntil: 'load', timeout: 25000 });
      await страница.waitForTimeout(1400);

      замер = await страница.evaluate(({ мобильный }) => {
        const итог = {};
        const док = document.documentElement;

        // 1. Горизонтальная прокрутка — самая заметная поломка на телефоне
        итог.перебор = Math.round(док.scrollWidth - док.clientWidth);
        итог.виновники = [];
        if (итог.перебор > 1) {
          const край = док.clientWidth;
          document.querySelectorAll('body *').forEach(э => {
            const р = э.getBoundingClientRect();
            if (р.width === 0 || р.height === 0) return;
            const пр = getComputedStyle(э);
            if (пр.position === 'fixed') return;
            if (р.right > край + 1 || р.left < -1) {
              итог.виновники.push({
                тег: э.tagName.toLowerCase(),
                класс: (э.className && String(э.className).slice(0, 70)) || '',
                право: Math.round(р.right), лево: Math.round(р.left), ширина: Math.round(р.width),
              });
            }
          });
          итог.виновники = итог.виновники.slice(0, 8);
        }

        // 2. Битые картинки
        итог.битыеКартинки = [...document.images]
          .filter(и => и.complete && и.naturalWidth === 0)
          .map(и => и.getAttribute('src'))
          .slice(0, 10);

        // 3. Картинки без размеров — от них прыгает вёрстка
        итог.безРазмеров = [...document.images]
          .filter(и => !и.getAttribute('width') || !и.getAttribute('height'))
          .map(и => и.getAttribute('src'))
          .slice(0, 10);

        // 4. Зоны нажатия меньше 44×44 — палец не попадает
        if (мобильный) {
          итог.мелкиеНажатия = [];

          // Настоящая зона нажатия не всегда равна рамке самого элемента.
          // В карточках проекта ссылка растянута невидимым слоем ::after
          // на всю карточку — нажимается карточка целиком, а подпись внизу
          // это лишь её видимая часть. Меряя подпись, проверка находила
          // «мелкое нажатие» там, где палец попадает по области 300×400.
          // Поэтому: если у элемента есть растянутый на всю карточку слой,
          // берём рамку карточки, а не подписи.
          const зонаНажатия = (э) => {
            const своя = э.getBoundingClientRect();
            const слой = getComputedStyle(э, '::after');
            const растянут = слой.content !== 'none' && слой.position === 'absolute' &&
              ['top', 'right', 'bottom', 'left'].every(с => слой[с] === '0px');
            if (!растянут) return своя;
            const карточка = э.closest('[data-card-link]') || э.offsetParent;
            return карточка ? карточка.getBoundingClientRect() : своя;
          };

          document.querySelectorAll('a, button, [role="button"], input, select, summary').forEach(э => {
            const р = зонаНажатия(э);
            if (р.width === 0 || р.height === 0) return;
            if (getComputedStyle(э).visibility === 'hidden') return;
            if (р.width < 40 || р.height < 40) {
              итог.мелкиеНажатия.push({
                тег: э.tagName.toLowerCase(),
                текст: (э.textContent || э.getAttribute('aria-label') || '').trim().slice(0, 32),
                ш: Math.round(р.width), в: Math.round(р.height),
              });
            }
          });
          итог.мелкиеНажатия = итог.мелкиеНажатия.slice(0, 12);
        }

        // 5. Якоря, ведущие в никуда
        итог.мёртвыеЯкоря = [...document.querySelectorAll('a[href^="#"]')]
          .map(a => a.getAttribute('href'))
          .filter(h => h && h !== '#' && !document.querySelector(h))
          .slice(0, 10);

        // 6. Логотип в шапке: помещается ли и не налезает ли на соседа
        const шапка = document.querySelector('.header-logo');
        if (шапка) {
          const р = шапка.getBoundingClientRect();
          итог.логотипШапки = { ш: Math.round(р.width), в: Math.round(р.height), право: Math.round(р.right) };
          const сосед = document.querySelector('.site-nav, .header-contact, .burger');
          if (сосед) {
            const рс = сосед.getBoundingClientRect();
            if (рс.width > 0) итог.логотипШапки.зазорДоСоседа = Math.round(рс.left - р.right);
          }
        }

        // 7. Пустые заголовки и осечки текста
        итог.h1 = [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 60));
        итог.заглушки = (document.body.innerText.match(/\[[а-яё\s]{3,30}\]|lorem ipsum|TODO/gi) || []).slice(0, 8);

        return итог;
      }, { мобильный: экран.мобильный });

      // 8. Перелёт логотипа — только на главной студии
      if (стр.сайт === 'студия' && стр.имя === 'index') {
        замер.перелёт = await страница.evaluate(async () => {
          const пауза = мс => new Promise(r => setTimeout(r, мс));
          const рамка = с => { const э = document.querySelector(с); if (!э) return null; const р = э.getBoundingClientRect(); return { ш: +р.width.toFixed(1), x: +р.x.toFixed(1), y: +р.y.toFixed(1) }; };
          const hero = document.querySelector('.hero');
          if (!hero) return 'нет первого экрана';
          const путь = Math.max(1, hero.offsetHeight * 0.34);
          // Ждём не «столько-то миллисекунд», а самого события посадки.
          // Фиксированные 850 мс однажды дали ложную тревогу: на последней
          // из 64 проверок машина была занята, перелёт не успел завершиться,
          // и отчёт показал промах в 287 px там, где три отдельных прогона
          // подряд дали ноль. Ждать признак — надёжнее, чем ждать время.
          const ждатьПосадку = async (мс) => {
            const до = Date.now() + мс;
            while (Date.now() < до) {
              if (document.body.classList.contains('is-logo-docked')) return true;
              await пауза(50);
            }
            return false;
          };

          const кадры = [];
          for (const доля of [0, 0.5, 1.25]) {
            window.scrollTo(0, Math.round(путь * доля));
            await пауза(850);
            if (доля === 1.25) await ждатьПосадку(2500);
            кадры.push({
              прокрутка: Math.round(window.scrollY),
              знак: рамка('.brandmark--sign'), надпись: рамка('.brandmark--word'),
              местоЗнак: рамка('.header-logo__sign'), местоНадпись: рамка('.header-logo__word'),
              сел: document.body.classList.contains('is-logo-docked'),
            });
          }
          window.scrollTo(0, 0);
          await пауза(500);
          const п = кадры[кадры.length - 1];
          const промах = (a, b) => (!a || !b) ? null : {
            поX: +(a.x - b.x).toFixed(1), поY: +(a.y - b.y).toFixed(1), поШирине: +(a.ш - b.ш).toFixed(1),
          };
          return { путь: Math.round(путь), кадры, промахЗнака: промах(п.знак, п.местоЗнак), промахНадписи: промах(п.надпись, п.местоНадпись) };
        });
      }
    } catch (e) {
      замер.ошибка = String(e).slice(0, 200);
    }

    отчёт.push({ экран: экран.имя, ширина: экран.ширина, сайт: стр.сайт, страница: стр.имя, ошибкиКонсоли, сбои, ...замер });
    await страница.close();
  }
  await контекст.close();
}

await браузер.close();

fs.writeFileSync('/Users/nick/Desktop/Волосы/tools/отчёт-адаптива.json', JSON.stringify(отчёт, null, 1), 'utf8');

// Короткая сводка в консоль
let бед = 0;
for (const з of отчёт) {
  const б = [];
  if (з.ошибка) б.push('НЕ ОТКРЫЛАСЬ: ' + з.ошибка);
  if (з.сбои?.length) б.push('сбои: ' + з.сбои.join(' | '));
  if (з.ошибкиКонсоли?.length) б.push('консоль: ' + з.ошибкиКонсоли.join(' | '));
  if (з.перебор > 1) б.push(`горизонтальная прокрутка +${з.перебор}px: ` + з.виновники.map(в => `${в.тег}.${в.класс}(право ${в.право})`).join(', '));
  if (з.битыеКартинки?.length) б.push('битые фото: ' + з.битыеКартинки.join(', '));
  if (з.мелкиеНажатия?.length) б.push('мелкие нажатия: ' + з.мелкиеНажатия.map(м => `${м.тег}"${м.текст}"${м.ш}x${м.в}`).join(', '));
  if (з.мёртвыеЯкоря?.length) б.push('якоря в никуда: ' + з.мёртвыеЯкоря.join(', '));
  if (з.заглушки?.length) б.push('заглушки: ' + з.заглушки.join(', '));
  if (з.h1 && з.h1.length !== 1) б.push('h1 на странице: ' + з.h1.length);
  if (з.логотипШапки?.зазорДоСоседа !== undefined && з.логотипШапки.зазорДоСоседа < 8) б.push('логотип впритык к соседу: ' + з.логотипШапки.зазорДоСоседа + 'px');
  if (б.length) { бед += б.length; console.log(`\n[${з.экран} ${з.ширина}] ${з.сайт}/${з.страница}\n  - ` + б.join('\n  - ')); }
}
const главная = отчёт.filter(з => з.перелёт);
console.log('\n=== ПЕРЕЛЁТ ЛОГОТИПА ===');
for (const г of главная) console.log(г.экран, JSON.stringify({ промахЗнака: г.перелёт.промахЗнака, промахНадписи: г.перелёт.промахНадписи, сел: г.перелёт.кадры?.[2]?.сел }));
console.log(`\nВсего замечаний: ${бед}. Полный отчёт: tools/отчёт-адаптива.json`);
