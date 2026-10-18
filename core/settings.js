// Ajustes de la persona (subparte 0.8, cuarto 1): valores por defecto, validación y persistencia. Sin DOM; se prueba con Node.
//
//   createSettings({ db?, onError? }) → {
//     load()                    → Promesa del resumen (ver snapshot). Lee `settings`; lo inválido o ausente toma el valor por defecto.
//     get(key)                  → valor actual (síncrono). Antes de load() devuelve el valor por defecto.
//     set(key, value)           → Promesa<true|false>: valida, guarda y avisa. false = ya valía eso (no se tocó nada).
//     setMany({ k: v, … })      → Promesa<claves cambiadas>: atómico: todo o nada (si una no vale o falla el guardado, no cambia ninguna).
//     reset(key) / resetAll()   → vuelve a los valores por defecto (resetAll NO toca las claves secretas).
//     clearSecrets()            → borra las claves secretas guardadas (IA, Azure).
//     onChange(key, fn)         → fn(valor, valorPrevio) en vivo; devuelve la baja. onAnyChange(fn) → fn(clavesCambiadas, resumen).
//     snapshot()                → { clave: valor } con los secretos OCULTOS ('••••••' si hay algo, '' si no). Es lo único seguro para mostrar/registrar.
//     hasSecret(key), describe(key), keys()
//   }
//   · Un registro de `settings` es { key, value } y, si es secreto, { key, value, secret: true } (así el respaldo lo excluye, 0.7).
//   · Un valor secreto vacío NO se guarda: se borra el registro. Los mensajes de error NUNCA incluyen el valor de un secreto.
//   · Sin `db` (la base no abrió) los ajustes funcionan solo en memoria: persistent() → false.
import { createStore } from './store.js';

export const SECRET_MASK = '••••••';

const THEME_CHOICES = ['auto', 'aurora', 'neo', 'claro'];
const SIZE_CHOICES = ['small', 'normal', 'large', 'xlarge'];

// type: enum | bool | int | number | text. `label` es el nombre en español para los mensajes.
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
export const DEFS = deepFreeze({
  theme: { type: 'enum', choices: THEME_CHOICES, default: 'auto', label: 'Tema' },
  textSize: { type: 'enum', choices: SIZE_CHOICES, default: 'normal', label: 'Tamaño de texto' },
  retention: { type: 'number', min: 0.8, max: 0.95, decimals: 2, default: 0.9, label: 'Retención objetivo' },
  dailyReviewCap: { type: 'int', min: 10, max: 500, default: 100, label: 'Tope diario de repasos' },
  dailyNewCap: { type: 'int', min: 0, max: 50, default: 10, label: 'Tope diario de tarjetas nuevas' },
  leechThreshold: { type: 'int', min: 3, max: 20, default: 8, label: 'Umbral de sanguijuela' },
  spellingTolerance: { type: 'bool', default: true, label: 'Tolerancia ortográfica' },
  sounds: { type: 'bool', default: true, label: 'Sonidos' },
  vibration: { type: 'bool', default: true, label: 'Vibración' },
  aiMode: { type: 'enum', choices: ['auto', 'mechanical'], default: 'auto', label: 'Modo de IA' },
  aiProvider: { type: 'enum', choices: ['groq'], default: 'groq', label: 'Proveedor de IA' },
  aiModel: { type: 'text', max: 100, default: '', label: 'Modelo de IA' }, // vacío = el que fije 1.10/5.1 tras verificar la documentación vigente
  aiKey: { type: 'text', max: 400, default: '', secret: true, label: 'Clave de IA' },
  azureRegion: { type: 'text', max: 40, default: '', label: 'Región de Azure' }, // se activa en la Fase 8
  azureKey: { type: 'text', max: 400, default: '', secret: true, label: 'Clave de Azure' }, // se activa en la Fase 8
  userName: { type: 'text', max: 40, default: '', label: 'Tu nombre' },
  onboardingDone: { type: 'bool', default: false, label: 'Bienvenida vista' },
});

export class SettingsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SettingsError';
    this.code = code; // 'UNKNOWN_SETTING' | 'BAD_SETTING'
    this.friendly = code === 'UNKNOWN_SETTING' ? 'Hubo un problema interno con los ajustes (ajuste desconocido).' : message;
  }
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const defOf = (key) => {
  if (typeof key !== 'string' || !has(DEFS, key)) throw new SettingsError('UNKNOWN_SETTING', `Ajuste desconocido: ${String(key).slice(0, 40)}`);
  return DEFS[key];
};

// Valida y normaliza un valor. Devuelve { ok:true, value } o { ok:false, message } (el mensaje no incluye valores secretos).
export function validateSetting(key, value) {
  const d = defOf(key);
  const bad = (m) => ({ ok: false, message: `${d.label}: ${m}` });
  switch (d.type) {
    case 'bool':
      return typeof value === 'boolean' ? { ok: true, value } : bad('debe ser sí o no.');
    case 'enum':
      return typeof value === 'string' && d.choices.includes(value) ? { ok: true, value } : bad(`elige una de estas opciones: ${d.choices.join(', ')}.`);
    case 'int':
      if (!Number.isInteger(value)) return bad('debe ser un número entero.');
      return value >= d.min && value <= d.max ? { ok: true, value } : bad(`debe estar entre ${d.min} y ${d.max}.`);
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return bad('debe ser un número.');
      const f = 10 ** d.decimals;
      const v = Math.round(value * f) / f;
      return v >= d.min && v <= d.max ? { ok: true, value: v } : bad(`debe estar entre ${d.min} y ${d.max}.`);
    }
    case 'text': {
      if (typeof value !== 'string') return bad('debe ser texto.');
      const v = value.trim();
      return v.length <= d.max ? { ok: true, value: v } : bad(`es demasiado largo (máximo ${d.max} caracteres).`);
    }
    default:
      return bad('tipo no soportado.');
  }
}

const defaults = () => Object.fromEntries(Object.entries(DEFS).map(([k, d]) => [k, d.default]));
const toRecord = (key, value) => (DEFS[key].secret ? { key, value, secret: true } : { key, value });

export function createSettings({ db = null, onError } = {}) {
  const report = onError ?? ((e) => console.error('ajustes: un suscriptor falló:', e && e.message));
  const store = createStore(defaults(), { onError: report });
  const secretKeys = Object.keys(DEFS).filter((k) => DEFS[k].secret);
  const cur = (k) => store.get()[k];
  const mask = (k, v) => (DEFS[k].secret ? (v === '' ? '' : SECRET_MASK) : v);
  const snapshot = () => Object.fromEntries(Object.keys(DEFS).map((k) => [k, mask(k, cur(k))]));
  const changedKeys = (prev, next) => Object.keys(DEFS).filter((k) => !Object.is(prev[k], next[k]));

  // Escribe en disco (si hay base) un conjunto { clave: valor } ya validado, en una sola transacción.
  async function persist(entries) {
    if (!db) return;
    await db.tx(['settings'], async (t) => {
      for (const [k, v] of entries) {
        if (DEFS[k].secret && v === '') await t.delete('settings', k);
        else await t.put('settings', toRecord(k, v));
      }
    });
  }

  async function apply(patch) {
    const entries = Object.entries(patch);
    const real = entries.filter(([k, v]) => !Object.is(cur(k), v));
    if (real.length === 0) return [];
    await persist(real);
    store.set(Object.fromEntries(real));
    return real.map(([k]) => k);
  }

  function validateAll(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new SettingsError('BAD_SETTING', 'Los cambios deben venir como un objeto { ajuste: valor }.');
    const patch = {};
    const problems = [];
    for (const [k, v] of Object.entries(input)) {
      defOf(k);
      const r = validateSetting(k, v);
      if (r.ok) patch[k] = r.value; else problems.push(r.message);
    }
    if (problems.length) throw new SettingsError('BAD_SETTING', problems.join(' '));
    return patch;
  }

  const api = {
    async load() {
      const next = defaults();
      if (db) {
        for (const rec of await db.query('settings')) {
          if (!rec || !has(DEFS, rec.key)) continue; // ajustes que esta versión no conoce: se dejan en disco, se ignoran
          const r = validateSetting(rec.key, rec.value);
          if (r.ok) next[rec.key] = r.value;
        }
      }
      store.set(next);
      return snapshot();
    },
    get: (key) => { defOf(key); return cur(key); },
    async set(key, value) {
      const patch = validateAll({ [key]: value });
      return (await apply(patch)).length > 0;
    },
    async setMany(input) { return apply(validateAll(input)); },
    async reset(key) { defOf(key); return (await apply({ [key]: DEFS[key].default })).length > 0; },
    async resetAll() {
      const patch = {};
      for (const [k, d] of Object.entries(DEFS)) if (!d.secret) patch[k] = d.default;
      return apply(patch);
    },
    async clearSecrets() {
      const patch = {};
      for (const k of secretKeys) patch[k] = '';
      // Aunque el valor en memoria ya sea '', se borra el registro del disco por si quedara uno.
      if (db) await db.tx(['settings'], async (t) => { for (const k of secretKeys) await t.delete('settings', k); });
      return apply(patch);
    },
    onChange(key, fn) {
      defOf(key);
      if (typeof fn !== 'function') throw new TypeError('onChange necesita una función');
      return store.subscribe((v, pv) => fn(v, pv), { select: (s) => s[key] });
    },
    onAnyChange(fn) {
      if (typeof fn !== 'function') throw new TypeError('onAnyChange necesita una función');
      return store.subscribe((state, prev) => fn(changedKeys(prev, state), snapshot()));
    },
    snapshot,
    hasSecret: (key) => {
      const d = defOf(key);
      if (!d.secret) throw new SettingsError('BAD_SETTING', `${d.label} no es un secreto.`);
      return cur(key) !== '';
    },
    describe: (key) => { const d = defOf(key); const { default: dflt, ...rest } = d; return { key, ...rest, default: d.secret ? '' : dflt }; },
    keys: () => Object.keys(DEFS),
    persistent: () => db !== null,
  };
  return api;
}
