/**
 * HAIR ID — motion engine
 *
 * Движок анимаций сайта: инерционный скролл, появление блоков, раскрытие
 * заголовков, параллакс, бегущая строка, морфинг логотипа, sticky-секции.
 * Без внешних библиотек. Управляется data-атрибутами в разметке.
 *
 * ВАЖНОЕ РЕШЕНИЕ ПО СКРОЛЛУ.
 * Инерция сделана НЕ через сдвиг контейнера трансформом (так работает
 * tilesuite.lu), а через плавную анимацию настоящей позиции прокрутки.
 * Причина: сдвинутый трансформом контейнер ломает position: sticky,
 * position: fixed, якорные ссылки и поиск по странице (Ctrl+F) — браузер
 * считает координаты по неподвижной раскладке. На сайте услуг это
 * недопустимо: залипающая кнопка «Записаться» важнее эффекта.
 * Здесь страница прокручивается по-настоящему, просто с задержкой.
 *
 * Инерция включается только на десктопе с мышью. На телефоне нативная
 * прокрутка лучше любой самописной, и там она не трогается.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Настройки
  // ---------------------------------------------------------------------------

  var CONFIG = {
    // Самодельная инерционная прокрутка ВЫКЛЮЧЕНА. Не «пока», а по замерам.
    //
    // Как она работала: колесо перехватывалось, e.preventDefault() отменял
    // нативную прокрутку, а страница двигалась вручную — window.scrollTo
    // на каждом кадре с плавным подтягиванием к цели. Рядом стояла защита:
    // если реальная позиция разошлась с ожидаемой больше чем на 2 px,
    // движок резко приравнивал цель к реальной позиции.
    //
    // Пока кадры укладывались в 16 мс, это выглядело мягко. Но на главной
    // при 15 фактурах и 9 слоях частиц кадр занимал 45–52 мс (замер
    // профилировщиком, прокрутка колесом: худший кадр 167 мс). На таком
    // темпе браузер успевает прокрутить страницу между кадрами, срабатывает
    // защита, позиция скачком возвращается назад — и следующий кадр тянет
    // её обратно вперёд. Владелец описал это дословно: «зависает и куда-то
    // перепрыгивает вверх, потом вниз».
    //
    // Нативная прокрутка на macOS и так инерционная и живёт в отдельном
    // потоке композитора: её невозможно затормозить джаваскриптом. Поэтому
    // прокрутку отдаём браузеру. Разбор основателя (03-РАЗБОР-ОСНОВАТЕЛЯ.md)
    // уже относил этот движок к переинвестированию и советовал не развивать.
    //
    // Вернуть можно одной строкой: плавнаяПрокрутка: true. Но сначала
    // добейтесь кадра меньше 16 мс, иначе вернётся та же болезнь.
    плавнаяПрокрутка: false,

    scrollEase: 0.11,          // инерция: меньше — тягучее
    wheelMultiplier: 1,        // чувствительность колеса
    smoothMinWidth: 1024,      // ниже — нативная прокрутка
    revealStagger: 70,         // задержка между соседними блоками, мс
    revealStaggerCap: 6,       // потолок: 7-я карточка не ждёт полсекунды
    revealThreshold: 0.15,
    revealRootMargin: '0px 0px -10% 0px',
    marqueeBaseSpeed: 0.3,
    marqueeScrollBoost: 45,
    marqueeBoostCap: 3,        // потолок разгона строки
    loadStages: [
      { cls: 'has-landed', delay: 100 },
      { cls: 'has-loaded', delay: 650 },
      { cls: 'has-displayed', delay: 1300 }
    ]
  };

  var root = document.documentElement;
  var body = document.body;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  var targetY = window.scrollY;
  var currentY = window.scrollY;
  var velocity = 0;

  var smoothEnabled = false;
  var expectedY = window.scrollY;  // где страница должна стоять после нашего кадра

  var marquees = [];
  var parallaxItems = [];
  var stickyItems = [];
  var logoMorph = null;

  // Блоки, которые ещё не показаны, и их наблюдатель. Нужны подстраховке
  // sweepReveal: она добирает то, что наблюдатель пропустил на резком прыжке.
  var revealPending = null;
  var revealObserver = null;
  var revealShow = null;
  var lastRevealSweep = 0;

  // ---------------------------------------------------------------------------
  // Утилиты
  // ---------------------------------------------------------------------------

  function lerp(from, to, ease) { return from + (to - from) * ease; }
  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
  function num(v, fallback) { var n = parseFloat(v); return isNaN(n) ? fallback : n; }
  function maxScroll() { return Math.max(0, root.scrollHeight - window.innerHeight); }

  // ---------------------------------------------------------------------------
  // 1. Стадии загрузки
  //
  // Классы на <body> появляются по очереди — страница «собирается»,
  // а не вываливается целиком.
  // ---------------------------------------------------------------------------

  function initLoadStages() {
    CONFIG.loadStages.forEach(function (stage) {
      if (reduced) { body.classList.add(stage.cls); return; }
      window.setTimeout(function () { body.classList.add(stage.cls); }, stage.delay);
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Инерционная прокрутка
  // ---------------------------------------------------------------------------

  function initSmoothScroll() {
    updateSmoothState();
    window.addEventListener('wheel', onWheel, { passive: false });
  }

  function updateSmoothState() {
    var should = CONFIG.плавнаяПрокрутка &&
      !reduced && finePointer && window.innerWidth >= CONFIG.smoothMinWidth;
    if (should === smoothEnabled) return;
    smoothEnabled = should;
    body.classList.toggle('is-smooth-scroll', smoothEnabled);
    targetY = currentY = window.scrollY;
  }

  function onWheel(e) {
    if (!smoothEnabled) return;
    if (e.ctrlKey) return;                       // масштабирование страницы не трогаем
    if (e.target.closest('[data-native-scroll]')) return;  // внутренние скроллы

    // Во вкладке, которую не видно, браузер останавливает requestAnimationFrame.
    // Если в этот момент перехватить колесо, страница замрёт совсем: нативную
    // прокрутку мы отменили, а свою выполнить не успеваем. Поэтому в скрытой
    // вкладке отдаём прокрутку браузеру.
    if (document.hidden) return;

    e.preventDefault();
    targetY = clamp(targetY + e.deltaY * CONFIG.wheelMultiplier, 0, maxScroll());
  }

  // Вернулись на вкладку — подхватываем реальную позицию,
  // иначе анимация дёрнет страницу туда, где она была до ухода.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) targetY = currentY = window.scrollY;
  });

  // ---------------------------------------------------------------------------
  // 3. Появление блоков
  //
  // Разметка: data-reveal="up" | "fade" | "scale" | "clip" | "clip-left"
  //           data-reveal-delay="120"  — своя задержка, мс
  //           data-reveal-group        — на родителе: дети каскадом
  // ---------------------------------------------------------------------------

  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      group.querySelectorAll('[data-reveal]').forEach(function (child, i) {
        child.style.setProperty('--reveal-index', Math.min(i, CONFIG.revealStaggerCap));
      });
    });

    function show(el) {
      if (el.classList.contains('is-revealed')) return;
      var own = el.getAttribute('data-reveal-delay');
      var delay = own !== null
        ? num(own, 0)
        : num(el.style.getPropertyValue('--reveal-index'), 0) * CONFIG.revealStagger;

      window.setTimeout(function () { el.classList.add('is-revealed'); }, delay);
      revealObserver.unobserve(el);
    }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { threshold: CONFIG.revealThreshold, rootMargin: CONFIG.revealRootMargin });

    revealPending = Array.prototype.slice.call(items);
    revealPending.forEach(function (el) { revealObserver.observe(el); });
    revealShow = show;
  }

  // Подстраховка к наблюдателю.
  //
  // При обычной прокрутке колесом наблюдатель срабатывает за 30 мс — замерено.
  // Но на резком прыжке (переход по пункту меню, открытие ссылки с якорем,
  // возврат кнопкой «назад») часть блоков он пропускает: после трёх секунд
  // на экране фотография раздела «О мастере» так и оставалась обрезанной.
  // Для человека это выглядит как пустой экран — ровно то, чего мы избегаем.
  //
  // Поэтому раз в 250 мс в общем цикле просматриваем оставшиеся блоки и
  // показываем те, что уже на экране. Список только укорачивается, поэтому
  // с каждой секундой проверка дешевеет и в конце исчезает совсем.
  function sweepReveal(now) {
    if (!revealPending || !revealPending.length) return;
    if (now - lastRevealSweep < 250) return;
    lastRevealSweep = now;

    var h = window.innerHeight;
    var rest = [];

    for (var i = 0; i < revealPending.length; i++) {
      var el = revealPending[i];
      if (el.classList.contains('is-revealed')) continue;
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < h && r.height > 0) revealShow(el);
      else rest.push(el);
    }
    revealPending = rest;
  }

  // ---------------------------------------------------------------------------
  // 4. Раскрытие заголовков
  //
  // Разметка: data-split="words" | "lines"
  //
  // Побуквенное раскрытие сознательно не поддерживается: скринридеры на нём
  // ломаются, а копирование, перевод страницы и поиск по тексту перестают
  // работать. Слово — минимальная безопасная единица.
  //
  // Исходный текст сохраняется в aria-label, куски помечаются aria-hidden,
  // чтобы заголовок не читался вслух по слогам и не попадал в выдачу кусками.
  // ---------------------------------------------------------------------------

  function initSplitText() {
    document.querySelectorAll('[data-split]').forEach(function (el) {
      var text = el.textContent.trim().replace(/\s+/g, ' ');
      if (!text) return;

      el.setAttribute('aria-label', text);

      if (reduced) {
        el.classList.add('is-split-ready', 'is-revealed');
        return;
      }

      var words = text.split(' ');
      var html = '';

      words.forEach(function (word, index) {
        var safe = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<span class="split-item" aria-hidden="true" style="--split-index:' + index + '">' +
                  '<span class="split-inner">' + safe + '</span>' +
                '</span>';
        // Пробел ставится МЕЖДУ обёртками: внутри inline-block с overflow: hidden
        // он схлопывается, и слова слипаются в одно.
        html += ' ';
      });

      el.innerHTML = html;
      el.classList.add('is-split-ready');
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Параллакс
  //
  // Разметка: data-parallax="0.15" [data-parallax-axis="x"]
  // Двигаем только transform: background-position и top заставляют браузер
  // пересчитывать раскладку на каждом кадре.
  // ---------------------------------------------------------------------------

  function collectParallax() {
    parallaxItems = [];
    if (reduced) return;
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      // Переход на transform снимается принудительно.
      //
      // На этих картинках в CSS стоит transition на transform (0,45–1 с),
      // а у части — вообще transition: all. Параллакс пишет transform
      // на каждом кадре, и каждая запись запускала НОВЫЙ переход: браузер
      // пересчитывал анимацию по шестьдесят раз в секунду поверх самой себя.
      // Замер профилировщиком на главной: updateParallax съедала 596 мс
      // из 2 495 мс прокрутки — почти четверть, при девяти элементах.
      // Плюс движение выглядело вязким: сдвиг догонял цель с задержкой.
      //
      // Оставляем opacity — на нём держится плавное появление картинок
      // (.is-loaded и data-reveal). Убираем только transform.
      el.style.transitionProperty = 'opacity';

      parallaxItems.push({
        el: el,
        strength: num(el.getAttribute('data-parallax'), 0.12),
        axis: el.getAttribute('data-parallax-axis') === 'x' ? 'x' : 'y'
      });
    });
  }

  function updateParallax() {
    if (!parallaxItems.length) return;
    var vh = window.innerHeight;

    // Сначала читаем геометрию всех элементов, потом пишем сдвиги: иначе
    // каждая запись отменяет раскладку и следующее чтение заставляет браузер
    // пересчитать её заново. В студии это уже сделано, здесь оставалось.
    var рамки = parallaxItems.map(function (item) {
      return item.el.getBoundingClientRect();
    });

    parallaxItems.forEach(function (item, i) {
      var rect = рамки[i];
      if (rect.bottom < -200 || rect.top > vh + 200) return;

      var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      var shift = (progress * item.strength * 100).toFixed(2);

      var стиль = item.axis === 'x'
        ? 'translate3d(' + shift + 'px,0,0)'
        : 'translate3d(0,' + shift + 'px,0)';

      if (стиль !== item.записано) {
        item.записано = стиль;
        item.el.style.transform = стиль;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Бегущая строка
  //
  // Дорожка дублируется ровно один раз, дубль помечается aria-hidden,
  // иначе скринридер прочитает прейскурант дважды.
  // Скорость = базовая + сглаженная скорость прокрутки, с потолком.
  // ---------------------------------------------------------------------------

  function initMarquee() {
    marquees = [];
    if (reduced) return;

    document.querySelectorAll('[data-marquee]').forEach(function (el) {
      var track = el.querySelector('.marquee-track');
      if (!track) return;

      var width = track.offsetWidth;
      if (!width) return;

      // Достаточно копий, чтобы перекрыть экран дважды и не показать разрыв.
      var copies = Math.max(1, Math.ceil((window.innerWidth * 2) / width));
      var tracks = [track];

      for (var i = 0; i < copies; i++) {
        var clone = track.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        el.appendChild(clone);
        tracks.push(clone);
      }

      marquees.push({ tracks: tracks, width: width, offset: 0,
                      speed: num(el.getAttribute('data-marquee-speed'), CONFIG.marqueeBaseSpeed) });
    });
  }

  function updateMarquee() {
    if (!marquees.length) return;
    var boost = Math.min(Math.abs(velocity) / CONFIG.marqueeScrollBoost, CONFIG.marqueeBoostCap);

    marquees.forEach(function (m) {
      m.offset -= (m.speed + boost);
      if (Math.abs(m.offset) >= m.width) m.offset += m.width;

      m.tracks.forEach(function (track, i) {
        track.style.transform = 'translate3d(' + (m.offset + i * m.width).toFixed(2) + 'px,0,0)';
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Sticky-секции
  //
  // Теперь, когда прокрутка настоящая, работает нативный position: sticky —
  // он в CSS. Здесь только вешаем класс, чтобы можно было менять вид
  // залипшего элемента.
  // ---------------------------------------------------------------------------

  function collectSticky() {
    stickyItems = [];
    document.querySelectorAll('[data-sticky]').forEach(function (el) {
      stickyItems.push({ el: el, top: num(el.getAttribute('data-sticky'), 0) });
    });
  }

  function updateSticky() {
    stickyItems.forEach(function (item) {
      var stuck = item.el.getBoundingClientRect().top <= item.top + 1;
      item.el.classList.toggle('is-stuck', stuck);
    });
  }

  // ---------------------------------------------------------------------------
  // 8. Морфинг логотипа
  //
  // Большой логотип в первом экране уменьшается до размера логотипа в шапке,
  // затем передаёт эстафету шапке. Один элемент масштабируется, а не два
  // подменяют друг друга: подмена дрожит на мобильных.
  // ---------------------------------------------------------------------------

  function initLogoMorph() {
    var hero = document.querySelector('[data-logo-hero]');
    var header = document.querySelector('[data-logo-header]');
    if (!hero || !header || reduced) return;
    logoMorph = { hero: hero, header: header, heroW: 0, headerW: 0, distance: 1 };
    measureLogoMorph();
  }

  function measureLogoMorph() {
    if (!logoMorph) return;
    logoMorph.hero.style.removeProperty('--logo-scale');
    logoMorph.heroW = logoMorph.hero.offsetWidth || 1;
    logoMorph.headerW = logoMorph.header.offsetWidth || 1;
    var heroBottom = logoMorph.hero.getBoundingClientRect().bottom + window.scrollY;
    var headerBottom = logoMorph.header.getBoundingClientRect().bottom;
    logoMorph.distance = Math.max(heroBottom - headerBottom, 1);
  }

  function updateLogoMorph() {
    if (!logoMorph) return;
    var progress = clamp(currentY / logoMorph.distance, 0, 1);
    var target = logoMorph.headerW / logoMorph.heroW;
    logoMorph.hero.style.setProperty('--logo-scale', (1 - (1 - target) * progress).toFixed(4));
    logoMorph.hero.style.setProperty('--logo-progress', progress.toFixed(4));
    body.classList.toggle('is-logo-docked', progress >= 0.99);
  }

  // ---------------------------------------------------------------------------
  // 9. Приглушение соседей в меню
  // ---------------------------------------------------------------------------

  function initFadeSiblings() {
    document.querySelectorAll('[data-fade-siblings]').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (item) {
        item.addEventListener('mouseenter', function () {
          Array.prototype.forEach.call(list.children, function (other) {
            other.classList.toggle('is-faded', other !== item);
          });
        });
      });

      list.addEventListener('mouseleave', function () {
        Array.prototype.forEach.call(list.children, function (i) { i.classList.remove('is-faded'); });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Состояние прокрутки
  // ---------------------------------------------------------------------------

  function updateScrollState() {
    var max = maxScroll();
    root.style.setProperty('--scroll-progress', (max > 0 ? clamp(currentY / max, 0, 1) : 0).toFixed(4));
    body.classList.toggle('has-scrolled', currentY > 40);
    body.classList.toggle('has-scrolled-full', currentY > window.innerHeight - 24);
  }

  // ---------------------------------------------------------------------------
  // Главный цикл
  // ---------------------------------------------------------------------------

  function frame() {
    var previous = currentY;

    // Проверка «страницу двигали не мы» делается здесь, а не в обработчике
    // события scroll. Событие приходит с задержкой, и между чужой прокруткой
    // и его приходом успевает пройти кадр — тогда движок возвращал страницу
    // назад. Клавиши, якорные ссылки, перетаскивание полосы и восстановление
    // позиции после перезагрузки ломались именно так.
    if (Math.abs(window.scrollY - expectedY) > 2) {
      targetY = currentY = window.scrollY;
    }

    if (smoothEnabled) {
      currentY = lerp(currentY, targetY, CONFIG.scrollEase);
      if (Math.abs(targetY - currentY) < 0.4) currentY = targetY;

      if (Math.abs(currentY - window.scrollY) > 0.4) window.scrollTo(0, currentY);
    } else {
      currentY = window.scrollY;
    }

    expectedY = window.scrollY;

    velocity = currentY - previous;

    updateScrollState();
    updateParallax();
    updateMarquee();
    updateSticky();
    updateLogoMorph();
    sweepReveal(performance.now());

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Пересчёт при изменении размеров
  // ---------------------------------------------------------------------------

  var resizeTimer = null;

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      updateSmoothState();
      measureLogoMorph();
      collectParallax();
      collectSticky();
    }, 150);
  }

  // ---------------------------------------------------------------------------
  // Якорные ссылки
  // ---------------------------------------------------------------------------

  function initAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      scrollToEl(target);
    });
  }

  function scrollToEl(el) {
    var top = el.getBoundingClientRect().top + window.scrollY - 90;
    top = clamp(top, 0, maxScroll());

    if (smoothEnabled) {
      targetY = top;
    } else {
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  // ---------------------------------------------------------------------------
  // Запуск
  // ---------------------------------------------------------------------------

  function init() {
    body.classList.toggle('is-reduced-motion', reduced);

    initLoadStages();
    initSplitText();
    initSmoothScroll();
    initReveal();

    // Отметка для страховки из шапки страницы: наблюдатель появления
    // поставлен, прятать содержимое теперь безопасно. Ставится именно здесь,
    // после initReveal, а не в начале: если бы что-то упало выше, метка уже
    // стояла бы и страховка не сработала.
    document.documentElement.classList.add('motion-ready');

    collectParallax();
    collectSticky();
    initLogoMorph();
    initFadeSiblings();
    initAnchors();

    requestAnimationFrame(frame);

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('load', function () {
      initMarquee();       // после загрузки шрифтов ширина дорожки уже верная
      measureLogoMorph();
      collectParallax();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HairIDMotion = {
    config: CONFIG,
    scrollTo: function (t) {
      var el = typeof t === 'string' ? document.querySelector(t) : t;
      if (el) scrollToEl(el);
    },
    refresh: function () {
      measureLogoMorph();
      collectParallax();
      collectSticky();

      // Блоки, дорисованные скриптом после запуска движка (каталог магазина,
      // дни в форме записи), тоже должны попасть под наблюдение — иначе они
      // останутся спрятанными теми же стилями, что прячут остальные.
      if (revealObserver && revealPending) {
        document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(function (el) {
          if (revealPending.indexOf(el) !== -1) return;
          revealPending.push(el);
          revealObserver.observe(el);
        });
      }
    }
  };
})();
