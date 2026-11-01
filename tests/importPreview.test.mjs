// @purpose: Pruebas del texto de la vista previa al importar un respaldo (ui/views/importPreview.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSummary, IMPORT_MODES } from '../ui/views/importPreview.js';

const totals = (o) => ({ mode: o.mode, totals: { incoming: 0, added: 0, overwritten: 0, unchanged: 0, removed: 0, kept: 0, ...o.t } });

test('fusionar: dice cuántos se añaden y se actualizan y que no se quita nada', () => {
  const s = importSummary(totals({ mode: 'merge', t: { added: 5, overwritten: 2, unchanged: 3, removed: 9 } }));
  assert.match(s, /^Se añadirán 5 datos nuevos y se actualizarán 2 datos\./);
  assert.match(s, /Ya tienes 3 datos idénticos\./);
  assert.match(s, /No se quita nada/);
  assert.doesNotMatch(s, /perderán/, 'al fusionar nunca anuncia pérdidas');
});

test('reemplazar: anuncia lo que se pierde (con singular) y que las claves se conservan', () => {
  const s = importSummary(totals({ mode: 'replace', t: { added: 1, removed: 1 } }));
  assert.match(s, /^Se añadirá 1 dato nuevo\./);
  assert.match(s, /Se perderán 1 dato que el archivo no trae/);
  assert.match(s, /claves de este dispositivo se conservan/);
  assert.match(importSummary(totals({ mode: 'replace', t: { added: 2, removed: 0 } })), /No se pierde nada/);
});

test('sin nada nuevo lo dice claro, y entradas raras no lanzan', () => {
  assert.match(importSummary(totals({ mode: 'merge', t: {} })), /^No hay nada nuevo/);
  for (const bad of [null, undefined, {}, { totals: null }, { mode: 'replace', totals: { added: -3, removed: 'x', overwritten: 1.5 } }]) assert.equal(typeof importSummary(bad), 'string');
});

test('cifras inválidas (negativas, decimales, texto) cuentan como 0', () => {
  assert.match(importSummary({ mode: 'replace', totals: { added: -3, overwritten: 1.5, removed: 'x' } }), /^No hay nada nuevo.*No se pierde nada/);
});

test('los modos son Fusionar y Reemplazar, fusionar primero', () => {
  assert.deepEqual(IMPORT_MODES.map((m) => [m.value, m.label]), [['merge', 'Fusionar'], ['replace', 'Reemplazar']]);
});
