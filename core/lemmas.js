// @purpose: Tabla de lemas de la lista blanca (1.11-T2): valida y carga lemmas.json, y devuelve los lemas posibles de una forma o de un token.
// Tabla de lemas (subparte 1.11, tramo T2). Contrato: docs/CONTRACTS.md, entrada 1.11-T2.
//
//   createLemmaTable(json) → LemmaTable          valida el formato (schema 1) y construye los índices. Lanza Error en español si el archivo no sirve.
//   loadLemmas(fetchFn, opts?) → Promise<{ ok:true, table } | { ok:false, error:{ code, message } }>   NUNCA lanza. opts: { path, timeoutMs, maxBytes }
//   LEMMAS_PATH = 'content/taxonomy/lemmas.json'
//
//   table.size                       cantidad de lemas
//   table.lemmasOf(form)             lemas posibles de una forma, ordenados (['leave','left'] para `left`); [] si la forma no está en la lista
//   table.has(lemma)                 true si es un lema de la tabla
//   table.info(lemma)                { lemma, pos, band } o null
//   table.entries()                 lista de { lemma, pos, band, forms } en el orden del archivo (para el Diccionario básico, 2.9-T4; copia, no toca la tabla)
//   table.analyze(token)             → { parts: [{ part, lemmas }], listed }  para un token de `tokenize`; `listed` es true solo si el token es
//                                    una palabra (kind 'word') y TODAS sus partes están en la tabla. Números, siglas y códigos: parts [] y listed false.
//
// Reglas: una forma puede tener varios lemas (`left`: `leave` y `left`); quien consulte la considera conocida si CUALQUIERA lo es (nota C10).
// Todo se compara en minúscula. El lema cuenta como forma de sí mismo. No hay lematizador por sufijos: lo que la tabla no lista no se adivina.
// Las contracciones y guiones ya llegan separados por `tokenize` (parts); aquí solo se busca cada parte.

export const LEMMAS_PATH = 'content/taxonomy/lemmas.json';
export const LEMMAS_SCHEMA = 1;
export const LEMMAS_LIMITS = Object.freeze({ maxLemmas: 20000, maxForms: 40, maxBytes: 5 * 1024 * 1024, timeoutMs: 15000 });

const WORD_RE = /^[a-z]+(?:'[a-z]+)?$/;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function bad(msg) { throw new Error(`lemmas.json: ${msg}`); }

export function createLemmaTable(json) {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) bad('el archivo no es un objeto');
  if (json.schema !== LEMMAS_SCHEMA) bad(`schema debe ser ${LEMMAS_SCHEMA}`);
  if (!Array.isArray(json.lemmas) || json.lemmas.length === 0) bad('lemmas debe ser una lista con al menos un lema');
  if (json.lemmas.length > LEMMAS_LIMITS.maxLemmas) bad(`hay más de ${LEMMAS_LIMITS.maxLemmas} lemas`);
  const bands = Array.isArray(json.bands) ? json.bands : null;

  const infos = new Map(); // lema → { lemma, pos, band }
  const listed = []; // { lemma, pos, band, forms } en el orden del archivo
  const byForm = new Map(); // forma → Set de lemas
  const add = (form, lemma) => {
    let set = byForm.get(form);
    if (!set) { set = new Set(); byForm.set(form, set); }
    set.add(lemma);
  };
  json.lemmas.forEach((e, i) => {
    const at = `lemmas[${i}]`;
    if (e === null || typeof e !== 'object' || Array.isArray(e)) bad(`${at} no es un objeto`);
    if (typeof e.lemma !== 'string' || !WORD_RE.test(e.lemma)) bad(`${at}.lemma no es una palabra en minúscula`);
    if (infos.has(e.lemma)) bad(`${at}.lemma «${e.lemma}» está repetido`);
    if (!Array.isArray(e.pos) || e.pos.length === 0 || e.pos.some((p) => typeof p !== 'string' || p === '')) bad(`${at}.pos no es válido`);
    if (typeof e.band !== 'string' || (bands && !bands.includes(e.band))) bad(`${at}.band no es válida`);
    const forms = e.forms === undefined ? [] : e.forms;
    if (!Array.isArray(forms) || forms.length > LEMMAS_LIMITS.maxForms) bad(`${at}.forms no es válido`);
    infos.set(e.lemma, Object.freeze({ lemma: e.lemma, pos: Object.freeze([...e.pos]), band: e.band }));
    listed.push({ lemma: e.lemma, pos: [...e.pos], band: e.band, forms: [...forms] });
    add(e.lemma, e.lemma);
    for (const f of forms) {
      if (typeof f !== 'string' || !WORD_RE.test(f)) bad(`${at}.forms tiene una forma no válida`);
      add(f, e.lemma);
    }
  });

  const index = new Map();
  for (const [form, set] of byForm) index.set(form, Object.freeze([...set].sort()));

  const lemmasOf = (form) => {
    if (typeof form !== 'string') return [];
    const hit = index.get(form.toLowerCase());
    return hit ? [...hit] : [];
  };
  const analyze = (token) => {
    const raw = token && token.kind === 'word' && Array.isArray(token.parts) ? token.parts : [];
    const parts = raw.map((part) => ({ part, lemmas: lemmasOf(part) }));
    return { parts, listed: parts.length > 0 && parts.every((p) => p.lemmas.length > 0) };
  };
  return Object.freeze({
    size: infos.size,
    lemmasOf,
    has: (lemma) => typeof lemma === 'string' && infos.has(lemma),
    entries: () => listed.map((x) => ({ lemma: x.lemma, pos: [...x.pos], band: x.band, forms: [...x.forms] })),
    info: (lemma) => (typeof lemma === 'string' && infos.has(lemma) ? infos.get(lemma) : null),
    analyze,
  });
}

const fail = (code, message) => ({ ok: false, error: { code, message } });

// Descarga y valida. `fetchFn` se inyecta (el núcleo no toca la red); nunca lanza.
export async function loadLemmas(fetchFn, opts = {}) {
  if (typeof fetchFn !== 'function') return fail('NO_FETCH', 'No hay forma de descargar la lista de palabras.');
  const path = typeof opts.path === 'string' && opts.path !== '' ? opts.path : LEMMAS_PATH;
  const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : LEMMAS_LIMITS.timeoutMs;
  const maxBytes = Number.isFinite(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : LEMMAS_LIMITS.maxBytes;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  try {
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { if (ctl) ctl.abort(); rej(new Error('timeout')); }, timeoutMs); });
    const run = (async () => {
      const res = await fetchFn(path, ctl ? { signal: ctl.signal } : undefined);
      if (!res || res.ok !== true) return fail(res && res.status === 404 ? 'NOT_FOUND' : 'HTTP', 'No se pudo descargar la lista de palabras.');
      const text = await res.text();
      if (typeof text !== 'string') return fail('BAD_JSON', 'La lista de palabras no es un JSON válido.');
      if (text.length > maxBytes) return fail('TOO_BIG', 'La lista de palabras es demasiado grande.');
      let json;
      try { json = JSON.parse(text); } catch { return fail('BAD_JSON', 'La lista de palabras no es un JSON válido.'); }
      try { return { ok: true, table: createLemmaTable(json) }; } catch (e) { return fail('BAD_LEMMAS', e.message); }
    })();
    return await Promise.race([run, timeout]);
  } catch (e) {
    return e && e.message === 'timeout' ? fail('TIMEOUT', 'La lista de palabras tardó demasiado en llegar.') : fail('NETWORK', 'No se pudo descargar la lista de palabras.');
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
