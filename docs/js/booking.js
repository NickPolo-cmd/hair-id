/**
 * HAIR ID — booking.js
 *
 * Система записи без сервера и без базы данных.
 *
 * Почему так. Мастер работает одна и ведёт расписание сама. Настоящая
 * онлайн-запись с календарём означала бы сервер, оплату хостинга и риск,
 * что клиентка забронирует время, которого уже нет. Здесь другая логика:
 * форма собирает всё, что мастеру нужно знать для ответа, превращает это
 * в готовое сообщение и открывает мессенджер. Отправляет человек сам.
 *
 * Что это даёт:
 * — клиентка не пишет «здравствуйте, а сколько стоит» и не ждёт пять
 *   уточняющих вопросов: мастер сразу видит услугу, длину, историю волос;
 * — ничего не отправляется без ведома человека, никакие данные не уходят
 *   на сторонние серверы;
 * — работает на любом хостинге, включая бесплатный.
 */

(function () {
  'use strict';

  var PHONE = '79944269944';
  var PHONE_HUMAN = '8 994 426-99-44';

  var form = document.getElementById('booking-form');
  if (!form) return;

  var daysBox = document.getElementById('booking-days');
  var slotsBox = document.getElementById('booking-slots');
  var previewText = document.getElementById('booking-preview-text');
  var waLink = document.getElementById('send-wa');
  var tgLink = document.getElementById('send-tg');
  var maxBtn = document.getElementById('send-max');

  var state = { day: '', slot: '', service: '', name: '', length: '', note: '' };

  // ---------------------------------------------------------------------------
  // Ближайшие две недели
  // ---------------------------------------------------------------------------

  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function buildDays() {
    if (!daysBox) return;

    var today = new Date();
    var html = '';

    for (var i = 0; i < 14; i++) {
      var d = new Date(today.getTime() + i * 86400000);
      var label = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : WEEKDAYS[d.getDay()];
      var human = d.getDate() + ' ' + MONTHS[d.getMonth()];
      var value = human + ' (' + WEEKDAYS[d.getDay()] + ')';
      var weekend = d.getDay() === 0 || d.getDay() === 6;

      html += '<button type="button" class="booking-day' + (weekend ? ' is-weekend' : '') + '"' +
              ' data-day="' + value + '" role="radio" aria-checked="false">' +
                '<span class="booking-day__num">' + d.getDate() + '</span>' +
                '<span class="booking-day__label">' + label + '</span>' +
              '</button>';
    }

    daysBox.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Выбор одного варианта из группы
  // ---------------------------------------------------------------------------

  function pickOne(container, selector, el, key) {
    container.querySelectorAll(selector).forEach(function (b) {
      b.classList.remove('is-active');
      b.setAttribute('aria-checked', 'false');
    });
    el.classList.add('is-active');
    el.setAttribute('aria-checked', 'true');
    state[key] = el.getAttribute('data-' + key);
    render();
  }

  function initChoice() {
    if (daysBox) {
      daysBox.addEventListener('click', function (e) {
        var b = e.target.closest('.booking-day');
        if (b) pickOne(daysBox, '.booking-day', b, 'day');
      });
    }

    if (slotsBox) {
      slotsBox.addEventListener('click', function (e) {
        var b = e.target.closest('.booking-slot');
        if (b) pickOne(slotsBox, '.booking-slot', b, 'slot');
      });
    }

    form.addEventListener('input', readFields);
    form.addEventListener('change', readFields);
  }

  function readFields() {
    var service = document.getElementById('bf-service');
    state.service = service ? service.value : '';
    state.name = (document.getElementById('bf-name') || {}).value || '';
    state.length = (document.getElementById('bf-len') || {}).value || '';
    state.note = (document.getElementById('bf-note') || {}).value || '';
    render();
  }

  // ---------------------------------------------------------------------------
  // Сборка сообщения
  //
  // Порядок строк выбран так, чтобы мастер за три секунды поняла,
  // о чём речь, и могла ответить по существу, а не переспрашивать.
  // ---------------------------------------------------------------------------

  function buildMessage() {
    var lines = [];

    lines.push('Здравствуйте! Хочу записаться в Hair ID.');
    lines.push('');
    lines.push('Услуга: ' + (state.service || 'бесплатная диагностика'));

    if (state.day) lines.push('День: ' + state.day);
    if (state.slot) lines.push('Время: ' + state.slot);
    if (state.length) lines.push('Длина волос: ' + state.length);
    if (state.name) lines.push('Меня зовут: ' + state.name);

    if (state.note) {
      lines.push('');
      lines.push('О волосах: ' + state.note);
    }

    lines.push('');
    lines.push('Фото волос при дневном свете пришлю следом.');

    return lines.join('\n');
  }

  function render() {
    var msg = buildMessage();

    if (previewText) previewText.textContent = msg;

    var encoded = encodeURIComponent(msg);
    if (waLink) waLink.href = 'https://wa.me/' + PHONE + '?text=' + encoded;
    // Telegram получает только адрес чата. Почему без текста — см. initTelegram.
    if (tgLink) tgLink.href = 'https://t.me/+' + PHONE;
  }

  // ---------------------------------------------------------------------------
  // Буфер обмена
  //
  // Нужен двум кнопкам из трёх.
  //
  // MAX: у мессенджера нет публичной ссылки на чат по номеру.
  //
  // Telegram: ссылка на чат по номеру есть, а вот параметр ?text= он
  // поддерживает только для ботов и для t.me/share. По номеру телефона текст
  // молча теряется — чат открывается пустым, и всё, что человек собрал в
  // форме, исчезает. Проверено на живом сайте. Поэтому здесь тот же честный
  // сценарий, что и у MAX: кладём готовый текст в буфер, человек вставляет
  // его одним движением.
  //
  // WhatsApp ?text= поддерживает, там ничего копировать не нужно.
  // ---------------------------------------------------------------------------

  function flashLabel(btn, okText, failText, ok) {
    var original = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', original);
    btn.textContent = ok ? okText : failText;
    btn.classList.add('is-done');
    // Без сброса прежнего таймера второе нажатие гасло раньше времени:
    // срабатывал отсчёт от первого.
    window.clearTimeout(btn._таймерПодписи);
    btn._таймерПодписи = window.setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('is-done');
    }, 3600);
  }

  function copyThen(btn, msg, okText, failText, after) {
    var done = function (ok) {
      flashLabel(btn, okText, failText, ok);
      if (after) after(ok);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  }

  function initMax() {
    if (!maxBtn) return;

    maxBtn.addEventListener('click', function () {
      var msg = buildMessage() + '\n\nНомер мастера: +7 ' + PHONE.slice(1);
      // Окно открываем СРАЗУ, внутри обработчика нажатия. Если сделать это
      // в колбэке после копирования в буфер, Safari посчитает вызов
      // не связанным с жестом человека и заблокирует вкладку молча:
      // текст скопируется, подпись сменится, а мессенджер не откроется.
      var окно = null;
      try { окно = window.open('https://max.ru', '_blank', 'noopener'); } catch (e) { окно = null; }
      copyThen(maxBtn, msg, окно ? 'Текст скопирован' : 'Скопировано, откройте MAX',
        'Номер: ' + PHONE_HUMAN);
    });
  }

  function initTelegram() {
    if (!tgLink) return;

    tgLink.addEventListener('click', function () {
      // Ссылку не перехватываем: пусть открывается как обычно, в новой вкладке.
      // Копирование идёт параллельно — к моменту, когда откроется чат, текст
      // уже в буфере.
      copyThen(tgLink, buildMessage(), 'Текст скопирован — вставьте в чат',
               'Скопируйте текст выше вручную', null);
    });
  }

  // ---------------------------------------------------------------------------
  // Кнопки «Записаться» на карточках услуг
  //
  // Клик по карточке подставляет услугу в форму и прокручивает к ней:
  // человек не ищет нужный пункт в списке из тринадцати позиций.
  // ---------------------------------------------------------------------------

  // Приход со страницы услуг.
  //
  // Кнопка «Записаться на эту процедуру» стоит у каждой из двенадцати услуг,
  // но вела просто на форму — и человек, только что выбравший процедуру,
  // должен был искать её заново в списке из тринадцати позиций. Теперь
  // название приезжает в адресе, и форма подставляет его сама.
  //
  // Значение берётся из списка формы по точному совпадению: подставить
  // в сообщение произвольный текст из адреса нельзя, иначе любой сможет
  // прислать мастеру заказ с чужим содержимым по подсунутой ссылке.
  function подставитьУслугуИзАдреса() {
    var м = /[?&]usluga=([^&#]*)/.exec(window.location.search);
    if (!м) return;
    var имя;
    try { имя = decodeURIComponent(м[1].replace(/\+/g, ' ')); } catch (e) { return; }

    var select = document.getElementById('bf-service');
    if (!select) return;

    var нашлось = Array.prototype.some.call(select.options, function (o) {
      if (o.value === имя) { select.value = o.value; return true; }
      return false;
    });
    if (!нашлось) return;

    readFields();

    // Подсвечиваем форму — иначе подстановка незаметна: человек приехал
    // на якорь и не понимает, изменилось что-то или нет.
    var f = document.querySelector('.booking-form');
    if (f) {
      f.classList.add('is-highlighted');
      window.setTimeout(function () { f.classList.remove('is-highlighted'); }, 1400);
    }
  }

  function initServiceButtons() {
    document.querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-book');
        var select = document.getElementById('bf-service');

        if (select) {
          var found = Array.prototype.some.call(select.options, function (o) {
            if (o.value === name) { select.value = o.value; return true; }
            return false;
          });
          if (!found) select.selectedIndex = 0;
        }

        readFields();

        var target = document.getElementById('booking');
        if (target) {
          if (window.HairIDMotion) window.HairIDMotion.scrollTo(target);
          else target.scrollIntoView({ behavior: 'smooth' });
        }

        // Подсвечиваем форму, чтобы было видно: выбор подставился
        var f = document.querySelector('.booking-form');
        if (f) {
          f.classList.add('is-highlighted');
          window.setTimeout(function () { f.classList.remove('is-highlighted'); }, 1400);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Запуск
  // ---------------------------------------------------------------------------

  function init() {
    buildDays();
    initChoice();
    initMax();
    initTelegram();
    initServiceButtons();
    подставитьУслугуИзАдреса();
    readFields();

    // Высота страницы изменилась после отрисовки дней
    if (window.HairIDMotion) window.HairIDMotion.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
