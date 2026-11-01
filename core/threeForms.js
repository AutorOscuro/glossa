// @purpose: Lógica pura de three_forms (2.5-T3, punto 1): lectura de las tres formas del verbo y calificación por faceta (presente 0, pasado 1, participio 2); sin DOM.
// Cada forma es una tarjeta distinta en el repaso (roadmap 8.4 y 2.5): un fallo en una forma NO cambia el resultado de las otras. Sin DOM, sin reloj y sin azar.
//
//   FORM_KEYS = ['present', 'past', 'participle'] y FORM_FACETS = { present: 0, past: 1, participle: 2 }.
//   readForms(item) → { ok: true, forms: [{ key, facet, accept }] } | { ok: false, reason, missing? }
//       Lee item.data.forms[key] (un texto o una lista de textos; solo cuentan los no vacíos; las variantes van ahí: «learnt» y «learned»).
//       reason: 'no_item' (no es un objeto) · 'no_forms' (data.forms ausente) · 'incomplete' (falta alguna forma; `missing` lista las claves).
//   gradeForms(item, texts, opts?) → { forms: [{ key, facet, result, matched, diff, spellingFlags, errorCodes, typed, empty, swappedWith }], result, allCorrect, anyEmpty }
//       texts = { present, past, participle } o una lista de 3 en ese orden. Cada forma se compara sola con gradeText (compare inyectable en opts.compare).
//       result global: 'correct' si las tres lo son; 'almost' si ninguna es 'wrong' y alguna es 'almost'; si no, 'wrong'. Un campo vacío es 'wrong' con empty: true (la pantalla no envía).
//       Forma cambiada: si lo escrito NO acierta su forma pero es exactamente una de las aceptadas de OTRA forma (sung en el pasado de sing), la forma es 'wrong' aunque compare
//       lo viera como errata (sang/sung difieren en una letra), y `swappedWith` trae la clave de esa otra forma; en los demás casos es null.
//       Un ítem inválido lanza Error en español.
import { gradeText, isBlank } from './textAnswer.js';

export const FORM_KEYS = Object.freeze(['present', 'past', 'participle']);
export const FORM_FACETS = Object.freeze({ present: 0, past: 1, participle: 2 });

function listOf(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((a) => typeof a === 'string' && !isBlank(a));
}

export function readForms(item) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: 'no_item' };
  const data = item.data !== null && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : {};
  const raw = data.forms;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'no_forms' };
  const forms = FORM_KEYS.map((key) => ({ key, facet: FORM_FACETS[key], accept: listOf(raw[key]) }));
  const missing = forms.filter((f) => f.accept.length === 0).map((f) => f.key);
  if (missing.length > 0) return { ok: false, reason: 'incomplete', missing };
  return { ok: true, forms };
}

function textFor(texts, key, index) {
  if (Array.isArray(texts)) return texts[index];
  return texts !== null && typeof texts === 'object' ? texts[key] : undefined;
}

export function gradeForms(item, texts, opts = {}) {
  const r = readForms(item);
  if (!r.ok) {
    throw new Error(r.reason === 'no_item' ? 'gradeForms: el ítem no es un objeto'
      : r.reason === 'no_forms' ? 'gradeForms: el ítem no tiene las tres formas (data.forms)'
        : `gradeForms: faltan formas aceptadas (${r.missing.join(', ')})`);
  }
  const forms = r.forms.map((f, i) => {
    const g = gradeText({ type: 'three_forms', accept: f.accept }, textFor(texts, f.key, i), opts);
    const typed = g.typed.toLowerCase();
    const other = !g.empty && g.result !== 'correct' ? r.forms.find((o) => o.key !== f.key && o.accept.some((a) => a.trim().toLowerCase() === typed)) : undefined;
    return { key: f.key, facet: f.facet, ...g, result: g.empty || other ? 'wrong' : g.result, swappedWith: other ? other.key : null };
  });
  const allCorrect = forms.every((f) => f.result === 'correct');
  const anyWrong = forms.some((f) => f.result !== 'correct' && f.result !== 'almost');
  return { forms, result: allCorrect ? 'correct' : anyWrong ? 'wrong' : 'almost', allCorrect, anyEmpty: forms.some((f) => f.empty) };
}
