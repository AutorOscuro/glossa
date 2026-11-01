// @purpose: Prueba del cableado de la familia de elección en app/main.js (2.3-T3, parte 2): se importa main.js de verdad y se comprueba que registra los 9 tipos sin errores.
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

test('main.js se importa de verdad con los 9 tipos registrados y sin errores de arranque', async () => {
  resetFirstRunForTests();
  const env = makeEnv({ hash: '#/ajustes' });
  globalThis.document = env.doc;
  globalThis.window = env.win;
  const errors = [];
  const orig = console.error; console.error = (...a) => errors.push(a);
  try {
    n += 1;
    await import(`../app/main.js?choice-wiring=${n}`); // cada importación es una «carga de página» nueva
    for (let i = 0; i < 12; i += 1) await env.flush();
  } finally { console.error = orig; }
  // Si registrar un tipo lanzara (p. ej. «ya está registrado»), main.js lo atrapa y muestra «No se pudo iniciar la app».
  assert.deepEqual(errors.filter((e) => /No se pudo iniciar la app/.test(String(e[0]))), []);
  assert.equal(env.doc.getElementById('boot')?.textContent?.includes('No se pudo iniciar la app') ?? false, false);
});

test('registerChoiceTypes se llama una sola vez con un catálogo perezoso desde app/exerciseTypes.js, y main.js usa ese ayudante', async () => {
  const ET = (await import('node:fs')).readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  assert.match(ET, /import \{ registerChoiceTypes \} from '\.\.\/ui\/exercises\/choiceTypes\.js';/);
  assert.equal(ET.match(/registerChoiceTypes\(/g).length, 1);
  assert.match(ET, /registerChoiceTypes\(registry, \{ catalog, log \}\)/);
  assert.ok(ET.indexOf("register('phrase_cloze'") < ET.indexOf('registerChoiceTypes('));
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});

test('los 9 tipos de la tabla no chocan con phrase_cloze', () => {
  assert.ok(!Object.keys(CHOICE_TYPES).includes('phrase_cloze'));
});
