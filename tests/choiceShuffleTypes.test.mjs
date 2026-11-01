// @purpose: Prueba estadística de barajado de los 9 tipos de elección ya montados (2.3-T3, CA 1): la posición en pantalla de la correcta varía en cada tipo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICE_TYPES, registerChoiceTypes } from '../ui/exercises/choiceTypes.js';
import { createRng, systemRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const TYPES = Object.keys(CHOICE_TYPES);
const WORDS = ['alfa', 'beta', 'gamma', 'delta'];
const RUNS = 600;

// Registro espía: guarda cada componente por tipo para montarlo directo.
function spyRegistry() {
  const table = new Map();
  return { table, register: (type, component) => table.set(type, component) };
}

// Monta el tipo RUNS veces con un mismo rng y cuenta en qué posición de pantalla cae la opción correcta (índice original 0).
function positions(type, rng, options = WORDS) {
  const reg = spyRegistry();
  registerChoiceTypes(reg, { rng, catalog: () => null, log: () => {} });
  const at = new Array(options.length).fill(0);
  for (let i = 0; i < RUNS; i += 1) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    const it = { id: `x.${type}.0001`, type, prompt_es: 'Elige.', data: { options, correct: 0 } };
    reg.table.get(type).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
    const shown = root.querySelectorAll('.ch__option').map((o) => o.querySelector('.ch__text').textContent);
    assert.equal(shown.length, options.length, `${type}: se muestran todas las opciones`);
    assert.deepEqual([...shown].sort(), [...options].sort(), `${type}: ninguna se pierde ni se repite`);
    at[shown.indexOf(options[0])] += 1;
  }
  return at;
}

test('CA 1: en los 9 tipos la correcta cae en cada posición cerca de 1/4 (semilla fija, 4 opciones)', () => {
  assert.equal(TYPES.length, 9);
  for (const type of TYPES) {
    const at = positions(type, createRng(7));
    for (const c of at) assert.ok(c / RUNS > 0.19 && c / RUNS < 0.31, `${type}: ${at}`);
  }
});

test('CA 1: con 2 opciones la correcta se reparte cerca de la mitad en cada tipo', () => {
  for (const type of TYPES) {
    const at = positions(type, createRng(11), ['sí', 'no']);
    for (const c of at) assert.ok(c / RUNS > 0.40 && c / RUNS < 0.60, `${type}: ${at}`);
  }
});

test('CA 1: con el azar del sistema ninguna posición queda vacía ni dominante (cotas anchas)', () => {
  for (const type of TYPES) {
    const at = positions(type, systemRng);
    for (const c of at) assert.ok(c / RUNS > 0.14 && c / RUNS < 0.36, `${type}: ${at}`);
  }
});
