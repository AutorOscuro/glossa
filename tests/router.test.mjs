// @purpose: Pruebas del router (app/router.js): resolución de rutas y parámetros, 404 y redirección.
// Pruebas de app/router.js (subparte 0.4): resolución de rutas y parámetros, 404, redirección, router con window falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, resolveHash, buildHref, createRouter } from '../app/router.js';
import { makeEnv } from './_fakeDom.mjs';

test('las 10 rutas existen (las 9 del roadmap y la bienvenida) y las 5 pestañas están en orden', () => {
  assert.deepEqual(ROUTES.map((r) => r.path), ['/hoy', '/mapa', '/practicar', '/errores', '/mas', '/sesion/:id', '/tema/:id', '/ajustes', '/bienvenida', '/404']);
});

test('resolveHash: cada ruta estática resuelve a su nombre y pestaña', () => {
  for (const [hash, name, tab] of [['#/hoy', 'hoy', 'hoy'], ['#/mapa', 'mapa', 'mapa'], ['#/practicar', 'practicar', 'practicar'],
    ['#/errores', 'errores', 'errores'], ['#/mas', 'mas', 'mas'], ['#/ajustes', 'ajustes', 'mas'], ['#/bienvenida', 'onboarding', null], ['#/404', '404', null]]) {
    const m = resolveHash(hash);
    assert.equal(m.name, name, hash);
    assert.equal(m.tab, tab, hash);
    assert.deepEqual(m.params, {});
  }
});

test('resolveHash: rutas con parámetro (sesion y tema) y su pestaña', () => {
  const s = resolveHash('#/sesion/abc123');
  assert.deepEqual([s.name, s.params, s.tab], ['sesion', { id: 'abc123' }, 'practicar']);
  const t = resolveHash('#/tema/gram.present_perfect.for_since');
  assert.deepEqual([t.name, t.params, t.tab], ['tema', { id: 'gram.present_perfect.for_since' }, 'mapa']);
});

test('resolveHash: hash vacío, "#", "#/" y nada → redirige a Hoy', () => {
  for (const h of ['', '#', '#/', '#//', undefined, null, 42]) {
    const m = resolveHash(h);
    assert.equal(m.name, 'hoy', String(h));
    assert.equal(m.redirect, '#/hoy');
  }
});

test('resolveHash: tolera sin barra, barra final, barras dobles, mayúsculas en rutas fijas', () => {
  for (const h of ['#hoy', '#/hoy/', '#//hoy', '#/HOY', '#/Mapa/']) assert.equal(resolveHash(h).name, h.toLowerCase().includes('mapa') ? 'mapa' : 'hoy', h);
});

test('resolveHash: parámetros codificados se decodifican; ñ, espacios y emoji', () => {
  assert.equal(resolveHash('#/tema/a%20b').params.id, 'a b');
  assert.equal(resolveHash(`#/tema/${encodeURIComponent('niño 😀')}`).params.id, 'niño 😀');
  assert.equal(resolveHash('#/sesion/x%2Fy').params.id, 'x/y');
});

test('resolveHash: la consulta (?a=b) se separa de la ruta', () => {
  const m = resolveHash('#/mapa?filtro=gram&filtro=otro&x=%C3%B1');
  assert.equal(m.name, 'mapa');
  assert.deepEqual(m.query, { filtro: 'gram', x: 'ñ' });
});

test('resolveHash: desconocida, parámetro vacío, segmentos de más o de menos → 404 con la dirección pedida', () => {
  for (const h of ['#/nada', '#/sesion', '#/sesion/', '#/tema/a/b', '#/hoy/extra', '#/ajustes/x/y']) {
    const m = resolveHash(h);
    assert.equal(m.name, '404', h);
    assert.ok(m.requested.startsWith('#/'), h);
  }
  assert.equal(resolveHash('#/nada/x').requested, '#/nada/x');
});

test('resolveHash: texto mal codificado (%E0%A4%A) y hash larguísimo → 404 sin lanzar', () => {
  assert.equal(resolveHash('#/tema/%E0%A4%A').name, '404');
  assert.equal(resolveHash(`#/tema/${'a'.repeat(5000)}`).name, '404');
  assert.equal(resolveHash('#/' + '/'.repeat(10000)).name, '404');
});

test('resolveHash: intentos de inyección en la ruta no ejecutan nada y acaban en 404 o como texto de parámetro', () => {
  assert.equal(resolveHash('#/<script>alert(1)</script>').name, '404');
  assert.equal(resolveHash('#/tema/<img src=x onerror=alert(1)>').params.id, '<img src=x onerror=alert(1)>');
});

test('buildHref: genera y codifica; es inverso de resolveHash', () => {
  assert.equal(buildHref('hoy'), '#/hoy');
  assert.equal(buildHref('tema', { id: 'a b/ñ' }), '#/tema/a%20b%2F%C3%B1');
  const m = resolveHash(buildHref('tema', { id: 'a b/ñ' }));
  assert.deepEqual([m.name, m.params.id], ['tema', 'a b/ñ']);
  assert.equal(resolveHash(buildHref('sesion', { id: 7 })).params.id, '7');
});

test('buildHref: ruta inexistente o parámetro faltante/vacío lanzan error claro', () => {
  assert.throws(() => buildHref('nada'), /no existe/);
  assert.throws(() => buildHref('tema'), /falta el parámetro "id"/);
  assert.throws(() => buildHref('tema', { id: '' }), /falta el parámetro/);
  assert.throws(() => buildHref('sesion', { id: null }), /falta el parámetro/);
});

function setup(hash = '') {
  const env = makeEnv({ hash });
  const seen = [];
  const router = createRouter({ win: env.win, onChange: (m) => seen.push(m), log: () => {} });
  return { ...env, router, seen };
}

test('createRouter: start() emite la ruta inicial; hash vacío redirige a #/hoy sin añadir historial', () => {
  const { router, seen, win } = setup('');
  router.start();
  assert.deepEqual(seen.map((m) => m.name), ['hoy']);
  assert.equal(win.location.hash, '#/hoy');
  assert.deepEqual(win.historyEntries(), ['#/hoy']);
});

test('createRouter: navegar, atrás y adelante (botón del navegador) emiten cada cambio', () => {
  const { router, seen, win } = setup('#/hoy');
  router.start();
  router.navigate('mapa');
  router.navigate('tema', { id: 'gram.pp' });
  win.back();
  win.back();
  win.forward();
  assert.deepEqual(seen.map((m) => m.name), ['hoy', 'mapa', 'tema', 'mapa', 'hoy', 'mapa']);
  assert.equal(seen[2].params.id, 'gram.pp');
});

test('createRouter: navegar a la misma ruta (doble toque) no emite dos veces', () => {
  const { router, seen } = setup('#/hoy');
  router.start();
  router.navigate('mapa');
  router.navigate('mapa');
  assert.equal(seen.filter((m) => m.name === 'mapa').length, 1);
});

test('createRouter: dos 404 distintos sí se emiten (cambia la dirección pedida)', () => {
  const { router, seen, win } = setup('#/hoy');
  router.start();
  win.location.hash = '#/foo';
  win.location.hash = '#/bar';
  assert.deepEqual(seen.slice(1).map((m) => m.requested), ['#/foo', '#/bar']);
});

test('createRouter: stop() quita el listener (0 fugas) y start() dos veces no duplica', () => {
  const { router, seen, win, stats } = setup('#/hoy');
  router.start();
  router.start();
  assert.equal(stats.live(), 1);
  router.stop();
  assert.equal(stats.live(), 0);
  win.location.hash = '#/mapa';
  assert.equal(seen.length, 1);
});

test('createRouter: si onChange lanza, el router sigue vivo y lo registra', () => {
  const env = makeEnv({ hash: '#/hoy' });
  const logs = [];
  let calls = 0;
  const router = createRouter({ win: env.win, onChange: () => { calls += 1; if (calls === 1) throw new Error('vista rota'); }, log: (...a) => logs.push(a) });
  router.start();
  env.win.location.hash = '#/mapa';
  assert.equal(calls, 2);
  assert.equal(logs.length, 1);
});

test('createRouter: argumentos inválidos lanzan; navigate con ruta inexistente lanza', () => {
  assert.throws(() => createRouter({}), /se necesitan win y onChange/);
  const { router } = setup('#/hoy');
  router.start();
  assert.throws(() => router.navigate('nada'), /no existe/);
});

test('#/bienvenida: ruta sin pestaña, buildHref la arma y mayúsculas no importan', () => {
  assert.equal(buildHref('onboarding'), '#/bienvenida');
  assert.equal(resolveHash('#/Bienvenida').name, 'onboarding');
  assert.equal(resolveHash('#/bienvenida/x').name, '404');
  assert.equal(resolveHash('#/onboarding').name, '404', 'el nombre de la vista no es una dirección');
});

test('createRouter: navigate con { replace: true } reemplaza la entrada del historial (atrás no vuelve a la anterior)', () => {
  const { router, seen, win } = setup('#/hoy');
  router.start();
  router.navigate('onboarding', undefined, { replace: true });
  assert.deepEqual(seen.map((m) => m.name), ['hoy', 'onboarding']);
  assert.equal(win.location.hash, '#/bienvenida');
  win.back(); // no hay entrada anterior: sigue en la bienvenida
  assert.equal(win.location.hash, '#/bienvenida');
  assert.equal(seen.length, 2);
});

test('createRouter: navigate sin replace sí deja la entrada anterior (atrás vuelve)', () => {
  const { router, seen, win } = setup('#/hoy');
  router.start();
  router.navigate('onboarding');
  win.back();
  assert.deepEqual(seen.map((m) => m.name), ['hoy', 'onboarding', 'hoy']);
});

test('createRouter: replace a la ruta actual no emite de nuevo ni toca el historial', () => {
  const { router, seen } = setup('#/bienvenida');
  router.start();
  router.navigate('onboarding', undefined, { replace: true });
  assert.equal(seen.length, 1);
});
