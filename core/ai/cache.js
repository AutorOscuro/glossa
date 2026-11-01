// @purpose: Caché de respuestas de IA en el almacén generated: clave = hash de tarea y entrada, con caducidad y tope de entradas; nunca rompe una llamada.
// Caché del cliente de IA (1.10-T3). Roadmap 1.10: «clave = hash de tarea+entrada; guarda en `generated`».
//   createCache({ db, clock?, hashFn?, maxEntries?, ttlMs? }) → { key(req, model), get(key), set(key, value), clear(), size(), stats() }
//   Registro: { id: 'aic_<hash>', kind: 'ai_cache', task, model, createdAt (ISO), value: { text, json?, usage? } }. El prefijo `aic_` lo separa
//   del contenido generado que guardará 5.2 en el mismo almacén: la caché solo toca lo suyo.
//   key(req, model): hash de {task, messages, json, schema, maxTokens, temperature, model}. Otro modelo o esquema = otra clave.
//   get/set/clear nunca lanzan: un fallo de la base cuenta en stats().errors y se trata como «no hay caché».
import { toIso, systemClock } from '../clock.js';

export const CACHE_PREFIX = 'aic_';
export const CACHE_KIND = 'ai_cache';
export const CACHE_DEFAULTS = Object.freeze({ maxEntries: 500, ttlMs: 30 * 24 * 3600 * 1000 });
const STORE = 'generated';

// JSON con las claves ordenadas: el mismo contenido da siempre el mismo texto.
export function stableStringify(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, walk(v[k])]));
    return v;
  };
  return JSON.stringify(walk(value));
}

// SHA-256 en hexadecimal con la API estándar de cifrado (Node y navegadores). Si no existe, lanza: la caché queda apagada, la llamada sigue.
export async function hashText(text) {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('No hay SHA-256 disponible.');
  const buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

export function createCache({ db, clock = systemClock, hashFn = hashText, maxEntries = CACHE_DEFAULTS.maxEntries, ttlMs = CACHE_DEFAULTS.ttlMs } = {}) {
  if (!db || typeof db.get !== 'function' || typeof db.put !== 'function' || typeof db.query !== 'function' || typeof db.delete !== 'function') throw new Error('createCache necesita la base de datos (get, put, query, delete).');
  if (typeof hashFn !== 'function') throw new Error('createCache: hashFn debe ser una función.');
  if (!isInt(maxEntries, 1, 100000)) throw new Error('createCache: maxEntries debe ser un entero de 1 a 100000.');
  if (!isInt(ttlMs, 1000, 3650 * 24 * 3600 * 1000)) throw new Error('createCache: ttlMs debe ser un entero de 1 s a 10 años.');
  const st = { hits: 0, misses: 0, writes: 0, evicted: 0, errors: 0 };

  async function key(req, model) {
    try {
      const input = { task: req.task, messages: req.messages, json: req.json === true, schema: req.schema ?? null, maxTokens: req.maxTokens, temperature: req.temperature, model: String(model) };
      return CACHE_PREFIX + (await hashFn(stableStringify(input)));
    } catch { st.errors += 1; return null; }
  }

  const valid = (rec) => rec && rec.kind === CACHE_KIND && rec.value && typeof rec.value.text === 'string' && typeof rec.createdAt === 'string';
  const expired = (rec) => !(Date.parse(rec.createdAt) + ttlMs > clock.nowMs());

  async function get(k) {
    if (typeof k !== 'string' || !k.startsWith(CACHE_PREFIX)) return null;
    try {
      const rec = await db.get(STORE, k);
      if (!rec) { st.misses += 1; return null; }
      if (!valid(rec) || expired(rec)) { st.misses += 1; await db.delete(STORE, k); return null; }
      st.hits += 1;
      return structuredClone(rec.value);
    } catch { st.errors += 1; return null; }
  }

  async function prune() {
    const all = (await db.query(STORE, {})).filter((r) => r && r.kind === CACHE_KIND && typeof r.id === 'string' && r.id.startsWith(CACHE_PREFIX));
    if (all.length <= maxEntries) return;
    all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    for (const r of all.slice(0, all.length - maxEntries)) { await db.delete(STORE, r.id); st.evicted += 1; }
  }

  async function set(k, value, meta = {}) {
    if (typeof k !== 'string' || !k.startsWith(CACHE_PREFIX) || !value || typeof value.text !== 'string') return false;
    try {
      const v = { text: value.text };
      if (value.json !== undefined) v.json = value.json;
      if (value.usage !== undefined) v.usage = value.usage;
      await db.put(STORE, { id: k, kind: CACHE_KIND, task: String(meta.task ?? ''), model: String(meta.model ?? ''), createdAt: toIso(clock.nowMs()), value: v });
      st.writes += 1;
      await prune();
      return true;
    } catch { st.errors += 1; return false; }
  }

  async function ours() {
    return (await db.query(STORE, {})).filter((r) => r && r.kind === CACHE_KIND && typeof r.id === 'string' && r.id.startsWith(CACHE_PREFIX));
  }
  async function clear() {
    try { const all = await ours(); for (const r of all) await db.delete(STORE, r.id); return all.length; } catch { st.errors += 1; return 0; }
  }
  async function size() {
    try { return (await ours()).length; } catch { st.errors += 1; return 0; }
  }

  return Object.freeze({ key, get, set, clear, size, stats: () => ({ ...st }) });
}
