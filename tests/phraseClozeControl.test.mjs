// @purpose: Prueba del FIX de phrase_cloze (2.4-T1, punto 9): responseRaw nunca trae un carácter de control que el evento rechace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { validateEvent } from '../core/eventSchema.js';
import { makeEvent } from './_helpers.mjs';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type) => ({ type, preventDefault() {} });
const item = () => ({
  id: 'x', type: 'phrase_cloze', prompt_es: 'No pude enviarlo.', explain_es: 'Usa couldn\'t + verbo base.',
  accept: ['No, I couldn\'t send it.'], data: { text: 'No, I ___ send it.', answers: [['couldn\'t']] },
});

async function answerWith(typedText) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const m = createPhraseCloze().mount(root, item(), { doc: env.doc, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  const inp = root.querySelectorAll('input')[0];
  inp.value = typedText;
  inp.dispatchEvent(ev('input'));
  root.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')).dispatchEvent(ev('click'));
  await env.flush();
  return { calls, m };
}
// id y day los asigna events.log(): no se envían (TRAMPA-28).
const asEvent = (a) => { const e = makeEvent({ responseRaw: a.responseRaw, result: a.result, rating: 1 }); delete e.id; delete e.day; return e; };

test('responseRaw nunca trae un carácter que el evento rechace (se barren los códigos 0 a 0x9F)', async () => {
  for (let code = 0; code <= 0x9f; code += 1) {
    const { calls } = await answerWith(`can${String.fromCharCode(code)}x`);
    assert.equal(calls.length, 1, `U+${code.toString(16)}: debe haber un envío`);
    const v = validateEvent(asEvent(calls[0]));
    assert.equal(v.ok, true, `U+${code.toString(16).padStart(4, '0')} deja responseRaw inválido: ${JSON.stringify(v.problems)}`);
  }
});

test('los de control se cambian por espacio (uno por uno), tab y salto de línea se conservan', async () => {
  const { calls } = await answerWith('a\u0007b\u0085c\td');
  assert.equal(calls[0].responseRaw, 'No, I a b c\td send it.');
  assert.equal(calls[0].result, 'wrong');
});

test('lo que se muestra no cambia: getResponse conserva el texto tecleado tal cual', async () => {
  const { m } = await answerWith('can\u0007x');
  assert.equal(m.getResponse(), 'No, I can\u0007x send it.');
});

test('un campo lleno (200) de caracteres de control: todos pasan a espacio y el evento es válido', async () => {
  // El campo real limita a 200 por hueco (maxLength), así que el recorte a 2000 no se alcanza por la pantalla.
  const { calls } = await answerWith('\u0001'.repeat(200));
  assert.equal(calls[0].responseRaw, `No, I ${' '.repeat(200)} send it.`);
  assert.equal(validateEvent(asEvent(calls[0])).ok, true);
});

test('un texto normal pasa sin cambios', async () => {
  const { calls } = await answerWith('couldn\'t');
  assert.equal(calls[0].responseRaw, 'No, I couldn\'t send it.');
  assert.equal(calls[0].result, 'correct');
});

test('lo que el evento sí acepta no se toca: tab, salto de línea, retorno y desde U+00A0', async () => {
  const keep = [0x09, 0x0a, 0x0d, 0x2028, 0x200b];
  for (let c = 0xa0; c <= 0x2ff; c += 1) keep.push(c);
  for (const code of keep) {
    const ch = String.fromCharCode(code);
    const { calls } = await answerWith(`can${ch}x`);
    assert.equal(calls[0].responseRaw, `No, I can${ch}x send it.`, `U+${code.toString(16)} no debe cambiar`);
  }
});
