/*
  Счётчики: элемент с data-count="25" (и необязательным data-suffix="+") при появлении на экране
  отсчитывает от 0 до числа за DURATION мс, один раз. При отключённой анимации сразу показывает итог.
*/
(() => {
  const DURATION = 1000;
  const items = document.querySelectorAll('[data-count]');
  if (!items.length) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const final = el => `${el.dataset.count}${el.dataset.suffix || ''}`;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function run(el) {
    const target = Number(el.dataset.count);
    const start = performance.now();
    const tick = now => {
      const t = Math.min((now - start) / DURATION, 1);
      el.textContent = t < 1 ? String(Math.round(target * easeOut(t))) : final(el);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (reduceMotion) { items.forEach(el => { el.textContent = final(el); }); return; }

  items.forEach(el => { el.textContent = '0'; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      run(entry.target);
    });
  }, { threshold: 0.6 });
  items.forEach(el => io.observe(el));
})();
