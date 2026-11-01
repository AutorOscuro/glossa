// @purpose: Prueba que todos los tipos de ejercicio del paquete semilla están registrados y que main.js usa el registro compartido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerExerciseTypes } from '../app/exerciseTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/packs/pack_seed_v1.json'), 'utf8'));

test('el registro compartido cubre TODOS los tipos que usa el paquete semilla', () => {
  const r = createExerciseRegistry({ log: () => {} });
  registerExerciseTypes(r, { log: () => {} });
  const used = [...new Set(SEED.items.map((it) => it.type))];
  assert.ok(used.length >= 5);
  for (const t of used) assert.equal(r.has(t), true, `falta registrar «${t}»`);
});

test('registra 30 tipos y no se puede registrar dos veces en el mismo registro', () => {
  const r = createExerciseRegistry({ log: () => {} });
  registerExerciseTypes(r, { log: () => {} });
  assert.equal(r.types().length, 30);
  assert.throws(() => registerExerciseTypes(r, { log: () => {} }), /ya está registrado/);
});

test('el catálogo llega a los tipos de palabra: un fill_verb equivocado con código consulta el catálogo al comprobar', async () => {
  const { makeEnv } = await import('./_fakeDom.mjs');
  const env = makeEnv(); const realDoc = globalThis.document; globalThis.document = env.doc;
  try {
    const item = SEED.items.find((it) => it.type === 'fill_verb');
    let asked = 0;
    const r = createExerciseRegistry({ resolveItem: () => item, log: () => {} });
    registerExerciseTypes(r, { catalog: () => { asked += 1; return null; }, log: () => {} });
    const slot = env.doc.createElement('div'); env.doc.body.appendChild(slot);
    const h = await r.mount(slot, { cardId: `${item.id}#0`, itemId: item.id, facet: 0, topic: item.topics[0], exerciseType: null, kind: 'new', why: 'new', topics: item.topics }, { index: 0, total: 1, submit: async () => ({ status: 'saved' }) });
    assert.ok(h);
    const input = slot.querySelectorAll('input')[0]; input.value = item.distractors[0].text; input.dispatchEvent({ type: 'input', preventDefault() {} });
    slot.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')).dispatchEvent({ type: 'click', preventDefault() {} });
    for (let i = 0; i < 5; i += 1) await env.flush();
    assert.ok(asked > 0, 'el catálogo se consultó al comprobar');
    h.destroy();
  } finally { globalThis.document = realDoc; }
});

test('main.js registra los tipos con el ayudante compartido y ya no los registra a mano', () => {
  const main = fs.readFileSync(path.join(ROOT, 'app/main.js'), 'utf8');
  assert.match(main, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.doesNotMatch(main, /registerChoiceTypes|createPhraseCloze|registerFixError/);
});
