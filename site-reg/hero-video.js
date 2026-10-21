/*
  Первый экран с видео.
  Фон: видео без звука, по кругу, затемнено. Вне экрана ставится на паузу.
  «Смотреть видео»: текст скрывается, затемнение снимается, ролик с начала, со звуком и элементами управления.
  Выход: кнопка «Закрыть видео», Esc или конец ролика.
*/
(() => {
  const hero = document.querySelector('.hero');
  const video = hero?.querySelector('.hero-video');
  if (!video) return;

  const stack = hero.closest('.hero-stack');
  const watchBtn = hero.querySelector('[data-action="watch-video"]');
  const closeBtn = hero.querySelector('[data-action="close-video"]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let watching = false;
  let onScreen = true;

  const playSilently = () => { if (!reduceMotion && onScreen && !watching) video.play().catch(() => {}); };

  if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }

  function watch() {
    watching = true;
    hero.classList.add('is-watching');
    stack?.classList.add('is-watching');
    document.documentElement.classList.add('is-watching-video');   // прячет шапку
    closeBtn.hidden = false;
    video.loop = false;
    video.muted = false;
    video.controls = true;
    video.currentTime = 0;
    video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
    hero.scrollIntoView({ behavior: 'smooth', block: 'center' });
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!watching) return;
    watching = false;
    hero.classList.remove('is-watching');
    stack?.classList.remove('is-watching');
    document.documentElement.classList.remove('is-watching-video');
    closeBtn.hidden = true;
    video.controls = false;
    video.muted = true;
    video.loop = true;
    playSilently();
    watchBtn.focus({ preventScroll: true });
  }

  watchBtn.addEventListener('click', watch);
  closeBtn.addEventListener('click', close);
  video.addEventListener('ended', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && watching) close(); });

  // Затемнение при прокрутке: чем больше следующая секция наезжает на закреплённый первый экран,
  // тем он темнее (--hero-dim от 0 до DIM_MAX, слой .hero::after); максимум — уже на DIM_AT перекрытия
  const DIM_MAX = 0.85;
  const DIM_AT = 0.5;
  const cover = hero.nextElementSibling;
  let dimQueued = false;
  function updateDim() {
    dimQueued = false;
    if (!cover || watching) { hero.style.setProperty('--hero-dim', 0); return; }
    const h = hero.offsetHeight;
    const covered = hero.getBoundingClientRect().bottom - cover.getBoundingClientRect().top;
    hero.style.setProperty('--hero-dim', (Math.min(Math.max(covered / (h * DIM_AT), 0), 1) * DIM_MAX).toFixed(3));
  }
  const scheduleDim = () => { if (!dimQueued) { dimQueued = true; requestAnimationFrame(updateDim); } };
  addEventListener('scroll', scheduleDim, { passive: true });
  addEventListener('resize', scheduleDim);
  updateDim();

  // Фоновое видео не крутится, когда первого экрана не видно
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (!onScreen && !watching) video.pause();
    else playSilently();
  }, { threshold: 0.05 }).observe(hero);
})();
