// Pruebas de tools/audit.mjs: por cada regla, un archivo malo (se detecta) y uno bueno (no se marca).
// Los textos prohibidos se arman con w() para que este archivo no dispare la auditoría del propio repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { audit, MAX_LINES } from '../tools/audit.mjs';
import { makeTempRepo } from './_helpers.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const w = (...p) => p.join('');
const rulesOf = (r) => r.findings.map((f) => f.rule);

function run(files) {
  const t = makeTempRepo(files);
  try { return audit(t.root); } finally { t.cleanup(); }
}

test('repo real: 0 hallazgos', () => {
  const r = audit(REPO);
  assert.deepEqual(r.findings, []);
  assert.ok(r.filesScanned > 10);
});

const BAD = [
  ['EVAL', w('const x = ev', 'al("1+1");\n'), 'const x = JSON.parse("1");\n'],
  ['NEW_FUNCTION', w('const f = new Func', 'tion("return 1");\n'), 'const f = () => 1;\n'],
  ['DOCUMENT_WRITE', w('document.wri', 'te("<b>x</b>");\n'), 'document.title = "x";\n'],
  ['CONSOLE_LOG', w('console.l', 'og("ruido");\n'), 'console.error("fallo real");\n'],
  ['DEBUGGER', w('function f() { debug', 'ger; }\n'), 'function f() { return 1; }\n'],
  ['TODO_SIN_ID', w('// TO', 'DO arreglar esto\n'), w('// TO', 'DO(2.3) arreglar esto\n')],
  ['LOCAL_STORAGE', w('local', 'Storage.setItem("a", "b");\n'), 'const store = new Map();\n'],
  ['HTML_INTERPOLADO', w('el.inner', 'HTML = "<b>" + name + "</b>";\n'), w('el.inner', 'HTML = "";\n')],
];

for (const [rule, bad, good] of BAD) {
  test(`regla ${rule}: detecta el caso malo y deja pasar el bueno`, () => {
    assert.ok(rulesOf(run({ 'app/mod.js': bad })).includes(rule), `no detectó ${rule}`);
    assert.deepEqual(run({ 'app/mod.js': good }).findings, []);
  });
}

test('marcas de pendiente con ID válido (subparte o lote C) pasan; sin ID o con ID raro no', () => {
  assert.deepEqual(run({ 'a.js': w('// FIX', 'ME(1.12) algo\n// TO', 'DO(C3) algo\n') }).findings, []);
  assert.ok(rulesOf(run({ 'a.js': w('// FIX', 'ME(abc) algo\n') })).includes('TODO_SIN_ID'));
  assert.ok(rulesOf(run({ 'a.js': w('// FIX', 'ME\n') })).includes('TODO_SIN_ID'));
});

test('HTML: plantilla con ${} y insertAdjacent con variable se marcan; constantes no', () => {
  const tpl = w('el.inner', 'HTML = `<b>${name}</b>`;\n');
  assert.ok(rulesOf(run({ 'a.js': tpl })).includes('HTML_INTERPOLADO'));
  assert.ok(rulesOf(run({ 'a.js': w('el.insertAdjacent', 'HTML("beforeend", html);\n') })).includes('HTML_INTERPOLADO'));
  assert.ok(rulesOf(run({ 'a.js': w('el.inner', 'HTML += x;\n') })).includes('HTML_INTERPOLADO'));
  assert.deepEqual(run({ 'a.js': w('el.inner', 'HTML = `<b>fijo</b>`;\n') }).findings, []);
  assert.deepEqual(run({ 'a.js': w('el.insertAdjacent', 'HTML("beforeend", "<hr>");\n') }).findings, []);
  assert.deepEqual(run({ 'a.js': 'el.textContent = name;\n' }).findings, []);
});

test('almacenamiento local: la lista blanca no incluye rutas arbitrarias', () => {
  const r = run({ 'ui/prefs.js': w('const v = local', 'Storage.getItem("x");\n') });
  assert.ok(rulesOf(r).includes('LOCAL_STORAGE'));
});

test('claves con forma real se detectan en cualquier archivo (también docs/); texto descriptivo no', () => {
  const keys = [w('gsk', '_', 'a'.repeat(30)), w('sk', '-', 'b'.repeat(30)), w('AI', 'za', 'c'.repeat(35)), w('AK', 'IA', 'D'.repeat(16))];
  for (const k of keys) {
    assert.ok(rulesOf(run({ 'app/config.js': `export const K = '${k}';\n` })).includes('CLAVE'), k.slice(0, 4));
    assert.ok(rulesOf(run({ 'docs/nota.md': `clave: ${k}\n` })).includes('CLAVE'), `docs ${k.slice(0, 4)}`);
  }
  const prose = w('Las claves tipo gsk', '_ y sk', '- se mencionan sin sufijo; también risk-assessment-framework-document.\n');
  assert.deepEqual(run({ 'docs/nota.md': prose }).findings, []);
});

test('docs/ y vendor/ quedan fuera de los patrones de código y del límite de líneas', () => {
  const bad = w('console.l', 'og(1); // TO', 'DO\n');
  assert.deepEqual(run({ 'docs/x.js': bad, 'vendor/lib.js': bad, 'docs/larga.md': 'x\n'.repeat(2000) }).findings, []);
  assert.ok(rulesOf(run({ 'tests/x.js': bad })).includes('CONSOLE_LOG'));
});

test('archivo largo: 800 líneas pasa, 801 no', () => {
  assert.equal(MAX_LINES, 800);
  assert.deepEqual(run({ 'a.js': 'const a = 1;\n'.repeat(800) }).findings, []);
  assert.ok(rulesOf(run({ 'a.js': 'const a = 1;\n'.repeat(801) })).includes('ARCHIVO_LARGO'));
  assert.deepEqual(run({ 'content/packs/enorme.json': `[${'1,'.repeat(5000)}1]` }).findings, []);
});

test('imports: resuelve, detecta archivo faltante y nombre no exportado', () => {
  const ok = run({
    'core/a.js': 'export const x = 1;\nexport function f() {}\nexport default 5;\nexport { y as z };\nconst y = 2;\n',
    'core/b.js': "import d, { x, f, z as w } from './a.js';\nimport * as ns from './a.js';\nimport './a.js';\nexport const q = [d, x, f, w, ns];\n",
  });
  assert.deepEqual(ok.findings, []);
  const multi = run({
    'core/a.js': 'export const x = 1;\nexport const y = 2;\n',
    'core/b.js': "import {\n  x,\n  y,\n} from './a.js';\nexport const q = [x, y];\n",
  });
  assert.deepEqual(multi.findings, []);
  const roto = run({ 'core/b.js': "import { x } from './no-existe.js';\n" });
  assert.ok(rulesOf(roto).includes('IMPORT_ROTO'));
  const sinExt = run({ 'core/a.js': 'export const x = 1;\n', 'core/b.js': "import { x } from './a';\n" });
  assert.ok(rulesOf(sinExt).includes('IMPORT_ROTO'));
  const sinNombre = run({ 'core/a.js': 'export const x = 1;\n', 'core/b.js': "import { nope } from './a.js';\n" });
  const f = sinNombre.findings.find((v) => v.rule === 'IMPORT_SIN_EXPORT');
  assert.ok(f && f.line === 1 && f.message.includes('nope'));
  const dinamico = run({ 'core/b.js': w('const m = await imp', "ort('./falta.js');\n") });
  assert.ok(rulesOf(dinamico).includes('IMPORT_ROTO'));
  const fuera = run({ 'core/b.js': "import { x } from '../../../etc/passwd.js';\n" });
  assert.ok(rulesOf(fuera).includes('IMPORT_ROTO'));
});

test('imports: re-export con "export *" no produce falsos positivos y los bare/URL se ignoran', () => {
  const r = run({
    'core/a.js': 'export const x = 1;\n',
    'core/index.js': "export * from './a.js';\n",
    'core/b.js': "import { x } from './index.js';\nimport fs from 'node:fs';\nimport u from 'https://ejemplo.com/m.js';\nexport const q = [x, fs, u];\n",
    'core/c.js': "// import { fantasma } from './no.js';\nexport const c = 1;\n",
  });
  assert.deepEqual(r.findings, []);
});

test('JSON inválido se detecta con su archivo; JSON válido no', () => {
  assert.ok(rulesOf(run({ 'content/taxonomy/topics.json': '{ "a": ' })).includes('JSON_INVALIDO'));
  assert.deepEqual(run({ 'content/taxonomy/topics.json': '[]' }).findings, []);
  assert.ok(rulesOf(run({ 'manifest.webmanifest': '{nope}' })).includes('JSON_INVALIDO'));
});

test('IDs duplicados en content/: dentro de un paquete y entre paquetes; en tipos distintos no', () => {
  const pack = (items) => JSON.stringify({ schema: 1, pack_id: 'p', items });
  const dupInside = run({ 'content/packs/a.json': pack([{ id: 'g.pp.0001' }, { id: 'g.pp.0001' }]) });
  assert.ok(rulesOf(dupInside).includes('ID_DUPLICADO'));
  const dupAcross = run({
    'content/packs/a.json': pack([{ id: 'g.pp.0001' }]),
    'content/packs/b.json': pack([{ id: 'g.pp.0001' }]),
  });
  assert.ok(rulesOf(dupAcross).includes('ID_DUPLICADO'));
  const topics = run({ 'content/taxonomy/topics.json': JSON.stringify([{ id: 'gram.a' }, { id: 'gram.a' }]) });
  assert.ok(rulesOf(topics).includes('ID_DUPLICADO'));
  const distinct = run({
    'content/packs/a.json': JSON.stringify({ items: [{ id: 'x.1' }], lexicon: [{ id: 'x.1' }] }),
    'content/index.json': JSON.stringify([{ id: 'x.1' }, { id: 'x.1' }]),
  });
  assert.deepEqual(distinct.findings, []);
});

test('entradas inválidas y límites: raíz inexistente, vacía, archivo vacío, texto con ñ/emoji/CRLF', () => {
  for (const bad of ['/no/existe/jamas', '', undefined, null, 7]) {
    const r = audit(bad);
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].rule, 'RAIZ');
  }
  assert.deepEqual(run({ 'a.js': '' }).findings, []);
  assert.deepEqual(run({ 'a.js': "const t = 'Año nuevo 🎉 ñandú';\r\nexport const u = t;\r\n" }).findings, []);
  assert.deepEqual(run({}).findings, []);
});

test('hallazgos con línea exacta y orden estable', () => {
  const r = run({ 'b.js': w('\n\nconsole.l', 'og(1);\n'), 'a.js': w('debug', 'ger;\n') });
  assert.deepEqual(r.findings.map((f) => `${f.file}:${f.line}:${f.rule}`), ['a.js:1:DEBUGGER', 'b.js:3:CONSOLE_LOG']);
});

test('CLI: salida 0 en limpio y 1 en español con archivo:línea cuando hay hallazgos', () => {
  const script = path.join(REPO, 'tools', 'audit.mjs');
  const ok = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /0 hallazgos/);
  const t = makeTempRepo({ 'x.js': w('console.l', 'og(1);\n') });
  try {
    const bad = spawnSync(process.execPath, [script, t.root], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Auditoría: 1 hallazgo/);
    assert.match(bad.stderr, /x\.js:1 {2}\[CONSOLE_LOG\]/);
  } finally { t.cleanup(); }
});
