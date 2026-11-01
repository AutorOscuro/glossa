// @purpose: Pruebas de app/fileIO.js con un documento y una ventana mínimos.
// Pruebas de app/fileIO.js (subparte 0.8, cuarto 3B) con un documento y una ventana mínimos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileIO } from '../app/fileIO.js';

function mkEnv() {
  const log = { appended: [], removed: 0, clicks: 0, revoked: [], created: [], timers: [] };
  const listeners = new Map();
  const mkEl = (tag) => {
    const el = { tag, style: {}, files: null, click() { log.clicks += 1; }, remove() { log.removed += 1; },
      addEventListener(t, f) { listeners.set(`${tag}:${t}`, f); }, removeEventListener(t) { listeners.delete(`${tag}:${t}`); } };
    log.created.push(el);
    return el;
  };
  const doc = { createElement: mkEl, body: { appendChild: (el) => log.appended.push(el) } };
  const win = {
    Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts.type; } },
    URL: { createObjectURL: (b) => { log.blob = b; return 'blob:x'; }, revokeObjectURL: (u) => log.revoked.push(u) },
    setTimeout: (fn, ms) => { log.timers.push([fn, ms]); },
  };
  return { doc, win, log, listeners };
}

test('download crea un enlace temporal con el nombre, lo pulsa, lo quita y suelta la URL después', () => {
  const { doc, win, log } = mkEnv();
  createFileIO({ doc, win }).download('r.json', '{"a":1}');
  const a = log.created[0];
  assert.equal(a.download, 'r.json'); assert.equal(a.href, 'blob:x');
  assert.equal(log.clicks, 1); assert.equal(log.removed, 1);
  assert.deepEqual(log.blob.parts, ['{"a":1}']); assert.equal(log.blob.type, 'application/json');
  assert.deepEqual(log.revoked, []);
  log.timers[0][0]();
  assert.deepEqual(log.revoked, ['blob:x']);
});

test('pickFile devuelve nombre y texto; limpia el selector y sus listeners', async () => {
  const { doc, win, log, listeners } = mkEnv();
  const io = createFileIO({ doc, win });
  const p = io.pickFile();
  const input = log.created[0];
  assert.equal(input.type, 'file'); assert.match(input.accept, /json/); assert.equal(log.clicks, 1);
  input.files = [{ name: 'mi.json', text: async () => 'hola' }];
  await listeners.get('input:change')();
  assert.deepEqual(await p, { name: 'mi.json', text: 'hola' });
  assert.equal(log.removed, 1); assert.equal(listeners.size, 0);
});

test('pickFile: cancelar o no elegir nada devuelve null; un archivo ilegible devuelve texto vacío', async () => {
  const { doc, win, log, listeners } = mkEnv();
  const io = createFileIO({ doc, win });
  let p = io.pickFile(); listeners.get('input:cancel')(); assert.equal(await p, null);
  p = io.pickFile(); log.created.at(-1).files = []; await listeners.get('input:change')(); assert.equal(await p, null);
  p = io.pickFile(); log.created.at(-1).files = [{ name: 'x.json', text: async () => { throw new Error('no'); } }];
  await listeners.get('input:change')(); assert.deepEqual(await p, { name: 'x.json', text: '' });
});

test('pedir otro selector cancela el anterior; destroy suelta el abierto', async () => {
  const { doc, win } = mkEnv();
  const io = createFileIO({ doc, win });
  const first = io.pickFile(); const second = io.pickFile();
  const hung = new Promise((r) => setImmediate(() => r('colgado')));
  assert.equal(await Promise.race([first, hung]), null, 'el selector anterior se cancela al abrir otro');
  const hung2 = new Promise((r) => setImmediate(() => r('colgado')));
  io.destroy(); assert.equal(await Promise.race([second, hung2]), null);
});
