// @purpose: Criterios de aceptación 1 a 6 de la subparte 2.1 con el registro de ejercicios real, la vista real y los servicios de estudio reales sobre base en memoria.
// 2.1-T4. Ítems de prueba (hasta que 2.9 traiga paquetes): it000 e it002 son del tipo registrado `fix_error`; it001 es un tipo futuro sin componente.
// Cada prueba nombra su criterio (CA n) para que la evidencia se pueda buscar con grep.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew } from './_sesionHarness.mjs';
import sesion from '../ui/views/sesion.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const ITEMS = {
  it000: { id: 'it000', type: 'fix_error', topics: ['gram.be.present_forms'] },
  it001: { id: 'it001', type: 'listen_future', topics: ['gram.be.present_forms'] },
  it002: { id: 'it002', type: 'fix_error', topics: ['gram.be.present_forms'] },
};

// Componente de prueba: dibuja «Comprobar» y responde por ctx.submit. Guarda cuántas veces se montó y se cerró.
function makeRegistry({ types = ['fix_error'], items = ITEMS, result = 'correct' } = {}) {
  const calls = { mounted: [], destroyed: 0, results: [] };
  const component = {
    async mount(container, item, ctx) {
      calls.mounted.push(item.id);
      const doc = globalThis.document;
      const b = doc.createElement('button'); b.textContent = 'Comprobar';
      const on = async () => { calls.results.push(await ctx.submit({ result })); };
      b.addEventListener('click', on);
      container.appendChild(b);
      return { destroy() { calls.destroyed += 1; b.removeEventListener('click', on); b.remove(); }, getResponse: () => ({ result }) };
    },
  };
  const registry = createExerciseRegistry({ resolveItem: async (id) => items[id] ?? null, log: () => {} });
  for (const t of types) registry.register(t, component);
  return { registry, calls };
}
const setup = async (opts = {}, over = {}) => {
  const r = makeRegistry(opts);
  const t = await mk({ host: r.registry, ...over });
  t.calls = r.calls;
  return t;
};
const cardsById = async (t) => Object.fromEntries((await t.db.query('cards', {})).map((c) => [c.id, c]));
const answer = async (t) => { t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush(); };
const cont = async (t) => { t.click(t.btn('Continuar')); await t.flush(); };

test('CA 1 · flujo completo con ítems de prueba: tres ítems → resumen, sesión guardada borrada, cada ejercicio cerrado', async () => {
  const t = await setup({ types: ['fix_error', 'listen_future'] });
  await openNew(t);
  for (let i = 0; i < 3; i += 1) { assert.equal(t.progressText(), `${i}/3`); await answer(t); await cont(t); }
  assert.match(t.root.textContent, /Sesión terminada/);
  assert.match(t.root.textContent, /Ejercicios3/);
  assert.equal(t.progressText(), '3/3');
  assert.deepEqual(t.calls.mounted, ['it000', 'it001', 'it002']);
  assert.equal(t.calls.destroyed, 3);
  assert.deepEqual(await t.study.session.load(), { status: 'none' });
  assert.equal((await t.events()).length, 3);
});

test('CA 1 · un tipo sin componente muestra «no soportado todavía», «Saltar por ahora» avanza sin evento y sin tocar la tarjeta, y el resto del flujo sigue', async () => {
  const t = await setup({ types: ['fix_error'] });
  await openNew(t);
  const before = await cardsById(t);
  await answer(t); await cont(t);
  assert.match(t.root.textContent, /todavía/i);
  assert.ok(t.btn('Saltar por ahora'));
  t.click(t.btn('Saltar por ahora')); await t.flush();
  assert.equal((await t.events()).length, 1, 'saltar no escribe evento');
  assert.deepEqual((await cardsById(t))['it001#0'], before['it001#0'], 'saltar no toca la tarjeta');
  await cont(t);
  await answer(t); await cont(t);
  assert.match(t.root.textContent, /Ejercicios2/, 'el resumen cuenta lo que tiene evento: el saltado no cuenta');
  assert.equal((await t.events()).length, 2);
});

test('CA 1 · sin paquetes (resolvedor que no encuentra nada) todo cae en la pantalla amable y la sesión se puede recorrer saltando', async () => {
  const t = await setup({ items: {} });
  await openNew(t);
  for (let i = 0; i < 3; i += 1) {
    assert.match(t.root.textContent, /todavía/i);
    t.click(t.btn('Saltar por ahora')); await t.flush(); await cont(t);
  }
  assert.match(t.root.textContent, /Sesión sin ejercicios/);
  assert.doesNotMatch(t.root.textContent, /NaN|undefined/);
  assert.equal((await t.events()).length, 0);
});

test('CA 2 · cerrar y reabrir a mitad restaura el estado: ítem 2, barra 1/3, sin repetir el evento', async () => {
  const t = await setup();
  const id = await openNew(t);
  await answer(t);
  t.view2.destroy();
  const second = makeRegistry({ types: ['fix_error', 'listen_future'] });
  const again = sesion();
  t.root.replaceChildren();
  await again.mount(t.root, { id }, { ...t.services, exercises: second.registry });
  assert.equal(t.progressText(), '1/3');
  assert.deepEqual(second.calls.mounted, ['it001'], 'el siguiente es el 2.º ítem, no se repite el primero');
  assert.equal((await t.events()).length, 1);
  await answer(t); await cont(t); await answer(t); await cont(t);
  assert.match(t.root.textContent, /Ejercicios3/);
  assert.equal((await t.events()).length, 3);
  again.destroy();
});

test('CA 3 · cada respuesta produce exactamente 1 evento y 1 actualización de tarjeta (y solo de su tarjeta)', async () => {
  const t = await setup({ types: ['fix_error', 'listen_future'] });
  await openNew(t);
  let prev = await cardsById(t);
  for (let i = 0; i < 3; i += 1) {
    const cardId = `it00${i}#0`;
    await answer(t);
    const evs = await t.events();
    assert.equal(evs.length, i + 1);
    assert.equal(evs.filter((e) => e.cardId === cardId).length, 1);
    const now = await cardsById(t);
    assert.equal(now[cardId].reps, prev[cardId].reps + 1, 'la tarjeta respondida avanzó una repetición');
    for (const other of Object.keys(now).filter((k) => k !== cardId)) assert.deepEqual(now[other], prev[other], `${other} no cambió`);
    prev = now;
    await cont(t);
  }
});

test('CA 4 · doble toque en «Comprobar» no duplica el evento (3 clics seguidos y 2 envíos directos)', async () => {
  const t = await setup();
  await openNew(t);
  const b = t.btn('Comprobar');
  t.click(b); t.click(b); t.click(b);
  await t.flush();
  assert.equal((await t.events()).length, 1);
  assert.deepEqual(t.calls.results.map((r) => r.status).sort(), ['ignored', 'ignored', 'saved']);
  const reps = (await cardsById(t))['it000#0'].reps;
  t.click(b); await t.flush();
  assert.equal((await t.events()).length, 1);
  assert.equal((await cardsById(t))['it000#0'].reps, reps, 'la tarjeta tampoco se actualizó dos veces');
});

test('CA 5 · «atrás» (flecha de la cabecera) pide confirmación; «Seguir» se queda; «Salir» conserva lo respondido', async () => {
  const t = await setup();
  await openNew(t);
  await answer(t);
  const back = () => t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
  const navs = t.nav.length;
  t.click(back()); await t.flush();
  assert.ok(t.dialog());
  assert.equal(t.nav.length, navs, 'todavía no salió');
  t.click(t.dlgBtn('Seguir')); await t.flush();
  assert.equal(t.nav.length, navs, '«Seguir» no navega');
  assert.ok(t.btn('Continuar'), 'la pantalla sigue como estaba');
  t.click(back()); await t.flush();
  const navsBefore = t.nav.length;
  t.click(t.dlgBtn('Salir')); await t.flush();
  assert.match(t.root.textContent, /Sesión a medias/, 'con respuestas, salir muestra el resumen parcial');
  assert.equal(t.nav.length, navsBefore, 'todavía no navegó: primero ve su resumen');
  t.click(t.btn('Volver a Practicar')); await t.flush();
  assert.deepEqual(t.nav.at(-1), ['practicar', undefined, undefined]);
  assert.equal((await t.study.session.load()).status, 'restored', 'la sesión guardada se conserva para retomarla');
  assert.equal((await t.events()).length, 1);
});

test('CA 6 · el tiempo con la pestaña oculta se ignora (visibilidad simulada)', async () => {
  const t = await setup();
  await openNew(t);
  t.clock.advance(1000);
  t.vis.set(true); t.clock.advance(40000); t.vis.set(false);
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});

test('el tipo del plan y el del ítem coinciden con lo que se mostró: el registro no monta un tipo ajeno', async () => {
  const t = await setup({ items: { ...ITEMS, it000: { ...ITEMS.it000, type: 'listen_future' } }, types: ['fix_error'] });
  await openNew(t);
  assert.deepEqual(t.calls.mounted, [], 'it000 es de un tipo sin componente: no se monta el de otro');
  assert.match(t.root.textContent, /todavía/i);
});
