/**
 * HAIR ID — analytics.js
 *
 * Яндекс Метрика и цели.
 *
 * ЧТОБЫ ВКЛЮЧИТЬ, нужен номер счётчика — четыре шага, около пяти минут:
 *   1. Зайти на metrika.yandex.ru под своей почтой
 *   2. «Добавить счётчик»: имя Hair ID, адрес nickpolo-cmd.github.io/hair-id/
 *   3. Включить «Вебвизор, карта скроллинга, аналитика форм» — на малом трафике
 *      запись действий полезнее цифр: видно, где человек застрял
 *   4. Скопировать номер счётчика (7–8 цифр) и вписать его ниже вместо нуля
 *
 * Пока номер равен нулю, счётчик не подключается: никаких запросов и ошибок.
 *
 * Цели настраиваются сами — код отправляет события при каждом важном действии.
 * В интерфейсе Метрики останется создать цели типа «JavaScript-событие»
 * с идентификаторами: call, whatsapp, telegram, max, booking_open,
 * service_book, shop_click.
 */

(function () {
  'use strict';

  // ↓↓↓ ВПИСАТЬ НОМЕР СЧЁТЧИКА ЗДЕСЬ ↓↓↓
  var YM_ID = 0;
  // ↑↑↑ например: var YM_ID = 12345678; ↑↑↑

  var enabled = YM_ID > 0;

  // ---------------------------------------------------------------------------
  // Подключение счётчика
  // ---------------------------------------------------------------------------

  if (enabled) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) return;
      }
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(YM_ID, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });

    // Тег <noscript> для тех, у кого выключен JavaScript
    var ns = document.createElement('noscript');
    ns.innerHTML = '<div><img src="https://mc.yandex.ru/watch/' + YM_ID +
                   '" style="position:absolute;left:-9999px" alt=""></div>';
    document.body.appendChild(ns);
  }

  // ---------------------------------------------------------------------------
  // Отправка цели
  //
  // Работает и без счётчика: тогда просто ничего не отправляет, но код
  // остаётся на месте и заработает сразу после вписывания номера.
  // ---------------------------------------------------------------------------

  function goal(name, params) {
    if (enabled && window.ym) window.ym(YM_ID, 'reachGoal', name, params || {});
  }

  window.hairIdGoal = goal;

  // Пока номер счётчика не вписан, отправлять просто некуда: goal() молча
  // выходит. Значит, и слушателей вешать незачем — иначе файл на каждой
  // странице обрабатывал каждый клик по документу и каждое событие прокрутки
  // впустую. Как только номер появится вместо нуля, всё ниже включится само.
  if (!enabled) return;

  // ---------------------------------------------------------------------------
  // Что считаем
  //
  // Цели выбраны по одному признаку: это моменты, где человек переходит
  // от чтения к действию. Просмотры страниц без них ничего не говорят.
  // ---------------------------------------------------------------------------

  // Адрес магазина зависит от того, куда сайт выложен: на Netlify это
  // отдельный домен, а сборка для GitHub Pages переписывает его в подпапку
  // /shop того же адреса. Поэтому одной подстроки мало — проверяем обе формы,
  // иначе на одной из выкладок цель молчит навсегда.
  // Якорь «#shop» под условие не попадает: перед словом должна стоять косая.
  function вМагазин(url) {
    return /hairid-shop\./.test(url) || /\/shop(\/|$|[?#])/.test(url);
  }

  // Файл один на оба сайта. Внутри самого магазина ссылки на его же разделы
  // не считаем: цель shop_click значит «переход студия → магазин».
  var мыВМагазине = вМагазин(location.href);

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');

    if (a && a.href) {
      if (a.href.indexOf('tel:') === 0) return goal('call');
      if (a.href.indexOf('wa.me') !== -1) return goal('whatsapp');
      if (a.href.indexOf('t.me') !== -1) return goal('telegram');
      if (a.href.indexOf('max.ru') !== -1) return goal('max');
      if (!мыВМагазине && вМагазин(a.href)) return goal('shop_click');
      if (a.href.indexOf('#booking') !== -1) return goal('booking_open');
    }

    var book = e.target.closest('[data-book]');
    if (book) return goal('service_book', { service: book.getAttribute('data-book') });

    if (e.target.closest('#send-max')) return goal('max');

    var picker = e.target.closest('[data-picker]');
    if (picker) return goal('picker_use', { task: picker.getAttribute('data-picker') });
  });

  // ---------------------------------------------------------------------------
  // Глубина прочтения
  //
  // Показывает, докуда доходят люди. Если до цен доходит 20% —
  // проблема в первом экране, а не в ценах.
  // ---------------------------------------------------------------------------

  var marks = { 25: false, 50: false, 75: false, 100: false };

  function checkDepth() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = Math.round((window.scrollY / h) * 100);

    Object.keys(marks).forEach(function (m) {
      if (!marks[m] && pct >= Number(m)) {
        marks[m] = true;
        goal('scroll_' + m);
      }
    });
  }

  window.addEventListener('scroll', checkDepth, { passive: true });
})();
