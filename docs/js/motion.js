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
  // Высота документа запоминается, а не спрашивается каждый кадр.
  // scrollHeight — такое же обращение к раскладке, как getBoundingClientRect:
  // на прокрутке главной он вызывался по разу на кадр всё время чтения.
  // Меняется высота редко: размер окна, догрузка шрифта, новая фактура.
  var высотаДокумента = 0;
  function снятьВысоту() { высотаДокумента = root.scrollHeight; }
  function maxScroll() {
    if (!высотаДокумента) снятьВысоту();
    return Math.max(0, высотаДокумента - window.innerHeight);
  }

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
    // Слушатель колеса вешаем ТОЛЬКО когда самодельная прокрутка включена.
    // С passive: false браузер обязан дождаться этого обработчика перед
    // каждой прокруткой — а он выходил на первой же строке и не делал
    // ничего. Плата за пустоту: прокрутка уходит с композитора на главный поток.
    if (CONFIG.плавнаяПрокрутка) window.addEventListener('wheel', onWheel, { passive: false });
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

    // Пустая страница — не повод не заводить наблюдателя.
    //
    // Раньше здесь стоял выход, если на странице нет ни одного блока
    // с появлением. Но каталог магазина и дни в форме записи рисуются
    // скриптом уже после запуска движка: к моменту этой проверки их ещё
    // нет, наблюдатель не создавался, и refresh() потом было нечему
    // передавать дорисованные блоки — они оставались спрятанными
    // теми же стилями, что прячут остальные.

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
  //
  // ДОПОЛНЕНО ПОСЛЕ ЗАМЕРА. Подстраховка задумана против резкого прыжка,
  // а работала непрерывно: каждые 250 мс она запрашивала рамку у каждого
  // ещё не показанного блока. На главной студии таких блоков три сотни,
  // и замер прокрутки дал 18,9 обращения к раскладке на кадр — больше,
  // чем давали параллакс, залипания и частицы вместе взятые, причём
  // в 99 случаях из 100 наблюдатель уже всё показал сам.
  //
  // Теперь обход включается только тогда, когда наблюдателя действительно
  // можно обмануть: прыжок больше экрана, переход по якорю, кнопка «назад»,
  // изменение размера окна. После такого события обход работает полсекунды
  // и снова засыпает. На ровной прокрутке кадр к раскладке не обращается.
  var обходДо = 0;
  function разбудитьОбход() {
    обходДо = (typeof performance !== 'undefined' ? performance.now() : 0) + 600;
    // Обход живёт внутри кадра, поэтому спящий цикл надо разбудить,
    // иначе подстраховка просто не отработает.
    if (typeof разбудитьКадр === 'function') разбудитьКадр();
  }

  function sweepReveal(now) {
    if (!revealPending || !revealPending.length) return;
    if (now > обходДо) return;
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
        axis: el.getAttribute('data-parallax-axis') === 'x' ? 'x' : 'y',
        записано: '',  // последняя записанная строка transform, см. updateParallax
        docTop: 0,     // место в документе, снимается measureParallax
        height: 0
      });
    });
    measureParallax();
  }

  // Место каждого элемента в документе снимается ОДИН раз, а не на каждом кадре.
  //
  // Замер профилировщиком на главной студии (1440x900, 24 элемента с параллаксом):
  // getBoundingClientRect съедал 624 мс из 2 491 мс — четверть всего времени
  // прокрутки. Причина не в самом вызове, а в том, что страница большая:
  // каждый запрос рамки заставляет браузер посчитать раскладку целиком,
  // и таких запросов было двадцать четыре на кадр.
  //
  // Положение элемента относительно экрана считается из одного числа —
  // window.scrollY, — а оно и так известно. Пересъёмка нужна только когда
  // раскладка действительно поменялась: поворот экрана, изменение размера,
  // догрузка шрифта или новая фактура (её добавляет texture.js и сам зовёт refresh).
  function measureParallax() {
    if (!parallaxItems.length) return;
    var сдвиг = window.scrollY || window.pageYOffset || 0;
    parallaxItems.forEach(function (item) {
      var r = item.el.getBoundingClientRect();
      item.docTop = r.top + сдвиг;
      item.height = r.height;
    });
  }

  // Два прохода, а не один. Раньше чтение рамки и запись transform шли вперемешку
  // по каждой картинке: запись помечала стили грязными, и следующее чтение
  // заставляло браузер пересчитывать раскладку заново — до двух десятков
  // принудительных пересчётов за кадр, что и давало подёргивание прокрутки
  // на телефоне. Сначала читаем все рамки, потом пишем все трансформы.
  // Вложенных элементов с data-parallax нет (это только картинки), поэтому
  // разнесение проходов ничего не меняет в самой картинке движения.
  function updateParallax() {
    if (!parallaxItems.length) return;
    var vh = window.innerHeight;
    var сдвиг = window.scrollY || window.pageYOffset || 0;

    parallaxItems.forEach(function (item) {
      // Ни одного обращения к раскладке: положение считается из запомненного
      // места в документе и текущей прокрутки.
      var top = item.docTop - сдвиг;
      var bottom = top + item.height;
      if (bottom < -200 || top > vh + 200) return;

      var progress = (top + item.height / 2 - vh / 2) / vh;
      var shift = (progress * item.strength * 100).toFixed(2);

      var стиль = item.axis === 'x'
        ? 'translate3d(' + shift + 'px,0,0)'
        : 'translate3d(0,' + shift + 'px,0)';

      // Пишем только изменившееся: на стоящей странице кадр не трогает стили
      // вообще, как и в updateLogoMorph.
      if (стиль !== item.записано) {
        item.записано = стиль;
        item.el.style.transform = стиль;
      }
    });
  }

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

  // Шаг строки считается по времени, а не по кадрам.
  //
  // Раньше на каждом кадре к сдвигу прибавлялась одна и та же величина.
  // Пока браузер успевал шестьдесят кадров в секунду, строка ехала как
  // задумано. Но на телефоне постарше кадров тридцать, и та же строка
  // ползла ровно вдвое медленнее, а на экране 120 Гц — вдвое быстрее.
  // Скорость движения не должна зависеть от того, какой у человека телефон.
  var прошлыйКадрСтроки = 0;

  function updateMarquee() {
    if (!marquees.length) return;
    var сейчас = typeof performance !== 'undefined' ? performance.now() : 0;
    var прошло = прошлыйКадрСтроки ? (сейчас - прошлыйКадрСтроки) : 16.7;
    прошлыйКадрСтроки = сейчас;
    // Вкладку свернули и вернули — между кадрами прошли секунды.
    // Без потолка строка прыгнула бы на пол-экрана.
    var доля = Math.min(прошло, 50) / 16.7;

    var boost = Math.min(Math.abs(velocity) / CONFIG.marqueeScrollBoost, CONFIG.marqueeBoostCap);

    marquees.forEach(function (m) {
      m.offset -= (m.speed + boost) * доля;
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
      stickyItems.push({ el: el, top: num(el.getAttribute('data-sticky'), 0),
                         docTop: 0, залипло: null });
    });
    measureSticky();
  }

  // Место залипающих элементов снимается один раз — ровно по той же причине,
  // что и у параллакса выше: getBoundingClientRect заставляет браузер
  // пересчитать раскладку целиком, а здесь он вызывался на каждом кадре
  // для каждого элемента. На странице услуг это кнопка «Записаться»,
  // которая висит всю прокрутку, то есть пересчёт шёл шестьдесят раз
  // в секунду всё время чтения страницы.
  function measureSticky() {
    if (!stickyItems.length) return;
    var сдвиг = window.scrollY || window.pageYOffset || 0;
    stickyItems.forEach(function (item) {
      item.docTop = item.el.getBoundingClientRect().top + сдвиг;
    });
  }

  function updateSticky() {
    if (!stickyItems.length) return;
    var сдвиг = window.scrollY || window.pageYOffset || 0;
    stickyItems.forEach(function (item) {
      var stuck = (item.docTop - сдвиг) <= item.top + 1;
      // Класс переставляем только при смене состояния. Раньше toggle
      // вызывался каждый кадр с тем же значением: изменения не было,
      // но браузер всё равно помечал стили грязными.
      if (stuck !== item.залипло) {
        item.залипло = stuck;
        item.el.classList.toggle('is-stuck', stuck);
      }
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
    var части = [
      { знак: document.querySelector('.brandmark--sign'),
        откуда: document.querySelector('.hero__logo-slot--sign'),
        куда: document.querySelector('.header-logo__sign') },
      { знак: document.querySelector('.brandmark--word'),
        откуда: document.querySelector('.hero__logo-slot--word'),
        куда: document.querySelector('.header-logo__word') }
    ];
    var первыйЭкран = document.querySelector('.hero');
    if (!первыйЭкран) return;

    // При системной настройке «уменьшить движение» перелёта нет — а значит,
    // некому выставить летящим частям настоящую ширину: в стилях у .brandmark
    // стоит 1px нарочно, чтобы до замера ничего не мелькало в углу экрана.
    // Просто выйти отсюда нельзя: класс has-hero-logo остаётся на body, а он
    // единственный, из-за которого прячется обычный логотип в шапке
    // (main.css: .has-motion body.has-hero-logo .header-logo img). Тогда
    // логотипа Hair ID не остаётся нигде. Поэтому убираем нелетящие части
    // и возвращаем шапке её собственный логотип.
    if (reduced) {
      части.forEach(function (ч) { if (ч.знак) ч.знак.style.display = 'none'; });
      body.classList.remove('has-hero-logo');
      return;
    }

    if (части.some(function (ч) { return !ч.знак || !ч.откуда || !ч.куда; })) return;
    logoMorph = { части: части, экран: первыйЭкран, путь: 1 };
    measureLogoMorph();
  }

  // Геометрия посадочных мест снимается при загрузке и при изменении окна,
  // а не каждый кадр: чтение размеров в кадре заставляет браузер
  // пересчитывать раскладку и дёргает логотип на слабых телефонах.
  function measureLogoMorph() {
    if (!logoMorph) return;
    var сдвиг = window.scrollY || 0;

    // Откуда летим — меряем как есть, первый экран в покое.
    var старты = logoMorph.части.map(function (ч) { return ч.откуда.getBoundingClientRect(); });

    // Куда садимся — меряем в том состоянии, в котором посадка реально
    // происходит: страница к этому моменту всегда прокручена, а прокрученная
    // шапка подбирается и логотип в ней меньше. Если мерить в покое,
    // логотип садится крупнее места и потом дёргается, доезжая до размера.
    // Переходы на время замера выключаются: иначе рамка вернёт не конечную
    // ширину, а промежуточную ширину анимации.
    // Сдвиг шапки на время замера тоже снимается. Пока страница не
    // доиграла появление, шапка приподнята на десять пикселей — замер в этот
    // момент давал место посадки на те же десять пикселей выше, и логотип
    // садился макушкой за край экрана.
    var шапка = document.querySelector('.site-header');
    var былоСжато = body.classList.contains('has-scrolled');
    var прежнийПереход = шапка ? шапка.style.transition : '';
    var прежнийСдвиг = шапка ? шапка.style.transform : '';
    if (шапка) { шапка.style.transition = 'none'; шапка.style.transform = 'none'; }
    logoMorph.части.forEach(function (ч) { ч.куда.style.transition = 'none'; });
    if (!былоСжато) body.classList.add('has-scrolled');

    var цели = logoMorph.части.map(function (ч) { return ч.куда.getBoundingClientRect(); });

    if (!былоСжато) body.classList.remove('has-scrolled');
    // Принудительный пересчёт до возврата переходов: иначе снятие класса
    // поедет анимацией и шапка мигнёт.
    void document.body.offsetWidth;
    logoMorph.части.forEach(function (ч) { ч.куда.style.transition = ''; });
    if (шапка) { шапка.style.transition = прежнийПереход; шапка.style.transform = прежнийСдвиг; }

    logoMorph.части.forEach(function (ч, i) {
      var а = старты[i];
      var б = цели[i];
      // important: у картинок в теме есть общее правило ширины,
      // которое иначе схлопывает летящий элемент в ноль
      ч.знак.style.setProperty('width', а.width + 'px', 'important');
      ч.знак.style.setProperty('height', 'auto', 'important');
      ч.места = {
        откуда: { left: а.left, docTop: а.top + сдвиг, width: а.width },
        куда: { left: б.left, top: б.top, width: б.width }
      };
      ч.записано = '';
    });
    logoMorph.путь = Math.max(1, logoMorph.экран.offsetHeight * 0.34);
  }

  // Ровный ход по колесу: smootherstep распределяет путь равномерно
  // и подходит к обоим краям с нулевым ускорением, поэтому ни старт,
  // ни посадка не читаются как отдельные события.
  function плавно(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function updateLogoMorph() {
    if (!logoMorph) return;
    // Одна и та же доля ведёт обе части: они летят вместе и вместе садятся.
    var доля = плавно(clamp(currentY / logoMorph.путь, 0, 1));
    logoMorph.части.forEach(function (ч) {
      if (!ч.места) return;
      var а = ч.места.откуда;
      var б = ч.места.куда;
      if (!(а.width > 0 && б.width > 0)) return;
      var верх = а.docTop - currentY;
      var масштаб = 1 + (б.width / а.width - 1) * доля;
      var x = а.left + (б.left - а.left) * доля;
      var y = верх + (б.top - верх) * доля;
      var стиль = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + масштаб.toFixed(4) + ')';
      // Пишем только изменившееся: иначе браузер пересчитывает стили
      // шестьдесят раз в секунду даже на стоящей странице.
      if (стиль !== ч.записано) { ч.записано = стиль; ч.знак.style.transform = стиль; }
    });
    body.classList.toggle('is-logo-docked', доля >= 0.995);
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

    // Прыжок больше половины экрана за кадр — ровно тот случай, на который
    // подстраховка и рассчитана: наблюдатель такие перемещения пропускает.
    if (Math.abs(velocity) > window.innerHeight * 0.5) разбудитьОбход();

    updateScrollState();
    updateParallax();
    updateMarquee();
    updateSticky();
    updateLogoMorph();
    sweepReveal(performance.now());

    // Следующий кадр заказываем, только если он для чего-то нужен.
    //
    // Раньше цикл крутился всегда: на стоящей странице браузер шестьдесят
    // раз в секунду будил вкладку, считал velocity, звал четыре функции —
    // и все они выходили, ничего не сделав. На ноутбуке это заметно
    // по расходу батареи: работа есть, результата нет.
    //
    // Теперь кадр продолжается, пока есть что доводить: страница ещё
    // едет, догоняет цель при плавной прокрутке, или работает подстраховка
    // к появлению блоков. Иначе цикл засыпает и просыпается от прокрутки.
    if (нуженКадр()) requestAnimationFrame(frame);
    else спим = true;
  }

  var спим = false;

  function нуженКадр() {
    if (Math.abs(velocity) > 0.05) return true;
    if (smoothEnabled && Math.abs(targetY - currentY) > 0.4) return true;
    var сейчас = typeof performance !== 'undefined' ? performance.now() : 0;
    if (revealPending && revealPending.length && сейчас <= обходДо) return true;
    return false;
  }

  // Любое движение страницы будит цикл. Обработчик лёгкий: он только
  // заказывает кадр, вся работа по-прежнему в кадре.
  function разбудитьКадр() {
    if (!спим) return;
    спим = false;
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Пересчёт при изменении размеров
  // ---------------------------------------------------------------------------

  var resizeTimer = null;

  function onResize() {
    снятьВысоту();
    разбудитьОбход();
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

      // Значение href приходит из разметки: «#2024» или «#раздел с пробелом»
    // роняют querySelector исключением и убивают весь обработчик.
    var target = null;
    try { target = document.querySelector(id); } catch (e) { return; }
      if (!target) return;

      e.preventDefault();
      scrollToEl(target);
    });
  }

  function scrollToEl(el) {
    // Переход по якорю — второй случай, когда наблюдатель не успевает.
    разбудитьОбход();
    // Родной переход по якорю не только прокручивает, но и переносит фокус.
    // Мы переход отменили, значит фокус надо перенести руками — иначе
    // ссылка «Перейти к содержанию» прокручивает страницу, а следующий
    // Tab уводит обратно в шапку, то есть ровно туда, от чего она спасает.
    if (el && el.setAttribute) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
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
    // Возврат кнопкой «назад» и открытие ссылки с якорем: браузер ставит
    // страницу сразу в нужное место, минуя прокрутку, — наблюдатель молчит.
    window.addEventListener('scroll', разбудитьКадр, { passive: true });
    window.addEventListener('wheel', разбудитьКадр, { passive: true });
    window.addEventListener('touchmove', разбудитьКадр, { passive: true });
    window.addEventListener('keydown', разбудитьКадр, { passive: true });

    window.addEventListener('hashchange', разбудитьОбход);
    window.addEventListener('popstate', разбудитьОбход);
    window.addEventListener('pageshow', разбудитьОбход);
    разбудитьОбход();

    window.addEventListener('load', function () {
      разбудитьОбход();
      initMarquee();       // после загрузки шрифтов ширина дорожки уже верная
      measureLogoMorph();
      collectParallax();
    });

    // Шрифт меняет высоту первого экрана и ширину надписи в шапке,
    // поэтому места посадки снимаются ещё раз, когда шрифт уже применён.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureLogoMorph();
        // Шрифт меняет высоту блоков, а значит и место каждого элемента
        // в документе. Раз позиции теперь запоминаются, их надо пересчитать.
        measureParallax();
      });
    }
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
      снятьВысоту();
      measureLogoMorph();
      collectParallax();
      collectSticky();

      // Блоки, дорисованные скриптом после запуска движка (каталог магазина,
      // дни в форме записи), тоже должны попасть под наблюдение — иначе они
      // останутся спрятанными теми же стилями, что прячут остальные.
      if (revealObserver && revealPending) {
        var добавлено = 0;
        document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(function (el) {
          if (revealPending.indexOf(el) !== -1) return;
          revealPending.push(el);
          revealObserver.observe(el);
          добавлено++;
        });
        // Обход будим только если блоки действительно появились. Иначе
        // на главной он просыпался пятнадцать раз подряд — texture.js зовёт
        // пересчёт на каждую новую фактуру, а фактуры не появляются
        // и не прячутся, им обход не нужен.
        if (добавлено) разбудитьОбход();
      }
    }
  };
})();
