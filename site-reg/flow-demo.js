/*
  Блок «Пять этапов» (#flow), по мотивам галереи CleanShot.
  Десктоп (> 1024px): слева вкладки-этапы с полосой прогресса, справа одно окно-демо; этапы идут по кругу.
  ≤ 1024px: слайдер из 5 карточек; в каждой своя копия окна, показывающая только свой этап.
    Активная карточка проигрывает этап по кругу, остальные показывают его итоговый кадр.
  Шаг 1 — экран формы заявки: бриф распознаётся, 20 полей заполняются за FORM_FILL мс,
  страница прокручивается следом, курсор нажимает «Отправить заявку», открывается окно «Готово».
  Шаги 2–5 — рабочий чат: сообщения появляются по очереди; у сообщения с data-status сначала статус, потом текст.
  Тексты и значения полей — в index.html (секция #flow), подписи карточек слайдера берутся из вкладок.
*/
(() => {
  const root = document.querySelector('[data-flow]');
  if (!root) return;

  // Тайминги, мс
  const FORM_FILL = 5000;       // заполнение 20 полей формы
  const BRIEF = 900;            // «Распознаём бриф…» перед заполнением
  const CURSOR_MOVE = 800;      // курсор едет к кнопке
  const SENT_HOLD = 3800;       // сколько показывается окно «Готово» перед следующим шагом
  const FIRST_DELAY = 500;      // чат: перед первым сообщением
  const BETWEEN = 1100;         // чат: между сообщениями
  const THINKING = 1500;        // чат: статус «думает»
  const HOLD = 3200;            // чат: пауза после последнего сообщения

  const tabs = [...root.querySelectorAll('[data-flow-tab]')];
  const stage = root.querySelector('.flow-window');
  const slidesBox = root.querySelector('[data-flow-slides]');
  const prevBtn = root.querySelector('[data-flow-prev]');
  const nextBtn = root.querySelector('[data-flow-next]');
  const sliderMode = matchMedia('(width <= 1024px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Статус «думает» у сообщений — до копирования окна, чтобы он попал во все копии
  root.querySelectorAll('.flow-msg[data-status]').forEach(msg => {
    const status = document.createElement('p');
    status.className = 'flow-status';
    status.textContent = msg.dataset.status;
    msg.querySelector('.flow-text').before(status);
  });

  /* ——— Окно-демо: умеет показать любой этап. play() возвращает длительность показа, мс ——— */
  function createDemo(win) {
    // Чат
    const chat = win.querySelector('.flow-body');
    const scenarios = [...win.querySelectorAll('.flow-scenario')];
    const messagesBox = win.querySelector('.flow-messages');
    const channelLabels = [...win.querySelectorAll('[data-flow-channel]')];
    const channelItems = [...win.querySelectorAll('.flow-channels [data-channel]')];

    // Экран формы
    const app = win.querySelector('[data-flow-app]');
    const scroller = app.querySelector('.fa-scroll');
    const fields = [...app.querySelectorAll('.fa-field')];
    const brief = app.querySelector('.fa-brief');
    const briefStatus = app.querySelector('[data-fa-brief]');
    const submit = app.querySelector('.fa-submit');
    const cursor = app.querySelector('.fa-cursor');
    const title = app.querySelector('[data-fa-title]');
    const statuses = [...app.querySelectorAll('.fa-status')];
    const dim = app.querySelector('.fa-dim');
    const sent = app.querySelector('.fa-sent');

    let timers = [];
    let path = null;                   // маршрут непрерывной прокрутки формы: [{t, top}]
    let pathStart = 0;
    let rafId = 0;

    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(rafId);
      path = null;
    };

    function show(index) {
      const isForm = index === 0;
      app.hidden = !isForm;
      chat.hidden = isForm;
      if (isForm) return;
      const scenario = scenarios.find(s => s.dataset.tab === String(index));
      scenarios.forEach(s => { s.hidden = s !== scenario; });
      channelLabels.forEach(el => { el.textContent = scenario.dataset.channel; });
      channelItems.forEach(li => li.classList.toggle('is-active', li.dataset.channel === scenario.dataset.channel));
    }

    /* Шаг 1: форма */
    function resetForm() {
      scroller.scrollTop = 0;
      brief.classList.remove('is-done');
      briefStatus.textContent = 'Распознаём…';
      fields.forEach(f => {
        f.classList.remove('is-filled', 'is-active');
        const v = f.querySelector('.fa-value');
        if (v) v.textContent = '';
        f.querySelectorAll('.fa-chips span').forEach(c => c.classList.remove('is-selected'));
      });
      submit.classList.remove('is-pressed');
      cursor.classList.remove('is-visible', 'is-click');
      cursor.style.transition = 'none';
      cursor.style.transform = `translate(${app.clientWidth * 0.62}px, ${app.clientHeight * 0.55}px)`;
      dim.hidden = true;
      sent.hidden = true;
      title.textContent = 'Создать заявку';
      statuses.forEach(s => { s.hidden = true; });
    }

    function setField(field, value) {
      if (field.dataset.type === 'chips') {
        field.querySelectorAll('.fa-chips span').forEach(c => c.classList.toggle('is-selected', c.textContent === value));
      } else {
        field.querySelector('.fa-value').textContent = value;
      }
    }

    function showSent() {
      dim.hidden = false;
      sent.hidden = false;
      title.textContent = 'Заявка';
      statuses.forEach(s => { s.hidden = false; });
    }

    function formFinal() {
      resetForm();
      fields.forEach(f => { setField(f, f.dataset.value); f.classList.add('is-filled'); });
      brief.classList.add('is-done');
      briefStatus.textContent = 'Распознано · 20 полей заполнено';
      showSent();
    }

    // Блок может быть уменьшен через CSS zoom: экранные координаты переводим в CSS-пиксели блока
    const zoom = () => app.getBoundingClientRect().width / app.offsetWidth || 1;

    // Позиция прокрутки, при которой элемент стоит на ratio высоты экрана
    function scrollFor(el, ratio) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / zoom() + scroller.scrollTop;
      return Math.max(0, Math.min(top - scroller.clientHeight * ratio, scroller.scrollHeight - scroller.clientHeight));
    }

    // Непрерывная прокрутка: позиция плавно интерполируется между ключевыми точками (по одной на поле),
    // без остановок и рывков
    function scrollLoop() {
      if (path) {
        const t = performance.now() - pathStart;
        let top = path[path.length - 1].top;
        if (t <= path[0].t) top = path[0].top;
        else {
          for (let i = 1; i < path.length; i++) {
            if (t <= path[i].t) {
              const a = path[i - 1], b = path[i];
              top = a.top + (b.top - a.top) * ((t - a.t) / (b.t - a.t));
              break;
            }
          }
        }
        scroller.scrollTop = top;
      }
      rafId = requestAnimationFrame(scrollLoop);
    }

    function playForm() {
      resetForm();

      // Маршрут прокрутки: от начала заполнения до кнопки «Отправить заявку», без остановок
      const slot = FORM_FILL / fields.length;
      const start = BRIEF + 200;
      let last = 0;
      path = [{ t: start, top: 0 }];
      fields.forEach((field, i) => {
        last = Math.max(last, scrollFor(field, 0.45));
        path.push({ t: start + (i + 0.5) * slot, top: last });
      });
      path.push({ t: start + FORM_FILL + 400, top: Math.max(last, scrollFor(submit, 0.6)) });
      pathStart = performance.now();
      rafId = requestAnimationFrame(scrollLoop);

      // 1. Бриф распознаётся
      later(() => { brief.classList.add('is-done'); briefStatus.textContent = 'Распознано · заполняем форму'; }, BRIEF);

      // 2. Поля заполняются по очереди, страница едет следом
      fields.forEach((field, i) => {
        const value = field.dataset.value;
        const begin = start + i * slot;
        later(() => field.classList.add('is-active'), begin);
        if (field.dataset.type === 'chips') {
          later(() => setField(field, value), begin + slot * 0.45);
        } else {
          const step = (slot * 0.75) / value.length;
          const out = field.querySelector('.fa-value');
          [...value].forEach((_, k) => later(() => { out.textContent = value.slice(0, k + 1); }, begin + (k + 1) * step));
        }
        later(() => { field.classList.remove('is-active'); field.classList.add('is-filled'); }, begin + slot);
      });

      // 3. Докрутить до кнопки, курсор едет к ней и нажимает
      const filled = start + FORM_FILL;
      later(() => { briefStatus.textContent = 'Распознано · 20 полей заполнено'; }, filled);
      later(() => {
        const a = app.getBoundingClientRect();
        const b = submit.getBoundingClientRect();
        const z = zoom();
        cursor.style.transition = '';
        cursor.classList.add('is-visible');
        cursor.style.transform = `translate(${(b.left - a.left + b.width * 0.55) / z}px, ${(b.top - a.top + b.height * 0.35) / z}px)`;
      }, filled + 500);
      const click = filled + 500 + CURSOR_MOVE + 150;
      later(() => { cursor.classList.add('is-click'); submit.classList.add('is-pressed'); }, click);
      later(() => { cursor.classList.remove('is-click'); submit.classList.remove('is-pressed'); }, click + 180);

      // 4. Экран «Отправлена»
      later(() => { path = null; cursor.classList.remove('is-visible'); showSent(); }, click + 350);
      return click + 350 + SENT_HOLD;
    }

    /* Шаги 2–5: чат */
    const messagesOf = index => [...scenarios.find(s => s.dataset.tab === String(index)).querySelectorAll('.flow-msg')];

    function chatFinal(index) {
      messagesOf(index).forEach(m => { m.classList.add('is-shown'); m.classList.remove('is-thinking'); });
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function playChat(index) {
      const msgs = messagesOf(index);
      msgs.forEach(m => m.classList.remove('is-shown', 'is-thinking'));
      messagesBox.scrollTop = 0;
      const scrollDown = () => { messagesBox.scrollTop = messagesBox.scrollHeight; };

      let t = FIRST_DELAY;
      msgs.forEach(msg => {
        if (msg.dataset.status) {
          later(() => { msg.classList.add('is-shown', 'is-thinking'); scrollDown(); }, t);
          t += THINKING;
          later(() => { msg.classList.remove('is-thinking'); scrollDown(); }, t);
        } else {
          later(() => { msg.classList.add('is-shown'); scrollDown(); }, t);
        }
        t += BETWEEN;
      });
      return t + HOLD;
    }

    // Итоговый кадр этапа — без анимации
    function final(index) {
      stop();
      show(index);
      if (index === 0) formFinal();
      else chatFinal(index);
    }

    // Проиграть этап; по окончании вызвать onEnd. При «уменьшении движения» — сразу итоговый кадр, без onEnd
    function play(index, onEnd) {
      if (reduceMotion) { final(index); return 0; }
      stop();
      show(index);
      const ms = index === 0 ? playForm() : playChat(index);
      later(onEnd, ms);
      return ms;
    }

    return { play, final, stop, show };
  }

  /* ——— Карточки слайдера: копия окна + подпись из вкладки ——— */
  const slides = tabs.map((tab, i) => {
    const slide = document.createElement('article');
    slide.className = 'flow-slide';
    slide.setAttribute('aria-roledescription', 'слайд');
    slide.setAttribute('aria-label', `${i + 1} из ${tabs.length}`);

    const media = document.createElement('div');
    media.className = 'flow-slide-media';
    const win = stage.cloneNode(true);
    ['id', 'role', 'aria-labelledby'].forEach(a => win.removeAttribute(a));
    win.setAttribute('aria-hidden', 'true');
    win.querySelectorAll('[aria-live]').forEach(el => el.removeAttribute('aria-live'));
    media.append(win);

    const text = document.createElement('div');
    text.className = 'flow-slide-text';
    const num = document.createElement('span');
    num.className = 'flow-slide-num';
    num.textContent = `${tab.querySelector('.flow-tab-num').textContent} / 0${tabs.length}`;
    const h = document.createElement('h3');
    h.textContent = tab.querySelector('.flow-tab-text b').textContent;
    const p = document.createElement('p');
    p.textContent = tab.querySelector('.flow-tab-text > span').textContent;
    text.append(num, h, p);

    slide.append(media, text);
    slidesBox.append(slide);
    return { slide, demo: createDemo(win) };
  });

  const main = createDemo(stage);
  let current = 0;      // активная вкладка (десктоп)
  let active = 0;       // активная карточка (слайдер)
  let visible = false;

  /* ——— Десктоп: вкладки ——— */
  function selectTab(index, focus = false) {
    current = index;
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.remove('is-playing');
      if (on && focus) tab.focus();
    });
    stage.setAttribute('aria-labelledby', tabs[index].id);
  }

  function playTab(index) {
    selectTab(index);
    const tab = tabs[index];
    const ms = main.play(index, () => playTab((index + 1) % tabs.length));
    if (!ms) return;
    tab.style.setProperty('--flow-dur', `${ms}ms`);
    void tab.offsetWidth;               // перезапуск анимации полосы прогресса
    tab.classList.add('is-playing');
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => { if (visible) playTab(i); else selectTab(i); }));
  root.querySelector('.flow-tabs').addEventListener('keydown', event => {
    const keys = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const n = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : (current + keys[event.key] + tabs.length) % tabs.length;
    selectTab(n, true);
    playTab(n);
  });

  /* ——— Слайдер ——— */
  const slideLeft = i => slides[i].slide.offsetLeft - slides[0].slide.offsetLeft;

  function playSlide(index) {
    active = index;
    slides.forEach(({ slide, demo }, i) => {
      slide.classList.toggle('is-active', i === index);
      if (i === index) demo.play(i, () => playSlide(i));    // активная карточка — по кругу
      else demo.final(i);
    });
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === slides.length - 1;
  }

  function nearestSlide() {
    const x = slidesBox.scrollLeft;
    let best = 0;
    slides.forEach((_, i) => { if (Math.abs(slideLeft(i) - x) < Math.abs(slideLeft(best) - x)) best = i; });
    // Прокрутка упёрлась в конец — активна последняя карточка
    if (x >= slidesBox.scrollWidth - slidesBox.clientWidth - 2) best = slides.length - 1;
    return best;
  }

  let scrollTimer = 0;
  slidesBox.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = nearestSlide();
      if (i !== active && visible && sliderMode.matches) playSlide(i);
    }, 120);
  }, { passive: true });

  const goTo = i => slidesBox.scrollTo({ left: slideLeft(i), behavior: reduceMotion ? 'auto' : 'smooth' });
  prevBtn.addEventListener('click', () => goTo(Math.max(0, active - 1)));
  nextBtn.addEventListener('click', () => goTo(Math.min(slides.length - 1, active + 1)));

  /* ——— Запуск: только когда блок на экране и только в текущем режиме ——— */
  function stopAll() {
    main.stop();
    slides.forEach(s => s.demo.stop());
  }

  function start() {
    stopAll();
    if (sliderMode.matches) playSlide(active);
    else playTab(current);
  }

  sliderMode.addEventListener('change', () => { if (visible) start(); else stopAll(); });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else stopAll();
  }, { threshold: 0.3 }).observe(root);

  selectTab(0);
  main.show(0);
  slides.forEach(({ demo }, i) => demo.final(i));
  prevBtn.disabled = true;
})();
