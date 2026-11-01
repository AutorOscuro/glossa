// @purpose: Pruebas de la CLI y del render del mapa (tools/repo-map.mjs) sobre repos temporales: idempotencia, bloques manuales, --check, deriva, casos raros y códigos de salida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseManual, parseHeader, parseArgs, MANUAL_BLOCKS } from '../tools/repo-map.mjs';

const CLI = fileURLToPath(new URL('../tools/repo-map.mjs', import.meta.url));
const J = (...lines) => lines.join('\n');
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function makeRepo(files, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-map-'));
  const all = { ...files };
  if (config) all['tools/repo-map.config.json'] = JSON.stringify(config);
  for (const [rel, content] of Object.entries(all)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}
const run = (root, ...args) => {
  const r = spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const MAP = 'docs/REPO_MAP.md';
const HASHES = 'docs/REPO_MAP.hashes';
const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });
const BASE = {
  'core/a.js': J('// @purpose: módulo A', "import { b } from './b.js';", 'export const A = 1;', 'export function fa(x, y) { return b(x, y); }'),
  'core/b.js': J('// @purpose: módulo B', 'export function b(p, q = 2) { return p + q; }', 'export class K extends Object { constructor(z) { super(); } run() {} }'),
  'README.md': '# hola\n',
};

test('CA-1: npm run map genera mapa y huellas; la segunda corrida no cambia nada (idempotente)', () => {
  const root = makeRepo(BASE);
  try {
    const first = run(root);
    assert.equal(first.code, 0, first.err);
    assert.match(first.out, /Mapa regenerado: 3 archivos/);
    const map1 = read(root, MAP);
    const hashes1 = read(root, HASHES);
    const second = run(root);
    assert.equal(second.code, 0);
    assert.match(second.out, /Mapa sin cambios/);
    assert.equal(read(root, MAP), map1);
    assert.equal(read(root, HASHES), hashes1);
    assert.deepEqual(fs.readdirSync(path.join(root, 'docs')).sort(), ['REPO_MAP.hashes', 'REPO_MAP.md']);
  } finally { cleanup(root); }
});

test('sha256 del archivo de huellas = tree-hash de la cabecera; la cabecera tiene el formato esperado', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    const head = parseHeader(read(root, MAP));
    assert.equal(head.formato, 1);
    assert.equal(head.files, 3);
    assert.equal(sha256(read(root, HASHES)), head.hash);
    assert.match(read(root, MAP).split('\n')[0], /^<!-- repo-map: formato=1 tree-hash=[0-9a-f]{64} archivos=3 -->$/);
  } finally { cleanup(root); }
});

test('CA-5: determinismo: dos repos iguales en carpetas distintas dan el mismo mapa, sin rutas absolutas ni fechas', () => {
  const r1 = makeRepo(BASE);
  const r2 = makeRepo(BASE);
  try {
    run(r1); run(r2);
    const map = read(r1, MAP);
    assert.equal(map, read(r2, MAP));
    assert.ok(!map.includes(r1) && !map.includes(os.tmpdir()), 'sin rutas absolutas');
    assert.ok(!/\b20\d\d-\d\d-\d\d\b/.test(map), 'sin fechas');
  } finally { cleanup(r1); cleanup(r2); }
});

test('el mapa incluye el 100 % de los archivos del repo temporal, con firmas e imports', () => {
  const root = makeRepo({ ...BASE, '.gitkeep': '', '.gitignore': 'x\n', '.nojekyll': 'y\n', 'sub dir/ñandú año.md': 'hola\n', 'datos/x.json': '{"a":1}' });
  try {
    run(root);
    const map = read(root, MAP);
    const listed = [...map.slice(map.indexOf('## Índice de áreas')).matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]).sort();
    assert.deepEqual(listed, ['.gitignore', '.gitkeep', '.nojekyll', 'README.md', 'core/a.js', 'core/b.js', 'datos/x.json', 'sub dir/ñandú año.md']);
    assert.match(map, /`core\/a\.js` · 4 l · @purpose: módulo A · exporta: A = 1; fa\(x, y\) · importa: core\/b\.js/);
    assert.match(map, /`core\/b\.js` · 3 l · @purpose: módulo B · exporta: b\(p, q = 2\); class K extends Object, constructor\(z\) \{run\(\)\}/);
  } finally { cleanup(root); }
});

test('bloques manuales: se crean los 5 en orden y sobreviven a una regeneración, también con el contenido del repo cambiado', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    let map = read(root, MAP);
    const titles = MANUAL_BLOCKS.map((b) => `## ${b.title}`);
    assert.deepEqual(titles.map((t) => map.indexOf(t)).every((i, k, a) => i > 0 && (k === 0 || i > a[k - 1])), true);
    map = map.replace('_Pendiente. Cada tramo', 'TEXTO MANUAL DEL DELTA\n\nSegunda línea con | barra y `código`. Cada tramo');
    fs.writeFileSync(path.join(root, MAP), map);
    fs.writeFileSync(path.join(root, 'core/c.js'), '// @purpose: nuevo\nexport const C = 3;\n');
    assert.equal(run(root).code, 0);
    const after = read(root, MAP);
    assert.match(after, /TEXTO MANUAL DEL DELTA\n\nSegunda línea con \| barra y `código`\. Cada tramo/);
    assert.match(after, /`core\/c\.js`/);
    assert.deepEqual([...parseManual(after).keys()], MANUAL_BLOCKS.map((b) => b.name));
  } finally { cleanup(root); }
});

test('lo que está fuera de los bloques manuales se regenera (una edición a mano allí se pierde)', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    fs.writeFileSync(path.join(root, MAP), read(root, MAP).replace('## Totales', '## Totales EDITADO A MANO'));
    run(root);
    assert.ok(!read(root, MAP).includes('EDITADO A MANO'));
  } finally { cleanup(root); }
});

test('un bloque manual desconocido se conserva bajo «## Manual: nombre» y se avisa', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    fs.writeFileSync(path.join(root, MAP), `${read(root, MAP)}\n<!-- MANUAL:inicio:extra -->\nnota mía\n<!-- MANUAL:fin:extra -->\n`);
    const r = run(root);
    assert.equal(r.code, 0);
    assert.match(r.err, /Bloque manual desconocido «extra»/);
    assert.match(read(root, MAP), /## Manual: extra\n<!-- MANUAL:inicio:extra -->\nnota mía\n<!-- MANUAL:fin:extra -->/);
    const again = read(root, MAP);
    run(root);
    assert.equal(read(root, MAP), again, 'sigue siendo idempotente con el bloque desconocido');
  } finally { cleanup(root); }
});

const BAD_MARKS = [
  ['duplicado', J('<!-- MANUAL:inicio:x -->', 'a', '<!-- MANUAL:fin:x -->', '<!-- MANUAL:inicio:x -->', 'b', '<!-- MANUAL:fin:x -->'), /duplicado/],
  ['anidado', J('<!-- MANUAL:inicio:x -->', '<!-- MANUAL:inicio:y -->', '<!-- MANUAL:fin:y -->', '<!-- MANUAL:fin:x -->'), /anidado/],
  ['sin cerrar', J('<!-- MANUAL:inicio:otro -->', 'texto'), /sin cerrar/],
  ['cierre sin inicio', '<!-- MANUAL:fin:delta -->', /sin inicio/],
  ['cierre de otro nombre', J('<!-- MANUAL:inicio:a -->', '<!-- MANUAL:fin:b -->'), /no corresponde/],
];
for (const [title, body, pattern] of BAD_MARKS) {
  test(`marcas mal formadas (${title}): salida 2 y no se toca ningún archivo`, () => {
    const root = makeRepo(BASE);
    try {
      run(root);
      fs.writeFileSync(path.join(root, MAP), `${read(root, MAP)}\n${body}\n`);
      fs.writeFileSync(path.join(root, 'core/c.js'), '// @purpose: x\nexport const C = 1;\n');
      const before = [read(root, MAP), read(root, HASHES)];
      const r = run(root);
      assert.equal(r.code, 2);
      assert.match(r.err, pattern);
      assert.deepEqual([read(root, MAP), read(root, HASHES)], before);
    } finally { cleanup(root); }
  });
}

test('CA-2: --check imprime OK <hash> (salida 0) cuando todo coincide', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    const r = run(root, '--check');
    assert.equal(r.code, 0);
    assert.match(r.out, /^OK [0-9a-f]{64}\n$/);
    assert.equal(r.out.trim().slice(3), parseHeader(read(root, MAP)).hash);
  } finally { cleanup(root); }
});

test('CA-2: --check detecta y lista un archivo modificado, uno nuevo y uno eliminado (salida 1); npm run map lo corrige', () => {
  const root = makeRepo({ ...BASE, 'docs/otro.md': 'x\n' });
  try {
    run(root);
    fs.appendFileSync(path.join(root, 'README.md'), 'cambio\n');
    fs.writeFileSync(path.join(root, 'nuevo archivo.txt'), 'n\n');
    fs.rmSync(path.join(root, 'docs/otro.md'));
    const r = run(root, '--check');
    assert.equal(r.code, 1);
    assert.equal(r.out, '+ nuevo archivo.txt (creado)\n~ README.md (modificado)\n- docs/otro.md (eliminado)\n');
    assert.match(r.err, /1 creados, 1 modificados, 1 eliminados/);
    assert.equal(run(root).code, 0);
    assert.equal(run(root, '--check').code, 0);
  } finally { cleanup(root); }
});

test('CA-5: deriva a propósito (cambiar un solo byte) y corrección con npm run map', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    const hash0 = parseHeader(read(root, MAP)).hash;
    fs.writeFileSync(path.join(root, 'core/b.js'), read(root, 'core/b.js').replace('p + q', 'p - q'));
    assert.equal(run(root, '--check').code, 1);
    run(root);
    assert.equal(run(root, '--check').code, 0);
    assert.notEqual(parseHeader(read(root, MAP)).hash, hash0);
  } finally { cleanup(root); }
});

test('--check: mapa ausente, cabecera ilegible, huellas ausentes o que no corresponden → salida 1 con aviso', () => {
  const root = makeRepo(BASE);
  try {
    let r = run(root, '--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /No existe el mapa/);
    run(root);
    const good = read(root, MAP);
    fs.writeFileSync(path.join(root, MAP), good.replace('<!-- repo-map: formato=1', '<!-- otra-cosa'));
    r = run(root, '--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /cabecera del mapa es ilegible/);
    fs.writeFileSync(path.join(root, MAP), good);
    fs.appendFileSync(path.join(root, 'README.md'), 'x');
    fs.rmSync(path.join(root, HASHES));
    r = run(root, '--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /falta REPO_MAP\.hashes/);
    fs.writeFileSync(path.join(root, HASHES), 'README.md ' + 'a'.repeat(40) + '\n');
    r = run(root, '--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /no corresponde a la cabecera/);
    assert.equal(run(root).code, 0, 'npm run map repara cualquiera de estos estados');
    assert.equal(run(root, '--check').code, 0);
  } finally { cleanup(root); }
});

test('--check con huellas intactas pero mapa ya coincidente no necesita el archivo de huellas', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    fs.rmSync(path.join(root, HASHES));
    assert.equal(run(root, '--check').code, 0);
  } finally { cleanup(root); }
});

test('--out fuera del repo: las huellas salen de --out (.md → .hashes) y el repo no se escribe', () => {
  const root = makeRepo(BASE);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-out-'));
  try {
    const out = path.join(outDir, 'mapa.md');
    assert.equal(run(root, '--out', out).code, 0);
    assert.deepEqual(fs.readdirSync(outDir).sort(), ['mapa.hashes', 'mapa.md']);
    assert.ok(!fs.existsSync(path.join(root, 'docs')));
    assert.equal(run(root, '--check', '--out', out).code, 0);
    assert.equal(run(root, `--out=${out}`).code, 0);
  } finally { cleanup(root); cleanup(outDir); }
});

test('--out dentro del repo (otro nombre): el mapa y sus huellas no cuentan en el tree-hash', () => {
  const root = makeRepo(BASE);
  try {
    assert.equal(run(root, '--out', path.join(root, 'notas', 'mapa.md')).code, 0);
    const first = read(root, 'notas/mapa.md');
    assert.equal(run(root, '--out', path.join(root, 'notas', 'mapa.md')).code, 0);
    assert.equal(read(root, 'notas/mapa.md'), first);
    assert.match(first, /archivos=3 -->/);
  } finally { cleanup(root); }
});

test('CA-5: archivo de código sin @purpose se marca con ⚠ y se cuenta en Totales; vendor y generados no lo exigen', () => {
  const root = makeRepo({ 'core/sin.js': 'export const S = 1;\n', 'core/con.js': '// @purpose: sí\nexport const C = 1;\n', 'vendor/lib/i.mjs': 'export const V = 1;\n', 'gen.js': 'export const G = 1;\n', 'x.py': 'print(1)\n' },
    { formato: 1, areas: {}, propositos: { 'vendor/lib/i.mjs': 'Librería de terceros' }, generados: ['gen.js'] });
  try {
    run(root);
    const map = read(root, MAP);
    assert.match(map, /`core\/sin\.js` · 1 l · ⚠ sin @purpose · exporta: S = 1/);
    assert.match(map, /`core\/con\.js` · 2 l · @purpose: sí/);
    assert.match(map, /`vendor\/lib\/i\.mjs` · 1 l · propósito: Librería de terceros · exporta: V = 1/);
    assert.match(map, /`gen\.js` · 1 l · generado · exporta: G = 1/);
    assert.match(map, /`x\.py` · 1 l\n/);
    assert.match(map, /- Sin `@purpose` \(obligatorio\): 1\./);
    assert.match(run(root).out, /1 archivos de código sin @purpose/);
  } finally { cleanup(root); }
});

test('JSON inválido, JSON vacío, binario y archivo vacío: cada uno con su marca y sin romper', () => {
  const root = makeRepo({ 'd/malo.json': '{x', 'd/vacio.json': '', 'd/bien.json': '{"a":1,"b":[1]}', 'd/lista.json': '[1,2,3]', 'd/muchas.json': JSON.stringify(Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`k${i}`, i]))),
    'img.bin': Buffer.from([0, 1, 2, 3, 255]), 'vacio.txt': '', 'js/vacio.js': '' });
  try {
    assert.equal(run(root).code, 0);
    const map = read(root, MAP);
    assert.match(map, /`d\/malo\.json` · 2 B · ⚠ JSON inválido/);
    assert.match(map, /`d\/vacio\.json` · 0 B · ⚠ JSON inválido/);
    assert.match(map, /`d\/bien\.json` · 15 B · claves: a, b\n/);
    assert.match(map, /`d\/lista\.json` · 7 B · lista de 3/);
    assert.match(map, /`d\/muchas\.json` · \d+ B · claves: k0, k1, k2, k3, k4, k5, k6, k7, k8, k9, … \(14 en total\)/);
    assert.match(map, /`img\.bin` · 5 B · binario/);
    assert.match(map, /`vacio\.txt` · 0 B · vacío/);
    assert.match(map, /`js\/vacio\.js` · 0 l · ⚠ sin @purpose/);
    assert.match(map, /Con aviso ⚠ \(JSON inválido o sin analizar\): 2\./);
  } finally { cleanup(root); }
});

test('rutas con espacios, acentos y ñ aparecen enteras; una ruta con comilla invertida usa comillas dobles', () => {
  const root = makeRepo({ 'mi carpeta/canción ñandú.js': '// @purpose: raro\nexport const R = 1;\n', 'a`b.txt': 'x\n' });
  try {
    run(root);
    const map = read(root, MAP);
    assert.match(map, /`mi carpeta\/canción ñandú\.js` · 2 l · @purpose: raro/);
    assert.match(map, /`` a`b\.txt `` · 2 B · 1 l/);
    assert.equal(run(root, '--check').code, 0);
  } finally { cleanup(root); }
});

test('reexportaciones: firma real del origen, alias, cadenas, ciclos, destino ausente y export *', () => {
  const root = makeRepo({
    'm/base.js': J('// @purpose: base', 'export function f(a, b) {}', 'export const K = 5;', 'export default function dflt(z) {}'),
    'm/mid.js': J('// @purpose: medio', "export { f, K as KK } from './base.js';", "export { default as D } from './base.js';"),
    'm/top.js': J('// @purpose: cima', "export { f as g } from './mid.js';", "export * from './mid.js';", "export * as ns from './base.js';", "export { x } from './ausente.js';", "export { y } from 'node:fs';"),
    'm/c1.js': "// @purpose: ciclo 1\nexport { z } from './c2.js';\n", 'm/c2.js': "// @purpose: ciclo 2\nexport { z } from './c1.js';\n",
    'm/via-star.js': "// @purpose: por estrella\nexport { f as h } from './top.js';\n",
  });
  try {
    run(root);
    const line = (name) => read(root, MAP).split('\n').find((l) => l.startsWith(`- \`m/${name}\``));
    assert.match(line('mid.js'), /exporta: f\(a, b\) ← m\/base\.js; KK = K = 5 ← m\/base\.js; D = default = dflt\(z\) ← m\/base\.js/);
    assert.match(line('top.js'), /exporta: g = f\(a, b\) ← m\/base\.js; \* ← m\/mid\.js; ns \(\* ← m\/base\.js\); x ← m\/ausente\.js \(no existe\); y ← node:fs/);
    assert.match(line('top.js'), /importa: m\/base\.js, m\/mid\.js, m\/ausente\.js \(no existe\), node:fs/);
    assert.match(line('c1.js'), /exporta: z ← m\/c1\.js \(cadena sin resolver\)/);
    assert.match(line('via-star.js'), /exporta: h = f\(a, b\) ← m\/base\.js/);
  } finally { cleanup(root); }
});

test('una cadena de más de 6 saltos se corta con aviso en la línea, sin colgarse', () => {
  const files = { 'ch/z.js': '// @purpose: fin\nexport function real(a) {}\n' };
  for (let i = 0; i < 9; i += 1) files[`ch/n${i}.js`] = `// @purpose: n\nexport { real } from './${i === 8 ? 'z' : `n${i + 1}`}.js';\n`;
  const root = makeRepo(files);
  try {
    assert.equal(run(root).code, 0);
    const map = read(root, MAP);
    assert.match(map, /`ch\/n0\.js` .*exporta: real ← ch\/n\d\.js \(cadena sin resolver\)/);
    assert.match(map, /`ch\/n5\.js` .*exporta: real\(a\) ← ch\/z\.js/);
  } finally { cleanup(root); }
});

test('imports relativos inexistentes llevan «(no existe)»; html y css listan sus referencias locales', () => {
  const root = makeRepo({
    'app/x.js': "// @purpose: x\nimport { q } from './falta.js';\nimport fs from 'node:fs';\nexport const X = q;\n",
    'index.html': J('<!-- @purpose: página -->', '<!-- <script src="comentado.js"></script> -->', '<link rel="stylesheet" href="ui/s.css"><script type="module" src="/app/x.js"></script>', '<script src="https://cdn.test/x.js"></script><link href="falta.css">'),
    'ui/s.css': '/* @purpose: estilos */\n@import "otro.css";\n@import url(https://f.test/a.css);\n',
    'ui/otro.css': '/* @purpose: otro */\n',
  });
  try {
    run(root);
    const map = read(root, MAP);
    assert.match(map, /`app\/x\.js` .*importa: app\/falta\.js \(no existe\), node:fs/);
    assert.match(map, /`index\.html` · 4 l · @purpose: página · importa: app\/x\.js, ui\/s\.css, falta\.css \(no existe\)/);
    assert.match(map, /`ui\/s\.css` · 3 l · @purpose: estilos · importa: ui\/otro\.css/);
    assert.ok(!map.includes('comentado.js') && !map.includes('cdn.test'));
  } finally { cleanup(root); }
});

test('pruebas: conteo estático y subbloque propio solo para *.test.mjs; los ayudantes quedan en Código', () => {
  const root = makeRepo({ 'tests/a.test.mjs': "// @purpose: t\nimport { test } from 'node:test';\ntest('uno', () => {});\ntest('dos', () => {});\n", 'tests/_h.mjs': '// @purpose: ayudante\nexport const H = 1;\n' });
  try {
    run(root);
    const map = read(root, MAP);
    const area = map.slice(map.indexOf('## Área: tests'));
    assert.ok(area.indexOf('### Código') < area.indexOf('### Pruebas'));
    assert.match(area, /### Pruebas\n\n_«N pruebas» es un conteo estático/);
    assert.match(area, /`tests\/a\.test\.mjs` · 4 l · 2 pruebas · @purpose: t · importa: node:test/);
    assert.match(area, /### Código\n\n- `tests\/_h\.mjs`/);
  } finally { cleanup(root); }
});

test('configuración: propósitos por ruta exacta y por patrón (* y **), gana el primero; avisos de entradas sin archivo', () => {
  const root = makeRepo({ 'icons/a.png': 'x', 'icons/maskable-1.png': 'y', 'deep/er/k.txt': 'k', 'raiz.txt': 'r' },
    { formato: 1, areas: { icons: 'Íconos', fantasma: 'No existe' }, propositos: { 'icons/maskable*': 'Maskable', 'icons/*': 'Ícono', '**/k.txt': 'Profundo', 'no-existe.txt': 'Nadie', 'raiz.txt': 'En la raíz' }, generados: ['tampoco.json'] });
  try {
    const r = run(root);
    assert.equal(r.code, 0);
    const map = read(root, MAP);
    assert.match(map, /`icons\/a\.png` · 1 B · 1 l · propósito: Ícono/);
    assert.match(map, /`icons\/maskable-1\.png` · 1 B · 1 l · propósito: Maskable/);
    assert.match(map, /`deep\/er\/k\.txt` .*propósito: Profundo/);
    assert.match(map, /`raiz\.txt` .*propósito: En la raíz/);
    assert.match(map, /\| icons \| 2 \| 0 \| Íconos \|/);
    assert.match(r.err, /«no-existe\.txt» \(propositos\) no coincide/);
    assert.match(r.err, /«tampoco\.json» \(generados\) no coincide/);
    assert.match(r.err, /el área «fantasma» no tiene archivos/);
    assert.match(r.err, /el área «deep» no tiene descripción/);
  } finally { cleanup(root); }
});

test('descripciones de área con «|» se escapan en la tabla del índice', () => {
  const root = makeRepo({ 'a/x.txt': 'x' }, { formato: 1, areas: { a: 'uno | dos' }, propositos: {}, generados: [] });
  try { run(root); assert.match(read(root, MAP), /\| a \| 1 \| 0 \| uno \\\| dos \|/); } finally { cleanup(root); }
});

test('finales de línea CRLF en el mapa anterior se normalizan; el mapa resultante solo usa \\n', () => {
  const root = makeRepo(BASE);
  try {
    run(root);
    fs.writeFileSync(path.join(root, MAP), read(root, MAP).replace(/\n/g, '\r\n'));
    assert.equal(run(root).code, 0);
    assert.ok(!read(root, MAP).includes('\r'));
  } finally { cleanup(root); }
});

test('el índice pone (raíz) primero y el resto en orden por unidad de código', () => {
  const root = makeRepo({ 'z/a.txt': '1', 'B/a.txt': '1', 'a/a.txt': '1', 'raiz.txt': '1' });
  try {
    run(root);
    assert.deepEqual([...read(root, MAP).matchAll(/^## Área: (.+)$/gm)].map((m) => m[1]), ['(raíz)', 'B', 'a', 'z']);
  } finally { cleanup(root); }
});

test('CA-6 (códigos de salida): 0 correcto, 1 diferencias, 2 uso o entrada/salida', () => {
  const root = makeRepo(BASE);
  try {
    assert.equal(run(root).code, 0);
    assert.equal(run(root, '--check').code, 0);
    fs.appendFileSync(path.join(root, 'README.md'), 'x');
    assert.equal(run(root, '--check').code, 1);
    for (const args of [['--nada'], ['--out'], ['--root']]) {
      const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
      assert.equal(r.status, 2, args.join(' '));
      assert.match(r.stderr, /Uso: node tools\/repo-map\.mjs/);
    }
    assert.equal(spawnSync(process.execPath, [CLI, '--root', path.join(root, 'no-existe')], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' }).status, 0);
  } finally { cleanup(root); }
});

test('configuración inválida → salida 2 y no se escribe nada', () => {
  for (const bad of ['{no es json', '{"formato": 2}', '{"formato": 1, "areas": {"a": 5}}', '{"formato": 1, "generados": "x"}', '[]']) {
    const root = makeRepo({ ...BASE, 'tools/repo-map.config.json': bad });
    try {
      const r = run(root);
      assert.equal(r.code, 2, bad);
      assert.match(r.err, /repo-map\.config\.json/);
      assert.ok(!fs.existsSync(path.join(root, MAP)));
    } finally { cleanup(root); }
  }
});

test('parseArgs: opciones válidas, formas con «=» y errores', () => {
  assert.deepEqual(parseArgs(['--check', '--root', 'a', '--out=b.md']), { check: true, root: 'a', out: 'b.md', help: false });
  assert.deepEqual(parseArgs([]), { check: false, root: null, out: null, help: false });
  assert.throws(() => parseArgs(['--root']), /Falta el valor/);
  assert.throws(() => parseArgs(['--root', '--check']), /Falta el valor/);
  assert.throws(() => parseArgs(['-x']), /Opción desconocida/);
});

test('parseManual: lee bloques y conserva las líneas tal cual; texto sin marcas → ninguno', () => {
  const map = parseManual(J('x', '<!--MANUAL:inicio:a-->', '  línea  con  espacios ', '', '<!-- MANUAL:fin:a -->', 'y'));
  assert.deepEqual([...map], [['a', ['  línea  con  espacios ', '']]]);
  assert.equal(parseManual('nada').size, 0);
  assert.equal(parseManual('').size, 0);
  assert.equal(parseManual('texto `<!-- MANUAL:inicio:a -->` en línea').size, 0, 'una marca dentro de una frase no cuenta');
});
