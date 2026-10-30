/*
  Секция «Маршрут специалиста»: глобус на canvas (d3-geo, контуры стран — world-atlas 110m).
  Когда секция появляется на экране, один раз проигрывается сцена: глобус поворачивается от Индии к России,
  дуга-маршрут прорисовывается, этапы слева загораются по очереди и остаются подсвеченными. Палитра светлая.
*/
(() => {
  const section = document.querySelector('.route-section');
  const canvas = section?.querySelector('.route-canvas');
  if (!canvas) return;
  if (!window.d3 || !window.topojson) { section.classList.add('is-failed'); return; }   // нет библиотек — только текст

  const INDIA = [77.21, 28.61];   // Нью-Дели
  const RUSSIA = [37.62, 55.75];  // Москва
  const INDIA_ID = '356', RUSSIA_ID = '643';
  const steps = [...section.querySelectorAll('.route-steps li')];
  const ctx = canvas.getContext('2d');
  const arc = d3.geoInterpolate(INDIA, RUSSIA);
  const DURATION = 4200;   // мс на всю сцену
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let land, india, russia, borders, size = 0, dpr = 1;
  let p = 0, started = false, seen = false;

  const clamp = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  // Сцена стартует, когда секция на экране и карта загружена (что бы ни случилось раньше)
  function play() {
    if (started || !seen || !land) return;
    started = true;
    if (reduceMotion) { p = 1; draw(); return; }
    const t0 = performance.now();
    const tick = now => {
      p = clamp((now - t0) / DURATION);
      draw();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    draw();
  }

  function draw() {
    if (!land || !size) return;
    const turn = ease(clamp(p / .55));          // поворот глобуса: от Индии к середине маршрута
    const route = ease(clamp((p - .12) / .6));  // дуга рисуется чуть позже поворота
    steps.forEach((li, i) => li.classList.toggle('is-active', i <= Math.min(2, Math.floor(p * 3))));

    const r = size * .4, c = size / 2;
    const projection = d3.geoOrthographic()
      .scale(r).translate([c, c]).clipAngle(90)
      .rotate([lerp(-INDIA[0], -58, turn), lerp(-INDIA[1] + 8, -38, turn), 0]);
    const path = d3.geoPath(projection, ctx);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // океан — белый; край шара отделяет тонкая обводка, объём даёт затенение ниже
    ctx.fillStyle = '#fff';
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();

    // сетка
    ctx.strokeStyle = 'rgba(25, 27, 30, .05)'; ctx.lineWidth = 1;
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.stroke();

    // суша, границы, Индия и Россия
    ctx.fillStyle = '#c9d3d6';
    ctx.beginPath(); path(land); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, .9)'; ctx.lineWidth = .6;
    ctx.beginPath(); path(borders); ctx.stroke();
    ctx.fillStyle = 'rgba(17, 213, 203, .75)';
    ctx.beginPath(); path(india); ctx.fill();
    ctx.fillStyle = `rgba(17, 213, 203, ${.25 + .45 * route})`;
    ctx.beginPath(); path(russia); ctx.fill();

    // блик и тень по краю шара
    const shade = ctx.createRadialGradient(c - r * .3, c - r * .35, r * .2, c, c, r * 1.02);
    shade.addColorStop(0, 'rgba(255, 255, 255, .35)');
    shade.addColorStop(.75, 'rgba(255, 255, 255, 0)');
    shade.addColorStop(1, 'rgba(43, 47, 51, .14)');
    ctx.fillStyle = shade;
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
    ctx.strokeStyle = 'rgba(25, 27, 30, .1)'; ctx.lineWidth = 1;
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.stroke();

    // дуга маршрута над поверхностью: точка на окружности поднимается по синусу
    const pts = [];
    const n = 80, until = Math.round(n * route);
    for (let i = 0; i <= until; i++) {
      const t = i / n;
      const xy = projection(arc(t));
      if (!xy) continue;
      const lift = 1 + .22 * Math.sin(Math.PI * t);
      pts.push([c + (xy[0] - c) * lift, c + (xy[1] - c) * lift]);
    }
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0a9c95'; ctx.lineWidth = 2.5;
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      // наконечник стрелки по направлению последнего отрезка
      const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[Math.max(0, pts.length - 4)];
      const a = Math.atan2(y2 - y1, x2 - x1), s = 11;
      ctx.fillStyle = '#0a9c95';
      ctx.beginPath();
      ctx.moveTo(x2 + Math.cos(a) * s * .6, y2 + Math.sin(a) * s * .6);
      ctx.lineTo(x2 + Math.cos(a + 2.5) * s, y2 + Math.sin(a + 2.5) * s);
      ctx.lineTo(x2 + Math.cos(a - 2.5) * s, y2 + Math.sin(a - 2.5) * s);
      ctx.closePath(); ctx.fill();
    }

    // точки и подписи городов
    marker(projection(INDIA), 'Индия', 1);
    if (route > .98) marker(projection(RUSSIA), 'Россия', 1);
  }

  function marker(xy, label, alpha) {
    if (!xy) return;
    const [x, y] = xy;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10, 156, 149, .25)';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a9c95';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '500 13px "SB Sans Text", Arial, sans-serif';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(25, 27, 30, .15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(x + 12, y - 24, w, 24, 12); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#2b2f33';
    ctx.fillText(label, x + 20, y - 8);
    ctx.globalAlpha = 1;
  }

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
    .then(r => r.json())
    .then(world => {
      const countries = world.objects.countries;
      land = topojson.feature(world, world.objects.land);
      borders = topojson.mesh(world, countries, (a, b) => a !== b);
      const byId = id => topojson.feature(world, { type: 'GeometryCollection', geometries: countries.geometries.filter(g => g.id === id) });
      india = byId(INDIA_ID);
      russia = byId(RUSSIA_ID);
      section.classList.add('is-ready');
      resize();
      play();
    })
    .catch(() => section.classList.add('is-failed'));   // без карты остаётся текст секции

  new IntersectionObserver((entries, io) => {
    if (!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    seen = true;
    play();
  }, { threshold: .35 }).observe(canvas);

  addEventListener('resize', resize);
})();
