// @purpose: Pruebas de core/confusables.js y de content/taxonomy/confusables.json.
// Pruebas de core/confusables.js y content/taxonomy/confusables.json (subparte 1.2, cuarto 2A).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createConfusables } from '../core/confusables.js';
import { damerauLevenshtein } from '../core/normalize.js';

const FILE = new URL('../content/taxonomy/confusables.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

test('confusables.json: tiene al menos 60 parejas y las del roadmap', () => {
  assert.ok(data.pairs.length >= 60, `hay ${data.pairs.length}`);
  const c = createConfusables(data);
  for (const [a, b] of [['bad', 'bed'], ['ship', 'sheep'], ['live', 'leave']]) assert.equal(c.areConfusable(a, b), true, `${a}/${b}`);
});

test('confusables.json: es válido, sin duplicados ni palabras raras (lo comprueba el cargador)', () => {
  const c = createConfusables(data);
  assert.equal(c.size, data.pairs.length);
});

test('confusables.json: al menos 40 parejas están a 1 edición (las que deciden "almost")', () => {
  const near = data.pairs.filter(([a, b]) => damerauLevenshtein(a, b) === 1);
  assert.ok(near.length >= 40, `solo ${near.length}`);
});

test('confusables.json: ninguna pareja está a más de 4 ediciones (un typo en la lista la dejaría lejísimos; las homófonas como write/right llegan a 4)', () => {
  for (const [a, b] of data.pairs) assert.ok(damerauLevenshtein(a, b) <= 4, `${a}/${b}`);
});

const small = () => createConfusables({ version: 1, pairs: [['bad', 'bed'], ['its', "it's"], ['bad', 'bid']] });

test('areConfusable: ignora orden, mayúsculas, espacios y apóstrofo curvo', () => {
  const c = small();
  assert.equal(c.areConfusable('bad', 'bed'), true);
  assert.equal(c.areConfusable('bed', 'bad'), true);
  assert.equal(c.areConfusable('BAD', ' Bed '), true);
  assert.equal(c.areConfusable('its', 'it’s'), true);
  assert.equal(c.areConfusable('it’s', 'its'), true);
});

test('areConfusable: false para lo que no está, lo igual y lo que no es texto (sin lanzar)', () => {
  const c = small();
  assert.equal(c.areConfusable('bed', 'bid'), false, 'no hay transitividad');
  assert.equal(c.areConfusable('bad', 'bad'), false);
  assert.equal(c.areConfusable('cat', 'cut'), false);
  assert.equal(c.areConfusable('', ''), false);
  for (const v of [null, undefined, 5, {}, [], NaN]) {
    assert.equal(c.areConfusable(v, 'bad'), false);
    assert.equal(c.areConfusable('bad', v), false);
  }
});

test('partners: devuelve las parejas, una copia nueva, y [] si no hay', () => {
  const c = small();
  assert.deepEqual(c.partners('bad').sort(), ['bed', 'bid']);
  assert.deepEqual(c.partners('BED'), ['bad']);
  assert.deepEqual(c.partners('zzz'), []);
  assert.deepEqual(c.partners(null), []);
  c.partners('bad').push('x');
  assert.deepEqual(c.partners('bad').sort(), ['bed', 'bid']);
});

test('createConfusables: el objeto devuelto está congelado', () => {
  assert.ok(Object.isFrozen(small()));
});

const BAD = [
  [null, /objeto/], [[], /objeto/], ['x', /objeto/],
  [{ pairs: [] }, /version/], [{ version: 2, pairs: [] }, /version/],
  [{ version: 1 }, /pairs/], [{ version: 1, pairs: 'x' }, /pairs/],
  [{ version: 1, pairs: [['a']] }, /pairs\[0\].*2 palabras/],
  [{ version: 1, pairs: [['a', 'b', 'c']] }, /pairs\[0\]/],
  [{ version: 1, pairs: ['ab'] }, /pairs\[0\]/],
  [{ version: 1, pairs: [['bad', 'bed'], ['Bad', 'bid']] }, /pairs\[1\].*"Bad"/],
  [{ version: 1, pairs: [['bad', 5]] }, /"5"/],
  [{ version: 1, pairs: [['bad', 'be d']] }, /"be d"/],
  [{ version: 1, pairs: [['bad', 'bé']] }, /"bé"/],
  [{ version: 1, pairs: [['bad', "it’s"]] }, /pairs\[0\]/],
  [{ version: 1, pairs: [['bad', 'bad']] }, /iguales/],
  [{ version: 1, pairs: [['bad', 'bed'], ['bed', 'bad']] }, /pairs\[1\].*repetida/],
];
for (const [input, re] of BAD) {
  test(`createConfusables: rechaza ${JSON.stringify(input)}`, () => {
    assert.throws(() => createConfusables(input), re);
  });
}

test('createConfusables: una lista vacía es válida', () => {
  const c = createConfusables({ version: 1, pairs: [] });
  assert.equal(c.size, 0);
  assert.equal(c.areConfusable('bad', 'bed'), false);
});
