/*
  Шапка-стекло: подстраивает тон под то, что под ней.
  Над тёмными участками — класс .is-dark (белый текст), над светлыми — без него.
*/
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const DARK = '.hero, .services-section, .contact-section, .flow-demo, .features-section, .methods-cta, .why-section, .methods-section, .fit-card.is-dark, footer';
  let queued = false;

  function update() {
    queued = false;
    const y = header.offsetHeight / 2;
    const under = document.elementsFromPoint(innerWidth / 2, y).find(el => !header.contains(el));
    // Слайдер «5 шагов» лежит на белом фоне: тёмные в нём только сами карточки-окна
    const light = under?.closest('.flow-slider') && !under.closest('.flow-slide-media');
    header.classList.toggle('is-dark', Boolean(under?.closest(DARK)) && !light);
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
})();
