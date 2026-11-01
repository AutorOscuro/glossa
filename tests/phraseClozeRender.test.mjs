// @purpose: Pruebas del render de phrase_cloze (2.2-T1): turnos, clave en ES y EN, hueco accesible, cajas opcionales, limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhraseCloze, splitKey, PC_TEXT } from '../ui/exercises/phraseCloze.js';
import { makeEnv } from './_fakeDom.mjs';

const base = (extra = {}, data = {}) => ({
  id: 'x', type: 'phrase_cloze', prompt_es: 'No pude enviarlo.',
  data: { text: 'I ___ send it.', answers: [['couldn\'t']], ...data }, ...extra,
});
const mount = (item) => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const m = createPhraseCloze().mount(root, item, { doc: env.doc });
  return { env, root, m };
};
const full = {
  situation: 'Hablar con un compañero', grammar_note_es: 'Couldn\'t ya es pasado.', nuance_es: 'La forma contraída es la común.',
};
const dlg = { key_es: 'no pude', key_en: 'couldn\'t', turns: [
  { who: 'A', es: '¿Pudiste enviar el correo?', en: 'Did you send the email?' },
  { who: 'B', es: 'No, no pude enviarlo.', en: 'No, I ___ send it.' }] };

test('splitKey: resalta la primera aparición sin distinguir mayúsculas y no rompe con vacíos', () => {
  assert.deepEqual(splitKey('No, No pude', 'no pude'), [{ text: 'No, ', key: false }, { text: 'No pude', key: true }]);
  assert.deepEqual(splitKey('hola', 'zz'), [{ text: 'hola', key: false }]);
  assert.deepEqual(splitKey('hola', ''), [{ text: 'hola', key: false }]);
  assert.deepEqual(splitKey(null, 'a'), []);
});

test('mini-diálogo: turnos A/B, clave en ES y EN a la vez, hueco accesible', () => {
  const { root } = mount(base(full, dlg));
  assert.equal(root.querySelectorAll('.pc__turn').length, 4);
  assert.equal(root.querySelectorAll('.pc__who').map((w) => w.textContent).join(''), 'ABAB');
  const keys = root.querySelectorAll('.pc__key').map((k) => k.textContent);
  assert.ok(keys.includes('no pude'), 'clave ES');
  const gap = root.querySelectorAll('.pc__gap');
  assert.equal(gap.length, 1);
  assert.equal(gap[0].getAttribute('aria-label'), PC_TEXT.gap);
  assert.equal(gap[0].getAttribute('role'), 'img');
  assert.ok(!root.textContent.includes('___'), 'el hueco no se pinta como guiones');
});

test('clave en inglés: sin key_en usa answers[0][0] en las partes sin hueco', () => {
  const item = base({}, { text: 'Yes, I couldn\'t but ___ go.', answers: [['could']], turns: undefined });
  const { root } = mount(item);
  assert.equal(root.querySelectorAll('.pc__gap').length, 1);
  assert.equal(root.querySelectorAll('.pc__key').map((k) => k.textContent).join('|'), 'could');
});

test('sin turnos: una frase ES y una EN con hueco; sin cajas ni situación no hay vacíos', () => {
  const { root } = mount(base());
  assert.equal(root.querySelectorAll('.pc__turn').length, 0);
  assert.equal(root.querySelectorAll('.pc__grammar').length, 0);
  assert.equal(root.querySelectorAll('.pc__nuance').length, 0);
  assert.equal(root.querySelectorAll('.pc__situation').length, 0);
  assert.equal(root.querySelectorAll('.pc__gap').length, 1);
});

test('con cajas: gramática (callout) y matiz, y etiqueta de situación', () => {
  const { root } = mount(base(full));
  assert.equal(root.querySelectorAll('.pc__grammar').length, 1);
  assert.equal(root.querySelectorAll('.pc__nuance').length, 1);
  assert.equal(root.querySelectorAll('.pc__situation')[0].textContent, 'Situación: Hablar con un compañero');
});

test('turnos sin hueco en inglés: se añade la frase con hueco', () => {
  const t = { ...dlg, turns: dlg.turns.map((x) => ({ ...x, en: x.en.replace('___', 'could not') })) };
  const { root } = mount(base({}, t));
  assert.equal(root.querySelectorAll('.pc__gap').length, 1);
});

test('el texto del paquete entra como texto, nunca como HTML', () => {
  const { root } = mount(base({ prompt_es: '<img src=x onerror=1> pude', situation: '<b>x</b>' }, { key_es: 'pude' }));
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.ok(root.textContent.includes('<img src=x onerror=1>'));
});

test('ítems inválidos lanzan en español y destroy es idempotente y limpia', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const pc = createPhraseCloze();
  assert.throws(() => pc.mount(root, { type: "fill_verb" }, { doc: env.doc }), /no es phrase_cloze/);
  assert.throws(() => pc.mount(root, { type: "phrase_cloze", data: {} }, { doc: env.doc }), /prompt_es/);
  assert.throws(() => pc.mount(null, base(), {}), /contenedor/);
  const m = pc.mount(root, base(full), { doc: env.doc });
  assert.equal(m.getResponse(), null);
  m.destroy(); m.destroy();
  assert.equal(root.querySelectorAll('.pc').length, 0);
  assert.equal(env.stats.live(), 0);
});

test('el phrase_cloze del paquete de muestra se dibuja completo (turnos, clave, hueco, cajas)', async () => {
  const { readFile } = await import('node:fs/promises');
  const pack = JSON.parse(await readFile(new URL('./fixtures/sample_pack_v1.json', import.meta.url), 'utf8'));
  const item = (pack.items ?? pack).find((i) => i.type === 'phrase_cloze');
  const { root } = mount(item);
  assert.equal(root.querySelectorAll('.pc__turn').length, 4);
  assert.equal(root.querySelectorAll('.pc__gap').length, 1);
  assert.ok(root.querySelectorAll('.pc__key').length >= 1);
  assert.equal(root.querySelectorAll('.pc__grammar').length, 1);
  assert.equal(root.querySelectorAll('.pc__nuance').length, 1);
});
