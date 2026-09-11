/**
 * HAIR ID SHOP — shop-ui.js
 *
 * Мелочи интерфейса магазина: мобильное меню, сворачивание панели заказа
 * и подстановка адреса сайта студии.
 *
 * Про ссылки на студию. Пока оба сайта лежат рядом в папке, ссылка ведёт
 * по относительному пути. После публикации у студии свой адрес — он
 * подставляется здесь, в одном месте, вместо правки десятка ссылок в разметке.
 */

(function () {
  'use strict';

  // Адрес сайта студии. Заполняется после публикации.
  var STUDIO_URL = 'https://hairid.netlify.app';

  function initStudioLinks() {
    if (!STUDIO_URL) return;
    document.querySelectorAll('[data-studio-link]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var hash = href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';
      a.setAttribute('href', STUDIO_URL + hash);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  }

  function initBurger() {
    var burger = document.querySelector('.burger');
    if (!burger) return;

    // Открытое меню — сплошная шторка на весь экран, но страница под ней
    // остаётся в документе. Без inert клавиша Tab уводила фокус на ссылки
    // каталога и на липкую панель внизу — они полностью закрыты шторкой,
    // рамки фокуса не видно, а вернуться к бургеру можно было, только протабав
    // страницу целиком. inert убирает эти области и из обхода Tab, и из дерева
    // доступности. Шапку не трогаем: в ней живут сам бургер и пункты меню.
    var подложка = ['main', '.site-footer', '.mobile-bar'];

    // Все три способа закрыть меню идут через одну функцию: иначе inert
    // однажды останется висеть на странице после закрытия, и она перестанет
    // отвечать на клавиатуру вообще.
    function переключить(open) {
      document.body.classList.toggle('menu-is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      подложка.forEach(function (selector) {
        var el = document.querySelector(selector);
        if (el) el.toggleAttribute('inert', open);
      });
    }

    burger.addEventListener('click', function () {
      переключить(!document.body.classList.contains('menu-is-open'));
    });

    document.querySelectorAll('.site-nav a').forEach(function (link) {
      link.addEventListener('click', function () { переключить(false); });
    });

    // Escape — привычный выход из любой шторки. Фокус возвращаем на бургер:
    // человек продолжает оттуда, откуда меню открыл.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !document.body.classList.contains('menu-is-open')) return;
      переключить(false);
      burger.focus();
    });

    // Стили шторки живут внутри @media (max-width: 768px). Если растянуть окно
    // с открытым меню, шторка исчезает сама, а класс остаётся — и вместе с ним
    // остался бы inert, то есть вся страница на широком экране стала бы
    // недоступной с клавиатуры. Поэтому на выходе из мобильной ширины закрываем.
    var мобильная = window.matchMedia('(max-width: 768px)');
    var приСмене = function (e) { if (!e.matches) переключить(false); };
    if (мобильная.addEventListener) мобильная.addEventListener('change', приСмене);
    else if (мобильная.addListener) мобильная.addListener(приСмене);
  }

  function initCartClose() {
    var close = document.getElementById('cart-toggle-close');
    var panel = document.getElementById('cart-panel');
    if (!close || !panel) return;

    close.addEventListener('click', function () {
      panel.classList.remove('is-visible');
      // Кнопка «Заказ» в шапке теперь открывает и закрывает эту панель,
      // поэтому её aria-expanded нужно обновлять и отсюда — иначе после
      // сворачивания крестиком скринридер продолжит объявлять «развёрнуто».
      var toggle = document.getElementById('cart-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      // Панель вернётся, как только человек добавит следующую позицию
      window.setTimeout(function () { panel.classList.add('is-dismissed'); }, 600);
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-add], [data-add-set], [data-inc]')) {
        panel.classList.remove('is-dismissed');
      }
    });
  }

  function initFaqSync() {
    document.querySelectorAll('details').forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (window.HairIDMotion) window.HairIDMotion.refresh();
      });
    });
  }

  function init() {
    initStudioLinks();
    initBurger();
    initCartClose();
    initFaqSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
