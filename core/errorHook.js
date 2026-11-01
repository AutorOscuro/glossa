// @purpose: Gancho de clasificación de errores: define el contrato del detector mecánico y de la IA y concilia sus veredictos con el catálogo.
// Hook de clasificación de errores (subparte 1.6, cuarto 2). Roadmap 1.6 y 5.5. SOLO LA INTERFAZ: la IA se conecta en 5.5 y el detector mecánico llega en el cuarto 3;
// los dos cumplirán este mismo contrato, así que quien registra errores no sabe ni le importa quién clasificó.
//
//   CLASIFICADOR (lo que se inyecta; cualquier objeto con este método)
//     classifier.classify(entries) → Promise<Array<veredicto | null>>
//       entries   lista de { original, correction, context, itemId } (copias; nunca el registro entero), de 1 a CLASSIFY_BATCH_MAX por llamada.
//       devuelve  una lista del MISMO tamaño y orden. null = «sin veredicto para esta». Si el tamaño no coincide o no es una lista, se descarta TODA la respuesta (no se puede alinear).
//       veredicto { code?, kind?, origin?, impact?, topics? } con los valores de 8.8 (code debe existir en el catálogo). Cualquier otro campo se descarta.
//
//   createErrorHook({ errors, catalog, classifier? }) → { hasClassifier, classifyAndRecord }   (objeto congelado)
//     errors      el objeto de core/errors.js (se usa solo `errors.record`). catalog  el de core/errorCatalog.js. classifier  opcional: sin él el modo es «sin IA».
//
//   classifyAndRecord(entries, { classify? }?) → Promise<{ classifier, results, recorded }>   NUNCA lanza por una entrada mala ni por un clasificador roto (solo por argumentos absurdos).
//     entries   lista (1–MAX_ENTRIES) de entradas de `errors.record` (original, code?, kind?, origin?, impact?, topics?, correction?, context?, source?, itemId?, ts?) —
//               EL CAMPO EXPLÍCITO GANA: lo que ya trae la entrada (p. ej. lo que dedujo el detector mecánico) nunca lo pisa el clasificador; este solo rellena huecos.
//     classify  'missing_code' (por defecto: solo se consulta por las entradas SIN `code`, que es lo único obligatorio y ahorra cupo de IA) | 'all' (se consulta por todas y el veredicto
//               rellena kind/origin/impact/topics que falten). Sin clasificador no se consulta a nadie.
//     Las consultas van en lotes de CLASSIFY_BATCH_MAX. Un lote que falla (lanza, rechaza, devuelve basura) deja a sus entradas sin veredicto: se registran las que traen código y el resto queda `unclassified`.
//     classifier  → { used, ok, sent, error }: `used` = hubo al menos una consulta; `ok` = ninguna falló; `sent` = entradas consultadas; `error` = primer fallo (texto corto) o null.
//     results[i]  → { index, status, result, discarded, error } en el mismo orden que las entradas.
//       status 'recorded'      anotada (result = lo que devuelve errors.record: { record, created, counted, replay }).
//       status 'unclassified'  no hay código ni explícito ni válido del clasificador: no se anota (sin código no se sabe qué error es).
//       status 'rejected'      la entrada no es válida para errors.record (result null, error = el motivo).
//       status 'failed'        la base falló al anotar (result null, error = el motivo).
//       discarded              campos del veredicto que no valían y se tiraron: [{ field, reason, value }] (value = texto recortado, nunca el objeto). Así 5.5 puede registrar los descartes (CA 1).
//     recorded    cuántas quedaron en 'recorded'.
import { ORIGINS, IMPACTS, ERROR_KINDS, LIMITS, ErrorRecordError } from './errors.js';
import { TOPIC_ID_RE } from './contentTopic.js';

export const CLASSIFY_BATCH_MAX = 20; // tope de seguridad provisional por llamada; 5.5 fija el definitivo según el cupo de la IA
export const MAX_ENTRIES = 100;
const VERDICT_KEYS = Object.freeze(['code', 'kind', 'origin', 'impact', 'topics']);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const shown = (v) => (typeof v === 'string' ? v.slice(0, 60) : Array.isArray(v) ? 'lista' : v === null ? 'null' : typeof v);
// Lo único que ve el clasificador: cuatro textos (o null). Un getter hostil o un valor que no es texto no tumba el lote.
const textOrNull = (v) => (typeof v === 'string' ? v : null);
function payloadOf(e) { // solo recibe objetos: las demás entradas ni se consultan
  const out = { original: null, correction: null, context: null, itemId: null };
  for (const k of Object.keys(out)) { try { out[k] = textOrNull(e[k]); } catch { out[k] = null; } }
  return out;
}
const short = (e) => String(e instanceof Error ? e.message : e).slice(0, 200);

// Limpia un veredicto: devuelve solo los campos válidos y lista lo descartado. Función pura; un veredicto hostil (getter que lanza) se descarta entero.
export function cleanVerdict(verdict, catalog) {
  const discarded = [];
  const clean = {};
  if (verdict === undefined || verdict === null) return { clean, discarded };
  if (!isPlain(verdict)) return { clean, discarded: [{ field: 'verdict', reason: 'no es un objeto', value: shown(verdict) }] };
  let read;
  try {
    read = {};
    for (const k of Object.keys(verdict)) read[k] = verdict[k];
  } catch (e) {
    return { clean, discarded: [{ field: 'verdict', reason: `no se pudo leer (${short(e)})`, value: 'objeto' }] };
  }
  for (const k of Object.keys(read)) if (!VERDICT_KEYS.includes(k)) discarded.push({ field: k, reason: 'campo desconocido', value: shown(read[k]) });

  const pickEnum = (field, allowed) => {
    const v = read[field];
    if (v === undefined || v === null) return;
    if (allowed.includes(v)) clean[field] = v;
    else discarded.push({ field, reason: `debe ser uno de: ${allowed.join(', ')}`, value: shown(v) });
  };
  if (read.code !== undefined && read.code !== null) {
    if (typeof read.code === 'string' && catalog.has(read.code)) clean.code = read.code;
    else discarded.push({ field: 'code', reason: 'no está en el catálogo', value: shown(read.code) });
  }
  pickEnum('kind', ERROR_KINDS);
  pickEnum('origin', ORIGINS);
  pickEnum('impact', IMPACTS);

  if (read.topics !== undefined && read.topics !== null) {
    if (!Array.isArray(read.topics)) discarded.push({ field: 'topics', reason: 'debe ser una lista', value: shown(read.topics) });
    else {
      const ok = [];
      for (const t of read.topics) {
        if (typeof t !== 'string' || t.length > LIMITS.topicLength || !TOPIC_ID_RE.test(t)) discarded.push({ field: 'topics', reason: 'no es un id de tema', value: shown(t) });
        else if (ok.includes(t)) continue;
        else if (ok.length >= LIMITS.topics) discarded.push({ field: 'topics', reason: `más de ${LIMITS.topics} temas`, value: shown(t) });
        else ok.push(t);
      }
      if (ok.length > 0) clean.topics = ok;
    }
  }
  return { clean, discarded };
}

const isEmpty = (field, v) => v === undefined || v === null || (field === 'code' && v === '') || (field === 'topics' && Array.isArray(v) && v.length === 0);

// El campo explícito de la entrada gana; el veredicto solo rellena huecos.
export function reconcile(entry, clean) {
  const merged = { ...entry };
  for (const f of VERDICT_KEYS) if (isEmpty(f, merged[f]) && clean[f] !== undefined) merged[f] = clean[f];
  return merged;
}

export function createErrorHook({ errors, catalog, classifier = null } = {}) {
  if (!errors || typeof errors.record !== 'function') throw new Error('createErrorHook: falta el registro de errores (core/errors.js)');
  if (!catalog || typeof catalog.has !== 'function') throw new Error('createErrorHook: falta el catálogo de errores (core/errorCatalog.js)');
  if (classifier !== null && (typeof classifier !== 'object' || typeof classifier.classify !== 'function')) throw new Error('createErrorHook: el clasificador debe tener un método classify(entries)');

  const bad = (message) => new ErrorRecordError([{ path: '', message }]);

  // Consulta por lotes. Devuelve verdicts[i] (o null) alineados con `list`, y el resumen del clasificador.
  async function consult(list) {
    const verdicts = new Array(list.length).fill(null);
    const info = { used: false, ok: true, sent: 0, error: null };
    if (classifier === null || list.length === 0) return { verdicts, info };
    for (let from = 0; from < list.length; from += CLASSIFY_BATCH_MAX) {
      const chunk = list.slice(from, from + CLASSIFY_BATCH_MAX);
      info.used = true;
      info.sent += chunk.length;
      try {
        const payload = chunk.map(payloadOf);
        const answer = await classifier.classify(payload);
        if (!Array.isArray(answer) || answer.length !== chunk.length) throw new Error(`el clasificador debía devolver ${chunk.length} veredictos y devolvió ${Array.isArray(answer) ? answer.length : 'algo que no es una lista'}`);
        for (let i = 0; i < chunk.length; i += 1) verdicts[from + i] = answer[i];
      } catch (e) {
        info.ok = false;
        if (info.error === null) info.error = short(e);
      }
    }
    return { verdicts, info };
  }

  async function classifyAndRecord(entries, opts) {
    if (!Array.isArray(entries) || entries.length === 0) throw bad('entries debe ser una lista con al menos una entrada');
    if (entries.length > MAX_ENTRIES) throw bad(`entries no puede tener más de ${MAX_ENTRIES} entradas`);
    const o = opts === undefined || opts === null ? {} : opts;
    if (!isPlain(o)) throw bad('las opciones deben ser un objeto');
    for (const k of Object.keys(o)) if (k !== 'classify') throw bad(`opción desconocida "${k}"`);
    const mode = o.classify ?? 'missing_code';
    if (mode !== 'missing_code' && mode !== 'all') throw bad('"classify" debe ser "missing_code" o "all"');

    const wants = [];
    entries.forEach((e, i) => {
      if (!isPlain(e)) return;
      let missingCode;
      try { missingCode = isEmpty('code', e.code); } catch { return; } // un getter hostil: la entrada se rechazará más abajo
      if (mode === 'all' || missingCode) wants.push(i);
    });
    const { verdicts, info } = await consult(wants.map((i) => entries[i]));
    const verdictOf = new Map(wants.map((i, k) => [i, verdicts[k]]));

    const results = [];
    let recorded = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const { clean, discarded } = cleanVerdict(verdictOf.get(i) ?? null, catalog);
      const item = { index: i, status: 'rejected', result: null, discarded, error: null };
      results.push(item);
      if (!isPlain(entry)) { item.error = 'la entrada debe ser un objeto'; continue; }
      let merged;
      try { merged = reconcile(entry, clean); } catch (e) { item.error = `la entrada no se pudo leer (${short(e)})`; continue; }
      if (isEmpty('code', merged.code)) { item.status = 'unclassified'; item.error = 'sin código: ni la entrada ni el clasificador dieron uno válido'; continue; }
      try {
        item.result = await errors.record(merged);
        item.status = 'recorded';
        recorded += 1;
      } catch (e) {
        item.status = e instanceof ErrorRecordError ? 'rejected' : 'failed';
        item.error = short(e);
      }
    }
    return { classifier: info, results, recorded };
  }

  return Object.freeze({ hasClassifier: classifier !== null, classifyAndRecord });
}
