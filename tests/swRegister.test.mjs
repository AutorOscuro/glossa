// Pruebas de app/swRegister.js y ui/components/updateNotice.js (subparte 0.6, mitad B) con navegador y service worker FALSOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swPolicy, registerServiceWorker, CHECK_EVERY_MS } from '../app/swRegister.js';
import { createUpdateNotice } from '../ui/components/updateNotice.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'sophia-shell-0.5.0-aaaaaaaa';
const NEW_VERSION = 'sophia-shell-0.6.0-bbbbbbbb';
const NEW_CONTENT = 'sophia-shell-0.5.0-cccccccc';
const OLDER = 'sophia-shell-0.4.0-dddddddd';

function target() {
  const l = new Map();
  return {
    addEventListener(t, f) { if (!l.has(t)) l.set(t, new Set()); l.get(t).add(f); },
    removeEventListener(t, f) { l.get(t)?.delete(f); },
    emit(t, e = {}) { for (const f of [...(l.get(t) ?? [])]) f({ type: t, ...e }); },
    count: () => [...l.values()].reduce((n, s) => n + s.size, 0),
  };
}

// Un "worker" falso: responde GET_VERSION con su versión de caché y anota todo lo que se le manda.
function makeWorker(sw, cacheVersion, { replies = true } = {}) {
  const w = Object.assign(target(), { state: 'installed', cacheVersion, sent: [] });
  w.postMessage = (msg) => {
    w.sent.push(msg);
    if (msg.type === 'GET_VERSION' && replies) queueMicrotask(() => sw.emit('message', { source: w, data: { type: 'VERSION', cacheVersion } }));
  };
  return w;
}

function makeBrowser({ hostname = 'william.github.io', search = '', controllerVersion = OLD, waitingVersion = null, withSw = true, registerError = null, caches: cacheNames = [] } = {}) {
  const env = makeEnv({ search });
  const timers = makeTimers();
  const sw = target();
  const reg = target();
  const doc = Object.assign(target(), { visibilityState: 'visible' });
  const log = [];
  const unregistered = [];
  const deleted = [];
  const names = [...cacheNames];
  Object.assign(sw, {
    controller: controllerVersion ? makeWorker(sw, controllerVersion) : null,
    registerCalls: [],
    ready: Promise.resolve(reg),
    async register(url, opts) { sw.registerCalls.push([url, opts]); if (registerError) throw registerError; return reg; },
    async getRegistrations() { return [{ unregister: async () => { unregistered.push(1); return true; } }]; },
  });
  Object.assign(reg, { waiting: waitingVersion ? makeWorker(sw, waitingVersion) : null, installing: null, updates: 0, update: async () => { reg.updates += 1; } });
  const win = {
    ...env.win,
    location: { hostname, search, reloads: 0, reload() { this.reloads += 1; } },
    navigator: withSw ? { serviceWorker: sw } : {},
    document: doc,
    caches: { keys: async () => [...names], delete: async (n) => { deleted.push(n); return true; } },
  };
  const shown = [];
  const toasts = [];
  const notice = {
    hidden: 0,
    show(o) { shown.push(o); },
    hide() { this.hidden += 1; },
  };
  const toast = { show: (kind, msg) => toasts.push([kind, msg]) };
  let clock = 1_000_000;
  const now = () => clock;
  const run = (extra = {}) => registerServiceWorker({ win, notice, toast, log: (...a) => log.push(a), timers, now, ...extra });
  const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
  return { win, sw, reg, doc, notice, shown, toasts, log, timers, unregistered, deleted, run, flush, advanceClock: (ms) => { clock += ms; }, reloads: () => win.location.reloads };
}

test('swPolicy: producción sí; localhost y 127.x no; ?sw=off apaga y ?sw=on fuerza', () => {
  const on = (hostname, search = '') => swPolicy({ hostname, search }).enabled;
  assert.equal(on('william.github.io'), true);
  assert.equal(on('william.github.io', '?sw=off'), false);
  for (const h of ['localhost', 'LOCALHOST', '127.0.0.1', '127.0.1.1', '::1', '[::1]', 'app.localhost']) assert.equal(on(h), false, h);
  assert.equal(on('localhost', '?sw=on'), true);
  assert.equal(on('localhost', '?x=1&sw=on'), true);
  assert.equal(on('127.0.0.1', '?sw=off'), false);
  assert.equal(on('localhost.evil.com'), true, 'un dominio que solo empieza con "localhost" no es desarrollo');
  assert.equal(swPolicy({ hostname: 'localhost', search: '' }).cleanup, true);
  assert.equal(swPolicy({ hostname: 'william.github.io', search: '' }).cleanup, false);
  assert.equal(swPolicy({ hostname: 'william.github.io', search: '?sw=raro' }).enabled, true);
  assert.equal(swPolicy().enabled, true);
});

test('desarrollo (localhost): no registra, deshace registros viejos y borra SOLO cachés sophia-*', async () => {
  const b = makeBrowser({ hostname: 'localhost', caches: [OLD, 'sophia-packs-v1', 'otra-app-v1'] });
  const r = await b.run();
  assert.equal(r.status, 'disabled'); assert.equal(r.reason, 'dev');
  assert.equal(b.sw.registerCalls.length, 0);
  assert.equal(b.unregistered.length, 1);
  assert.deepEqual(b.deleted.sort(), [OLD, 'sophia-packs-v1'].sort());
});

test('?sw=off en producción también apaga y limpia; ?sw=on en localhost registra', async () => {
  const off = makeBrowser({ search: '?sw=off', caches: [OLD] });
  assert.equal((await off.run()).status, 'disabled');
  assert.equal(off.sw.registerCalls.length, 0); assert.deepEqual(off.deleted, [OLD]);
  const on = makeBrowser({ hostname: 'localhost', search: '?sw=on' });
  assert.equal((await on.run()).status, 'registered');
  assert.deepEqual(on.sw.registerCalls, [['sw.js', { updateViaCache: 'none' }]], 'ruta relativa y sin caché HTTP para sw.js');
});

test('navegador sin service worker, o registro que falla: la app no se rompe', async () => {
  assert.equal((await makeBrowser({ withSw: false }).run()).status, 'unsupported');
  const b = makeBrowser({ registerError: new Error('boom') });
  const r = await b.run();
  assert.equal(r.status, 'failed'); assert.equal(b.log.length, 1); assert.equal(b.shown.length, 0);
  await assert.rejects(() => registerServiceWorker({ win: b.win }), /win y notice/);
});

test('primera visita: sin aviso de actualización, un solo "lista sin conexión" y nunca recarga', async () => {
  const b = makeBrowser({ controllerVersion: null });
  const r = await b.run(); await b.flush();
  assert.equal(r.status, 'registered');
  assert.deepEqual(b.toasts, [['success', 'Lista para usar sin conexión.']]);
  b.sw.emit('controllerchange'); await b.flush();
  assert.equal(b.reloads(), 0); assert.equal(b.shown.length, 0);
});

test('visita normal sin versión nueva: ningún aviso ni toast', async () => {
  const b = makeBrowser();
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 0); assert.equal(b.toasts.length, 0);
});

test('versión nueva ya esperando: avisa; NO recarga hasta tocar "Actualizar" y el cambio de versión; entonces recarga UNA vez', async () => {
  const b = makeBrowser({ waitingVersion: NEW_VERSION });
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 1);
  const n = b.shown[0];
  assert.equal(n.actionLabel, 'Actualizar'); assert.equal(n.dismissLabel, 'Ahora no'); assert.match(n.message, /actualización/);
  assert.equal(b.reloads(), 0);
  assert.deepEqual(b.reg.waiting.sent.map((m) => m.type), ['GET_VERSION'], 'solo preguntó la versión, no activó nada');
  n.onAction();
  assert.deepEqual(b.reg.waiting.sent.map((m) => m.type), ['GET_VERSION', 'SKIP_WAITING']);
  assert.equal(b.reloads(), 0, 'todavía no: espera a que el navegador cambie de versión');
  b.sw.emit('controllerchange'); b.sw.emit('controllerchange');
  assert.equal(b.reloads(), 1);
});

test('versión nueva con el mismo número pero otros archivos (content) también se ofrece', async () => {
  const b = makeBrowser({ waitingVersion: NEW_CONTENT });
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 1); assert.equal(b.shown[0].actionLabel, 'Actualizar');
});

test('misma caché esperando (nada nuevo): no se ofrece nada', async () => {
  const b = makeBrowser({ waitingVersion: OLD });
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 0);
});

test('versión MÁS ANTIGUA publicada: aviso distinto, sin la palabra "Actualizar" como acción', async () => {
  const b = makeBrowser({ waitingVersion: OLDER });
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 1);
  assert.match(b.shown[0].message, /ANTIGUA/); assert.equal(b.shown[0].actionLabel, 'Instalar de todos modos');
});

test('el SW nuevo no contesta la versión: se avisa igual, sin detalle, tras el tiempo de espera', async () => {
  const b = makeBrowser();
  b.reg.waiting = makeWorker(b.sw, NEW_VERSION, { replies: false });
  await b.run(); await b.flush();
  assert.equal(b.shown.length, 0, 'aún esperando respuesta');
  b.timers.advance(1600); await b.flush();
  assert.equal(b.shown.length, 1); assert.equal(b.shown[0].actionLabel, 'Actualizar');
});

test('una respuesta de VERSION que viene de OTRO worker se ignora (no se confunde la versión)', async () => {
  const b = makeBrowser();
  b.reg.waiting = makeWorker(b.sw, NEW_VERSION, { replies: false });
  await b.run(); await b.flush();
  b.sw.emit('message', { source: makeWorker(b.sw, OLDER), data: { type: 'VERSION', cacheVersion: OLDER } });
  await b.flush();
  assert.equal(b.shown.length, 0, 'la respuesta ajena no cuenta');
  b.timers.advance(1600); await b.flush();
  assert.equal(b.shown.length, 1); assert.equal(b.shown[0].actionLabel, 'Actualizar', 'sin versión conocida: aviso genérico, no el de versión antigua');
});

test('actualización que aparece con la app abierta (updatefound → installed): avisa y no recarga', async () => {
  const b = makeBrowser();
  await b.run(); await b.flush();
  const w = makeWorker(b.sw, NEW_VERSION); w.state = 'installing';
  b.reg.installing = w;
  b.reg.emit('updatefound'); await b.flush();
  assert.equal(b.shown.length, 0, 'todavía instalándose');
  b.reg.installing = null; b.reg.waiting = w; w.state = 'installed';
  w.emit('statechange'); await b.flush();
  assert.equal(b.shown.length, 1); assert.equal(b.reloads(), 0);
});

test('un worker nuevo que falla (redundant) no genera aviso', async () => {
  const b = makeBrowser();
  await b.run(); await b.flush();
  const w = makeWorker(b.sw, NEW_VERSION); w.state = 'installing';
  b.reg.installing = w; b.reg.emit('updatefound');
  w.state = 'redundant'; w.emit('statechange'); await b.flush();
  assert.equal(b.shown.length, 0);
});

test('otra ventana activó la versión nueva: NO recarga sola; ofrece "Recargar"', async () => {
  const b = makeBrowser();
  await b.run(); await b.flush();
  b.sw.emit('controllerchange');
  assert.equal(b.reloads(), 0);
  assert.equal(b.shown.length, 1); assert.equal(b.shown[0].actionLabel, 'Recargar');
  b.shown[0].onAction();
  assert.equal(b.reloads(), 1);
});

test('"Ahora no": no se vuelve a ofrecer la misma versión en esta carga, pero una más nueva sí', async () => {
  const b = makeBrowser({ waitingVersion: NEW_VERSION });
  await b.run(); await b.flush();
  const first = b.reg.waiting;
  b.shown[0].onDismiss();
  b.reg.installing = first; b.reg.emit('updatefound'); await b.flush(); // el navegador vuelve a reportar el MISMO worker
  assert.equal(b.shown.length, 1, 'no insiste');
  const w2 = makeWorker(b.sw, 'sophia-shell-0.7.0-eeeeeeee'); w2.state = 'installing';
  b.reg.installing = w2; b.reg.emit('updatefound');
  b.reg.installing = null; b.reg.waiting = w2; w2.state = 'installed'; w2.emit('statechange'); await b.flush();
  assert.equal(b.shown.length, 2);
});

test('si tras "Actualizar" el navegador no cambia de versión a tiempo: mensaje claro y SIN recarga', async () => {
  const b = makeBrowser({ waitingVersion: NEW_VERSION });
  await b.run(); await b.flush();
  b.shown[0].onAction();
  b.timers.advance(5100);
  assert.equal(b.toasts.at(-1)[0], 'danger'); assert.match(b.toasts.at(-1)[1], /Cierra la app/);
  assert.equal(b.reloads(), 0);
});

test('tocar "Actualizar" cuando el worker ya no existe: avisa con error, sin lanzar', async () => {
  const b = makeBrowser({ waitingVersion: NEW_VERSION });
  await b.run(); await b.flush();
  b.reg.waiting.postMessage = () => { throw new Error('worker muerto'); };
  b.shown[0].onAction();
  assert.equal(b.toasts.at(-1)[0], 'danger'); assert.equal(b.log.length, 1);
});

test('al volver a la app busca versión nueva, como mucho cada 30 min y nunca con la pestaña oculta', async () => {
  const b = makeBrowser();
  await b.run();
  b.doc.emit('visibilitychange'); assert.equal(b.reg.updates, 0, 'recién abierta: no hace falta');
  b.advanceClock(CHECK_EVERY_MS - 1); b.doc.emit('visibilitychange'); assert.equal(b.reg.updates, 0);
  b.doc.visibilityState = 'hidden'; b.advanceClock(5); b.doc.emit('visibilitychange'); assert.equal(b.reg.updates, 0, 'oculta');
  b.doc.visibilityState = 'visible'; b.doc.emit('visibilitychange'); assert.equal(b.reg.updates, 1);
  b.doc.emit('visibilitychange'); assert.equal(b.reg.updates, 1, 'recién comprobado');
  b.reg.update = async () => { throw new Error('sin conexión'); };
  b.advanceClock(CHECK_EVERY_MS); b.doc.emit('visibilitychange'); await b.flush();
  assert.equal(b.log.length, 0, 'un fallo por falta de red es normal y no ensucia el registro');
});

test('destroy(): quita todos los escuchas, cancela temporizadores y oculta el aviso', async () => {
  const b = makeBrowser({ waitingVersion: NEW_VERSION });
  const r = await b.run(); await b.flush();
  b.shown[0].onAction();
  r.destroy();
  assert.equal(b.sw.count(), 0); assert.equal(b.reg.count(), 0); assert.equal(b.doc.count(), 0);
  assert.equal(b.timers.pending(), 0); assert.equal(b.notice.hidden, 1);
  b.sw.emit('controllerchange');
  assert.equal(b.reloads(), 0);
});

// ---------- updateNotice (componente) ----------
function noticeEnv() {
  const env = makeEnv();
  const container = env.doc.createElement('div');
  env.doc.body.appendChild(container);
  const notice = createUpdateNotice({ doc: env.doc, container });
  const buttons = () => container.querySelectorAll('button');
  const click = (el) => el.dispatchEvent({ type: 'click' });
  return { env, container, notice, buttons, click };
}

test('updateNotice: persistente, con dos botones reales y texto que entra como TEXTO', async () => {
  const t = noticeEnv();
  let acted = 0; let dismissed = 0;
  const el = t.notice.show({ message: '<b>Hay</b> una actualización', actionLabel: 'Actualizar', dismissLabel: 'Ahora no', onAction: () => { acted += 1; }, onDismiss: () => { dismissed += 1; } });
  assert.equal(el.getAttribute('role'), 'status');
  assert.ok(el.classList.contains('toast') && el.classList.contains('update-notice'));
  assert.equal(t.container.querySelectorAll('b').length, 0, 'sin HTML');
  assert.deepEqual(t.buttons().map((b) => b.textContent), ['Ahora no', 'Actualizar']);
  assert.ok(t.buttons().every((b) => b.getAttribute('type') === 'button'));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(t.notice.isVisible(), true, 'no se cierra solo con el tiempo');
  t.click(el); assert.equal(t.notice.isVisible(), true, 'tocar el texto no lo cierra');
  t.click(t.buttons()[1]); assert.equal(acted, 1); assert.equal(t.notice.isVisible(), true, 'actuar no lo oculta solo: lo decide quien lo usa');
  t.click(t.buttons()[0]); assert.equal(dismissed, 1); assert.equal(t.notice.isVisible(), false);
  assert.equal(t.container.querySelectorAll('.update-notice').length, 0);
});

test('updateNotice: un solo aviso a la vez, validación y sin fugas de escuchas', () => {
  const t = noticeEnv();
  t.notice.show({ message: 'uno', actionLabel: 'A' });
  t.notice.show({ message: 'dos', actionLabel: 'B', dismissLabel: 'C' });
  assert.equal(t.container.querySelectorAll('.update-notice').length, 1);
  assert.equal(t.container.querySelectorAll('button').length, 2);
  assert.throws(() => t.notice.show({ message: '', actionLabel: 'A' }), /message/);
  assert.throws(() => t.notice.show({ message: 'x' }), /actionLabel/);
  assert.throws(() => createUpdateNotice({ doc: t.env.doc }), /contenedor/);
  t.notice.destroy(); t.notice.destroy();
  assert.equal(t.env.stats.live(), 0);
});

// ---------- cableado ----------
test('cableado: index.html enlaza el manifest, main.js registra el SW y ya no queda la marca de pendiente', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(index, /<link rel="manifest" href="manifest\.webmanifest">/);
  const main = fs.readFileSync(path.join(ROOT, 'app/main.js'), 'utf8');
  assert.match(main, /registerServiceWorker\(/); assert.match(main, /createUpdateNotice\(/);
  assert.ok(!new RegExp('TO' + 'DO\\(0\\.6\\)').test(main), 'la marca de pendiente de la 0.4 ya se resolvió');
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')).start_url, './');
});

test('GitHub Pages: .nojekyll existe (si no, Pages oculta los archivos que empiezan con "_" y la app no abre)', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '.git'].includes(e.name) ? [] : walk(p);
    return [path.relative(ROOT, p)];
  });
  const hidden = walk(ROOT).filter((f) => f.split(path.sep).some((part) => part.startsWith('_')) && /^(app|core|ui|vendor)\//.test(f.split(path.sep).join('/')));
  assert.ok(hidden.length > 0, 'la app sí usa archivos con _ (por eso hace falta .nojekyll)');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-manifest.json'), 'utf8'));
  const inManifest = manifest.files.map((f) => f.path);
  for (const f of hidden.map((x) => x.split(path.sep).join('/'))) assert.ok(inManifest.includes(f), `${f} debe estar en el precache`);
  const guide = fs.readFileSync(path.join(ROOT, 'docs/DEPLOY.md'), 'utf8');
  assert.match(guide, /\.nojekyll/);
});

test('DEPLOY.md: cubre los pasos obligatorios del roadmap (Pages, instalar, actualizar, versión vieja, aviso del respaldo)', () => {
  const g = fs.readFileSync(path.join(ROOT, 'docs/DEPLOY.md'), 'utf8');
  for (const needle of ['GitHub Pages', 'Instalar app', 'modo avión', 'Actualizar', 'Ahora no', 'sigo viendo la vieja', 'BORRA todo tu progreso', 'respaldo', '100 archivos']) assert.ok(g.includes(needle), `falta: ${needle}`);
  assert.ok(!new RegExp('local' + 'Storage|sk-|AIza').test(g));
});
