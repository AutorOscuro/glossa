// @purpose: Cola del cliente de IA: límite de concurrencia, tiempo límite por intento y reintentos con espera exponencial ante 429, 5xx, red y vacío.
// Cola (1.10-T2). createQueue(opciones) → { run(attempt, { signal?, timeoutMs? }), stats() }.
//   attempt(signal) → resultado del proveedor ({ ok, … } | { ok:false, reason, retryAfterMs? }). Un rechazo del attempt cuenta como `network`.
//   Reintenta solo `rate_limit`, `server`, `network`, `timeout` (hasta maxRetries) y `empty` (hasta emptyRetries). Nunca `auth`, `bad_request`, `aborted`.
//   Espera = min(maxDelayMs, baseDelayMs·2^n) con azar entre 50 % y 100 %; si el servidor pide más de maxDelayMs, no se espera: se devuelve el fallo.
//   El conjunto no pasa de maxTotalMs desde el primer intento. Cancelar (signal) corta la espera y saca de la fila. Reloj, azar y temporizadores se inyectan.
// Resultado: el del último intento más `attempts` (intentos hechos). `queue_full` si hay maxPending esperando.
export const QUEUE_DEFAULTS = Object.freeze({
  concurrency: 2, maxPending: 50, maxRetries: 3, emptyRetries: 1,
  baseDelayMs: 500, maxDelayMs: 8000, maxTotalMs: 45000, timeoutMs: 20000,
});
const RETRYABLE = new Set(['rate_limit', 'server', 'network', 'timeout']);
const INT_RANGES = {
  concurrency: [1, 8], maxPending: [0, 1000], maxRetries: [0, 10], emptyRetries: [0, 10],
  baseDelayMs: [0, 60000], maxDelayMs: [0, 600000], maxTotalMs: [1000, 900000], timeoutMs: [1000, 300000],
};

export function checkTimeout(value) {
  const [lo, hi] = INT_RANGES.timeoutMs;
  return Number.isInteger(value) && value >= lo && value <= hi;
}

// Espera antes del reintento número `retryIndex` (0 = el primero).
export function backoffDelay(retryIndex, { baseDelayMs, maxDelayMs, rng }) {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(retryIndex, 30));
  return Math.round(cap * (0.5 + 0.5 * rng()));
}

function mergeOptions(opts) {
  const o = { ...QUEUE_DEFAULTS };
  for (const [k, [lo, hi]] of Object.entries(INT_RANGES)) {
    if (opts[k] === undefined) continue;
    if (!Number.isInteger(opts[k]) || opts[k] < lo || opts[k] > hi) throw new Error(`createQueue: «${k}» debe ser un entero de ${lo} a ${hi}.`);
    o[k] = opts[k];
  }
  return o;
}

export function createQueue(opts = {}) {
  const o = mergeOptions(opts);
  const clock = opts.clock || { nowMs: () => Date.now() };
  const rng = typeof opts.rng === 'function' ? opts.rng : (opts.rng && opts.rng.next ? () => opts.rng.next() : Math.random);
  const timers = opts.timers || { setTimeout: (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: (h) => globalThis.clearTimeout(h) };
  const waiting = [];
  let running = 0;
  const aborted = (attempts = 0) => ({ ok: false, reason: 'aborted', attempts });

  // Espera `ms`; devuelve false si se cancela antes.
  function sleep(ms, signal) {
    return new Promise((resolve) => {
      if (signal && signal.aborted) { resolve(false); return; }
      let h;
      const onAbort = () => { timers.clearTimeout(h); resolve(false); };
      h = timers.setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(true); }, ms);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // Un intento con tiempo límite; el tiempo se impone aunque el proveedor ignore la señal.
  async function once(attempt, signal, timeoutMs) {
    if (signal && signal.aborted) return { ok: false, reason: 'aborted' };
    const ctl = new globalThis.AbortController();
    let timedOut = false;
    const onAbort = () => ctl.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const timer = timers.setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    const GONE = Symbol('gone');
    const gone = new Promise((res) => { ctl.signal.addEventListener('abort', () => res(GONE), { once: true }); });
    try {
      let out;
      try { out = await Promise.race([attempt(ctl.signal), gone]); } catch { out = { ok: false, reason: 'network' }; }
      if (out === GONE) return { ok: false, reason: timedOut ? 'timeout' : 'aborted' };
      if (out === null || typeof out !== 'object' || typeof out.ok !== 'boolean') return { ok: false, reason: 'bad_response' };
      return out;
    } finally {
      timers.clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  async function execute(attempt, signal, timeoutMs) {
    const t0 = clock.nowMs();
    let n = 0;
    for (;;) {
      n += 1;
      const out = await once(attempt, signal, timeoutMs);
      if (out.ok || out.reason === 'aborted') return { ...out, attempts: n };
      const done = n - 1; // reintentos ya hechos
      let limit = 0;
      if (RETRYABLE.has(out.reason)) limit = o.maxRetries; else if (out.reason === 'empty') limit = Math.min(o.emptyRetries, o.maxRetries);
      if (done >= limit) return { ...out, attempts: n };
      let wait = backoffDelay(done, { baseDelayMs: o.baseDelayMs, maxDelayMs: o.maxDelayMs, rng });
      if (Number.isFinite(out.retryAfterMs) && out.retryAfterMs >= 0) {
        if (out.retryAfterMs > o.maxDelayMs) return { ...out, attempts: n };
        wait = Math.max(wait, out.retryAfterMs);
      }
      if (clock.nowMs() - t0 + wait > o.maxTotalMs) return { ...out, attempts: n };
      if (!(await sleep(wait, signal))) return aborted(n);
    }
  }

  function pump() {
    while (running < o.concurrency && waiting.length > 0) {
      const job = waiting.shift();
      running += 1;
      // El puesto se libera ANTES de entregar el resultado: quien espera `run` y vuelve a llamar enseguida ya lo ve libre.
      job.exec().catch(() => ({ ok: false, reason: 'network', attempts: 0 })).then((res) => { running -= 1; job.resolve(res); pump(); });
    }
  }

  return Object.freeze({
    run(attempt, { signal, timeoutMs } = {}) {
      if (typeof attempt !== 'function') throw new Error('queue.run necesita una función.');
      const tm = timeoutMs === undefined ? o.timeoutMs : timeoutMs;
      if (!checkTimeout(tm)) throw new Error('queue.run: «timeoutMs» debe ser un entero de 1000 a 300000.');
      return new Promise((resolve) => {
        if (signal && signal.aborted) { resolve(aborted()); return; }
        if (waiting.length >= o.maxPending && running >= o.concurrency) { resolve({ ok: false, reason: 'queue_full', attempts: 0 }); return; }
        const job = { resolve, exec: async () => { if (signal) signal.removeEventListener('abort', onWait); return execute(attempt, signal, tm); } };
        const onWait = () => { const i = waiting.indexOf(job); if (i >= 0) { waiting.splice(i, 1); resolve(aborted()); } };
        if (signal) signal.addEventListener('abort', onWait, { once: true });
        waiting.push(job);
        pump();
      });
    },
    stats: () => ({ running, waiting: waiting.length, concurrency: o.concurrency }),
  });
}
