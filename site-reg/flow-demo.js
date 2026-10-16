/*
  Блок «От заявки до выхода на работу — 5 шагов».
  Шаг 1 — экран формы заявки: бриф распознаётся, 20 полей заполняются за FORM_FILL мс,
  страница прокручивается следом, курсор нажимает «Отправить заявку», открывается окно «Готово».
  Шаги 2–5 — рабочий чат: сообщения появляются по очереди; у сообщения с data-status сначала статус, потом текст.
  Вкладки переключаются сами. Тексты и значения полей — в index.html (секция #flow).
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
  const panel = root.querySelector('.flow-window');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Чат
  const chat = root.querySelector('.flow-body');
  const scenarios = [...root.querySelectorAll('.flow-scenario')];
  const messagesBox = root.querySelector('.flow-messages');
  const channelLabels = [...root.querySelectorAll('[data-flow-channel]')];
  const channelItems = [...root.querySelectorAll('.flow-channels [data-channel]')];

  // Экран формы
  const app = root.querySelector('[data-flow-app]');
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

  root.querySelectorAll('.flow-msg[data-status]').forEach(msg => {
    const status = document.createElement('p');
    status.className = 'flow-status';
    status.textContent = msg.dataset.status;
    msg.querySelector('.flow-text').before(status);
  });

  let current = 0;
  let timers = [];
  let visible = false;
  let started = false;
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

  /* ——— Вкладки ——— */
  function select(index, focus = false) {
    current = index;
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.remove('is-playing', 'is-done');
      if (on && focus) tab.focus();
    });
    const bar = tabs[index].parentElement;
    bar.scrollTo({ left: tabs[index].offsetLeft - (bar.clientWidth - tabs[index].offsetWidth) / 2, behavior: 'smooth' });
    panel.setAttribute('aria-labelledby', tabs[index].id);

    const isForm = index === 0;
    app.hidden = !isForm;
    chat.hidden = isForm;

    if (!isForm) {
      const scenario = scenarios.find(s => s.dataset.tab === String(index));
      scenarios.forEach(s => { s.hidden = s !== scenario; });
      channelLabels.forEach(el => { el.textContent = scenario.dataset.channel; });
      channelItems.forEach(li => li.classList.toggle('is-active', li.dataset.channel === scenario.dataset.channel));
    }
  }

  function finishTab(tab) { tab.classList.remove('is-playing'); tab.classList.add('is-done'); }
  function next(index, delay) { later(() => { if (visible) play((index + 1) % tabs.length); }, delay); }

  /* ——— Шаг 1: форма ——— */
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

  function playForm(tab, index) {
    resetForm();

    if (reduceMotion) {
      fields.forEach(f => { setField(f, f.dataset.value); f.classList.add('is-filled'); });
      brief.classList.add('is-done');
      briefStatus.textContent = 'Распознано · 20 полей заполнено';
      showSent();
      finishTab(tab);
      return;
    }

    // Маршрут прокрутки: от начала заполнения до кнопки «Отправить заявку», без остановок
    const slotMs = FORM_FILL / fields.length;
    const fillStart = BRIEF + 200;
    let last = 0;
    path = [{ t: fillStart, top: 0 }];
    fields.forEach((field, i) => {
      last = Math.max(last, scrollFor(field, 0.45));
      path.push({ t: fillStart + (i + 0.5) * slotMs, top: last });
    });
    path.push({ t: fillStart + FORM_FILL + 400, top: Math.max(last, scrollFor(submit, 0.6)) });
    pathStart = performance.now();
    rafId = requestAnimationFrame(scrollLoop);

    // 1. Бриф распознаётся
    later(() => { brief.classList.add('is-done'); briefStatus.textContent = 'Распознано · заполняем форму'; }, BRIEF);

    // 2. Поля заполняются по очереди, страница едет следом
    const slot = FORM_FILL / fields.length;
    const start = BRIEF + 200;
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
    later(() => { path = null; cursor.classList.remove('is-visible'); showSent(); finishTab(tab); }, click + 350);
    next(index, click + 350 + SENT_HOLD);
  }

  /* ——— Шаги 2–5: чат ——— */
  function playChat(tab, index) {
    const msgs = [...scenarios.find(s => s.dataset.tab === String(index)).querySelectorAll('.flow-msg')];
    if (reduceMotion) {
      msgs.forEach(m => { m.classList.add('is-shown'); m.classList.remove('is-thinking'); });
      finishTab(tab);
      return;
    }
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
    later(() => finishTab(tab), t - BETWEEN + 300);
    next(index, t + HOLD);
  }

  function play(index) {
    stop();
    select(index);
    const tab = tabs[index];
    if (!reduceMotion) tab.classList.add('is-playing');
    if (index === 0) playForm(tab, index);
    else playChat(tab, index);
  }

  /* ——— Управление ——— */
  tabs.forEach((tab, i) => tab.addEventListener('click', () => play(i)));
  root.querySelector('.flow-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const n = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(n, true);
    play(n);
  });

  // Показ только когда блок на экране: уходит из вида — пауза, возвращается — шаг заново
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { play(current); started = true; }
    else if (started) { stop(); }
  }, { threshold: 0.3 }).observe(root);

  select(0);
})();
