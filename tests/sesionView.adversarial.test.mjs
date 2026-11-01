// @purpose: Pasada adversarial de la vista y el conductor de sesión (2.1-T3): tamaños extremos, texto raro, reloj hacia atrás, fallos al abrir, doble montaje y cierre con la confirmación abierta.
// 2.1-T3. Cada prueba nació de preguntarse qué rompería a la vista; las que encontraron un fallo lo dicen en su nombre.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';
import sesion from '../ui/views/sesion.js';
import { startSession } from '../core/sessionDriver.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

// Recorre la sesión hasta el resumen respondiendo siempre bien; devuelve cuántos ejercicios se respondieron.
async function playAll(t, limit = 500) {
  let n = 0;
  while (n < limit) {
    const go = t.btn('Comprobar');
    if (!go) break;
    t.clock.advance(1000);
    t.click(go); await t.flush();
    n += 1;
    const next = t.btn('Continuar');
    if (!next) break;
    t.click(next); await t.flush();
  }
  return n;
}

test('sesión de 1 ítem: 1/1, un evento y resumen', async () => {
  const t = await mk({ cards: 1 });
  await openNew(t);
  assert.equal(t.progressText(), '0/1');
  assert.equal(await playAll(t), 1);
  assert.equal((await t.events()).length, 1);
  assert.equal(t.progressText(), '1/1');
  assert.ok(t.q('.card__title').some((el) => /sesión|terminaste|listo|bien/i.test(el.textContent)), 'hay resumen');
  assert.equal((await t.study.session.load()).status, 'none', 'la sesión guardada se borró');
});

test('sesión de 100 ítems (size: 100, el tope del plan): un evento por ítem, sin duplicados, la barra llega a 100/100 y la vista no se arrastra', async () => {
  const t = await mk({ cards: 100 });
  const r = await startSession({ study: t.study, options: { size: 100, newCap: 100 } }); // la última sesión guardada gana; por defecto el plan trae 20 ítems y 10 tarjetas nuevas
  assert.equal(r.status, 'started');
  assert.equal(r.items.length, 100, 'el plan entregó 100 ítems');
  t.view.destroy(); t.root.replaceChildren();
  const v = sesion();
  await v.mount(t.root, { id: r.sessionId }, t.services); await t.flush();
  assert.equal(t.progressText(), '0/100');
  const started = Date.now();
  assert.equal(await playAll(t), 100);
  assert.ok(Date.now() - started < 20000, 'tarda razonable');
  const ev = await t.events();
  assert.equal(ev.length, 100);
  assert.equal(new Set(ev.map((e) => e.cardId)).size, 100, 'cada tarjeta una sola vez');
  assert.equal(t.progressText(), '100/100');
  assert.equal((await t.study.session.load()).status, 'none');
  v.destroy();
});

test('el texto con emoji, acentos, comillas curvas y saltos viaja intacto al evento y no rompe la vista', async () => {
  const raw = 'Café “niño” ¿qué? it’s — 🙂👍🏽 línea1\nlínea2\t<b>x</b>';
  const t = await mk({ cards: 1, host: fakeHost({ answer: { result: 'correct', exerciseType: 'fix_error', responseRaw: raw } }) });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  const ev = await t.events();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].responseRaw, raw);
  assert.equal(t.root.querySelectorAll('b').length, 0, 'nada se interpretó como HTML');
});

test('una respuesta enorme o con sustituto suelto no lanza: se guarda o se rechaza con aviso, y se puede seguir', async () => {
  for (const raw of ['x'.repeat(50000), 'a\uD83D', '']) {
    const t = await mk({ cards: 1, host: fakeHost({ answer: { result: 'correct', exerciseType: 'fix_error', responseRaw: raw } }) });
    await openNew(t);
    t.click(t.btn('Comprobar')); await t.flush();
    const n = (await t.events()).length;
    assert.ok(n === 0 || n === 1, 'cero o un evento, nunca más');
    assert.ok(t.btn('Continuar') || t.btn('Comprobar'), 'la vista sigue viva y ofrece cómo seguir');
    assert.equal(t.root.childNodes.length > 0, true);
  }
});

test('reloj hacia atrás entre mostrar y responder: ms nunca negativo y el tiempo no cambia la nota (igual que una medición interrumpida)', async () => {
  const t = await mk({ cards: 1 });
  await openNew(t);
  t.clock.advance(-60000);
  t.click(t.btn('Comprobar')); await t.flush();
  const ev = await t.events();
  assert.equal(ev.length, 1, 'la respuesta se guardó');
  assert.equal(ev[0].ms, 0);
  // Control: misma respuesta con la pestaña oculta más de 3 s (medición interrumpida por otra causa) → misma nota.
  const c = await mk({ cards: 1 });
  await openNew(c);
  c.vis.set(true); c.clock.advance(10000); c.vis.set(false);
  c.click(c.btn('Comprobar')); await c.flush();
  const ev2 = await c.events();
  assert.equal(ev[0].rating, ev2[0].rating, 'la nota no depende del tiempo cuando no es fiable');
});

test('si session.load lanza al abrir una sesión: mensaje de error con «Volver», nada se rompe', async () => {
  const wrapStudy = (s) => ({ ...s, session: { ...s.session, load: async () => { throw new Error('base rota'); } } });
  const t = await mk({ cards: 2, params: { id: 'ses_inexistente' }, wrapStudy });
  assert.ok(t.btn('Volver a Practicar'), 'hay salida');
  assert.ok(t.logs.length >= 1 || t.root.childNodes.length > 0);
  assert.equal(t.q('.session__foot')[0]?.hasAttribute('hidden'), true, 'sin «Continuar» colgado');
  t.view.destroy();
});

test('doble montaje rápido de la misma ruta: queda UN ejercicio, responde UNA vez y no quedan listeners', async () => {
  const t = await mk({ cards: 3 });
  const id = await openNew(t);
  t.view2.destroy();
  const base = t.env.stats.live();
  const a = sesion();
  const pa = a.mount(t.root, { id }, t.services);
  a.destroy(); // el router destruye la vista antes de que termine de prepararse
  const b = sesion();
  const pb = b.mount(t.root, { id }, t.services);
  await Promise.all([pa, pb]); await t.flush();
  assert.equal(t.q('button').filter((x) => x.textContent === 'Comprobar').length, 1, 'un solo ejercicio en pantalla');
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1);
  assert.equal(t.host.calls.mounted.length - t.host.calls.destroyed, 1, 'todo ejercicio montado de más se cerró');
  b.destroy();
  assert.equal(t.env.stats.live(), base, 'sin fugas');
});

test('destroy con la confirmación abierta: se cierra, no queda bloqueo de scroll ni diálogo y no se navega', async () => {
  const t = await mk({ cards: 2 });
  await openNew(t);
  const back = t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  t.click(back); await t.flush();
  assert.ok(t.dialog(), 'la confirmación está abierta');
  assert.equal(t.env.doc.body.classList.contains('no-scroll'), true);
  const navBefore = t.nav.length;
  t.view2.destroy(); await t.flush();
  assert.equal(t.dialog(), null, 'sin diálogo');
  assert.equal(t.env.doc.body.classList.contains('no-scroll'), false, 'scroll liberado');
  assert.equal(t.nav.length, navBefore, 'no navegó por una confirmación cancelada');
  assert.equal((await t.study.session.load()).status, 'restored', 'la sesión guardada se conserva');
});

// FIX 2.1-T3 (hallado con Chromium a 360 px): «Seguir practicando» se partía a media palabra dentro del botón de la confirmación.
// Con DOM falso no se puede medir el ancho; se vigila la causa: palabras largas y etiquetas largas en los botones del diálogo.
test('los botones de la confirmación tienen etiquetas cortas (en 360 px no se parten a media palabra)', async () => {
  const t = await mk({ cards: 2 });
  await openNew(t);
  const back = t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  t.click(back); await t.flush();
  const labels = t.dialog().querySelectorAll('button').map((b) => b.textContent.trim()).filter(Boolean);
  assert.equal(labels.length, 2);
  for (const l of labels) {
    assert.ok(l.length <= 14, `«${l}» es demasiado larga`);
    for (const word of l.split(/\s+/)) assert.ok(word.length <= 9, `la palabra «${word}» de «${l}» no cabe en un botón de 360 px`);
  }
  t.view2.destroy();
});

// FIX 2.1-T3 (hallado con Chromium a 360 px): entre la barra de progreso y el primer bloque no había espacio.
test('el CSS de la cabecera de la sesión deja espacio debajo de la barra', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../ui/styles/components.css', import.meta.url), 'utf8');
  const rule = css.match(/\.session__head\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /(padding-bottom|margin-bottom)\s*:/, 'la regla .session__head debe separar la cabecera del cuerpo');
});
