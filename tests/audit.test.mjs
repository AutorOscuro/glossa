// @purpose: Pruebas de tools/audit.mjs: por cada regla, un archivo malo que se detecta y uno bueno que no se marca.
// Pruebas de tools/audit.mjs: por cada regla, un archivo malo (se detecta) y uno bueno (no se marca).
// Los textos prohibidos se arman con w() para que este archivo no dispare la auditoría del propio repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { audit, MAX_LINES } from '../tools/audit.mjs';
import { makeTempRepo } from './_helpers.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const w = (...p) => p.join('');
const rulesOf = (r) => r.findings.map((f) => f.rule);

function runAll(files) {
  const t = makeTempRepo(files);
  try { return audit(t.root); } finally { t.cleanup(); }
}

// Los archivos de ejemplo de las pruebas de las demás reglas no llevan @purpose: aquí se ignora PURPOSE_FALTA.
// Esa regla tiene sus propias pruebas más abajo, que usan runAll().
function run(files) {
  const r = runAll(files);
  return { ...r, findings: r.findings.filter((f) => f.rule !== 'PURPOSE_FALTA') };
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
  const t = makeTempRepo({ 'x.js': w('// @purpose: ejemplo\nconsole.l', 'og(1);\n') });
  try {
    const bad = spawnSync(process.execPath, [script, t.root], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Auditoría: 1 hallazgo/);
    assert.match(bad.stderr, /x\.js:2 {2}\[CONSOLE_LOG\]/);
  } finally { t.cleanup(); }
});

// ---- Convención @purpose (0.9-T2) ----

const PURPOSE_OK = {
  'a.js': '// @purpose: módulo de ejemplo\nexport const a = 1;\n',
  'b.mjs': '// @purpose: módulo de ejemplo\nexport const b = 1;\n',
  'c.css': '/* @purpose: estilos de ejemplo */\n.c { color: red; }\n',
  'd.html': '<!doctype html>\n<!-- @purpose: página de ejemplo -->\n<p>hola</p>\n',
  'e.cjs': '// @purpose: script de ejemplo\nconst e = 1;\n',
};

test('PURPOSE_FALTA: cada tipo de archivo con su @purpose pasa; sin él se marca, con su ruta y línea 0', () => {
  assert.deepEqual(runAll(PURPOSE_OK).findings, []);
  for (const [file, text] of Object.entries(PURPOSE_OK)) {
    const sin = text.split('\n').filter((l) => !l.includes('@purpose')).join('\n');
    const r = runAll({ [file]: sin });
    assert.deepEqual(r.findings.map((f) => `${f.file}:${f.line}:${f.rule}`), [`${file}:0:PURPOSE_FALTA`], file);
    assert.match(r.findings[0].message, /@purpose/);
  }
  assert.deepEqual(rulesOf(runAll({ 'vacio.js': '' })), ['PURPOSE_FALTA']);
});

test('PURPOSE_FALTA: vale hasta la línea 12; vacío, sin dos puntos o después de la 12 cuenta como falta; CRLF y acentos pasan', () => {
  const at = (n, line) => '// relleno\n'.repeat(n - 1) + line + '\nexport const x = 1;\n';
  assert.deepEqual(runAll({ 'a.js': at(12, '// @purpose: ok') }).findings, []);
  assert.deepEqual(rulesOf(runAll({ 'a.js': at(13, '// @purpose: ok') })), ['PURPOSE_FALTA']);
  assert.deepEqual(rulesOf(runAll({ 'a.js': '// @purpose:    \nexport const x = 1;\n' })), ['PURPOSE_FALTA']);
  assert.deepEqual(rulesOf(runAll({ 'a.js': '// @purpose sin dos puntos\nexport const x = 1;\n' })), ['PURPOSE_FALTA']);
  assert.deepEqual(runAll({ 'a.js': '// @purpose: Año nuevo 🎉 ñandú\r\nexport const x = 1;\r\n' }).findings, []);
});

test('PURPOSE_FALTA: no se exige en vendor/, en lo que no es código ni en los generados de la configuración; docs/ sí (igual que el mapa)', () => {
  const sin = 'export const x = 1;\n';
  assert.deepEqual(runAll({ 'vendor/lib.js': sin, 'content/x.json': '[]', 'docs/nota.md': 'hola\n', 'tools/x.py': 'x = 1\n' }).findings, []);
  assert.deepEqual(rulesOf(runAll({ 'docs/x.js': sin })), ['PURPOSE_FALTA']);
  const gen = JSON.stringify({ generados: ['gen/out.js'] });
  assert.deepEqual(runAll({ 'tools/repo-map.config.json': gen, 'gen/out.js': sin }).findings, []);
  assert.deepEqual(rulesOf(runAll({ 'tools/repo-map.config.json': gen, 'gen/otro.js': sin })), ['PURPOSE_FALTA']);
  for (const bad of ['{nope', '[]', '{"generados":"gen/out.js"}', '{"generados":[7,null]}']) {
    assert.ok(rulesOf(runAll({ 'tools/repo-map.config.json': bad, 'gen/out.js': sin })).includes('PURPOSE_FALTA'), `config rara: ${bad}`);
  }
});

test('PURPOSE_FALTA: marca los mismos archivos que el mapa marca con ⚠ (mismo criterio)', () => {
  const pf = 'export const x = 1;\n';
  const ok = '// @purpose: ejemplo\nexport const x = 1;\n';
  const files = {
    'core/a.js': pf, 'core/b.js': ok, 'ui/x.css': pf.replace('export const x = 1;', '.x { color: red; }'),
    'index.html': '<!doctype html>\n<p>hola</p>\n', 'vendor/v.js': pf, 'docs/n.md': 'hola\n', 'tests/t.test.mjs': pf,
  };
  const t = makeTempRepo(files);
  try {
    const flagged = audit(t.root).findings.filter((f) => f.rule === 'PURPOSE_FALTA').map((f) => f.file).sort();
    const out = path.join(t.root, '..', `mapa-${path.basename(t.root)}.md`);
    const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'repo-map.mjs'), '--root', t.root, '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const map = fs.readFileSync(out, 'utf8');
    fs.rmSync(out, { force: true });
    fs.rmSync(out.replace(/\.md$/, '.hashes'), { force: true });
    const inMap = [...map.matchAll(/^- `([^`]+)` .*⚠ sin @purpose/gm)].map((m) => m[1]).sort();
    assert.deepEqual(flagged, ['core/a.js', 'index.html', 'tests/t.test.mjs', 'ui/x.css']);
    assert.deepEqual(inMap, flagged);
  } finally { t.cleanup(); }
});

test('CA-3 (0.9): todo archivo de código del repo real (salvo vendor/) tiene @purpose, comprobado con un recorrido y una expresión independientes del auditor', () => {
  const skipDirs = new Set(['.git', 'node_modules']);
  const vendor = path.join(REPO, 'vendor');
  const missing = [];
  let seen = 0;
  (function rec(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skipDirs.has(e.name) && full !== vendor) rec(full); continue; }
      if (!/\.(?:js|mjs|cjs|css|html)$/i.test(e.name)) continue;
      seen += 1;
      const head = fs.readFileSync(full, 'utf8').split('\n').slice(0, 12).join('\n');
      if (!/(?:\/\/|\/\*|<!--)\s*@purpose:\s*\S/.test(head)) missing.push(path.relative(REPO, full).split(path.sep).join('/'));
    }
  })(REPO);
  assert.ok(seen > 200, `solo se vieron ${seen} archivos de código`);
  assert.deepEqual(missing, []);
});
