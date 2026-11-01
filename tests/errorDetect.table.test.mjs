// @purpose: Tabla de frases reales con su código esperado y frases correctas de control (cero falsos positivos) para el detector de errores.
// Pruebas del cuarto 3, mitad B de la 1.6: CA 2 (tabla de ≥ 40 frases reales con su código esperado) y CA 3 (30 frases correctas de control: cero falsos positivos).
// Las frases reales parten de los errores documentados de William en el roadmap 7.10, puestos en frases completas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrorDetector } from '../core/errorDetect.js';
import { REAL, CONTROL } from './_errorTable.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const D = createErrorDetector({ catalog: CATALOG });

test('CA 2: la tabla real tiene ≥ 40 frases y cada una da su código en el fragmento esperado', () => {
  assert.ok(REAL.length >= 40, `solo ${REAL.length}`);
  for (const [phrase, code, frag] of REAL) {
    const hits = D.detect(phrase);
    const hit = hits.find((h) => h.code === code);
    assert.ok(hit, `«${phrase}» debía dar ${code} y dio [${hits.map((h) => h.code).join(', ')}]`);
    assert.ok(hit.text.toLowerCase().includes(frag.toLowerCase()) || frag.toLowerCase().includes(hit.text.toLowerCase()), `«${phrase}»: señaló «${hit.text}» y se esperaba «${frag}»`);
  }
});

test('CA 2: el código principal (el que anotaría el hook) coincide en casi todas', async () => {
  const v = await D.classify(REAL.map(([original]) => ({ original })));
  const wrong = REAL.filter(([, code], i) => v[i]?.code !== code).map(([p]) => p);
  assert.ok(wrong.length <= 6, `el principal no coincide en: ${wrong.join(' | ')}`); // con varios errores en la frase manda el de más impacto
});

test('CA 3: 30 frases correctas de control (hay 35): cero falsos positivos', () => {
  assert.ok(CONTROL.length >= 30);
  for (const p of CONTROL) assert.deepEqual(D.detect(p).map((h) => `${h.code}:${h.text}`), [], `«${p}» es correcta`);
});

test('las frases de la tabla real no se repiten y cada código esperado existe en el catálogo', () => {
  assert.equal(new Set(REAL.map((r) => r[0])).size, REAL.length);
  for (const [, code] of REAL) assert.ok(CATALOG.has(code), code);
});
