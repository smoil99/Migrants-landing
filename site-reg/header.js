/*
  Шапка-стекло: подстраивает тон под то, что под ней.
  Над тёмными участками — класс .is-dark (белый текст), над светлыми — без него.
  Над первым экраном — ещё и .is-over-hero (прозрачная, без обводки).
  В разметке шапка сразу с этими классами: страница открывается на первом экране, и до загрузки скрипта
  шапка уже прозрачная — без белой вспышки.
*/
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const DARK = '.hero, .services-section, .contact-section, .flow-demo, .features-section, .methods-cta, .why-section, .methods-section';   // футер светлый — шапка над ним обычная
  let queued = false;

  function update() {
    queued = false;
    const y = header.offsetHeight / 2;
    const under = document.elementsFromPoint(innerWidth / 2, y).find(el => !header.contains(el));
    // Слайдер «5 шагов» лежит на белом фоне: тёмные в нём только сами карточки-окна
    const light = under?.closest('.flow-slider') && !under.closest('.flow-slide-media');
    header.classList.toggle('is-dark', Boolean(under?.closest(DARK)) && !light);
    // Над первым экраном — без фона и обводки, как на parloa.com
    header.classList.toggle('is-over-hero', Boolean(under?.closest('.hero')));
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
  // до первого расчёта шапка без переходов: иначе при открытии мелькал белый фон (см. .is-booting)
  requestAnimationFrame(() => requestAnimationFrame(() => header.classList.remove('is-booting')));
})();
