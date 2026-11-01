// @purpose: Pruebas de las reglas comunes de validación de contenido (core/contentRules.js).
// Pruebas de core/contentRules.js (subparte 1.3, cuarto 1, mitad A): informe con rutas exactas, reglas de texto y especificaciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AREAS, LEVELS, LIMITS, CODE_RE, createReport, joinPath, formatProblem, check,
  text, int, bool, oneOf, idOf, list, obj, custom, optional, nullable, errorCode,
} from '../core/contentRules.js';

// Ejecuta una especificación sobre un valor y devuelve el informe.
const run = (value, spec, ctx) => { const r = createReport(); check(r, '', value, spec, ctx); return r.result(); };
const rules = (res) => res.errors.map((e) => e.rule);
const wrules = (res) => res.warnings.map((e) => e.rule);

test('las constantes del contrato 8.1 son exactamente estas (literales independientes)', () => {
  assert.deepEqual([...AREAS], ['gram', 'vocab', 'verb', 'phr', 'prep', 'read', 'listen', 'speak', 'pron', 'write', 'med', 'spell']);
  assert.deepEqual([...LEVELS], ['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
});

test('joinPath arma rutas como items[12].accept[0]', () => {
  assert.equal(joinPath('', 'items'), 'items');
  assert.equal(joinPath('items', 12), 'items[12]');
  assert.equal(joinPath('items[12]', 'accept'), 'items[12].accept');
  assert.equal(joinPath('items[12].accept', 0), 'items[12].accept[0]');
  assert.equal(joinPath('', 3), '[3]');
});

test('formatProblem: con y sin archivo, y la raíz se nombra', () => {
  const p = { path: 'items[12].accept[0]', rule: 'TEXT_HTML', message: 'no puede llevar HTML' };
  assert.equal(formatProblem(p), 'items[12].accept[0]: no puede llevar HTML');
  assert.equal(formatProblem(p, 'gram_x_v1.json'), 'gram_x_v1.json › items[12].accept[0]: no puede llevar HTML');
  assert.equal(formatProblem({ path: '', rule: 'TYPE', message: 'debe ser un objeto' }, 'a.json'), 'a.json › (raíz): debe ser un objeto');
  assert.equal(formatProblem(null), '');
});

test('el informe cuenta todo pero guarda solo los primeros problemas (y avisa)', () => {
  const r = createReport(3);
  for (let i = 0; i < 10; i++) r.error(`a[${i}]`, 'TYPE', 'mal');
  for (let i = 0; i < 5; i++) r.warn(`b[${i}]`, 'TEXT_SPACES', 'ojo');
  const res = r.result();
  assert.equal(res.ok, false);
  assert.equal(res.errors.length, 3); assert.equal(res.errorTotal, 10);
  assert.equal(res.warnings.length, 3); assert.equal(res.warningTotal, 5);
  assert.equal(createReport().result().ok, true);
});

// ---------- texto ----------
test('texto: una cadena normal pasa sin errores ni avisos', () => {
  const res = run('I have lived here for two years.', text());
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('texto: tipos que no son cadena → TYPE (nunca lanza)', () => {
  for (const v of [5, true, {}, [], () => 1, Symbol('x'), NaN]) assert.deepEqual(rules(run(v, text())), ['TYPE'], String(typeof v));
});

test('texto: null, undefined, vacío y solo espacios', () => {
  assert.deepEqual(rules(run(null, text())), ['TYPE']);
  assert.deepEqual(rules(run(undefined, text())), ['REQUIRED']);
  assert.deepEqual(rules(run('', text())), ['TEXT_EMPTY']);
  assert.deepEqual(rules(run('   ', text())), ['TEXT_EMPTY']);
  assert.equal(run('', text(50, { allowEmpty: true })).ok, true);
});

test('texto: longitud máxima exacta (en el límite pasa, uno más falla) y mensaje con las cifras', () => {
  assert.equal(run('a'.repeat(50), text(50)).ok, true);
  const res = run('a'.repeat(51), text(50));
  assert.deepEqual(rules(res), ['TEXT_TOO_LONG']);
  assert.match(res.errors[0].message, /50/); assert.match(res.errors[0].message, /51/);
});

test('texto: sin HTML (etiquetas y entidades) pero "a < b" y "Tom & Jerry" son texto normal', () => {
  for (const bad of ['<b>hola</b>', 'hi <script>x</script>', 'a </p> b', '<!-- c -->', '<?xml', 'Tom &amp; Jerry', '&#39;', '&#x27;', '&nbsp;']) {
    assert.deepEqual(rules(run(bad, text())), ['TEXT_HTML'], bad);
  }
  for (const ok of ['a < b', '5 > 3', 'Tom & Jerry', 'I <3 you', 'rock & roll; fun']) assert.equal(run(ok, text()).ok, true, ok);
});

test('texto: caracteres de control prohibidos; salto de línea solo si el campo es multilínea', () => {
  for (const bad of ['a\u0000b', 'a\u0007b', 'a\tb', 'a\nb', 'a\rb', 'a\u007Fb', 'a\u0085b']) assert.ok(rules(run(bad, text())).includes('TEXT_CONTROL'), JSON.stringify(bad));
  assert.equal(run('línea 1\nlínea 2', text(100, { multiline: true })).ok, true);
  for (const bad of ['a\tb', 'a\rb', 'a\u0000b']) assert.ok(rules(run(bad, text(100, { multiline: true }))).includes('TEXT_CONTROL'), JSON.stringify(bad));
});

test('texto: caracteres invisibles (ancho cero, guion blando, BOM, direccionales) → TEXT_INVISIBLE', () => {
  for (const c of ['\u200B', '\u200C', '\u200D', '\u200E', '\u200F', '\u202A', '\u202E', '\u2060', '\u00AD', '\uFEFF']) {
    assert.deepEqual(rules(run(`ab${c}cd`, text())), ['TEXT_INVISIBLE'], c.codePointAt(0).toString(16));
  }
});

test('texto: avisos (no errores) por espacios sobrantes y apóstrofos curvos', () => {
  for (const s of [' hola', 'hola ', 'ho  la']) { const res = run(s, text()); assert.equal(res.ok, true); assert.deepEqual(wrules(res), ['TEXT_SPACES'], JSON.stringify(s)); }
  for (const s of ['don’t', 'don‘t', 'donʼt', 'don´t', 'don`t', 'don′t']) { const res = run(s, text()); assert.equal(res.ok, true); assert.deepEqual(wrules(res), ['TEXT_CURLY_APOSTROPHE'], s); }
  assert.deepEqual(run("don't", text()).warnings, []);
  // un texto con aviso y error a la vez informa de los dos
  const both = run('<b> ho  la', text());
  assert.deepEqual(rules(both), ['TEXT_HTML']); assert.deepEqual(wrules(both), ['TEXT_SPACES']);
});

test('texto: emoji, acentos y ñ son válidos; la longitud se mide en unidades de texto, sin lanzar', () => {
  assert.equal(run('¿Qué niño comió piña? 😀', text()).ok, true);
  assert.equal(run('😀'.repeat(10), text(20)).ok, true);
});

// ---------- números, booleanos, enumerados, identificadores ----------
test('int: entero en rango; decimales, NaN, Infinity, texto y booleanos → TYPE; fuera de rango → RANGE', () => {
  const s = int(1, 5);
  for (const v of [1, 3, 5]) assert.equal(run(v, s).ok, true);
  for (const v of [1.5, NaN, Infinity, '3', true, [], -0.5]) assert.deepEqual(rules(run(v, s)), ['TYPE'], String(v));
  for (const v of [0, 6, -1, 1000]) assert.deepEqual(rules(run(v, s)), ['RANGE'], String(v));
  assert.match(run(9, s).errors[0].message, /1/);
});

test('bool y oneOf', () => {
  assert.equal(run(true, bool()).ok, true); assert.equal(run(false, bool()).ok, true);
  for (const v of [0, 1, 'true', null]) assert.ok(!run(v, bool()).ok, String(v));
  const e = oneOf(['active', 'draft']);
  assert.equal(run('draft', e).ok, true);
  const res = run('Draft', e);
  assert.deepEqual(rules(res), ['ENUM']); assert.match(res.errors[0].message, /active, draft/);
  assert.deepEqual(rules(run(3, e)), ['ENUM']);
});

test('idOf: formato y longitud; el mensaje dice qué se esperaba', () => {
  const s = idOf(/^[a-z0-9_.]{1,10}$/, 'un identificador');
  assert.equal(run('ab.c_1', s).ok, true);
  for (const v of ['A.b', 'a b', '', 'a'.repeat(11), 'ñ']) assert.deepEqual(rules(run(v, s)), ['FORMAT'], v);
  assert.deepEqual(rules(run(7, s)), ['TYPE']);
  assert.match(run('A', s).errors[0].message, /un identificador/);
});

test('errorCode: forma MAYÚSCULAS.CÓDIGO; con lista de códigos exige que exista', () => {
  const s = errorCode();
  const all = ['TNS.PP_PS', 'TNS.SINCE_FOR', 'TNS.PERF_FORM', 'VRB.IRREG_REGULARIZE', 'VRB.DOUBLE_PAST', 'VRB.CAN_TO', 'VRB.THIRD_S_OMIT', 'VRB.THIRD_S_EXTRA',
    'Q.WORD_ORDER', 'Q.AUX_OMIT', 'Q.INDIRECT', 'GER.INF_AFTER_PREP', 'GER.AVOID_TO', 'GER.STOP_REMEMBER', 'PREP.DEP', 'NEG.DOUBLE', 'SUBJ.OMIT',
    'CONN.CONTRAST_BECAUSE', 'CONN.DESPITE_OF', 'FUT.WILL_PLAN', 'FUT.WILL_PAST', 'FUT.AUX_MIX', 'ADJ.SUPERLATIVE', 'ADJ.ADV_CONFUSION', 'ADJ.BORED_BORING',
    'ADJ.ORDER', 'ADJ.PLURAL', 'NOUN.COUNT_UNCOUNT', 'NOUN.PLURAL_IRREG', 'CAUS.MAKE_ME_WORKS', 'LEX.FALSE_FRIEND', 'LEX.CALQUE', 'SPELL.GENERAL', 'MECH.CAP_I',
    'MECH.EVERYDAY', 'ART.GEO', 'PRON.-ED', 'PRON.-S', 'PRON.CLUSTER', 'PRON.S_CLUSTER', 'PRON.VOWEL', 'PRON.V_B', 'PRON.TH', 'PRON.FINAL_VOICING', 'PRON.R'];
  assert.equal(all.length, 45);
  // Los 45 códigos del catálogo inicial de 8.8, leídos del roadmap: ninguno puede faltar ni sobrar.
  const road = fs.readFileSync(new URL('../docs/ROADMAP.md', import.meta.url), 'utf8').split('\n').find((l) => l.includes('Catálogo inicial de códigos'));
  assert.deepEqual([...road.matchAll(/`([A-Z][A-Z0-9_]*\.[A-Z0-9_.-]*)`/g)].map((m) => m[1]), all);
  for (const c of all) { assert.ok(CODE_RE.test(c), c); assert.equal(run(c, s).ok, true, c); }
  for (const bad of ['tns.since_for', 'TNS', 'TNS.', '.X', 'TNS SINCE', 'T.X Y', '']) assert.deepEqual(rules(run(bad, s)), ['FORMAT'], bad);
  assert.deepEqual(rules(run(5, s)), ['TYPE']);
  // sin lista: solo la forma; con lista (Set o cualquier objeto con has): debe existir
  assert.equal(run('NOPE.NOPE', s, {}).ok, true);
  const known = new Set(['TNS.SINCE_FOR']);
  assert.equal(run('TNS.SINCE_FOR', s, { errorCodes: known }).ok, true);
  const res = run('TNS.NOPE', s, { errorCodes: known });
  assert.deepEqual(rules(res), ['UNKNOWN_CODE']); assert.match(res.errors[0].message, /TNS\.NOPE/);
  assert.equal(run('X.Y', s, { errorCodes: { has: () => true } }).ok, true);
  assert.equal(run('X.Y', s, { errorCodes: 'no-es-un-set' }).ok, true); // contexto mal formado: se ignora, no lanza
});

// ---------- listas ----------
test('list: tipo, tamaño mínimo/máximo, rutas de cada elemento y duplicados', () => {
  const s = list(text(10), { min: 1, max: 3, unique: true });
  assert.equal(run(['a', 'b'], s).ok, true);
  assert.deepEqual(rules(run('a', s)), ['TYPE']);
  assert.deepEqual(rules(run([], s)), ['LIST_SIZE']);
  assert.deepEqual(rules(run(['a', 'b', 'c', 'd'], s)), ['LIST_SIZE']);
  const dup = run(['a', 'b', 'a'], s);
  assert.deepEqual(rules(dup), ['DUPLICATE']); assert.equal(dup.errors[0].path, '[2]');
  const bad = run(['ok', 5, 'x'.repeat(11)], s);
  assert.deepEqual(bad.errors.map((e) => `${e.path}:${e.rule}`), ['[1]:TYPE', '[2]:TEXT_TOO_LONG']);
  assert.deepEqual(rules(run(new Array(2), s)), ['REQUIRED', 'REQUIRED']); // lista con huecos
});

test('list: una lista enorme no se recorre entera (protección de rendimiento)', () => {
  const res = run(new Array(1e6).fill('x'), list(text(5), { max: 10 }));
  assert.deepEqual(rules(res), ['LIST_SIZE']);
});

// ---------- objetos ----------
test('obj: campos obligatorios, opcionales, anulables y desconocidos, con la ruta exacta', () => {
  const s = obj({ a: text(10), b: optional(int(0, 9)), c: nullable(text(10)) });
  assert.equal(run({ a: 'x' }, s).ok, true);
  assert.equal(run({ a: 'x', b: 3, c: null }, s).ok, true);
  assert.equal(run({ a: 'x', c: 'y' }, s).ok, true);
  assert.deepEqual(run({}, s).errors.map((e) => `${e.path}:${e.rule}`), ['a:REQUIRED']);
  assert.deepEqual(run({ a: 'x', z: 1 }, s).errors.map((e) => `${e.path}:${e.rule}`), ['z:UNKNOWN_FIELD']);
  assert.deepEqual(run({ a: null }, s).errors.map((e) => `${e.path}:${e.rule}`), ['a:TYPE']);
  assert.deepEqual(run({ a: 'x', b: null }, s).errors.map((e) => `${e.path}:${e.rule}`), ['b:TYPE']);
  assert.deepEqual(run({ a: 'x', b: undefined }, s).errors, []); // undefined = ausente
});

test('obj: lo que no es objeto plano → TYPE (arreglos, null, fechas, instancias, cadenas)', () => {
  const s = obj({ a: optional(text(5)) });
  for (const v of [[], null, 'x', 5, new Date(), new Map(), new (class A {})()]) assert.deepEqual(rules(run(v, s)), ['TYPE']);
  assert.equal(run(Object.create(null), s).ok, true);
});

test('obj: rutas anidadas profundas (items[12].accept[0] por composición)', () => {
  const s = obj({ items: list(obj({ accept: list(text(5), { min: 1 }) })) });
  const v = { items: [{ accept: ['ok'] }, { accept: ['ok'] }, { accept: ['ok', 'demasiado largo'] }, { accept: [] }, {}] };
  assert.deepEqual(run(v, s).errors.map((e) => `${e.path}:${e.rule}`), ['items[2].accept[1]:TEXT_TOO_LONG', 'items[3].accept:LIST_SIZE', 'items[4].accept:REQUIRED']);
});

test('obj: entrada hostil (getter que lanza, Proxy, __proto__) se informa y no lanza', () => {
  const s = obj({ a: optional(text(5)) });
  const hostile = { get a() { throw new Error('boom'); } };
  assert.doesNotThrow(() => run(hostile, s));
  const px = new Proxy({}, { ownKeys() { throw new Error('boom'); }, getPrototypeOf() { throw new Error('boom'); } });
  assert.doesNotThrow(() => run(px, s));
  assert.equal(run(px, s).ok, false);
  const proto = JSON.parse('{"__proto__": {"x": 1}, "a": "ok"}');
  assert.deepEqual(run(proto, s).errors.map((e) => `${e.path}:${e.rule}`), ['__proto__:UNKNOWN_FIELD']);
  assert.equal(({}).x, undefined);
});

test('custom: la función recibe el informe, la ruta, el valor y el contexto', () => {
  const calls = [];
  const s = custom((r, path, v, ctx) => { calls.push([path, v, ctx.k]); if (v === 'no') r.error(path, 'CUSTOM', 'no vale'); });
  const r = createReport();
  check(r, 'x.y', 'no', s, { k: 7 });
  assert.deepEqual(calls, [['x.y', 'no', 7]]);
  assert.deepEqual(r.result().errors, [{ path: 'x.y', rule: 'CUSTOM', message: 'no vale' }]);
});

test('check nunca lanza con especificaciones o valores raros', () => {
  assert.doesNotThrow(() => run({ a: 1 }, { kind: 'desconocido' }));
  assert.doesNotThrow(() => run(undefined, undefined));
  assert.equal(LIMITS.maxProblems, 200);
  assert.ok(LIMITS.short < LIMITS.text && LIMITS.text < LIMITS.long);
});

test('fuzz: 1000 valores aleatorios no lanzan nunca con una especificación compuesta', () => {
  const s = obj({ t: text(20), n: optional(int(0, 9)), l: optional(list(oneOf(['a', 'b']), { max: 3 })), o: nullable(obj({ z: optional(bool()) })) });
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pool = [null, undefined, 0, 1, -1, 1.5, NaN, Infinity, '', ' ', 'a', '<b>', '\u0000', '😀', true, false, [], [1], {}, { z: 1 }, { t: 'x' }, Symbol('s'), () => 0];
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  for (let i = 0; i < 1000; i++) {
    const v = rnd() < 0.5 ? pick() : { t: pick(), n: pick(), l: pick(), o: pick(), extra: pick() };
    assert.doesNotThrow(() => run(v, s), String(i));
  }
});

// ---------- casos que las mutaciones mostraron que faltaban ----------
test('idOf: el límite de 100 caracteres rige aunque la expresión regular lo permita', () => {
  const s = idOf(/^[a-z]+$/, 'letras');
  assert.equal(run('a'.repeat(100), s).ok, true);
  assert.deepEqual(rules(run('a'.repeat(101), s)), ['FORMAT']);
});

test('list: solo se revisan los primeros `max` elementos (los demás ni se miran)', () => {
  const res = run(Array.from({ length: 1000 }, () => 'demasiado largo'), list(text(5), { max: 10 }));
  assert.equal(res.errorTotal, 11); // 1 LIST_SIZE + 10 TEXT_TOO_LONG, no 1001
  assert.equal(res.errors[0].rule, 'LIST_SIZE');
});

test('obj: una especificación hecha a mano con nullable (sin optional) también puede faltar', () => {
  const s = obj({ a: { kind: 'text', max: 5, nullable: true } });
  assert.equal(run({}, s).ok, true);
  assert.equal(run({ a: null }, s).ok, true);
  assert.deepEqual(rules(run({ a: 5 }, s)), ['TYPE']);
});
