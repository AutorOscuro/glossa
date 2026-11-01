// @purpose: Criterios de aceptación de la 1.11 (lista blanca) con evidencia: tokenización, desconocidas con forma y lema, 10 textos de control contados a mano, vacío y emoji.
// Pruebas de 1.11-T3 (cierre). Los textos de control traen su resultado CONTADO A MANO (no sale del código) y se miden con el lemmas.json real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMemoryDb } from '../core/db.memory.js';
import { createLemmaTable } from '../core/lemmas.js';
import { createWhitelist, isWithinTarget, knownLemmas, tokenize } from '../core/whitelist.js';
import { A1_BASE } from '../core/whitelist.config.js';

const table = createLemmaTable(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/lemmas.json', import.meta.url), 'utf8')));
const wl = createWhitelist({ table });
const A1 = new Set(A1_BASE);

// ---------- CA-1: tokenización de don't, well-known, U.S., 3rd ----------
test('CA-1: don\'t, well-known, U.S. y 3rd se tokenizan como pide la subparte', () => {
  const [dont, wk, us, third] = tokenize("don't well-known U.S. 3rd");
  assert.deepEqual([dont.kind, dont.parts], ['word', ['do', 'not']]);
  assert.deepEqual([wk.kind, wk.parts, wk.hyphenated], ['word', ['well', 'known'], true]);
  assert.deepEqual([us.kind, us.text], ['acronym', 'U.S.']);
  assert.deepEqual([third.kind, third.parts], ['number', []]);
});
test('CA-1 dentro de check: don\'t es conocida con do y not; U.S. y 3rd no cuentan', () => {
  const r = wl.check("I don't know the U.S. 3rd", ['i', 'do', 'not', 'know', 'the']);
  assert.deepEqual([r.total, r.knownCount, r.pctKnown, r.ignored.acronyms, r.ignored.numbers], [4, 4, 1, 1, 1]);
});

// ---------- CA-2: la desconocida vuelve con su forma original y su lema ----------
test('CA-2: la desconocida trae la forma ORIGINAL (mayúsculas y apóstrofo curvo) y su lema', () => {
  const r = wl.check('She WALKED home.', ['she', 'home']);
  assert.equal(r.unknown.length, 1);
  assert.deepEqual([r.unknown[0].text, r.unknown[0].norm, r.unknown[0].lemma, r.unknown[0].lemmas, r.unknown[0].listed], ['WALKED', 'walked', 'walk', ['walk'], true]);
  assert.deepEqual([r.unknown[0].start, r.unknown[0].end], [4, 10]);
  const c = wl.check('I can’t go', ['i', 'not', 'go']);
  assert.equal(c.unknown[0].text, 'can’t');
  assert.deepEqual(c.unknown[0].parts, [{ part: 'can', lemmas: ['can'], listed: true }]);
});
test('CA-2: una palabra que la tabla no lista vuelve con su forma como lema probable', () => {
  const r = wl.check('We saw Zzyzx today.', [...A1].filter((l) => l !== 'see'));
  assert.deepEqual(r.unknown.map((u) => [u.text, u.lemma, u.listed]), [['saw', 'see', true]]);
  assert.deepEqual(r.names, ['Zzyzx']);
  const q = wl.check('The blorp is here', A1);
  assert.deepEqual([q.unknown[0].text, q.unknown[0].lemma, q.unknown[0].listed], ['blorp', 'blorp', false]);
});

// ---------- CA-3: 10 textos de control, resultado contado a mano ----------
// known 'A1' = la lista base A1 (A1_BASE). `unknown` = formas originales en orden de aparición.
const CONTROL = [
  { n: 1, text: 'I like coffee and tea.', known: 'A1', total: 5, knownCount: 5, unknown: [] },
  { n: 2, text: 'My brother and I play with our dog in the big garden every day after school and we love it.', known: 'A1', total: 20, knownCount: 19, unknown: ['garden'] },
  { n: 3, text: 'My brother and I play with our puppy in the big garden every day after school and we love it.', known: 'A1', total: 20, knownCount: 18, unknown: ['puppy', 'garden'] },
  { n: 4, text: 'My brother and I play with our puppy in the big garden every day after campus and we love it.', known: 'A1', total: 20, knownCount: 17, unknown: ['puppy', 'garden', 'campus'] },
  { n: 5, text: 'I don’t know. She can’t come. They’re here.', known: 'A1', total: 8, knownCount: 7, unknown: ['can’t'] },
  { n: 6, text: 'The 5-year-old boy lives in the U.S. and plays mp3 files on his phone at 10:30 on the 3rd.', known: 'A1', total: 15, knownCount: 14, unknown: ['files'], ignored: { numbers: 2, acronyms: 1, codes: 1, names: 0 } },
  { n: 7, text: 'Maria and Pedro live in Bogota. They love coffee.', known: 'A1', total: 7, knownCount: 6, unknown: ['Maria'], names: ['Pedro', 'Bogota'], ignored: { numbers: 0, acronyms: 0, codes: 0, names: 2 } },
  { n: 8, text: 'Maria likes tea. I met Maria today. Maria is nice.', known: 'A1', total: 7, knownCount: 7, unknown: [], names: ['Maria'], ignored: { numbers: 0, acronyms: 0, codes: 0, names: 3 } },
  { n: 9, text: 'He left the room.', known: ['he', 'the', 'room', 'leave'], total: 4, knownCount: 4, unknown: [] },
  { n: 10, text: 'Dog dog DOG\nThe dog ran. Ran, ran, RAN!', known: ['dog', 'the'], total: 9, knownCount: 5, unknown: ['ran'], count: 4 },
];
for (const c of CONTROL) {
  test(`CA-3: texto de control ${c.n}: ${c.total} palabras, ${c.knownCount} conocidas`, () => {
    const r = wl.check(c.text, c.known === 'A1' ? A1 : c.known);
    assert.equal(r.total, c.total);
    assert.equal(r.knownCount, c.knownCount);
    assert.equal(r.unknownCount, c.total - c.knownCount);
    assert.equal(r.pctKnown, c.knownCount / c.total);
    assert.deepEqual(r.unknown.map((u) => u.text), c.unknown);
    if (c.count !== undefined) assert.equal(r.unknown[0].count, c.count);
    if (c.ignored) assert.deepEqual(r.ignored, c.ignored);
    if (c.names) assert.deepEqual(r.names, c.names);
  });
}
test('CA-3: los textos 2, 3 y 4 caen justo en 0,95, 0,90 y por debajo del objetivo 90–95 %', () => {
  const pct = (i) => wl.check(CONTROL[i].text, A1).pctKnown;
  assert.deepEqual([pct(1), pct(2), pct(3)], [0.95, 0.9, 0.85]);
  assert.deepEqual([isWithinTarget(pct(1)), isWithinTarget(pct(2)), isWithinTarget(pct(3)), isWithinTarget(pct(0))], [true, true, false, false]);
});
test('CA-3: el texto 9 sin `leave` en lo conocido deja `left` como desconocida con los dos lemas', () => {
  const r = wl.check('He left the room.', ['he', 'the', 'room']);
  assert.deepEqual([r.total, r.knownCount, r.pctKnown], [4, 3, 0.75]);
  assert.deepEqual([r.unknown[0].text, r.unknown[0].lemma, r.unknown[0].lemmas], ['left', 'leave', ['leave', 'left']]);
});
test('CA-3 con la tubería real: palabras de la base de datos → knownLemmas → check', async () => {
  const db = createMemoryDb();
  await db.open();
  await db.put('words', { id: 'walk', state: 'learning' });
  await db.put('words', { id: 'dog', state: 'unknown' });
  const known = await knownLemmas(db, { table });
  const r = wl.check('I walked the dog.', known);
  assert.deepEqual([r.total, r.knownCount], [4, 3]); // I, walked (walk), the; `dog` está marcada unknown
  assert.deepEqual(r.unknown.map((u) => u.text), ['dog']);
});

// ---------- CA-4: texto vacío y emoji ----------
test('CA-4: vacío, solo espacios, solo emoji, solo números: nada que medir (pctKnown null), sin lanzar', () => {
  for (const t of ['', '   \n\t', '😀', '😀😀 👍🏽 🇨🇴', '123 4.5 3rd', '...!?', '👨‍👩‍👧‍👦']) {
    const r = wl.check(t, A1);
    assert.deepEqual([r.total, r.knownCount, r.unknown, r.pctKnown], [0, 0, [], null], JSON.stringify(t));
    assert.equal(isWithinTarget(r.pctKnown), false);
  }
  for (const t of [null, undefined, {}, [], 5, NaN]) assert.doesNotThrow(() => wl.check(t, A1));
});
test('CA-4: el emoji entre palabras no las rompe ni cuenta', () => {
  const r = wl.check('I 😀 like 🎉 tea', A1);
  assert.deepEqual([r.total, r.knownCount, r.pctKnown], [3, 3, 1]);
});
