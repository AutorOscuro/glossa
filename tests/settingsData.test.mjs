// @purpose: Pruebas de las tarjetas Respaldo, Claves y Zona de peligro de Ajustes con DOM falso y base en memoria.
// Pruebas de las tarjetas Respaldo, Claves y Zona de peligro (subparte 0.8, cuarto 3B) con DOM falso, ajustes reales y base en memoria.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createSettings } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';
import { createSync } from '../core/sync.js';
import settingsView from '../ui/views/settings.js';

const SECRET = ['gsk', '_', 'PRUEBA', '8888800000'].join('');
const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const card = (id) => ({ id, itemId: 'i1', due: '2026-10-18T00:00:00.000Z', topics: ['t1'], state: 1 });

async function mk({ noDb = false, picked, services = {} } = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const db = noDb ? null : createMemoryDb({ disk: createMemoryDisk() });
  if (db) await db.open();
  const settings = createSettings({ db });
  await settings.load();
  const toasts = []; const downloads = []; const queue = picked ? [...picked] : [];
  const io = { download: (n, t) => downloads.push({ name: n, text: t }), pickFile: async () => (queue.length ? queue.shift() : null), destroy() {} };
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const view = settingsView();
  await view.mount(root, {}, { version: '9.9.9', storageReady: Promise.resolve({ db }), settings, toast: { show: (k, m) => toasts.push([k, m]) }, fileIO: io, ...services });
  const q = (sel) => root.querySelectorAll(sel);
  const btn = (text) => q('button').find((b) => b.textContent === text);
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  // El diálogo abierto es el último añadido al <body> (el de "Borrar todo" existe desde el principio, oculto).
  const dialogBtn = (text) => env.doc.body.querySelectorAll('button').filter((b) => b.textContent === text).at(-1);
  const isDisabled = (b) => b.hasAttribute('disabled');
  const flush = () => env.flush();
  return { env, db, settings, root, view, toasts, downloads, io, q, btn, click, dialogBtn, isDisabled, flush };
}
// Un respaldo VÁLIDO (la vista previa rechaza lo inválido antes de abrir el diálogo).
async function validBackup() { const db = createMemoryDb({ disk: createMemoryDisk() }); await db.open(); await db.put('cards', card('b1')); return (await createSync({ db }).exportBackup()).json; }
const settle = async (t) => { for (let i = 0; i < 5; i += 1) await t.flush(); };

test('las tarjetas nuevas aparecen con sus botones', async () => {
  const t = await mk();
  for (const label of ['Exportar respaldo', 'Importar respaldo', 'Borrar mis claves', 'Borrar todo']) assert.ok(t.btn(label), label);
  assert.match(t.root.textContent, /No incluye|Incluir mis claves/);
  assert.equal(t.root.querySelectorAll('h2').at(-1).textContent, 'Zona de peligro');
});

test('exportar: baja el archivo SIN la clave por defecto y avisa', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET); await t.settings.set('theme', 'neo'); await t.db.put('cards', card('c1'));
  t.click(t.btn('Exportar respaldo')); await settle(t);
  assert.equal(t.downloads.length, 1);
  assert.match(t.downloads[0].name, /^glossa-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(t.downloads[0].text.includes(SECRET), false);
  assert.equal(t.downloads[0].text.includes('"neo"'), true);
  assert.equal(t.toasts[0][0], 'success'); assert.match(t.toasts[0][1], /No incluye tus claves/);
  assert.equal(t.root.textContent.includes(SECRET), false);
});

test('exportar con la casilla encendida incluye las claves y lo dice', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET);
  const sw = t.q('button').find((b) => b.getAttribute('role') === 'switch' && b.textContent.startsWith('Incluir mis claves'));
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  t.click(sw); await settle(t);
  t.click(t.btn('Exportar respaldo')); await settle(t);
  assert.equal(t.downloads[0].text.includes(SECRET), true);
  assert.match(t.toasts.at(-1)[1], /con tus claves/);
});

test('importar: confirmar reemplaza, conserva la clave del dispositivo y se refleja en los controles', async () => {
  const src = await mk();
  await src.settings.set('theme', 'claro'); await src.db.put('cards', card('c1')); await src.db.put('cards', card('c2'));
  src.click(src.btn('Exportar respaldo')); await settle(src);
  const file = { name: 'mio.json', text: src.downloads[0].text };
  src.view.destroy();
  const t = await mk({ picked: [file] });
  await t.settings.set('aiKey', SECRET);
  t.click(t.btn('Importar respaldo')); await settle(t);
  assert.match(t.env.doc.body.textContent, /«mio\.json»/);
  assert.equal(await t.db.count('cards'), 0, 'nada cambia antes de confirmar');
  t.click(t.dialogBtn('Importar')); await settle(t);
  assert.equal(await t.db.count('cards'), 2);
  assert.equal(t.settings.get('theme'), 'claro');
  assert.equal(t.settings.hasSecret('aiKey'), true);
  const theme = t.q('.segmented').find((g) => g.getAttribute('aria-label') === 'Tema').querySelectorAll('button').find((b) => b.textContent === 'Claro');
  assert.equal(theme.getAttribute('aria-checked'), 'true');
  assert.equal(t.toasts.at(-1)[0], 'success'); assert.match(t.toasts.at(-1)[1], /restaurado/);
});

test('importar: cancelar el selector o la confirmación no cambia nada', async () => {
  const t = await mk({ picked: [null, { name: 'a.json', text: await validBackup() }] });
  await t.db.put('cards', card('c1'));
  t.click(t.btn('Importar respaldo')); await settle(t);
  assert.equal(t.toasts.length, 0);
  t.click(t.btn('Importar respaldo')); await settle(t);
  t.click(t.dialogBtn('Cancelar')); await settle(t);
  assert.equal(await t.db.count('cards'), 1); assert.equal(t.toasts.length, 0);
  assert.equal(t.isDisabled(t.btn('Importar respaldo')), false, 'los botones se liberan');
});

test('importar un archivo inválido avisa con el texto amable y no toca los datos', async () => {
  const t = await mk({ picked: [{ name: 'malo.json', text: 'esto no es un respaldo' }, { name: 'vacio.json', text: '' }] });
  await t.db.put('cards', card('c1'));
  for (let i = 0; i < 2; i += 1) { t.click(t.btn('Importar respaldo')); await settle(t); }
  assert.equal(t.toasts.length, 2);
  assert.equal(t.env.doc.body.querySelectorAll('[role="alertdialog"]').filter((d) => d.textContent.includes('Importar respaldo')).length, 0, 'un archivo inválido nunca abre el diálogo');
  for (const [kind, msg] of t.toasts) { assert.equal(kind, 'danger'); assert.match(msg, /no es válido o está dañado/); }
  assert.equal(await t.db.count('cards'), 1);
  assert.equal(t.isDisabled(t.btn('Importar respaldo')), false);
});

test('borrar claves: deshabilitado sin claves, se habilita al guardar una, pide confirmación y borra', async () => {
  const t = await mk();
  assert.equal(t.isDisabled(t.btn('Borrar mis claves')), true);
  await t.settings.set('aiKey', SECRET); await settle(t);
  assert.equal(t.isDisabled(t.btn('Borrar mis claves')), false);
  t.click(t.btn('Borrar mis claves')); await settle(t);
  t.click(t.dialogBtn('Cancelar')); await settle(t);
  assert.equal(t.settings.hasSecret('aiKey'), true);
  t.click(t.btn('Borrar mis claves')); await settle(t);
  t.click(t.dialogBtn('Borrar claves')); await settle(t);
  assert.equal(t.settings.hasSecret('aiKey'), false);
  assert.equal(t.settings.get('theme'), 'aurora');
  assert.equal(t.isDisabled(t.btn('Borrar mis claves')), true);
  assert.match(t.toasts.at(-1)[1], /Claves borradas/);
});

test('borrar todo: exige escribir BORRAR; confirma, borra y los controles vuelven a lo normal', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET); await t.settings.set('theme', 'neo'); await t.db.put('cards', card('c1'));
  t.click(t.btn('Borrar todo')); await settle(t);
  const confirmBtn = t.dialogBtn('Borrar todo');
  const input = t.env.doc.body.querySelectorAll('input').at(-1);
  assert.equal(t.isDisabled(confirmBtn), true);
  input.value = 'borrar'; input.dispatchEvent({ type: 'input' });
  assert.equal(t.isDisabled(confirmBtn), true, 'las minúsculas no valen');
  input.value = 'BORRAR'; input.dispatchEvent({ type: 'input' });
  assert.equal(t.isDisabled(confirmBtn), false);
  t.click(confirmBtn); await settle(t);
  assert.equal(await t.db.count('cards'), 0);
  assert.equal(t.settings.get('theme'), 'aurora');
  assert.equal(t.settings.hasSecret('aiKey'), false);
  const theme = t.q('.segmented').find((g) => g.getAttribute('aria-label') === 'Tema').querySelectorAll('button').find((b) => b.textContent === 'Aurora');
  assert.equal(theme.getAttribute('aria-checked'), 'true');
  assert.match(t.toasts.at(-1)[1], /Todo borrado/);
  assert.equal(t.isDisabled(t.btn('Borrar todo')), false);
});

test('borrar todo: cancelar no borra nada', async () => {
  const t = await mk();
  await t.db.put('cards', card('c1'));
  t.click(t.btn('Borrar todo')); await settle(t);
  t.click(t.dialogBtn('Cancelar')); await settle(t);
  assert.equal(await t.db.count('cards'), 1); assert.equal(t.toasts.length, 0);
});

test('borrar todo: si falla avisa, no borra nada y deja los botones libres', async () => {
  const failing = { clearKeys: async () => {}, afterRestore: async () => {}, wipeAll: async () => { throw new DbError('QUOTA'); } };
  const t = await mk({ services: { dataTools: failing } });
  await t.db.put('cards', card('c1'));
  t.click(t.btn('Borrar todo')); await settle(t);
  const input = t.env.doc.body.querySelectorAll('input').at(-1); input.value = 'BORRAR'; input.dispatchEvent({ type: 'input' });
  t.click(t.dialogBtn('Borrar todo')); await settle(t);
  assert.equal(t.toasts.at(-1)[0], 'danger'); assert.match(t.toasts.at(-1)[1], /No queda espacio/);
  assert.equal(await t.db.count('cards'), 1);
  assert.equal(t.isDisabled(t.btn('Borrar todo')), false);
});

test('mientras corre un trabajo, los demás botones quedan deshabilitados', async () => {
  const t = await mk({ picked: [{ name: 'a.json', text: await validBackup() }] });
  t.click(t.btn('Importar respaldo')); await settle(t); // el diálogo de confirmación queda abierto
  for (const label of ['Exportar respaldo', 'Importar respaldo', 'Borrar todo']) assert.equal(t.isDisabled(t.btn(label)), true, label);
  t.click(t.dialogBtn('Cancelar')); await settle(t);
  for (const label of ['Exportar respaldo', 'Importar respaldo', 'Borrar todo']) assert.equal(t.isDisabled(t.btn(label)), false, label);
});

test('sin base: Exportar e Importar deshabilitados con aviso; Borrar todo sigue disponible', async () => {
  const t = await mk({ noDb: true });
  assert.equal(t.isDisabled(t.btn('Exportar respaldo')), true);
  assert.equal(t.isDisabled(t.btn('Importar respaldo')), true);
  assert.match(t.root.textContent, /no deja guardar datos/);
  assert.equal(t.isDisabled(t.btn('Borrar todo')), false);
  await t.settings.set('theme', 'neo');
  t.click(t.btn('Borrar todo')); await settle(t);
  const input = t.env.doc.body.querySelectorAll('input').at(-1); input.value = 'BORRAR'; input.dispatchEvent({ type: 'input' });
  t.click(t.dialogBtn('Borrar todo')); await settle(t);
  assert.equal(t.settings.get('theme'), 'aurora');
});

test('la clave nunca aparece en el DOM, la consola ni los avisos durante todo el flujo', async () => {
  const logged = [];
  const orig = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { orig[m] = console[m]; console[m] = (...a) => logged.push(a.map(String).join(' ')); }
  try {
    const t = await mk({ picked: [{ name: 'x.json', text: 'mal' }] });
    await t.settings.set('aiKey', SECRET);
    t.click(t.btn('Exportar respaldo')); await settle(t);
    t.click(t.btn('Importar respaldo')); await settle(t);
    t.click(t.btn('Borrar mis claves')); await settle(t); t.click(t.dialogBtn('Borrar claves')); await settle(t);
    assert.equal(t.env.doc.body.textContent.includes(SECRET), false);
    assert.equal(JSON.stringify(t.toasts).includes(SECRET), false);
  } finally { for (const m of Object.keys(orig)) console[m] = orig[m]; }
  assert.equal(logged.join('\n').includes(SECRET), false);
});

test('destruir cierra diálogos abiertos y no deja listeners', async () => {
  const t = await mk({ picked: [{ name: 'a.json', text: await validBackup() }] });
  t.click(t.btn('Importar respaldo')); await settle(t);
  t.view.destroy(); await settle(t);
  assert.equal(t.env.stats.live(), 0);
  assert.equal(t.env.doc.body.querySelectorAll('[role="alertdialog"]').length, 0);
});

// --- 2.9-T3 punto 3: vista previa y modo al importar; reimportar el contenido tras borrar o importar ---
const radio = (t, label) => t.env.doc.body.querySelectorAll('[role="radio"]').filter((r) => r.textContent === label).at(-1);
const dialogText = (t) => t.env.doc.body.querySelectorAll('[role="alertdialog"]').at(-1)?.textContent ?? '';

test('importar: la vista previa abre en «Fusionar», cambia al elegir «Reemplazar» y no escribe nada hasta confirmar', async () => {
  const t = await mk({ picked: [{ name: 'copia.json', text: await validBackup() }] });
  await t.db.put('cards', card('local1')); await t.db.put('cards', card('local2'));
  t.click(t.btn('Importar respaldo')); await settle(t);
  assert.match(dialogText(t), /copia\.json/);
  assert.match(dialogText(t), /Se añadirá 1 dato nuevo/);
  assert.match(dialogText(t), /No se quita nada/);
  assert.equal(await t.db.count('cards'), 2, 'la vista previa no escribe');
  t.click(radio(t, 'Reemplazar')); await settle(t);
  assert.match(dialogText(t), /Se perderán 2 datos que el archivo no trae/);
  assert.equal(await t.db.count('cards'), 2, 'cambiar de modo tampoco escribe');
  t.click(radio(t, 'Fusionar')); await settle(t);
  assert.match(dialogText(t), /No se quita nada/);
});

test('importar en «Fusionar» conserva lo que ya tienes; en «Reemplazar» lo sustituye', async () => {
  const merge = await mk({ picked: [{ name: 'a.json', text: await validBackup() }] });
  await merge.db.put('cards', card('local1'));
  merge.click(merge.btn('Importar respaldo')); await settle(merge); merge.click(merge.dialogBtn('Importar')); await settle(merge);
  assert.deepEqual((await merge.db.query('cards', {})).map((c) => c.id).sort(), ['b1', 'local1']);
  const rep = await mk({ picked: [{ name: 'a.json', text: await validBackup() }] });
  await rep.db.put('cards', card('local1'));
  rep.click(rep.btn('Importar respaldo')); await settle(rep); rep.click(radio(rep, 'Reemplazar')); await settle(rep); rep.click(rep.dialogBtn('Importar')); await settle(rep);
  assert.deepEqual((await rep.db.query('cards', {})).map((c) => c.id), ['b1']);
});

test('tras importar y tras «Borrar todo» se vuelve a importar el contenido (services.reimportContent)', async () => {
  let calls = 0;
  const t = await mk({ picked: [{ name: 'a.json', text: await validBackup() }], services: { reimportContent: async () => { calls += 1; } } });
  t.click(t.btn('Importar respaldo')); await settle(t); t.click(t.dialogBtn('Importar')); await settle(t);
  assert.equal(calls, 1, 'tras importar');
  t.click(t.btn('Borrar todo')); await settle(t);
  const input = t.env.doc.body.querySelectorAll('input').at(-1); input.value = 'BORRAR'; input.dispatchEvent({ type: 'input' });
  t.click(t.dialogBtn('Borrar todo')); await settle(t);
  assert.equal(calls, 2, 'tras borrar todo');
  assert.equal(await t.db.count('cards'), 0);
});
