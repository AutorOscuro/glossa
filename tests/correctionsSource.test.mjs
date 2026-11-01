// @purpose: Pruebas de app/correctionsSource.js (2.7-T2): cuenta exacta (CA 2), una sola vez por error, el propio ítem primero, catálogo opcional y fallo que no se traga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createCorrectionsSource } from '../app/correctionsSource.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
async function setup() {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock('2026-10-15T14:00:00.000Z');
  return { errors: createErrors({ db, catalog: CATALOG, clock }), clock };
}
const T = 'gram.present_perfect.for_since';

test('cuenta exacta: cada error distinto cuenta una vez, aunque case por ítem y por tema, y repetirlo no lo duplica', async () => {
  const { errors } = await setup();
  await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', topics: [T], itemId: 'it1', ts: '2026-10-15T10:00:00.000Z' });
  await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', topics: [T], itemId: 'it1', ts: '2026-10-15T11:00:00.000Z' });
  await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', topics: [T], itemId: 'other', ts: '2026-10-15T12:00:00.000Z' });
  await errors.record({ original: 'unrelated', code: 'VRB.CAN_TO', topics: ['gram.other.topic'], itemId: 'zzz', ts: '2026-10-15T13:00:00.000Z' });
  const r = await createCorrectionsSource({ errors, catalog: CATALOG }).forEntry({ itemId: 'it1', topic: T, topics: [T] });
  assert.equal(r.count, 2);
  assert.equal(r.corrections.length, 2);
  assert.equal(r.corrections[0].own, true, 'el error de este ítem va primero');
  assert.equal(r.corrections[0].count, 2, 'la ocurrencia repetida sube el contador del registro, no la lista');
  assert.ok(r.corrections[0].title, 'con catálogo trae el título del código');
});

test('un error de este ítem entra aunque no comparta tema; sin tema ni ítem no hay nada', async () => {
  const { errors } = await setup();
  await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', topics: ['gram.other.topic'], itemId: 'it1' });
  const src = createCorrectionsSource({ errors });
  assert.equal((await src.forEntry({ itemId: 'it1' })).count, 1);
  assert.deepEqual(await src.forEntry({}), { corrections: [], count: 0 });
  assert.deepEqual(await src.forEntry(null), { corrections: [], count: 0 });
  assert.equal((await src.forEntry({ itemId: 'it1' })).corrections[0].title, null, 'sin catálogo no inventa título');
});

test('si errors.list falla, la promesa se rechaza; sin errors no se crea la fuente', async () => {
  const boom = createCorrectionsSource({ errors: { list: async () => { throw new Error('base caída'); } } });
  await assert.rejects(() => boom.forEntry({ itemId: 'a' }), /base caída/);
  assert.throws(() => createCorrectionsSource({}), /errors/);
});
