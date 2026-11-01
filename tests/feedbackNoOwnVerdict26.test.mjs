// @purpose: Guardia estática de 2.6-T1: ninguna pantalla de ui/exercises pinta un veredicto con clases propias (*__verdict) fuera del panel común, el CSS no conserva reglas huérfanas de las familias migradas y no se borran las que sí se usan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../ui/exercises/', import.meta.url));

// Devuelve las clases `<algo>__verdict...` que no son del panel (`fb__verdict`).
export const ownVerdicts = (src) => [...String(src).matchAll(/\b([a-z]+)__verdict[\w-]*/g)].map((m) => m[0]).filter((c) => !c.startsWith('fb__verdict'));

test('el detector reconoce un veredicto propio y deja pasar el del panel', () => {
  assert.deepEqual(ownVerdicts("h('p', { class: ['xx__verdict', `xx__verdict--${r}`] })"), ['xx__verdict', 'xx__verdict--']);
  assert.deepEqual(ownVerdicts("class: ['fb__verdict', `fb__verdict--${s}`]"), []);
});

test('ninguna pantalla de ui/exercises tiene clases *__verdict propias', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 15);
  for (const f of files) assert.deepEqual(ownVerdicts(readFileSync(dir + f, 'utf8')), [], f);
});

test('las 8 pantallas con feedback propio usan el panel común', () => {
  for (const f of ['phraseCloze', 'threeForms', 'choice', 'textAnswer', 'clozeBank', 'orderBlocks', 'matchPairs', 'buildPieces']) {
    assert.match(readFileSync(`${dir}${f}.js`, 'utf8'), /^import \{ feedbackNodes \} from '\.\.\/feedbackPanel\.js'/m, f);
  }
});

// ---- Punto 6: limpieza de CSS. Las reglas del veredicto antiguo de cada pantalla ya no tienen quien las use; esta guardia impide que vuelvan y que se borre de más. ----
const uiDir = fileURLToPath(new URL('../ui/', import.meta.url));
const FAMILIES = ['ta', 'ch', 'ob', 'ma', 'cb', 'bp', 'tf', 'pc', 'fb'];

// Clases de las familias migradas que aparecen en los SELECTORES (no en valores ni en comentarios) de un CSS.
export const cssClasses = (css) => {
  const out = new Set();
  const noComments = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/([^{}]+)\{/g)) {
    for (const c of m[1].matchAll(new RegExp(`\\.((?:${FAMILIES.join('|')})__[\\w-]+)`, 'g'))) out.add(c[1]);
  }
  return [...out].sort();
};

const jsFiles = (d) => readdirSync(d).flatMap((n) => {
  const p = d + n;
  if (statSync(p).isDirectory()) return n === 'styles' ? [] : jsFiles(`${p}/`);
  return n.endsWith('.js') ? [p] : [];
});
const readCss = () => ['components.css', 'widgets.css'].map((f) => readFileSync(`${uiDir}styles/${f}`, 'utf8')).join('\n');

test('el detector de clases del CSS lee selectores, no valores ni comentarios', () => {
  assert.deepEqual(cssClasses('.ta__a, .ch__b:not(.ob__c) { color: red; }\n@media (hover: hover) { .bp__d:hover { x: y } }\n/* .ma__e */ .zz__f { } .cb__g { content: ".pc__h"; }'), ['bp__d', 'cb__g', 'ch__b', 'ob__c', 'ta__a']);
});

test('el CSS no define reglas *__verdict propias (solo las del panel, fb__verdict)', () => {
  assert.deepEqual(ownVerdicts(readCss().replace(/\/\*[\s\S]*?\*\//g, '')), []);
});

test('toda clase de las familias migradas que define el CSS la usa alguna pantalla (sin reglas huérfanas)', () => {
  const src = jsFiles(uiDir).map((f) => readFileSync(f, 'utf8')).join('\n');
  // Clases armadas con plantilla (`fb__verdict--${state}`, `tf__form--${verdict}`): vale cualquier clase que empiece por ese prefijo.
  const dynamic = [...src.matchAll(/([a-z]+__[\w-]*)\$\{/g)].map((m) => m[1]);
  assert.ok(dynamic.includes('fb__verdict--') && dynamic.includes('tf__form--'), 'las dos clases de plantilla conocidas');
  const used = (c) => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(src) || dynamic.some((p) => c.startsWith(p));
  const classes = cssClasses(readCss());
  assert.ok(classes.length > 100, `se leyeron ${classes.length} clases`);
  assert.deepEqual(classes.filter((c) => !used(c)), []);
});

test('el CSS conserva las reglas del panel común y las de la solución propia de cada pantalla', () => {
  const have = new Set(cssClasses(readCss()));
  const keep = ['fb__verdict', 'fb__verdict--correct', 'fb__verdict--almost', 'fb__correct', 'fb__explain', 'fb__nuance', 'fb__box-label', 'fb__box-text',
    'ch__correct', 'ob__correct', 'ma__correct', 'cb__correct', 'bp__correct', 'pc__correct'];
  for (const c of keep) assert.ok(have.has(c), `falta la regla .${c}`);
  const src = jsFiles(uiDir).map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const c of keep.filter((k) => k.endsWith('__correct'))) assert.ok(src.includes(c), `ninguna pantalla usa ${c}`);
});
