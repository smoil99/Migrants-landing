/*
  Блок «Пять этапов» (#flow), по мотивам галереи CleanShot.
  Десктоп (> 1024px): слева вкладки-этапы с полосой прогресса, справа одно окно-демо; этапы идут по кругу.
  ≤ 1024px: слайдер из 5 карточек; в каждой своя копия окна, показывающая только свой этап.
    Активная карточка проигрывает этап по кругу, остальные показывают его итоговый кадр.
  Шаг 1 — экран формы заявки: режим «Загрузить файл» уже выбран, курсор приносит файл из-за края окна
  и перетаскивает его в зону загрузки; пока файл распознаётся, поля — скелетон, затем 10 полей заполняются
  за FORM_FILL мс, страница прокручивается следом, курсор нажимает «Отправить заявку», открывается окно «Готово».
  Шаги 2–5 — экраны личного кабинета (по макетам Figma): 2 — список кандидатов заполняется, курсор открывает
  кандидата; 3 — курсор листает вкладки кандидата и нажимает «Одобрить»; 4 — курсор запускает и завершает услуги;
  5 — пункты чек-листа отмечаются, статус «Вышел на работу».
  Тексты — в index.html (секция #flow), подписи карточек слайдера берутся из вкладок.
*/
(() => {
  const root = document.querySelector('[data-flow]');
  if (!root) return;

  // Тайминги, мс
  const FORM_FILL = 4000;       // прокрутка формы до кнопки с постоянной скоростью; за это время заполняются 10 полей
  const REVEAL_GAP = 150;       // минимальный промежуток между появлением значений в соседних полях
  const SKELETON = 1400;        // все поля — скелетон, прежде чем начнут появляться значения
  const CURSOR_MOVE = 800;      // одно перемещение курсора (совпадает с transition у .fa-cursor)
  const SENT_HOLD = 1500;       // сколько показывается окно «Готово» перед следующим шагом
  const INTRO_GAP = 70;         // все шаги: между появлением элементов экрана в начале показа
  const ROW_GAP = 320;          // шаг 2: между появлением строк кандидатов
  const CHECK_GAP = 280;        // шаг 5: между отметками пунктов чек-листа
  const SCREEN_HOLD = 3000;     // шаги 2–5: пауза на итоговом кадре перед следующим шагом

  const tabs = [...root.querySelectorAll('[data-flow-tab]')];
  const stage = root.querySelector('.flow-window');
  const slidesBox = root.querySelector('[data-flow-slides]');
  const prevBtn = root.querySelector('[data-flow-prev]');
  const nextBtn = root.querySelector('[data-flow-next]');
  const sliderMode = matchMedia('(width <= 1024px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ——— Окно-демо: умеет показать любой этап. play() возвращает длительность показа, мс ——— */
  function createDemo(win) {
    // Экраны шагов 2–5
    const screens = [...win.querySelectorAll('[data-flow-screen]')];

    // Экран формы
    const app = win.querySelector('[data-flow-app]');
    const scroller = app.querySelector('.fa-scroll');
    const fields = [...app.querySelectorAll('.fa-field')];
    const brief = app.querySelector('.fa-brief');
    const drop = app.querySelector('[data-fa-drop]');
    const upload = app.querySelector('[data-fa-upload]');
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

    // Элементы экрана появляются по очереди снизу вверх (как строки в списке кандидатов).
    // Возвращает момент, когда появился последний элемент
    function intro(scope, selector, at = 0) {
      const items = [...scope.querySelectorAll(selector)].filter(el => el.offsetParent !== null);
      items.forEach(el => el.classList.add('fs-io', 'fs-pre'));
      items.forEach((el, i) => later(() => el.classList.remove('fs-pre'), at + 60 + i * INTRO_GAP));
      const end = at + 60 + items.length * INTRO_GAP;
      later(() => items.forEach(el => el.classList.remove('fs-io')), end + 450);
      return end;
    }
    const clearIntro = scope => scope.querySelectorAll('.fs-pre, .fs-io').forEach(el => el.classList.remove('fs-pre', 'fs-io'));

    function show(index) {
      app.hidden = index !== 0;
      screens.forEach((screen, i) => { screen.hidden = i + 1 !== index; });
    }

    /* Шаг 1: форма */
    function resetForm() {
      scroller.scrollTop = 0;
      clearIntro(app);
      app.classList.remove('is-parsing');
      upload.classList.add('is-active');                 // режим «Загрузить файл» выбран сразу
      drop.hidden = false;
      drop.classList.remove('is-over', 'has-file');
      brief.classList.remove('is-done');
      briefStatus.textContent = 'Распознаём…';
      fields.forEach(f => {
        f.classList.remove('is-filled', 'is-active', 'is-revealed');
        const v = f.querySelector('.fa-value');
        if (v) v.textContent = '';
        f.querySelectorAll('.fa-chips span').forEach(c => c.classList.remove('is-selected'));
      });
      submit.classList.remove('is-pressed');
      cursor.classList.remove('is-visible', 'is-click', 'has-file');
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
      upload.classList.add('is-active');
      drop.hidden = false;
      drop.classList.add('has-file');
      brief.classList.add('is-done');
      briefStatus.textContent = 'Распознано · 10 полей заполнено';
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

    // Курсор — в точку элемента (rx, ry — доли его ширины и высоты), в координатах окна-демо
    function cursorTo(el, rx, ry) {
      const a = app.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const z = zoom();
      cursor.style.transform = `translate(${(b.left - a.left + b.width * rx) / z}px, ${(b.top - a.top + b.height * ry) / z}px)`;
    }
    function click(at, onPress) {
      later(() => { cursor.classList.add('is-click'); onPress?.(); }, at);
      later(() => cursor.classList.remove('is-click'), at + 180);
    }

    function playForm() {
      resetForm();

      // 0. Элементы формы появляются по очереди
      const o = intro(app, '.fa-crumbs, .fa-title, .fa-sub, .fa-card, .fa-modes, .fa-drop, .fa-section, .fa-submit');

      // 1. Курсор с файлом заходит из-за правого края окна и тащит файл в зону загрузки
      later(() => {
        const a = app.getBoundingClientRect();
        const b = drop.getBoundingClientRect();
        cursor.style.transform = `translate(${app.offsetWidth + 40}px, ${(b.top - a.top) / zoom() + 20}px)`;
        cursor.classList.add('is-visible', 'has-file');
      }, o + 100);
      const back = o + 300;
      later(() => { cursor.style.transition = ''; cursorTo(drop, 0.45, 0.5); }, back);
      later(() => drop.classList.add('is-over'), back + CURSOR_MOVE * 0.6);

      // 2. Файл брошен в зону: файл распознаётся, поля — скелетон
      const dropAt = back + CURSOR_MOVE + 150;
      click(dropAt, () => {
        cursor.classList.remove('has-file');
        drop.classList.remove('is-over');
        drop.classList.add('has-file');
        app.style.setProperty('--fa-parse', `${SKELETON + FORM_FILL}ms`);
        app.classList.add('is-parsing');
      });
      later(() => cursor.classList.remove('is-visible'), dropAt + 400);

      // 3. Страница прокручивается с постоянной скоростью от начала формы до кнопки «Отправить заявку»;
      //    значение появляется в поле, когда прокрутка доводит поле до середины окна
      const start = dropAt + SKELETON;
      later(() => {
        const end = scrollFor(submit, 0.6);
        path = [{ t: 0, top: 0 }, { t: FORM_FILL, top: end }];
        pathStart = performance.now();
        rafId = requestAnimationFrame(scrollLoop);
        briefStatus.textContent = 'Распознаём · заполняем форму';

        let prev = -REVEAL_GAP;
        fields.forEach(field => {
          const at = Math.max(prev + REVEAL_GAP, end ? FORM_FILL * scrollFor(field, 0.45) / end : 0);
          prev = at;
          later(() => {
            setField(field, field.dataset.value);
            field.classList.add('is-filled', 'is-active', 'is-revealed');
          }, at);
          later(() => field.classList.remove('is-active'), at + 450);
        });
      }, start);

      // 4. Всё распознано — курсор нажимает «Отправить заявку»
      const filled = start + FORM_FILL;
      later(() => {
        app.classList.remove('is-parsing');
        brief.classList.add('is-done');
        briefStatus.textContent = 'Распознано · 10 полей заполнено';
      }, filled);
      later(() => { cursor.classList.add('is-visible'); cursorTo(submit, 0.55, 0.35); }, filled + 500);
      const send = filled + 500 + CURSOR_MOVE + 150;
      click(send, () => submit.classList.add('is-pressed'));
      later(() => submit.classList.remove('is-pressed'), send + 180);

      // 5. Экран «Отправлена»
      later(() => { path = null; cursor.classList.remove('is-visible'); showSent(); }, send + 350);
      return send + 350 + SENT_HOLD;
    }

    /* ——— Шаги 2–5: экраны личного кабинета ——— */

    // Исходные статусы, кнопки и метки запоминаются, чтобы сбрасывать экран перед каждым показом
    win.querySelectorAll('[data-fs-status], [data-fs-svc-status], [data-fs-svc-btn]').forEach(el => {
      el.dataset.init = `${el.className}|${el.textContent}`;
    });
    win.querySelectorAll('.fs-state').forEach(el => { el.dataset.html = el.innerHTML; });
    const setChip = (el, cls, text) => { el.className = `fs-chip ${cls} is-flash`; el.textContent = text; };

    function resetScreen(screen) {
      screen.querySelector('.fa-scroll').scrollTop = 0;
      screen.querySelectorAll('[data-init]').forEach(el => { [el.className, el.textContent] = el.dataset.init.split('|'); });
      screen.querySelectorAll('.fs-state').forEach(el => { el.innerHTML = el.dataset.html; });
      screen.querySelectorAll('.is-in, .is-pressed, .is-done').forEach(el => el.classList.remove('is-in', 'is-pressed', 'is-done'));
      screen.querySelectorAll('.fs-reveal, .is-filling').forEach(el => el.classList.remove('fs-reveal', 'is-filling'));
      screen.querySelectorAll('[data-fs-added]').forEach(el => el.remove());
      clearIntro(screen);
      screen.querySelectorAll('[data-fs-tabs] [data-fs-tab]').forEach((tab, i) => tab.classList.toggle('is-active', i === 0));
      screen.querySelectorAll('[data-fs-panel]').forEach((panel, i) => { panel.hidden = i > 0; });
      screen.querySelectorAll('.fs-actions').forEach(el => { el.hidden = false; });
      screen.querySelector('.fa-cursor').classList.remove('is-visible', 'is-click');
      const toast = screen.querySelector('[data-fs-toast]');
      if (toast) toast.hidden = true;
    }

    // Курсор экрана: перемещение к элементу (rx, ry — доли его ширины и высоты) и клик
    function pointer(screen) {
      const cur = screen.querySelector('.fa-cursor');
      const k = () => screen.getBoundingClientRect().width / screen.offsetWidth || 1;
      cur.classList.remove('is-visible', 'is-click');
      cur.style.transition = 'none';
      cur.style.transform = `translate(${screen.offsetWidth * 0.7}px, ${screen.offsetHeight * 0.85}px)`;
      return {
        to(el, rx = 0.5, ry = 0.5) {
          const a = screen.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          cur.style.transition = '';
          cur.classList.add('is-visible');
          cur.style.transform = `translate(${(b.left - a.left + b.width * rx) / k()}px, ${(b.top - a.top + b.height * ry) / k()}px)`;
        },
        click(at, fn) {
          later(() => { cur.classList.add('is-click'); fn(); }, at);
          later(() => cur.classList.remove('is-click'), at + 180);
        },
        hide() { cur.classList.remove('is-visible'); },
      };
    }

    // Плавно докрутить экран, если элемент ниже видимой области; scrollHome — обратно наверх
    function reveal(screen, el) {
      const sc = screen.querySelector('.fa-scroll');
      const k = screen.getBoundingClientRect().width / screen.offsetWidth || 1;
      const over = (el.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom) / k + 24;
      if (over > 0) sc.scrollTo({ top: sc.scrollTop + over, behavior: 'smooth' });
    }
    const scrollHome = screen => screen.querySelector('.fa-scroll').scrollTo({ top: 0, behavior: 'smooth' });
    // Элементы контейнера появляются по очереди
    function stagger(box) {
      box.classList.add('fs-reveal');
      [...box.children].forEach((child, i) => later(() => child.classList.add('is-in'), 80 + 120 * i));
    }

    const INTRO = {
      head: '.fa-crumbs, .fa-title, .fs-person, .fs-meta, .fs-tabs',
      review: '.fs-card:not([hidden]), .fs-card:not([hidden]) h4, .fs-card:not([hidden]) .fs-dl > div, .fs-history, .fs-history li',
      services: '.fs-heading, .fs-group, .fs-svc',
      checklist: '.fs-check',
    };

    // Шаг 2. Список кандидатов заполняется, счётчик растёт, курсор открывает первого кандидата
    function candidates(screen, animate) {
      const p = pointer(screen);
      const list = screen.querySelector('[data-fs-rows]');
      const rows = [...list.children];
      const count = screen.querySelector('[data-fs-count]');
      const total = Number(count.dataset.fsCount);
      count.textContent = total;
      if (!animate) return 0;

      list.classList.add('is-filling');
      count.textContent = '0';
      let t = intro(screen, `${INTRO.head}, .fs-filters`) + 100;
      rows.forEach((row, i) => {
        later(() => {
          row.classList.add('is-in');
          count.textContent = Math.round(total * (i + 1) / rows.length);
          reveal(screen, row);
        }, t);
        t += ROW_GAP;
      });
      t += 700;
      later(() => scrollHome(screen), t);
      t += 600;
      later(() => {
        const go = rows[0].querySelector('.fs-go');
        if (go.offsetWidth) p.to(go); else p.to(rows[0], 0.85, 0.4);
      }, t);
      t += CURSOR_MOVE + 150;
      p.click(t, () => rows[0].classList.add('is-pressed'));

      // Клик по строке открывает карточку кандидата — экран шага 3 в исходном состоянии
      t += 450;
      later(() => {
        const next = screens[1];
        resetScreen(next);
        screen.hidden = true;
        next.hidden = false;
        intro(next, `${INTRO.head}, ${INTRO.review}`);
      }, t);
      return t + 1800;
    }

    // Шаг 3. Курсор листает вкладки кандидата (данные → документы → фото и видео) и нажимает «Одобрить»
    function review(screen, animate, continued) {
      const p = pointer(screen);
      const tabsEls = [...screen.querySelectorAll('[data-fs-tab]')];
      const panels = [...screen.querySelectorAll('[data-fs-panel]')];
      const status = screen.querySelector('[data-fs-status]');
      const approve = screen.querySelector('[data-fs-approve]');
      const history = screen.querySelector('[data-fs-history]');
      const actions = screen.querySelector('.fs-actions');
      const open = key => {
        tabsEls.forEach(tab => tab.classList.toggle('is-active', tab.dataset.fsTab === key));
        panels.forEach(panel => { panel.hidden = panel.dataset.fsPanel !== key; });
      };
      const approved = () => {
        setChip(status, 'is-ok', 'Одобрен');
        const li = document.createElement('li');
        li.dataset.fsAdded = '';
        li.innerHTML = '<span class="fs-chip is-ok">Одобрен</span><time>01.10.2026, 10:15</time>';
        history.prepend(li);
      };
      open('data');
      if (!animate) { approved(); actions.hidden = true; status.classList.remove('is-flash'); return 0; }

      const tab = key => tabsEls.find(el => el.dataset.fsTab === key);
      // Карточка уже открыта кликом на шаге 2 — повторно не проявляем
      let t = (continued ? 0 : intro(screen, `${INTRO.head}, ${INTRO.review}`)) + 300;
      later(() => p.to(tab('docs')), t);
      t += CURSOR_MOVE + 150;
      p.click(t, () => { open('docs'); stagger(screen.querySelector('.fs-files')); });
      t += 1700;
      later(() => p.to(tab('media')), t);
      t += CURSOR_MOVE + 150;
      p.click(t, () => { open('media'); stagger(screen.querySelector('.fs-media')); });
      t += 1500;
      later(() => p.to(approve), t);
      t += CURSOR_MOVE + 150;
      p.click(t, () => { approve.classList.add('is-pressed'); approved(); });
      // После одобрения кнопки «Одобрить» и «Отклонить» скрываются
      later(() => { approve.classList.remove('is-pressed'); actions.classList.add('fs-io', 'fs-pre'); p.hide(); }, t + 250);
      later(() => { actions.hidden = true; actions.classList.remove('fs-io', 'fs-pre'); }, t + 600);
      return t + SCREEN_HOLD;
    }

    // Шаг 4. Курсор запускает услуги («Начать» → «В работе») и завершает их («Завершить» → «Завершена»)
    function services(screen, animate) {
      const p = pointer(screen);
      const rows = [...screen.querySelectorAll('.fs-svc')];
      const counter = screen.querySelector('[data-fs-svc-count]');
      const setCount = n => { counter.textContent = `(${n} из ${rows.length})`; };
      const start = row => {
        setChip(row.querySelector('[data-fs-svc-status]'), 'is-work', 'В работе');
        const btn = row.querySelector('[data-fs-svc-btn]');
        btn.textContent = 'Завершить';
        btn.classList.add('is-primary');
      };
      const finish = (row, n) => {
        setChip(row.querySelector('[data-fs-svc-status]'), 'is-ok', 'Завершена');
        const btn = row.querySelector('[data-fs-svc-btn]');
        btn.classList.remove('is-primary');
        btn.classList.add('is-disabled');
        setCount(n);
      };
      setCount(0);
      if (!animate) {
        rows.forEach((row, i) => { start(row); finish(row, i + 1); });
        screen.querySelectorAll('.is-flash').forEach(el => el.classList.remove('is-flash'));
        return 0;
      }

      let t = intro(screen, `${INTRO.head}, ${INTRO.services}`) + 300;
      rows.forEach((row, i) => {
        const btn = row.querySelector('[data-fs-svc-btn]');
        later(() => reveal(screen, row), t);
        t += 350;
        later(() => p.to(btn), t);
        t += CURSOR_MOVE + 150;
        p.click(t, () => { btn.classList.add('is-pressed'); start(row); });
        later(() => btn.classList.remove('is-pressed'), t + 180);
        t += 900;
        p.click(t, () => { btn.classList.add('is-pressed'); finish(row, i + 1); });
        later(() => btn.classList.remove('is-pressed'), t + 180);
        t += 400;
      });
      later(() => p.hide(), t);
      return t + SCREEN_HOLD;
    }

    // Шаг 5. Пункты чек-листа отмечаются по очереди, в конце статус «Вышел на работу»
    function checklist(screen, animate) {
      const items = [...screen.querySelectorAll('.fs-check')];
      const status = screen.querySelector('[data-fs-status]');
      const toast = screen.querySelector('[data-fs-toast]');
      const done = item => {
        item.classList.add('is-done');
        const state = item.querySelector('.fs-state');
        state.innerHTML = item.querySelector('.fs-box').innerHTML + state.dataset.fsDone;
      };
      const finished = () => setChip(status, 'is-ok', 'Вышел на работу');
      pointer(screen);
      if (!animate) { items.forEach(done); finished(); status.classList.remove('is-flash'); return 0; }

      let t = intro(screen, `${INTRO.head}, ${INTRO.checklist}`) + 300;
      items.forEach(item => {
        later(() => { reveal(screen, item); done(item); }, t);
        t += CHECK_GAP;
      });
      t += 300;
      later(() => { finished(); toast.hidden = false; }, t);
      return t + SCREEN_HOLD;
    }

    const STEPS = [null, candidates, review, services, checklist];

    // Итоговый кадр этапа — без анимации
    function final(index) {
      stop();
      show(index);
      if (index === 0) formFinal();
      else { resetScreen(screens[index - 1]); STEPS[index](screens[index - 1], false); }
    }

    // Проиграть этап; по окончании вызвать onEnd. При «уменьшении движения» — сразу итоговый кадр, без onEnd
    // continued — шаг идёт сразу за предыдущим (на десктопе): шаг 3 тогда не проявляет карточку повторно
    function play(index, onEnd, continued = false) {
      if (reduceMotion) { final(index); return 0; }
      stop();
      show(index);
      let ms;
      if (index === 0) ms = playForm();
      else { resetScreen(screens[index - 1]); ms = STEPS[index](screens[index - 1], true, continued); }
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

  function playTab(index, continued = false) {
    selectTab(index);
    const tab = tabs[index];
    const ms = main.play(index, () => playTab((index + 1) % tabs.length, true), continued);
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
