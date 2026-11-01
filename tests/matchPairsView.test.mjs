// @purpose: Pruebas del componente de emparejar (ui/exercises/matchPairs.js, 2.4-T2 punto 3) con DOM falso: toques, feedback por pareja, envío al completar, «No sé», errores de envío y casos límite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchPairs, MA_TEXT } from '../ui/exercises/matchPairs.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const PAIRS = [{ left: 'dog', right: 'perro' }, { left: 'cat', right: 'gato' }, { left: 'bird', right: 'pájaro' }];
const item = (extra = {}, data = {}) => ({ id: 'g.mp.0001', type: 'match_pairs', prompt_es: 'Une cada palabra con su traducción.', situation: 'Animales', data: { pairs: PAIRS, ...data }, ...extra });

function setup({ it = item(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const logs = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  const comp = createMatchPairs({ rng: createRng(7), log: (...a) => logs.push(a), ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const cards = () => root.querySelectorAll('.ma__card');
  const lefts = () => root.querySelectorAll('.ma__card--left');
  const rights = () => root.querySelectorAll('.ma__card--right');
  const L = (text) => lefts().find((b) => b.getAttribute('data-index') !== null && it.data.pairs[Number(b.dataset.index)].left === text);
  const R = (text) => rights().find((b) => b.dataset.index !== undefined && [...it.data.pairs.map((p) => p.right), ...(it.data.extra_right ?? [])][Number(b.dataset.index)] === text);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const join = (l, r) => { click(L(l)); click(R(r)); };
  const msg = () => root.querySelector('.ma__msg').textContent;
  return { env, root, comp, calls, logs, cards, lefts, rights, L, R, btn, join, msg };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('monta las dos columnas, las tarjetas, el progreso y «No sé» a la vista', () => {
  const s = setup();
  assert.equal(s.lefts().length, 3);
  assert.equal(s.rights().length, 3);
  assert.deepEqual(s.lefts().map((b) => b.textContent), ['dog', 'cat', 'bird']);
  assert.deepEqual(s.rights().map((b) => b.textContent).sort(), ['gato', 'perro', 'pájaro']);
  assert.ok(s.btn(MA_TEXT.dontKnow));
  assert.equal(s.root.querySelector('.ma__progress').textContent, MA_TEXT.progress(0, 3));
  assert.ok(s.root.querySelector('.ma__situation').textContent.includes('Animales'));
  assert.equal(s.btn(MA_TEXT.retry).hasAttribute('hidden'), true);
});

test('la columna derecha no queda en el orden del contenido (muchas semillas)', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const s = setup({ factory: { rng: createRng(seed) } });
    assert.notDeepEqual(s.rights().map((b) => b.textContent), ['perro', 'gato', 'pájaro'], `semilla ${seed}`);
  }
});

test('con distractores hay más tarjetas a la derecha que a la izquierda', () => {
  const s = setup({ it: item({}, { extra_right: ['pez', 'vaca'] }) });
  assert.equal(s.lefts().length, 3);
  assert.equal(s.rights().length, 5);
});

test('un toque elige; el mismo toque lo quita', () => {
  const s = setup();
  click(s.L('dog'));
  assert.equal(s.L('dog').getAttribute('aria-pressed'), 'true');
  assert.ok(s.L('dog').classList.contains('is-selected'));
  click(s.L('dog'));
  assert.equal(s.L('dog').getAttribute('aria-pressed'), 'false');
});

test('acierto al instante: las dos tarjetas quedan bloqueadas con su número y «✓»', () => {
  const s = setup();
  s.join('cat', 'gato');
  for (const b of [s.L('cat'), s.R('gato')]) {
    assert.ok(b.classList.contains('is-done'));
    assert.equal(b.getAttribute('aria-disabled'), 'true');
    assert.ok(b.querySelector('.ma__tag').textContent.includes('✓ 1'));
    assert.ok(b.getAttribute('aria-label').includes('pareja 1'));
  }
  assert.equal(s.msg(), MA_TEXT.hit);
  assert.equal(s.root.querySelector('.ma__progress').textContent, MA_TEXT.progress(1, 3));
});

test('fallo al instante: las dos se marcan hasta el siguiente toque y nada se resuelve', () => {
  const s = setup();
  s.join('dog', 'gato');
  assert.ok(s.L('dog').classList.contains('is-miss'));
  assert.ok(s.R('gato').classList.contains('is-miss'));
  assert.ok(!s.L('dog').classList.contains('is-done'));
  assert.equal(s.msg(), MA_TEXT.miss('dog', 'gato'));
  assert.ok(s.L('dog').getAttribute('aria-label').includes('✗'));
  click(s.L('cat'));
  assert.ok(!s.L('dog').classList.contains('is-miss'));
  assert.ok(!s.R('gato').classList.contains('is-miss'));
});

test('se puede empezar por la derecha', () => {
  const s = setup();
  click(s.R('perro'));
  click(s.L('dog'));
  assert.ok(s.L('dog').classList.contains('is-done'));
});

test('doble toque sobre una pareja resuelta no hace nada', () => {
  const s = setup();
  s.join('dog', 'perro');
  click(s.L('dog'));
  click(s.L('dog'));
  click(s.R('perro'));
  assert.equal(s.root.querySelector('.ma__progress').textContent, MA_TEXT.progress(1, 3));
  assert.equal(s.L('dog').getAttribute('aria-pressed'), null);
  assert.equal(s.calls.length, 0);
});

test('las tarjetas no se mueven de sitio al emparejar', () => {
  const s = setup();
  const before = s.rights().map((b) => b.dataset.index);
  s.join('dog', 'perro');
  s.join('cat', 'pájaro');
  s.join('cat', 'gato');
  assert.deepEqual(s.rights().map((b) => b.dataset.index), before);
});

test('al resolver la última pareja se envía solo, correct y sin fallos', async () => {
  const s = setup();
  s.join('dog', 'perro');
  s.join('cat', 'gato');
  assert.equal(s.calls.length, 0);
  s.join('bird', 'pájaro');
  await tick();
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.calls[0], { result: 'correct', hint: false, responseRaw: 'dog = perro; cat = gato; bird = pájaro', errorCodes: [] });
  assert.ok(s.root.querySelector('.fb__verdict--correct'));
  assert.equal(s.root.querySelector('.ma__correct'), null);
  assert.ok(s.root.querySelector('.ma__actions').hasAttribute('hidden'));
});

test('completar con fallos envía wrong, con el texto de los intentos, y muestra las parejas', async () => {
  const s = setup();
  s.join('dog', 'gato');
  s.join('dog', 'perro');
  s.join('cat', 'gato');
  s.join('bird', 'pájaro');
  await tick();
  assert.equal(s.calls[0].result, 'wrong');
  assert.equal(s.calls[0].responseRaw, 'dog = gato; dog = perro; cat = gato; bird = pájaro');
  assert.ok(s.root.querySelector('.fb__verdict').textContent.includes(MA_TEXT.withMistakes(1)));
  assert.ok(s.root.querySelector('.ma__correct').textContent.includes('dog = perro'));
});

test('lo que se envía pasa por toResponseRaw: los controles que el evento rechaza se cambian por espacio', async () => {
  const it = item({}, { pairs: [{ left: 'a\u0085b', right: 'x\u0001y' }, { left: 'c', right: 'd' }] });
  const s = setup({ it });
  s.join('a\u0085b', 'x\u0001y');
  s.join('c', 'd');
  await tick();
  assert.equal(s.calls[0].responseRaw, 'a b = x y; c = d');
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(s.calls[0].responseRaw));
});

test('«No sé» envía dont_know sin respuesta y muestra todas las parejas', async () => {
  const s = setup();
  s.join('dog', 'perro');
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.ok(s.root.querySelector('.fb__verdict--dont'));
  assert.ok(s.root.querySelector('.ma__correct').textContent.includes('bird = pájaro'));
  assert.equal(s.comp.getResponse(), null);
});

test('después de enviar no hay más toques ni un segundo envío', async () => {
  const s = setup();
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  click(s.L('dog'));
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.calls.length, 1);
});

test('doble envío rápido: «No sé» dos veces envía una sola vez', async () => {
  const s = setup();
  const b = s.btn(MA_TEXT.dontKnow);
  click(b);
  click(b);
  await tick();
  assert.equal(s.calls.length, 1);
});

test('si el envío falla al completar: aviso, «Enviar otra vez» y las tarjetas siguen igual', async () => {
  let fail = true;
  const s = setup({ submit: () => (fail ? { status: 'error' } : { status: 'saved' }) });
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  assert.equal(s.msg(), MA_TEXT.saveFail);
  assert.equal(s.btn(MA_TEXT.retry).hasAttribute('hidden'), false);
  assert.ok(s.L('dog').classList.contains('is-done'));
  fail = false;
  click(s.btn(MA_TEXT.retry));
  await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].responseRaw, s.calls[0].responseRaw);
  assert.ok(s.root.querySelector('.fb__verdict--correct'));
});

test('si el envío lanza una excepción, se trata como error (no se pierde nada)', async () => {
  const s = setup({ submit: () => { throw new Error('boom'); } });
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.msg(), MA_TEXT.saveFail);
  assert.equal(s.btn(MA_TEXT.dontKnow).getAttribute('aria-disabled') ?? null, null);
});

test('submit con mensaje propio lo muestra', async () => {
  const s = setup({ submit: () => ({ status: 'error', message: 'Sin espacio' }) });
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.msg(), 'Sin espacio');
});

test('estado ignored: no pinta el cierre', async () => {
  const s = setup({ submit: () => ({ status: 'ignored' }) });
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.fb__verdict'), null);
});

test('getResponse: durante la respuesta da los intentos; tras enviar, lo enviado', async () => {
  const s = setup();
  assert.equal(s.comp.getResponse(), null);
  s.join('dog', 'perro');
  assert.equal(s.comp.getResponse(), 'dog = perro');
  s.join('cat', 'gato');
  s.join('bird', 'pájaro');
  await tick();
  assert.equal(s.comp.getResponse(), 'dog = perro; cat = gato; bird = pájaro');
});

test('2 y 10 parejas (con 4 distractores) funcionan de punta a punta', async () => {
  for (const [n, e] of [[2, 0], [10, 4]]) {
    const pairs = Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
    const it = item({}, { pairs, extra_right: Array.from({ length: e }, (_, i) => `x${i}`) });
    const s = setup({ it });
    assert.equal(s.rights().length, n + e);
    for (let i = 0; i < n; i += 1) s.join(`l${i}`, `r${i}`);
    await tick();
    assert.equal(s.calls.length, 1);
    assert.equal(s.calls[0].result, 'correct');
  }
});

test('un distractor nunca se bloquea y siempre es fallo', () => {
  const s = setup({ it: item({}, { extra_right: ['pez'] }) });
  s.join('dog', 'pez');
  s.join('dog', 'pez');
  assert.ok(!s.R('pez').classList.contains('is-done'));
  assert.equal(s.msg(), MA_TEXT.miss('dog', 'pez'));
});

test('getResponse y destroy: destroy es idempotente y quita el nodo', () => {
  const s = setup();
  s.comp.destroy();
  s.comp.destroy();
  assert.equal(s.root.querySelector('.ma'), null);
});

test('el texto del contenido entra como texto, nunca como HTML', () => {
  const it = item({ prompt_es: '<b>x</b>' }, { pairs: [{ left: '<img src=x>', right: '&lt;' }, { left: 'b', right: 'c' }] });
  const s = setup({ it });
  assert.equal(s.root.querySelector('.ma__prompt').textContent, '<b>x</b>');
  assert.equal(s.root.querySelectorAll('img').length, 0);
  assert.equal(s.lefts()[0].textContent, '<img src=x>');
});

test('montaje inválido lanza TypeError en español', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const f = createMatchPairs({ rng: createRng(1) });
  assert.throws(() => f.mount(null, item(), {}), /contenedor/);
  assert.throws(() => f.mount(root, null, {}), /tipo/);
  assert.throws(() => f.mount(root, item({ prompt_es: ' ' }), { doc: env.doc }), /prompt_es/);
  assert.throws(() => f.mount(root, item({}, { pairs: [] }), { doc: env.doc }), /bad_pairs/);
  assert.throws(() => createMatchPairs({ rng: {} }), /rng/);
  assert.throws(() => createMatchPairs({ leftLang: 'English' }), /leftLang/);
  assert.throws(() => createMatchPairs({ rightLang: 5 }), /rightLang/);
});

test('fuzz: toques al azar sobre el componente nunca lanzan y la columna derecha no cambia', async () => {
  const rng = createRng(5);
  for (let run = 0; run < 150; run += 1) {
    const n = 2 + (run % 9);
    const pairs = Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
    const s = setup({ it: item({}, { pairs, extra_right: run % 3 === 0 ? ['x0', 'x1'] : undefined }), factory: { rng: createRng(run + 1) } });
    const order = s.rights().map((b) => b.dataset.index);
    for (let k = 0; k < 40; k += 1) {
      const list = rng.int(0, 1) === 0 ? s.lefts() : s.rights();
      click(list[rng.int(0, list.length - 1)]);
    }
    await tick();
    assert.deepEqual(s.rights().map((b) => b.dataset.index), order);
    assert.ok(s.calls.length <= 1);
    s.comp.destroy();
  }
});

test('el rng de las opciones manda: misma semilla, mismo orden; sin rng también monta', () => {
  const a = setup({ factory: { rng: createRng(11) } }).rights().map((b) => b.dataset.index);
  const b = setup({ factory: { rng: createRng(11) } }).rights().map((x) => x.dataset.index);
  assert.deepEqual(a, b);
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  createMatchPairs().mount(root, item(), { doc: env.doc });
  assert.deepEqual(root.querySelectorAll('.ma__card--right').map((x) => x.dataset.index).sort(), ['0', '1', '2']);
});

test('idiomas: izquierda «en» y derecha «es» por defecto, y se pueden cambiar', () => {
  const s = setup();
  assert.ok(s.lefts().every((b) => b.getAttribute('lang') === 'en'));
  assert.ok(s.rights().every((b) => b.getAttribute('lang') === 'es'));
  const t = setup({ factory: { leftLang: 'es', rightLang: 'en' } });
  assert.ok(t.lefts().every((b) => b.getAttribute('lang') === 'es'));
  assert.ok(t.rights().every((b) => b.getAttribute('lang') === 'en'));
});

test('tras «No sé» no se puede elegir nada y las tarjetas sin emparejar quedan bloqueadas', async () => {
  const s = setup();
  s.join('dog', 'perro');
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  click(s.L('cat'));
  assert.ok(!s.L('cat').classList.contains('is-selected'));
  assert.equal(s.L('cat').getAttribute('aria-disabled'), 'true');
  assert.equal(s.R('gato').getAttribute('aria-disabled'), 'true');
});

test('un acierto no deja marca de fallo en las tarjetas', () => {
  const s = setup();
  s.join('dog', 'perro');
  assert.ok(!s.L('dog').classList.contains('is-miss'));
  assert.ok(!s.R('perro').classList.contains('is-miss'));
  s.join('cat', 'perro');
  s.join('cat', 'gato');
  assert.ok(!s.L('cat').classList.contains('is-miss'));
});

test('tras un fallo de envío, tocar una tarjeta ya emparejada no vuelve a enviar', async () => {
  const s = setup({ submit: () => ({ status: 'error' }) });
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  assert.equal(s.calls.length, 1);
  click(s.L('dog'));
  click(s.R('gato'));
  await tick();
  assert.equal(s.calls.length, 1);
});

test('mientras se envía todo queda bloqueado; si falla, se desbloquea lo que no estaba emparejado', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.join('dog', 'perro');
  click(s.btn(MA_TEXT.dontKnow));
  assert.ok(s.root.querySelector('.ma').classList.contains('is-locked'));
  assert.equal(s.btn(MA_TEXT.dontKnow).hasAttribute('disabled'), true);
  assert.equal(s.L('cat').getAttribute('aria-disabled'), 'true');
  click(s.L('cat'));
  assert.ok(!s.L('cat').classList.contains('is-selected'));
  release({ status: 'error' });
  await tick();
  assert.ok(!s.root.querySelector('.ma').classList.contains('is-locked'));
  assert.equal(s.L('cat').getAttribute('aria-disabled'), null);
  assert.equal(s.R('gato').getAttribute('aria-disabled'), null);
  assert.equal(s.L('dog').getAttribute('aria-disabled'), 'true', 'lo emparejado sigue bloqueado');
  assert.equal(s.btn(MA_TEXT.retry).hasAttribute('hidden'), true, 'sin completar no hay «Enviar otra vez»');
  click(s.L('cat'));
  assert.ok(s.L('cat').classList.contains('is-selected'));
  click(s.btn(MA_TEXT.dontKnow));
  release({ status: 'saved' });
  await tick();
  assert.equal(s.calls.length, 2);
});

test('mientras se envía, «Enviar otra vez» también queda bloqueado', async () => {
  let n = 0;
  let release;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : new Promise((r) => { release = r; })) });
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  click(s.btn(MA_TEXT.retry));
  assert.equal(s.btn(MA_TEXT.retry).hasAttribute('disabled'), true);
  click(s.btn(MA_TEXT.retry));
  assert.equal(s.calls.length, 2);
  release({ status: 'saved' });
  await tick();
  assert.ok(s.root.querySelector('.fb__verdict--correct'));
});

test('«No sé» da su propio mensaje, aunque ya estuvieran todas emparejadas tras un fallo de envío', async () => {
  let n = 0;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : { status: 'saved' }) });
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.fb__verdict').textContent, MA_TEXT.dont);
  assert.equal(s.calls[1].dontKnow, true);
});

test('si se destruye mientras se envía, la respuesta tardía no pinta nada', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  click(s.btn(MA_TEXT.dontKnow));
  s.comp.destroy();
  release({ status: 'saved' });
  await tick();
  assert.equal(s.comp.el.querySelector('.fb__verdict'), null);
  assert.equal(s.logs.length, 0);
});

test('al terminar el envío el aviso de acierto o fallo se borra', async () => {
  const s = setup();
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  assert.equal(s.msg(), MA_TEXT.hit);
  await tick();
  assert.equal(s.msg(), '');
});

test('sin ctx.submit no se pinta el cierre (como estado «ignored»)', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  createMatchPairs({ rng: createRng(3) }).mount(root, item(), { doc: env.doc });
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === MA_TEXT.dontKnow));
  await tick();
  assert.equal(root.querySelector('.fb__verdict'), null);
});

test('«No sé» tras un fallo de envío borra la respuesta guardada del intento anterior', async () => {
  let n = 0;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : { status: 'saved' }) });
  for (const [l, r] of [['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) s.join(l, r);
  await tick();
  click(s.btn(MA_TEXT.dontKnow));
  await tick();
  assert.equal(s.comp.getResponse(), null);
});

test('getResponse durante la respuesta también limpia los controles', () => {
  const it = item({}, { pairs: [{ left: 'a\u0085b', right: 'x' }, { left: 'c', right: 'd' }] });
  const s = setup({ it });
  s.join('a\u0085b', 'x');
  assert.equal(s.comp.getResponse(), 'a b = x');
});

test('una situación en blanco no pinta la línea «Situación»', () => {
  assert.equal(setup({ it: item({ situation: '   ' }) }).root.querySelector('.ma__situation'), null);
  assert.equal(setup({ it: item({ situation: undefined }) }).root.querySelector('.ma__situation'), null);
});
