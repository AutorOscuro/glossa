// Contraste WCAG de los temas (subparte 0.3). Lee ui/styles/themes.css y calcula razones de contraste
// con la fórmula oficial de WCAG 2.x. Los colores con transparencia se componen sobre el fondo real.
//
// Uso:  node tools/contrast.mjs               → informe en español; sale con código 1 si algo falla AA
//       node tools/contrast.mjs --markdown    → tabla para pegar en docs/DESIGN.md
// Como módulo: parseColor, composite, luminance, contrastRatio, parseThemes, evaluateTheme, evaluateAll, contrastMarkdown
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCss } from './css-lite.mjs';

// ---------- Color ----------
export function parseColor(input) {
  const s = String(input).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (k) => parseInt(h.slice(k, k + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  throw new Error(`Color no reconocido: ${String(input)}`);
}

// fg (posiblemente translúcido) puesto sobre bg (opaco) → color opaco
export function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

export function luminance({ r, g, b }) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- Lectura de themes.css ----------
export const THEME_NAMES = ['aurora', 'neo', 'claro'];

export function parseThemes(css) {
  const themes = {};
  for (const rule of parseCss(css)) {
    const names = [...rule.selector.matchAll(/\[data-theme="([a-z]+)"\]/g)].map((m) => m[1]);
    for (const name of names) {
      themes[name] ??= {};
      for (const d of rule.decls) if (d.prop.startsWith('--')) themes[name][d.prop.slice(2)] = d.value;
    }
  }
  return themes;
}

// ---------- Fondos sobre los que puede aparecer texto ----------
// Los resplandores (glow) son la parte MÁS CLARA/OSCURA del degradado del fondo: se comprueba también ahí.
function solidTokenColor(tokens, name) {
  if (tokens[name] === undefined) throw new Error(`Falta la variable --${name}`);
  return parseColor(tokens[name]);
}

export function backdropColor(tokens, spec) {
  const base = {
    bg: () => solidTokenColor(tokens, 'bg'),
    glow1: () => solidTokenColor(tokens, 'bg-glow-1'),
    glow2: () => solidTokenColor(tokens, 'bg-glow-2'),
    solid: () => solidTokenColor(tokens, 'surface-solid'),
  };
  if (base[spec]) return base[spec]();
  const m = spec.match(/^(surface|strong|track)@(bg|glow1|glow2|solid)$/);
  if (!m) throw new Error(`Fondo desconocido: ${spec}`);
  const layer = { surface: 'surface', strong: 'surface-strong', track: 'track' }[m[1]];
  return composite(solidTokenColor(tokens, layer), base[m[2]]());
}

export const TEXT_BACKDROPS = [
  'bg', 'glow1', 'glow2', 'solid',
  'surface@bg', 'surface@glow1', 'surface@glow2', 'surface@solid',
  'strong@bg', 'strong@glow1', 'strong@glow2', 'strong@solid',
];

// Cada comprobación: { id, label, min, fg, on }  (fg = variable; on = fondo de arriba o variable de relleno "=nombre")
export const CHECKS = [
  ...['text', 'text-muted', 'accent-text', 'accent-2-text', 'info-text', 'success-text', 'danger-text'].flatMap((fg) =>
    TEXT_BACKDROPS.map((on) => ({ id: `${fg} sobre ${on}`, label: `Texto --${fg}`, min: 4.5, fg, on })),
  ),
  ...[
    ['on-accent', 'accent'], ['on-accent-2', 'accent-2'], ['on-info', 'info'],
    ['on-success', 'success'], ['on-danger', 'danger'], ['callout-text', 'callout-bg'],
  ].map(([fg, fill]) => ({ id: `${fg} sobre ${fill}`, label: `Texto --${fg} sobre relleno`, min: 4.5, fg, on: `=${fill}` })),
  { id: 'disabled-text sobre disabled-bg', label: 'Texto deshabilitado (legible, no exigido por AA)', min: 3, fg: 'disabled-text', on: '=disabled-bg' },
  ...['bg', 'glow1', 'glow2', 'solid'].map((on) => ({ id: `border-input sobre ${on}`, label: 'Borde de campo (no texto)', min: 3, fg: 'border-input', on })),
  ...['bg', 'glow1', 'glow2', 'solid'].map((on) => ({ id: `focus sobre ${on}`, label: 'Anillo de foco (no texto)', min: 3, fg: 'focus', on })),
  // Las barras de progreso se rellenan con la variante --X-text (más clara en temas oscuros, más oscura en el claro).
  ...['accent-text', 'accent-2-text', 'info-text', 'success-text', 'danger-text'].flatMap((fg) =>
    ['track@bg', 'track@solid'].map((on) => ({ id: `${fg} sobre ${on}`, label: 'Barra de progreso (no texto)', min: 3, fg, on })),
  ),
  // Interruptor encendido (0.5): el relleno --accent debe distinguirse del fondo (no es texto, basta 3:1).
  ...['bg', 'glow1', 'glow2', 'solid'].map((on) => ({ id: `accent sobre ${on}`, label: 'Interruptor encendido (no texto)', min: 3, fg: 'accent', on })),
];

export function evaluateTheme(tokens) {
  return CHECKS.map((c) => {
    let ratio = null;
    let error = null;
    try {
      const fg = solidTokenColor(tokens, c.fg);
      const bg = c.on.startsWith('=') ? solidTokenColor(tokens, c.on.slice(1)) : backdropColor(tokens, c.on);
      ratio = contrastRatio(fg.a < 1 ? composite(fg, bg) : fg, bg);
    } catch (e) {
      error = e.message;
    }
    return { ...c, ratio, ok: error === null && ratio >= c.min, error };
  });
}

export function evaluateAll(css) {
  const themes = parseThemes(css);
  const out = {};
  for (const name of THEME_NAMES) {
    out[name] = themes[name] ? evaluateTheme(themes[name]) : [{ id: 'tema', label: 'Tema', min: 0, ratio: null, ok: false, error: `Falta el tema ${name}` }];
  }
  return out;
}

// ---------- Salida ----------
const fmt = (n) => (n === null ? '—' : n.toFixed(2).replace('.', ',') + ':1');

function groupMin(results) {
  const groups = new Map();
  for (const r of results) {
    const g = groups.get(r.label) ?? { label: r.label, min: r.min, worst: Infinity, failures: 0 };
    if (r.ratio !== null) g.worst = Math.min(g.worst, r.ratio);
    if (!r.ok) g.failures += 1;
    groups.set(r.label, g);
  }
  return [...groups.values()];
}

// Tabla en Markdown (peor caso por grupo y tema). La usa docs/DESIGN.md; una prueba exige que coincida.
export function contrastMarkdown(css) {
  const all = evaluateAll(css);
  const perTheme = Object.fromEntries(THEME_NAMES.map((n) => [n, groupMin(all[n])]));
  const out = ['| Comprobación | Exigido | Aurora (peor caso) | Neo (peor caso) | Claro (peor caso) |', '|---|---|---|---|---|'];
  perTheme.aurora.forEach((g, k) => {
    const cells = THEME_NAMES.map((n) => fmt(perTheme[n][k].worst));
    out.push(`| ${g.label} | ≥ ${fmt(g.min)} | ${cells.join(' | ')} |`);
  });
  return out.join('\n');
}

function main(argv) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const css = fs.readFileSync(path.join(here, '..', 'ui', 'styles', 'themes.css'), 'utf8');
  if (argv.includes('--markdown')) {
    process.stdout.write(`${contrastMarkdown(css)}\n`);
    return 0;
  }
  const all = evaluateAll(css);
  const out = [];
  let failed = 0;
  for (const n of THEME_NAMES) {
    failed += all[n].filter((r) => !r.ok).length;
    out.push(`Tema ${n}:`);
    for (const g of groupMin(all[n])) out.push(`  ${g.failures === 0 ? '✔' : '✘'} ${g.label}: peor caso ${fmt(g.worst)} (exigido ${fmt(g.min)})`);
    for (const r of all[n].filter((x) => !x.ok)) out.push(`    ✘ ${r.id}: ${r.error ?? fmt(r.ratio)}`);
  }
  out.push(failed === 0 ? '✔ Contraste AA correcto en los 3 temas.' : `✘ ${failed} comprobación(es) de contraste fallan.`);
  process.stdout.write(`${out.join('\n')}\n`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
