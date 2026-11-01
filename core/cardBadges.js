// @purpose: Datos de las insignias de una tarjeta de repaso (nivel, New, Repaso en, favorita) y texto de la hoja que explica el nivel; lógica pura sin DOM.
// Insignias de tarjeta (subparte 2.2, tramo 3). Roadmap 7.7 y 8.4. Puro: sin DOM ni base de datos.
//
//   badgesOf(card, now) → null | { level 1..5, isNew, due: 'Repaso en …' | null, fav }
//     null si no hay tarjeta. «New» = tarjeta que nunca se respondió (state 0 y reps 0): una nueva no muestra «Repaso en …» (su `due` es ahora).
//     El nivel sale de `levelOf` (estabilidad FSRS, 8.4): NO es el dominio del tema. La etiqueta sale de `dueLabel`.
//   levelHelp() → { title, intro, levels: [{ level, text }] } con los cortes reales de LEVEL_CUTS_DAYS (una sola fuente de verdad).
import { levelOf, dueLabel, LEVEL_CUTS_DAYS } from './srs.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function isNewCard(card) {
  if (!isObj(card)) return false;
  return card.state === 0 && !(Number.isFinite(card.reps) && card.reps > 0);
}

export function badgesOf(card, now) {
  if (!isObj(card)) return null;
  const isNew = isNewCard(card);
  let due = null;
  if (!isNew) {
    try { due = dueLabel(card, now); } catch { due = null; }
    if (typeof due !== 'string' || due === '') due = null;
  }
  return { level: levelOf(card), isNew, due, fav: card.fav === true };
}

const days = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function levelHelp() {
  const c = LEVEL_CUTS_DAYS;
  const levels = [{ level: 1, text: `Lo recuerdas menos de ${days(c[0])}: hay que repasarlo pronto.` }];
  for (let i = 1; i < c.length; i += 1) levels.push({ level: i + 1, text: `Te dura de ${days(c[i - 1])} a menos de ${days(c[i])}.` });
  levels.push({ level: c.length + 1, text: `Te dura ${days(c[c.length - 1])} o más: ya casi es permanente.` });
  return {
    title: 'Qué significa el nivel',
    intro: 'El nivel mide cuánto tiempo aguanta tu recuerdo de ESTA frase antes de que convenga repasarla. No es tu dominio del tema: sube cuando aciertas y baja cuando fallas.',
    levels,
  };
}
