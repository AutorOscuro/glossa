// @purpose: Pruebas de la fuente de ejemplos (app/examplesSource.js, 2.7-T1): temas del ítem, ítem actual fuera, exclusión de los que vienen y fallos del cargador.
// 2.7-T1. Sin DOM: el cargador es falso porque el real llega con 2.9-T3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExamplesSource } from '../app/examplesSource.js';

const T1 = 'gram.present_perfect.for_since';
const item = (id, accept, topics = [T1]) => ({ id, type: 'fix_error', topics, prompt_es: 'Corrige.', prompt_en: 'x', accept });
const pool = () => [
  item('g.0001', ['I have lived here for two years.']),
  item('g.0002', ['She has known him since 2019.']),
  item('g.0003', ['We have studied English since March.']),
  item('g.0004', ['They have worked here for a year.']),
];

test('pide al cargador los temas del ítem (sin repetir) y arma la lista sin el ítem actual', async () => {
  const asked = [];
  const src = createExamplesSource({ loadItems: async (ids) => { asked.push(ids); return pool(); } });
  const r = await src.forEntry({ itemId: 'g.0001', topic: T1, topics: [T1] });
  assert.deepEqual(asked, [[T1]]);
  assert.equal(r.enough, true);
  assert.ok(!r.examples.some((e) => e.itemId === 'g.0001'));
});

test('excluye los ítems que la sesión aún no presentó', async () => {
  const src = createExamplesSource({ loadItems: async () => pool() });
  const r = await src.forEntry({ itemId: 'g.0001', topic: T1 }, { excludeItemIds: ['g.0003', 'g.0004'] });
  assert.deepEqual(r.examples.map((e) => e.itemId), ['g.0002']);
  assert.equal(r.enough, false);
});

test('sin temas devuelve un resultado vacío y no llama al cargador; entradas rotas tampoco lanzan', async () => {
  let calls = 0;
  const src = createExamplesSource({ loadItems: async () => { calls += 1; return pool(); } });
  for (const bad of [null, undefined, {}, { topic: '' }, 'x']) {
    const r = await src.forEntry(bad);
    assert.equal(r.count, 0);
  }
  assert.equal(calls, 0);
});

test('si el cargador falla, la promesa se rechaza con ese error; si devuelve algo que no es lista, queda vacío', async () => {
  const boom = createExamplesSource({ loadItems: async () => { throw new Error('sin contenido'); } });
  await assert.rejects(() => boom.forEntry({ itemId: 'x', topic: T1 }), /sin contenido/);
  const odd = createExamplesSource({ loadItems: async () => 'no soy lista' });
  assert.equal((await odd.forEntry({ itemId: 'x', topic: T1 })).count, 0);
});

test('exige loadItems y el objeto devuelto está congelado', () => {
  assert.throws(() => createExamplesSource({}), /loadItems/);
  assert.ok(Object.isFrozen(createExamplesSource({ loadItems: async () => [] })));
});
