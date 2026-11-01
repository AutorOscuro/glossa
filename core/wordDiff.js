// @purpose: Corrección palabra por palabra: alinea la respuesta con la referencia y marca aciertos, faltas y sobras.
// Corrección palabra por palabra (subparte 1.2, cuarto 3, mitad 3A). Contrato: docs/CONTRACTS.md 1.2-3A.
//
//   wordDiff(userText, reference, opts?) → [{ text, status, expected? }]     PURA. Nunca lanza.
//     Alinea las palabras de lo que escribió la persona con UNA respuesta de referencia y dice qué pasó con cada una.
//     status:  'ok'       la palabra coincide.
//              'close'    error de tecleo "casi" (las mismas reglas que `almost` de compare, core/typo.js); `expected` = la correcta.
//              'wrong'    la persona escribió otra palabra donde iba `expected`.
//              'extra'    palabra de la persona que sobra.
//              'missing'  palabra de la referencia que falta (`text` es la palabra que faltaba).
//     `text` es la palabra NORMALIZADA (minúsculas, contracciones expandidas: `don't` se ve como `do not`, sin puntuación interior).
//     El orden es el de lectura: ok/close/wrong/extra siguen el orden de lo escrito y ok/close/wrong/missing el de la referencia.
//   alignWords(userText, reference, opts?) → { diff, cost }   lo mismo más el coste de la alineación (menor = más parecido): sirve
//     para elegir la respuesta aceptada más cercana (cuarto 3B). Costes: igual 0, "casi" 0,5, palabra cambiada 1,5, sobra o falta 1.
//   opts: los mismos que `compare` ({ lang, keepFinalPunctuation, confusables, almostAtWordEnd }); ver core/typo.js.
//   Cada texto se lee hasta 250 palabras (el componente de pantalla admite 500 elementos); lo que pasa de eso se descarta y suma 1 por palabra al coste.
//
// Sin dependencias ni DOM: corre en Node y en el navegador.
import { readOptions, prepare, isNearTypo } from './typo.js';

const MAX_WORDS = 250;
const COST_NEAR = 0.5;
const COST_WRONG = 1.5;
const COST_GAP = 1;

function words(text, ropts) {
  const prepared = prepare(text, ropts);
  const all = prepared === '' ? [] : prepared.split(' ');
  return { list: all.slice(0, MAX_WORDS), dropped: Math.max(0, all.length - MAX_WORDS) };
}

export function alignWords(userText, reference, opts) {
  const ropts = readOptions(opts);
  const u = words(userText, ropts);
  const r = words(reference, ropts);
  const U = u.list;
  const R = r.list;
  const n = U.length;
  const m = R.length;
  // pair[i][j]: coste y tipo de emparejar U[i] con R[j]
  const pairCost = (i, j) => {
    if (U[i] === R[j]) return [0, 'ok'];
    if (isNearTypo(U[i], R[j], ropts)) return [COST_NEAR, 'close'];
    return [COST_WRONG, 'wrong'];
  };
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) d[i][0] = i * COST_GAP;
  for (let j = 1; j <= m; j += 1) d[0][j] = j * COST_GAP;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      d[i][j] = Math.min(d[i - 1][j - 1] + pairCost(i - 1, j - 1)[0], d[i - 1][j] + COST_GAP, d[i][j - 1] + COST_GAP);
    }
  }
  // Camino de vuelta; en empate se prefiere emparejar, luego "sobra" y luego "falta" (resultado determinista).
  const out = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const [c, kind] = pairCost(i - 1, j - 1);
      if (d[i][j] === d[i - 1][j - 1] + c) {
        out.push(kind === 'ok' ? { text: U[i - 1], status: 'ok' } : { text: U[i - 1], status: kind, expected: R[j - 1] });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && d[i][j] === d[i - 1][j] + COST_GAP) {
      out.push({ text: U[i - 1], status: 'extra' });
      i -= 1;
    } else {
      out.push({ text: R[j - 1], status: 'missing' });
      j -= 1;
    }
  }
  out.reverse();
  return { diff: out, cost: d[n][m] + u.dropped * COST_GAP + r.dropped * COST_GAP };
}

export function wordDiff(userText, reference, opts) {
  return alignWords(userText, reference, opts).diff;
}
