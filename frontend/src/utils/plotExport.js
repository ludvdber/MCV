/**
 * Export d'images Plotly : clone hors ecran en theme clair.
 *
 * Partage entre ExportMenu (PNG/SVG classiques + publication), le montage de
 * grille de la console Explorer et l'export video WebM. On ne touche JAMAIS
 * au graphique visible : chaque export rend une copie dans un div hors ecran
 * (newPlot + toImage + purge).
 */
import Plotly from '../plotlyBundle';
import { quiverScales, buildQuiverSegments } from './windQuiver';

const INK = '#222222';

/**
 * Adapte les champs de fleches du clone a SA geometrie et a son theme.
 *
 * Une fleche de vent est construite a partir de la zone de trace, pour que
 * l'angle dessine soit celui du vent (cf. windQuiver.js). Une figure exportee
 * en 1920x1080 n'a pas la forme du cadre affiche a l'ecran : sans ce recalcul,
 * elle porterait les angles de l'ecran. Les traces concernees se reconnaissent
 * a `meta.quiver`, qui transporte le champ de vent brut.
 *
 * L'encre passe aussi en gris fonce, comme le reste du clone clair : les
 * fleches heritaient sinon du blanc du theme sombre et disparaissaient sur
 * les zones claires de la palette.
 */
async function refreshQuiverTraces(el) {
  const fl = el._fullLayout;
  if (!fl?._size) return;
  const indices = [], xs = [], ys = [];
  (el.data ?? []).forEach((trace, i) => {
    const wind = trace.meta?.quiver;
    if (!wind) return;
    const seg = buildQuiverSegments(
      wind, quiverScales(fl._size, fl.xaxis?.range, fl.yaxis?.range));
    indices.push(i);
    xs.push(seg.x);
    ys.push(seg.y);
  });
  if (!indices.length) return;
  await Plotly.restyle(el, { x: xs, y: ys, 'line.color': INK }, indices);
}

/**
 * Construit une copie { data, layout } du graphique en theme clair :
 * fond blanc, toutes les encres (titre, axes, colorbars, annotations)
 * ramenees a un gris fonce lisible sur papier.
 */
export function buildLightClone(gd) {
  const L = gd.layout ?? {};

  const lightLayout = { ...L,
    paper_bgcolor: 'white',
    plot_bgcolor:  '#eeeeee',
    font:   { ...(L.font   ?? {}), color: INK },
    legend: { ...(L.legend ?? {}), font: { ...(L.legend?.font ?? {}), color: INK } },
  };

  // Titre principal (string ou { text, font })
  if (L.title != null) {
    lightLayout.title = typeof L.title === 'string'
      ? { text: L.title, font: { color: INK } }
      : { ...L.title, font: { ...(L.title.font ?? {}), color: INK } };
  }

  // Axes : `color` couvre ticks + labels + titre-chaine ; `tickfont` et
  // `title.font` couvrent les formes objet explicitement colorees.
  for (const k of Object.keys(L).filter(k => /^[xy]axis\d*$/.test(k))) {
    const ax = L[k];
    lightLayout[k] = { ...ax,
      color:    INK,
      tickfont: { ...(ax.tickfont ?? {}), color: INK },
      title: ax.title == null || typeof ax.title === 'string'
        ? ax.title
        : { ...ax.title, font: { ...(ax.title.font ?? {}), color: INK } },
    };
  }

  if (Array.isArray(L.annotations)) {
    lightLayout.annotations = L.annotations.map(a => ({
      ...a, font: { ...(a.font ?? {}), color: INK },
    }));
  }

  const lightData = (gd.data ?? []).map(t => {
    // Toujours cloner, meme les traces sans colorbar : Plotly.newPlot ecrit
    // uid/_input/_fullInput… sur les objets trace qu'on lui passe. Rendre `t`
    // par reference laisserait Plotly muter les traces du graphe VISIBLE →
    // artefacts (uid reecrit, glitches) apres un export.
    if (!t.colorbar) return { ...t };
    const cb = t.colorbar;
    return { ...t,
      colorbar: { ...cb,
        tickfont: { ...(cb.tickfont ?? {}), color: INK },
        title: cb.title == null ? cb.title
          : typeof cb.title === 'string'
            ? { text: cb.title, font: { color: INK } }
            : { ...cb.title, font: { ...(cb.title.font ?? {}), color: INK } },
      },
    };
  });

  return { data: lightData, layout: lightLayout };
}

/**
 * Applique le mode publication a un clone clair : titre complet (avec
 * sous-titre dataset), titres d'axes, colorbar reaffichee meme si la vue
 * d'origine etait compacte, et mention de credit en pied de figure.
 *
 * @param {{data, layout}} clone — sortie de buildLightClone (mute en place)
 * @param {{title, subtitle, credit, xTitle, yTitle}} pub
 */
export function applyPublication(clone, pub) {
  const { layout, data } = clone;

  const titleText = pub.subtitle
    ? `${pub.title}<br><sub>${pub.subtitle}</sub>`
    : pub.title;
  layout.title = { text: titleText, font: { color: INK, size: 20 }, x: 0.5, xanchor: 'center' };

  // Vue compacte : les traces masquaient leur colorbar — une figure de
  // publication doit la montrer.
  clone.data = data.map(t =>
    'showscale' in t && t.showscale === false ? { ...t, showscale: true } : t);

  // Titres d'axes : uniquement s'ils manquent (la vue simple les a deja).
  for (const [k, txt] of [['xaxis', pub.xTitle], ['yaxis', pub.yTitle]]) {
    if (!txt) continue;
    const ax = layout[k] ?? {};
    const hasTitle = ax.title && (typeof ax.title === 'string' ? ax.title : ax.title.text);
    if (!hasTitle) layout[k] = { ...ax, title: { text: txt, font: { color: INK } } };
  }

  // Marge basse genereuse : le credit vit SOUS l'axe X, dans la marge.
  layout.margin = { l: 80, r: 130, t: pub.subtitle ? 90 : 70, b: 110 };
  layout.annotations = [
    ...(layout.annotations ?? []),
    {
      text: pub.credit,
      xref: 'paper', yref: 'paper', x: 0, y: -0.09,
      xanchor: 'left', yanchor: 'top', showarrow: false,
      font: { size: 12, color: '#555555' },
    },
  ];
}

/**
 * Exporte un graphique en image via un clone hors ecran.
 *
 * @param {HTMLElement} gd      div Plotly source
 * @param {'png'|'svg'} format
 * @param {Object}      opts    { width, height, scale, publication }
 * @returns {Promise<string>}   dataURL de l'image
 */
export async function exportPlotImage(gd, format, opts = {}) {
  const { publication, ...imgOpts } = opts;
  const el = document.createElement('div');
  // Le div hors ecran prend la taille de l'image demandee : la mise en page
  // que Plotly calcule est alors celle de l'image finale, ce dont depend le
  // recalcul des fleches de vent ci-dessous.
  const w = imgOpts.width ?? 1200;
  const h = imgOpts.height ?? 700;
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;visibility:hidden;`;
  document.body.appendChild(el);
  try {
    const clone = buildLightClone(gd);
    if (publication) applyPublication(clone, publication);
    await Plotly.newPlot(el, clone.data, clone.layout, { staticPlot: true, responsive: false });
    await refreshQuiverTraces(el);
    return await Plotly.toImage(el, { format, ...imgOpts });
  } finally {
    Plotly.purge(el);
    document.body.removeChild(el);
  }
}

/**
 * Montage de grille : exporte chaque cellule en clone clair puis compose un
 * PNG unique (2 colonnes) avec bandeau de titre et credit.
 *
 * @param {Array<{gd: HTMLElement, title: string, context: string}>} cells
 * @param {{title: string, credit: string}} meta
 * @returns {Promise<string>} dataURL PNG du montage
 */
export async function exportGridMontage(cells, meta) {
  const CW = 940, CH = 560, PAD = 24, HEAD = 64, CAPTION = 34, FOOT = 40;
  const cols = cells.length > 1 ? 2 : 1;
  const rows = Math.ceil(cells.length / cols);

  const images = [];
  for (const c of cells) {
    const url = await exportPlotImage(c.gd, 'png', { width: CW, height: CH, scale: 2 });
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    images.push(img);
  }

  const W = PAD + cols * (CW + PAD);
  const H = HEAD + rows * (CAPTION + CH + PAD) + FOOT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillText(meta.title, PAD, 40);

  cells.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = PAD + col * (CW + PAD);
    const y = HEAD + row * (CAPTION + CH + PAD);
    ctx.fillStyle = INK;
    ctx.font = '600 17px Arial, sans-serif';
    ctx.fillText(`${String.fromCharCode(97 + i)}) ${c.title}${c.context ? `  ·  ${c.context}` : ''}`, x, y + 20);
    ctx.drawImage(images[i], x, y + CAPTION, CW, CH);
    ctx.strokeStyle = '#dddddd';
    ctx.strokeRect(x + 0.5, y + CAPTION + 0.5, CW - 1, CH - 1);
  });

  ctx.fillStyle = '#555555';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(meta.credit, PAD, H - 16);

  return canvas.toDataURL('image/png');
}
