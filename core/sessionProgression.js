// @purpose: Progresión del armador de sesiones (T4): qué tarjetas son de producción y cómo se mezclan con las de reconocimiento según el dominio del tema.
// Progresión (subparte 1.8, tramo 4). Roadmap 1.8 regla 9. Funciones PURAS, sin azar.
//   isProduction(type)                → true | false | null (null = tipo desconocido). Producción = la definición de 1.7 (SIGNAL_P): familias text_input, transform, speak, writing, mediation, open_ai y phrase_cloze.
//   masteryIndex(value)               → { map: Map<tema, pct 0–100>, ignored } con el dominio por tema (Map, objeto o lista de resultados de `compute`).
//   productionShare(pct)              → parte de producción (0–1) que corresponde a un tema con ese dominio (PROGRESSION.shareByBand).
//   orderByProgression(list, classOf, share) → la misma lista reordenada: cada puesto toma producción o reconocimiento para acercarse a `share`; si falta una clase, toma la otra.
import { typeInfo } from './contentTypes.js';
import { SIGNAL_P, BANDS } from './mastery.config.js';
import { PROGRESSION } from './session.config.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function isProduction(type) {
  const info = typeof type === 'string' ? typeInfo(type) : null;
  if (info === null) return null;
  return SIGNAL_P.families.includes(info.family) || SIGNAL_P.extraTypes.includes(type);
}

const validPct = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

export function masteryIndex(value) {
  const map = new Map();
  let ignored = 0;
  const put = (topic, v) => {
    const pct = isObj(v) ? v.pct : v;
    if (typeof topic === 'string' && topic !== '' && validPct(pct)) map.set(topic, pct);
    else ignored += 1;
  };
  if (value instanceof Map) for (const [k, v] of value) put(k, v);
  else if (Array.isArray(value)) for (const e of value) { if (isObj(e)) put(e.topicId ?? e.id, e.pct); else ignored += 1; }
  else if (isObj(value)) for (const [k, v] of Object.entries(value)) put(k, v);
  else throw new Error('session.build: mastery debe ser un Map, un objeto o una lista de resultados de mastery.compute');
  return { map, ignored };
}

export function productionShare(pct) {
  const p = validPct(pct) ? pct : 0;
  let band = BANDS[0];
  for (const b of BANDS) if (p >= b.min) band = b;
  return PROGRESSION.shareByBand[band.id] ?? 0;
}

export function orderByProgression(list, classOf, share) {
  const prod = [];
  const rec = [];
  for (const x of list) (classOf(x) === true ? prod : rec).push(x);
  const out = [];
  let p = 0;
  let i = 0;
  let j = 0;
  while (out.length < list.length) {
    const wantProd = share > 0 && Math.floor((out.length + 1) * share + 1e-9) > p;
    const takeProd = j >= rec.length || (wantProd && i < prod.length);
    if (takeProd) { out.push(prod[i]); i += 1; p += 1; } else { out.push(rec[j]); j += 1; }
  }
  return out;
}
