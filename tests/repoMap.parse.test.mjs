// @purpose: Pruebas del analizador del mapa del repositorio (tools/repoMapParse.mjs): formas de export, enmascarado, saltos de línea sin «;», imports, @purpose, pruebas y JSON.
// Las fuentes sintéticas son de una sola línea o se unen con J(): así el auditor no confunde sus «import»/«export» con los reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  shorten, maskSource, parseModule, parseExports, parseImports, extractPurpose, requiresPurpose,
  countTests, lineCount, isBinary, describeJson, resolveSpec,
} from '../tools/repoMapParse.mjs';

const J = (...lines) => lines.join('\n');
const triples = (src) => parseExports(src).map((e) => [e.name, e.kind, e.signature]);
const sigs = (src) => parseExports(src).map((e) => e.signature);

// ───────────── formas de export: nombre, kind y firma ─────────────
const SHAPES = [
  ['función', 'export function a(x, y = 2) { return x; }', [['a', 'function', 'a(x, y = 2)']]],
  ['función async con desestructuración y resto', 'export async function b({ p, q }, ...rest) {}', [['b', 'function', 'async b({ p, q }, ...rest)']]],
  ['función generadora', 'export function* g(n) { yield n; }', [['g', 'function', 'g*(n)']]],
  ['generadora async', 'export async function* ag() {}', [['ag', 'function', 'async ag*()']]],
  ['const flecha', 'export const f = (a, b) => a + b;', [['f', 'function', 'f(a, b)']]],
  ['const flecha con un parámetro sin paréntesis', 'export const f1 = x => x * 2;', [['f1', 'function', 'f1(x)']]],
  ['const async flecha', 'export const af = async (a) => { await a; };', [['af', 'function', 'async af(a)']]],
  ['const con function anónima', 'export const cf = function (a, b) { return a; };', [['cf', 'function', 'cf(a, b)']]],
  ['const con function con nombre', 'export const cn = function named(a) {};', [['cn', 'function', 'cn(a)']]],
  ['const con async function', 'export const caf = async function (a) {};', [['caf', 'function', 'async caf(a)']]],
  ['clase con extends, constructor, estáticos, get/set, campos y privados',
    'export class A extends B { constructor(a, b) { super(); } m() {} static s() {} get g() { return 1; } set g(v) {} #priv() {} field = 1; static sf = 2; async am() {} *gm() {} }',
    [['A', 'class', 'class A extends B, constructor(a, b) {m(), static s(), get g, set g, field, static sf, am(), gm()}']]],
  ['clase vacía', 'export class P {}', [['P', 'class', 'class P']]],
  ['let y var', "export let l = 1; export var v = 'x';", [['l', 'value', 'l = 1'], ['v', 'value', "v = 'x'"]]],
  ['declaraciones múltiples', 'export const a1 = 1, b1 = 2;', [['a1', 'value', 'a1 = 1'], ['b1', 'value', 'b1 = 2']]],
  ['desestructuración de objeto y de lista', 'export const { d1, d2: d3 } = obj; export const [e1, e2] = arr;', [['d1', 'value', 'd1'], ['d3', 'value', 'd3'], ['e1', 'value', 'e1'], ['e2', 'value', 'e2']]],
  ['lista con alias de una declaración local', 'const x = 1; function y() {} export { x, y as z };', [['x', 'value', 'x = 1'], ['z', 'function', 'z()']]],
  ['alias a default', 'const x = 1; export { x as default };', [['default', 'value', 'default = 1']]],
  ['lista con from y alias', "export { a, b as c } from './m.js';", [['a', 'reexport', 'a'], ['c', 'reexport', 'c']]],
  ['export * y export * as', "export * from './s.js'; export * as ns from './t.js';", [['*', 'star', '*'], ['ns', 'namespace', 'ns (* ← ./t.js)']]],
  ['default función con nombre', 'export default function foo(a) {}', [['default', 'function', 'default = foo(a)']]],
  ['default función anónima', 'export default function (a) {}', [['default', 'function', 'default(a)']]],
  ['default clase', 'export default class Foo extends Bar {}', [['default', 'class', 'default = class Foo extends Bar']]],
  ['default flecha', 'export default (a) => a;', [['default', 'function', 'default(a)']]],
  ['default objeto', 'export default { a: 1, b: 2 };', [['default', 'value', 'default = { a, b }']]],
  ['default identificador', 'const q = 1; export default q;', [['default', 'value', 'default = q']]],
  ['default llamada', 'export default createView({ x: 1 });', [['default', 'value', 'default = createView(…)']]],
  ['export { x } declarado ANTES de que exista x (se resuelve al final)', 'export { later }; const later = () => 1; function hoist(a) {} export { hoist };', [['later', 'function', 'later()'], ['hoist', 'function', 'hoist(a)']]],
  ['export { f } antes de la función', 'export { lf }; function lf(a, b) {}', [['lf', 'function', 'lf(a, b)']]],
  ['objeto con claves', 'export const LIMITS = { a: 1, b: 2 };', [['LIMITS', 'value', 'LIMITS = { a, b }']]],
  ['lista literal', "export const REQUIRED = ['x', 'y'];", [['REQUIRED', 'value', 'REQUIRED = […]']]],
  ['llamada', 'export const clock = createClock({ now: 1 });', [['clock', 'value', 'clock = createClock(…)']]],
];
for (const [title, src, expected] of SHAPES) {
  test(`exports: ${title}`, () => assert.deepEqual(triples(src), expected));
}

test('exports: cada export trae la línea donde empieza (desde 1)', () => {
  const src = J('export const a = 1;', '', 'const x = 2;', 'export function b() {}', 'export { x };');
  assert.deepEqual(parseExports(src).map((e) => [e.name, e.line]), [['a', 1], ['b', 4], ['x', 5]]);
});

test('reexportaciones: llevan from e imported (el nombre original), también con default', () => {
  const [a, c, d] = parseExports("export { a, b as c, default as d } from './m.js';").filter((e) => e.name !== 'b');
  assert.deepEqual([a.from, a.imported, c.from, c.imported, d.from, d.imported], ['./m.js', 'a', './m.js', 'b', './m.js', 'default']);
});

test('exports: varias formas juntas conservan el orden del archivo', () => {
  const src = J('export const A = 1;', 'export function b() {}', "export { z } from './z.js';", 'export default class K {}', "export * from './all.js';");
  assert.deepEqual(parseExports(src).map((e) => e.name), ['A', 'b', 'z', 'default', '*']);
});

test('firma larga de parámetros se recorta a una sola línea', () => {
  const params = Array.from({ length: 80 }, (_, i) => `parametro${i}`).join(', ');
  const [e] = parseExports(`export function larga(${params}) {}`);
  assert.ok(e.signature.length < 200 && !e.signature.includes('\n') && e.signature.endsWith('…)'), e.signature);
});

test('parámetros en varias líneas y con comentarios salen en una sola línea limpia', () => {
  const src = J('export function m(', '  a, // primero', '  b = 2 /* segundo */,', ') {}');
  assert.equal(sigs(src)[0], 'm(a, b = 2)');
});

// ───────────── enmascarado: comentarios, cadenas, plantillas y expresiones regulares ─────────────
test('la palabra export dentro de cadenas no cuenta', () => {
  const src = J("const s = 'export const fake = 1'; export const real = 2;", 'const t = "export function nope() {}";');
  assert.deepEqual(sigs(src), ['real = 2']);
});

test('comillas escapadas dentro de una cadena no la cierran', () => {
  assert.deepEqual(sigs("const s = 'it\\'s export const fake = 1'; export const real = 3;"), ['real = 3']);
});

test('la palabra export dentro de comentarios no cuenta', () => {
  const src = J('// export const c1 = 1', '/* export function c2() {} */', 'export const c3 = 3; // export const c4 = 4');
  assert.deepEqual(sigs(src), ['c3 = 3']);
});

test('comentario de bloque en varias líneas', () => {
  assert.deepEqual(sigs(J('/*', ' export const dentro = 1;', ' */', 'export const fuera = 2;')), ['fuera = 2']);
});

test('plantillas con ${} y llaves anidadas (también plantillas dentro de plantillas)', () => {
  const src = J('const t = `export const q = ${ { a: { b: 1 } }.a.b } y ${`dentro ${1 + 1}`} export function z() {}`;', 'export const despues = 1;');
  assert.deepEqual(sigs(src), ['despues = 1']);
});

test('expresión regular con comillas no abre una cadena', () => {
  assert.deepEqual(sigs("const r = /'export'/g; export const r1 = 1;"), ['r1 = 1']);
  assert.deepEqual(sigs('let i = 0; const q = /"/; export const r4 = 4;'), ['r4 = 4']);
});

test('división y ++ no se confunden con una expresión regular', () => {
  assert.deepEqual(sigs('const d = a / b / c; export const r2 = 2;'), ['r2 = 2']);
  assert.deepEqual(sigs('let i = 0; i++ / 2; export const r3 = 3;'), ['r3 = 3']);
  assert.deepEqual(sigs('const x = (a) / 2; const y = /[/]/.test(s); export const r5 = 5;'), ['r5 = 5']);
});

test('una barra dentro de una clase de caracteres de una regex no la termina', () => {
  assert.deepEqual(sigs('const y = x.replace(/[/\\]]+/g, ""); export const ok = 1;'), ['ok = 1']);
});

test('maskSource conserva longitud y saltos de línea; code oculta cadenas y comentarios; clean conserva las cadenas', () => {
  const src = J("const a = 'hola'; // nota secreta", '/* otro', 'comentario */ const b = `tpl ${1}`;');
  const { code, clean } = maskSource(src);
  assert.equal(code.length, src.length);
  assert.equal(clean.length, src.length);
  const nl = (t) => [...t].flatMap((c, i) => (c === '\n' ? [i] : []));
  assert.deepEqual(nl(code), nl(src));
  assert.ok(!code.includes('nota') && !code.includes('comentario') && !code.includes('hola'));
  assert.ok(clean.includes("'hola'") && !clean.includes('nota') && !clean.includes('otro'));
});

// ───────────── declaraciones sin punto y coma (heurística de saltos de línea) ─────────────
test('sin «;»: cada declaración termina donde empieza la siguiente en columna 0', () => {
  const src = J('export const a = 1', 'export function f(x) {', '  return x', '}', 'export const b = {', '  k: 1', '}', 'export const c = 3');
  assert.deepEqual(sigs(src), ['a = 1', 'f(x)', 'b = { k }', 'c = 3']);
});

test('sin «;»: una llamada con argumentos en varias líneas no se corta', () => {
  assert.deepEqual(sigs(J('export const a = foo(', '  1,', '  2', ')', 'export const b = 2')), ['a = foo(…)', 'b = 2']);
});

test('sin «;»: una línea que termina en operador continúa en la siguiente', () => {
  assert.deepEqual(parseExports(J('export const a = 1 +', '  2', 'export const b = 2')).map((e) => e.name), ['a', 'b']);
});

// ───────────── imports ─────────────
test('imports estáticos, de efecto, con alias y de espacio de nombres', () => {
  const src = "import a from './a.js'; import { b as c } from './b.js'; import * as ns from './n.js'; import './side.js';";
  assert.deepEqual(parseImports(src), ['./a.js', './b.js', './n.js', './side.js'].map((spec) => ({ spec, kind: 'static' })));
});

test('import con atributos «with», dinámico, e import.meta (que NO es un import)', () => {
  const src = J("import json from './d.json' with { type: 'json' };", "const m = await import('./_helpers.mjs'); const u = import.meta.url;");
  assert.deepEqual(parseImports(src), [{ spec: './d.json', kind: 'static' }, { spec: './_helpers.mjs', kind: 'dynamic' }]);
});

test('«export … from» cuenta como import de tipo reexport', () => {
  assert.deepEqual(parseImports("export { x } from './x.js'; export * from './y.js';").map((i) => i.kind), ['reexport', 'reexport']);
});

test('imports dentro de cadenas y comentarios no cuentan; los dinámicos sin texto literal tampoco', () => {
  const src = J("const s = \"import x from './fake.js'\";", "// import y from './fake2.js'", 'const n = await import(nombreVariable);');
  assert.deepEqual(parseImports(src), []);
});

test('parseModule devuelve exports e imports a la vez', () => {
  const m = parseModule("import a from './a.js'; export const b = a;");
  assert.deepEqual([m.exports.length, m.imports.length], [1, 1]);
});

// ───────────── entradas vacías, truncadas o sin cerrar: no se cuelgan ni lanzan ─────────────
const BROKEN = ['', '   \n\n  ', 'export function a(x, y', 'export const a = {', 'export class A { m() {', 'const s = "sin cerrar; export const z = 1',
  'export { a, b', 'const t = `abc ${', 'export default', 'export', 'export {', "import { a from './x.js'", '/* sin cerrar export const z = 1;', 'const r = /abc', 'export * as', '}}}}))))]]]]', 'export const = 5;', "export { } from ;"];
for (const src of BROKEN) {
  test(`entrada rota no lanza: ${JSON.stringify(src.slice(0, 30))}`, { timeout: 5000 }, () => {
    assert.doesNotThrow(() => parseModule(src));
    assert.doesNotThrow(() => maskSource(src));
  });
}

test('entradas patológicas largas terminan rápido y sin lanzar', { timeout: 20000 }, () => {
  const big = ['('.repeat(100000), '{'.repeat(100000), '/*'.repeat(50000), 'export function a('.repeat(2000), '`${'.repeat(5000), "'\"`/".repeat(20000), '/['.repeat(30000)];
  const start = Date.now();
  for (const src of big) assert.doesNotThrow(() => parseModule(src));
  assert.ok(Date.now() - start < 10000, `tardó ${Date.now() - start} ms`);
});

test('fuzz sembrado: 300 textos de basura sintáctica no lanzan', { timeout: 20000 }, () => {
  const alphabet = ["'", '"', '`', '/', '\\', '(', ')', '{', '}', '[', ']', '*', '=', ';', ',', ' ', '\n', 'export ', 'function ', 'class ', 'const ', 'async ', 'default ', 'from ', 'import ', '${', '//', '/*', '*/', '=>', 'a', 'b'];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 300; i += 1) {
    let s = '';
    const n = 20 + Math.floor(rnd() * 120);
    for (let k = 0; k < n; k += 1) s += alphabet[Math.floor(rnd() * alphabet.length)];
    assert.doesNotThrow(() => parseModule(s), JSON.stringify(s));
  }
});

test('un módulo real cortado en muchos puntos nunca lanza', { timeout: 20000 }, () => {
  const text = fs.readFileSync(fileURLToPath(new URL('../core/srs.js', import.meta.url)), 'utf8');
  for (let cut = 1; cut < text.length; cut += 97) assert.doesNotThrow(() => parseModule(text.slice(0, cut)), `corte en ${cut}`);
});

// ───────────── @purpose ─────────────
const PURPOSES = [
  ['// @purpose: uno', 'uno'], ['/* @purpose: dos */', 'dos'], ['/**\n * @purpose: tres\n */', 'tres'], ['<!-- @purpose: cuatro -->', 'cuatro'],
  ['# @purpose: cinco', 'cinco'], ['#!/usr/bin/env python3\n"""x"""\n# @purpose: seis', 'seis'], ['// @purpose:   espacios   internos   y   finales   ', 'espacios internos y finales'],
  ['\uFEFF// @purpose: con BOM', 'con BOM'], ['// @purpose: línea con CRLF\r\nconst x = 1;', 'línea con CRLF'],
];
for (const [src, expected] of PURPOSES) test(`extractPurpose: ${JSON.stringify(src.slice(0, 28))}`, () => assert.equal(extractPurpose(src), expected));

test('extractPurpose: null si no hay, si está vacío o si pasa de las primeras 12 líneas', () => {
  assert.equal(extractPurpose('const x = 1;'), null);
  assert.equal(extractPurpose('// @purpose:   '), null);
  assert.equal(extractPurpose(`${'x\n'.repeat(12)}// @purpose: tarde`), null);
  assert.equal(extractPurpose(`${'x\n'.repeat(11)}// @purpose: justo`), 'justo');
  assert.equal(extractPurpose(''), null);
});

test('requiresPurpose: código sí; vendor, generados, datos y Python no', () => {
  for (const f of ['core/a.js', 'tools/x.mjs', 'a.cjs', 'ui/styles/base.css', 'index.html', 'A.JS']) assert.equal(requiresPurpose(f), true, f);
  for (const f of ['vendor/x/y.mjs', 'a.json', 'tools/x.py', 'README.md', 'icons/i.svg', 'app/.gitkeep']) assert.equal(requiresPurpose(f), false, f);
  assert.equal(requiresPurpose('asset-manifest.js', { generados: ['asset-manifest.js'] }), false);
  assert.equal(requiresPurpose('asset-manifest.js', {}), true);
});

// ───────────── conteo de pruebas, líneas, binarios, JSON, rutas ─────────────
test('countTests cuenta test() e it() directos, con skip/todo/only, y no cuenta re.test(x) ni comentarios ni cadenas', () => {
  const src = J("test('a', () => {});", "it('b', () => {});", "describe('g', () => { test('c', () => {}); });", 'if (re.test(x)) {}', "// test('no')",
    "const s = \"test('no')\";", "test.skip('s', () => {});", "mytest('x');", "obj.it('x');", "it.only('o', () => {});", "test.todo('t');");
  assert.equal(countTests(src), 6);
  assert.equal(countTests(''), 0);
});

test('lineCount: líneas de texto, con y sin salto final', () => {
  assert.deepEqual(['', 'a', 'a\n', 'a\nb', '\n', 'a\n\n'].map(lineCount), [0, 1, 1, 2, 1, 2]);
});

test('isBinary: un byte nulo en las primeras posiciones', () => {
  assert.equal(isBinary(Buffer.from([65, 0, 66])), true);
  assert.equal(isBinary(Buffer.from('hola ñandú ✓')), false);
  assert.equal(isBinary(Buffer.alloc(0)), false);
});

test('describeJson: objeto, lista, valor simple, vacío, inválido y con BOM', () => {
  assert.deepEqual(describeJson('{"a":1,"b":2}'), { ok: true, kind: 'object', length: 2, keys: ['a', 'b'] });
  assert.deepEqual(describeJson('[1,2,3]'), { ok: true, kind: 'array', length: 3, keys: [] });
  assert.equal(describeJson('42').kind, 'scalar');
  assert.equal(describeJson('null').kind, 'scalar');
  assert.equal(describeJson('').ok, false);
  assert.equal(describeJson('{x').ok, false);
  assert.deepEqual(describeJson('\uFEFF{"k":1}').keys, ['k']);
});

test('resolveSpec: relativo con y sin extensión, carpeta con index, inexistente y de paquete', () => {
  const files = new Set(['core/b.js', 'ui/x.js', 'core/dir/index.js', 'data/d.json']);
  assert.deepEqual(resolveSpec('core/a.js', './b.js', files), { bare: false, target: 'core/b.js' });
  assert.deepEqual(resolveSpec('core/a.js', '../ui/x', files), { bare: false, target: 'ui/x.js' });
  assert.deepEqual(resolveSpec('core/a.js', './dir', files), { bare: false, target: 'core/dir/index.js' });
  assert.deepEqual(resolveSpec('core/a.js', '../data/d.json', files), { bare: false, target: 'data/d.json' });
  assert.deepEqual(resolveSpec('core/a.js', './nope.js', files), { bare: false, target: 'core/nope.js', missing: true });
  assert.deepEqual(resolveSpec('a.js', 'node:fs', files), { bare: true, target: 'node:fs' });
  assert.deepEqual(resolveSpec('a.js', 'https://x.test/m.js', files), { bare: true, target: 'https://x.test/m.js' });
});

test('shorten: colapsa espacios y recorta con «…»', () => {
  assert.equal(shorten('  a   b\n c ', 10), 'a b c');
  assert.equal(shorten('abcdefghij', 5), 'abcd…');
  assert.equal(shorten('abc', 3), 'abc');
});

// ───────────── casos que cierran huecos detectados por las roturas intencionales (4.R) ─────────────
test('regex vs división: tras «)» una barra es división y no oculta el export siguiente', () => {
  assert.deepEqual(sigs('const x = (a) / 2; export const q = 1; const w = 4 / 2;'), ['q = 1']);
  assert.deepEqual(sigs('const x = arr[0] / 2; export const q2 = 1; const w = 4 / 2;'), ['q2 = 1']);
});

test('regex vs división: tras «++» una barra es división aunque haya otra barra después en la línea', () => {
  assert.deepEqual(sigs('i++ / 2; export const r3 = 3; const z = 4 / 2;'), ['r3 = 3']);
});

test('regex: una barra escapada no termina la expresión (y su comilla no abre una cadena)', () => {
  assert.deepEqual(sigs("const r = /\\/'/; export const e = 1;"), ['e = 1']);
});

test('una cadena sin cerrar termina en el salto de línea: el export de la línea siguiente sigue visible', () => {
  assert.deepEqual(sigs(J("const s = 'sin cerrar", 'export const e = 1;')), ['e = 1']);
  assert.deepEqual(sigs(J('const s = "sin cerrar', 'export const e = 1;')), ['e = 1']);
});

test('llaves o paréntesis de cierre sobrantes no esconden los exports siguientes', () => {
  assert.deepEqual(sigs(J('})', 'export const a = 1;')), ['a = 1']);
  assert.deepEqual(sigs(J('}}}', 'export function f(x) {}')), ['f(x)']);
});

test('sin «;»: un export con sangría de tabulador o de espacios, tras una línea sin «;», también se reconoce', () => {
  assert.deepEqual(sigs(J('foo()', '\texport const b = 2;')), ['b = 2']);
  assert.deepEqual(sigs(J('foo()', '    export const c = 3;')), ['c = 3']);
  assert.deepEqual(sigs('foo() export const d = 4;'), [], 'en la misma línea no es el inicio de una sentencia');
});

test('clase con más de 12 miembros: se muestran 12 y «…»', () => {
  const members = Array.from({ length: 14 }, (_, i) => `m${i}() {}`).join(' ');
  const [e] = parseExports(`export class Grande { ${members} }`);
  assert.match(e.signature, /\{m0\(\), m1\(\), m2\(\), m3\(\), m4\(\), m5\(\), m6\(\), m7\(\), m8\(\), m9\(\), m10\(\), m11\(\), …\}$/);
  assert.ok(!e.signature.includes('m12'));
});

test('resolveSpec: una importación sin extensión puede ser .mjs', () => {
  assert.deepEqual(resolveSpec('tools/a.mjs', './b', new Set(['tools/b.mjs'])), { bare: false, target: 'tools/b.mjs' });
});
