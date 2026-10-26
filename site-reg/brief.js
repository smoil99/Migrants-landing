/*
  Расширенная заявка на привлечение сотрудников (brief.html) — сценарий Б из требований docs#3 (Project Draft).
  • Условные поля: data-show-if="имя=значение" (показать при выбранном значении) или "имя!=значение"
    (показать, если выбрано что-то другое).
  • Режимы «Продиктовать» / «Загрузить файл»: файл прикрепляется к заявке, распознавание в прототипе не подключено.
  • Проверки: обязательные поля (required), телефон, email (обязателен), ИНН — 10 или 12 цифр, если указан,
    возраст «от» не больше «до».
  • Уход со страницы с заполненными полями — предупреждение (текст из требований).
  • Отправка: BRIEF_ENDPOINT (POST, JSON); пусто — заявка никуда не уходит, показывается окно «Готово».
*/

// Адрес обработчика расширенных заявок. Пусто — демо-режим
const BRIEF_ENDPOINT = '';
const LEAVE_TEXT = 'Введенные данные не сохранятся. Вы уверены, что хотите покинуть страницу?';

(() => {
  const form = document.querySelector('#brief-form');
  if (!form) return;
  const dialog = document.querySelector('#brief-sent');
  let dirty = false;

  /* ——— Условные поля ——— */
  const conditional = [...document.querySelectorAll('[data-show-if]')];
  function valueOf(name) {
    const checked = form.querySelector(`[name="${name}"]:checked`);
    if (checked) return checked.value;
    const el = form.elements[name];
    return el && el.tagName === 'SELECT' ? el.value : '';
  }
  function applyConditions() {
    conditional.forEach(el => {
      const [, name, op, value] = el.dataset.showIf.match(/^(\w+)(!?=)(.*)$/);
      const current = valueOf(name);
      const show = op === '=' ? current === value : current !== '' && current !== value;
      el.hidden = !show;
      el.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = !show; });
    });
  }

  /* ——— Режим заполнения ——— */
  const modeTabs = [...form.querySelectorAll('[data-mode]')];
  modeTabs.forEach(tab => tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    form.querySelectorAll('[data-mode-panel]').forEach(panel => { panel.hidden = panel.dataset.modePanel !== tab.dataset.mode; });
  }));
  const voice = form.querySelector('[data-voice]');
  voice.addEventListener('click', () => {
    voice.querySelector('span').textContent = 'В прототипе диктовка не подключена — заполните поля вручную';
  });
  const fileInput = form.querySelector('input[type=file]');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    form.querySelector('[data-file-title]').textContent = file ? file.name : 'Нажмите, чтобы прикрепить файл';
    form.querySelector('[data-file-sub]').textContent = file
      ? `${Math.max(1, Math.round(file.size / 1024))} КБ · файл будет приложен к заявке`
      : 'Загрузите документ или изображение с текстом брифа';
  });

  /* ——— Ошибки ——— */
  function setError(field, message) {
    field.querySelector('.bf-error')?.remove();
    field.classList.toggle('is-invalid', Boolean(message));
    field.querySelectorAll('input, select, textarea').forEach(el => el.setAttribute('aria-invalid', String(Boolean(message))));
    if (!message) return;
    const el = document.createElement('small');
    el.className = 'bf-error';
    el.textContent = message;
    field.append(el);
  }
  const fieldOf = el => el.closest('.bf-field') || el.closest('.consent');

  function validate() {
    const errors = new Map();
    const add = (el, text) => { const f = fieldOf(el); if (f && !errors.has(f)) errors.set(f, text); };

    form.querySelectorAll('input[required]:not([type=radio]):not(:disabled), select[required]:not(:disabled), textarea[required]:not(:disabled)')
      .forEach(el => {
        if (el.type === 'checkbox' ? !el.checked : !el.value.trim()) add(el, el.type === 'checkbox' ? 'Подтвердите согласие' : 'Заполните поле');
      });
    form.querySelectorAll('.bf-choice[data-required]').forEach(group => {
      if (group.hidden) return;
      if (!group.querySelector('input:checked')) errors.set(group, 'Выберите вариант');
    });

    const v = name => (form.elements[name]?.value || '').trim();
    if (v('phone') && !/^[78]\d{10}$/.test(v('phone').replace(/\D/g, ''))) add(form.elements.phone, 'Проверьте номер телефона: +7 и 10 цифр');
    if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) add(form.elements.email, 'Проверьте адрес электронной почты');
    if (v('inn') && !/^(\d{10}|\d{12})$/.test(v('inn'))) add(form.elements.inn, 'ИНН — 10 или 12 цифр');
    if (v('count') && !(Number.isInteger(Number(v('count'))) && Number(v('count')) > 0)) add(form.elements.count, 'Укажите целое число больше нуля');
    if (v('salary') && !/^\d[\d\s]*$/.test(v('salary'))) add(form.elements.salary, 'Укажите сумму цифрами');
    if (v('age_from') && v('age_to') && Number(v('age_from')) > Number(v('age_to'))) add(form.elements.age_to, 'Возраст «до» не может быть меньше «от»');
    return errors;
  }

  /* ——— Отправка ——— */
  form.addEventListener('submit', async event => {
    event.preventDefault();
    form.querySelectorAll('.bf-field, .consent').forEach(f => setError(f, ''));
    const errors = validate();
    errors.forEach((text, field) => setError(field, text));
    form.querySelector('[data-error-summary]').hidden = errors.size === 0;
    if (errors.size) {
      const first = [...errors.keys()][0];
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.querySelector('input, select, textarea')?.focus({ preventScroll: true });
      return;
    }

    if (BRIEF_ENDPOINT) {
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        const data = Object.fromEntries([...new FormData(form)].filter(([, value]) => typeof value === 'string'));
        const response = await fetch(BRIEF_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: data, source: 'LANDING_BRIEF' }),
        });
        if (!response.ok) throw new Error(response.statusText);
      } catch {
        alert('Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.');
        return;
      } finally {
        submit.disabled = false;
      }
    }
    dirty = false;
    dialog.showModal();
    dialog.querySelector('h2').focus();
  });

  dialog.querySelector('[data-action="brief-again"]').addEventListener('click', () => {
    form.reset();
    fileInput.dispatchEvent(new Event('change'));
    form.querySelectorAll('.bf-field, .consent').forEach(f => setError(f, ''));
    form.querySelector('[data-error-summary]').hidden = true;
    applyConditions();
    dirty = false;
    dialog.close();
    scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ——— Предупреждение при уходе с заполненной формы ——— */
  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('change', event => {
    dirty = true;
    applyConditions();
    const field = fieldOf(event.target);
    if (field?.classList.contains('is-invalid')) setError(field, '');
  });
  // Закрытие вкладки или переход по адресу: браузер показывает своё стандартное предупреждение
  addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = LEAVE_TEXT;
  });
  // Переход по ссылкам на странице — предупреждение с текстом из требований
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!dirty || !link || link.target === '_blank' || link.closest('dialog')) return;
    if (!confirm(LEAVE_TEXT)) event.preventDefault();
    else dirty = false;
  });

  applyConditions();
})();
