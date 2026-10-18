// Pruebas del sistema de diseño (subparte 0.3): tokens, temas, contraste AA, reglas de los CSS y galería.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCss, classesInCss, stripComments } from '../tools/css-lite.mjs';
import {
  parseColor, composite, luminance, contrastRatio, parseThemes, evaluateAll, evaluateTheme, contrastMarkdown, THEME_NAMES, CHECKS,
} from '../tools/contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = path.join(root, 'ui', 'styles');
const read = (name) => fs.readFileSync(path.join(stylesDir, name), 'utf8');
const CSS_FILES = ['tokens.css', 'themes.css', 'base.css', 'components.css', 'widgets.css', 'demo.css'];
const decls = (css) => parseCss(css).flatMap((r) => r.decls.map((d) => ({ ...d, selector: r.selector, at: r.at })));

// ---------- css-lite ----------
test('css-lite: reglas, @media anidado, !important, @import y @keyframes', () => {
  const rules = parseCss(`
    /* comentario { que no cuenta } */
    @import url("x.css");
    .a, .b:hover { color: red; margin: 0 !important; }
    @media (hover: hover) { .c { background: var(--x, #fff); } }
    @keyframes k { from { opacity: 0; } to { opacity: 1; } }
  `);
  assert.equal(rules[0].selector, '@import url("x.css")');
  const a = rules.find((r) => r.selector === '.a, .b:hover');
  assert.equal(a.decls.length, 2);
  assert.equal(a.decls[1].important, true);
  assert.equal(a.decls[1].value, '0');
  const c = rules.find((r) => r.selector === '.c');
  assert.equal(c.at, '@media (hover: hover)');
  assert.equal(c.decls[0].value, 'var(--x, #fff)');
  assert.equal(rules.filter((r) => r.at && r.at.startsWith('@keyframes')).length, 2);
});

test('css-lite: entradas vacías o raras no lanzan error', () => {
  assert.deepEqual(parseCss(''), []);
  assert.deepEqual(parseCss('/* solo comentario */'), []);
  assert.equal(parseCss('.x { }').length, 1);
  assert.equal(stripComments('a/* b */c'), 'ac');
  assert.deepEqual([...classesInCss('.uno.dos > .tres:hover, #id { }')].sort(), ['dos', 'tres', 'uno']);
});

// ---------- contraste: la fórmula ----------
test('contraste: valores conocidos de WCAG', () => {
  const black = parseColor('#000');
  const white = parseColor('#ffffff');
  assert.equal(Math.round(contrastRatio(black, white) * 100) / 100, 21);
  assert.equal(contrastRatio(white, white), 1);
  assert.ok(Math.abs(contrastRatio(parseColor('#777'), white) - 4.48) < 0.02);
  assert.ok(luminance(white) > 0.99 && luminance(black) === 0);
});

test('contraste: colores rgba, hex con alfa y composición sobre un fondo', () => {
  assert.deepEqual(parseColor('rgba(255, 255, 255, 0.5)'), { r: 255, g: 255, b: 255, a: 0.5 });
  assert.equal(parseColor('#ffffff80').a.toFixed(2), '0.50');
  const mid = composite(parseColor('rgba(255,255,255,0.5)'), parseColor('#000'));
  assert.ok(Math.abs(mid.r - 127.5) < 0.01 && mid.a === 1);
});

test('contraste: color inválido lanza error claro', () => {
  assert.throws(() => parseColor('azul'), /Color no reconocido/);
  assert.throws(() => parseColor(''), /Color no reconocido/);
});

// ---------- temas ----------
const themesCss = read('themes.css');
const themes = parseThemes(themesCss);

test('temas: existen aurora, neo y claro, y Aurora es el valor por defecto', () => {
  assert.deepEqual(Object.keys(themes).sort(), [...THEME_NAMES].sort());
  assert.match(themesCss, /:root,\s*\[data-theme="aurora"\]/);
});

test('temas: los tres definen exactamente las mismas variables', () => {
  const ref = Object.keys(themes.aurora).sort();
  assert.ok(ref.length >= 35, 'Aurora debería definir al menos 35 variables');
  for (const name of ['neo', 'claro']) {
    assert.deepEqual(Object.keys(themes[name]).sort(), ref, `El tema ${name} no coincide con Aurora`);
  }
});

test('temas: cada color se puede interpretar (hex o rgba) y cada tema fija color-scheme', () => {
  const skip = new Set(['bg-image', 'shadow-sm', 'shadow-md', 'shadow-lg']);
  for (const name of THEME_NAMES) {
    for (const [token, value] of Object.entries(themes[name])) {
      if (skip.has(token)) continue;
      assert.doesNotThrow(() => parseColor(value), `--${token} en ${name}: "${value}"`);
    }
  }
  assert.match(themesCss, /\[data-theme="claro"\]\s*{\s*color-scheme: light/);
  assert.match(themesCss, /\[data-theme="neo"\]\s*{\s*color-scheme: dark/);
});

test('temas: valores de marca de Sophia (roadmap 7.6)', () => {
  assert.equal(themes.aurora.bg, '#070a1d');
  assert.equal(themes.aurora.accent, '#ffc107');
  assert.equal(themes.aurora['accent-2'], '#8b5cf6');
  assert.equal(themes.neo.bg, '#05050a');
  assert.equal(themes.neo.accent, '#00e5ff');
  assert.equal(themes.neo['accent-2'], '#c740ff');
  assert.equal(themes.claro.bg, '#f4f5fa');
  assert.equal(themes.claro.accent, '#4f46e5');
});

test('contraste AA: todas las comprobaciones pasan en los 3 temas', () => {
  const all = evaluateAll(themesCss);
  for (const name of THEME_NAMES) {
    assert.ok(all[name].length >= CHECKS.length);
    const fails = all[name].filter((r) => !r.ok).map((r) => `${r.id}: ${r.error ?? r.ratio?.toFixed(2)}`);
    assert.deepEqual(fails, [], `Contraste insuficiente en ${name}`);
  }
});

test('contraste AA: la comprobación SÍ detecta un color malo y una variable que falta', () => {
  const bad = { ...themes.aurora, 'text-muted': '#444466' };
  assert.ok(evaluateTheme(bad).some((r) => r.fg === 'text-muted' && !r.ok), 'un gris oscuro sobre fondo oscuro debe fallar');
  const missing = { ...themes.neo };
  delete missing['on-accent'];
  const res = evaluateTheme(missing).filter((r) => r.fg === 'on-accent');
  assert.ok(res.length > 0 && res.every((r) => !r.ok && /Falta la variable --on-accent/.test(r.error)));
});

test('docs/DESIGN.md: la tabla de contraste publicada coincide con la calculada hoy', () => {
  const design = fs.readFileSync(path.join(root, 'docs', 'DESIGN.md'), 'utf8');
  assert.ok(design.includes(contrastMarkdown(themesCss)), 'Regenera la tabla: node tools/contrast.mjs --markdown y pégala en docs/DESIGN.md (sección 7)');
});

// ---------- tokens ----------
test('tokens: 44 px táctil, radios de Sophia y orden de capas', () => {
  const t = Object.fromEntries(decls(read('tokens.css')).filter((d) => d.prop.startsWith('--')).map((d) => [d.prop, d.value]));
  assert.equal(t['--touch-min'], '44px');
  assert.equal(t['--radius-xl'], '30px');
  assert.equal(t['--radius-lg'], '24px');
  assert.equal(t['--radius-md'], '18px');
  assert.equal(t['--glass-blur'], '18px');
  const z = ['--z-base', '--z-raised', '--z-nav', '--z-backdrop', '--z-sheet', '--z-toast'].map((k) => Number(t[k]));
  assert.ok(z.every(Number.isFinite));
  assert.deepEqual([...z].sort((a, b) => a - b), z, 'las capas deben ir de menor a mayor');
  assert.match(t['--font-sans'], /^system-ui/);
  assert.match(t['--safe-bottom'], /env\(safe-area-inset-bottom/);
});

test('tokens: no hay colores en tokens.css', () => {
  for (const d of decls(read('tokens.css'))) assert.doesNotMatch(d.value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, d.prop);
});

// ---------- reglas de los CSS ----------
test('sin colores escritos a mano fuera de themes.css (el tema cambia en vivo)', () => {
  for (const file of CSS_FILES.filter((f) => f !== 'themes.css')) {
    for (const d of decls(read(file))) {
      assert.doesNotMatch(d.value, /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i, `${file}: ${d.selector} { ${d.prop}: ${d.value} }`);
    }
  }
});

test('!important: solo uno, en base.css, para [hidden], y con la justificación escrita', () => {
  const found = [];
  for (const file of CSS_FILES) for (const d of decls(read(file))) if (d.important) found.push(`${file} ${d.selector} ${d.prop}`);
  assert.deepEqual(found, ['base.css [hidden] display']);
  assert.match(read('base.css'), /!important justificado/);
});

test('sin recursos remotos: ni @import, ni fuentes, ni URLs http(s) en CSS ni en la galería', () => {
  for (const file of [...CSS_FILES, 'demo.html', 'demo.js']) {
    const text = read(file);
    assert.doesNotMatch(text, /https?:\/\//i, `${file} contiene una URL remota`);
    assert.doesNotMatch(text, /@import|@font-face/i, `${file} importa o define fuentes`);
  }
});

test('objetivos táctiles: botón, chip, campo y aviso fijan un alto mínimo suficiente', () => {
  const rules = parseCss(read('components.css'));
  const minHeight = (sel) => rules.find((r) => r.selector === sel && !r.at)?.decls.find((d) => d.prop === 'min-height')?.value;
  for (const sel of ['.btn', '.chip', '.toast']) assert.equal(minHeight(sel), 'var(--touch-min)', sel);
  assert.equal(minHeight('.input'), '3rem');
  assert.equal(minHeight('.btn--lg'), '3.5rem');
  const minWidthBtn = rules.find((r) => r.selector === '.btn').decls.find((d) => d.prop === 'min-width')?.value;
  assert.equal(minWidthBtn, 'var(--touch-min)');
});

test('navegación inferior: cada pestaña mide al menos 44 px y usa fondo sólido', () => {
  const rules = parseCss(read('components.css'));
  const item = rules.find((r) => r.selector === '.bottom-nav__item');
  assert.equal(item.decls.find((d) => d.prop === 'min-height').value, 'var(--nav-h)');
  assert.equal(item.decls.find((d) => d.prop === 'min-width').value, 'var(--touch-min)');
  const navHeight = Number(read('tokens.css').match(/--nav-h:\s*([\d.]+)rem/)[1]) * 16;
  assert.ok(navHeight >= 44, `--nav-h = ${navHeight}px`);
  const nav = rules.find((r) => r.selector === '.bottom-nav');
  assert.equal(nav.decls.find((d) => d.prop === 'background').value, 'var(--surface-solid)');
});

test('hover: todo :hover va dentro de @media (hover: hover) (en el móvil no se queda "pegado")', () => {
  for (const file of ['components.css', 'widgets.css', 'base.css']) {
    for (const r of parseCss(read(file))) {
      if (r.selector.includes(':hover')) assert.match(r.at ?? '', /\(hover:\s*hover\)/, `${file}: ${r.selector}`);
    }
  }
});

test('movimiento: los tiempos salen de --dur-* y reducir movimiento los pone en 0', () => {
  const reduced = parseCss(read('base.css')).filter((r) => (r.at ?? '').includes('prefers-reduced-motion: reduce'));
  const zeroed = new Set(reduced.flatMap((r) => r.decls).filter((d) => d.value === '0ms').map((d) => d.prop));
  for (const k of ['--dur-fast', '--dur-base', '--dur-slow']) assert.ok(zeroed.has(k), `falta apagar ${k}`);
  for (const file of ['components.css', 'widgets.css', 'demo.css', 'base.css']) {
    for (const d of decls(read(file)).filter((x) => /^(transition|animation)(-duration)?$/.test(x.prop))) {
      const literal = d.value.replace(/\b0s\b/g, '').match(/\b\d*\.?\d+m?s\b/);
      assert.equal(literal, null, `${file}: ${d.selector} usa un tiempo fijo (${d.value})`);
    }
  }
});

test('todas las variables usadas existen (ningún var(--typo))', () => {
  const defined = new Set();
  for (const file of CSS_FILES) for (const d of decls(read(file))) if (d.prop.startsWith('--')) defined.add(d.prop);
  for (const file of CSS_FILES) {
    for (const d of decls(read(file))) {
      // Con valor de respaldo (var(--x, …)) la variable es un gancho opcional y puede no existir.
      for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        if (m[2] === ',') continue;
        assert.ok(defined.has(m[1]), `${file}: ${d.selector} usa ${m[1]}, que no está definida`);
      }
    }
  }
});

test('hoja inferior y aviso: z-index sale de los tokens, no de números sueltos', () => {
  for (const file of ['components.css', 'widgets.css', 'demo.css']) {
    for (const d of decls(read(file)).filter((x) => x.prop === 'z-index')) assert.match(d.value, /^var\(--z-/, `${file}: ${d.selector}`);
  }
});

// ---------- galería ----------
const demo = read('demo.html');

test('galería: idioma, viewport accesible y los 5 estilos + el script enlazados', () => {
  assert.match(demo, /<html lang="es"/);
  assert.match(demo, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.doesNotMatch(demo, /maximum-scale|user-scalable\s*=\s*no/i);
  for (const f of ['tokens.css', 'themes.css', 'base.css', 'components.css', 'demo.css']) {
    assert.match(demo, new RegExp(`<link rel="stylesheet" href="${f.replace('.', '\\.')}">`));
    assert.ok(fs.existsSync(path.join(stylesDir, f)));
  }
  assert.match(demo, /<script src="demo\.js" defer><\/script>/);
  assert.ok(fs.existsSync(path.join(stylesDir, 'demo.js')));
});

test('galería: compatible con la CSP (sin style="", sin scripts en línea, sin onclick=)', () => {
  assert.doesNotMatch(demo, /\sstyle\s*=/i);
  assert.doesNotMatch(demo, /<style[\s>]/i);
  assert.doesNotMatch(demo, /\son[a-z]+\s*=/i);
  const scripts = [...demo.matchAll(/<script\b([^>]*)>/gi)];
  assert.ok(scripts.length >= 1 && scripts.every((m) => /\bsrc=/.test(m[1])), 'todo <script> debe tener src');
});

test('galería: toda clase usada en el HTML existe en algún CSS (sin erratas)', () => {
  const known = new Set();
  for (const f of CSS_FILES) for (const c of classesInCss(read(f))) known.add(c);
  const used = new Set();
  for (const m of demo.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) used.add(c);
  const missing = [...used].filter((c) => !known.has(c));
  assert.deepEqual(missing, []);
});

test('galería: muestra todo lo que pide el criterio 2 de la subparte', () => {
  const must = [
    ['tipografía', /<h4>/], ['botón primario', /btn btn--primary"/], ['botón secundario', /btn btn--secondary"/],
    ['botón peligro', /btn btn--danger"/], ['botón deshabilitado', /btn btn--primary" disabled/], ['chips', /class="chip"/],
    ['tarjeta de vidrio', /class="card/], ['barra de progreso', /class="progress/],
    ['insignia Nivel N', />Nivel \d</], ['insignia New', />New</], ['insignia Repaso en…', />Repaso en /],
    ['hoja inferior', /class="sheet"/], ['aviso (toast)', /class="toast-stack"/],
    ['tema aurora', /data-theme-btn="aurora"/], ['tema neo', /data-theme-btn="neo"/], ['tema claro', /data-theme-btn="claro"/],
  ];
  for (const [name, re] of must) assert.match(demo, re, `la galería no muestra: ${name}`);
});

test('galería: los botones que solo tienen icono llevan aria-label', () => {
  const buttons = [...demo.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(buttons.length > 10);
  for (const [, attrs, inner] of buttons) {
    if (inner.trim().length <= 2) assert.match(attrs, /aria-label="[^"]+"/, `botón sin nombre accesible: ${inner.trim()}`);
  }
});

test('galería: demo.js es JavaScript válido', () => {
  const r = spawnSync(process.execPath, ['--check', path.join(stylesDir, 'demo.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
