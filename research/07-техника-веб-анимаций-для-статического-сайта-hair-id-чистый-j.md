# Техника веб-анимаций для статического сайта Hair ID (чистый JS/CSS, без тяжёлых фреймворков)

> Собрано автоматически 2026-09-04. Проверено вторым агентом-скептиком.
> Вердикты: ✅ подтверждено · ⚠️ сомнительно · ❌ опровергнуто · — не проверялось

## Что применяем

- Взять Lenis (менее 5 КБ, ноль зависимостей, lerp 0.1 по умолчанию) вместо самописного lerp-скролла: самопис через transform на обёртке ломает position: sticky/fixed, якорные ссылки и Ctrl+F — а на сайте Hair ID sticky-шапка с кнопкой «Записаться» обязательна.
- Инерцию скролла включать ТОЛЬКО на десктопе: matchMedia('(pointer: fine)'). NN/G прямо пишет, что на мобильных перехват скролла заметно хуже, а у мастера по волосам основной трафик — телефон, и человек ищет цену и способ записи, а не любуется плавностью.
- Не разбивать заголовки на буквы: по тестам Роселли (февраль 2026) большинство связок скринридеров ломается, плюс перестают работать копирование, перевод страницы и поиск по странице. Эффект «выезжающей строки» дать маской: overflow: hidden + одна анимация translateY(110%) → 0 на цельном заголовке.
- Если делаете раскрытие по словам — обязательно aria-label с полным текстом на h1/h2 и aria-hidden="true" на обёртке со спанами; исходный текст держать в HTML и разбивать из него же, иначе h1 «Реконструкция волос холодным способом» рискует попасть в выдачу Google по частям.
- Появление блоков (услуги, цены, до/после, отзывы) — один IntersectionObserver с unobserve после первого срабатывания, threshold 0.15, rootMargin '0px 0px -10% 0px', стаггер 60–100 мс через --i, с потолком min(--i, 6), чтобы последняя карточка не появлялась через секунду.
- Параллакс фото волос делать transform: translate3d, никогда background-position (Chrome прямо называет его причиной джанка). Картинку внутри контейнера брать на 15–20% выше самого контейнера, иначе на краях появятся щели.
- Морфинг логотипа в шапку — одна CSS scroll-driven анимация animation-timeline: scroll(root block) + animation-range: 0 220px, покрытие 87,22% браузеров, скраббит компositor. Логотип должен быть одним sticky-элементом, а не двумя копиями: FLIP между двумя узлами дрожит на мобильных. Fallback — sentinel + IntersectionObserver.
- Reveal-футер: main { position: relative; z-index: 1; background: непрозрачный } + footer { position: sticky; bottom: 0; z-index: 0 }, плюс transform: translate3d(0,0,0) на main против бага Safari. Категорически не использовать старый вариант с z-index: -1 — телефон, WhatsApp и адрес в футере перестанут нажиматься.
- Кастомный курсор для сайта услуг — не делать. Он не приносит записей, но масштабируется по-разному в macOS и Windows, теряет «горячую точку» и может помешать попасть по кнопке записи. Вместо него — мягкий hover-эффект на карточках услуг при системном курсоре.
- prefers-reduced-motion включать не как «отмену», а как базу: всё движение объявлять внутри @media (prefers-reduced-motion: no-preference), тогда при reduce блоки просто сразу видны, без мигания. Резать в первую очередь инерцию, параллакс, бегущую строку и раскрытие текста; оставить фейды 150–250 мс.
- Бегущая строка с услугами: дублировать контент ровно один раз, дубль пометить aria-hidden="true" (иначе скринридер прочитает прейскурант дважды), скорость = базовая + сглаженная |velocity| с потолком, петля через x += half.
- Дисциплина производительности: только transform и opacity в анимациях; box-shadow заменять на filter: drop-shadow() или opacity псевдоэлемента; scroll-слушатели с { passive: true } и rAF; will-change ставить перед анимацией и снимать по transitionend; помнить бюджет кадра 16,7 мс и что Safari ограничен 60 fps, а энергосбережение — 30 fps.

---

## Находки

### 1. — Инерционный smooth-scroll на lerp: базовый рабочий рецепт — тело держит высоту контента ради нативного скроллбара, а обёртка контента фиксируется и двигается через translate3d

Формула из статьи Codrops: lerp = (a, b, n) => (1 - n) * a + n * b, коэффициент ease = 0.1. Тело получает высоту контента, чтобы сохранить скроллбар; обёртка — position: fixed; overflow: hidden, внутренний блок двигается transform: translate3d(0, -Ypx, 0).

Код:
const lerp = (a, b, n) => (1 - n) * a + n * b;
const wrap = document.querySelector('.scroll-content');
let current = 0, target = 0, ease = 0.1, rafId = null;

function setBodyHeight() {
  document.body.style.height = wrap.getBoundingClientRect().height + 'px';
}
setBodyHeight();
new ResizeObserver(setBodyHeight).observe(wrap);

function raf() {
  target = window.scrollY;
  current = lerp(current, target, ease);
  if (Math.abs(target - current) < 0.1) current = target; // добиваем хвост, чтобы rAF не крутился вечно
  wrap.style.transform = `translate3d(0, ${-current}px, 0)`;
  rafId = requestAnimationFrame(raf);
}
raf();

CSS:
.scroll-container { position: fixed; inset: 0; overflow: hidden; }
.scroll-content { will-change: transform; }

Коэффициент: 0.08 — очень «тягучий» шлейф, 0.10 — стандарт (дефолт Lenis), 0.12–0.15 — почти нативное ощущение. Чем меньше число, тем длиннее инерция.

*Уверенность: высокая · Источник: https://tympanus.net/codrops/2019/07/10/how-to-add-smooth-scrolling-with-inner-image-animations-to-a-web-page/*

### 2. ⚠️ Главная проблема самописного lerp-скролла: transform на обёртке ломает position: fixed и position: sticky внутри неё, плюс страдают якорные ссылки, поиск по странице (Ctrl+F) и клавиатурная навигация

Причина: элемент с ненулевым transform создаёт новый containing block, и любой position: fixed внутри него начинает вести себя как absolute относительно этой обёртки. Sticky тоже перестаёт работать, потому что скролл-контейнер теперь не двигается. Именно это Lenis подаёт как своё главное отличие: библиотека не трогает CSS-трансформы обёртки, а оставляет нативный скролл и накладывает поверх слой интерполяции — «position: sticky, anchor links и доступность продолжают работать», «no CSS transforms, no hijacked scrollbars, no accessibility trade-offs» (формулировки с лендинга и README Lenis).

Обходные пути для самописа, если библиотеку не брать:
1) Всё фиксированное (шапка, кнопка «Записаться», кастомный курсор) выносить СНАРУЖИ трансформируемой обёртки — отдельными детьми body.
2) Якорные ссылки обрабатывать вручную: e.preventDefault() + window.scrollTo({ top: el.offsetTop, behavior: 'smooth' }).
3) Ctrl+F и tab-фокус: браузер прокручивает нативно, а визуально контент не двигается — нужно слушать focusin и подтягивать target.
Вывод: список костылей длинный, и это главный аргумент за Lenis.

*Уверенность: высокая · Источник: https://lenis.dev/*

> **Проверка:** Указанный источник этого не пишет. На lenis.dev есть только общая фраза «Smooth scroll used to be a hard sell — hacky, heavy, inaccessible. Not anymore» — без перечня проблем. Одну часть утверждения удалось подтвердить независимо: MDN (Web/CSS/position) прямо говорит, что любой предок с transform/perspective/filter ≠ none становится containing block для position:fixed потомков, то есть fixed ломается. Остальное (sticky, якоря, поиск по странице, клавиатура) — правдоподобное следствие того, что контент лежит в fixed-контейнере и браузеру некуда его прокручивать, но подтверждающего источника в рамках этой проверки не нашлось. Формулировку «главная проблема» считать оценкой автора, а не установленным фактом.

### 3. — Lenis: заявленный вес «менее 5 КБ», ноль зависимостей; дефолты — lerp 0.1, duration 1.2 с, syncTouch: false, smoothWheel: true; prefers-reduced-motion уважается по умолчанию

С сайта lenis.dev: «Lightweight (under 5kb)», «keeps everything accessible and under 5kb», «no accessibility trade-offs». Из README (github.com/darkroomengineering/lenis): lerp = 0.1, duration = 1.2, easing = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), syncTouch = false, smoothWheel = true. README прямо говорит, что библиотека по умолчанию уважает prefers-reduced-motion (сглаживание выключается, программные скроллы происходят мгновенно), и доступно свойство lenis.prefersReducedMotion.

Минусы и предупреждения из README: touch-события могут вести себя непредсказуемо при syncTouch на iOS < 16; Safari ограничен 60 fps, устройства в режиме энергосбережения — 30 fps; плавный скролл не работает через iframe.

Подключение:
<script src="https://cdnjs.cloudflare.com/ajax/libs/lenis/1.1.13/lenis.min.js"></script>
<script>
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
</script>

Вердикт для проекта: брать Lenis. 5 КБ дешевле, чем список костылей из предыдущего пункта; самопис на lerp оправдан, только если на странице нет ни одного sticky/fixed элемента.

*Уверенность: высокая · Источник: https://github.com/darkroomengineering/lenis/blob/main/README.md*

### 4. — Nielsen Norman Group: перехват скролла (scrolljacking) вызывает дезориентацию у большинства участников тестов, особенно хуже на мобильных и на страницах с текстом; рекомендация — исключить на мобильных

Статья «Scrolljacking 101», опубликована 6 августа 2023. Ключевые формулировки: «The majority of our study participants were at least mildly disoriented by scrolljacking»; страницы, где изменённая скорость скролла сочеталась с необходимостью читать текст, дали самые тяжёлые проблемы юзабилити; отдельный раздел «Scrolljacking is Worse on Mobile» — на маленьких экранах дезориентация сильнее. Задачно-ориентированные пользователи (а на сайте мастера по волосам это как раз те, кто ищет цену и способ записаться) наименее терпимы: один участник сказал, что «severely agitated and just move on».

Практический вывод для Hair ID: инерцию включать только на десктопе и держать её мягкой (lerp 0.1–0.12, не 0.05). Код-гейт:
const isFine = matchMedia('(pointer: fine)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (isFine && !reduce) { new Lenis({ lerp: 0.1 }); }

Цифр по количеству участников и процентам в статье не приводится — только качественные формулировки.

*Уверенность: высокая · Источник: https://www.nngroup.com/articles/scrolljacking-101/*

### 5. — Появление при скролле через IntersectionObserver: рабочий паттерн — один наблюдатель на все элементы, unobserve после первого срабатывания, стаггер через CSS-переменную и transition-delay

IntersectionObserver работает асинхронно и не блокирует главный поток — принципиально дешевле обработчика scroll (MDN, CSS-Tricks). Если анимация должна проиграть один раз, после первого пересечения элемент снимают с наблюдения через unobserve, а не переключают класс туда-обратно.

CSS:
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity .6s cubic-bezier(.22,.61,.36,1), transform .6s cubic-bezier(.22,.61,.36,1);
  transition-delay: calc(var(--i, 0) * 80ms);
}
.reveal.is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; transition-delay: 0s; }
}

JS:
const io = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    obs.unobserve(entry.target); // важно: один раз и отпустили
  });
}, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

document.querySelectorAll('[data-reveal]').forEach(el => {
  el.classList.add('reveal');
  io.observe(el);
});
// стаггер внутри группы
document.querySelectorAll('[data-reveal-group]').forEach(group => {
  [...group.children].forEach((child, i) => child.style.setProperty('--i', i));
});

rootMargin с отрицательным нижним значением заставляет анимацию стартовать, когда блок уже заметно вошёл в экран, а не краем. Шаг стаггера 60–100 мс; на группе больше 6–8 элементов ставьте потолок: calc(min(var(--i), 6) * 80ms), иначе последняя карточка появится через секунду после первой.

*Уверенность: высокая · Источник: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API*

### 6. — Разбиение заголовков на буквы ломает скринридеры в большинстве связок — эксперт по доступности Адриан Роселли рекомендует не делать побуквенное разбиение вообще

Статья «You Know What? Just Don't Split Words into Letters» (adrianroselli.com, февраль 2026). Тестирование GSAP SplitText: NVDA/Firefox — работает; JAWS/Chrome, Narrator/Edge, VoiceOver macOS, Orca/Firefox, TalkBack/Firefox, VoiceOver iPadOS — не отдают текст корректно (одни читают по буквам, другие пропускают буквы, третьи вообще молчат). Отдельная проблема: <div> отображается в ARIA-роль generic, а generic-роль не допускает авторского имени, то есть aria-label на ней запрещён.

Кроме скринридеров ломается: выделение и копирование текста, машинный перевод страницы, поиск по странице.

Цитата позиции автора: «If you need to split words into their constituent letters... well, no you don't. Find another method.»

Вывод для Hair ID: побуквенное раскрытие H1 — не делать. Заменить на пословное или построчное (см. следующий пункт), либо на маску: обычный текст в блоке с overflow: hidden, а внутри одна анимация transform: translateY(100%) → 0. Визуально эффект «выезжающей строки» тот же, разметка не рвётся.

*Уверенность: высокая · Источник: http://adrianroselli.com/2026/02/you-know-what-just-dont-split-words-into-letters.html*

### 7. — Если разбиение всё-таки нужно — безопасный компромисс: разбивать на СЛОВА (не буквы), вешать aria-label с полным текстом на элемент, которому разрешено авторское имя (h1/h2), а обёртку со спанами скрывать через aria-hidden

Паттерн из CSS { In Real Life } «How to Accessibly Split Text»: aria-label несёт полный читаемый текст, aria-hidden="true" прячет от скринридера разбитые части.

Разметка:
<h1 class="split" aria-label="Реконструкция волос холодным способом">
  <span aria-hidden="true"><span class="w">Реконструкция</span> <span class="w">волос</span> <span class="w">холодным</span> <span class="w">способом</span></span>
</h1>

JS-разбиение без потери SEO (важно: исходный текст ДОЛЖЕН быть в HTML, разбиение делаем из него же — так краулер и no-JS видят нормальный заголовок):
document.querySelectorAll('[data-split]').forEach(el => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  const inner = document.createElement('span');
  inner.setAttribute('aria-hidden', 'true');
  inner.innerHTML = text.split(/\s+/)
    .map((w, i) => `<span class="line"><span class="w" style="--i:${i}">${w}</span></span>`)
    .join(' ');
  el.textContent = '';
  el.append(inner);
});

CSS (маска):
.line { display: inline-block; overflow: hidden; vertical-align: bottom; }
.w { display: inline-block; transform: translateY(110%); transition: transform .7s cubic-bezier(.22,.61,.36,1); transition-delay: calc(var(--i) * 60ms); }
.is-visible .w { transform: none; }

SEO-оговорка из документации GSAP SplitText: если разбивается <h1>, обязательно заполнить title и description страницы и оставить aria: "auto", иначе разбитый заголовок может попасть в выдачу Google по частям.

*Уверенность: высокая · Источник: https://css-irl.info/how-to-accessibly-split-text/*

### 8. — Параллакс: анимировать можно только transform и opacity; background-position заставляет браузер перерисовывать область на каждом кадре и заметно дёргает анимацию

Chrome for Developers, «Performant Parallaxing»: «Many solutions attempt to change background-position to provide the parallax look, which causes the browser to repaint the affected parts of the page on scroll, and that can be costly enough to significantly jank the animation». Дешёвые для анимации свойства — transform и opacity, они остаются на стадии композитинга.

Вариант А — чистый CSS через perspective, вообще без JS и без scroll-обработчиков (рекомендация Chrome):
.scroller { height: 100vh; overflow-y: auto; perspective: 1px; perspective-origin: 0 0; }
.layer-back { transform: translateZ(-2px) scale(3); } /* scale = (perspective - distance)/perspective */
.layer-front { transform: translateZ(0); }
Минус: контейнер со своим скроллом плохо дружит с Lenis и с мобильными адресными строками.

Вариант Б — JS, но правильно: rect читаем в IntersectionObserver, а не в цикле, и пишем только transform.
const items = [...document.querySelectorAll('[data-parallax]')];
let ticking = false;
function update() {
  ticking = false;
  const vh = innerHeight;
  for (const el of items) {
    if (!el.dataset.inview) continue;
    const r = el.getBoundingClientRect();          // читаем
    const p = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
    const speed = parseFloat(el.dataset.parallax) || 0.15;
    el.style.transform = `translate3d(0, ${(-p * speed * 100).toFixed(2)}px, 0)`; // пишем
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
const io = new IntersectionObserver(es => es.forEach(e => { e.target.dataset.inview = e.isIntersecting ? '1' : ''; }));
items.forEach(el => io.observe(el));

Ключевые детали: слушатель scroll с { passive: true }; все чтения rect идут до всех записей style (иначе layout thrashing); картинка внутри параллакс-контейнера должна быть на 15–20% выше контейнера, иначе на краях появятся щели; will-change: transform ставить только на реально движущиеся слои.

*Уверенность: высокая · Источник: https://developer.chrome.com/blog/performant-parallaxing*

### 9. — Бегущая строка со скоростью, зависящей от скорости скролла: считать velocity как разницу scrollY между кадрами, сглаживать через lerp, ограничивать потолком и добавлять к базовой скорости

Приём подтверждается разбором CodePen «js marquee with scroll velocity» (codepen.io/remid/pen/LamKdo): в цикле requestAnimationFrame вычисляется скорость скролла, применяется lerp-сглаживание и потолок скорости (в том примере maxSpeed = 20), направление берётся из знака дельты.

Разметка: контент дублируется ровно один раз, чтобы шов был бесшовным.
<div class="marquee"><div class="marquee__track"><span>реконструкция · ботокс · кератин · СПА · </span><span aria-hidden="true">реконструкция · ботокс · кератин · СПА · </span></div></div>

CSS:
.marquee { overflow: hidden; white-space: nowrap; }
.marquee__track { display: inline-flex; will-change: transform; }

JS:
const track = document.querySelector('.marquee__track');
const half = track.scrollWidth / 2;
let x = 0, base = 0.6, vel = 0, target = 0, last = scrollY;

function lerp(a, b, n) { return (1 - n) * a + n * b; }

addEventListener('scroll', () => {
  target = Math.max(-14, Math.min(14, (scrollY - last) * 0.35)); // потолок ±14 px/кадр
  last = scrollY;
}, { passive: true });

function loop() {
  target = lerp(target, 0, 0.06);   // затухание после остановки скролла
  vel = lerp(vel, target, 0.12);    // сглаживание рывков
  x -= base + Math.abs(vel);        // скорость всегда >= базовой
  if (x <= -half) x += half;        // бесшовная петля
  track.style.transform = `translate3d(${x}px,0,0)`;
  requestAnimationFrame(loop);
}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) loop();

Вариант «строка меняет направление при скролле вверх»: x -= base + vel (без Math.abs) — но тогда при быстром скролле вверх строка поедет назад, что читается как глюк; для сайта услуг лучше Math.abs. Дубль контента обязательно с aria-hidden="true", иначе скринридер прочитает список услуг дважды.

*Уверенность: средняя · Источник: https://codepen.io/remid/pen/LamKdo*

### 10. — Морфинг логотипа «большой в герое → маленький в шапке» в 2026 делается CSS scroll-driven анимацией: animation-timeline: scroll() + animation-range; поддержка 87,22% по caniuse (Chrome/Edge 115+, Safari 26+, Firefox 158+)

caniuse (снимок данных ~август 2026) для animation-timeline: scroll(): Chrome 115+, Edge 115+, Safari 26.0+, Firefox 158+, глобальное покрытие 87,22%. Скраббинг выполняет компositor, а не обработчик scroll, поэтому анимация не зависит от загруженности главного потока.

CSS (одна анимация на первые 220 px скролла):
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: scroll()) {
    .logo {
      animation: logo-shrink linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 220px;
      transform-origin: left center;
    }
    .site-header {
      animation: header-solid linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 220px;
    }
  }
}
@keyframes logo-shrink {
  from { scale: 1;   translate: 0 18vh; }
  to   { scale: .38; translate: 0 0; }
}
@keyframes header-solid {
  from { background: transparent; box-shadow: none; }
  to   { background: var(--bg); box-shadow: 0 1px 0 rgba(0,0,0,.08); }
}

Важно: логотип должен быть ОДНИМ элементом в шапке (position: sticky/fixed), который в начальном состоянии просто увеличен и опущен вниз — тогда «морфинг» это чистая интерполяция scale/translate без FLIP и без двух копий. Два разных DOM-узла (в герое и в шапке) потребуют FLIP-расчёта через getBoundingClientRect и почти всегда дают дрожание на мобильных.

Fallback для 13% браузеров: внутри @supports not (animation-timeline: scroll()) — простой sentinel-элемент высотой 1 px в начале страницы + IntersectionObserver, который вешает класс .is-compact на шапку, а .logo получает обычный CSS transition на scale.

*Уверенность: высокая · Источник: https://caniuse.com/mdn-css_properties_animation-timeline_scroll*

### 11. ✅ Scroll-state контейнерные запросы (@container scroll-state(stuck: top)) — только Chromium: Chrome/Edge 133+, ни Safari, ни Firefox; глобально 71,73%, поэтому это прогрессивное улучшение, а не основа для «залипающей» навигации

caniuse по container-type: scroll-state: Chrome 133+, Edge 133+, Safari — не поддерживает (3.1–27), Firefox — не поддерживает (2–158), глобальное покрытие 71,73%.

Надёжный кросс-браузерный рецепт «шапка знает, что залипла» — sentinel + IntersectionObserver, работает везде:
<div class="sentinel" aria-hidden="true"></div>
<header class="site-header">…</header>

.sentinel { position: absolute; top: 0; height: 1px; width: 100%; }
.site-header { position: sticky; top: 0; z-index: 50; transition: background .25s ease, box-shadow .25s ease, padding .25s ease; }
.site-header.is-stuck { background: var(--bg); box-shadow: 0 1px 0 rgba(0,0,0,.08); padding-block: .5rem; }

const header = document.querySelector('.site-header');
new IntersectionObserver(([e]) => header.classList.toggle('is-stuck', !e.isIntersecting))
  .observe(document.querySelector('.sentinel'));

Поверх — прогрессивное улучшение для Chromium:
@supports (container-type: scroll-state) {
  .site-header { container-type: scroll-state; }
  @container scroll-state(stuck: top) { .site-header__inner { padding-block: .5rem; } }
}

Отдельно про sticky-секции: работает только если у элемента задан top (или bottom) и родитель выше самого элемента; любой предок с overflow: hidden/auto убивает sticky — это самая частая причина «почему не липнет».

*Уверенность: высокая · Источник: https://caniuse.com/mdn-css_properties_container-type_scroll-state*

> **Проверка:** caniuse: «71.73% + 0% = 71.73%», Chrome 133+, Edge 133+, Opera 118+, Samsung Internet 29+; Firefox — «Not supported» по всем версиям до 158, Safari — «Not supported» 3.1–27. Вывод «не основа для залипающей навигации, только надстройка» из этих данных следует прямо: базовое поведение sticky-шапки нужно делать обычным position: sticky, а scroll-state добавлять сверху для смены стиля.

### 12. — Reveal-футер (выезжает из-под контента) делается чистым CSS без JS: main получает position: relative + z-index: 1 + непрозрачный фон, футер — position: sticky; bottom: 0; z-index: 0

Рецепт Piccalilli «Sticky revealing footer»:
main { position: relative; z-index: 1; background: var(--color-light); }
footer { position: sticky; bottom: 0; left: 0; z-index: 0; }

Механика: position: relative на main создаёт новый контекст наложения, main едет поверх футера, футер остаётся прилипшим к низу окна и «проявляется» по мере того, как контент уезжает вверх.

Две оговорки из источника:
1) Фон у main обязателен — без непрозрачного фона футер будет просвечивать сквозь контент при скролле.
2) Safari бывает проблемным: z-index «отваливается» на секунду-другую. Лечится transform: translate3d(0, 0, 0) на main (принудительная аппаратная композиция).

Отдельно — чего НЕ делать: распространённый старый вариант с position: fixed и z-index: -1 у футера ломает кликабельность — футер уходит за документ, визуально виден, но ссылки и кнопки в нём не нажимаются (разбор на CSS-Tricks). Для Hair ID это критично: в футере телефон, WhatsApp и адрес — они обязаны быть кликабельными, поэтому только sticky-вариант с z-index: 0/1.

Высота футера при этом не должна превышать высоту экрана, иначе на мобильных верх футера будет недостижим.

*Уверенность: высокая · Источник: https://piccalil.li/blog/sticky-revealing-footer/*

### 13. — Кастомный курсор: обязательно гейтить через @media (hover: hover) and (pointer: fine) — на тач-устройствах он не рисуется, а код всё равно грузится и слушатели висят

Рекомендация из разбора доступности кастомных курсоров (dbushell.com, 27.10.2025) и обзора 21st.dev: «Gate the whole thing behind matchMedia("(pointer: fine)") and do not mount it otherwise».

JS (lerp-задержка):
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (fine && !calm) {
  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.append(dot);
  let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  (function loop() {
    x += (mx - x) * 0.14;   // 0.1 — вязкий шлейф, 0.5 — почти без задержки
    y += (my - y) * 0.14;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
}

CSS:
.cursor { position: fixed; top: 0; left: 0; width: 28px; height: 28px; border: 1px solid currentColor; border-radius: 50%; pointer-events: none; z-index: 9999; }
@media (hover: none), (pointer: coarse) { .cursor { display: none; } }

Когда кастомный курсор делать НЕ надо (по dbushell): размер курсора не масштабируется одинаково между ОС — на macOS он тянется за системной настройкой размера указателя и может стать «комично огромным», а на Windows CSS-курсор системную настройку игнорирует вовсе; у самодельного курсора часто нет очевидной «горячей точки»; контраст относительно страницы никто не проверяет. Рекомендации автора: держать размер близким к системному по умолчанию, делать явный hotspot, обеспечивать контраст и НИКОГДА не прятать нативный курсор без запасного варианта.

Для сайта услуг с записью: кастомный курсор — чистый риск. Он не добавляет ни одной конверсии, но может помешать попасть по кнопке «Записаться». Если очень хочется — делать не замену курсора, а мягкий hover-эффект на элементах и оставить системный указатель.

*Уверенность: высокая · Источник: https://dbushell.com/2025/10/27/custom-cursor-accessibility/*

### 14. — prefers-reduced-motion: правильный подход — не «выключить всё», а уменьшить движение; безопасная замена — оставить прозрачность и сократить длительность

Формулировка принципа: цель — сократить или заменить необязательное движение, а не убрать анимацию целиком; фейды по opacity и укороченные длительности остаются безопасной альтернативой. WCAG 2.3.3 «Animation from Interactions» (уровень AAA) требует возможности отключить анимацию, вызванную действиями пользователя, если она не критична для функциональности.

Лучший паттерн — не «отменять» правилами-перекрытиями, а изначально включать движение только внутри no-preference (подход Josh W. Comeau):
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s, transform .6s; }
  .logo { animation: logo-shrink linear both; animation-timeline: scroll(root block); }
}
Тогда при reduce элементы просто сразу видны и никакого «мигания» не будет.

Если база уже написана с анимациями, страховочный блок:
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}

JS-сторона (обязательно с реакцией на смену настройки на лету):
const mq = matchMedia('(prefers-reduced-motion: reduce)');
function applyMotion() {
  if (mq.matches) { lenis?.destroy(); document.body.dataset.motion = 'reduced'; }
  else { document.body.dataset.motion = 'full'; }
}
mq.addEventListener('change', applyMotion); applyMotion();

Что именно резать в первую очередь для Hair ID: инерцию скролла, параллакс, бегущую строку, побуквенные раскрытия, кастомный курсор. Что можно оставить: короткие opacity-фейды 150–250 мс и hover-подсветку кнопок.

*Уверенность: высокая · Источник: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html*

### 15. — Производительность: анимировать только transform и opacity — они выполняются на композиторе, минуя layout и paint; width/height/top/left/margin/padding/box-shadow/filter пересчитывают раскладку или перерисовку каждый кадр

web.dev «Animations guide»: безопасно анимировать transform и opacity, «avoid any property that triggers layout or paint unless it's absolutely necessary». Motion.dev performance guide: transform и opacity — самые безопасные значения на всех устройствах; layout-триггеры (height, border-width, padding, position) требуют дорогих пересчётов, ререндер «легко занимает больше 100 мс». Бюджет кадра: 16,7 мс для 60 fps и 8 мс для 120 fps.

Чек-лист «что убивает FPS» на статическом сайте:
1. Анимация left/top/width/height/margin вместо transform — layout каждый кадр.
2. Анимация box-shadow и filter: blur() — тяжёлый paint; вместо box-shadow анимировать filter: drop-shadow() или менять opacity у псевдоэлемента с готовой тенью.
3. Чтение getBoundingClientRect/offsetTop вперемешку с записью style в одном цикле — layout thrashing. Правило: сначала все чтения, потом все записи.
4. Обработчик scroll без { passive: true } и без requestAnimationFrame-троттлинга.
5. will-change навсегда: «leaving will-change on permanently wastes GPU memory»; web.dev советует применять точечно и снимать после анимации. Десятки-сотни композиторных слоёв (will-change на элементах списка, много position: fixed) — верный признак проблемы.
6. Десятки одновременно анимируемых элементов — даже дешёвые свойства в сумме роняют кадры.
7. Большие несжатые изображения в параллаксе: каждый кадр композиция огромной текстуры. Использовать WebP/AVIF и разумные размеры.

Практика снятия will-change:
el.style.willChange = 'transform';
el.addEventListener('transitionend', () => { el.style.willChange = 'auto'; }, { once: true });

Мобильная оговорка из README Lenis: Safari ограничен 60 fps, устройства в режиме энергосбережения — 30 fps; это надо закладывать в ожидания, а не пытаться «дожать».

*Уверенность: высокая · Источник: https://web.dev/articles/animations-guide*

### 16. — Стаггер можно делать и нативным CSS без JS-переменных — через sibling-index() в animation-delay, но это свежая фича, поэтому для продакшена надёжнее задавать --i из JS

LogRocket, «Native CSS stagger animations with sibling-index()»: animation-delay: calc(sibling-index() * 40ms) даёт стаггер без единой строки JS. Та же логика используется в современном CSS-marquee: индивидуальная задержка каждому элементу через sibling-index() и sibling-count() без дублирования разметки.

Прагматичный вывод для Hair ID: базовый слой — --i из JS (работает везде), а sibling-index() добавлять как улучшение внутри @supports, если понадобится. Для сайта из 5–7 секций разница незаметна, поэтому проще не усложнять и оставить один цикл проставления --i.

document.querySelectorAll('[data-stagger] > *').forEach((el, i) => el.style.setProperty('--i', i));

*Уверенность: средняя · Источник: https://blog.logrocket.com/native-css-stagger-sibling-index/*

### 17. — Точный вес Lenis в килобайтах (minified+gzip) из независимого измерителя подтвердить не удалось — доступны только заявления самого проекта

Страница bundlephobia.com/package/lenis вернула только метаданные без цифр размера, npmjs.com/package/lenis отдал HTTP 403. Подтверждённые формулировки — только от самого проекта: сайт lenis.dev — «Lightweight (under 5kb)», README на GitHub — «a few KB» без точной цифры, зависимостей в рантайме нет. Одна из сторонних статей упоминает «3KB», другая «под 4kb», но это вторичные пересказы без ссылки на измерение, поэтому опираться на них не стоит. Для оценки бюджета страницы закладывайте «до 5 КБ gzip» как верхнюю границу.

*Уверенность: низкая · Источник: не подтверждено*

