/*
  Первый экран с видео: короткое превью без звука, по кругу. Вне экрана и под перекрывшим его блоком — пауза.
*/
(() => {
  const hero = document.querySelector('.hero');
  const video = hero?.querySelector('.hero-video');
  if (!video) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let onScreen = true;
  let buried = false;   // первый экран закреплён и целиком перекрыт следующим блоком

  const playSilently = () => { if (!reduceMotion && onScreen && !buried) video.play().catch(() => {}); };

  if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }

  // Затемнение при прокрутке: чем больше следующая секция наезжает на закреплённый первый экран,
  // тем он темнее (--hero-dim от 0 до DIM_MAX, слой .hero::after); максимум — уже на DIM_AT перекрытия
  const DIM_MAX = 0.85;
  const DIM_AT = 0.5;
  const cover = hero.nextElementSibling;
  let dimQueued = false;
  function updateDim() {
    dimQueued = false;
    if (!cover) { hero.style.setProperty('--hero-dim', 0); return; }
    const h = hero.offsetHeight;
    const covered = hero.getBoundingClientRect().bottom - cover.getBoundingClientRect().top;
    hero.style.setProperty('--hero-dim', (Math.min(Math.max(covered / (h * DIM_AT), 0), 1) * DIM_MAX).toFixed(3));
    // Под перекрывшим его блоком видео не видно — пауза, чтобы не перерисовывать стекло на первом экране каждый кадр
    const nowBuried = covered >= h - 1;
    if (nowBuried !== buried) {
      buried = nowBuried;
      if (buried) video.pause(); else playSilently();
    }
  }
  const scheduleDim = () => { if (!dimQueued) { dimQueued = true; requestAnimationFrame(updateDim); } };
  addEventListener('scroll', scheduleDim, { passive: true });
  addEventListener('resize', scheduleDim);
  updateDim();

  // Фоновое видео не крутится, когда первого экрана не видно (или он перекрыт — см. updateDim)
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (!onScreen) video.pause();
    else playSilently();
  }, { threshold: 0.05 }).observe(hero);
})();
