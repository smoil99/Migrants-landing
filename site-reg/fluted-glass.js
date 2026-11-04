/* Рифлёное стекло: заполняет .fluted-glass вертикальными полосами шириной ~18px.
   Подход — fullstack.rocks/article/fluted-glass-with-react-and-styled-components (без React):
   каждая полоса показывает тот же фон, уменьшенный по ширине до SCALE, со своим сдвигом,
   и повёрнута в 3D (поворот — в CSS). Вместе полосы собирают исходную картинку.
   data-fluted-src — картинка фона, data-fluted-fit — "cover" (как background-size: cover, по центру)
   или "fill" (растянуть по размеру блока). */
(() => {
  const PANE = 18;
  const SCALE = .25;
  const BLEED = 1.08;
  const OVERSCAN = .1; // полоса выше блока на 10% сверху и снизу (height: 120% в CSS)

  const layout = (glass, img) => {
    const w = glass.clientWidth;
    const h = glass.clientHeight;
    if (!w || !h) return;
    const n = Math.max(12, Math.round(w / PANE));
    if (glass.children.length !== n) {
      glass.replaceChildren(...Array.from({ length: n }, () => document.createElement('i')));
    }

    // Размер и сдвиг картинки, как у фона блока.
    let iw = w;
    let ih = h;
    // Для cover масштаб и позицию можно задать в CSS (в том числе в media queries):
    // --fluted-zoom (1 = как cover), --fluted-x / --fluted-y — доли 0…1, как background-position в %.
    const css = getComputedStyle(glass);
    const num = (name, fallback) => {
      const v = parseFloat(css.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    if (glass.dataset.flutedFit === 'cover') {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * num('--fluted-zoom', 1);
      iw = img.naturalWidth * scale;
      ih = img.naturalHeight * scale;
    }
    const px = num('--fluted-x', .5);
    const py = num('--fluted-y', .5);
    const cropX = (iw - w) * px;
    // В 3D-повороте дальний край полосы чуть короче, и низ картинки уходит выше края блока —
    // получаются «зубцы». Запас по высоте: картинка на BLEED выше, центр на месте.
    const ih0 = ih;
    ih *= BLEED;
    const cropY = (ih0 - h) * py + (ih - ih0) / 2;

    // Как в статье (stretchPercentage 75): в полосе фон уменьшен в 4 раза, поэтому в каждое ребро
    // попадает широкий кусок картинки; от полосы к полосе он сдвигается так, что вместе они проходят
    // видимую часть фона слева направо.
    const pw = w / n;
    const sw = iw * SCALE;
    const start = sw * cropX / iw;
    const span = sw * w / iw - pw;
    const url = `url("${img.src}")`;
    [...glass.children].forEach((pane, i) => {
      pane.style.backgroundImage = url;
      pane.style.backgroundSize = `${sw}px ${ih}px`;
      pane.style.backgroundPosition = `${-(start + i / n * span)}px ${OVERSCAN * h - cropY}px`;
    });
  };

  const mount = (glass) => {
    const img = new Image();
    img.onload = () => {
      layout(glass, img);
      new ResizeObserver(() => layout(glass, img)).observe(glass);
    };
    img.src = glass.dataset.flutedSrc;
  };

  const start = () => document.querySelectorAll('.fluted-glass[data-fluted-src]').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
