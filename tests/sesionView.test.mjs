// @purpose: Pruebas de la vista de sesión (ui/views/sesion.js, 2.1-T3) con DOM falso, servicios de estudio reales sobre base en memoria y un anfitrión de ejercicios falso.
// 2.1-T3. Recorridos: sesión nueva, responder, doble toque, continuar, resumen, salir con confirmación, retomar, tipo no soportado, fallos y limpieza sin fugas.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';
import sesion from '../ui/views/sesion.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

test('#/sesion/nueva arma la sesión, la guarda y reemplaza la ruta por la de la sesión (sin pintar ejercicios todavía)', async () => {
  const t = await mk();
  assert.equal(t.nav.length, 1);
  assert.equal(t.nav[0][0], 'sesion');
  assert.match(t.nav[0][1].id, /^ses_/);
  assert.deepEqual(t.nav[0][2], { replace: true });
  assert.equal(t.host.calls.mounted.length, 0);
  assert.equal((await t.study.session.load()).sessionId, t.nav[0][1].id);
});

test('sin navegador de rutas (sin navigate) la sesión nueva arranca directamente', async () => {
  const t = await mk({ services: { navigate: undefined } });
  assert.equal(t.host.calls.mounted.length, 1);
  assert.equal(t.progressText(), '0/3');
});

test('la cabecera muestra la flecha, la barra con la mascota y X/N; el primer ejercicio se monta con su ítem', async () => {
  const t = await mk();
  await openNew(t);
  assert.ok(t.btn('←') || t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión'));
  assert.equal(t.progressText(), '0/3');
  assert.equal(t.q('.progress-bar--has-mascot').length, 1);
  assert.equal(t.q('[role="progressbar"]')[0].getAttribute('aria-valuetext'), '0 de 3');
  assert.equal(t.host.calls.mounted.length, 1);
  assert.equal(t.host.calls.ctxs[0].index, 0);
  assert.equal(t.host.calls.ctxs[0].total, 3);
  assert.equal(t.foot().hasAttribute('hidden'), true, '«Continuar» no aparece antes de responder');
});

test('responder guarda UN evento y UNA tarjeta, avanza la barra y muestra «Continuar»', async () => {
  const t = await mk();
  await openNew(t);
  t.clock.advance(3000);
  t.click(t.btn('Comprobar')); await t.flush();
  const evs = await t.events();
  assert.equal(evs.length, 1);
  assert.equal(evs[0].ms, 3000);
  assert.equal(t.progressText(), '1/3');
  assert.equal(t.foot().hasAttribute('hidden'), false);
  assert.ok(t.btn('Continuar'));
  assert.equal(t.host.calls.results[0].status, 'saved');
});

test('doble toque en Comprobar (dos clics seguidos): un solo evento', async () => {
  const t = await mk();
  await openNew(t);
  const b = t.btn('Comprobar');
  t.click(b); t.click(b); t.click(b); await t.flush();
  assert.equal((await t.events()).length, 1);
  assert.deepEqual(t.host.calls.results.map((r) => r.status).sort(), ['ignored', 'ignored', 'saved']);
});

test('«Continuar» pasa al siguiente ejercicio, cierra el anterior y esconde el botón; un doble toque avanza solo uno', async () => {
  const t = await mk();
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  const c = t.btn('Continuar');
  t.click(c); t.click(c); await t.flush();
  assert.equal(t.host.calls.mounted.length, 2);
  assert.equal(t.host.calls.ctxs[1].index, 1);
  assert.equal(t.host.calls.destroyed, 1);
  assert.equal(t.foot().hasAttribute('hidden'), true);
  assert.equal(t.progressText(), '1/3');
});

test('recorrido completo hasta el resumen: 3 eventos, resumen sin culpa, sesión guardada borrada y «Volver» lleva a Practicar', async () => {
  const t = await mk();
  await openNew(t);
  for (let i = 0; i < 3; i += 1) {
    t.clock.advance(2000);
    t.click(t.btn('Comprobar')); await t.flush();
    t.click(t.btn('Continuar')); await t.flush();
  }
  assert.equal((await t.events()).length, 3);
  assert.match(t.root.textContent, /Sesión terminada/);
  assert.match(t.root.textContent, /Ejercicios3/);
  assert.match(t.root.textContent, /Aciertos3/);
  assert.doesNotMatch(t.root.textContent, /fall|culpa|mal /i);
  assert.equal(t.progressText(), '3/3');
  assert.deepEqual(await t.study.session.load(), { status: 'none' });
  t.click(t.btn('Volver a Practicar'));
  assert.deepEqual(t.nav.at(-1), ['practicar', undefined, undefined]);
  assert.equal(t.host.calls.destroyed, 3);
});

test('flecha de la cabecera: pide confirmación; «Seguir» se queda; «Salir» conserva lo guardado y va a Practicar', async () => {
  const t = await mk();
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  const back = () => t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  const before = t.nav.length;
  t.click(back()); await t.flush();
  assert.ok(t.dialog(), 'se abrió la confirmación');
  assert.match(t.dialog().textContent, /Lo que ya respondiste está guardado/);
  t.click(t.dlgBtn('Seguir')); await t.flush();
  assert.equal(t.nav.length, before, 'no navegó');
  t.click(back()); await t.flush();
  const navsBefore = t.nav.length;
  t.click(t.dlgBtn('Salir')); await t.flush();
  assert.match(t.root.textContent, /Sesión a medias/, 'con respuestas, salir muestra el resumen parcial');
  assert.equal(t.nav.length, navsBefore, 'todavía no navegó: primero ve su resumen');
  t.click(t.btn('Volver a Practicar')); await t.flush();
  assert.deepEqual(t.nav.at(-1), ['practicar', undefined, undefined]);
  assert.equal((await t.study.session.load()).status, 'restored', 'la sesión guardada se conserva para retomarla');
  assert.equal((await t.events()).length, 1, 'lo respondido sigue guardado');
});

test('tocar la flecha dos veces seguidas no abre dos confirmaciones', async () => {
  const t = await mk();
  await openNew(t);
  const back = t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  t.click(back); t.click(back); await t.flush();
  assert.equal(t.env.doc.body.querySelectorAll('[role="alertdialog"]').length, 1);
});

test('retomar: tras responder 1 y salir, abrir la misma dirección muestra el ítem 2 con 1/3 y no repite el evento', async () => {
  const t = await mk();
  const id = await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.view2.destroy();
  const mountedBefore = t.host.calls.mounted.length;
  t.root.replaceChildren();
  const again = sesion();
  await again.mount(t.root, { id }, t.services);
  assert.equal(t.progressText(), '1/3');
  assert.equal(t.host.calls.mounted.length, mountedBefore + 1);
  assert.equal(t.host.calls.mounted.at(-1).cardId, (await t.study.session.load()).items[1].cardId);
  assert.equal((await t.events()).length, 1);
  assert.equal(t.foot().hasAttribute('hidden'), true);
  again.destroy();
});

test('sesión que no existe: mensaje amable con «Empezar una sesión nueva» (reemplaza la ruta) y «Volver a Practicar»', async () => {
  const t = await mk({ params: { id: 'ses_noexiste' } });
  assert.match(t.root.textContent, /No encontré esa sesión/);
  t.click(t.btn('Empezar una sesión nueva'));
  assert.deepEqual(t.nav.at(-1), ['sesion', { id: 'nueva' }, { replace: true }]);
  t.click(t.btn('Volver a Practicar'));
  assert.equal(t.nav.at(-1)[0], 'practicar');
  assert.equal(t.host.calls.mounted.length, 0);
});

test('sin material: muestra el motivo del plan vacío, sin culpa', async () => {
  const t = await mk({ cards: 0 });
  assert.match(t.root.textContent, /No hay material: carga un paquete\./);
  assert.ok(t.btn('Volver a Practicar'));
  assert.equal(t.nav.length, 0);
});

test('sin servicios de estudio o sin base: mensaje claro y «Volver», sin lanzar', async () => {
  for (const opts of [{ noStudy: true }, { noDb: true }]) {
    const t = await mk(opts);
    assert.match(t.root.textContent, /No pude abrir tus datos/);
    assert.ok(t.btn('Volver a Practicar'));
  }
});

test('sin anfitrión de ejercicios: «tipo no disponible» y «Saltar por ahora» avanza SIN evento y sin tocar la tarjeta', async () => {
  const t = await mk({ host: null });
  await openNew(t);
  assert.match(t.root.textContent, /Este tipo de ejercicio todavía no está disponible/);
  const cardsBefore = await t.db.query('cards', {});
  t.click(t.btn('Saltar por ahora')); await t.flush();
  assert.equal((await t.events()).length, 0);
  assert.deepEqual(await t.db.query('cards', {}), cardsBefore);
  assert.equal(t.progressText(), '1/3');
  assert.ok(t.btn('Continuar'));
  t.click(t.btn('Continuar')); await t.flush();
  assert.match(t.root.textContent, /Este tipo de ejercicio todavía no está disponible/);
});

test('si el ejercicio falla al montarse se avisa por el registro y se muestra el tipo no disponible', async () => {
  const t = await mk({ host: fakeHost({ failMount: true }) });
  const realError = console.error; const logs = [];
  console.error = (...a) => logs.push(a);
  try { await openNew(t); } finally { console.error = realError; }
  assert.match(t.root.textContent, /todavía no está disponible/);
  assert.ok(logs.some((l) => String(l[0]).includes('No se pudo mostrar el ejercicio')));
});

test('si guardar la respuesta falla: aviso amable, el ejercicio sigue en pantalla y se puede reintentar', async () => {
  let fail = true;
  const t = await mk({ wrapStudy: (s) => ({ ...s, commit: async (a) => { if (fail) { fail = false; throw new Error('base llena'); } return s.commit(a); } }) });
  await openNew(t);
  const realError = console.error; console.error = () => {};
  try { t.click(t.btn('Comprobar')); await t.flush(); } finally { console.error = realError; }
  assert.deepEqual(t.toasts, ['No pude guardar tu respuesta. Inténtalo otra vez.']);
  assert.equal(t.foot().hasAttribute('hidden'), true);
  assert.equal(t.progressText(), '0/3');
  assert.equal((await t.events()).length, 0);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1);
  assert.equal(t.progressText(), '1/3');
});

test('una respuesta de un ejercicio que ya no está en pantalla se ignora', async () => {
  const t = await mk();
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.click(t.btn('Continuar')); await t.flush();
  const old = t.host.calls.ctxs[0];
  const r = await old.submit({ result: 'correct', exerciseType: 'fix_error' });
  assert.deepEqual(r, { status: 'ignored', reason: 'stale' });
  assert.equal((await t.events()).length, 1);
});

test('el cronómetro descuenta la pestaña oculta mientras el ejercicio está en pantalla', async () => {
  const t = await mk();
  await openNew(t);
  t.clock.advance(1000);
  t.vis.set(true); t.clock.advance(2500); t.vis.set(false);
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});

test('el cronómetro de cada ejercicio empieza de cero', async () => {
  const t = await mk();
  await openNew(t);
  t.clock.advance(4000);
  t.click(t.btn('Comprobar')); await t.flush();
  t.clock.advance(60000); // tiempo leyendo la corrección: no cuenta
  t.click(t.btn('Continuar')); await t.flush();
  t.clock.advance(1200);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.deepEqual((await t.events()).map((e) => e.ms).sort((a, b) => a - b), [1200, 4000]);
});

test('destroy no deja listeners ni ejercicio vivo, y destruir dos veces no falla', async () => {
  const t = await mk();
  const id = await openNew(t); // destruye la vista 1 y monta la 2
  t.click(t.btn('Comprobar')); await t.flush();
  t.view2.destroy();
  assert.equal(t.host.calls.destroyed, 1, 'se cerró el ejercicio de la vista 2 (la vista 1, ruta nueva, no monta ejercicios)');
  assert.equal(t.root.childNodes.length, 0);
  assert.doesNotThrow(() => t.view2.destroy());
  // Línea base: nada de la vista queda montado. Ciclos repetidos no la hacen crecer.
  const base = t.env.stats.live();
  for (let i = 0; i < 6; i += 1) {
    const v = sesion();
    await v.mount(t.root, { id }, t.services); await t.flush();
    assert.ok(t.env.stats.live() > base, 'montada: tiene listeners');
    v.destroy();
    assert.equal(t.env.stats.live(), base, `ciclo ${i + 1}: sin fugas de listeners`);
  }
});

test('destruir la vista mientras la sesión se prepara no deja nada colgado ni lanza', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  let release;
  const gate = new Promise((r) => { release = r; });
  const view = sesion();
  const p = view.mount(root, { id: 'ses_x' }, { studyReady: gate, study: null, navigate() {} });
  view.destroy();
  release();
  await p;
  assert.equal(root.childNodes.length, 0);
});

test('salir desde el resumen o desde un mensaje no pide confirmación', async () => {
  const t = await mk({ cards: 0 });
  assert.equal(t.dialog(), null);
  const back = t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  t.click(back); await t.flush();
  assert.equal(t.dialog(), null);
  assert.equal(t.nav.at(-1)[0], 'practicar');
});

test('una sesión retomada que estaba en «siguiente» y era el último ítem termina directo en el resumen', async () => {
  const t = await mk({ cards: 1 });
  const id = await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.view2.destroy();
  t.root.replaceChildren();
  const again = sesion();
  await again.mount(t.root, { id }, t.services);
  assert.match(t.root.textContent, /Sesión terminada/);
  assert.deepEqual(await t.study.session.load(), { status: 'none' });
  again.destroy();
});

test('los textos de la persona o del contenido entran como texto, nunca como HTML', async () => {
  const t = await mk({ host: { async mount(slot) { slot.appendChild(globalThis.document.createTextNode('<img src=x onerror=alert(1)>')); return { destroy() {} }; } } });
  await openNew(t);
  assert.equal(t.q('img').length, 0);
});
