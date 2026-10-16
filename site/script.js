/*
  Интерактив статичной копии лендинга.
  Тексты вкладок, шагов, отраслей и FAQ лежат в index.html — правьте их там.
  Здесь только поведение и тексты, которые зависят от разбора запроса.
*/

// Адрес обработчика заявок (POST, JSON). Пусто — заявка никуда не отправляется, показывается демо-экран успеха.
const LEAD_ENDPOINT = '';

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
    $('.faq-plus', item).textContent = open ? '−' : '+';
    $(`#faq-answer-${i}`).hidden = !open;
  });
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
  if (state.intent.kind === 'consultation') openLead();
  else scrollToResult();
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
    btn.innerHTML = `${q} <span>↗</span>`;
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

/* ——— Окно заявки ——— */

const dialog = $('#lead-dialog');
const leadForm = $('#lead-form');
const FIELDS = ['contact_name', 'contact_phone', 'specialists_count', 'work_region', 'company_name', 'contact_email'];
const field = key => $(`#lead-${key}`);

function validateLead() {
  const v = Object.fromEntries(FIELDS.map(k => [k, field(k).value]));
  const errors = {};
  if (v.contact_name.trim().length < 2 || v.contact_name.length > 100) errors.contact_name = 'Укажите имя и фамилию';
  if (!/^[78]\d{10}$/.test(v.contact_phone.replace(/\D/g, ''))) errors.contact_phone = 'Проверьте номер телефона: +7 и 10 цифр';
  if (!/^\d+$/.test(v.specialists_count) || !Number.isSafeInteger(Number(v.specialists_count)) || Number(v.specialists_count) <= 0) errors.specialists_count = 'Укажите целое число больше нуля';
  if (!v.work_region.trim() || v.work_region.length > 200) errors.work_region = 'Укажите регион работы';
  if (!v.company_name.trim() || v.company_name.length > 200) errors.company_name = 'Укажите название компании';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact_email) || v.contact_email.length > 254) errors.contact_email = 'Проверьте адрес электронной почты';
  if (!$('#lead-consent').checked) errors.consent = 'Подтвердите согласие';
  return { values: v, errors };
}

function setFieldError(key, message) {
  const input = key === 'consent' ? $('#lead-consent') : field(key);
  const id = `${key}-error`;
  $(`#${id}`)?.remove();
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (!message) { input.removeAttribute('aria-describedby'); return; }
  const el = document.createElement(key === 'consent' ? 'p' : 'small');
  el.className = 'error';
  el.id = id;
  el.textContent = message;
  input.setAttribute('aria-describedby', id);
  if (key === 'consent') $('.consent', leadForm).after(el);
  else input.after(el);
}

function showLeadView(view) {
  $$('[data-lead-view]', dialog).forEach(v => { v.hidden = v.dataset.leadView !== view; });
}

function openLead() {
  const { intent, query, mode } = state;
  if (intent.count) field('specialists_count').value = intent.count;
  if (intent.region) field('work_region').value = intent.region;

  const summary = $('[data-lead-view="form"] .context-summary', dialog);
  const hasContext = Boolean(query || intent.profession);
  summary.hidden = !hasContext;
  if (hasContext) {
    $('[data-context="title"]', dialog).textContent = intent.profession || 'Поможем разобраться';
    $('[data-context="details"]', dialog).textContent =
      [intent.count && `${intent.count} специалистов`, intent.region, intent.deadline].filter(Boolean).join(' · ') || stripContacts(query);
    $('[data-context="mode"]', dialog).textContent = `Способ привлечения: ${modeTitle(mode)}`;
  }
  showLeadView('form');
  setMenu(false);
  dialog.showModal();
}

function closeLead() {
  dialog.close();
}

function resetLead() {
  leadForm.reset();
  [...FIELDS, 'consent'].forEach(k => setFieldError(k, ''));
  field('specialists_count').value = state.intent.count;
  field('work_region').value = state.intent.region;
  showLeadView('form');
}

async function submitLead(event) {
  event.preventDefault();
  const { values, errors } = validateLead();
  [...FIELDS, 'consent'].forEach(k => setFieldError(k, errors[k]));
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    (firstError === 'consent' ? $('#lead-consent') : field(firstError)).focus();
    return;
  }

  const submit = $('button[type=submit]', leadForm);
  if (LEAD_ENDPOINT) {
    submit.disabled = true;
    try {
      const response = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: values, query: stripContacts(state.query).slice(0, 600), intent: state.intent, mode: state.mode }),
      });
      if (!response.ok) throw new Error(response.statusText);
    } catch {
      alert('Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.');
      return;
    } finally {
      submit.disabled = false;
    }
  }

  $('[data-success="title"]', dialog).textContent = state.intent.profession || 'Потребность требует уточнения';
  $('[data-success="details"]', dialog).textContent = `${values.specialists_count} специалистов · ${values.work_region}`;
  showLeadView('success');
  $('#success-title').focus();
}

/* ——— Подключение обработчиков ——— */

document.addEventListener('click', event => {
  const el = event.target.closest('button, a');
  if (!el) return;
  const { action, query, variant, mode, step, industry, topic } = el.dataset;

  if (action === 'lead') return openLead();
  if (action === 'close-lead') return closeLead();
  if (action === 'reset-lead') return resetLead();
  if (action === 'focus-intent') return focusIntent();
  if (action === 'demo-contacts') {
    field('contact_name').value = 'Тестовый Клиент';
    field('contact_phone').value = '+7 000 000-00-00';
    field('contact_email').value = 'demo@example.com';
    field('company_name').value = 'ООО Тестовый проект';
    return;
  }
  if (query) return submitQuery(query);
  if (variant) return setVariant(variant);
  if (mode && el.closest('.mode-tabs')) return selectMode(mode);
  if (step) return selectStep(step);
  if (industry) return selectIndustry(industry);
  if (topic && el.closest('.faq-filters')) return filterFaq(topic);
  if (el.matches('.faq-item h3 button')) return toggleFaq(faqItems().indexOf(el.closest('.faq-item')));
  if (el.matches('.menu-button')) return setMenu(!$('.nav').classList.contains('mobile-open'));
  if (el.closest('.nav')) return setMenu(false);
});

// Вкладки способов: стрелки, Home, End
$('.mode-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = $$('.mode-tabs [data-mode]');
  const current = tabs.findIndex(t => t.dataset.mode === state.mode);
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  selectMode(tabs[next].dataset.mode, true);
});

$('.intent-form').addEventListener('submit', event => { event.preventDefault(); submitQuery(); });
textarea.addEventListener('input', onQueryInput);
textarea.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuery(); }
});

$$('#result [data-field]').forEach(input => {
  input.addEventListener('input', () => editIntentField(input.dataset.field, input.value));
});

leadForm.addEventListener('submit', submitLead);
FIELDS.forEach(k => field(k).addEventListener('input', () => setFieldError(k, '')));
$('#lead-consent').addEventListener('change', () => setFieldError('consent', ''));
// Клик по затемнённому фону закрывает окно
dialog.addEventListener('click', event => { if (event.target === dialog) closeLead(); });

// Начальное состояние
if ($('[data-variant]')) setVariant(new URLSearchParams(location.search).get('variant') === 'focus' ? 'focus' : 'editorial', false);
onQueryInput();
