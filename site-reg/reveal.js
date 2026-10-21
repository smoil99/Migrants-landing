/*
  Появление блоков при прокрутке: блок проявляется и поднимается (только opacity и translate — без перерисовки), когда попадает в окно;
  соседние блоки, попавшие в окно вместе, появляются с небольшой задержкой друг за другом.

  Разметку размечать не нужно — блоки находятся автоматически во всех секциях <main> и в подвале,
  поэтому новые секции получают анимацию сами. Блок — это первый (самый внешний) элемент, который:
    • заголовок, абзац, список, картинка, кнопка, карточка (<article>, класс со словами card/item/tile) и т. п.;
    • или «плашка» — элемент со своим фоном (цвет или картинка): появляется целиком вместе с содержимым.
  Не анимируются: первый экран, окно-демо «5 шагов» и всё внутри уже найденного блока.
  Чтобы исключить элемент вручную — атрибут data-no-reveal.
*/
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const STAGGER = 80;          // задержка между соседними блоками, мс
  const MAX_STAGGER = 6;       // больше этого числа блоков задержка не растёт
  const SKIP = '.hero, .flow-window, dialog, [data-no-reveal]';
  const UNIT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'DL', 'FIGURE', 'IMG', 'PICTURE', 'VIDEO',
    'TABLE', 'FORM', 'BLOCKQUOTE', 'BUTTON', 'ARTICLE', 'ASIDE', 'SMALL', 'LI']);
  const UNIT_CLASS = /(^|[-_\s])(card|item|tile|button)([-_\s]|$)/;

  const main = document.querySelector('main');
  if (!main) return;

  // Корневые блоки страницы: секции <main> (первый экран раскрывается до соседей) и подвал
  const roots = [...main.children].flatMap(el => (el.matches('.hero-stack') ? [...el.children] : [el]));
  const footer = main.parentElement.querySelector(':scope > footer');
  if (footer) roots.push(footer);

  const hasSurface = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'contents') return false;
    const bg = cs.backgroundColor;
    const transparent = bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg);
    return !transparent || cs.backgroundImage !== 'none';
  };
  const isUnit = el => UNIT_TAGS.has(el.tagName) || UNIT_CLASS.test(el.getAttribute('class') || '') || hasSurface(el);

  const units = [];
  function collect(el) {
    for (const child of el.children) {
      if (child.matches(SKIP) || child.tagName === 'SCRIPT' || child.tagName === 'svg') continue;
      if (isUnit(child)) units.push(child);
      else collect(child);
    }
  }
  roots.filter(root => !root.matches(SKIP)).forEach(collect);

  // Внутри горизонтальных лент (overflow-x: auto) — только проявление, без сдвига: сдвинутая вниз карточка
  // вылезала за ленту, лента на время анимации становилась прокручиваемой по вертикали и «забирала» колёсико
  const inScroller = el => {
    for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  units.forEach(el => el.classList.add('rv', ...(inScroller(el) ? ['rv-fade'] : [])));

  const io = new IntersectionObserver(entries => {
    const shown = entries.filter(e => e.isIntersecting).map(e => e.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    shown.forEach((el, i) => {
      io.unobserve(el);
      el.style.setProperty('--rv-delay', `${Math.min(i, MAX_STAGGER) * STAGGER}ms`);
      el.classList.add('rv-in');
      // После появления — убрать служебные классы, чтобы не мешать собственным анимациям элемента
      el.addEventListener('animationend', function done(event) {
        if (event.target !== el || event.animationName !== 'rv-in') return;
        el.removeEventListener('animationend', done);
        el.classList.remove('rv', 'rv-in', 'rv-fade');
        el.style.removeProperty('--rv-delay');
      });
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  units.forEach(el => io.observe(el));
})();
