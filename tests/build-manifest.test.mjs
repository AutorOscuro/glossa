import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isPrecached, collectFiles, buildAssetManifest, renderSw, serialize, writeBuild, checkBuild, readVersion } from '../tools/build-manifest.mjs';
import { parseCacheVersion } from '../app/versionCompare.js';

const REAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = fs.readFileSync(path.join(REAL, 'sw.js'), 'utf8');

function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-bm-'));
  const all = {
    'core/version.js': "export const VERSION = '1.2.3';\n", 'index.html': '<!doctype html>', 'manifest.webmanifest': '{}', 'sw.js': SW,
    'app/main.js': 'a', 'ui/x.js': 'x', 'ui/styles/base.css': 'b', 'vendor/lib.js': 'v', 'icons/icon-192.png': 'p', 'content/taxonomy/t.json': '{}',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const ruido = {
  'ui/styles/demo.html': 'd', 'ui/styles/demo.css': 'd', 'ui/styles/demo.js': 'd', 'ui/styles/demo-components.js': 'd',
  'content/packs/p.json': '{}', 'audio/a.mp3': 'a', 'docs/README.md': 'm', 'app/NOTAS.md': 'm', 'icons/.gitkeep': '', 'tests/t.mjs': 't', 'tools/x.mjs': 'x',
  'asset-manifest.json': 'viejo', 'node_modules/p/i.js': 'n', 'package.json': '{}', 'tools/make.py': 'p',
};

test('isPrecached: shell sí; packs, audio, pruebas, docs, galería y archivos ocultos no', () => {
  for (const ok of ['index.html', 'manifest.webmanifest', 'app/main.js', 'ui/styles/base.css', 'ui/components/index.js', 'core/version.js', 'icons/icon-192.png', 'vendor/x.js', 'content/taxonomy/a.json']) assert.equal(isPrecached(ok), true, ok);
  for (const no of ['sw.js', 'asset-manifest.json', 'content/packs/a.json', 'audio/a.mp3', 'tests/a.mjs', 'tools/a.mjs', 'docs/a.md', 'app/NOTAS.md', 'icons/.gitkeep', 'ui/styles/demo.html', 'ui/styles/demo-components.js', 'package.json', 'node_modules/x.js']) assert.equal(isPrecached(no), false, no);
});

test('collectFiles incluye lo correcto, ordenado y sin ruido', () => {
  const root = tree(ruido);
  const files = collectFiles(root);
  assert.deepEqual(files, ['app/main.js', 'content/taxonomy/t.json', 'core/version.js', 'icons/icon-192.png', 'index.html', 'manifest.webmanifest', 'ui/styles/base.css', 'ui/x.js', 'vendor/lib.js']);
});

test('es DETERMINISTA: misma entrada → mismos bytes (también en otra carpeta y con otro orden de creación)', () => {
  const a = tree();
  const b = tree(); // otra carpeta temporal, mismo contenido
  assert.equal(serialize(buildAssetManifest(a)), serialize(buildAssetManifest(b)));
  assert.equal(serialize(buildAssetManifest(a)), serialize(buildAssetManifest(a)));
  const w1 = writeBuild(a); const w2 = writeBuild(a);
  assert.deepEqual(w2.changed, [], 'la segunda ejecución no cambia nada');
  assert.equal(fs.readFileSync(path.join(a, 'asset-manifest.json'), 'utf8'), serialize(w1.manifest));
});

test('cambia la caché con: contenido, archivo nuevo, archivo borrado, renombrado y VERSION; NO con archivos ignorados', () => {
  const root = tree();
  const base = buildAssetManifest(root).cacheVersion;
  const change = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); return buildAssetManifest(root).cacheVersion; };
  assert.equal(change('docs/NOTA.md', 'x'), base, 'docs no cuenta');
  assert.equal(change('content/packs/q.json', '{}'), base, 'packs no cuentan');
  assert.equal(change('ui/styles/demo.css', 'zzz'), base, 'galería no cuenta');
  const c1 = change('ui/x.js', 'x2'); assert.notEqual(c1, base);
  const c2 = change('ui/nuevo.js', 'n'); assert.notEqual(c2, c1);
  fs.rmSync(path.join(root, 'ui/nuevo.js'));
  assert.equal(buildAssetManifest(root).cacheVersion, c1, 'borrar el archivo nuevo devuelve la caché anterior');
  fs.renameSync(path.join(root, 'ui/x.js'), path.join(root, 'ui/y.js'));
  assert.notEqual(buildAssetManifest(root).cacheVersion, c1, 'renombrar cambia la caché');
  const v = change('core/version.js', "export const VERSION = '1.2.4';\n");
  assert.match(v, /^sophia-shell-1\.2\.4-[0-9a-f]{8}$/);
});

test('el manifest tiene versión, nombre de caché válido, hashes, tamaños y nada de fechas', () => {
  const m = buildAssetManifest(tree());
  assert.equal(m.schema, 1); assert.equal(m.version, '1.2.3');
  assert.deepEqual(parseCacheVersion(m.cacheVersion)?.version, '1.2.3');
  for (const f of m.files) { assert.match(f.hash, /^[0-9a-f]{16}$/); assert.ok(Number.isInteger(f.size) && f.size >= 0); }
  assert.doesNotMatch(serialize(m), /\d{4}-\d{2}-\d{2}T|timestamp|date/i);
  assert.ok(serialize(m).endsWith('}\n'));
});

test('errores claros: sin VERSION, versión rara, sin index.html, sw.js sin marca o con dos', () => {
  assert.throws(() => buildAssetManifest(tree({ 'core/version.js': 'export const X = 1;' })), /no encuentro VERSION/);
  assert.throws(() => buildAssetManifest(tree({ 'core/version.js': "export const VERSION = 'beta';" })), /versión inválida/);
  assert.throws(() => buildAssetManifest(tree({ 'index.html': null })), /falta index.html/);
  assert.throws(() => renderSw('nada', 'sophia-shell-1.0.0-aaaaaaaa'), /exactamente una línea/);
  assert.throws(() => renderSw(`${SW}\n${SW}`, 'sophia-shell-1.0.0-aaaaaaaa'), /hay 2/);
  const out = renderSw(SW, 'sophia-shell-9.9.9-abcdef01');
  assert.match(out, /const CACHE_VERSION = 'sophia-shell-9\.9\.9-abcdef01'; \/\/ build-manifest:cache-version/);
  assert.equal(out.split('\n').length, SW.split('\n').length, 'solo cambia esa línea');
  assert.equal(readVersion(tree()), '1.2.3');
});

test('checkBuild detecta desactualizado (manifest o sw.js) y writeBuild lo arregla', () => {
  const root = tree();
  assert.equal(checkBuild(root).ok, false);
  writeBuild(root);
  assert.equal(checkBuild(root).ok, true);
  fs.writeFileSync(path.join(root, 'ui/x.js'), 'cambiado');
  const r = checkBuild(root);
  assert.equal(r.ok, false); assert.equal(r.problems.length, 2); assert.match(r.problems[0], /npm run build/);
  writeBuild(root);
  fs.writeFileSync(path.join(root, 'sw.js'), SW); // sw.js con la versión de caché equivocada
  const r2 = checkBuild(root);
  assert.deepEqual(r2.problems.length, 1); assert.match(r2.problems[0], /CACHE_VERSION/);
});

test('CLI: --check sale 0 al día y 1 en español si no; build escribe', () => {
  const run = (...args) => spawnSync(process.execPath, [path.join(REAL, 'tools/build-manifest.mjs'), ...args], { encoding: 'utf8' });
  const ok = run('--check');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /asset-manifest al día/);
});

test('REPO REAL: asset-manifest.json y la CACHE_VERSION de sw.js están al día (si falla: npm run build)', () => {
  const r = checkBuild(REAL);
  assert.deepEqual(r.problems, []);
  const names = r.manifest.files.map((f) => f.path);
  for (const must of ['index.html', 'manifest.webmanifest', 'app/main.js', 'ui/components/index.js', 'ui/styles/widgets.css', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) assert.ok(names.includes(must), must);
  for (const nope of ['sw.js', 'asset-manifest.json', 'ui/styles/demo.html', 'tests/ui-components.test.mjs']) assert.ok(!names.includes(nope), nope);
});
