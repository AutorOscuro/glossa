// Pruebas de app/appearance.js y app/settingsBoot.js (subparte 0.8, cuarto 2): tema y tamaño de texto en vivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createSettings } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { resolveTheme, applyTextSize, createAppearance, TEXT_SIZES } from '../app/appearance.js';
import { startSettings } from '../app/settingsBoot.js';

const theme = (env) => env.doc.documentElement.getAttribute('data-theme');
const size = (env) => env.doc.documentElement.getAttribute('data-text-size');
async function memDb(disk = createMemoryDisk()) { const db = createMemoryDb({ disk }); await db.open(); return db; }

// matchMedia con eventos, para simular que el sistema cambia de claro a oscuro.
function systemWin(env, light) {
  const state = { light, handlers: new Set() };
  env.win.matchMedia = (q) => ({
    get matches() { return state.light && q.includes('light'); },
    addEventListener: (t, f) => { if (t === 'change') state.handlers.add(f); },
    removeEventListener: (t, f) => { if (t === 'change') state.handlers.delete(f); },
  });
  state.flip = (next) => { state.light = next; for (const f of [...state.handlers]) f({ type: 'change' }); };
  return state;
}

test('resolveTheme: auto sigue al sistema; un tema concreto manda; basura cae a auto', () => {
  const dark = makeEnv(); const light = makeEnv({ light: true });
  assert.equal(resolveTheme('auto', dark.win), 'aurora');
  assert.equal(resolveTheme('auto', light.win), 'claro');
  assert.equal(resolveTheme('neo', light.win), 'neo');
  assert.equal(resolveTheme('rosa', light.win), 'claro');
  assert.equal(resolveTheme(undefined, dark.win), 'aurora');
});

test('applyTextSize: los 4 tamaños y rechaza uno desconocido', () => {
  const env = makeEnv();
  assert.deepEqual([...TEXT_SIZES], ['small', 'normal', 'large', 'xlarge']);
  for (const s of TEXT_SIZES) { applyTextSize(env.doc, s); assert.equal(size(env), s); }
  assert.throws(() => applyTextSize(env.doc, 'enorme'), /Tamaño de texto desconocido/);
  assert.equal(size(env), 'xlarge', 'un valor malo no cambia nada');
});

test('apariencia: aplica al iniciar y cambia EN VIVO con settings.set', async () => {
  const env = makeEnv();
  const s = createSettings({ db: await memDb() }); await s.load();
  const ap = createAppearance({ doc: env.doc, win: env.win, settings: s });
  ap.apply();
  assert.equal(theme(env), 'aurora'); assert.equal(size(env), 'normal');
  await s.set('theme', 'neo'); assert.equal(theme(env), 'neo');
  await s.set('textSize', 'xlarge'); assert.equal(size(env), 'xlarge');
  await s.set('theme', 'auto'); assert.equal(theme(env), 'aurora');
  await s.set('textSize', 'small'); assert.equal(size(env), 'small');
  await assert.rejects(s.set('textSize', 'enorme'));
  assert.equal(size(env), 'small', 'un valor rechazado no se aplica');
  ap.destroy();
});

test('apariencia: con "auto" sigue al sistema en vivo; con un tema fijo, no', async () => {
  const env = makeEnv(); const sys = systemWin(env, false);
  const s = createSettings(); await s.load();
  const ap = createAppearance({ doc: env.doc, win: env.win, settings: s });
  ap.apply();
  assert.equal(theme(env), 'aurora');
  sys.flip(true); assert.equal(theme(env), 'claro');
  sys.flip(false); assert.equal(theme(env), 'aurora');
  await s.set('theme', 'neo');
  sys.flip(true); assert.equal(theme(env), 'neo', 'tema fijo: el sistema no lo cambia');
  await s.set('theme', 'auto'); assert.equal(theme(env), 'claro');
  ap.destroy();
});

test('apariencia: destroy quita suscripciones y el oyente del sistema; apply después de destroy no hace nada', async () => {
  const env = makeEnv(); const sys = systemWin(env, false);
  const s = createSettings(); await s.load();
  const ap = createAppearance({ doc: env.doc, win: env.win, settings: s });
  ap.apply();
  assert.equal(sys.handlers.size, 1);
  ap.destroy(); ap.destroy();
  assert.equal(sys.handlers.size, 0);
  await s.set('theme', 'claro'); await s.set('textSize', 'large');
  assert.equal(theme(env), 'aurora'); assert.equal(size(env), 'normal');
  ap.apply();
  assert.equal(theme(env), 'aurora');
});

test('apariencia: sin matchMedia con eventos funciona igual; un fallo al pintar se registra y la app sigue', async () => {
  const env = makeEnv(); env.win.matchMedia = undefined;
  const logs = [];
  const s = createSettings(); await s.load();
  const ap = createAppearance({ doc: env.doc, win: env.win, settings: s, log: (...a) => logs.push(a) });
  ap.apply();
  assert.equal(theme(env), 'aurora');
  env.win.getComputedStyle = () => { throw new Error('sin estilos'); };
  await s.set('theme', 'neo');
  assert.equal(logs.length, 1);
  assert.match(String(logs[0][0]), /No se pudo aplicar el tema/);
  assert.throws(() => createAppearance({ doc: env.doc, win: env.win }), /se necesitan doc, win y settings/);
});

test('arranque: lo guardado se aplica al abrir la app otra vez (persiste)', async () => {
  const disk = createMemoryDisk();
  const env1 = makeEnv();
  const r1 = await startSettings({ storageReady: Promise.resolve({ db: await memDb(disk) }), doc: env1.doc, win: env1.win });
  await r1.settings.set('theme', 'claro'); await r1.settings.set('textSize', 'large');
  r1.appearance.destroy();
  const env2 = makeEnv();
  const r2 = await startSettings({ storageReady: Promise.resolve({ db: await memDb(disk) }), doc: env2.doc, win: env2.win });
  assert.equal(theme(env2), 'claro'); assert.equal(size(env2), 'large');
  assert.equal(r2.settings.get('textSize'), 'large');
  r2.appearance.destroy();
});

test('arranque sin base (db null) o con storageReady rechazado: valores por defecto en memoria, sin lanzar', async () => {
  const env = makeEnv(); const logs = [];
  const r = await startSettings({ storageReady: Promise.resolve({ db: null }), doc: env.doc, win: env.win, log: (...a) => logs.push(a) });
  assert.equal(r.settings.persistent(), false);
  assert.equal(theme(env), 'aurora'); assert.equal(size(env), 'normal');
  await r.settings.set('theme', 'neo'); assert.equal(theme(env), 'neo');
  r.appearance.destroy();
  const env2 = makeEnv();
  const r2 = await startSettings({ storageReady: Promise.reject(new Error('no abrió')), doc: env2.doc, win: env2.win, log: (...a) => logs.push(a) });
  assert.equal(r2.settings.persistent(), false);
  assert.equal(logs.length, 1);
  r2.appearance.destroy();
});

test('arranque con base que falla al leer: usa valores por defecto en memoria y lo registra', async () => {
  const env = makeEnv(); const logs = [];
  const badDb = { query: async () => { throw new Error('lectura rota'); } };
  const r = await startSettings({ storageReady: Promise.resolve({ db: badDb }), doc: env.doc, win: env.win, log: (...a) => logs.push(a) });
  assert.equal(r.settings.persistent(), false);
  assert.equal(theme(env), 'aurora');
  assert.match(String(logs[0][0]), /No se pudieron leer los ajustes/);
  r.appearance.destroy();
});

test('un ajuste inválido guardado en disco no rompe el arranque (tema desconocido → auto)', async () => {
  const disk = createMemoryDisk(); const db = await memDb(disk);
  await db.put('settings', { key: 'theme', value: 'rosa' });
  await db.put('settings', { key: 'textSize', value: 'enorme' });
  const env = makeEnv({ light: true });
  const r = await startSettings({ storageReady: Promise.resolve({ db }), doc: env.doc, win: env.win });
  assert.equal(theme(env), 'claro'); assert.equal(size(env), 'normal');
  r.appearance.destroy();
});
