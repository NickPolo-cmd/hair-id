/**
 * HAIR ID SHOP — catalog.js
 *
 * Каталог, подбор по задаче и корзина-заявка.
 *
 * Почему без настоящей корзины с оплатой. На старте ассортимент — полтора
 * десятка позиций, а продавец один человек. Онлайн-касса, эквайринг и склад
 * здесь стоят дороже, чем приносят. Поэтому корзина собирает заказ и отдаёт
 * его готовым сообщением в мессенджер: мастер подтверждает наличие и цену,
 * человек платит переводом или забирает в студии.
 *
 * Когда ассортимент вырастет, эта же структура данных переедет
 * в нормальный магазин без переписывания карточек.
 */

(function () {
  'use strict';

  var PHONE = '79944269944';

  // ---------------------------------------------------------------------------
  // Товары
  //
  // Поле task — та самая задача из диагностики, ради которой средство берут.
  // Это ядро магазина: человек ищет решение, а не название бренда.
  // ---------------------------------------------------------------------------

  var PRODUCTS = [
    {
      id: 'sh-keratin-shampoo',
      title: 'Бессульфатный шампунь',
      subtitle: 'после кератина и ботокса',
      task: ['after', 'dry'],
      price: 1290,
      volume: '300 мл',
      photo: 'assets/photo/care-bottle.jpg',
      forWhom: 'После кератинового выпрямления и ботокса, а также всем, у кого волосы быстро теряют гладкость',
      notFor: 'Не подойдёт при жирной коже головы как единственное средство — корни потребуют отдельного шампуня',
      why: 'Сульфаты вымывают состав из волоса: обычный шампунь снимает кератин за месяц вместо трёх. Мягкие ПАВ моют слабее, но не трогают то, за что вы заплатили.',
      how: 'Каждое мытьё, вместо обычного шампуня. Первые двое суток после процедуры голову не мыть вовсе.',
    },
    {
      id: 'sh-keratin-cond',
      title: 'Кондиционер для гладкости',
      subtitle: 'пара к бессульфатному шампуню',
      task: ['after', 'frizz'],
      price: 1190,
      volume: '250 мл',
      photo: 'assets/photo/care-2.jpg',
      forWhom: 'Работает в паре с бессульфатным шампунем после выпрямляющих процедур',
      notFor: 'Не заменяет маску, если волосы сильно повреждены осветлением',
      why: 'Закрывает чешуйки после мытья. Пока кутикула приподнята, волос цепляет влагу из воздуха и снова пушится.',
      how: 'После каждого мытья на длину, кроме корней. Полторы минуты, затем смыть.',
    },
    {
      id: 'sh-mask-lipid',
      title: 'Липидная маска',
      subtitle: 'когда белка уже достаточно',
      task: ['dry', 'damaged'],
      price: 1690,
      volume: '250 мл',
      photo: 'assets/photo/care-3.jpg',
      forWhom: 'Сухие, жёсткие, ломкие волосы — особенно если вы давно пользуетесь протеиновыми масками',
      notFor: 'Не подойдёт, если волосы тянутся и рвутся во влажном виде: там нужен белок, а не липиды',
      why: 'Перегруз белком — частая причина ломкости. Волосам не хватает не протеина, а жиров, которые держат влагу внутри.',
      how: 'Раз в неделю, десять минут. Чередовать с протеиновым средством, если мастер так сказала.',
    },
    {
      id: 'sh-mask-protein',
      title: 'Протеиновая маска',
      subtitle: 'для пустой, пористой длины',
      task: ['damaged'],
      price: 1690,
      volume: '250 мл',
      photo: 'assets/photo/care-4.jpg',
      forWhom: 'После осветления и обесцвечивания: волос тянется во влажном виде и рвётся',
      notFor: 'Не брать, если волосы уже жёсткие и ломкие — это признак избытка белка, будет хуже',
      why: 'Осветление вымывает белок и оставляет в стержне пустоты. Протеин заполняет их и возвращает упругость.',
      how: 'Раз в 10–14 дней, не чаще. Перебор с белком делает волосы стеклянными и ломкими.',
    },
    {
      id: 'sh-oil',
      title: 'Масло на длину',
      subtitle: 'несмываемое, лёгкое',
      task: ['dry', 'frizz'],
      price: 1490,
      volume: '100 мл',
      photo: 'assets/photo/care-5.jpg',
      forWhom: 'Сухие концы, пушистость к вечеру, статическое электричество зимой',
      notFor: 'Не наносить на корни и на тонкие волосы у лица — утяжелит',
      why: 'Запечатывает влагу внутри волоса и снижает трение при расчёсывании. Меньше трения — меньше сечения.',
      how: 'Две капли на влажные концы. Больше — волосы будут выглядеть грязными.',
    },
    {
      id: 'sh-scalp-shampoo',
      title: 'Шампунь для кожи головы',
      subtitle: 'когда корни жирнятся за день',
      task: ['scalp'],
      price: 1390,
      volume: '300 мл',
      photo: 'assets/photo/care-bottle.jpg',
      forWhom: 'Жирные корни и сухая длина на одной голове — самая частая пара',
      notFor: 'Не мыть им всю длину: концы пересохнут',
      why: 'Кожа и длина требуют разного. Один шампунь «для всех типов» либо сушит кожу, и она жирнится сильнее, либо утяжеляет длину.',
      how: 'Наносить только на корни, вспенить, смыть. Длину мыть стекающей пеной.',
    },
    {
      id: 'sh-scalp-serum',
      title: 'Сыворотка для кожи головы',
      subtitle: 'после очищения',
      task: ['scalp'],
      price: 1890,
      volume: '60 мл',
      photo: 'assets/photo/care-2.jpg',
      forWhom: 'Ощущение несвежести на второй день, стянутость, зуд после мытья',
      notFor: 'Не применять при ранках и раздражении — сначала к врачу',
      why: 'После очищения кожа впитывает уход, а не отталкивает его плёнкой из себума и силиконов.',
      how: 'На пробор, дважды в неделю, лёгкий массаж. Не смывать.',
    },
    {
      id: 'sh-thermal',
      title: 'Термозащита',
      subtitle: 'перед феном и утюжком',
      task: ['styling', 'after'],
      price: 990,
      volume: '150 мл',
      photo: 'assets/photo/care-4.jpg',
      forWhom: 'Всем, кто сушит феном чаще двух раз в неделю или пользуется утюжком',
      notFor: 'Не заменяет уход: это защита, а не восстановление',
      why: 'Фен и утюжок выпаривают влагу из стержня. Плёнка термозащиты снижает температуру на поверхности волоса.',
      how: 'На влажные волосы перед сушкой. На сухие — перед утюжком.',
    },
    {
      id: 'sh-texture',
      title: 'Текстурирующий спрей',
      subtitle: 'для укладки, которая держится',
      task: ['styling'],
      price: 1190,
      volume: '200 мл',
      photo: 'assets/photo/care-5.jpg',
      forWhom: 'Если хотите повторить дома укладку, которую сделали в студии',
      notFor: 'Не для гладких зеркальных укладок — даёт объём и лёгкую небрежность',
      why: 'Даёт волосу сцепление: причёска держит форму без килограмма лака.',
      how: 'На прикорневую зону и середину длины, затем разобрать пальцами.',
    },
    {
      id: 'sh-dryshampoo',
      title: 'Сухой шампунь',
      subtitle: 'между мытьём',
      task: ['scalp', 'styling'],
      price: 890,
      volume: '200 мл',
      photo: 'assets/photo/care-3.jpg',
      forWhom: 'Когда голову мыть некогда, а корни уже не свежие',
      notFor: 'Не мера постоянного применения: не отменяет мытьё и не лечит жирность',
      why: 'Впитывает излишки себума и возвращает объём. Это отсрочка, а не решение.',
      how: 'С расстояния 25 см на корни, выдержать минуту, вычесать.',
    },
    {
      id: 'sh-brush',
      title: 'Расчёска для влажных волос',
      subtitle: 'та, что не рвёт',
      task: ['damaged', 'dry'],
      price: 690,
      volume: 'штука',
      photo: 'assets/photo/process-2.jpg',
      forWhom: 'Всем, у кого волосы путаются после мытья',
      notFor: 'Не для укладки феном: для этого нужен брашинг',
      why: 'Мокрый волос растягивается и рвётся легче сухого. Гибкие зубцы скользят, а не выдирают.',
      how: 'Расчёсывать снизу вверх, от концов к корням, без рывков.',
    },
    {
      id: 'sh-towel',
      title: 'Полотенце из микрофибры',
      subtitle: 'вместо махрового тюрбана',
      task: ['damaged', 'frizz'],
      price: 790,
      volume: 'штука',
      photo: 'assets/photo/spa-towel.jpg',
      forWhom: 'Тем, кто закручивает волосы в тяжёлое махровое полотенце после душа',
      notFor: 'Не решает задачу само по себе: если волосы пушатся от сухости, полотенце поможет мало — нужен уход',
      why: 'Махровая петля цепляет чешуйки и приподнимает их, отсюда пушистость. Микрофибра впитывает быстрее и не трёт.',
      how: 'Промокнуть, не растирать. Не носить тюрбан дольше десяти минут.',
    },
  ];

  // Наборы: человек не выбирает между позициями, а берёт готовое решение
  var SETS = [
    {
      id: 'set-after-keratin',
      title: 'После кератина',
      items: ['t005', 't010'],
      price: null,
      old: null,
      photo: 'assets/photo/tovary/t005.webp',
      why: 'Минимум, без которого кератин смоется за месяц вместо трёх.',
    },
    {
      id: 'set-dry',
      title: 'Сухие волосы',
      items: ['t008', 't033', 't020'],
      price: null,
      old: null,
      photo: 'assets/photo/tovary/t033.webp',
      why: 'Мытьё, питание и защита длины — полный круг для обезвоженных волос.',
    },
    {
      id: 'set-scalp',
      title: 'Жирная кожа, сухая длина',
      items: ['t007', 't002', 't018'],
      price: null,
      old: null,
      photo: 'assets/photo/tovary/t007.webp',
      why: 'Отдельно кожа, отдельно длина — как и должно быть.',
    },
    {
      id: 'set-event',
      title: 'Перед мероприятием',
      items: ['t021', 't037', 't012'],
      price: null,
      old: null,
      photo: 'assets/photo/tovary/t021.webp',
      why: 'Чтобы повторить дома укладку, которую сделали в студии.',
    },
  ];

  var TASKS = [
    { key: 'all', label: 'Все средства', note: '' },
    { key: 'after', label: 'После кератина или ботокса', note: 'чтобы состав держался дольше' },
    { key: 'damaged', label: 'После осветления', note: 'ломкость, пористость, сечение' },
    { key: 'dry', label: 'Сухие и тусклые', note: 'нет блеска, жёсткие на ощупь' },
    { key: 'scalp', label: 'Жирные корни', note: 'несвежесть на второй день' },
    { key: 'frizz', label: 'Пушатся', note: 'не лежат, электризуются' },
    { key: 'styling', label: 'Укладка', note: 'чтобы держалось' },
  ];

  var cart = {};
  var activeTask = 'all';

  // Выбранный объём для товаров, у которых в одной карточке их несколько
  // («318 / 518 / 738 мл»). Пока человек не выбрал, записи здесь нет: тогда
  // в заказ уходит прежняя пометка «объём уточню», а не первый попавшийся
  // флакон — сами за человека мы не решаем.
  var chosenVol = {};

  var money = function (n) { return (n === null || n === undefined) ? 'Цена по запросу' : n.toLocaleString('ru-RU') + ' ₽'; };

  // ---------------------------------------------------------------------------
  // Хранение корзины
  //
  // Магазин многостраничный: средства на katalog.html, наборы на nabory.html,
  // и раньше корзина жила только в памяти страницы. Человек набирал уход,
  // переходил по ссылке в шапке — и заказ молча обнулялся.
  //
  // Всё обёрнуто в try/catch не для красоты: в приватном режиме Safari
  // обращение к localStorage выбрасывает исключение, и без перехвата
  // на этом месте падал бы весь каталог, а не только сохранение.
  // ---------------------------------------------------------------------------

  var CART_KEY = 'hairid-shop-cart';
  // Выбранные объёмы лежат отдельным ключом, а не внутри корзины: у людей,
  // которые уже что-то набрали, в хранилище лежит старый формат, и смена
  // формы записи молча обнулила бы им заказ.
  var VOL_KEY = 'hairid-shop-vol';

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    try { localStorage.setItem(VOL_KEY, JSON.stringify(chosenVol)); } catch (e) {}
  }

  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      Object.keys(raw).forEach(function (id) {
        var qty = Math.floor(raw[id]);
        // Позиции, которых больше нет в каталоге, не восстанавливаем: иначе
        // в заказ уйдёт средство, которого мастер уже не возит. Потолок в 99
        // штук — защита от подправленного руками хранилища.
        if (qty >= 1 && lineById(id)) cart[id] = Math.min(qty, 99);
      });
    } catch (e) {}

    try {
      var vols = JSON.parse(localStorage.getItem(VOL_KEY) || '{}');
      if (!vols || typeof vols !== 'object' || Array.isArray(vols)) return;
      Object.keys(vols).forEach(function (id) {
        var p = byId(id);
        // Восстанавливаем только объём, который у этого товара действительно
        // есть: список объёмов мог измениться, а подставленный из хранилища
        // «738 мл» ушёл бы мастеру как настоящий выбор.
        if (p && volumeList(p).indexOf(vols[id]) !== -1) chosenVol[id] = vols[id];
      });
    } catch (e) {}
  }
  // ---------------------------------------------------------------------------
  // Живые товары
  //
  // Если рядом лежит products.data.js — он собран из темы «Товары» в Telegram
  // скриптом tools/товары-в-магазин.mjs, и он главнее списка выше.
  // Список выше остаётся образцом: по нему видно, какие поля нужны карточке.
  // ---------------------------------------------------------------------------
  if (window.HAIRID_PRODUCTS && window.HAIRID_PRODUCTS.length) {
    PRODUCTS = window.HAIRID_PRODUCTS.map(function (t) {
      return {
        id: t.id,
        title: t.title,
        subtitle: t.subtitle || t.volume || '',
        task: t.task && t.task.length ? t.task : ['dry'],
        price: t.price,
        volume: t.volume || '',
        photo: t.photo,
        forWhom: t.forWhom || '',
        notFor: t.notFor || '',
        why: t.why || '',
        how: t.how || ''
      };
    });
  }

  var byId = function (id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; };
  var setById = function (id) { return SETS.filter(function (s) { return s.id === id; })[0]; };

  // ---------------------------------------------------------------------------
  // Позиция заказа
  //
  // В корзине лежат и товары, и наборы. Набор — одна позиция со своей ценой.
  //
  // Раньше набор рассыпался на товары, и обещанная на карточке скидка молча
  // исчезала: витрина показывала 2 290 ₽, а в заказ уходило 2 480 ₽. Это
  // ровно то, чего мы обещаем не делать — «цена не меняется».
  // ---------------------------------------------------------------------------

  // «318 / 518 / 738 мл» → ['318 мл', '518 мл', '738 мл']. Единица измерения
  // в данных написана один раз, в конце строки, поэтому дописываем её тем
  // объёмам, где остались одни цифры.
  function volumeList(p) {
    var raw = String((p && p.volume) || '');
    if (raw.indexOf('/') === -1) return [];
    var parts = raw.split('/').map(function (v) { return v.trim(); }).filter(Boolean);
    var unit = (parts[parts.length - 1].match(/[^\d\s.,]+$/) || [''])[0];
    return parts.map(function (v) {
      return /[^\d\s.,]/.test(v) ? v : (unit ? v + ' ' + unit : v);
    });
  }

  function lineById(id) {
    var p = byId(id);
    if (p) return { title: p.title, note: chosenVol[p.id] || p.volume, price: p.price, kind: 'product' };

    var s = setById(id);
    if (!s) return null;

    var names = s.items
      .map(function (i) { var q = byId(i); return q ? q.title.toLowerCase() : ''; })
      .filter(Boolean);

    return { title: 'Набор «' + s.title + '»', note: names.join(' + '), price: s.price, kind: 'set' };
  }

  // ---------------------------------------------------------------------------
  // Отрисовка
  // ---------------------------------------------------------------------------

  function renderTasks() {
    var box = document.getElementById('shop-tasks');
    if (!box) return;

    box.innerHTML = TASKS.map(function (t) {
      // aria-pressed, а не только класс: со скринридером иначе не понять,
      // какая задача сейчас выбрана — визуально это видно, на слух нет.
      return '<button type="button" class="task-chip' + (t.key === activeTask ? ' is-active' : '') + '"' +
               ' aria-pressed="' + (t.key === activeTask ? 'true' : 'false') + '" data-task="' + t.key + '">' +
               t.label + (t.note ? ' <span>' + t.note + '</span>' : '') +
             '</button>';
    }).join('');
  }

  function renderProducts() {
    var box = document.getElementById('shop-grid');
    if (!box) return;

    var list = activeTask === 'all'
      ? PRODUCTS
      : PRODUCTS.filter(function (p) { return p.task.indexOf(activeTask) !== -1; });

    var counter = document.getElementById('shop-count');
    if (counter) {
      // Смена задачи меняет только это число и сетку ниже. Без живой области
      // человек со скринридером нажимает чип и не узнаёт, сколько средств
      // осталось, — приходится вручную пересчитывать карточки.
      counter.setAttribute('role', 'status');
      counter.textContent = list.length + ' ' +
        (list.length % 10 === 1 && list.length % 100 !== 11 ? 'средство'
          : list.length % 10 >= 2 && list.length % 10 <= 4 && (list.length % 100 < 10 || list.length % 100 >= 20) ? 'средства'
          : 'средств');
    }

    if (!list.length) {
      box.innerHTML = '<p class="shop-empty">Под эту задачу подбираю индивидуально — напишите, посоветую.</p>';
      return;
    }

    box.innerHTML = list.map(function (p) {
      var inCart = cart[p.id] ? ' is-in-cart' : '';
      return '' +
      '<article class="product' + inCart + '" id="' + p.id + '" data-product="' + p.id + '" data-card-link>' +
        '<div class="product__media"><img src="' + p.photo + '" alt="' + p.title + '" loading="lazy"></div>' +
        '<div class="product__body">' +
          '<h3>' + p.title + '</h3>' +
          '<p class="product__subtitle">' + p.subtitle + '</p>' +
          // Пустое «Кому» не печатаем совсем: строка «Кому: Шампунь OLORCHEE»
          // выглядела как главный продающий текст карточки, а смысла в ней ноль.
          (p.forWhom ? '<p class="product__for"><b>Кому:</b> ' + p.forWhom + '</p>' : '') +
          (p.notFor && p.notFor !== '—' ? '<p class="product__notfor"><b>Кому не подойдёт:</b> ' + p.notFor + '</p>' : '') +
          afterProcedure(p) +
          '<details class="product__more"><summary>Почему это работает</summary>' +
            '<p>' + p.why + '</p><p><b>Как пользоваться.</b> ' + p.how + '</p>' +
          '</details>' +
          '<div class="product__foot">' +
            '<span class="product__price">' + money(p.price) + volumeField(p) + '</span>' +
            '<button type="button" class="product__add" data-add="' + p.id + '">' +
              (cart[p.id] ? 'В заказе' : 'В заказ') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // Обратная сторона связки «услуга → уход». На странице услуг под каждой
  // процедурой стоит блок «что взять домой»; здесь — тот же факт с другой
  // стороны: после какой процедуры это средство берут. Человек, который зашёл
  // в магазин с поиска, по этой строке понимает, что уход не сам по себе,
  // а продолжение работы мастера, — и заодно попадает на нужную услугу.
  //
  // Данные приходят готовым файлом js/svyazka.data.js, он собирается из того же
  // источника, что и блоки на сайте студии. Файла нет — строка просто
  // не печатается, каталог работает как раньше.
  function afterProcedure(p) {
    var карта = window.HAIRID_SVYAZKA || {};
    var список = карта[p.id];
    if (!список || !список.length) return '';

    var ссылки = список.map(function (у) {
      // target="_blank": студия — отдельный сайт, и уводить человека из
      // каталога с набранным заказом нельзя, корзина живёт на этой вкладке.
      return '<a href="' + у.адрес + '" target="_blank" rel="noopener">' + у.имя + '</a>';
    }).join(', ');

    return '<p class="product__after"><b>Советую после:</b> ' + ссылки + '</p>';
  }

  // Объём в карточке. Когда в данных объёмов несколько, вместо строки
  // «318 / 518 / 738 мл» печатаем выбор: иначе выбрать нужный флакон негде,
  // и мастер переспрашивает по каждой такой позиции.
  function volumeField(p) {
    var volumes = volumeList(p);
    if (!volumes.length) return '<i>' + p.volume + '</i>';

    return '<select class="product__vol" data-vol="' + p.id + '" aria-label="Объём — ' + p.title + '">' +
             '<option value="">Объём — выберите</option>' +
             volumes.map(function (v) {
               return '<option value="' + v + '"' + (chosenVol[p.id] === v ? ' selected' : '') + '>' + v + '</option>';
             }).join('') +
           '</select>';
  }

  function renderSets() {
    var box = document.getElementById('shop-sets');
    if (!box) return;

    box.innerHTML = SETS.map(function (s) {
      var names = s.items.map(function (id) { var p = byId(id); return p ? p.title : ''; }).filter(Boolean);
      return '' +
      '<article class="set" data-reveal="up" data-card-link>' +
        '<div class="set__media"><img src="' + s.photo + '" alt="' + s.title + '" loading="lazy"></div>' +
        '<div class="set__body">' +
          '<h3>' + s.title + '</h3>' +
          '<p class="set__why">' + s.why + '</p>' +
          '<ul class="set__items">' + names.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>' +
          '<div class="set__foot">' +
            '<span class="set__price">' + money(s.price) + (s.old ? '<s>' + money(s.old) + '</s>' : '') + '</span>' +
            '<button type="button" class="set__add" data-add-set="' + s.id + '">В заказ</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Заказ
  // ---------------------------------------------------------------------------

  function cartCount() {
    return Object.keys(cart).reduce(function (sum, k) { return sum + cart[k]; }, 0);
  }

  // Цены владелец пока заполнил не у всех позиций, и это нормальное рабочее
  // состояние. Плохо было другое: бесценовые позиции складывались как нули, и
  // полная корзина показывала «Итого 0 ₽» — та же сумма уходила в мессенджер.
  // Придумывать цены нельзя, поэтому считаем только известные, а про остальные
  // честно пишем «по запросу».

  function cartTotal() {
    return Object.keys(cart).reduce(function (sum, k) {
      var line = lineById(k);
      return sum + (line && line.price ? line.price * cart[k] : 0);
    }, 0);
  }

  function hasUnpriced() {
    return Object.keys(cart).some(function (k) {
      var line = lineById(k);
      return !line || !line.price;
    });
  }

  // Подпись в панели заказа. Коротко — у неё ровно одна строка рядом со
  // словом «Итого», длинный текст вылезет за край панели.
  function totalLabel() {
    if (!Object.keys(cart).length) return '—';
    if (!hasUnpriced()) return money(cartTotal());
    return cartTotal() > 0 ? 'от ' + money(cartTotal()) : 'по запросу';
  }

  // Та же сумма для сообщения мастеру — здесь место есть, поэтому пишем
  // словами, от лица покупателя, чтобы сообщение не противоречило себе.
  function totalForOrder() {
    if (!hasUnpriced()) return 'Итого: ' + money(cartTotal());
    if (cartTotal() > 0) return 'Итого: ' + money(cartTotal()) + ' за позиции с ценой, остальные — по запросу';
    return 'Итого: цены в каталоге пока нет — жду расчёт';
  }

  function renderCart() {
    var badge = document.getElementById('cart-count');
    var panel = document.getElementById('cart-panel');
    var listBox = document.getElementById('cart-list');
    var totalBox = document.getElementById('cart-total');

    var n = cartCount();
    if (badge) badge.textContent = n;
    if (panel) {
      panel.classList.toggle('is-visible', n > 0);
      syncCartToggle(panel.classList.contains('is-visible'));
    }

    if (listBox && !n) {
      // Панель теперь открывается и кнопкой в шапке, то есть её можно увидеть
      // пустой. Пустой список выглядел бы поломкой, поэтому объясняем словами.
      listBox.innerHTML = '<li class="cart-item">Пока пусто — добавьте средство из каталога</li>';
    } else if (listBox) {
      listBox.innerHTML = Object.keys(cart).map(function (id) {
        var line = lineById(id);
        if (!line) return '';
        return '<li class="cart-item' + (line.kind === 'set' ? ' cart-item--set' : '') + '">' +
                 '<span class="cart-item__name">' + line.title +
                   (line.kind === 'set' ? '<i>' + line.note + '</i>' : '') +
                 '</span>' +
                 '<span class="cart-item__qty">' +
                   '<button type="button" data-dec="' + id + '" aria-label="Убрать одну штуку">−</button>' +
                   '<b>' + cart[id] + '</b>' +
                   '<button type="button" data-inc="' + id + '" aria-label="Добавить одну штуку">+</button>' +
                 '</span>' +
                 '<span class="cart-item__sum">' + (line.price ? money(line.price * cart[id]) : 'по запросу') + '</span>' +
               '</li>';
      }).join('');
    }

    if (totalBox) totalBox.textContent = totalLabel();

    var wa = document.getElementById('cart-wa');
    var tg = document.getElementById('cart-tg');
    var msg = buildOrder();
    if (wa) wa.href = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(msg);
    // Telegram текст по ссылке не подставляет — он копируется по нажатию,
    // см. initTelegram. Здесь только адрес чата.
    if (tg) tg.href = 'https://t.me/+' + PHONE;

    // Кнопки наборов подписываем без перерисовки: у карточек набора стоит
    // data-reveal, и полная перерисовка спрятала бы их до нового появления.
    document.querySelectorAll('[data-add-set]').forEach(function (b) {
      var id = b.getAttribute('data-add-set');
      b.textContent = cart[id] ? 'В заказе' : 'В заказ';
      var card = b.closest('.set');
      if (card) card.classList.toggle('is-in-cart', !!cart[id]);
    });

    // Карточки товаров подписываем так же точечно. Полная перерисовка сетки
    // сбрасывала раскрытые <details> «Почему это работает»: человек сравнивал
    // составы, нажимал «В заказ» — и все описания захлопывались.
    // Сетка целиком перерисовывается только там, где это по смыслу нужно, —
    // при смене задачи в фильтре.
    document.querySelectorAll('[data-add]').forEach(function (b) {
      var id = b.getAttribute('data-add');
      b.textContent = cart[id] ? 'В заказе' : 'В заказ';
      var card = b.closest('.product');
      if (card) card.classList.toggle('is-in-cart', !!cart[id]);
    });
  }

  // Кнопка «Заказ» в шапке — единственный способ вернуть свёрнутую панель,
  // поэтому её состояние держим в aria-expanded, а связь с панелью —
  // в aria-controls. В разметке этих атрибутов нет, ставим их отсюда.
  function syncCartToggle(open) {
    var toggle = document.getElementById('cart-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-controls', 'cart-panel');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function buildOrder() {
    // Пустую корзину не выдаём за заказ: панель теперь открывается кнопкой
    // в шапке, то есть до первого добавления по ссылке уйдёт вот это.
    if (!Object.keys(cart).length) {
      return 'Здравствуйте! Пишу с сайта Hair ID Shop. Помогите, пожалуйста, подобрать уход — расскажу, что с волосами.';
    }

    var lines = ['Здравствуйте! Хочу заказать уход в Hair ID Shop.', ''];

    Object.keys(cart).forEach(function (id) {
      var line = lineById(id);
      if (!line) return;

      // У части товаров в одной карточке сразу несколько объёмов
      // («300 / 800 мл»). Если объём выбран в карточке, сюда уже подставлена
      // одна величина и пометка не нужна; пока не выбран — она остаётся,
      // иначе мастер не знает, какой флакон нужен.
      var manyVolumes = line.kind === 'product' && line.note && line.note.indexOf('/') !== -1;
      var note = line.note ? ' (' + line.note + (manyVolumes ? ', объём уточню' : '') + ')' : '';

      lines.push('— ' + line.title + note + ' × ' + cart[id] +
                 ' = ' + (line.price ? money(line.price * cart[id]) : 'цену уточню'));
    });

    lines.push('');
    lines.push(totalForOrder());
    lines.push('');
    lines.push('Подскажите, что из этого действительно нужно моим волосам?');

    return lines.join('\n');
  }

  function add(id, qty) {
    cart[id] = (cart[id] || 0) + (qty || 1);
    if (cart[id] < 1) delete cart[id];
    saveCart();
    renderCart();
  }

  // ---------------------------------------------------------------------------
  // События
  // ---------------------------------------------------------------------------

  function initEvents() {
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-task]');
      if (chip) {
        activeTask = chip.getAttribute('data-task');
        renderTasks();
        renderProducts();
        if (window.HairIDMotion) window.HairIDMotion.refresh();
        return;
      }

      var addBtn = e.target.closest('[data-add]');
      if (addBtn) { add(addBtn.getAttribute('data-add'), 1); return; }

      var addSet = e.target.closest('[data-add-set]');
      if (addSet) { add(addSet.getAttribute('data-add-set'), 1); return; }

      var inc = e.target.closest('[data-inc]');
      if (inc) { add(inc.getAttribute('data-inc'), 1); return; }

      var dec = e.target.closest('[data-dec]');
      if (dec) { add(dec.getAttribute('data-dec'), -1); return; }

      var toggle = e.target.closest('#cart-toggle');
      if (toggle) {
        // Панель показывается классом is-visible (shop.css). Класса is-open
        // в стилях магазина нет вообще — поэтому кнопка «Заказ» раньше
        // не делала ничего, и свёрнутую панель нельзя было вернуть.
        var panel = document.getElementById('cart-panel');
        if (!panel) return;
        panel.classList.remove('is-dismissed');
        syncCartToggle(panel.classList.toggle('is-visible'));
        return;
      }
    });

    // Выбор объёма. Пересобрать корзину нужно сразу: в ней же собирается
    // текст заказа и ссылка на WhatsApp, иначе туда уйдёт прежний объём.
    document.addEventListener('change', function (e) {
      var vol = e.target.closest ? e.target.closest('.product__vol') : null;
      if (!vol) return;
      var id = vol.getAttribute('data-vol');
      if (vol.value) chosenVol[id] = vol.value;
      else delete chosenVol[id];
      saveCart();
      renderCart();
    });
  }

  // ---------------------------------------------------------------------------
  // Telegram
  //
  // Параметр ?text= Telegram поддерживает только для ботов и для t.me/share.
  // По номеру телефона он его игнорирует: чат открывается пустым, и собранный
  // заказ теряется. Проверено на живом сайте. Поэтому кладём текст в буфер —
  // человек вставит его одним движением.
  // ---------------------------------------------------------------------------

  function initTelegram() {
    var tg = document.getElementById('cart-tg');
    if (!tg) return;

    tg.addEventListener('click', function () {
      var original = tg.getAttribute('data-label') || tg.textContent;
      tg.setAttribute('data-label', original);

      var done = function (ok) {
        tg.textContent = ok ? 'Заказ скопирован — вставьте в чат' : 'Скопируйте заказ вручную';
        tg.classList.add('is-done');
        window.setTimeout(function () {
          tg.textContent = original;
          tg.classList.remove('is-done');
        }, 3600);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(buildOrder()).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  function init() {
    // Читаем корзину до первой отрисовки: живые товары к этому моменту уже
    // подставлены (это происходит выше, при загрузке файла), значит lineById
    // сможет проверить, что сохранённые позиции ещё есть в каталоге.
    loadCart();
    renderTasks();
    renderProducts();
    renderSets();
    renderCart();
    initEvents();
    initTelegram();
    if (window.HairIDMotion) window.HairIDMotion.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
