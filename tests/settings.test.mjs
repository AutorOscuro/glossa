// Pruebas de core/settings.js (subparte 0.8, cuarto 1): defaults, rangos, persistencia, secretos, vivo y atomicidad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings, DEFS, SECRET_MASK, SettingsError, validateSetting } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';

const SECRET2 = ['zz', 'CLAVE', 'RARA', '987zz'].join(''); // otra clave de mentira, sin palabras comunes
const SECRET = ['gsk', '_', 'PRUEBA', '1234567890'].join('');
async function mk(disk = createMemoryDisk()) {
  const db = createMemoryDb({ disk }); await db.open();
  const s = createSettings({ db }); await s.load();
  return { db, disk, s };
}

test('valores por defecto razonables (roadmap 0.8) y todos válidos', async () => {
  const { s } = await mk();
  assert.equal(s.get('retention'), 0.9); assert.equal(s.get('leechThreshold'), 8);
  assert.equal(s.get('spellingTolerance'), true); assert.equal(s.get('aiMode'), 'auto');
  assert.equal(s.get('aiKey'), ''); assert.equal(s.get('onboardingDone'), false);
  for (const [k, d] of Object.entries(DEFS)) assert.equal(validateSetting(k, d.default).ok, true, k);
});

test('rangos: retención 0,80–0,95 con bordes; enteros; enums; booleanos; texto', () => {
  const ok = (k, v) => validateSetting(k, v).ok;
  assert.equal(ok('retention', 0.79), false); assert.equal(ok('retention', 0.8), true); assert.equal(ok('retention', 0.95), true); assert.equal(ok('retention', 0.96), false);
  assert.equal(validateSetting('retention', 0.9049).value, 0.9);
  assert.equal(ok('retention', '0.9'), false); assert.equal(ok('retention', NaN), false); assert.equal(ok('retention', Infinity), false);
  assert.equal(ok('leechThreshold', 2), false); assert.equal(ok('leechThreshold', 3), true); assert.equal(ok('leechThreshold', 20), true); assert.equal(ok('leechThreshold', 21), false); assert.equal(ok('leechThreshold', 8.5), false);
  assert.equal(ok('dailyNewCap', 0), true); assert.equal(ok('dailyNewCap', -1), false); assert.equal(ok('dailyNewCap', 51), false);
  assert.equal(ok('dailyReviewCap', 9), false); assert.equal(ok('dailyReviewCap', 500), true); assert.equal(ok('dailyReviewCap', 501), false);
  assert.equal(ok('theme', 'claro'), true); assert.equal(ok('theme', 'rojo'), false); assert.equal(ok('theme', 1), false);
  assert.equal(ok('textSize', 'xlarge'), true); assert.equal(ok('aiMode', 'mechanical'), true); assert.equal(ok('aiMode', 'siempre'), false);
  assert.equal(ok('sounds', 'sí'), false); assert.equal(ok('sounds', false), true); assert.equal(ok('sounds', 0), false);
  assert.equal(validateSetting('userName', '  Willi  ').value, 'Willi'); assert.equal(ok('userName', 'x'.repeat(41)), false); assert.equal(ok('userName', 5), false);
  assert.equal(ok('aiKey', 'k'.repeat(401)), false);
});

test('ajuste desconocido → SettingsError UNKNOWN_SETTING; set/get no aceptan claves raras (ni __proto__)', async () => {
  const { s } = await mk();
  for (const k of ['nada', '__proto__', 'constructor', 5, undefined]) {
    assert.throws(() => s.get(k), (e) => e instanceof SettingsError && e.code === 'UNKNOWN_SETTING' && e.friendly.length > 10);
    await assert.rejects(s.set(k, 1), (e) => e.code === 'UNKNOWN_SETTING');
  }
});

test('set: valida, guarda, devuelve true/false y el valor sobrevive a cerrar y reabrir', async () => {
  const { s, disk } = await mk();
  assert.equal(await s.set('theme', 'neo'), true);
  assert.equal(await s.set('theme', 'neo'), false);
  await assert.rejects(s.set('retention', 0.99), (e) => e instanceof SettingsError && e.code === 'BAD_SETTING' && /entre 0.8 y 0.95/.test(e.friendly));
  assert.equal(s.get('retention'), 0.9);
  await s.set('retention', 0.85); await s.set('userName', ' Willi ');
  const again = createSettings({ db: await (async () => { const d = createMemoryDb({ disk }); await d.open(); return d; })() });
  await again.load();
  assert.equal(again.get('theme'), 'neo'); assert.equal(again.get('retention'), 0.85); assert.equal(again.get('userName'), 'Willi');
});

test('load: valores inválidos o desconocidos en disco no rompen: se usa el defecto y lo desconocido se conserva', async () => {
  const { db } = await mk();
  await db.put('settings', { key: 'retention', value: 5 });
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'ajusteFuturo', value: 'x' });
  const s = createSettings({ db }); const snap = await s.load();
  assert.equal(snap.retention, 0.9); assert.equal(snap.theme, 'neo');
  assert.deepEqual(await db.get('settings', 'ajusteFuturo'), { key: 'ajusteFuturo', value: 'x' });
});

test('vivo: onChange avisa solo cuando cambia ese ajuste; onAnyChange da las claves y un resumen sin secretos; la baja funciona', async () => {
  const { s } = await mk();
  const seen = []; const any = [];
  const off = s.onChange('theme', (v, pv) => seen.push([v, pv]));
  s.onAnyChange((keys, snap) => any.push([keys, snap]));
  await s.set('sounds', false); assert.deepEqual(seen, []);
  await s.set('theme', 'claro'); assert.deepEqual(seen, [['claro', 'auto']]);
  await s.set('aiKey', SECRET);
  assert.deepEqual(any.at(-1)[0], ['aiKey']); assert.equal(any.at(-1)[1].aiKey, SECRET_MASK);
  off(); await s.set('theme', 'neo'); assert.equal(seen.length, 1);
  assert.throws(() => s.onChange('theme', 5), TypeError);
});

test('un suscriptor que falla no impide el guardado ni a los demás', async () => {
  const errs = []; const db = createMemoryDb(); await db.open();
  const s = createSettings({ db, onError: (e) => errs.push(e.message) }); await s.load();
  const ok = []; s.onChange('theme', () => { throw new Error('mal suscriptor'); }); s.onChange('theme', (v) => ok.push(v));
  await s.set('theme', 'neo');
  assert.deepEqual(ok, ['neo']); assert.deepEqual(errs, ['mal suscriptor']); assert.equal((await db.get('settings', 'theme')).value, 'neo');
});

test('setMany es atómico (todo o nada): un valor inválido no cambia ninguno, y un fallo de guardado tampoco', async () => {
  const { s, db } = await mk();
  await assert.rejects(s.setMany({ theme: 'neo', leechThreshold: 99 }), (e) => e.code === 'BAD_SETTING' && /entre 3 y 20/.test(e.message));
  assert.equal(s.get('theme'), 'auto'); assert.equal(await db.get('settings', 'theme'), null);
  assert.deepEqual(await s.setMany({ theme: 'neo', sounds: false }), ['theme', 'sounds']);
  db.setWriteHook(() => { throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); });
  await assert.rejects(s.setMany({ theme: 'claro', vibration: false }), (e) => e instanceof DbError && e.code === 'QUOTA');
  db.setWriteHook(null);
  assert.equal(s.get('theme'), 'neo'); assert.equal(s.get('vibration'), true);
  assert.equal((await db.get('settings', 'theme')).value, 'neo');
  await assert.rejects(s.setMany(null), (e) => e.code === 'BAD_SETTING'); await assert.rejects(s.setMany([1]), (e) => e.code === 'BAD_SETTING');
});

test('secretos: se guardan con secret:true, el respaldo normal no los trae, el vacío borra el registro, y snapshot los oculta', async () => {
  const { s, db } = await mk();
  await s.set('aiKey', SECRET); await s.set('azureKey', ' otra-clave-123 '); await s.set('theme', 'neo');
  assert.deepEqual(await db.get('settings', 'aiKey'), { key: 'aiKey', value: SECRET, secret: true });
  assert.equal(s.get('azureKey'), 'otra-clave-123');
  const plain = JSON.stringify(await db.exportAll());
  assert.equal(plain.includes(SECRET), false); assert.equal(plain.includes('otra-clave'), false); assert.equal(plain.includes('"theme"'), true);
  assert.equal(JSON.stringify(await db.exportAll({ includeSecrets: true })).includes(SECRET), true);
  assert.equal(JSON.stringify(s.snapshot()).includes(SECRET), false); assert.equal(s.snapshot().aiKey, SECRET_MASK);
  assert.equal(s.hasSecret('aiKey'), true); assert.throws(() => s.hasSecret('theme'), SettingsError);
  await s.set('aiKey', '   '); assert.equal(s.get('aiKey'), ''); assert.equal(await db.get('settings', 'aiKey'), null); assert.equal(s.snapshot().aiKey, '');
  assert.equal(s.describe('aiKey').default, '');
});

test('clearSecrets borra TODAS las claves (memoria y disco) y no toca lo demás; resetAll no toca los secretos', async () => {
  const { s, db } = await mk();
  await s.set('aiKey', SECRET); await s.set('azureKey', 'abc'); await s.set('theme', 'neo'); await s.set('retention', 0.82);
  assert.deepEqual(await s.resetAll(), ['theme', 'retention']);
  assert.equal(s.get('aiKey'), SECRET);
  assert.deepEqual(await s.clearSecrets(), ['aiKey', 'azureKey']);
  assert.equal(await db.get('settings', 'aiKey'), null); assert.equal(await db.get('settings', 'azureKey'), null);
  assert.equal(s.get('aiKey'), ''); assert.equal(s.get('theme'), 'auto');
  assert.deepEqual(await s.clearSecrets(), []);
  await s.set('retention', 0.82); assert.equal(await s.reset('retention'), true); assert.equal(s.get('retention'), 0.9);
});

test('la clave nunca sale en mensajes de error ni en la consola, ni siquiera cuando algo falla', async () => {
  const logs = []; const orig = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { orig[m] = console[m]; console[m] = (...a) => logs.push(a.map(String).join(' ')); }
  const msgs = [];
  try {
    const { s, db } = await mk();
    await s.set('aiKey', SECRET);
    await s.setMany({ aiKey: SECRET + 'x', theme: 'neo' });
    s.onChange('aiKey', () => { throw new Error('falla de suscriptor'); });
    await s.set('aiKey', SECRET + 'y');
    try { await s.set('aiKey', SECRET.repeat(50)); } catch (e) { msgs.push(e.message, e.friendly, JSON.stringify(e)); }
    try { await s.setMany({ aiKey: SECRET, retention: 7 }); } catch (e) { msgs.push(e.message, e.friendly); }
    db.setWriteHook(() => { throw new Error('disco roto'); });
    try { await s.set('aiKey', SECRET2); } catch (e) { msgs.push(e.message, e.friendly); }
    db.setWriteHook(null);
    s.snapshot(); s.describe('aiKey');
  } finally { for (const m of Object.keys(orig)) console[m] = orig[m]; }
  const all = [...logs, ...msgs].join('\n');
  assert.equal(all.includes('PRUEBA'), false); assert.equal(all.includes('CLAVERARA'), false);
  assert.ok(msgs.length >= 5, 'las rutas de error se ejercitaron');
});

test('sin base (no abrió): los ajustes funcionan solo en memoria', async () => {
  const s = createSettings(); await s.load();
  assert.equal(s.persistent(), false);
  await s.set('theme', 'claro'); await s.set('aiKey', 'abc'); assert.equal(s.get('theme'), 'claro');
  await s.clearSecrets(); assert.equal(s.get('aiKey'), '');
});

test('describe y keys: lista completa y sin dejar mutar las definiciones', () => {
  const s = createSettings();
  assert.equal(s.keys().length, Object.keys(DEFS).length);
  assert.equal(s.describe('retention').min, 0.8);
  assert.throws(() => { DEFS.theme.default = 'x'; }, TypeError);
  assert.throws(() => { DEFS.theme.choices.push('x'); }, TypeError);
  assert.equal(DEFS.theme.default, 'auto');
});

test('clearSecrets también borra del disco una clave inválida que en memoria ya vale vacío', async () => {
  const { db } = await mk();
  await db.put('settings', { key: 'aiKey', value: 'k'.repeat(500), secret: true }); // demasiado larga: load la ignora
  const s = createSettings({ db }); await s.load();
  assert.equal(s.get('aiKey'), '');
  assert.deepEqual(await s.clearSecrets(), []);
  assert.equal(await db.get('settings', 'aiKey'), null);
});
