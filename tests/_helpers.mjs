// Ayudantes compartidos por TODAS las pruebas (subparte 0.2). No es una prueba: el nombre empieza con "_"
// y no termina en ".test.mjs", así que `node --test` no lo ejecuta.
//
// Contenido:
//   makeClock(startIso)      reloj falso controlable: now() → Date, nowMs(), iso(), advance(ms), advanceDays(n), set(iso)
//   makeRng(seed)            azar determinista (mulberry32): next() ∈ [0,1), int(min,max) inclusivo, pick(arr), shuffle(arr)
//   makeItem/makeCard/makeEvent(overrides)   fábricas de datos con la forma de los contratos 8.3 / 8.4 / 8.6
//   resetFactories()         reinicia los contadores de IDs de las fábricas
//   makeMemoryDb()           base de datos MÍNIMA en memoria para pruebas tempranas (almacenes de 8.13).
//                            El adaptador real con el contrato completo es core/db.memory.js (subparte 0.7).
//   makeTempRepo(files)      carpeta temporal con archivos {rutaRelativa: texto}; devuelve { root, cleanup() }
//
// Convención: el tipo exacto del parámetro `now` de las funciones de core/ lo fija core/clock.js (0.7);
// el reloj falso ofrece Date (now) y milisegundos (nowMs) para no condicionar esa decisión.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---------- Reloj falso ----------
export function makeClock(startIso = '2026-10-15T14:00:00.000Z') {
  let t = Date.parse(startIso);
  if (Number.isNaN(t)) throw new Error(`makeClock: fecha inválida: ${String(startIso)}`);
  const num = (v, name) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`makeClock: ${name} debe ser un número finito`);
    return v;
  };
  return {
    now: () => new Date(t),
    nowMs: () => t,
    iso: () => new Date(t).toISOString(),
    advance(ms) { t += num(ms, 'ms'); return this; },
    advanceDays(n) { t += num(n, 'días') * 86400000; return this; },
    set(iso) {
      const p = Date.parse(iso);
      if (Number.isNaN(p)) throw new Error(`makeClock.set: fecha inválida: ${String(iso)}`);
      t = p;
      return this;
    },
  };
}

// ---------- Azar con semilla ----------
export function makeRng(seed = 1) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new Error('makeRng: la semilla debe ser un número finito');
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error('makeRng.int: rango inválido');
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('makeRng.pick: se necesita un arreglo no vacío');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      if (!Array.isArray(arr)) throw new Error('makeRng.shuffle: se necesita un arreglo');
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// ---------- Fábricas de datos (formas de 8.3, 8.4 y 8.6) ----------
let seq = 0;
const pad = (n) => String(n).padStart(4, '0');
export function resetFactories() { seq = 0; }

export function makeItem(overrides = {}) {
  seq += 1;
  return {
    id: `t.test.${pad(seq)}`,
    type: 'fix_error',
    topics: ['gram.present_perfect.for_since'],
    level: 'A2',
    facet: null,
    prompt_es: 'Corrige el error en la oración.',
    prompt_en: "I'm living here since two years.",
    data: {},
    accept: ["I've lived here for two years.", 'I have lived here for two years.'],
    distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }],
    explain_es: 'Con for + duración usamos present perfect.',
    grammar_note_es: null,
    nuance_es: null,
    situation: 'Presentarse con un vecino',
    error_codes: ['TNS.SINCE_FOR'],
    audio: null,
    image: null,
    needs_ai: false,
    source: 'original',
    version: 1,
    ...structuredClone(overrides),
  };
}

export function makeCard(overrides = {}) {
  seq += 1;
  const itemId = overrides.itemId ?? `t.test.${pad(seq)}`;
  const facet = overrides.facet ?? 0;
  return {
    id: `${itemId}#${facet}`,
    itemId,
    facet,
    topics: ['gram.present_perfect.for_since'],
    state: 0,
    due: '2026-10-16T00:00:00.000Z',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    suspended: false,
    leech: false,
    fav: false,
    created: '2026-10-15T14:00:00.000Z',
    ...structuredClone(overrides),
  };
}

export function makeEvent(overrides = {}) {
  seq += 1;
  return {
    id: `evt_20261015T1400_${pad(seq)}`,
    ts: '2026-10-15T14:00:00.000Z',
    day: '2026-10-15',
    type: 'answer',
    sessionId: 'ses_test',
    cardId: 't.test.0001#0',
    itemId: 't.test.0001',
    topics: ['gram.present_perfect.for_since'],
    exerciseType: 'fix_error',
    result: 'correct',
    rating: 3,
    ms: 5000,
    hint: false,
    dontKnow: false,
    responseRaw: "I've lived here for two years.",
    errorCodes: [],
    mode: 'mech',
    channel: 'keyboard',
    ...structuredClone(overrides),
  };
}

// ---------- Base de datos mínima en memoria ----------
const KEY_PATHS = {
  meta: 'key', settings: 'key', cards: 'id', events: 'id', errors: 'id', words: 'id', generated: 'id',
  sessions: 'id', plans: 'day', notes: 'id', content_cache: 'pack_id', audio_index: 'id',
};

export function makeMemoryDb() {
  const stores = new Map(Object.keys(KEY_PATHS).map((s) => [s, new Map()]));
  const store = (name) => {
    const s = stores.get(name);
    if (!s) throw new Error(`Almacén desconocido: ${String(name)}`);
    return s;
  };
  return {
    put(name, obj) {
      const s = store(name);
      const key = obj?.[KEY_PATHS[name]];
      if (typeof key !== 'string' || key === '') throw new Error(`put(${name}): falta la clave '${KEY_PATHS[name]}'`);
      s.set(key, structuredClone(obj));
      return key;
    },
    get(name, key) {
      const v = store(name).get(key);
      return v === undefined ? null : structuredClone(v);
    },
    delete(name, key) { return store(name).delete(key); },
    getAll(name) { return [...store(name).values()].map((v) => structuredClone(v)); },
    // index: nombre de campo; si el valor del campo es un arreglo, basta con que contenga `value`.
    query(name, { index, value, limit } = {}) {
      let rows = [...store(name).values()];
      if (index !== undefined) {
        rows = rows.filter((r) => (Array.isArray(r[index]) ? r[index].includes(value) : r[index] === value));
      }
      if (limit !== undefined) rows = rows.slice(0, limit);
      return rows.map((r) => structuredClone(r));
    },
    count(name) { return store(name).size; },
    clear() { for (const s of stores.values()) s.clear(); },
    exportAll() { return Object.fromEntries([...stores].map(([n, s]) => [n, [...s.values()].map((v) => structuredClone(v))])); },
  };
}

// ---------- Carpeta temporal ----------
export function makeTempRepo(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sing-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return { root, cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}
