// @purpose: Pruebas del detector compartido de las pantallas de texto (ui/exercises/detectSource.js, 2.5-T4): catálogo leído al comprobar, reglas puras sin catálogo y nunca lanza.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createDetectSource, readCatalog } from '../ui/exercises/detectSource.js';
import { createErrorCatalog } from '../core/errorCatalog.js';

test('readCatalog: acepta el catálogo o una función; lo que lanza o falta es null', () => {
  const c = { has() {}, get() {} };
  assert.equal(readCatalog(c), c);
  assert.equal(readCatalog(() => c), c);
  for (const bad of [undefined, null, () => { throw new Error('x'); }, () => undefined]) assert.equal(readCatalog(bad), null);
});

test('un detect inyectado manda y su fallo no sale: se avisa a log y no hay avisos', () => {
  const logs = [];
  assert.deepEqual(createDetectSource({ detect: (t) => [{ code: 'A', text: t }] })('hi'), [{ code: 'A', text: 'hi' }]);
  const boom = createDetectSource({ detect: () => { throw new Error('boom'); }, log: (...a) => logs.push(a) });
  assert.deepEqual(boom('hi'), []);
  assert.equal(logs.length, 1);
});

test('sin catálogo válido usa las reglas puras (sin pista) y no lanza', () => {
  for (const catalog of [undefined, null, {}, { has() {} }, () => null]) {
    const hits = createDetectSource({ catalog })('She can to swim.');
    assert.ok(Array.isArray(hits));
    assert.ok(hits.length > 0, String(catalog));
    assert.equal(hits[0].hint, undefined);
  }
});

test('con catálogo real arma el detector y trae la pista; se rearma solo si cambia el catálogo', () => {
  const real = createErrorCatalog(JSON.parse(readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
  const hits = createDetectSource({ catalog: () => real })('She can to swim.');
  assert.ok(hits.length > 0);
  assert.equal(typeof hits[0].hint, 'string');
  let cur = null;
  const d = createDetectSource({ catalog: () => cur });
  assert.equal(d('She can to swim.')[0].hint, undefined);
  cur = real;
  assert.equal(typeof d('She can to swim.')[0].hint, 'string');
});

test('un catálogo que no cuadra con las reglas avisa a log y cae a las reglas puras', () => {
  const logs = [];
  const fake = { has: () => false, get: () => null };
  const hits = createDetectSource({ catalog: fake, log: (...a) => logs.push(a) })('She can to swim.');
  assert.ok(hits.length > 0);
  assert.equal(logs.length, 1);
});
