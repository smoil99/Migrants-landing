/*
  Интерактив статичной копии лендинга.
  Тексты вкладок, шагов, отраслей и FAQ лежат в index.html — правьте их там.
  Здесь только поведение и тексты, которые зависят от разбора запроса.
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ——— Разбор запроса (правила из оригинала) ——— */

const INDUSTRIES = {
  construction: 'Строительство',
  production: 'Производство',
  agriculture: 'Сельское хозяйство',
  logistics: 'Склад и логистика',
  services: 'ЖКХ и эксплуатация',
};

const PROFESSIONS = [
  [/сварщик|сварочн/iu, 'Сварщики', 'production'],
  [/комплектовщик|пикер/iu, 'Комплектовщики', 'logistics'],
  [/каменщик/iu, 'Каменщики', 'construction'],
  [/бетонщик/iu, 'Бетонщики', 'construction'],
  [/арматурщик/iu, 'Арматурщики', 'construction'],
  [/штукатур/iu, 'Штукатуры', 'construction'],
  [/маляр/iu, 'Маляры', 'construction'],
  [/монтажник/iu, 'Монтажники', 'construction'],
  [/оператор.{0,12}(станк|чпу)|токар|фрезеровщик/iu, 'Операторы станков', 'production'],
  [/слесар/iu, 'Слесари', 'production'],
  [/сборщик.{0,8}урожа/iu, 'Сборщики урожая', 'agriculture'],
  [/тепли/iu, 'Тепличные рабочие', 'agriculture'],
  [/агротехник/iu, 'Операторы агротехники', 'agriculture'],
  [/сборщик/iu, 'Сборщики', 'production'],
  [/упаковщик/iu, 'Упаковщики', 'production'],
  [/водител.{0,6}погрузчик/iu, 'Водители погрузчиков', 'logistics'],
  [/грузчик/iu, 'Грузчики', 'logistics'],
  [/уборщик|клининг/iu, 'Уборщики', 'services'],
  [/дворник/iu, 'Дворники', 'services'],
  [/техническ.{0,5}персонал/iu, 'Технический персонал', 'services'],
];

const CITIES = {
  Туле: 'Тула', Москве: 'Москва', Казани: 'Казань', Самаре: 'Самара', Екатеринбурге: 'Екатеринбург',
  Новосибирске: 'Новосибирск', Краснодаре: 'Краснодар', 'Санкт-Петербурге': 'Санкт-Петербург',
  'Ростове-на-Дону': 'Ростов-на-Дону', 'Нижнем Новгороде': 'Нижний Новгород', 'Московской области': 'Московская область',
};

// Убирает из текста почту, телефоны и имена
function stripContacts(text) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}/giu, '[email удалён]')
    .replace(/(?:\+?[78][\s(-]*)?(?:\d[\s()-]*){10,11}/g, '[телефон удалён]')
    .replace(/(?:меня зовут|контактное лицо|фио)\s*[:—-]?\s*[а-яё]+(?:\s+[а-яё]+){0,2}/giu, '[имя удалено]');
}

function detectIndustry(text) {
  const hit = PROFESSIONS.find(([re]) => re.test(text));
  if (hit) return hit[2];
  if (/производств|завод/iu.test(text)) return 'production';
  if (/строи/iu.test(text)) return 'construction';
  if (/склад|логистик/iu.test(text)) return 'logistics';
  if (/сельск|агро/iu.test(text)) return 'agriculture';
  if (/жкх|эксплуатац/iu.test(text)) return 'services';
  return 'general';
}

function parseQuery(raw) {
  const text = stripContacts(raw).trim();
  const hit = PROFESSIONS.find(([re]) => re.test(text));
  const industry = hit?.[2] ?? detectIndustry(text);
  const profession = hit?.[1] ?? INDUSTRIES[industry] ?? '';

  const countMatch = text.match(/(?:^|\s)(\d{1,7})(?:\s+(?:тыс(?:яч[аиу]?)?\.?))?(?=\s+(?:свар|комплект|камен|бетон|армат|штукат|маляр|монтаж|оператор|слесар|сборщик|теплич|упаков|водител|грузчик|уборщик|дворник|рабоч|специалист|человек|сотрудник|повар|инженер|токар|фрезер|агроном|медсест|электрик|пекар))/iu);
  let count = countMatch ? String(Number(countMatch[1]) * (/тыс/iu.test(countMatch[0]) ? 1000 : 1)) : '';
  if (count === '0') count = '';

  const regionMatch = text.match(/(?:^|\s)(?:в|во|для|под)\s+([А-ЯЁ][а-яё-]+(?:\s+(?:области|крае|область|край|Новгороде|Новгород))?)/u);
  let region = regionMatch ? CITIES[regionMatch[1]] ?? regionMatch[1] : '';
  if (!region) {
    for (const [form, name] of Object.entries(CITIES)) {
      if (text.toLowerCase().includes(form.toLowerCase())) { region = name; break; }
    }
  }

  const deadline = text.match(/(?:к|до|с)\s+(?:\d{1,2}\s+)?(?:январ\S*|феврал\S*|март\S*|апрел\S*|ма[йяюе]|июн\S*|июл\S*|август\S*|сентябр\S*|октябр\S*|ноябр\S*|декабр\S*)(?:\s+20\d{2})?|через\s+(?:\d+|две|три|неделю|месяц)\s*(?:дн\S*|недел\S*|месяц\S*)?|срочно|завтра|как можно скорее|в течение\s+\d+\s+\S+/iu)?.[0] ?? '';

  return { profession, count, region, deadline, industry, kind: profession ? 'recommendation' : count || region ? 'fallback' : 'consultation' };
}

/* ——— Состояние ——— */

const state = {
  query: '',
  intent: { profession: '', count: '', region: '', deadline: '', industry: 'general', kind: 'consultation' },
  mode: 'unknown',
};

const modeTitle = id => $(`#mode-${id}`)?.textContent.trim() ?? '';

/* ——— Вариант первого экрана ——— */

function setVariant(variant, updateUrl = true) {
  const app = $('.app');
  app.classList.toggle('variant-editorial', variant === 'editorial');
  app.classList.toggle('variant-focus', variant === 'focus');
  $$('[data-variant]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.variant === variant)));
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('variant', variant);
    history.replaceState(null, '', url);
  }
}

/* ——— Мобильное меню ——— */

function setMenu(open) {
  $('.nav').classList.toggle('mobile-open', open);
  $('.menu-button').setAttribute('aria-expanded', String(open));
}

/* ——— Вкладки, шаги, отрасли ——— */

function selectMode(id, focus = false) {
  state.mode = id;
  $$('.mode-tabs [data-mode]').forEach(tab => {
    const on = tab.dataset.mode === id;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  });
  $$('.mode-panel').forEach(p => { p.hidden = p.dataset.mode !== id; });
  renderResult();
}

function selectStep(n) {
  $$('.process-list [data-step]').forEach(b => {
    const on = b.dataset.step === String(n);
    b.classList.toggle('active', on);
    b.setAttribute('aria-expanded', String(on));
  });
  $$('.step-content').forEach(p => { p.hidden = p.id !== `step-content-${n}`; });
}

function selectIndustry(id) {
  $$('.industry-list [data-industry]').forEach(b => {
    const on = b.dataset.industry === id;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $$('.industry-content').forEach(p => { p.hidden = p.dataset.industry !== id; });
}

/* ——— FAQ ——— */

const faqItems = () => $$('.faq-item');

function toggleFaq(index, forceOpen = false) {
  faqItems().forEach((item, i) => {
    const open = i === index && (forceOpen || !item.classList.contains('expanded'));
    item.classList.toggle('expanded', open);
    const btn = $('h3 button', item);
    btn.setAttribute('aria-expanded', String(open));
    $(`#faq-answer-${i}`).inert = !open;               // закрытый ответ не доступен с клавиатуры; раскрытие — в CSS
  });
}

// Нажатый вопрос остаётся на месте, пока сворачивается открытый выше ответ, — аккордеон всегда раскрывается вниз
function keepInPlace(el, ms = 450) {
  const top = el.getBoundingClientRect().top;
  const start = performance.now();
  const step = now => {
    const shift = el.getBoundingClientRect().top - top;
    if (Math.abs(shift) > 0.5) window.scrollTo({ top: scrollY + shift, behavior: 'instant' });
    if (now - start < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function filterFaq(topic) {
  $$('.faq-filters [data-topic]').forEach(b => {
    const on = b.dataset.topic === topic;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  faqItems().forEach(item => { item.hidden = topic !== 'Все вопросы' && item.dataset.topic !== topic; });
  toggleFaq(-1);
}

/* ——— Запрос и блок результата ——— */

const textarea = $('#intent-query');
const submitButton = $('.intent-form button[type=submit]');

function onQueryInput() {
  submitButton.disabled = textarea.value.trim().length < 2;
  $('.input-warning').hidden = stripContacts(textarea.value) === textarea.value;
}

function focusIntent() {
  ($('.intent-box') || $('#top')).scrollIntoView({ behavior: 'smooth', block: 'center' });
  textarea.focus({ preventScroll: true });
}

function scrollToResult() {
  setTimeout(() => {
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#result-title').focus({ preventScroll: true });
  }, 80);
}

function submitQuery(text = textarea.value) {
  if (text.trim().length < 2) return;
  textarea.value = text;
  onQueryInput();
  state.query = text;
  state.intent = parseQuery(text);
  $$('#result [data-field]').forEach(input => { input.value = state.intent[input.dataset.field]; });
  $('#result').hidden = false;
  renderResult();
  scrollToResult();
}

function resultTitle({ kind, industry }) {
  if (kind === 'fallback') return 'Подберём маршрут под вашу задачу';
  if (kind === 'consultation') return 'Разберёмся вместе';
  const who = industry === 'production' ? 'вашего производства' : industry === 'logistics' ? 'вашего склада' : 'вашей команды';
  return `Решение для ${who}`;
}

function renderResult() {
  const result = $('#result');
  if (!result || result.hidden) return;
  const { intent, mode } = state;
  const fallback = intent.kind === 'fallback';
  const urgent = /срочно|завтра|скорее|через\s+(?:[1-9]|1\d|2\d)\s*д|недел/iu.test(intent.deadline);
  const set = (key, text) => { $(`[data-result="${key}"]`, result).textContent = text; };

  $('#result-title').textContent = resultTitle(intent);
  set('solution-title', fallback ? 'Начнём с уточнения профессии и условий' : 'Организуем релокацию и легализацию');
  set('solution-text', fallback
    ? 'Для этой профессии пока нет отдельного сценария. Заявку всё равно можно отправить: специалист уточнит возможность подбора и состав решения.'
    : 'Согласуем состав работ, обязанности сторон и подходящий способ привлечения. Вы участвуете в выборе и утверждении кандидатов.');
  set('mode-title', mode === 'unknown' ? 'Сначала проверим возможные способы привлечения' : modeTitle(mode));
  set('mode-text', mode === 'unknown'
    ? 'Начать можно с проверки квотируемого и неквотируемого маршрутов. ВКС и ТОР рассмотрим, если для них есть основания. Окончательную схему подтвердит специалист.'
    : 'Вы выбрали этот вариант для обсуждения. Применимость и условия подтвердит специалист.');
  set('timing-text', urgent
    ? 'Вы указали срочный срок. Не можем подтвердить такую дату без проверки этапов оформления. Обсудим реалистичный график.'
    : 'Срок зависит от способа привлечения, количества специалистов и готовности исходных данных.');

  // Связанные вопросы из FAQ
  const box = $('[data-result="faq"]', result);
  $$('button', box).forEach(b => b.remove());
  const related = intent.industry === 'logistics' ? [1, 3, 5] : [2, 3, 9];
  related.forEach(i => {
    const q = $(`#faq-button-${i} span`)?.textContent.trim();
    if (!q) return;
    const btn = document.createElement('button');
    btn.innerHTML = `${q} <span><svg class="arrow-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></span>`;
    btn.addEventListener('click', () => {
      filterFaq('Все вопросы');
      toggleFaq(i, true);
      $('#faq').scrollIntoView({ behavior: 'smooth' });
    });
    box.append(btn);
  });
}

function editIntentField(field, value) {
  state.intent[field] = value;
  if (field === 'profession') {
    state.intent.industry = detectIndustry(value);
    state.intent.kind = value ? (state.intent.industry === 'general' ? 'fallback' : 'recommendation') : 'consultation';
  }
  renderResult();
}

/* ——— Подключение обработчиков ——— */

document.addEventListener('click', event => {
  const el = event.target.closest('button, a');
  if (!el) return;
  const { action, query, variant, mode, step, industry, topic } = el.dataset;

  if (action === 'focus-intent') return focusIntent();
  if (query) return submitQuery(query);
  if (variant) return setVariant(variant);
  if (mode && el.closest('.mode-tabs')) return selectMode(mode);
  if (step) return selectStep(step);
  if (industry) return selectIndustry(industry);
  if (topic && el.closest('.faq-filters')) return filterFaq(topic);
  if (el.matches('.faq-item h3 button')) { keepInPlace(el); return toggleFaq(faqItems().indexOf(el.closest('.faq-item'))); }
  if (el.matches('.menu-button')) return setMenu(!$('.nav').classList.contains('mobile-open'));
  if (el.closest('.nav')) return setMenu(false);
});

// Вкладки способов: стрелки, Home, End
$('.mode-tabs')?.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = $$('.mode-tabs [data-mode]');
  const current = tabs.findIndex(t => t.dataset.mode === state.mode);
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  selectMode(tabs[next].dataset.mode, true);
});

// Блок запроса есть не на всех версиях страницы
if (textarea) {
  $('.intent-form').addEventListener('submit', event => { event.preventDefault(); submitQuery(); });
  textarea.addEventListener('input', onQueryInput);
  textarea.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuery(); }
  });
}

$$('#result [data-field]').forEach(input => {
  input.addEventListener('input', () => editIntentField(input.dataset.field, input.value));
});


// Начальное состояние
if ($('[data-variant]')) setVariant(new URLSearchParams(location.search).get('variant') === 'focus' ? 'focus' : 'editorial', false);
if (textarea) onQueryInput();

/* ——— Слайдеры-ленты «Способы привлечения» и «Примеры задач»: стрелки листают по одной карточке ——— */
function initSlider(box, prev, next) {
  if (!box || !prev || !next) return;
  const cards = [...box.children];
  const left = i => cards[i].offsetLeft - cards[0].offsetLeft;
  const current = () => {
    let best = 0;
    cards.forEach((_, i) => { if (Math.abs(left(i) - box.scrollLeft) < Math.abs(left(best) - box.scrollLeft)) best = i; });
    return best;
  };
  const update = () => {
    prev.disabled = box.scrollLeft <= 2;
    next.disabled = box.scrollLeft >= box.scrollWidth - box.clientWidth - 2;
  };
  const go = step => {
    const i = Math.max(0, Math.min(cards.length - 1, current() + step));
    box.scrollTo({ left: left(i), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  box.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
initSlider($('[data-m-slides]'), $('[data-m-prev]'), $('[data-m-next]'));
initSlider($('[data-ex-slides]'), $('[data-ex-prev]'), $('[data-ex-next]'));

/* ——— «Что важно учитывать» в карточках способов привлечения: аккордеон, раскрытие — в CSS (как у FAQ) ——— */
$$('.method-toggle').forEach(btn => btn.addEventListener('click', () => {
  const note = btn.closest('.method-note');
  const open = !note.classList.contains('is-open');
  note.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  $(`#${btn.getAttribute('aria-controls')}`).inert = !open;
}));

/* ——— Согласие cookie (как в Codex-версии): баннер до принятия, решение хранится 180 дней ——— */
(() => {
  const banner = $('#cookie-banner');
  if (!banner) return;
  const KEY = 'landing-consent', DURATION = 15552000000;
  let consent = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    consent = saved?.expires > Date.now() ? saved.allowed : null;
  } catch { /* при недоступном хранилище баннер просто показывается снова */ }
  banner.hidden = consent !== null;
  $('#accept-cookie').addEventListener('click', () => {
    try { localStorage.setItem(KEY, JSON.stringify({ allowed: true, expires: Date.now() + DURATION })); } catch { /* только текущий сеанс */ }
    banner.hidden = true;
  });
})();
