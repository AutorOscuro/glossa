// @purpose: Compara la respuesta de la persona con las aceptadas (normaliza, tolera erratas) y devuelve resultado, diferencias y códigos de error.
// Comparación de una respuesta con las aceptadas (subparte 1.2, cuartos 2B y 3B). Contrato: docs/CONTRACTS.md 8.5 y Parte 2 (1.2-2B y 1.2-3B).
//
//   compare(userText, accept, opts?) → { result, matched, diff, spellingFlags, errorCodes }     PURA. Nunca lanza.
//     userText  lo que escribió la persona (cualquier valor: lo que no es texto cuenta como vacío).
//     accept    lista de respuestas válidas COMPLETAS (también vale un solo texto). Lo que no es texto o queda vacío se ignora.
//     opts      { confusables, lang, keepFinalPunctuation, almostAtWordEnd } (todo opcional; otro valor se ignora). Se leen en core/typo.js.
//                 confusables            resultado de createConfusables (core/confusables.js). Sin él, "almost" solo usa la distancia.
//                 lang: 'es'             quita diacríticos al comparar (solo ejercicios en español; en inglés NUNCA).
//                 keepFinalPunctuation   la puntuación final cuenta (ejercicios que la evalúan).
//                 almostAtWordEnd: true  permite "almost" cuando el error está en la ÚLTIMA letra (apagado por defecto, ver abajo).
//     result    'correct' | 'almost' | 'wrong'.
//     matched   la respuesta aceptada TAL COMO viene en `accept` (la primera que coincide); null si es 'wrong'.
//     diff      corrección palabra por palabra (core/wordDiff.js) contra UNA referencia: `matched` si es correct/almost; si es 'wrong', la
//               aceptada de menor coste de alineación (`alignWords`; en empate, la primera de `accept`; se miran las primeras 100). Es [] solo si
//               no hay ninguna aceptada válida. Con respuesta vacía son todas `missing` de la aceptada más corta.
//     spellingFlags   para 'almost', UNA marca { word, expected, index } con la palabra mal escrita (normalizada y sin puntuación pegada), la
//               correcta y su posición (desde 0) entre las palabras de lo escrito ya normalizadas (`don't` cuenta como dos); es la que
//               usan 2.2/2.5 para crear la tarjeta `spell`. Para correct y wrong es []. No depende del recorte de 250 palabras del diff.
//     errorCodes  códigos de mecánica que NO invalidan: ['MECH.CAP_I'] si la persona escribió `i` minúscula como pronombre
//                 (se mira el texto ORIGINAL; en lang 'es' no se mira). Extiende el contrato 8.5 en una clave nueva (ver CONTRACTS 1.2-2B).
//
// Reglas (8.5):
//   1) Se normaliza usuario y cada respuesta con `normalize(…, { contractions: 'expand' })` (`I've` ≡ `I have`).
//   2) 'correct' = igual tras normalizar con alguna respuesta aceptada.
//   3) 'almost' = mismas palabras salvo UNA, y esa palabra (en las dos formas) tiene ≥ 4 letras, solo letras y apóstrofo, y está a
//      distancia de Damerau-Levenshtein exactamente 1. Se acepta como correcta para el SRS y se marca la ortografía (cuarto 3).
//   4) 'almost' NUNCA si la pareja está en la lista de confusables (el cambio crea otra palabra válida: bad/bed).
//   5) 'wrong' = todo lo demás. Una respuesta vacía siempre es 'wrong'.
// Reglas propias de esta mitad (ver DECISIONS.md 1.2-2B):
//   - Un cambio en la ÚLTIMA letra no es 'almost' (work/works, send/sent, take/taken son errores de gramática, no de tecleo, y la
//     lista de confusables no puede cubrirlos todos). `opts.almostAtWordEnd: true` lo permite.
//   - Palabras con números, guiones o puntuación en medio no son 'almost' (2025 ≠ 2026 no es un error de tecleo).
//   - La puntuación INTERIOR (`. , ! ? …` seguida de espacio) se ignora al comparar (decisión del Administrador): `yes, I do` ≡ `yes I do`.
//     Los apóstrofos y los guiones sí cuentan.
//
// Sin dependencias ni DOM: corre en Node y en el navegador.
import { hasLowercaseI } from './normalize.js';
import { readOptions, prepare, isNearTypo, wordCore } from './typo.js';
import { wordDiff, alignWords } from './wordDiff.js';

const MAX_ACCEPT = 1000; // tope defensivo: ningún ítem real tiene tantas respuestas
const MAX_DIFF_CANDIDATES = 100; // aceptadas que se miran para elegir la más cercana cuando es 'wrong' (cada alineación cuesta hasta 250 × 250)

function listAnswers(accept) {
  const list = Array.isArray(accept) ? accept.slice(0, MAX_ACCEPT) : [accept];
  return list.filter((a) => typeof a === 'string' || (typeof a === 'number' && Number.isFinite(a)));
}

// Si las dos frases ya preparadas difieren en UNA sola palabra y esa pareja es un error de tecleo → { index, word, expected }; si no, null.
function almostAt(userNorm, answerNorm, ropts) {
  const U = userNorm.split(' ');
  const A = answerNorm.split(' ');
  if (U.length !== A.length) return null;
  let at = -1;
  for (let i = 0; i < U.length; i += 1) {
    if (U[i] === A[i]) continue;
    if (at !== -1) return null; // más de una palabra distinta
    at = i;
  }
  if (at === -1 || !isNearTypo(U[at], A[at], ropts)) return null;
  return { index: at, word: wordCore(U[at]), expected: wordCore(A[at]) };
}

// Referencia del diff cuando es 'wrong': la aceptada con menor coste de alineación (empate: la primera).
function closestAnswer(userText, answers, opts) {
  let best = null;
  let bestCost = Infinity;
  for (const a of answers.slice(0, MAX_DIFF_CANDIDATES)) {
    const { cost } = alignWords(userText, a.raw, opts);
    if (cost < bestCost) {
      best = a;
      bestCost = cost;
    }
  }
  return best;
}

export function compare(userText, accept, opts) {
  const ropts = readOptions(opts);
  const user = prepare(userText, ropts);
  const errorCodes = !ropts.spanish && hasLowercaseI(userText) ? ['MECH.CAP_I'] : [];
  const out = (result, matched, diff, spellingFlags) => ({ result, matched, diff, spellingFlags, errorCodes });

  const answers = [];
  for (const raw of listAnswers(accept)) {
    const norm = prepare(raw, ropts);
    if (norm !== '') answers.push({ raw: typeof raw === 'string' ? raw : String(raw), norm });
  }
  if (user !== '') {
    const exact = answers.find((a) => a.norm === user);
    if (exact) return out('correct', exact.raw, wordDiff(userText, exact.raw, opts), []);
    for (const a of answers) {
      const near = almostAt(user, a.norm, ropts);
      if (near) return out('almost', a.raw, wordDiff(userText, a.raw, opts), [{ word: near.word, expected: near.expected, index: near.index }]);
    }
  }
  const closest = closestAnswer(userText, answers, opts);
  return out('wrong', null, closest ? wordDiff(userText, closest.raw, opts) : [], []);
}
