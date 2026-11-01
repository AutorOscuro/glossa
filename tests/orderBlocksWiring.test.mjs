// @purpose: Prueba del cableado de la familia de ordenar en app/main.js (2.4-T1): se importa main.js de verdad y se comprueba que registra los 2 tipos una sola vez y sin errores de arranque.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEnv } from './_fakeDom.mjs';
import { resetFirstRunForTests } from '../app/firstRun.js';
import { CHOICE_TYPES } from '../ui/exercises/choiceTypes.js';

const MAIN = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
let n = 0;
const real = { document: globalThis.document, window: globalThis.window };
afterEach(() => { globalThis.document = real.document; globalThis.window = real.window; });

test('main.js se importa de verdad con los 2 tipos de ordenar registrados y sin errores de arranque', async () => {
  resetFirstRunForTests();
  const env = makeEnv({ hash: '#/ajustes' });
  globalThis.document = env.doc;
  globalThis.window = env.win;
  const errors = [];
  const orig = console.error; console.error = (...a) => errors.push(a);
  try {
    n += 1;
    await import(`../app/main.js?order-wiring=${n}`); // cada importación es una «carga de página» nueva
    for (let i = 0; i < 12; i += 1) await env.flush();
  } finally { console.error = orig; }
  // Si registrar el tipo lanzara (p. ej. «ya está registrado»), main.js lo atrapa y muestra «No se pudo iniciar la app».
  assert.deepEqual(errors.filter((e) => /No se pudo iniciar la app/.test(String(e[0]))), []);
  assert.equal(env.doc.getElementById('boot')?.textContent?.includes('No se pudo iniciar la app') ?? false, false);
});

test('registerOrderTypes se llama una sola vez desde app/exerciseTypes.js, y main.js usa ese ayudante', async () => {
  const ET = (await import('node:fs')).readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  assert.match(ET, /import \{ registerOrderTypes \} from '\.\.\/ui\/exercises\/orderTypes\.js';/);
  assert.equal(ET.match(/registerOrderTypes\(/g).length, 1);
  assert.match(ET, /registerOrderTypes\(registry, \{ log \}\)/);
  assert.ok(!/register\('order_blocks'/.test(ET) && !/register\('order_blocks'/.test(MAIN), 'order_blocks ya no se registra a mano');
  assert.ok(ET.indexOf('registerChoiceTypes(') < ET.indexOf('registerOrderTypes('));
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});

test('los tipos de ordenar no chocan con los de elección ni con phrase_cloze', () => {
  for (const t of ['order_blocks', 'order_dialogue']) {
    assert.ok(!Object.keys(CHOICE_TYPES).includes(t), t);
    assert.notEqual(t, 'phrase_cloze');
  }
});
