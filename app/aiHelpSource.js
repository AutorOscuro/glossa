// @purpose: Fuente de «Preguntas IA» (2.7-T3): dice si hay IA configurada y prepara el bloque «Llevar al chat» con el tema, el ítem, la respuesta, los errores y el dominio.
// Pegamento sin DOM entre la vista de sesión, el cliente de IA (solo `availability()`), las correcciones y el dominio. NO llama a la IA: las preguntas reales llegan con la parte 5.
// Hasta 2.9-T3 nadie crea esta fuente en la app, igual que las de ejemplos y correcciones.
//
//   createAiHelpSource({ ai?, corrections?, mastery?, describeItem?, clock?, log? }) → { status(), prepare(entry, { answer?, message? }) }
//     ai            cliente de core/ai/index.js (`availability()`); sin él o si falla: { available:false, reason:'no_ai' }.
//     corrections   createCorrectionsSource(...) (`forEntry`): de ahí salen los errores recientes del ejercicio (hasta 10).
//     mastery       createMastery(...) (`compute(topicId)`): el dominio del tema principal.
//     describeItem  (entry) → texto del ítem (la frase o la consigna) o null; puede ser asíncrona.
//   status()   → { available, reason }   Sin red y sin efectos.
//   prepare()  → Promesa de { ok:true, text } | { ok:false, error }   Cada parte que falla se omite y su motivo va a `log`; el bloque sale con lo que haya.
import { buildAskBlock } from '../core/aiAsk.js';

export function createAiHelpSource({ ai = null, corrections = null, mastery = null, describeItem = null, clock = null, log = console.error } = {}) {
  const guard = async (what, fn) => { try { return await fn(); } catch (e) { log(`«Llevar al chat»: no pude leer ${what}`, e); return undefined; } };
  return Object.freeze({
    status() {
      try {
        const a = typeof ai?.availability === 'function' ? ai.availability() : null;
        if (a && typeof a === 'object') return { available: a.available === true, reason: a.available === true ? null : (typeof a.reason === 'string' ? a.reason : 'no_ai') };
      } catch (e) { log('«Preguntas IA»: no pude leer la disponibilidad', e); }
      return { available: false, reason: 'no_ai' };
    },
    async prepare(entry, { answer, message } = {}) {
      const own = entry !== null && typeof entry === 'object' ? entry : {};
      const topic = typeof own.topic === 'string' && own.topic !== '' ? own.topic : (Array.isArray(own.topics) && typeof own.topics[0] === 'string' ? own.topics[0] : undefined);
      const [item, found, level] = await Promise.all([
        typeof describeItem === 'function' ? guard('el ítem', () => describeItem(own)) : undefined,
        corrections && typeof corrections.forEntry === 'function' ? guard('las correcciones', () => corrections.forEntry(own)) : undefined,
        mastery && typeof mastery.compute === 'function' && topic ? guard('el dominio', () => mastery.compute(topic)) : undefined,
      ]);
      return buildAskBlock({
        topic, item, answer, message,
        errors: Array.isArray(found?.corrections) ? found.corrections : [],
        mastery: level ? { pct: level.pct, band: level.label ?? level.band } : undefined,
      }, clock && typeof clock.now === 'function' ? { now: clock.now() } : undefined);
    },
  });
}
