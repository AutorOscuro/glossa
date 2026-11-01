// @purpose: Proveedor Groq (formato compatible con OpenAI): arma la petición, la envía con fetch inyectado y clasifica la respuesta sin filtrar la clave.
// Proveedor Groq (1.10-T1). La clave NUNCA está en el código: llega por `getKey()` en cada llamada y solo viaja en la cabecera Authorization.
// Endpoint y modelo son editables. Valores verificados en la documentación de Groq el 2026-10-25 (1.10-T4): `llama-3.3-70b-versatile` se retiró el 16-ago-2026 y la propia
// Groq recomienda `openai/gpt-oss-120b` (modelo de producción). Si Groq lo retira otra vez, la persona puede poner otro en Ajustes y T4-futuro cambia solo la constante.
// Esta capa solo CLASIFICA el fallo (reason) y, si el servidor la manda, pasa la espera pedida (`retryAfterMs`, de la cabecera Retry-After en segundos).
// Reintentos, espera y tiempo límite viven en `queue.js` (T2); mensajes amables en `messages.js`; registro, en T3.
export const GROQ_DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
// Límites del plan gratuito para ese modelo (por organización, no por clave; se leen en console.groq.com/docs/rate-limits). Solo informativos: el servidor manda.
export const GROQ_FREE_LIMITS = Object.freeze({ verified: '2026-10-25', model: 'openai/gpt-oss-120b', rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 });
// Los modelos gpt-oss razonan y esos tokens salen del mismo tope (`max_tokens`): con `low` queda sitio para la respuesta y gasta menos cupo.
const REASONING_RE = /^openai\/gpt-oss-/;

const MAX_REPLY_CHARS = 200000;

// Devuelve la URL normalizada o null si no es https válida (nunca se envía una clave por http ni a un esquema raro).
export function checkEndpoint(value) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 400) return null;
  let u;
  try { u = new URL(value.trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash) return null;
  return u.href;
}

// Código HTTP → motivo estable. 200 no pasa por aquí.
export function reasonFromStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status >= 500) return 'server';
  return 'bad_request';
}

// Cabecera Retry-After en segundos enteros → milisegundos; cualquier otra forma (fecha, texto, negativo) se ignora.
export function retryAfterMs(res) {
  const h = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
  if (typeof h !== 'string' || !/^\d{1,6}$/.test(h.trim())) return undefined;
  return Number(h.trim()) * 1000;
}

export function createGroqProvider({ fetchFn, getKey, getModel, getEndpoint } = {}) {
  if (typeof fetchFn !== 'function') throw new Error('createGroqProvider necesita fetchFn.');
  if (typeof getKey !== 'function') throw new Error('createGroqProvider necesita getKey.');
  const key = () => { const k = getKey(); return typeof k === 'string' ? k.trim() : ''; };
  const modelOf = () => { const m = typeof getModel === 'function' ? getModel() : ''; return typeof m === 'string' && m.trim() ? m.trim() : GROQ_DEFAULT_MODEL; };
  const endpointOf = () => { const e = typeof getEndpoint === 'function' ? getEndpoint() : ''; return e ? checkEndpoint(e) : GROQ_DEFAULT_ENDPOINT; };

  return Object.freeze({
    id: 'groq',
    available: () => key() !== '',
    // request: { messages, maxTokens, temperature, json, signal? } (ya validada por la fachada).
    async complete(request) {
      const apiKey = key();
      if (apiKey === '') return { ok: false, reason: 'no_key' };
      const model = modelOf();
      if (model === '') return { ok: false, reason: 'no_model' };
      const url = endpointOf();
      if (url === null) return { ok: false, reason: 'bad_endpoint' };
      const body = { model, messages: request.messages, max_tokens: request.maxTokens, temperature: request.temperature };
      if (REASONING_RE.test(model)) body.reasoning_effort = 'low';
      if (request.json) body.response_format = { type: 'json_object' };
      let res;
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: request.signal,
        });
      } catch (e) {
        return { ok: false, reason: e && e.name === 'AbortError' ? 'aborted' : 'network' }; // el mensaje del error no se propaga: podría llevar datos
      }
      if (!res || typeof res.status !== 'number') return { ok: false, reason: 'network' };
      if (res.status < 200 || res.status >= 300) {
        const fail = { ok: false, reason: reasonFromStatus(res.status), status: res.status };
        const wait = retryAfterMs(res);
        if (wait !== undefined && (fail.reason === 'rate_limit' || fail.reason === 'server')) fail.retryAfterMs = wait;
        return fail;
      }
      let data;
      try { data = await res.json(); } catch { return { ok: false, reason: 'bad_response' }; }
      const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
      const content = choice && choice.message ? choice.message.content : undefined;
      if (typeof content !== 'string') return { ok: false, reason: 'bad_response' };
      if (content.trim() === '') return { ok: false, reason: 'empty' };
      const u = data.usage && typeof data.usage === 'object' ? data.usage : {};
      const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
      return {
        ok: true,
        text: content.length > MAX_REPLY_CHARS ? content.slice(0, MAX_REPLY_CHARS) : content,
        truncated: content.length > MAX_REPLY_CHARS,
        model,
        usage: { promptTokens: n(u.prompt_tokens), completionTokens: n(u.completion_tokens) },
      };
    },
  });
}
