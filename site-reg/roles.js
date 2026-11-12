/*
  «Роли сторон»: этап, который сейчас посередине экрана, становится активным,
  и закреплённый глобус плавно переходит в состояние этого этапа (палитра — как в globe.js):
    1 — Россия, метка «Ваша потребность»;
    2 — Индия, точки кандидатов в крупных городах;
    3 — дуга Индия → Россия (документы и переезд);
    4 — Москва, метка «Выход на объект»;
    5 — Москва, расходящееся кольцо «Сопровождение».
*/
(() => {
  const section = document.querySelector('.roles-flow');
  const canvas = section?.querySelector('.roles-canvas');
  if (!canvas) return;
  if (!window.d3 || !window.topojson) { section.classList.add('is-failed'); return; }

  const INDIA = [77.21, 28.61], RUSSIA = [37.62, 55.75];
  const CITIES = [[72.88, 19.08], [77.59, 12.97], [88.36, 22.57], [80.27, 13.08], [78.49, 17.39], [77.21, 28.61]];
  const steps = [...section.querySelectorAll('.roles-step')];
  const ctx = canvas.getContext('2d');
  const arc = d3.geoInterpolate(INDIA, RUSSIA);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Состояние сцены: поворот, видимость элементов. Между этапами числа плавно интерполируются
  const STATES = [
    { lon: -45, lat: -50, russia: 1, india: .25, cities: 0, arc: 0, home: 1, ring: 0, label: 'Ваша потребность' },
    { lon: -78, lat: -20, russia: .25, india: 1, cities: 1, arc: 0, home: 0, ring: 0, label: 'Поиск кандидатов' },
    { lon: -58, lat: -38, russia: .7, india: 1, cities: 0, arc: 1, home: 0, ring: 0, label: '' },
    { lon: -42, lat: -50, russia: 1, india: .4, cities: 0, arc: 1, home: 1, ring: 0, label: 'Выход на объект' },
    { lon: -42, lat: -50, russia: 1, india: .4, cities: 0, arc: 1, home: 1, ring: 1, label: 'Сопровождение' },
  ];
  const KEYS = ['lon', 'lat', 'russia', 'india', 'cities', 'arc', 'home', 'ring'];
  let cur = { ...STATES[0] }, from = cur, to = STATES[0], t0 = 0, active = 0;
  let land, india, russia, borders, size = 0, dpr = 1, running = false, visible = false, label = STATES[0].label;

  const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

  function setStage(i) {
    if (i === active) return;
    active = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    from = { ...cur }; to = STATES[i]; t0 = performance.now(); label = to.label;
    if (reduceMotion) { cur = { ...to }; draw(); return; }
    start();
  }

  // Кадры идут, только пока глобус на экране: иначе пульсация последнего этапа перерисовывала бы
  // глобус каждый кадр при прокрутке остальной страницы
  function start() {
    if (running || !visible || reduceMotion) return;
    running = true;
    requestAnimationFrame(tick);
  }

  function tick(now) {
    const k = ease(Math.min(1, (now - t0) / 900));
    KEYS.forEach(key => { cur[key] = from[key] + (to[key] - from[key]) * k; });
    draw(now);
    // кольцо «Сопровождение» пульсирует, пока активен последний этап и глобус виден
    if ((k < 1 || to.ring > 0) && visible) requestAnimationFrame(tick);
    else running = false;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    canvas.width = size * dpr; canvas.height = size * dpr;
    draw();
  }

  function draw(now = performance.now()) {
    if (!land || !size) return;
    const r = size * .44, c = size / 2;
    const projection = d3.geoOrthographic().scale(r).translate([c, c]).clipAngle(90).rotate([cur.lon, cur.lat, 0]);
    const path = d3.geoPath(projection, ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = '#fff';
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
    ctx.strokeStyle = 'rgba(25, 27, 30, .05)'; ctx.lineWidth = 1;
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.stroke();
    ctx.fillStyle = '#c9d3d6';
    ctx.beginPath(); path(land); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, .9)'; ctx.lineWidth = .6;
    ctx.beginPath(); path(borders); ctx.stroke();
    ctx.fillStyle = `rgba(17, 213, 203, ${.15 + .6 * cur.india})`;
    ctx.beginPath(); path(india); ctx.fill();
    ctx.fillStyle = `rgba(17, 213, 203, ${.15 + .6 * cur.russia})`;
    ctx.beginPath(); path(russia); ctx.fill();

    const shade = ctx.createRadialGradient(c - r * .3, c - r * .35, r * .2, c, c, r * 1.02);
    shade.addColorStop(0, 'rgba(255, 255, 255, .35)');
    shade.addColorStop(.75, 'rgba(255, 255, 255, 0)');
    shade.addColorStop(1, 'rgba(43, 47, 51, .14)');
    ctx.fillStyle = shade;
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
    ctx.strokeStyle = 'rgba(25, 27, 30, .1)'; ctx.lineWidth = 1;
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.stroke();

    // кандидаты: точки в городах Индии
    if (cur.cities > .01) {
      ctx.globalAlpha = cur.cities;
      CITIES.forEach((city, i) => {
        const xy = projection(city);
        if (!xy) return;
        const pulse = 1 + .35 * Math.sin(now / 400 + i);
        ctx.fillStyle = 'rgba(10, 156, 149, .2)';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 7 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a9c95';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // дуга маршрута над поверхностью
    if (cur.arc > .01) {
      const pts = [], n = 80, until = Math.round(n * cur.arc);
      for (let i = 0; i <= until; i++) {
        const t = i / n, xy = projection(arc(t));
        if (!xy) continue;
        const lift = 1 + .22 * Math.sin(Math.PI * t);
        pts.push([c + (xy[0] - c) * lift, c + (xy[1] - c) * lift]);
      }
      if (pts.length > 1) {
        ctx.lineCap = 'round'; ctx.strokeStyle = '#0a9c95'; ctx.lineWidth = 2.5;
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[Math.max(0, pts.length - 4)];
        const a = Math.atan2(y2 - y1, x2 - x1), s = 11;
        ctx.fillStyle = '#0a9c95';
        ctx.beginPath();
        ctx.moveTo(x2 + Math.cos(a) * s * .6, y2 + Math.sin(a) * s * .6);
        ctx.lineTo(x2 + Math.cos(a + 2.5) * s, y2 + Math.sin(a + 2.5) * s);
        ctx.lineTo(x2 + Math.cos(a - 2.5) * s, y2 + Math.sin(a - 2.5) * s);
        ctx.closePath(); ctx.fill();
      }
    }

    // расходящееся кольцо вокруг Москвы
    const home = projection(RUSSIA);
    if (cur.ring > .01 && home) {
      for (let i = 0; i < 2; i++) {
        const ph = ((now / 1600) + i / 2) % 1;
        ctx.strokeStyle = `rgba(10, 156, 149, ${(1 - ph) * .6 * cur.ring})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(home[0], home[1], 8 + ph * 34, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // метки: этап 2 — у Индии, этап 3 — «Индия» и «Россия» на концах дуги, остальные — у Москвы
    if (active === 1) marker(projection(INDIA), cur.cities, label);
    else if (active === 2) {
      marker(projection(INDIA), Math.min(1, cur.arc * 1.5), 'Индия');
      if (cur.arc > .98) marker(home, 1, 'Россия');
    } else {
      if (cur.arc > .5) marker(projection(INDIA), cur.arc);
      marker(home, cur.home, label);
    }
  }

  function marker(xy, alpha, text) {
    if (!xy || alpha <= 0) return;
    const [x, y] = xy;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10, 156, 149, .25)';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a9c95';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (text) tag(xy, text, alpha);
  }

  function tag([x, y], text, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = '500 13px "SB Sans Text", Arial, sans-serif';
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(25, 27, 30, .15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    // На телефоне глобус узкий (220px), и метка справа от точки вылезала за край canvas:
    // если справа не помещается — ставим слева от точки, и в любом случае держим в границах
    const pad = 6;
    let bx = x + 12, by = y - 24;
    if (bx + w > size - pad) {
      if (x - 12 - w >= pad) bx = x - 12 - w;              // слева от точки
      else { bx = x - w / 2; by = y - 38; }                // ни справа, ни слева — над точкой
    }
    if (by < pad) by = y + 14;                             // у верхнего края — под точкой
    bx = Math.max(pad, Math.min(bx, size - w - pad));
    by = Math.min(by, size - 24 - pad);
    ctx.beginPath(); ctx.roundRect(bx, by, w, 24, 12); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#2b2f33';
    ctx.fillText(text, bx + 8, by + 16);
    ctx.globalAlpha = 1;
  }

  // Активный этап — тот, что пересекает середину экрана
  const io = new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting).forEach(e => setStage(steps.indexOf(e.target)));
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => io.observe(s));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);
  steps[0].classList.add('is-active');

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
    .then(r => r.json())
    .then(world => {
      const countries = world.objects.countries;
      land = topojson.feature(world, world.objects.land);
      borders = topojson.mesh(world, countries, (a, b) => a !== b);
      const byId = id => topojson.feature(world, { type: 'GeometryCollection', geometries: countries.geometries.filter(g => g.id === id) });
      india = byId('356');
      russia = byId('643');
      section.classList.add('is-ready');
      resize();
    })
    .catch(() => section.classList.add('is-failed'));

  addEventListener('resize', resize);
})();
