// Pruebas de tests/_helpers.mjs (los ayudantes también necesitan ser fiables).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  makeClock, makeRng, makeItem, makeCard, makeEvent, resetFactories, makeMemoryDb, makeTempRepo,
} from './_helpers.mjs';

test('reloj falso: avanza, fija y valida', () => {
  const c = makeClock('2026-10-15T14:00:00.000Z');
  assert.equal(c.iso(), '2026-10-15T14:00:00.000Z');
  assert.equal(c.advance(1500).nowMs() - Date.parse('2026-10-15T14:00:00.000Z'), 1500);
  assert.equal(c.advanceDays(1).iso(), '2026-10-16T14:00:01.500Z');
  assert.equal(c.set('2030-01-01T00:00:00.000Z').now().getUTCFullYear(), 2030);
  assert.equal(c.advance(-1000).nowMs(), Date.parse('2030-01-01T00:00:00.000Z') - 1000);
  assert.throws(() => makeClock('no es fecha'));
  assert.throws(() => c.advance('x'));
  assert.throws(() => c.advance(NaN));
  assert.throws(() => c.set('???'));
});

test('rng: determinista por semilla, rangos correctos y shuffle es permutación sin mutar', () => {
  const a = makeRng(42), b = makeRng(42), c = makeRng(43);
  const sa = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(sa, Array.from({ length: 20 }, () => b.next()));
  assert.notDeepEqual(sa, Array.from({ length: 20 }, () => c.next()));
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  const r = makeRng(7);
  const ints = Array.from({ length: 500 }, () => r.int(3, 5));
  assert.ok(ints.every((v) => v >= 3 && v <= 5));
  assert.deepEqual([...new Set(ints)].sort(), [3, 4, 5]);
  assert.equal(r.int(9, 9), 9);
  const src = [1, 2, 3, 4, 5, 6];
  const sh = makeRng(1).shuffle(src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...sh].sort(), src);
  assert.deepEqual(makeRng(1).shuffle(src), sh);
  assert.deepEqual(makeRng(1).shuffle([]), []);
  assert.ok(src.includes(makeRng(3).pick(src)));
  assert.throws(() => makeRng(1).pick([]));
  assert.throws(() => makeRng(1).int(5, 1));
  assert.throws(() => makeRng(1).int(1.5, 2));
  assert.throws(() => makeRng(1).shuffle('abc'));
  assert.throws(() => makeRng('x'));
});

test('fábricas: IDs únicos, overrides, copias independientes y reinicio', () => {
  resetFactories();
  const i1 = makeItem(), i2 = makeItem({ type: 'mcq_en_es', topics: ['otro.tema'] });
  assert.equal(i1.id, 't.test.0001');
  assert.notEqual(i1.id, i2.id);
  assert.equal(i2.type, 'mcq_en_es');
  assert.deepEqual(i2.topics, ['otro.tema']);
  i1.accept.push('mutado');
  assert.ok(!makeItem().accept.includes('mutado'));
  const card = makeCard({ itemId: 'g.pp.0001', facet: 2 });
  assert.equal(card.id, 'g.pp.0001#2');
  assert.equal(card.state, 0);
  const ev = makeEvent({ result: 'wrong', rating: 1 });
  assert.equal(ev.result, 'wrong');
  assert.equal(ev.type, 'answer');
  assert.notEqual(makeEvent().id, ev.id);
  resetFactories();
  assert.equal(makeItem().id, 't.test.0001');
});

test('DB mínima: put/get/delete/query/count/export, copias y errores', () => {
  const db = makeMemoryDb();
  const card = makeCard({ itemId: 'a', topics: ['t1', 't2'], state: 2 });
  assert.equal(db.put('cards', card), 'a#0');
  card.state = 99;
  assert.equal(db.get('cards', 'a#0').state, 2);
  assert.equal(db.get('cards', 'no'), null);
  db.put('cards', makeCard({ itemId: 'b', topics: ['t2'], state: 0 }));
  assert.equal(db.query('cards', { index: 'topics', value: 't1' }).length, 1);
  assert.equal(db.query('cards', { index: 'topics', value: 't2' }).length, 2);
  assert.equal(db.query('cards', { index: 'state', value: 0 }).length, 1);
  assert.equal(db.query('cards', { limit: 1 }).length, 1);
  assert.equal(db.query('cards').length, 2);
  db.put('settings', { key: 'tema', value: 'aurora' });
  db.put('plans', { day: '2026-10-15' });
  assert.equal(db.count('cards'), 2);
  assert.equal(db.exportAll().settings[0].value, 'aurora');
  assert.equal(db.delete('cards', 'a#0'), true);
  assert.equal(db.delete('cards', 'a#0'), false);
  assert.throws(() => db.put('inventado', { id: 'x' }));
  assert.throws(() => db.get('inventado', 'x'));
  assert.throws(() => db.put('cards', {}));
  assert.throws(() => db.put('cards', null));
  db.clear();
  assert.equal(db.count('cards'), 0);
  assert.equal(db.getAll('settings').length, 0);
});

test('repo temporal: crea subcarpetas, escribe y limpia', () => {
  const t = makeTempRepo({ 'a/b/c.txt': 'hola ñ 🎉', 'raiz.txt': '' });
  assert.equal(fs.readFileSync(`${t.root}/a/b/c.txt`, 'utf8'), 'hola ñ 🎉');
  t.cleanup();
  assert.equal(fs.existsSync(t.root), false);
  t.cleanup();
});
