// @purpose: Pruebas del conteo de lo estudiado hoy (core/dailyUsage.js, 2.1-T2): tarjetas nuevas, repasos y práctica extra por día local, desde eventos reales en memoria.
// 2.1-T2. Base en memoria y eventos reales; el reloj es un doble. Las fechas se arman con el día LOCAL para que valgan en cualquier zona horaria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countToday } from '../core/dailyUsage.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createRng } from '../core/rng.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date(2026, 9, 26, 15, 0, 0);          // 26 oct 2026, 15:00 local
const at = (dayOffset, h = 10, m = 0, s = 0) => new Date(2026, 9, 26 + dayOffset, h, m, s).toISOString();
const ans = (cardId, ts, over = {}) => ({ type: 'answer', itemId: cardId.split('#')[0], cardId, topics: ['t.a'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 3000, mode: 'mech', channel: 'keyboard', ts, ...over });

async function world() {
  const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock: makeClock(NOW.toISOString()), rng: createRng(5) });
  return { db, events };
}

test('sin eventos: todo en 0 y el día es el local', async () => {
  const { events } = await world();
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 0, practiceToday: 0 });
});

test('una tarjeta cuya primera respuesta es de hoy es nueva; una con respuestas de antes es repaso', async () => {
  const { events } = await world();
  await events.log(ans('a#0', at(0, 9)));
  await events.log(ans('b#0', at(-3, 9)));
  await events.log(ans('b#0', at(0, 10)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 1, practiceToday: 0 });
});

test('cuenta tarjetas, no respuestas: tres respuestas a la misma tarjeta nueva dan newToday 1 y reviewsToday 0', async () => {
  const { events } = await world();
  for (const h of [9, 10, 11]) await events.log(ans('a#0', at(0, h)));
  for (const h of [9, 10]) await events.log(ans('r#0', at(-1, h)));
  for (const h of [12, 13]) await events.log(ans('r#0', at(0, h)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 1, practiceToday: 0 });
});

test('ignora lo de otros días, lo que no es una respuesta y los eventos sin tarjeta', async () => {
  const { events } = await world();
  await events.log(ans('ayer#0', at(-1, 23, 59, 59)));
  await events.log(ans('manana#0', at(1, 0, 0, 1)));
  await events.log({ type: 'session_start', sessionId: 's1', ts: at(0, 9) });
  await events.log({ type: 'note', responseRaw: 'hola', ts: at(0, 9) });
  await events.log(ans('libre#0', at(0, 9), { cardId: null }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 0, practiceToday: 0 });
});

test('los bordes del día local: 00:00:00 de hoy cuenta y 23:59:59 de ayer no', async () => {
  const { events } = await world();
  await events.log(ans('x#0', at(0, 0, 0, 0)));
  await events.log(ans('y#0', at(-1, 23, 59, 59)));
  const r = await countToday({ events, now: new Date(at(0, 23, 59, 59)) });
  assert.deepEqual(r, { day: '2026-10-26', newToday: 1, reviewsToday: 0, practiceToday: 0 });
});

test('lee eventos reales y no escribe nada', async () => {
  const { db, events } = await world();
  await events.log(ans('a#0', at(0, 9)));
  const before = (await db.query('events', {})).length;
  await countToday({ events, now: NOW });
  assert.equal((await db.query('events', {})).length, before);
});

test('entradas inválidas: sin events lanza; una fecha ilegible lanza; si la base falla, rechaza con su error', async () => {
  const { events } = await world();
  await assert.rejects(() => countToday({ now: NOW }), /faltan events\.since y events\.byCard/);
  await assert.rejects(() => countToday({ events: {}, now: NOW }), /faltan events\.since y events\.byCard/);
  await assert.rejects(() => countToday({ events: { since: async () => [] }, now: NOW }), /faltan events\.since y events\.byCard/, 'con byCard ausente también rechaza');
  await assert.rejects(() => countToday({ events: { byCard: async () => [] }, now: NOW }), /faltan events\.since y events\.byCard/, 'con since ausente también rechaza');
  await assert.rejects(() => countToday({ events, now: 'no es fecha' }));
  const roto = { since: async () => { throw new Error('base caída'); }, byCard: async () => [] };
  await assert.rejects(() => countToday({ events: roto, now: NOW }), /base caída/);
});

test('solo las respuestas cuentan: una nota o un toque de palabra con tarjeta no hacen nueva ni repaso, ni cambian la primera respuesta', async () => {
  const { events } = await world();
  await events.log({ type: 'note', responseRaw: 'apunte', cardId: 'c#0', itemId: 'c', ts: at(0, 8) });
  await events.log({ type: 'tap_word', responseRaw: 'word', cardId: 'd#0', itemId: 'd', ts: at(0, 8) });
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 0, practiceToday: 0 }, 'sin respuestas no hay nada');
  await events.log({ type: 'note', responseRaw: 'viejo', cardId: 'e#0', itemId: 'e', ts: at(-5, 8) });
  await events.log(ans('e#0', at(0, 9)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 0, practiceToday: 0 }, 'una nota vieja no vuelve «repaso» a la tarjeta');
});

test('la primera respuesta se busca bien: dos respuestas hoy, o una de hoy y otra de ayer, o varias días atrás', async () => {
  const { events } = await world();
  await events.log(ans('p#0', at(0, 9))); await events.log(ans('p#0', at(0, 10)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 0, practiceToday: 0 }, 'dos hoy y ninguna antes: nueva');
  await events.log(ans('q#0', at(-9, 9))); await events.log(ans('q#0', at(-4, 9))); await events.log(ans('q#0', at(0, 9)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 1, practiceToday: 0 }, 'varias antes: repaso');
});

test('lee desde la medianoche LOCAL de hoy, no desde otra hora ni todo el historial', async () => {
  const seen = [];
  const spy = { since: async (ts) => { seen.push(ts); return []; }, byCard: async () => [] };
  await countToday({ events: spy, now: new Date(2026, 9, 26, 18, 30, 0) });
  assert.equal(seen.length, 1);
  assert.equal(new Date(seen[0]).getTime(), new Date(2026, 9, 26, 0, 0, 0, 0).getTime());
});

// ---- Repasos adelantados (práctica extra): no gastan el tope de repasos ----
const SEEN = (id) => ans(id, at(-6, 9)); // una respuesta vieja: la tarjeta ya es conocida

test('práctica extra: una tarjeta conocida con todas sus respuestas de hoy adelantadas va a practiceToday y no a reviewsToday', async () => {
  const { events } = await world();
  await events.log(SEEN('e#0'));
  await events.log(ans('e#0', at(0, 9), { early: true }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 0, practiceToday: 1 });
});

test('un repaso a tiempo y una práctica de tarjetas distintas se cuentan cada uno en su sitio', async () => {
  const { events } = await world();
  await events.log(SEEN('a#0')); await events.log(SEEN('b#0'));
  await events.log(ans('a#0', at(0, 9)));
  await events.log(ans('b#0', at(0, 9), { early: true }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 1, practiceToday: 1 });
});

test('una tarjeta repasada a tiempo y practicada otra vez hoy cuenta como repaso, en cualquier orden de las respuestas', async () => {
  const { events } = await world();
  await events.log(SEEN('a#0')); await events.log(SEEN('b#0'));
  await events.log(ans('a#0', at(0, 9)));  await events.log(ans('a#0', at(0, 10), { early: true }));
  await events.log(ans('b#0', at(0, 9), { early: true })); await events.log(ans('b#0', at(0, 10)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 2, practiceToday: 0 });
});

test('varias prácticas de la misma tarjeta cuentan una sola vez', async () => {
  const { events } = await world();
  await events.log(SEEN('p#0'));
  for (const h of [9, 10, 11]) await events.log(ans('p#0', at(0, h), { early: true }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 0, practiceToday: 1 });
});

test('una tarjeta nueva de hoy es nueva aunque su repetición salga adelantada, y no suma práctica', async () => {
  const { events } = await world();
  await events.log(ans('n#0', at(0, 9)));
  await events.log(ans('n#0', at(0, 10), { early: true }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 1, reviewsToday: 0, practiceToday: 0 });
});

test('una respuesta adelantada de AYER no hace práctica a la tarjeta de hoy: solo importa lo de hoy', async () => {
  const { events } = await world();
  await events.log(SEEN('y#0'));
  await events.log(ans('y#0', at(-1, 9), { early: true }));
  await events.log(ans('y#0', at(0, 9)));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 1, practiceToday: 0 });
});

test('los eventos antiguos, sin el campo early, siguen contando como repaso a tiempo', async () => {
  const { events } = await world();
  await events.log(SEEN('v#0'));
  const old = ans('v#0', at(0, 9)); assert.equal('early' in old, false);
  await events.log(old);
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 1, practiceToday: 0 });
});

test('early: false explícito vale como a tiempo; un evento early no se puede guardar en una nota', async () => {
  const { events } = await world();
  await events.log(SEEN('f#0'));
  await events.log(ans('f#0', at(0, 9), { early: false }));
  assert.deepEqual(await countToday({ events, now: NOW }), { day: '2026-10-26', newToday: 0, reviewsToday: 1, practiceToday: 0 });
  await assert.rejects(() => events.log({ type: 'note', responseRaw: 'x', early: true, ts: at(0, 9) }), /early/);
});
