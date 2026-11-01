// @purpose: Fuzz con semilla fija de three_forms (2.5-T3, punto 6): calificación por forma independiente, validador de data.forms con entradas hostiles y pantalla con toques al azar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeForms, readForms, FORM_KEYS } from '../core/threeForms.js';
import { DATA_SPECS } from '../core/contentData.js';
import { validateItem } from '../core/contentItem.js';
import { createThreeForms } from '../ui/exercises/threeForms.js';
import { makeEnv } from './_fakeDom.mjs';

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };

const VERBS = [
  { present: 'sing', past: 'sang', participle: 'sung' },
  { present: 'go', past: 'went', participle: ['gone'] },
  { present: 'learn', past: ['learnt', 'learned'], participle: ['learnt', 'learned'] },
  { present: 'put', past: 'put', participle: 'put' },
];
const POOL = ['sing', 'sang', 'sung', 'went', 'gone', 'go', 'learnt', 'learned', 'put', 'Sing', ' sang ', 'sing.', 'sng', 'singed', 'singg', 'wennt', 'gonee', 'putt', '', '   ', 'x'.repeat(250), 'I\u0000sing', '__proto__'];
const firstOf = (x) => (Array.isArray(x) ? x[0] : x);
// Texto para una forma: 45 % exacto, 25 % con errata (última letra repetida), 30 % del fondo común.
const textFor = (r, verb, key) => { const x = r(); const a = firstOf(verb[key]); return x < 0.45 ? a : x < 0.7 ? a + a.slice(-1) : pick(r, POOL); };
const mk = (forms) => ({
  id: 'vrb.irreg.0001', type: 'three_forms', topics: ['gram.present_perfect.form'], level: 'A2', prompt_es: 'cantar', data: { forms },
  explain_es: 'x', source: 'original', version: 1,
});

test('fuzz de lógica (400 casos): no lanza, es determinista y cada forma se califica SOLA', () => {
  const r = rng(20261031);
  let sawAlmost = false;
  for (let n = 0; n < 400; n += 1) {
    const verb = pick(r, VERBS);
    const it = mk(verb);
    const texts = FORM_KEYS.map((k) => textFor(r, verb, k));
    const g = gradeForms(it, texts);
    assert.deepEqual(gradeForms(it, texts), g, 'determinista');
    assert.equal(g.forms.length, 3);
    FORM_KEYS.forEach((k, i) => {
      const other = texts.map((t, j) => (j === i ? t : textFor(r, verb, FORM_KEYS[j])));
      const g2 = gradeForms(it, other);
      assert.equal(g2.forms[i].result, g.forms[i].result, `la forma ${k} no depende de las otras`);
      assert.equal(g2.forms[i].swappedWith, g.forms[i].swappedWith);
    });
    const rs = g.forms.map((f) => f.result);
    assert.equal(g.allCorrect, rs.every((x) => x === 'correct'));
    assert.equal(g.result, rs.every((x) => x === 'correct') ? 'correct' : rs.some((x) => x === 'wrong') ? 'wrong' : 'almost');
    if (rs.includes('almost')) sawAlmost = true;
    assert.equal(g.anyEmpty, texts.some((t) => String(t).trim() === ''));
    g.forms.forEach((f) => { if (f.empty) assert.equal(f.result, 'wrong'); if (f.swappedWith) assert.equal(f.result, 'wrong'); });
  }
  assert.equal(sawAlmost, true, 'el fuzz llega a producir «almost»');
});

test('fuzz de lógica: la respuesta exacta de cada forma siempre es correcta, también por lista y por objeto', () => {
  for (const v of VERBS) {
    const first = (x) => (Array.isArray(x) ? x[0] : x);
    const texts = FORM_KEYS.map((k) => first(v[k]));
    assert.equal(gradeForms(mk(v), texts).result, 'correct');
    assert.equal(gradeForms(mk(v), Object.fromEntries(FORM_KEYS.map((k, i) => [k, texts[i]]))).result, 'correct');
  }
});

test('fuzz del validador (500 ítems hostiles): nunca lanza y ok coincide con un oráculo independiente', () => {
  const r = rng(7771);
  const junk = [undefined, null, 5, true, '', '  ', 'sing', ['sing'], [], [''], ['a', 3], {}, [[]], 'x'.repeat(500), Array.from({ length: 11 }, () => 'a'), { x: 1 }];
  const valid = (v) => (typeof v === 'string' ? v.trim() !== '' && v.length <= 120 : Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every((s) => typeof s === 'string' && s.trim() !== '' && s.length <= 120));
  for (let n = 0; n < 500; n += 1) {
    const forms = r() < 0.15 ? pick(r, junk) : Object.fromEntries(FORM_KEYS.map((k) => [k, pick(r, junk)]));
    const it = mk(forms);
    let res;
    assert.doesNotThrow(() => { res = validateItem(it, { dataSpecs: DATA_SPECS }); });
    const expected = forms !== null && typeof forms === 'object' && !Array.isArray(forms) && Object.keys(forms).length === 3 && FORM_KEYS.every((k) => valid(forms[k]));
    assert.equal(res.ok, expected, JSON.stringify(forms));
    if (!expected) assert.ok(res.errors.length > 0);
    if (res.ok) assert.equal(readForms(it).ok, true, 'lo que el validador acepta, la pantalla lo puede montar');
  }
});

test('fuzz de pantalla (60 secuencias): un solo envío, nunca lanza y el resultado es el de la faceta', async () => {
  const r = rng(424242);
  for (let run = 0; run < 60; run += 1) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    const sent = [];
    const facet = pick(r, [0, 1, 2, 3, undefined]);
    const verb = pick(r, VERBS);
    const failFirst = r() < 0.25;
    const m = createThreeForms().mount(root, mk(verb), { doc: env.doc, entry: { facet }, submit: async (a) => { sent.push(a); return failFirst && sent.length === 1 ? { status: 'error' } : { status: 'saved' }; } });
    const inputs = root.querySelectorAll('input');
    const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
    const typed = FORM_KEYS.map((k) => textFor(r, verb, k));
    typed.forEach((t, i) => { inputs[i].value = t; inputs[i].dispatchEvent(ev('input')); });
    for (let step = 0; step < 8; step += 1) {
      const a = r();
      if (a < 0.4) { const i = Math.floor(r() * 3); typed[i] = pick(r, POOL); inputs[i].value = typed[i]; inputs[i].dispatchEvent(ev('input')); }
      else if (a < 0.75) click(btn('Comprobar'));
      else if (a < 0.9) click(btn('No sé'));
      else if (btn('Ver pista')) click(btn('Ver pista'));
      await settle(env);
    }
    const good = sent.filter((s) => s.result !== undefined);
    const accepted = failFirst ? good.slice(1) : good;
    assert.ok(accepted.length <= 1 || failFirst, `corrida ${run}: un envío bueno como máximo`);
    assert.ok(sent.length <= (failFirst ? 2 : 1), `corrida ${run}: ${sent.length} envíos`);
    for (const s of sent) {
      if (s.result === 'dont_know') continue;
      const g = gradeForms(mk(verb), s.responseRaw.split(' / '));
      const own = Number.isInteger(facet) && facet >= 0 && facet <= 2 ? g.forms[facet].result : g.result;
      assert.equal(s.result, own, `corrida ${run}: resultado de la faceta ${facet}`);
    }
    if (good.length > (failFirst ? 1 : 0)) assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, '', `corrida ${run}: tras enviar no queda aviso`);
    assert.doesNotThrow(() => { m.getResponse(); m.destroy(); });
    assert.equal(env.stats.live(), 0, `corrida ${run}: sin listeners`);
  }
});
