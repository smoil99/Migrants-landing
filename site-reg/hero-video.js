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

  // Фоновое видео не крутится, когда первого экрана не видно
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (!onScreen && !watching) video.pause();
    else playSilently();
  }, { threshold: 0.05 }).observe(hero);
})();
