/**
 * HAIR ID — texture.js
 *
 * Три слоя фона: фотографическая фактура, живая пудра и блёстки.
 *
 * ПОЧЕМУ ЧЕРЕЗ СКРИПТ, А НЕ В РАЗМЕТКЕ. Фактура — украшение. Если вписать её
 * восемнадцатью блоками в HTML, разметка распухнет, а поменять фон в разделе
 * станет отдельной работой. Здесь это один атрибут на секции:
 *
 *   <section class="section services" data-tex="cream-soft">
 *
 * Картинка при этом остаётся настоящим <img loading="lazy">, а не фоном в CSS:
 * фоновые картинки браузер тянет сразу все, а отложенные — только когда до них
 * доскроллили. Восемь фонов по сто килобайт на первом экране никому не нужны.
 *
 * ПУДРА И БЛЁСТКИ — на библиотеке Sparticles (js/vendor/sparticles.min.js,
 * лицензия MPL-2.0, автор simeydotme, sparticlesjs.dev). Файл лежит у нас,
 * без обращений к чужим серверам, и не изменён — MPL этого и требует.
 * Взята она, а не написана своя: у частиц из библиотеки есть то, что вручную
 * пишется долго и плохо — мерцание с собственной скоростью, снос вбок,
 * свечение, звёздчатая форма, разные размеры с разной скоростью.
 *
 * Два разных слоя, потому что это два разных явления:
 *   data-powder  — пыль в луче: много, мелко, тихо, золотисто-кремовая;
 *   data-sparkle — блёстки: редкие звёздочки, вспыхивают и гаснут.
 *
 * Что здесь важнее самого эффекта:
 *   — не рисуем, пока раздел не на экране (IntersectionObserver);
 *   — не рисуем, когда вкладка спрятана;
 *   — не рисуем вовсе, если человек отключил анимации в системе;
 *   — количество считается от площади: на телефоне частиц втрое меньше;
 *   — на слабой машине (мало ядер) количество режется ещё вдвое.
 */

(function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Слабая машина: два ядра тянут холсты с частицами заметно хуже.
  // Не выключаем эффект совсем — уменьшаем плотность.
  var weak = (navigator.hardwareConcurrency || 4) <= 2;

  // ---------------------------------------------------------------------------
  // Фактура
  // ---------------------------------------------------------------------------

  var SIZES = {
    'cream-abstract': [1400, 875],
    'cream-gloss': [1400, 1750],
    'cream-soft': [1400, 933],
    'foam': [1400, 933],
    'hair-close': [1400, 933],
    'hair-dark': [1400, 2100],
    'powder-gold': [1400, 951],
    'powder-green': [1400, 2100]
  };

  // Папка с фактурами. Сборка docs/ склеивает одинаковые файлы студии
  // и магазина в одну копию и переписывает эту строку целиком, поэтому путь
  // задан одной константой, а не собирается по кусочкам в месте применения:
  // путь, собранный из кусков, сборка не видит, файл при склейке удаляется,
  // и на живом сайте фактуры отдают 404.
  var ПАПКА_ФАКТУР = 'assets/photo/';

  var FILES = {
    'cream-abstract': 'bg-cream-abstract.jpg',
    'cream-gloss': 'bg-cream-gloss.jpg',
    'cream-soft': 'bg-cream-soft.jpg',
    'foam': 'bg-foam-1.jpg',
    'hair-close': 'bg-hair-close.jpg',
    'hair-dark': 'bg-hair-dark.jpg',
    'powder-gold': 'bg-powder-gold.jpg',
    'powder-green': 'bg-powder-green.jpg'
  };

  function initTextures() {
    // Фактуры создаются НЕ разом при загрузке, а по мере подхода раздела
    // к экрану. Замер на главной (1440×900, 15 фактур): при создании всех
    // сразу средний кадр при прокрутке был 56 мс — это 18 кадров в секунду
    // вместо 60, и прокрутка ощутимо дёргалась. Причина не в параллаксе
    // (его снятие давало 2 мс), а в самих картинках: пятнадцать снимков
    // во весь экран декодируются и держатся в памяти одновременно.
    var ждущие = [];

    document.querySelectorAll('[data-tex]').forEach(function (section) {
      var key = section.getAttribute('data-tex');
      if (!FILES[key]) return;
      ждущие.push(section);
    });

    if (!ждущие.length) return;

    var создать = function (section) {
      if (section.querySelector(':scope > .tex')) return;

      var key = section.getAttribute('data-tex');
      var file = FILES[key];
      var size = SIZES[key] || [1400, 933];

      var layer = document.createElement('div');
      layer.className = 'tex';
      layer.setAttribute('aria-hidden', 'true');

      var img = document.createElement('img');
      // Ширина копии выбирается по фактическому размеру раздела, а не по
      // «телефон или нет»: фактура лежит под текстом с прозрачностью 0,34,
      // и на ней растяжение узкой копии не читается, а вес отличается вдвое.
      // Узкая копия (700 px) берётся почти всегда, а не только на телефоне.
      // Фактура лежит под текстом с прозрачностью 0,34 и ещё под вуалью —
      // растяжение вдвое на ней не читается, а декодировать вдвое меньше.
      // На широком экране (больше 1600 px) берём полную: там разница
      // уже может стать заметной на однотонных участках.
      var ширина = section.getBoundingClientRect().width || window.innerWidth;
      var узкий = ширина <= 1600;
      img.src = ПАПКА_ФАКТУР + (узкий ? file.replace(/\.jpg$/, '-700.jpg') : file);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = size[0];
      img.height = size[1];

      // Параллакса у фактуры нет намеренно. Замер на главной студии
      // (1440x900, 15 фактур): с ним средний кадр при прокрутке 48,6 мс,
      // без него 40,6 мс — восемь миллисекунд на каждом кадре. При этом
      // движение не видно: фактура лежит под текстом с прозрачностью 0,34,
      // и сдвиг на 4% под полупрозрачной вуалью человек не различает.
      // Собственный слой .powder ниже двигается по-прежнему — там движение
      // как раз заметно, а стоит оно дешевле: частицы рисуются в canvas.

      var markLoaded = function () { img.classList.add('is-loaded'); };
      if (img.complete && img.naturalWidth) markLoaded();
      else img.addEventListener('load', markLoaded, { once: true });

      var veil = document.createElement('span');
      veil.className = 'tex__veil';

      layer.appendChild(img);
      layer.appendChild(veil);
      section.insertBefore(layer, section.firstChild);

      // Параллакс узнаёт о новом элементе только через пересбор списка.
      if (window.HairIDMotion && window.HairIDMotion.refresh) window.HairIDMotion.refresh();
    };

    if (!('IntersectionObserver' in window)) {
      // Старый браузер: делаем как раньше, всё сразу. Лучше медленно, чем никак.
      ждущие.forEach(создать);
      return;
    }

    var наблюдатель = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        наблюдатель.unobserve(e.target);
        создать(e.target);
      });
    }, { rootMargin: '400px 0px' });

    ждущие.forEach(function (s) { наблюдатель.observe(s); });
  }

  // ---------------------------------------------------------------------------
  // Частицы: пудра и блёстки
  // ---------------------------------------------------------------------------

  // Пыль в луче света. Всплывает (direction 0 — вверх), сносится вбок,
  // мерцает. Цвета из фирменной палитры, не белые: белая пыль на кремовом
  // фоне читается как грязь на объективе.
  var DUST = {
    color: ['#d9bd88', '#efe4cd', '#c9a75f'],
    composition: 'source-over',
    direction: 0,
    drift: 1.8,
    glow: 0,
    minAlpha: 0.04,
    maxAlpha: 0.5,
    minSize: 1,
    maxSize: 3.4,
    parallax: 1.6,
    rotate: false,
    shape: 'circle',
    speed: 1.4,
    style: 'fill',
    twinkle: true,
    alphaSpeed: 6,
    alphaVariance: 1,
    xVariance: 1.6,
    yVariance: 0.5
  };

  // Блёстки. Их мало, они крупнее, со свечением, вспыхивают резче —
  // за это отвечает высокая alphaSpeed вместе с twinkle.
  var SPARK = {
    color: ['#f3dca6', '#fff7e6', '#d7b877'],
    composition: 'source-over',
    direction: 0,
    drift: 0.8,
    glow: 10,
    minAlpha: 0,
    maxAlpha: 0.92,
    minSize: 2,
    maxSize: 6,
    parallax: 1,
    rotate: true,
    rotation: 0.4,
    shape: 'star',
    speed: 0.8,
    style: 'fill',
    twinkle: true,
    alphaSpeed: 14,
    alphaVariance: 2,
    xVariance: 1,
    yVariance: 0.8
  };

  // Плотность считается от площади раздела, а не задаётся числом:
  // один и тот же раздел на мониторе втрое шире, чем на телефоне.
  function countFor(area, perParticle, cap) {
    var n = Math.round(area / perParticle);
    if (weak) n = Math.round(n / 2);
    return Math.max(6, Math.min(cap, n));
  }

  function makeLayer(host, kind) {
    var box = document.createElement('div');
    box.className = 'powder powder--' + kind;
    box.setAttribute('aria-hidden', 'true');

    // В конец, а не в начало: частицы должны лежать поверх фотографической
    // фактуры и поверх фона первого экрана, но под текстом — текст сидит
    // в .container с z-index 1.
    host.appendChild(box);

    var rect = host.getBoundingClientRect();
    var wCss = Math.max(1, Math.round(rect.width));
    var hCss = Math.max(1, Math.round(rect.height));
    var area = wCss * hCss;

    // Холст рисуется в половинном разрешении и растягивается обратно средствами
    // CSS (.powder canvas { width:100%; height:100% }).
    //
    // Почему: холст пудры занимает весь раздел — на главной это 1440x1243,
    // то есть 1,8 млн точек, которые очищаются и перерисовываются шестьдесят
    // раз в секунду. Замер на стоящей странице, где вообще никто не прокручивает:
    // с частицами кадр 66,5 мс, без частиц 16,7 мс. Вчетверо. Половинное
    // разрешение уменьшает площадь вчетверо, а пудра мягкая и размытая —
    // растяжение на ней не читается.
    //
    // Размеры частиц пересчитываются тем же множителем, иначе после растяжения
    // они стали бы вдвое крупнее задуманного. Нижняя граница 0,6 пикселя:
    // ниже частица перестаёт попадать в точку и мерцает.
    var масштаб = Math.min(1, 640 / wCss);
    var w = Math.max(1, Math.round(wCss * масштаб));
    var h = Math.max(1, Math.round(hCss * масштаб));

    var opts = {};
    var src = kind === 'spark' ? SPARK : DUST;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) opts[k] = src[k];
    }
    opts.count = kind === 'spark'
      ? countFor(area, 90000, 22)
      : countFor(area, 20000, 90);

    // Частицы живут в координатах холста, а холст растягивается на 1/масштаб.
    opts.minSize = Math.max(0.6, +(opts.minSize * масштаб).toFixed(2));
    opts.maxSize = Math.max(1, +(opts.maxSize * масштаб).toFixed(2));

    var sp = null;
    try {
      sp = new Sparticles(box, opts, w, h);
    } catch (e) {
      // Библиотека не завелась — раздел просто останется без частиц.
      if (box.parentNode) box.parentNode.removeChild(box);
      return null;
    }
    sp.stop();

    var running = false;

    function play() {
      if (running) return;
      running = true;
      sp.start();
      box.classList.add('is-on');
    }

    function pause() {
      if (!running) return;
      running = false;
      sp.stop();
      box.classList.remove('is-on');
    }

    function onScreen() {
      var r = host.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    }

    // Наблюдателей запоминаем: без ссылки на них отключить их потом неоткуда,
    // и после гашения частиц они продолжали дёргать play() для холста,
    // которого на странице уже нет.
    var наблюдатель = null;
    if ('IntersectionObserver' in window) {
      наблюдатель = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) play();
          else pause();
        });
      }, { rootMargin: '120px' });
      наблюдатель.observe(host);
    } else {
      play();
    }

    var layer = {
      pause: pause,
      resumeIfVisible: function () { if (onScreen()) play(); },
      resize: function () {
        var r = host.getBoundingClientRect();
        // Тот же множитель, что и при создании. Без него первый же вызов
        // (а ResizeObserver срабатывает сразу при подписке) возвращал холсту
        // полный размер раздела и сводил уменьшение на нет.
        var k = Math.min(1, 640 / Math.max(1, r.width));
        var nw = Math.max(1, Math.round(r.width * k));
        var nh = Math.max(1, Math.round(r.height * k));
        if (nw === w && nh === h) return;
        w = nw; h = nh;
        sp.setCanvasSize(nw, nh);
      }
    };

    // Высота раздела меняется и после загрузки: доезжают шрифты, появляются
    // блоки, раскрывается вопрос в FAQ. Если не следить, холст останется
    // прежнего размера, CSS растянет его — и пылинки поедут овалами.
    var rt = null;
    var наблюдательРазмера = null;
    if ('ResizeObserver' in window) {
      наблюдательРазмера = new ResizeObserver(function () {
        window.clearTimeout(rt);
        rt = window.setTimeout(layer.resize, 200);
      });
      наблюдательРазмера.observe(host);
    }

    // Полное выключение слоя. Убрать холст из документа мало: цикл отрисовки
    // Sparticles продолжает крутиться и жечь процессор, а наблюдатели —
    // будить его заново при прокрутке.
    layer.destroy = function () {
      if (наблюдатель) наблюдатель.disconnect();
      if (наблюдательРазмера) наблюдательРазмера.disconnect();
      window.clearTimeout(rt);
      try { if (sp && sp.destroy) sp.destroy(); else if (sp && sp.stop) sp.stop(); } catch (e) { /* уже мёртв */ }
      if (box && box.parentNode) box.parentNode.removeChild(box);
    };

    layer.box = box;
    layer.host = host;
    layer.depth = kind === 'spark' ? 1 : 0.55;   // блёстки ближе, пыль дальше
    return layer;
  }

  // ---------------------------------------------------------------------------
  // Параллакс пудры
  // ---------------------------------------------------------------------------
  // Слои едут по вертикали от прокрутки: пыль медленнее блёсток, поэтому
  // между ними появляется глубина. Считаем в одном кадре на все слои —
  // отдельный обработчик на каждую секцию дал бы десяток пересчётов подряд.
  function initParallax(layers) {
    if (reduced) return;
    if (!window.matchMedia('(min-width: 700px)').matches) return;  // на телефоне не двигаем

    var АМПЛИТУДА = 78;     // пикселей на всю длину прохода секции через экран
    var ждём = false;

    function кадр() {
      ждём = false;
      var vh = window.innerHeight || 1;

      // Сначала читаем геометрию всех слоёв, только потом пишем сдвиги.
      // Раньше чтение и запись чередовались в одном цикле: каждая запись
      // отменяла посчитанную раскладку, и следующее getBoundingClientRect
      // заставляло браузер считать её заново — по одному принудительному
      // пересчёту на слой, на каждом кадре прокрутки. На главной студии
      // это давало средний кадр 56 мс вместо 16, то есть примерно
      // 18 кадров в секунду, и прокрутка заметно дёргалась.
      var рамки = [];
      for (var i = 0; i < layers.length; i++) {
        рамки.push(layers[i].host.getBoundingClientRect());
      }

      for (var j = 0; j < layers.length; j++) {
        var l = layers[j];
        var r = рамки[j];
        if (r.bottom < -200 || r.top > vh + 200) continue;
        // -1 когда секция входит снизу, +1 когда уходит вверх
        var ход = ((vh - r.top) / (vh + r.height)) * 2 - 1;
        var сдвиг = '0 ' + (ход * АМПЛИТУДА * l.depth).toFixed(1) + 'px';
        // Пишем только изменившееся: на стоящей странице кадр не трогает стили.
        if (сдвиг !== l.записано) {
          l.записано = сдвиг;
          l.box.style.translate = сдвиг;
        }
      }
    }

    function приПрокрутке() {
      if (ждём) return;
      ждём = true;
      window.requestAnimationFrame(кадр);
    }

    window.addEventListener('scroll', приПрокрутке, { passive: true });
    window.addEventListener('resize', приПрокрутке, { passive: true });
    кадр();
  }

  // Сторож кадров.
  //
  // Частицы — самая дорогая часть оформления, и цена у них не в расчётах,
  // а в выводе полупрозрачного холста поверх фотографий. Замеры на этой
  // же странице: при включённой аппаратной отрисовке кадр ровно 16,7 мс
  // (шестьдесят кадров в секунду, частицы не стоят ничего); при программной
  // отрисовке тот же кадр 66–124 мс, то есть 8–15 кадров в секунду,
  // а отдельные кадры доходили до 1,2 секунды — страница просто замирала.
  //
  // Отличить одно от другого заранее нельзя: количество ядер тут ни при чём
  // (у владельца их шестнадцать, и всё равно дёргалось). Поэтому смотрим
  // на настоящие кадры уже после запуска: полторы секунды наблюдения, и если
  // машина не вытягивает — частицы гасим. Решение запоминается на вкладке,
  // чтобы на каждой следующей странице не проверять заново.
  var ПОРОГ_КАДРА = 26;   // мс; 26 мс — это примерно 38 кадров в секунду

  function помнимОтказ(значение) {
    try {
      if (значение === undefined) return window.sessionStorage.getItem('hairid-частицы') === 'выкл';
      window.sessionStorage.setItem('hairid-частицы', значение ? 'выкл' : 'вкл');
    } catch (e) {
      // Приватный режим — просто не запоминаем, проверим ещё раз на этой странице.
    }
    return false;
  }

  function сторожКадров(погасить) {
    var кадры = [];
    var прошлый = 0;
    var конец = 0;

    function тик(t) {
      if (!прошлый) { прошлый = t; конец = t + 1500; window.requestAnimationFrame(тик); return; }
      кадры.push(t - прошлый);
      прошлый = t;
      if (t < конец) { window.requestAnimationFrame(тик); return; }

      if (кадры.length < 12) return;   // вкладка была свёрнута, судить не по чему
      кадры.sort(function (a, b) { return a - b; });
      var медиана = кадры[Math.floor(кадры.length / 2)];
      if (медиана > ПОРОГ_КАДРА) {
        помнимОтказ(true);
        погасить();
      }
    }

    window.requestAnimationFrame(тик);
  }

  function initParticles() {
    if (reduced) return;
    if (typeof Sparticles === 'undefined') return;
    if (помнимОтказ()) return;   // на этой вкладке уже выяснили, что не тянет

    var layers = [];

    document.querySelectorAll('[data-powder]').forEach(function (host) {
      var l = makeLayer(host, 'dust');
      if (l) layers.push(l);
    });
    document.querySelectorAll('[data-sparkle]').forEach(function (host) {
      var l = makeLayer(host, 'spark');
      if (l) layers.push(l);
    });

    if (!layers.length) return;

    initParallax(layers);

    // Через полторы секунды решаем, тянет ли машина. Не тянет — убираем
    // холсты совсем: остановки анимации мало, платить приходится за сам
    // вывод холста на экран (замерено: скрытый холст стоит столько же,
    // сколько его отсутствие, а видимый и остановленный — как работающий).
    сторожКадров(function () {
      layers.forEach(function (l) {
        if (l.destroy) l.destroy();
        else if (l.box && l.box.parentNode) l.box.parentNode.removeChild(l.box);
      });
      layers.length = 0;
    });

    var timer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        layers.forEach(function (l) { l.resize(); });
      }, 250);
    }, { passive: true });

    // Один слушатель на все слои, а не по одному на каждый.
    document.addEventListener('visibilitychange', function () {
      layers.forEach(function (l) {
        if (document.hidden) l.pause();
        else l.resumeIfVisible();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Зерно
  // ---------------------------------------------------------------------------

  function initGrain() {
    if (document.querySelector('.page-grain')) return;
    var grain = document.createElement('div');
    grain.className = 'page-grain';
    grain.setAttribute('aria-hidden', 'true');
    document.body.appendChild(grain);
  }

  function init() {
    initTextures();
    initParticles();
    initGrain();

    // Движок пересчитывает параллакс: у фактур он свой
    if (window.HairIDMotion) window.HairIDMotion.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
