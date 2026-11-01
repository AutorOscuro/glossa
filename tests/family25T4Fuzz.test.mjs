// @purpose: Fuzz con semilla fija de fix_error, transform, keyword_transform, join_sentences y pronoun_placement (2.5-T4, punto 6): calificación, hasKeyword con oráculo, ítems hostiles y pantalla con toques al azar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFix } from '../core/fixError.js';
import { gradeTransform, hasKeyword, TRANSFORM_TYPES, KEYWORD_TYPES } from '../core/transformTypes.js';
import { gradeText } from '../core/textAnswer.js';
import { compare } from '../core/compare.js';
import { validateItem } from '../core/contentItem.js';
import { DATA_SPECS } from '../core/contentData.js';
import { createFixError } from '../ui/exercises/fixError.js';
import { createTransformType } from '../ui/exercises/transformTypes.js';
import { makeEnv } from './_fakeDom.mjs';

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };

// ---------- ítems de los cinco tipos (válidos para el validador real) ----------
const BASE = { topics: ['gram.modals.can'], level: 'A2', explain_es: 'x', source: 'original', version: 1 };
const SPECS = [
  { type: 'fix_error', id: 'trn.fix.0001', prompt_es: 'Corrige el error.', prompt_en: 'She can to swim.', accept: ['She can swim.', 'She is able to swim.'],
    distractors: [{ text: 'She cans swim.', code: 'GRM.CAN_S' }, { text: 'She can to swim well.', code: 'GRM.CAN_TO' }], error_codes: ['GRM.CAN_TO'], data: { hint: 'Después de can va el verbo solo.' } },
  { type: 'fix_error', id: 'trn.fix.0002', prompt_es: 'Corrige el error.', prompt_en: "I'm living here since two years.", accept: ["I've lived here for two years."],
    distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }], error_codes: ['TNS.SINCE_FOR', 'TNS.PRES_CONT'], data: { hint: null } },
  { type: 'transform', id: 'trn.tran.0001', prompt_es: 'Reescribe la oración.', accept: ['He is so tired that he cannot run.'],
    distractors: [{ text: 'He is so tired to run.', code: 'CNJ.SO_TO' }], error_codes: ['CNJ.TOO'], data: { source: 'He is too tired to run.', instruction_es: 'Usa «so… that».', keyword: null } },
  { type: 'transform', id: 'trn.tran.0002', prompt_es: 'Pasa a voz pasiva.', accept: ['The room was painted by Tom.'],
    distractors: [{ text: 'The room was paint by Tom.', code: 'PAS.PART' }], error_codes: [], data: { source: 'Tom painted the room.', instruction_es: null, keyword: 'ignorada' } },
  { type: 'keyword_transform', id: 'trn.keyw.0001', prompt_es: 'Usa la palabra clave.', accept: ['She is taller than me.', 'She is taller than I am.'],
    distractors: [{ text: 'She is more tall than me.', code: 'CMP.MORE_TALL' }], error_codes: ['CMP.AS'], data: { source: 'I am not as tall as her.', instruction_es: 'Reescribe con «taller».', keyword: 'taller' } },
  { type: 'keyword_transform', id: 'trn.keyw.0002', prompt_es: 'Usa la palabra clave.', accept: ['Unless you hurry, you will be late.'],
    distractors: [{ text: 'Unless you do not hurry, you will be late.', code: 'CND.UNLESS_NEG' }], error_codes: [], data: { source: 'If you do not hurry, you will be late.', instruction_es: null, keyword: 'unless' } },
  { type: 'join_sentences', id: 'trn.join.0001', prompt_es: 'Une las oraciones.', accept: ['We stayed home because it rained.', 'Because it rained, we stayed home.'],
    distractors: [{ text: 'We stayed home so it rained.', code: 'CNJ.SO_BECAUSE' }], error_codes: ['CNJ.BECAUSE'], data: { source: 'It rained. We stayed home.', instruction_es: null, keyword: 'because' } },
  { type: 'join_sentences', id: 'trn.join.0002', prompt_es: 'Une las oraciones.', accept: ['She was tired, so she went to bed.', 'She was tired so she went to bed.'],
    distractors: [], error_codes: [], data: { source: 'She was tired. She went to bed.', instruction_es: null, keyword: null } },
  { type: 'pronoun_placement', id: 'trn.pron.0001', prompt_es: 'Cambia el objeto por un pronombre.', prompt_en: 'Pick up the box.', accept: ['Pick it up.'],
    distractors: [{ text: 'Pick up it.', code: 'PRN.PHRASAL_SPLIT' }], error_codes: ['PRN.PHRASAL_SPLIT'], data: { hint: 'El pronombre va en medio.' } },
  { type: 'pronoun_placement', id: 'trn.pron.0002', prompt_es: 'Cambia el objeto por un pronombre.', prompt_en: 'Turn off the light.', accept: ['Turn it off.'],
    distractors: [{ text: 'Turn off it.', code: 'PRN.PHRASAL_SPLIT' }], error_codes: [], data: { hint: null } },
];
const ITEMS = SPECS.map((s) => ({ ...BASE, ...s }));
// Oráculo propio: los tipos con clave se escriben aquí, no se leen de la lógica que se prueba.
const KW_TYPES = ['keyword_transform', 'join_sentences'];
const sentenceFor = (it) => (it.type === 'fix_error' || it.type === 'pronoun_placement' ? it.prompt_en : it.data.source);
const keywordFor = (it) => (KW_TYPES.includes(it.type) && typeof it.data.keyword === 'string' ? it.data.keyword : null);
// gradeFix no trae `keyword` ni `keywordMissing` (fix_error no tiene clave): se normalizan para tratar los cinco tipos igual.
const gradeBy = (it, text, opts) => {
  const g = it.type === 'fix_error' ? gradeFix(it, text, opts) : gradeTransform(it, text, it.type, opts);
  return { keyword: null, keywordMissing: false, ...g };
};

const CATALOG = { has: (c) => c === 'GRM.CAN_S' || c === 'CMP.MORE_TALL' || c === 'PRN.PHRASAL_SPLIT', get: () => null, hint: () => 'Una pista del catálogo.' };
const JUNK_HITS = [null, 5, 'x', [null, 3], [{ code: 'A' }]];
const DETECTS = {
  none: () => [],
  rules: (t) => (/can to/i.test(t) ? [{ code: 'GRM.CAN_TO', hint: 'Parece que usaste «can to».' }, { code: 'X.SECOND', hint: 'otra' }] : []),
  always: () => [{ code: 'ANY.HIT', hint: '  Una pista cualquiera.  ' }],
  throws: () => { throw new Error('boom'); },
  garbage: (t) => JUNK_HITS[t.length % JUNK_HITS.length],
};

// Errata de verdad: intercambia dos letras del interior de la palabra más larga.
function typo(s) {
  const m = [...s.matchAll(/[A-Za-z]{5,}/g)].sort((a, b) => b[0].length - a[0].length)[0];
  if (!m) return `${s}x`;
  const w = m[0]; const i = Math.floor(w.length / 2);
  const t = w[i] === w[i + 1] ? w.slice(0, i) + w.slice(i + 1) : w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
  return s.slice(0, m.index) + t + s.slice(m.index + w.length);
}
const recase = (r, s) => { const x = r(); return x < 0.45 ? s : x < 0.6 ? s.toLowerCase() : x < 0.72 ? `  ${s}  ` : x < 0.85 ? s.replace(/\.$/, '') : s.toUpperCase(); };
function noiseFor(it) {
  const kw = keywordFor(it);
  const out = ['', '   ', 'x'.repeat(250), 'I\u0000go', '__proto__', 'She can to run.', 'Nothing useful here.', it.accept[0].toUpperCase(), `${it.accept[0]} ${it.accept[0]}`, 'Pick up it.'];
  if (kw) out.push(it.accept[0].replace(new RegExp(`\\b${kw}\\b`, 'i'), 'xxx'), 'This sentence skips the keyword.');
  return out;
}
// 22 % respuesta aceptada, 12 % errata, 16 % la oración base, 16 % trampa conocida, 34 % del fondo común.
function textFor(r, it) {
  const x = r();
  if (x < 0.22) return pick(r, it.accept);
  if (x < 0.34) return typo(pick(r, it.accept));
  if (x < 0.5) return recase(r, sentenceFor(it));
  if (x < 0.66 && it.distractors.length > 0) return recase(r, pick(r, it.distractors).text);
  return pick(r, noiseFor(it));
}

test('los ítems del fuzz son válidos para el validador real y cubren los cinco tipos', () => {
  for (const it of ITEMS) {
    const res = validateItem(it, { dataSpecs: DATA_SPECS });
    assert.equal(res.ok, true, `${it.id}: ${JSON.stringify(res.errors)}`);
  }
  assert.deepEqual([...new Set(ITEMS.map((i) => i.type))].sort(), ['fix_error', 'join_sentences', 'keyword_transform', 'pronoun_placement', 'transform']);
  assert.deepEqual([...TRANSFORM_TYPES], ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']);
  assert.deepEqual([...KEYWORD_TYPES], KW_TYPES);
});

test('fuzz de lógica (1000 casos): determinista, sin lanzar, los extras solo donde toca y el detector no cambia el resultado', () => {
  const r = rng(20261031);
  const seen = { correct: 0, almost: 0, wrong: 0, unchanged: 0, trap: 0, hint: 0, kw: 0, empty: 0, trapHint: 0 };
  for (let n = 0; n < 1000; n += 1) {
    const it = pick(r, ITEMS);
    const text = textFor(r, it);
    const mode = pick(r, Object.keys(DETECTS));
    let calls = 0;
    const detect = (t) => { calls += 1; return DETECTS[mode](t); };
    const g = gradeBy(it, text, { detect });
    const asked = calls;
    assert.deepEqual(gradeBy(it, text, { detect }), g, `determinista (${it.id}, «${text}»)`);
    assert.equal(calls, asked * 2, 'el detector se pregunta lo mismo cada vez');
    const plain = gradeBy(it, text, {});
    assert.equal(plain.result, g.result, 'el detector nunca cambia el resultado');
    assert.deepEqual(plain.hits, []);
    seen[g.result] += 1;
    if (g.empty) seen.empty += 1;

    // El detector se consulta cuando es wrong y no es «sin cambios» ni vacío (también con trampa: la pista se conserva).
    assert.equal(asked, g.result === 'wrong' && !g.unchanged && !g.empty ? 1 : 0, `${it.id} «${text}» (${g.result})`);
    assert.equal(g.typed, String(text).trim());
    assert.equal(new Set(g.errorCodes).size, g.errorCodes.length, 'códigos sin repetir');
    assert.equal(g.keyword ?? null, keywordFor(it), 'la clave es la del ítem solo en los tipos con clave');

    // Oráculo propio del resultado: sale de gradeText y compare (que no se rompen aquí) y de las reglas del contrato, no de gradeTransform/gradeFix.
    const base = gradeText(it, text, {});
    const same = !base.empty && compare(base.typed, [sentenceFor(it).trim()], {}).result === 'correct';
    const wantUnchanged = !base.empty && base.result !== 'correct' && same;
    const wantResult = base.empty || base.result === 'correct' ? base.result : wantUnchanged ? 'wrong' : base.result === 'almost' ? 'almost' : 'wrong';
    assert.equal(g.unchanged, wantUnchanged, `«sin cambios» de «${text}» en ${it.id}`);
    assert.equal(g.result, wantResult, `resultado de «${text}» en ${it.id}`);

    const empty = [g.unchanged, g.trap, g.hits.length, g.hint, g.keywordMissing];
    if (g.result === 'correct' || g.result === 'almost' || g.empty) assert.deepEqual(empty, [false, null, 0, null, false], `${g.result} no lleva extras`);
    if (g.unchanged) {
      seen.unchanged += 1;
      assert.equal(g.result, 'wrong');
      assert.deepEqual([g.trap, g.hits.length, g.hint, g.keywordMissing], [null, 0, null, false]);
      for (const c of it.error_codes) assert.ok(g.errorCodes.includes(c), 'lleva los error_codes del ítem');
    }
    if (g.trap !== null) {
      seen.trap += 1;
      assert.equal(g.result, 'wrong');
      assert.equal(g.unchanged, false);
      assert.ok(it.distractors.some((d) => d.text === g.trap.text && d.code === g.trap.code), 'la trampa es un distractor del ítem');
      assert.ok(g.errorCodes.includes(g.trap.code));
    } else if (g.hits.length > 0 && typeof g.hits[0].code === 'string') {
      assert.ok(g.errorCodes.includes(g.hits[0].code), 'sin trampa manda el código del primer aviso');
    }
    if (g.trap !== null && g.hint !== null) seen.trapHint += 1;
    if (g.hint !== null) { seen.hint += 1; assert.equal(g.hint, g.hits[0].hint.trim()); }
    if (g.hits.length === 0) assert.equal(g.hint, null);

    // Clave ausente: solo en los tipos con clave, solo si no acierta ni es «sin cambios», y exactamente cuando falta.
    const kw = keywordFor(it);
    if (!KW_TYPES.includes(it.type)) assert.equal(g.keywordMissing, false);
    const shouldMiss = kw !== null && g.result === 'wrong' && !g.unchanged && !g.empty && !hasKeyword(g.typed, kw);
    if (it.type !== 'fix_error') assert.equal(g.keywordMissing, shouldMiss, `clave «${kw}» en «${text}»`);
    if (g.keywordMissing) seen.kw += 1;
  }
  for (const k of ['correct', 'almost', 'wrong', 'unchanged', 'trap', 'hint', 'kw', 'empty', 'trapHint']) assert.ok(seen[k] > 0, `el fuzz llega a «${k}» (${JSON.stringify(seen)})`);
});

test('fuzz de lógica: cada respuesta aceptada es correcta (mayúsculas y espacios aparte) con cualquier detector y no lo consulta', () => {
  for (const it of ITEMS) {
    for (const a of it.accept) {
      for (const text of [a, a.toLowerCase(), `  ${a}  `]) {
        for (const mode of Object.keys(DETECTS)) {
          let calls = 0;
          const g = gradeBy(it, text, { detect: (t) => { calls += 1; return DETECTS[mode](t); } });
          assert.equal(g.result, 'correct', `${it.id}: «${text}»`);
          assert.equal(calls, 0);
          assert.deepEqual([g.unchanged, g.trap, g.hits.length, g.keywordMissing], [false, null, 0, false]);
        }
      }
    }
  }
});

test('fuzz de hasKeyword (1500 casos) contra un oráculo independiente', () => {
  const r = rng(99);
  const W = ['taller', 'than', 'she', 'is', 'does', 'do', 'because', 'so', 'not', 'as', 'the', 'me', 'run', 'unless', 'if', 'tall', 'because'];
  const SEP = [' ', '  ', ', ', '. ', '; ', ' - '];
  const cap = (w) => { const x = r(); return x < 0.6 ? w : x < 0.8 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1); };
  for (let n = 0; n < 1500; n += 1) {
    const toks = Array.from({ length: Math.floor(r() * 9) }, () => pick(r, W));
    const text = toks.map((w, i) => cap(w) + (i < toks.length - 1 ? pick(r, SEP) : '')).join('');
    const key = Array.from({ length: 1 + Math.floor(r() * 2) }, () => pick(r, W));
    const have = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const expected = ` ${have.join(' ')} `.includes(` ${key.join(' ')} `);
    assert.equal(hasKeyword(text, key.join(' ')), expected, `«${key.join(' ')}» en «${text}»`);
  }
  assert.equal(hasKeyword('I do not know.', 'do'), true);
  assert.equal(hasKeyword('He does it.', 'do'), false, '«does» no es «do»');
  assert.equal(hasKeyword('I don’t know.', "don't"), true, 'apóstrofo tipográfico');
  for (const empty of ['', '  ', null, undefined, 5]) assert.equal(hasKeyword('lo que sea', empty), true, 'sin clave siempre está');
  for (const junk of [null, undefined, 5, {}, []]) assert.doesNotThrow(() => hasKeyword(junk, 'taller'));
});

test('fuzz de ítems hostiles (400): el validador nunca lanza; lo que acepta se monta y se califica; lo que no, falla con un error propio', () => {
  const r = rng(7771);
  const JUNK = [undefined, null, 5, true, '', '  ', 'x', ['a'], [], {}, 'y'.repeat(600), [{ text: 5 }], { source: 1 }];
  const FIELDS = ['prompt_en', 'prompt_es', 'accept', 'distractors', 'error_codes', 'data', 'data.source', 'data.instruction_es', 'data.keyword', 'data.hint'];
  let okSeen = 0; let badSeen = 0;
  for (let n = 0; n < 400; n += 1) {
    const it = structuredClone(pick(r, ITEMS));
    const path = pick(r, FIELDS).split('.');
    const junk = pick(r, JUNK);
    const holder = path.length === 2 ? (it[path[0]] !== null && typeof it[path[0]] === 'object' ? it[path[0]] : (it[path[0]] = {})) : it;
    const key = path[path.length - 1];
    if (junk === undefined) delete holder[key]; else holder[key] = structuredClone(junk);

    let res;
    assert.doesNotThrow(() => { res = validateItem(it, { dataSpecs: DATA_SPECS }); });
    const ui = it.type === 'fix_error' ? createFixError({ detect: DETECTS.none }) : createTransformType(it.type, { detect: DETECTS.none });
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    let m = null;
    try { m = ui.mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) }); } catch (e) { assert.ok(e instanceof TypeError, `solo TypeError al montar: ${e}`); }
    if (res.ok) {
      okSeen += 1;
      assert.ok(m !== null, `el validador aceptó ${JSON.stringify(path)}=${JSON.stringify(junk)} y la pantalla no pudo montarla`);
      for (const text of ['', 'x', it.accept[0], 'She can to run.']) assert.doesNotThrow(() => gradeBy(it, text, { detect: DETECTS.rules }));
    } else {
      badSeen += 1;
      assert.ok(res.errors.length > 0);
      try { gradeBy(it, 'x', {}); } catch (e) { assert.ok(e instanceof Error); assert.match(e.message, /accept|ítem/i); }
    }
    if (m) assert.doesNotThrow(() => m.destroy());
    assert.equal(env.stats.live(), 0, 'sin listeners');
  }
  assert.ok(okSeen > 0 && badSeen > 0, `hay de los dos (${okSeen}/${badSeen})`);
});

test('fuzz de pantalla (150 secuencias, 5 tipos): un solo envío, resultado y avisos los del grado y sin listeners al cerrar', async () => {
  const r = rng(424242);
  const seen = { unchanged: 0, trap: 0, kwmissing: 0, detect: 0, dont: 0, failed: 0 };
  for (let run = 0; run < 150; run += 1) {
    const it = ITEMS[run % ITEMS.length];
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    const sent = [];
    const saved = [];
    let cur = '';
    const mode = pick(r, Object.keys(DETECTS));
    const detect = DETECTS[mode];
    const catalog = pick(r, [CATALOG, () => CATALOG, () => { throw new Error('boom'); }, undefined]);
    const failFirst = r() < 0.25;
    const opts = { detect, catalog, log: () => {} };
    const ui = it.type === 'fix_error' ? createFixError(opts) : createTransformType(it.type, opts);
    // A veces el ítem trae otro `type`: manda el del envoltorio (la pantalla fija `data-type` con el suyo).
    const shown = r() < 0.25 ? { ...it, type: pick(r, ['fix_error', 'transform', 'keyword_transform', 'listening']) } : it;
    const m = ui.mount(root, shown, { doc: env.doc, entry: {}, submit: async (a) => {
      sent.push({ a, typed: cur });
      const status = failFirst && sent.length === 1 ? 'error' : 'saved';
      saved.push(status);
      return { status };
    } });
    assert.equal(root.querySelectorAll('article')[0].dataset.type, it.type, `corrida ${run}: manda el tipo del envoltorio`);
    const input = root.querySelectorAll('input')[0];
    const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim().includes(label));
    const type = (v) => { cur = v; input.value = v; input.dispatchEvent(ev('input')); };
    type(textFor(r, it));
    for (let step = 0; step < 8; step += 1) {
      const a = r();
      if (a < 0.35) type(textFor(r, it));
      else if (a < 0.75) click(btn('Comprobar'));
      else if (a < 0.9) click(btn('No sé'));
      else if (btn('Ver pista')) click(btn('Ver pista'));
      await settle(env);
    }
    assert.ok(sent.length <= (failFirst ? 2 : 1), `corrida ${run}: ${sent.length} envíos`);
    if (failFirst && sent.length > 0) seen.failed += 1;
    for (const s of sent) {
      if (s.a.result === 'dont_know') { seen.dont += 1; continue; }
      const g = gradeBy(it, s.typed, { detect });
      assert.equal(s.a.result, g.result, `corrida ${run} (${it.id}, «${s.typed}»): resultado`);
      if (s.typed.length <= 150) assert.deepEqual(s.a.errorCodes, g.errorCodes, `corrida ${run}: códigos`);
    }
    const count = (cls) => root.querySelectorAll(cls).length;
    const notes = ['.ta__unchanged', '.ta__trap', '.ta__kwmissing', '.ta__detect'];
    for (const cls of notes) for (const node of root.querySelectorAll(cls)) {
      assert.equal(node.getAttribute('role'), 'note', `${cls} es un aviso`);
      assert.notEqual(node.textContent.trim(), '', `${cls} va en texto`);
    }
    if (saved.length > 0 && saved[saved.length - 1] === 'saved') {
      const fin = sent[sent.length - 1];
      if (fin.a.result === 'dont_know' || fin.a.result === 'correct' || fin.a.result === 'almost') {
        for (const cls of notes) assert.equal(count(cls), 0, `corrida ${run}: «${fin.a.result}» sin ${cls}`);
      } else {
        const g = gradeBy(it, fin.typed, { detect });
        const want = g.unchanged ? [1, 0, 0, 0] : [0, g.trap ? 1 : 0, g.keywordMissing && g.keyword ? 1 : 0, !g.trap && g.hint ? 1 : 0];
        assert.deepEqual(notes.map(count), want, `corrida ${run} (${it.id}, «${fin.typed}»): avisos`);
        seen.unchanged += want[0]; seen.trap += want[1]; seen.kwmissing += want[2]; seen.detect += want[3];
      }
    } else {
      for (const cls of notes) assert.equal(count(cls), 0, `corrida ${run}: sin envío guardado no hay avisos`);
    }
    assert.doesNotThrow(() => { m.getResponse(); m.destroy(); });
    assert.equal(env.stats.live(), 0, `corrida ${run}: sin listeners`);
  }
  for (const k of ['unchanged', 'trap', 'kwmissing', 'detect', 'dont', 'failed']) assert.ok(seen[k] > 0, `las secuencias llegan a «${k}» (${JSON.stringify(seen)})`);
});
