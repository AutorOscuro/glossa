// @purpose: Importa los paquetes de contenido a la base al arrancar la app, sin bloquear el arranque y sin lanzar nunca.
// Importación de contenido al arrancar (subparte 2.9-T3, punto 1). Roadmap 8.10, 8.13 y 17.
//   startContent({ storageReady, fetchFn?, clock?, log? }) → Promesa de { ok, skipped, reason?, results, failed }
//     · Espera la base (`storageReady`), lee la taxonomía (códigos de error y temas) para validar y llama a `importPacksToDb`.
//     · Nunca rechaza: base que no abrió, sin fetch, índice que falta o paquete dañado devuelven `ok:false` y lo cuentan en `log`.
//     · `now` (Date) es obligatorio en `importPacksToDb`: sale de `clock` o, sin reloj, de la hora real.
//     · Idempotente: `importPacksToDb` no vuelve a descargar un paquete ya importado en esa versión o mayor.
//     · Si la taxonomía no carga, importa igual (sin la comprobación de temas y códigos) y lo anota en `log`.
import { importPacksToDb } from '../core/content.js';
import { errorCodeSet } from '../core/contentCodes.js';
import { topicInfo } from '../core/contentTaxonomy.js';

export const ERROR_CODES_URL = 'content/taxonomy/error_codes.json';
export const TOPICS_URL = 'content/taxonomy/topics.json';

async function readJson(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res || !res.ok) throw new Error(`No se pudo leer ${url}`);
  return res.json();
}

async function buildContext(fetchFn, log) {
  try {
    const [codes, topics] = await Promise.all([readJson(fetchFn, ERROR_CODES_URL), readJson(fetchFn, TOPICS_URL)]);
    const info = topicInfo(topics);
    return { errorCodes: errorCodeSet(codes), topicIds: new Set(info.keys()), topicInfo: info };
  } catch (e) {
    log('No se pudo leer la taxonomía; el contenido se importa sin comprobar temas ni códigos', e);
    return {};
  }
}

export async function startContent({ storageReady, fetchFn = globalThis.fetch?.bind(globalThis), clock, log = console.error } = {}) {
  const none = (reason) => ({ ok: false, skipped: true, reason, results: [], failed: [] });
  try {
    let db = null;
    try { db = (await storageReady)?.db ?? null; } catch (e) { log('El contenido no pudo esperar al almacenamiento', e); }
    if (!db) return none('db');
    if (typeof fetchFn !== 'function') { log('Sin fetch: no se importa el contenido'); return none('fetch'); }
    const ctx = await buildContext(fetchFn, log);
    const r = await importPacksToDb(db, fetchFn, { ctx, now: clock ? clock.now() : new Date() });
    if (!r.ok) log('El contenido no se importó completo', r.error ?? r.failed);
    return { ok: r.ok, skipped: false, missing: r.missing === true, results: r.results ?? [], failed: r.failed ?? [] };
  } catch (e) {
    log('No se pudo importar el contenido', e);
    return none('error');
  }
}
