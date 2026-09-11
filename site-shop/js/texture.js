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
    document.querySelectorAll('[data-tex]').forEach(function (section) {
      var key = section.getAttribute('data-tex');
      var file = FILES[key];
      if (!file) return;

      var size = SIZES[key] || [1400, 933];

      var layer = document.createElement('div');
      layer.className = 'tex';
      layer.setAttribute('aria-hidden', 'true');

      var img = document.createElement('img');
      img.src = ПАПКА_ФАКТУР + file;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = size[0];
      img.height = size[1];

      // Лёгкий параллакс тем же движком, что и у остальных фотографий.
      // Меньше, чем у сюжетных снимков: фон не должен перетягивать внимание.
      if (!reduced) img.setAttribute('data-parallax', '0.04');

      var markLoaded = function () { img.classList.add('is-loaded'); };
      if (img.complete && img.naturalWidth) markLoaded();
      else img.addEventListener('load', markLoaded, { once: true });

      var veil = document.createElement('span');
      veil.className = 'tex__veil';

      layer.appendChild(img);
      layer.appendChild(veil);
      section.insertBefore(layer, section.firstChild);
    });
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
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var area = w * h;

    var opts = {};
    var src = kind === 'spark' ? SPARK : DUST;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) opts[k] = src[k];
    }
    opts.count = kind === 'spark'
      ? countFor(area, 90000, 22)
      : countFor(area, 20000, 90);

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

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) play();
          else pause();
        });
      }, { rootMargin: '120px' }).observe(host);
    } else {
      play();
    }

    var layer = {
      pause: pause,
      resumeIfVisible: function () { if (onScreen()) play(); },
      resize: function () {
        var r = host.getBoundingClientRect();
        var nw = Math.max(1, Math.round(r.width));
        var nh = Math.max(1, Math.round(r.height));
        if (nw === w && nh === h) return;
        w = nw; h = nh;
        sp.setCanvasSize(nw, nh);
      }
    };

    // Высота раздела меняется и после загрузки: доезжают шрифты, появляются
    // блоки, раскрывается вопрос в FAQ. Если не следить, холст останется
    // прежнего размера, CSS растянет его — и пылинки поедут овалами.
    if ('ResizeObserver' in window) {
      var rt = null;
      new ResizeObserver(function () {
        window.clearTimeout(rt);
        rt = window.setTimeout(layer.resize, 200);
      }).observe(host);
    }

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
      for (var i = 0; i < layers.length; i++) {
        var l = layers[i];
        var r = l.host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        // -1 когда секция входит снизу, +1 когда уходит вверх
        var ход = ((vh - r.top) / (vh + r.height)) * 2 - 1;
        l.box.style.translate = '0 ' + (ход * АМПЛИТУДА * l.depth).toFixed(1) + 'px';
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

  function initParticles() {
    if (reduced) return;
    if (typeof Sparticles === 'undefined') return;

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
