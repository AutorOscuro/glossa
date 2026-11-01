// @purpose: Pruebas del recorrido y las huellas del mapa (tools/repoMapTree.mjs): exclusiones, orden, rutas raras (NFC), tree-hash estable y diffTrees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listFiles, snapshot, hashLines, treeHash, parseHashLines, diffTrees, MAP_FILE, HASHES_FILE } from '../tools/repoMapTree.mjs';

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-tree-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}
const paths = (root, opts) => listFiles(root, opts).map((f) => f.path);
const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });

test('listFiles: excluye .git, node_modules, __pycache__, __MACOSX, .DS_Store, Thumbs.db, desktop.ini, zips y pyc', () => {
  const root = makeRepo({
    'a.js': '1', 'core/b.js': '2', '.gitkeep': '', '.gitignore': 'x', '.nojekyll': 'y',
    '.git/config': 'x', 'node_modules/p/i.js': 'x', 'tools/__pycache__/m.pyc': 'x', '__MACOSX/._a': 'x',
    '.DS_Store': 'x', 'core/.DS_Store': 'x', 'Thumbs.db': 'x', 'Desktop.ini': 'x', 'entrega.zip': 'x', 'sub/OTRO.ZIP': 'x', 'tools/m.PYC': 'x',
  });
  try { assert.deepEqual(paths(root), ['.gitignore', '.gitkeep', '.nojekyll', 'a.js', 'core/b.js']); } finally { cleanup(root); }
});

test('listFiles: excluye el mapa y su archivo de huellas, y solo ellos', () => {
  const root = makeRepo({ [MAP_FILE]: 'm', [HASHES_FILE]: 'h', 'docs/otro.md': 'o' });
  try {
    assert.deepEqual(paths(root), ['docs/otro.md']);
    assert.deepEqual(paths(root, { exclude: ['docs/otro.md'] }), [HASHES_FILE, MAP_FILE]);
  } finally { cleanup(root); }
});

test('listFiles: orden por unidad de código (mayúsculas antes que minúsculas, sin localeCompare)', () => {
  const root = makeRepo({ 'b.js': '', 'B.js': '', 'a.js': '', 'Z/x.js': '', 'a/x.js': '', '_h.mjs': '', 'é.js': '', 'e.js': '' });
  try { assert.deepEqual(paths(root), ['B.js', 'Z/x.js', '_h.mjs', 'a.js', 'a/x.js', 'b.js', 'e.js', 'é.js']); } finally { cleanup(root); }
});

test('listFiles: ignora enlaces simbólicos', (t) => {
  const root = makeRepo({ 'real.js': 'x' });
  try {
    try { fs.symlinkSync(path.join(root, 'real.js'), path.join(root, 'enlace.js')); fs.symlinkSync(root, path.join(root, 'bucle')); } catch (e) { t.skip(`sin enlaces simbólicos: ${e.code}`); return; }
    assert.deepEqual(paths(root), ['real.js']);
  } finally { cleanup(root); }
});

test('listFiles: rutas con espacios, acentos y ñ, y normalización NFC', () => {
  const nfd = 'canción año.txt'.normalize('NFD');
  const root = makeRepo({ 'mi carpeta/hola mundo.md': 'x', [nfd]: 'y', 'ñandú/ü.js': 'z' });
  try {
    const list = paths(root);
    assert.ok(list.includes('mi carpeta/hola mundo.md'));
    assert.ok(list.includes('canción año.txt'.normalize('NFC')));
    assert.ok(list.every((p) => p === p.normalize('NFC')));
    const entry = listFiles(root).find((f) => f.path === 'canción año.txt'.normalize('NFC'));
    assert.equal(fs.readFileSync(entry.abs, 'utf8'), 'y', 'abs conserva la ruta real para poder leer el archivo');
  } finally { cleanup(root); }
});

test('listFiles: error si dos rutas colisionan tras NFC', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-tree-'));
  try {
    fs.writeFileSync(path.join(root, 'é.txt'.normalize('NFC')), 'a');
    fs.writeFileSync(path.join(root, 'é.txt'.normalize('NFD')), 'b');
    if (fs.readdirSync(root).length < 2) { t.skip('el sistema de archivos ya normaliza los nombres'); return; }
    assert.throws(() => listFiles(root), /misma ruta tras normalizar/);
  } finally { cleanup(root); }
});

test('listFiles: error si una ruta contiene un salto de línea', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-tree-'));
  try {
    try { fs.writeFileSync(path.join(root, 'raro\nnombre.txt'), 'x'); } catch (e) { t.skip(`no admite saltos en nombres: ${e.code}`); return; }
    assert.throws(() => listFiles(root), /salto de línea/);
  } finally { cleanup(root); }
});

test('listFiles: carpeta inexistente lanza (el CLI lo convierte en salida 2)', () => {
  assert.throws(() => listFiles(path.join(os.tmpdir(), 'repomap-no-existe-xyz')), /ENOENT/);
});

test('snapshot: sha1 y tamaño correctos; hashLines usa «ruta␠sha1»; treeHash es sha256 de ese texto', () => {
  const root = makeRepo({ 'a.txt': 'abc', 'sub dir/b c.txt': '' });
  try {
    const snap = snapshot(root);
    assert.deepEqual(snap.map((e) => [e.path, e.size, e.sha1]), [['a.txt', 3, 'a9993e364706816aba3e25717850c26c9cd0d89d'], ['sub dir/b c.txt', 0, 'da39a3ee5e6b4b0d3255bfef95601890afd80709']]);
    const text = hashLines(snap);
    assert.equal(text, 'a.txt a9993e364706816aba3e25717850c26c9cd0d89d\nsub dir/b c.txt da39a3ee5e6b4b0d3255bfef95601890afd80709\n');
    assert.match(treeHash(snap), /^[0-9a-f]{64}$/);
    assert.equal(treeHash(snap), treeHash(text));
    assert.equal(treeHash(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  } finally { cleanup(root); }
});

test('tree-hash: estable entre corridas; cambia con un byte, un nombre, un archivo nuevo o uno borrado', () => {
  const root = makeRepo({ 'a.js': 'uno', 'b.js': 'dos' });
  const hash = () => treeHash(snapshot(root));
  try {
    const base = hash();
    assert.equal(hash(), base);
    fs.writeFileSync(path.join(root, 'a.js'), 'unp');
    const byte = hash();
    assert.notEqual(byte, base);
    fs.writeFileSync(path.join(root, 'a.js'), 'uno');
    assert.equal(hash(), base, 'volver al contenido original devuelve el hash original');
    fs.renameSync(path.join(root, 'b.js'), path.join(root, 'c.js'));
    assert.notEqual(hash(), base);
    fs.renameSync(path.join(root, 'c.js'), path.join(root, 'b.js'));
    fs.writeFileSync(path.join(root, 'nuevo.js'), '');
    assert.notEqual(hash(), base);
    fs.rmSync(path.join(root, 'nuevo.js'));
    fs.rmSync(path.join(root, 'b.js'));
    assert.notEqual(hash(), base);
  } finally { cleanup(root); }
});

test('tree-hash: .git, node_modules, zips y .DS_Store no influyen; el mapa y sus huellas tampoco', () => {
  const root = makeRepo({ 'a.js': 'x' });
  try {
    const base = treeHash(snapshot(root));
    for (const [rel, content] of Object.entries({ '.git/HEAD': 'ref', 'node_modules/x/y.js': '1', 'e.zip': 'zz', '.DS_Store': 'q', [MAP_FILE]: 'mapa', [HASHES_FILE]: 'h' })) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    assert.equal(treeHash(snapshot(root)), base);
  } finally { cleanup(root); }
});

test('parseHashLines: corta por el último espacio (rutas con espacios), ignora líneas vacías o dañadas', () => {
  const sha = 'a'.repeat(40);
  const map = parseHashLines(`a b c.txt ${sha}\n\nsin-huella\nmala ${'z'.repeat(40)}\nok.js ${sha}\n`);
  assert.deepEqual([...map], [['a b c.txt', sha], ['ok.js', sha]]);
  assert.equal(parseHashLines('').size, 0);
});

test('parseHashLines recupera exactamente lo que escribió hashLines', () => {
  const root = makeRepo({ 'a b/c d.txt': '1', 'x.js': '2' });
  try {
    const snap = snapshot(root);
    assert.deepEqual([...parseHashLines(hashLines(snap))], snap.map((e) => [e.path, e.sha1]));
  } finally { cleanup(root); }
});

test('diffTrees: creados, modificados y eliminados, ordenados; vacío si no hay cambios', () => {
  const root = makeRepo({ 'a.js': '1', 'b.js': '2', 'c.js': '3' });
  try {
    const saved = parseHashLines(hashLines(snapshot(root)));
    assert.deepEqual(diffTrees(saved, snapshot(root)), { created: [], modified: [], deleted: [] });
    fs.writeFileSync(path.join(root, 'b.js'), 'cambiado');
    fs.rmSync(path.join(root, 'c.js'));
    fs.writeFileSync(path.join(root, 'z.js'), 'n');
    fs.writeFileSync(path.join(root, 'A.js'), 'n');
    assert.deepEqual(diffTrees(saved, snapshot(root)), { created: ['A.js', 'z.js'], modified: ['b.js'], deleted: ['c.js'] });
  } finally { cleanup(root); }
});
