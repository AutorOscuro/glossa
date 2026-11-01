// @purpose: Fachada del cliente de IA: valida la petición, elige proveedor (none o groq), llama y valida el JSON devuelto. Sin claves en código.
// Cliente de IA (1.10-T1). Roadmap 8.15: ai.complete({task, messages, json?, schema?, maxTokens, temperature}) → {ok, text|json, error?, cached?}.
//   createAi({ getConfig, fetchFn, clock? }) → { complete(req), available(), providerId() }
//   getConfig() → { mode:'auto'|'mechanical', provider:'groq', model, endpoint?, key }  (se lee en cada llamada: un cambio de Ajustes vale al instante).
//   configFromSettings(settings, extra?) arma ese getConfig desde `core/settings.js` (la clave solo se lee aquí, nunca se copia ni se registra).
// Resultado: éxito { ok:true, text, json?, provider, model, usage:{promptTokens,completionTokens}, ms } · fallo { ok:false, reason, … }.
//   reason: no_ai · no_key · no_model · bad_endpoint · network · aborted · auth · rate_limit · server · bad_request · bad_response · empty · bad_json (lleva `text`) · schema (lleva `errors`).
// T2: toda llamada pasa por `queue.js` (concurrencia, tiempo límite 20 s, reintentos con espera ante 429/5xx/red/vacío); un JSON inválido se repara con UN solo reintento;
//   todo fallo lleva `error` (mensaje amable, `messages.js`) y todo resultado `attempts`. Opciones nuevas de createAi: concurrency, maxPending, maxRetries, emptyRetries, baseDelayMs, maxDelayMs, maxTotalMs, timeoutMs, rng, timers.
//   Petición: `timeoutMs` opcional (1000–300000). reason nuevos: timeout · queue_full.
// T3: caché en `generated` (cache.js), `availability()` y `available()` finos, evento `ai_call` (logEvent), texto escapado en `safe`, prompt base (`tutor`).
//   Opciones nuevas de createAi: cache (resultado de createCache; sin él no hay caché), logEvent(ev) → promesa (p. ej. events.log; sin él no se registra), rateLimitCooldownMs.
//   Petición: `cache: false` (ni lee ni escribe), `refresh: true` (no lee, pero escribe lo nuevo), `tutor: true | { level }` (antepone el prompt base).
//   Resultado: `cached: true` si salió de la caché (attempts 0); `safe: { text?, json? }` con el texto ya escapado (lo que la interfaz debe mostrar).
//   Registro `ai_call` (8.6 no tiene campo libre): exerciseType = tarea (`.` y `-` pasan a `_`, ≤ 40), mode 'ai', ms, responseRaw = «ok=1 cached=0 attempts=1 tokens=7 est=0 [reason=…]». Sin clave, sin prompt, sin texto.
//   Solo se registra si hubo llamada de red (no_ai, no_key, no_model, bad_endpoint y queue_full no cuentan) o respuesta de la caché; un fallo al registrar nunca cambia el resultado.
import { createNoneProvider } from './providers/none.js';
import { createGroqProvider, checkEndpoint, GROQ_DEFAULT_MODEL } from './providers/groq.js';
import { parseJson, validate } from './schema.js';
import { createQueue, checkTimeout } from './queue.js';
import { friendlyMessage } from './messages.js';
import { escapeHtml, escapeDeep } from './escape.js';
import { buildSystemPrompt } from './prompts/system.base.js';
import { systemClock } from '../clock.js';

export const REQUEST_LIMITS = Object.freeze({ maxMessages: 40, maxChars: 100000, maxTokens: 8000, defaultTokens: 800, defaultTemperature: 0.2, taskRe: /^[a-z][a-z0-9_.-]{0,59}$/ });
const ROLES = new Set(['system', 'user', 'assistant']);

export function configFromSettings(settings, extra = {}) {
  if (!settings || typeof settings.get !== 'function') throw new Error('configFromSettings necesita los ajustes.');
  return () => ({
    mode: settings.get('aiMode'),
    provider: settings.get('aiProvider'),
    model: settings.get('aiModel'),
    key: settings.get('aiKey'),
    endpoint: typeof extra.endpoint === 'function' ? extra.endpoint() : extra.endpoint,
  });
}

// Valida y completa la petición. Un uso incorrecto lanza Error en español (es un fallo del programa, no de la red).
export function normalizeRequest(req) {
  if (req === null || typeof req !== 'object') throw new Error('complete necesita un objeto de petición.');
  const L = REQUEST_LIMITS;
  if (typeof req.task !== 'string' || !L.taskRe.test(req.task)) throw new Error('complete: «task» debe ser un nombre corto en minúsculas (p. ej. «examples.generate»).');
  if (!Array.isArray(req.messages) || req.messages.length === 0 || req.messages.length > L.maxMessages) throw new Error(`complete: «messages» debe tener de 1 a ${L.maxMessages} mensajes.`);
  let chars = 0;
  const messages = req.messages.map((m, i) => {
    if (m === null || typeof m !== 'object' || !ROLES.has(m.role) || typeof m.content !== 'string' || m.content.trim() === '') throw new Error(`complete: el mensaje ${i + 1} no es válido (role y content no vacío).`);
    chars += m.content.length;
    return { role: m.role, content: m.content };
  });
  if (chars > L.maxChars) throw new Error(`complete: los mensajes pasan de ${L.maxChars} caracteres.`);
  const maxTokens = req.maxTokens === undefined ? L.defaultTokens : req.maxTokens;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > L.maxTokens) throw new Error(`complete: «maxTokens» debe ser un entero de 1 a ${L.maxTokens}.`);
  const temperature = req.temperature === undefined ? L.defaultTemperature : req.temperature;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('complete: «temperature» debe estar entre 0 y 2.');
  const schema = req.schema;
  if (schema !== undefined && (schema === null || typeof schema !== 'object' || Array.isArray(schema))) throw new Error('complete: «schema» debe ser un objeto.');
  const json = req.json === true || schema !== undefined;
  if (req.timeoutMs !== undefined && !checkTimeout(req.timeoutMs)) throw new Error('complete: «timeoutMs» debe ser un entero de 1000 a 300000.');
  for (const k of ['cache', 'refresh']) if (req[k] !== undefined && typeof req[k] !== 'boolean') throw new Error(`complete: «${k}» debe ser verdadero o falso.`);
  if (req.tutor !== undefined && req.tutor !== true && (req.tutor === null || typeof req.tutor !== 'object' || Array.isArray(req.tutor))) throw new Error('complete: «tutor» debe ser true o un objeto { level }.');
  let all = messages;
  if (req.tutor) {
    if (messages.length + 1 > L.maxMessages) throw new Error(`complete: con «tutor» sobra un mensaje; el máximo es ${L.maxMessages}.`);
    all = [{ role: 'system', content: buildSystemPrompt({ level: req.tutor === true ? undefined : req.tutor.level, json }) }, ...messages];
  }
  return { task: req.task, messages: all, maxTokens, temperature, json, schema, signal: req.signal, timeoutMs: req.timeoutMs, cache: req.cache !== false, refresh: req.refresh === true };
}

const REPAIR_TEXT_MAX = 6000;
const REPAIR_ASK = 'Tu respuesta anterior no era JSON válido. Corrígela: responde SOLO con el JSON válido, sin texto antes ni después y sin bloques de código.';
const QUEUE_KEYS = ['concurrency', 'maxPending', 'maxRetries', 'emptyRetries', 'baseDelayMs', 'maxDelayMs', 'maxTotalMs', 'timeoutMs', 'rng', 'timers'];
// Motivos que se detectan antes de tocar la red: no son una llamada y no se registran.
const NO_NETWORK = new Set(['no_ai', 'no_key', 'no_model', 'bad_endpoint', 'queue_full']);
const COOLDOWN_DEFAULT_MS = 60000;
const COOLDOWN_MAX_MS = 15 * 60000;

// Huella corta (no reversible en la práctica) para recordar «esta clave falló» sin guardar la clave.
function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16)}:${text.length}`;
}

const approxTokens = (chars) => Math.ceil(chars / 4);

// Valores del registro `ai_call`: sin clave, sin prompt, sin texto de la IA.
export function callRecord(task, out, messages, cached) {
  const u = out.usage || {};
  const exact = out.ok && Number.isFinite(u.promptTokens) && Number.isFinite(u.completionTokens);
  const chars = messages.reduce((n, m) => n + m.content.length, 0) + (out.ok && typeof out.text === 'string' ? out.text.length : 0);
  const tokens = exact ? u.promptTokens + u.completionTokens : approxTokens(chars);
  const parts = [`ok=${out.ok ? 1 : 0}`, `cached=${cached ? 1 : 0}`, `attempts=${out.attempts}`, `tokens=${tokens}`, `est=${exact ? 0 : 1}`];
  if (!out.ok) parts.push(`reason=${String(out.reason).replace(/[^a-z_]/g, '').slice(0, 30)}`);
  return { type: 'ai_call', mode: 'ai', exerciseType: task.replace(/[.-]/g, '_').slice(0, 40), ms: Math.min(out.ms, 86400000), responseRaw: parts.join(' ') };
}

export function createAi({ getConfig, fetchFn, clock = systemClock, cache = null, logEvent = null, rateLimitCooldownMs = COOLDOWN_DEFAULT_MS, ...rest } = {}) {
  if (typeof getConfig !== 'function') throw new Error('createAi necesita getConfig.');
  if (typeof fetchFn !== 'function') throw new Error('createAi necesita fetchFn.');
  if (cache !== null && (typeof cache !== 'object' || typeof cache.key !== 'function' || typeof cache.get !== 'function' || typeof cache.set !== 'function')) throw new Error('createAi: «cache» debe venir de createCache.');
  if (logEvent !== null && typeof logEvent !== 'function') throw new Error('createAi: «logEvent» debe ser una función.');
  if (!Number.isInteger(rateLimitCooldownMs) || rateLimitCooldownMs < 0 || rateLimitCooldownMs > COOLDOWN_MAX_MS) throw new Error('createAi: «rateLimitCooldownMs» debe ser un entero de 0 a 900000.');
  const none = createNoneProvider();
  const groq = createGroqProvider({
    fetchFn,
    getKey: () => getConfig().key,
    getModel: () => getConfig().model,
    getEndpoint: () => getConfig().endpoint,
  });
  const queue = createQueue({ clock, ...Object.fromEntries(QUEUE_KEYS.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]])) });
  const state = { authFp: null, cooldownUntil: 0 };
  // Nunca lanza: una configuración que falla se trata como «sin clave».
  const keyOf = () => { try { const k = (getConfig() || {}).key; return typeof k === 'string' ? k.trim() : ''; } catch { return ''; } };

  function pick() {
    const c = getConfig() || {};
    if (c.mode === 'mechanical') return none;
    if (c.provider === 'groq') return groq;
    return none;
  }

  // ¿Se puede usar la IA ahora? { available, reason|null, retryAt? } (retryAt en ms del reloj). Sin red y sin efectos.
  function availability() {
    try { return availabilityOf(); } catch { return { available: false, reason: 'no_ai' }; }
  }
  function availabilityOf() {
    const c = getConfig() || {};
    const no = (reason, extra) => ({ available: false, reason, ...extra });
    if (pick().id === 'none') return no('no_ai');
    const key = keyOf();
    if (key === '') return no('no_key');
    const model = typeof c.model === 'string' ? c.model.trim() : '';
    if ((model || GROQ_DEFAULT_MODEL) === '') return no('no_model');
    if (c.endpoint && checkEndpoint(c.endpoint) === null) return no('bad_endpoint');
    if (state.authFp !== null && state.authFp === fingerprint(key)) return no('auth');
    if (state.cooldownUntil > clock.nowMs()) return no('rate_limit', { retryAt: state.cooldownUntil });
    return { available: true, reason: null };
  }

  // Una llamada completa al proveedor (con cola, tiempo límite y reintentos).
  const call = (provider, r, messages) => queue.run(
    async (signal) => {
      try { return await provider.complete({ ...r, messages, signal }); } catch { return { ok: false, reason: 'network' }; }
    },
    { signal: r.signal, timeoutMs: r.timeoutMs },
  );

  // Recuerda lo aprendido de esta llamada para available(): clave rechazada y cupo agotado.
  function learn(out, key) {
    if (out.ok) { state.authFp = null; state.cooldownUntil = 0; return; }
    if (out.reason === 'auth' && key !== '') state.authFp = fingerprint(key);
    if (out.reason === 'rate_limit') {
      const wait = Number.isFinite(out.retryAfterMs) && out.retryAfterMs > 0 ? out.retryAfterMs : rateLimitCooldownMs;
      state.cooldownUntil = clock.nowMs() + Math.min(wait, COOLDOWN_MAX_MS);
    }
  }

  return Object.freeze({
    providerId: () => pick().id,
    available: () => availability().available,
    availability,
    queueStats: () => queue.stats(),
    async complete(req) {
      const r = normalizeRequest(req);
      const provider = pick();
      const t0 = clock.nowMs();
      let attempts = 0;
      let cached = false;
      const done = async (o) => {
        const ms = Math.max(0, clock.nowMs() - t0);
        const out = { ...o, provider: provider.id, ms, attempts };
        if (!out.ok) out.error = friendlyMessage(out.reason);
        if (cached) out.cached = true;
        const safe = {};
        if (typeof out.text === 'string') safe.text = escapeHtml(out.text);
        if (out.json !== undefined) safe.json = escapeDeep(out.json);
        if (Object.keys(safe).length > 0) out.safe = safe;
        if (provider.id !== 'none' && attempts > 0) learn(out, keyOf());
        if (logEvent && (cached || (attempts > 0 && !NO_NETWORK.has(out.reason)))) {
          try { await logEvent(callRecord(r.task, out, r.messages, cached)); } catch { /* registrar nunca cambia el resultado */ }
        }
        return out;
      };
      if (provider.id === 'none') return done(await provider.complete(r));

      // Caché: se consulta antes de salir a la red (sirve también sin conexión).
      let cfgModel;
      try { cfgModel = (getConfig() || {}).model; } catch { cfgModel = ''; }
      const model = typeof cfgModel === 'string' && cfgModel.trim() !== '' ? cfgModel.trim() : GROQ_DEFAULT_MODEL;
      let ckey = null;
      if (cache && r.cache && model !== '') {
        ckey = await cache.key(r, model);
        if (ckey && !r.refresh) {
          const hit = await cache.get(ckey);
          if (hit) {
            cached = true;
            return done({ ok: true, text: hit.text, ...(hit.json !== undefined ? { json: hit.json } : {}), model, usage: hit.usage });
          }
        }
      }

      let out = await call(provider, r, r.messages);
      attempts += out.attempts || 0;
      if (!out.ok) return done(out);
      const base = { ok: true, text: out.text, model: out.model, usage: out.usage };
      if (!r.json) {
        if (ckey) await cache.set(ckey, base, { task: r.task, model });
        return done(base);
      }
      let parsed = parseJson(out.text);
      if (!parsed.ok) {
        // Reintento único: se le muestra su propia respuesta y se le pide JSON válido.
        const repair = [...r.messages, { role: 'assistant', content: out.text.slice(0, REPAIR_TEXT_MAX) }, { role: 'user', content: REPAIR_ASK }];
        const second = await call(provider, r, repair);
        attempts += second.attempts || 0;
        if (!second.ok) return done({ ...second, repaired: true });
        out = second;
        base.text = out.text; base.model = out.model; base.usage = out.usage; base.repaired = true;
        parsed = parseJson(out.text);
        if (!parsed.ok) return done({ ok: false, reason: 'bad_json', text: out.text, repaired: true });
      }
      if (r.schema) {
        const v = validate(parsed.value, r.schema);
        if (!v.ok) return done({ ok: false, reason: 'schema', errors: v.errors, text: out.text, ...(base.repaired ? { repaired: true } : {}) });
      }
      if (ckey) await cache.set(ckey, { text: base.text, json: parsed.value, usage: base.usage }, { task: r.task, model });
      return done({ ...base, json: parsed.value });
    },
  });
}
