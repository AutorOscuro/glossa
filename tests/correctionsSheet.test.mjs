// @purpose: Pruebas de la hoja «Correcciones» (ui/correctionsSheet.js, 2.7-T2): carga en cada apertura, lo escrito y lo correcto, vacío amable, fallo sin culpa y cierre antes de la carga.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createCorrectionsSheet, CO_TEXT } from '../ui/correctionsSheet.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const co = (over = {}) => ({ id: 'e1', original: "I didn't can", correction: "I couldn't", code: 'VRB.CAN_TO', title: 'can + to', hint: 'Después de can va el verbo solo.', count: 1, own: true, ...over });
function setup(load) {
  const env = makeEnv(); globalThis.document = env.doc;
  const logs = [];
  const s = createCorrectionsSheet({ doc: env.doc, load, log: (...a) => logs.push(a) });
  const text = () => env.doc.body.querySelectorAll('.corrections')[0]?.textContent ?? '';
  return { env, s, logs, text };
}

test('pinta «Buscando…» y después lo que escribió, lo correcto, la pista y las veces', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = setup(async () => { await gate; return { corrections: [co({ count: 3 })], count: 1 }; });
  const opening = t.s.open();
  assert.match(t.text(), /Buscando tus correcciones/);
  release(); await opening; await t.env.flush();
  assert.match(t.text(), /Escribiste: I didn't can/);
  assert.match(t.text(), /Mejor: I couldn't/);
  assert.match(t.text(), /Después de can va el verbo solo/);
  assert.match(t.text(), /Ha salido 3 veces/);
});

test('sin correcciones: mensaje amable y sin lista; sin corrección ni pista solo muestra lo escrito', async () => {
  const empty = setup(async () => ({ corrections: [], count: 0 }));
  await empty.s.open(); await empty.env.flush();
  assert.match(empty.text(), /Todavía no tienes correcciones/);
  const bare = setup(async () => ({ corrections: [co({ correction: null, hint: null, title: null })], count: 1 }));
  await bare.s.open(); await bare.env.flush();
  assert.doesNotMatch(bare.text(), /Mejor:/);
  assert.doesNotMatch(bare.text(), /Ha salido/);
});

test('si load falla: aviso sin culpa, motivo al log, ejercicio como estaba; load se llama en cada apertura', async () => {
  let n = 0;
  const t = setup(async () => { n += 1; if (n === 1) throw new Error('base caída'); return { corrections: [], count: 0 }; });
  await t.s.open(); await t.env.flush();
  assert.match(t.text(), new RegExp(CO_TEXT.failed.slice(0, 25)));
  assert.match(t.text(), /Tu ejercicio sigue como lo dejaste/);
  assert.equal(t.logs.length, 1);
  t.s.close(); await t.s.open(); await t.env.flush();
  assert.equal(n, 2);
});

test('cerrar antes de que llegue la carga no pinta nada tarde; destroy es seguro dos veces', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = setup(async () => { await gate; return { corrections: [co()], count: 1 }; });
  const opening = t.s.open();
  t.s.close(); release(); await opening; await t.env.flush();
  assert.doesNotMatch(t.text(), /Escribiste/);
  t.s.destroy(); t.s.destroy();
  assert.equal(t.s.isOpen(), false);
});

test('load debe ser función', () => {
  assert.throws(() => createCorrectionsSheet({}), /load/);
});
