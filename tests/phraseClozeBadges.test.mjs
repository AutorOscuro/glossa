// @purpose: Pruebas de las insignias y efectos de phrase_cloze (2.2-T3): insignias puras, plan de la tarjeta spell, acciones de tarjeta, barra de insignias y recorrido real con la sesión.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { badgesOf, levelHelp, isNewCard } from '../core/cardBadges.js';
import { spellKey, spellCardPlan, SPELL_TOPIC } from '../core/spellCard.js';
import { LEVEL_CUTS_DAYS, newCard } from '../core/srs.js';
import { validateEvent } from '../core/eventSchema.js';
import { createCardActions, lazyCardActions } from '../app/cardActions.js';
import { createCardBar, BAR_TEXT } from '../ui/exercises/cardBar.js';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createEvents } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';
import { mk, openNew } from './_sesionHarness.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const NOW = new Date('2026-10-27T12:00:00.000Z');
const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const answered = (extra = {}) => ({ ...newCard('it1', 0, NOW, ['t']), state: 2, reps: 3, stability: 10, due: '2026-11-27T12:00:00.000Z', ...extra });

// ---------------- Puro: insignias ----------------
test('insignias: sin tarjeta o con basura devuelve null; nueva = New sin «Repaso en»', () => {
  assert.equal(badgesOf(null, NOW), null);
  assert.equal(badgesOf('x', NOW), null);
  assert.equal(badgesOf([], NOW), null);
  const b = badgesOf(newCard('it1', 0, NOW, []), NOW);
  assert.deepEqual(b, { level: 1, isNew: true, due: null, fav: false });
});

test('insignias: tarjeta respondida muestra nivel, «Repaso en …» y favorita', () => {
  const b = badgesOf(answered({ fav: true }), NOW);
  assert.equal(b.isNew, false);
  assert.equal(b.level, 3);
  assert.equal(b.fav, true);
  assert.match(b.due, /^Repaso en /);
  assert.equal(badgesOf(answered({ fav: 'sí' }), NOW).fav, false);
});

test('insignias: los cortes del nivel coinciden con LEVEL_CUTS_DAYS (límites exactos)', () => {
  const lv = (s) => badgesOf(answered({ stability: s }), NOW).level;
  assert.equal(lv(0), 1);
  assert.equal(lv(0.99), 1);
  assert.equal(lv(1), 2);
  assert.equal(lv(3.99), 2);
  assert.equal(lv(4), 3);
  assert.equal(lv(21), 4);
  assert.equal(lv(89.9), 4);
  assert.equal(lv(90), 5);
  assert.equal(lv(-3), 1);
  assert.equal(lv('mucho'), 1);
});

test('insignias: «nueva» exige state 0 y ninguna repetición; una aprendiendo no es New', () => {
  assert.equal(isNewCard(newCard('a', 0, NOW)), true);
  assert.equal(isNewCard({ ...newCard('a', 0, NOW), state: 1 }), false);
  assert.equal(isNewCard({ ...newCard('a', 0, NOW), reps: 1 }), false);
  assert.equal(isNewCard({ state: 0 }), true);
  assert.equal(isNewCard(null), false);
  assert.equal(badgesOf({ ...newCard('a', 0, NOW), state: 1, reps: 1 }, NOW).isNew, false);
});

test('insignias: hoja del nivel con 5 niveles y los números reales de los cortes', () => {
  const h = levelHelp();
  assert.deepEqual(h.levels.map((l) => l.level), [1, 2, 3, 4, 5]);
  assert.ok(h.levels[0].text.includes(`${LEVEL_CUTS_DAYS[0]} día`));
  assert.ok(h.levels[2].text.includes(`${LEVEL_CUTS_DAYS[1]} días`) && h.levels[2].text.includes(`${LEVEL_CUTS_DAYS[2]} días`));
  assert.ok(h.levels[4].text.includes(`${LEVEL_CUTS_DAYS[3]} días o más`));
  assert.match(h.intro, /No es tu dominio del tema/);
});

// ---------------- Puro: tarjeta spell ----------------
test('spell: la clave es la palabra correcta a–z de 4 a 40 letras', () => {
  assert.equal(spellKey('Career'), 'career');
  assert.equal(spellKey('  whether '), 'whether');
  for (const bad of ['abc', "don't", 'café', 'a1b2c3', '', null, 7, 'x'.repeat(41), 'two words']) assert.equal(spellKey(bad), null, String(bad));
  assert.equal(spellKey('x'.repeat(40)), 'x'.repeat(40));
});

test('spell: el plan trae tarjeta nueva 8.4, evento note válido y el tema de ortografía', () => {
  const plan = spellCardPlan({ word: 'carrer', expected: 'career', index: 3 }, { now: NOW });
  assert.equal(plan.ok, true);
  assert.equal(plan.cardId, 'spell.career#0');
  assert.equal(plan.itemId, 'spell.career');
  assert.deepEqual(plan.card.topics, [SPELL_TOPIC]);
  assert.equal(plan.card.state, 0);
  assert.equal(plan.card.fav, false);
  assert.equal(plan.card.due, NOW.toISOString());
  assert.equal(plan.event.type, 'note');
  assert.equal(validateEvent(plan.event).ok, true);
  assert.match(plan.event.responseRaw, /career/);
  assert.match(plan.event.responseRaw, /carrer/);
});

test('spell: entradas inválidas devuelven motivo, nunca lanzan', () => {
  assert.deepEqual(spellCardPlan(null, { now: NOW }), { ok: false, reason: 'no_flag' });
  assert.deepEqual(spellCardPlan('x', { now: NOW }), { ok: false, reason: 'no_flag' });
  assert.deepEqual(spellCardPlan({ expected: "can't" }, { now: NOW }), { ok: false, reason: 'bad_word' });
  assert.deepEqual(spellCardPlan({}, { now: NOW }), { ok: false, reason: 'bad_word' });
  assert.deepEqual(spellCardPlan({ expected: 'career' }, { now: 'no es fecha' }), { ok: false, reason: 'bad_time' });
  assert.equal(spellCardPlan({ expected: 'career' }, { now: NOW, topic: 'spell.homophones' }).card.topics[0], 'spell.homophones');
});

test('spell: el evento se escribe aunque la palabra escrita traiga caracteres raros', () => {
  const plan = spellCardPlan({ word: 'ca\u0007rrer<b>😀', expected: 'career' }, { now: NOW });
  assert.equal(plan.ok, true);
  assert.equal(validateEvent(plan.event).ok, true);
  assert.equal(plan.event.responseRaw, 'spell_card career <- carrerb');
});

// ---------------- Acciones de tarjeta (base en memoria + eventos reales) ----------------
async function actions({ failEvents = false, failPut = false } = {}) {
  const clock = makeClock('2026-10-27T12:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const logs = [];
  const events = createEvents({ db, clock, rng: createRng(5) });
  const wrapped = failEvents ? { log: async () => { throw new Error('evento roto'); } } : events;
  const real = db.put.bind(db);
  const dbx = failPut ? { ...db, get: db.get.bind(db), put: async (s, v) => { if (s === 'cards' && v.id.startsWith('spell.')) throw new Error('disco lleno'); return real(s, v); } } : db;
  const a = createCardActions({ db: dbx, events: wrapped, clock, log: (...x) => logs.push(x) });
  return { a, db, logs, clock };
}

test('acciones: read devuelve la tarjeta o null (id vacío, inexistente, sin base)', async () => {
  const { a, db } = await actions();
  await db.put('cards', answered());
  assert.equal((await a.read('it1#0')).id, 'it1#0');
  assert.equal(await a.read('no#0'), null);
  assert.equal(await a.read(''), null);
  assert.equal(await a.read(null), null);
  assert.equal(await createCardActions({}).read('it1#0'), null);
});

test('acciones: setFav guarda SOLO fav y se puede quitar', async () => {
  const { a, db } = await actions();
  const card = answered({ stability: 7.5, lapses: 2 });
  await db.put('cards', card);
  const r = await a.setFav('it1#0', true);
  assert.equal(r.status, 'saved');
  assert.deepEqual({ ...(await db.get('cards', 'it1#0')), fav: false }, card);
  assert.equal((await db.get('cards', 'it1#0')).fav, true);
  await a.setFav('it1#0', false);
  assert.equal((await db.get('cards', 'it1#0')).fav, false);
  await a.setFav('it1#0', 'sí');
  assert.equal((await db.get('cards', 'it1#0')).fav, false);
});

test('acciones: setFav sin tarjeta es «missing»; sin base es «error»; nunca rechaza', async () => {
  const { a } = await actions();
  assert.deepEqual(await a.setFav('no#0', true), { status: 'missing' });
  assert.deepEqual(await a.setFav('', true), { status: 'missing' });
  assert.deepEqual(await createCardActions({}).setFav('x#0', true), { status: 'error' });
  const bad = createCardActions({ db: { get: async () => { throw new Error('boom'); }, put: async () => {} }, log: () => {} });
  assert.deepEqual(await bad.setFav('x#0', true), { status: 'error' });
});

test('acciones: ensureSpell crea evento note + tarjeta una sola vez (sin duplicados)', async () => {
  const { a, db } = await actions();
  const flag = { word: 'carrer', expected: 'career', index: 3 };
  assert.deepEqual(await a.ensureSpell(flag), { status: 'created', word: 'career' });
  assert.deepEqual(await a.ensureSpell(flag), { status: 'exists', word: 'career' });
  assert.equal((await db.query('cards', {})).length, 1);
  const notes = (await db.query('events', {})).filter((e) => e.type === 'note');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].cardId, 'spell.career#0');
  assert.equal((await db.get('cards', 'spell.career#0')).state, 0);
});

test('acciones: dos ensureSpell a la vez comparten el trabajo (un evento, una tarjeta)', async () => {
  const { a, db } = await actions();
  const flag = { word: 'carrer', expected: 'career' };
  const [x, y] = await Promise.all([a.ensureSpell(flag), a.ensureSpell(flag)]);
  assert.equal(x.status, 'created');
  assert.equal(y.status, 'created');
  assert.equal((await db.query('events', {})).filter((e) => e.type === 'note').length, 1);
});

test('acciones: ensureSpell omite palabras que no sirven y no escribe nada', async () => {
  const { a, db } = await actions();
  assert.equal((await a.ensureSpell({ word: 'cant', expected: "can't" })).status, 'skipped');
  assert.equal((await a.ensureSpell(null)).status, 'skipped');
  assert.equal((await db.query('cards', {})).length, 0);
  assert.equal((await db.query('events', {})).length, 0);
});

test('acciones: si falla el evento o la tarjeta, informa error, no deja tarjeta a medias y un reintento no duplica', async () => {
  const f1 = await actions({ failEvents: true });
  assert.equal((await f1.a.ensureSpell({ word: 'carrer', expected: 'career' })).status, 'error');
  assert.equal((await f1.db.query('cards', {})).length, 0);
  assert.ok(f1.logs.length >= 1);
  const f2 = await actions({ failPut: true });
  assert.equal((await f2.a.ensureSpell({ word: 'carrer', expected: 'career' })).status, 'error');
  assert.equal((await f2.db.query('cards', {})).length, 0);
  assert.equal((await createCardActions({ db: f2.db }).ensureSpell({ word: 'carrer', expected: 'career' })).status, 'error');
});

test('acciones: lazyCardActions espera a services.study, devuelve null sin base y reutiliza las acciones', async () => {
  let study = null;
  const get = lazyCardActions(() => study);
  assert.equal(get(), null);
  const db = createMemoryDb(); await db.open();
  study = { db: null };
  assert.equal(get(), null);
  study = { db, events: createEvents({ db, clock: makeClock(), rng: createRng(1) }), clock: makeClock() };
  const one = get();
  assert.equal(typeof one.read, 'function');
  assert.equal(get(), one);
  study = { ...study };
  assert.notEqual(get(), one);
  assert.equal(lazyCardActions(null)(), null);
});

// ---------------- Barra de insignias ----------------
function fakeCards(card, { failFav = false, delay = false } = {}) {
  const calls = { read: 0, setFav: [] };
  let current = card;
  const gate = { release: null };
  return {
    calls, gate, now: () => NOW,
    async read() { calls.read += 1; return current; },
    async setFav(id, fav) {
      calls.setFav.push([id, fav]);
      if (delay) await new Promise((r) => { gate.release = r; });
      if (failFav) return { status: 'error' };
      current = { ...current, fav };
      return { status: 'saved', card: current };
    },
  };
}
function barSetup(card, opts) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const cards = fakeCards(card, opts);
  const bar = createCardBar({ cards, cardId: card?.id ?? 'it1#0', doc: env.doc, win: env.win });
  root.appendChild(bar.el);
  return { env, root, bar, cards };
}

test('barra: tarjeta nueva muestra Nivel 1 (?), New y corazón sin marcar; sin «Repaso en»', async () => {
  const { bar, root } = barSetup(newCard('it1', 0, NOW, []));
  await bar.ready;
  const text = root.querySelectorAll('.pc__badges')[0].textContent;
  assert.match(text, /Nivel 1/);
  assert.match(text, /New/);
  assert.doesNotMatch(text, /Repaso en/);
  const heart = root.querySelectorAll('.pc__fav')[0];
  assert.equal(heart.getAttribute('aria-pressed'), 'false');
  assert.equal(heart.getAttribute('aria-label'), BAR_TEXT.favOff);
  assert.equal(root.querySelectorAll('.badge__help').length, 1);
});

test('barra: tarjeta respondida muestra su nivel y «Repaso en …», sin New', async () => {
  const { bar, root } = barSetup(answered());
  await bar.ready;
  const text = root.querySelectorAll('.pc__badges')[0].textContent;
  assert.match(text, /Nivel 3/);
  assert.match(text, /Repaso en /);
  assert.doesNotMatch(text, /New/);
});

test('barra: el corazón guarda fav, cambia aria-pressed y se bloquea mientras guarda (sin lockMs)', async () => {
  const { env, bar, root, cards } = barSetup(answered(), { delay: true });
  await bar.ready;
  const heart = () => root.querySelectorAll('.pc__fav')[0];
  click(heart());
  click(heart());
  await env.flush();
  assert.equal(cards.calls.setFav.length, 1);
  assert.equal(heart().getAttribute('disabled') !== null, true);
  cards.gate.release();
  await env.flush();
  assert.deepEqual(cards.calls.setFav[0], ['it1#0', true]);
  assert.equal(heart().getAttribute('aria-pressed'), 'true');
  assert.equal(heart().getAttribute('aria-label'), BAR_TEXT.favOn);
  assert.equal(heart().getAttribute('disabled'), null);
  click(heart());
  await env.flush();
  cards.gate.release?.();
  await env.flush();
  assert.equal(cards.calls.setFav.length, 2);
  assert.equal(cards.calls.setFav[1][1], false);
});

test('barra: si guardar la favorita falla, vuelve a su estado y avisa', async () => {
  const { env, bar, root } = barSetup(answered(), { failFav: true });
  await bar.ready;
  click(root.querySelectorAll('.pc__fav')[0]);
  await env.flush();
  assert.equal(root.querySelectorAll('.pc__fav')[0].getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelectorAll('.pc__badges-note')[0].textContent, BAR_TEXT.favFail);
  assert.equal(root.querySelectorAll('.pc__fav')[0].getAttribute('disabled'), null);
});

test('barra: el «?» abre la hoja con los 5 niveles y marca el actual', async () => {
  const { env, bar, root } = barSetup(answered({ stability: 30 }));
  await bar.ready;
  click(root.querySelectorAll('.badge__help')[0]);
  await env.flush();
  const items = env.doc.body.querySelectorAll('.pc__level');
  assert.equal(items.length, 5);
  const now = env.doc.body.querySelectorAll('.pc__level--now');
  assert.equal(now.length, 1);
  assert.match(now[0].textContent, /Nivel 4/);
  assert.match(now[0].textContent, /Tu tarjeta está aquí/);
  bar.destroy();
  assert.equal(env.doc.body.querySelectorAll('.pc__level').length, 0);
});

test('barra: refresh usa la etiqueta de la calificación, quita New y destroy es idempotente', async () => {
  const card = newCard('it1', 0, NOW, []);
  const { env, bar, root, cards } = barSetup(card);
  await bar.ready;
  assert.match(root.querySelectorAll('.pc__badges')[0].textContent, /New/);
  await bar.refresh({ dueLabel: 'Repaso en 3 días' });
  const text = root.querySelectorAll('.pc__badges')[0].textContent;
  assert.match(text, /Repaso en 3 días/);
  assert.doesNotMatch(text, /New/);
  assert.equal(cards.calls.read, 2);
  bar.destroy(); bar.destroy();
  await bar.refresh({});
  await env.flush();
});

test('barra: sin tarjeta legible se oculta; faltan acciones o cardId lanza TypeError', async () => {
  const env = makeEnv();
  const bar = createCardBar({ cards: { read: async () => null, now: () => NOW }, cardId: 'x#0', doc: env.doc, win: env.win });
  await bar.ready;
  assert.equal(bar.el.hidden, true);
  const boom = createCardBar({ cards: { read: async () => { throw new Error('x'); } }, cardId: 'x#0', doc: env.doc, win: env.win });
  await boom.ready;
  assert.equal(boom.el.hidden, true);
  assert.throws(() => createCardBar({ cardId: 'x#0', doc: env.doc }), TypeError);
  assert.throws(() => createCardBar({ cards: { read() {} }, cardId: '', doc: env.doc }), TypeError);
});

// ---------------- Tarjeta phrase_cloze con insignias y efectos ----------------
const item = () => ({
  id: 'x', type: 'phrase_cloze', prompt_es: 'Quiero una carrera en la música.', explain_es: 'Career = carrera profesional.',
  accept: ['I want a career in music.'], data: { text: 'I want a ___ in music.', answers: [['career']] },
});
function cloze({ cards, entry = { cardId: 'it1#0' }, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const sent = [];
  const sub = submit ?? (async (a) => { sent.push(a); return { status: 'saved', dueLabel: 'Repaso en 2 días' }; });
  const m = createPhraseCloze().mount(root, item(), { doc: env.doc, win: env.win, cards, entry, submit: async (a) => { if (submit) sent.push(a); return sub(a); } });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
  const type = (v) => { const inp = root.querySelectorAll('input')[0]; inp.value = v; inp.dispatchEvent(ev('input')); };
  return { env, root, m, sent, btn, type };
}
const spellPort = (card, spellResult = { status: 'created', word: 'career' }) => {
  const port = fakeCards(card);
  port.spells = [];
  port.ensureSpell = async (flag) => { port.spells.push(flag); if (spellResult instanceof Error) throw spellResult; return spellResult; };
  return port;
};

test('tarjeta: sin ctx.cards no hay insignias y todo lo demás funciona', async () => {
  const { env, root, btn, type, sent } = cloze({ cards: undefined });
  assert.equal(root.querySelectorAll('.pc__bar').length, 0);
  type('career');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(sent[0].result, 'correct');
});

test('tarjeta: con ctx.cards y cardId muestra las insignias arriba; sin cardId no', async () => {
  const a = cloze({ cards: spellPort(newCard('it1', 0, NOW, [])) });
  await env_flush(a);
  assert.equal(a.root.querySelectorAll('.pc__bar').length, 1);
  assert.match(a.root.querySelectorAll('.pc__badges')[0].textContent, /New/);
  const b = cloze({ cards: spellPort(newCard('it1', 0, NOW, [])), entry: {} });
  assert.equal(b.root.querySelectorAll('.pc__bar').length, 0);
});
async function env_flush(x) { await x.env.flush(); }

test('tarjeta: al responder, las insignias pasan de New a «Repaso en …» con la etiqueta de la calificación', async () => {
  const port = spellPort(newCard('it1', 0, NOW, []));
  const t = cloze({ cards: port });
  await t.env.flush();
  t.type('career');
  click(t.btn('Comprobar'));
  await t.env.flush();
  const text = t.root.querySelectorAll('.pc__badges')[0].textContent;
  assert.match(text, /Repaso en 2 días/);
  assert.doesNotMatch(text, /New/);
  assert.equal(port.spells.length, 0);
});

test('tarjeta: almost muestra el aviso ortográfico y pide la tarjeta spell una vez', async () => {
  const port = spellPort(answered());
  const t = cloze({ cards: port });
  await t.env.flush();
  t.type('carrer');
  click(t.btn('Comprobar'));
  await t.env.flush();
  assert.equal(t.sent[0].result, 'almost');
  assert.equal(port.spells.length, 1);
  assert.equal(port.spells[0].expected, 'career');
  assert.equal(port.spells[0].word, 'carrer');
  const note = t.root.querySelectorAll('.pc__spell')[0].textContent;
  assert.match(note, /escribiste «carrer»/);
  assert.match(note, /se escribe «career»/);
  assert.match(note, /tarjeta de deletreo/);
});

test('tarjeta: almost con tarjeta ya existente, con error o sin acciones: aviso distinto y la respuesta sigue guardada', async () => {
  for (const [res, re] of [[{ status: 'exists' }, /Ya la tienes/], [{ status: 'error' }, /no pude crear la tarjeta/i], [new Error('x'), /no pude crear la tarjeta/i]]) {
    const t = cloze({ cards: spellPort(answered(), res) });
    await t.env.flush();
    t.type('carrer');
    click(t.btn('Comprobar'));
    await t.env.flush();
    assert.equal(t.sent.length, 1);
    assert.match(t.root.querySelectorAll('.pc__spell')[0].textContent, re);
    assert.equal(t.root.querySelectorAll('.fb__verdict--almost').length, 1);
  }
  const plain = fakeCards(answered());
  const t = cloze({ cards: plain });
  await t.env.flush();
  t.type('carrer');
  click(t.btn('Comprobar'));
  await t.env.flush();
  const note = t.root.querySelectorAll('.pc__spell')[0].textContent;
  assert.match(note, /se escribe «career»/);
  assert.doesNotMatch(note, /tarjeta/);
});

test('tarjeta: correcto o incorrecto NO crean tarjeta spell ni aviso', async () => {
  for (const typed of ['career', 'banana']) {
    const port = spellPort(answered());
    const t = cloze({ cards: port });
    await t.env.flush();
    t.type(typed);
    click(t.btn('Comprobar'));
    await t.env.flush();
    assert.equal(port.spells.length, 0);
    assert.equal(t.root.querySelectorAll('.pc__spell').length, 0);
  }
});

test('tarjeta: si la respuesta no se guarda no hay tarjeta spell; al reintentar se crea una sola', async () => {
  const port = spellPort(answered());
  let n = 0;
  const submit = async () => { n += 1; return n === 1 ? { status: 'error', message: 'sin espacio' } : { status: 'saved', dueLabel: 'Repaso en 1 día' }; };
  const t = cloze({ cards: port, submit });
  await t.env.flush();
  t.type('carrer');
  click(t.btn('Comprobar'));
  await t.env.flush();
  assert.equal(port.spells.length, 0);
  assert.equal(t.root.querySelectorAll('.pc__spell').length, 0);
  click(t.btn('Comprobar'));
  await t.env.flush();
  assert.equal(port.spells.length, 1);
  assert.equal(t.root.querySelectorAll('.pc__spell').length, 1);
});

test('tarjeta: «duplicado» también deja la tarjeta spell sin repetirla; «ignorado» no hace nada', async () => {
  const dupPort = spellPort(answered(), { status: 'exists' });
  const d = cloze({ cards: dupPort, submit: async () => ({ status: 'duplicate' }) });
  await d.env.flush();
  d.type('carrer');
  click(d.btn('Comprobar'));
  await d.env.flush();
  assert.equal(dupPort.spells.length, 1);
  const ignPort = spellPort(answered());
  const i = cloze({ cards: ignPort, submit: async () => ({ status: 'ignored' }) });
  await i.env.flush();
  i.type('carrer');
  click(i.btn('Comprobar'));
  await i.env.flush();
  assert.equal(ignPort.spells.length, 0);
  assert.equal(i.root.querySelectorAll('.pc__spell').length, 0);
});

test('tarjeta: si se pasa de ejercicio mientras se guarda, la tarjeta spell se crea igual y no se pinta nada', async () => {
  const port = spellPort(answered());
  let release;
  const submit = () => new Promise((r) => { release = r; });
  const t = cloze({ cards: port, submit });
  await t.env.flush();
  t.type('carrer');
  click(t.btn('Comprobar'));
  await t.env.flush();
  t.m.destroy();
  release({ status: 'saved', dueLabel: 'Repaso en 1 día' });
  await t.env.flush();
  assert.equal(port.spells.length, 1);
  assert.equal(t.root.querySelectorAll('.pc__spell').length, 0);
  t.m.destroy();
});

// ---------------- Recorrido real: vista de sesión + registro + servicios de estudio + base en memoria ----------------
const ITEMS = {
  it000: { id: 'it000', type: 'phrase_cloze', prompt_es: 'Quiero una carrera en la música.', accept: ['I want a career in music.'], data: { text: 'I want a ___ in music.', answers: [['career']] }, topics: ['gram.be.present_forms'] },
  it001: { id: 'it001', type: 'phrase_cloze', prompt_es: 'Quiero una carrera en la música.', accept: ['I want a career in music.'], data: { text: 'I want a ___ in music.', answers: [['career']] }, topics: ['gram.be.present_forms'] },
  it002: { id: 'it002', type: 'phrase_cloze', prompt_es: 'Quiero una carrera en la música.', accept: ['I want a career in music.'], data: { text: 'I want a ___ in music.', answers: [['career']] }, topics: ['gram.be.present_forms'] },
};

async function realFlow() {
  let ref = null;
  const exercises = createExerciseRegistry({ resolveItem: (id) => ITEMS[id] ?? null, cards: () => ref?.cards ?? null, log: () => {} });
  exercises.register('phrase_cloze', createPhraseCloze());
  const t = await mk({ host: exercises, cards: 3 });
  ref = { cards: lazyCardActions(() => t.services.study)() };
  const id = await openNew(t);
  return { t, id };
}
const typeIn = (t, v) => { const inp = t.q('input')[0]; inp.value = v; inp.dispatchEvent(ev('input')); };
const answerWith = async (t, v) => { typeIn(t, v); click(t.btn('Comprobar')); await t.flush(); };

test('recorrido real: responder «casi» guarda la respuesta, crea spell.career#0 con su nota y un reintento no duplica', async () => {
  const { t } = await realFlow();
  await t.flush();
  await answerWith(t, 'carrer');
  const evts = await t.events();
  const answers = evts.filter((e) => e.type === 'answer');
  const notes = evts.filter((e) => e.type === 'note');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].result, 'almost');
  assert.equal(notes.length, 1);
  const spell = await t.db.get('cards', 'spell.career#0');
  assert.equal(spell.state, 0);
  assert.deepEqual(spell.topics, [SPELL_TOPIC]);
  assert.match(t.q('.pc__spell')[0].textContent, /tarjeta de deletreo/);
  const cards = await t.db.query('cards', {});
  assert.equal(cards.length, 4);
});

test('recorrido real: la misma errata en otra tarjeta no duplica spell.career#0 ni su nota', async () => {
  const { t } = await realFlow();
  await t.flush();
  await answerWith(t, 'carrer');
  click(t.btn('Continuar'));
  await t.flush();
  await answerWith(t, 'carrer');
  const evts = await t.events();
  assert.equal(evts.filter((e) => e.type === 'answer').length, 2);
  assert.equal(evts.filter((e) => e.type === 'note').length, 1);
  assert.equal((await t.db.query('cards', {})).filter((c) => c.id.startsWith('spell.')).length, 1);
  assert.match(t.q('.pc__spell')[0].textContent, /Ya la tienes/);
});

test('recorrido real: la favorita sobrevive a responder (la calificación no la borra) y las insignias se actualizan', async () => {
  const { t } = await realFlow();
  await t.flush();
  const first = (await t.db.query('cards', {}))[0];
  assert.match(t.q('.pc__badges')[0].textContent, /New/);
  click(t.q('.pc__fav')[0]);
  await t.flush();
  assert.equal((await t.db.get('cards', first.id)).fav, true);
  await answerWith(t, 'career');
  const after = await t.db.get('cards', first.id);
  assert.equal(after.fav, true);
  assert.ok(after.reps >= 1);
  const text = t.q('.pc__badges')[0].textContent;
  assert.doesNotMatch(text, /New/);
  assert.match(text, /Repaso en /);
  assert.equal(t.q('.pc__fav')[0].getAttribute('aria-pressed'), 'true');
});

test('recorrido real: la nota spell no cuenta como respuesta en las consultas de intentos', async () => {
  const { t } = await realFlow();
  await t.flush();
  await answerWith(t, 'carrer');
  const evts = await t.events();
  const attempts = evts.filter((e) => e.type === 'answer' && ['correct', 'almost', 'wrong', 'dont_know'].includes(e.result));
  assert.equal(attempts.length, 1);
  assert.equal(evts.find((e) => e.type === 'note').result, null);
});

// ---------------- Registro: puerto ctx.cards ----------------
function probeRegistry(cards) {
  const logs = [];
  const seen = [];
  const reg = createExerciseRegistry({ resolveItem: () => ({ id: 'a', type: 'probe' }), cards, log: (...x) => logs.push(x) });
  reg.register('probe', { mount(c, item, ctx) { seen.push(ctx.cards); return { destroy() {} }; } });
  const slot = makeEnv().doc.createElement('div');
  return { reg, slot, seen, logs };
}

test('registro: ctx.cards llega al componente (objeto o función evaluada en cada montaje)', async () => {
  const port = { read: async () => null };
  const a = probeRegistry(port);
  await a.reg.mount(a.slot, { cardId: 'a#0', itemId: 'a', exerciseType: 'probe' }, { index: 0, total: 1, submit: async () => ({}) });
  assert.equal(a.seen[0], port);
  let n = 0;
  const b = probeRegistry(() => { n += 1; return n === 1 ? null : port; });
  const entry = { cardId: 'a#0', itemId: 'a', exerciseType: 'probe' };
  await b.reg.mount(b.slot, entry, { index: 0, total: 1, submit: async () => ({}) });
  await b.reg.mount(b.slot, entry, { index: 0, total: 1, submit: async () => ({}) });
  assert.deepEqual(b.seen, [null, port]);
});

test('registro: sin cards o con una función que lanza, el ejercicio se monta con cards null; cards inválido lanza', async () => {
  const a = probeRegistry(undefined);
  await a.reg.mount(a.slot, { cardId: 'a#0', itemId: 'a', exerciseType: 'probe' }, { index: 0, total: 1, submit: async () => ({}) });
  assert.equal(a.seen[0], null);
  const b = probeRegistry(() => { throw new Error('aún no hay servicios'); });
  const h = await b.reg.mount(b.slot, { cardId: 'a#0', itemId: 'a', exerciseType: 'probe' }, { index: 0, total: 1, submit: async () => ({}) });
  assert.notEqual(h, null);
  assert.equal(b.seen[0], null);
  assert.equal(b.logs.length, 1);
  assert.throws(() => createExerciseRegistry({ cards: 'x' }), /cards debe ser/);
  assert.throws(() => createExerciseRegistry({ cards: [] }), /cards debe ser/);
});

// ---------------- Huecos cerrados tras las roturas (4.R) ----------------
test('spell: el límite de 4 letras es inclusivo y el tema por defecto existe en la taxonomía', async () => {
  assert.equal(spellKey('abcd'), 'abcd');
  assert.equal(spellKey('abc'), null);
  assert.equal(SPELL_TOPIC, 'spell.common_misspellings');
  const fs = await import('node:fs');
  const topics = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/topics.json', import.meta.url), 'utf8')).topics;
  assert.ok(topics.some((t) => t.id === SPELL_TOPIC));
});

test('spell: del texto escrito se conservan letras y cifras, y se recorta a 40', () => {
  const plan = spellCardPlan({ word: 'ca1rrer', expected: 'career' }, { now: NOW });
  assert.equal(plan.event.responseRaw, 'spell_card career <- ca1rrer');
  const long = spellCardPlan({ word: 'x'.repeat(60), expected: 'career' }, { now: NOW });
  assert.equal(long.event.responseRaw, `spell_card career <- ${'x'.repeat(40)}`);
});

test('acciones: sin base o sin eventos no tocan nada ni ensucian el registro de errores', async () => {
  const logs = [];
  const none = createCardActions({ log: (...x) => logs.push(x) });
  assert.equal(await none.read('it1#0'), null);
  assert.deepEqual(await none.setFav('it1#0', true), { status: 'error' });
  assert.deepEqual(await none.ensureSpell({ word: 'carrer', expected: 'career' }), { status: 'error', reason: 'no_service' });
  assert.equal(logs.length, 0);
  const calls = [];
  const spy = { get: async (...a) => { calls.push(['get', ...a]); return null; }, put: async (...a) => { calls.push(['put', ...a]); } };
  const a = createCardActions({ db: spy, log: (...x) => logs.push(x) });
  assert.equal(await a.read(''), null);
  assert.equal(await a.read(null), null);
  assert.deepEqual(await a.ensureSpell({ word: 'carrer', expected: 'career' }), { status: 'error', reason: 'no_service' });
  assert.deepEqual(calls, []);
});

test('acciones: un reloj que lanza no hace rechazar a ensureSpell (sale como error, sin escribir)', async () => {
  const logs = [];
  const writes = [];
  const db = { get: async () => null, put: async (...a) => { writes.push(a); } };
  const events = { log: async (...a) => { writes.push(a); } };
  const a = createCardActions({ db, events, clock: { now() { throw new Error('reloj roto'); } }, log: (...x) => logs.push(x) });
  assert.deepEqual(await a.ensureSpell({ word: 'carrer', expected: 'career', index: 0 }), { status: 'error' });
  assert.equal(writes.length, 0);
  assert.equal(logs.length, 1);
});

test('acciones: la errata con mayúsculas («Carrer» por «Career») crea una sola tarjeta spell.career#0', async () => {
  const { a, db } = await actions();
  const flag = { word: 'Carrer', expected: 'Career', index: 0 };
  assert.equal((await a.ensureSpell(flag)).status, 'created');
  assert.equal((await a.ensureSpell(flag)).status, 'exists');
  assert.ok(await db.get('cards', 'spell.career#0'));
});
