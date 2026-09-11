/* pages.js — мелкая логика внутренних вкладок (правка 15) */
(function () {
  'use strict';

  // Фильтр галереи работ
  var панель = document.querySelector('.works-filter');
  var галерея = document.getElementById('works-gallery');
  if (панель && галерея) {
    панель.addEventListener('click', function (e) {
      var кнопка = e.target.closest('.works-filter__btn');
      if (!кнопка) return;
      var вид = кнопка.dataset.filter;

      панель.querySelectorAll('.works-filter__btn').forEach(function (b) {
        b.classList.toggle('is-active', b === кнопка);
        b.setAttribute('aria-pressed', b === кнопка ? 'true' : 'false');
      });
      галерея.querySelectorAll('.rabota').forEach(function (ф) {
        ф.hidden = !(вид === 'все' || ф.dataset.vid === вид);
      });
    });
  }
})();
