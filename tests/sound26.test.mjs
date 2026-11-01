// @purpose: Pruebas del sonido de la sesión (2.6-T3, punto 2 del encargo): decisión pura, motor Web Audio falso y vista de sesión real.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { soundFor, soundForFinish, TONES } from '../core/feedbackCues.js';
import { createSoundEngine } from '../app/soundEngine.js';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

function fakeAudio({ failCreate = false, suspended = false, throwOnOsc = false } = {}) {
  const log = { created: 0, osc: 0, resumed: 0, closed: 0, freqs: [] };
  class AC {
    constructor() { if (failCreate) throw new Error('no permitido'); log.created += 1; this.state = suspended ? 'suspended' : 'running'; this.currentTime = 1; this.destination = {}; }
    resume() { log.resumed += 1; return Promise.reject(new Error('bloqueado')); }
    close() { log.closed += 1; return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { if (throwOnOsc) throw new Error('osc'); log.osc += 1; const o = { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; log.freqs.push(o); return o; }
  }
  return { win: { AudioContext: AC }, log };
}

test('soundFor: solo acertar suena, y solo con el ajuste en true', () => {
  assert.equal(soundFor('correct', true), 'correct');
  for (const r of ['wrong', 'dont_know', 'dont', 'almost', 'skipped', '', undefined, null, 'toString', '__proto__', {}]) assert.equal(soundFor(r, true), null, String(r));
  for (const e of [false, undefined, null, 0, 1, 'true', {}]) assert.equal(soundFor('correct', e), null, String(e));
  assert.equal(soundForFinish(true), 'finish');
  for (const e of [false, undefined, null, 'true', 1]) assert.equal(soundForFinish(e), null);
  assert.ok(Object.isFrozen(TONES) && Object.isFrozen(TONES.correct) && Object.isFrozen(TONES.correct[0]));
  for (const notes of Object.values(TONES)) for (const n of notes) assert.ok(n.gain > 0 && n.gain <= 0.1 && n.freq > 100 && n.freq < 2000);
});

test('motor: sin Web Audio, con constructor que lanza o con nombre raro, no lanza y devuelve false', () => {
  for (const win of [{}, null, undefined, { AudioContext: 5 }, fakeAudio({ failCreate: true }).win]) {
    const e = createSoundEngine({ win });
    assert.equal(e.unlock(), false); assert.equal(e.play('correct'), false); e.destroy();
  }
  const { win, log } = fakeAudio();
  const e = createSoundEngine({ win });
  for (const n of ['nope', '__proto__', 'toString', '', undefined, null, 7, {}]) assert.equal(e.play(n), false, String(n));
  assert.equal(log.created, 0, 'un nombre inválido no crea contexto');
});

test('motor: toca las notas del tono, crea el contexto una vez y tolera resume rechazado', async () => {
  const { win, log } = fakeAudio({ suspended: true });
  const e = createSoundEngine({ win });
  assert.equal(e.unlock(), true);
  assert.equal(e.play('correct'), true);
  assert.equal(e.play('finish'), true);
  assert.equal(log.created, 1);
  assert.equal(log.osc, TONES.correct.length + TONES.finish.length);
  assert.ok(log.resumed >= 1);
  await new Promise((r) => setTimeout(r, 0)); // el rechazo de resume() no debe escapar como error sin manejar
  e.destroy();
  assert.equal(log.closed, 1);
  assert.equal(e.play('correct'), false);
  assert.equal(e.unlock(), false);
});

test('motor: un fallo al crear osciladores se traga en silencio', () => {
  const e = createSoundEngine({ win: fakeAudio({ throwOnOsc: true }).win });
  assert.equal(e.play('correct'), false);
});

function spy() { const calls = []; return { calls, play: (n) => { calls.push(['play', n]); return true; }, unlock: () => calls.push(['unlock']), destroy: () => calls.push(['destroy']) }; }
const settings = (v) => ({ get: (k) => (k === 'sounds' ? v : undefined) });
const plays = (s) => s.calls.filter((c) => c[0] === 'play').map((c) => c[1]);

for (const [result, expected] of [['correct', ['correct']], ['wrong', []], ['dont_know', []], ['almost', []]]) {
  test(`vista de sesión: tras «${result}» suena ${JSON.stringify(expected)}`, async () => {
    const sound = spy();
    const t = await mk({ host: fakeHost({ answer: { result, exerciseType: 'fix_error' } }), services: { sound, settings: settings(true) } });
    await openNew(t);
    t.click(t.btn('Comprobar')); await t.flush();
    assert.deepEqual(plays(sound), expected);
    assert.ok(t.btn('Continuar'), '«Continuar» aparece');
  });
}

test('vista de sesión: con `sounds` en false no suena ni al acertar ni al cerrar', async () => {
  const sound = spy();
  const t = await mk({ cards: 1, services: { sound, settings: settings(false) } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.click(t.btn('Continuar')); await t.flush();
  assert.deepEqual(plays(sound), []);
});

test('vista de sesión: acertar y cerrar la sesión suenan «correct» y luego «finish»; sin ajustes sigue el valor por defecto (suena)', async () => {
  const sound = spy();
  const t = await mk({ cards: 1, services: { sound } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.click(t.btn('Continuar')); await t.flush();
  assert.deepEqual(plays(sound), ['correct', 'finish']);
});

test('vista de sesión: un motor que lanza o un ajuste que lanza no bloquea «Continuar»', async () => {
  const bad = { play() { throw new Error('boom'); }, unlock() { throw new Error('boom'); }, destroy() { throw new Error('boom'); } };
  const t = await mk({ cards: 2, services: { sound: bad, settings: { get() { throw new Error('ajustes'); } } } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal(t.q('.session__foot')[0].hasAttribute('hidden'), false, '«Continuar» queda a la vista aunque el sonido falle');
  t.click(t.btn('Continuar')); await t.flush();
  assert.equal(t.q('.session__foot')[0].hasAttribute('hidden'), true, 'y avanza al siguiente ejercicio');
});

test('vista de sesión: un motor que lanza al sonar (con sonido activo) no impide mostrar «Continuar»', async () => {
  const bad = { play() { throw new Error('boom'); }, unlock() {}, destroy() {} };
  const t = await mk({ cards: 2, services: { sound: bad, settings: settings(true) } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal(t.q('.session__foot')[0].hasAttribute('hidden'), false);
});

test('vista de sesión: un motor inyectado desde fuera no se cierra al salir de la vista', async () => {
  const sound = spy();
  const t = await mk({ services: { sound } });
  await openNew(t);
  t.view2.destroy();
  assert.equal(sound.calls.filter((c) => c[0] === 'destroy').length, 0);
});

test('vista de sesión: el primer toque o tecla prepara el sonido (gesto de la persona)', async () => {
  const sound = spy();
  const t = await mk({ services: { sound } });
  await openNew(t);
  const sec = t.q('.session')[0];
  sec.dispatchEvent({ type: 'pointerdown' }); sec.dispatchEvent({ type: 'keydown' });
  assert.equal(sound.calls.filter((c) => c[0] === 'unlock').length, 2);
});
