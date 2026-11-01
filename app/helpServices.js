// @purpose: Crea los 4 servicios de la barra de ayudas (examples, corrections, aiHelp, dictionary) como fachadas perezosas que esperan a la base, los ajustes y el contenido.
// Servicios de la barra de ayudas (subparte 2.9-T3, punto 5). Roadmap 2.7 y 17. Sin DOM; el `fetch` se inyecta.
//
//   createHelpServices({ services, fetchFn?, log? })  objeto CONGELADO { examples, corrections, aiHelp, dictionary }
//     services   el objeto de servicios de la app (app.services). Se lee SIEMPRE al usarlo, nunca al crear: `study`, `settings`, `db` e `itemResolver` se completan tras el arranque.
//     Cada fachada tiene la misma forma que la fuente que envuelve, para que ui/views/sesion.js no cambie:
//       examples     { forEntry(entry, { excludeItemIds? }) }   app/examplesSource.js; `loadItems` sale de `itemResolver.byTopics`; los temas, de `study.topics`.
//       corrections  { forEntry(entry) }                         app/correctionsSource.js; sin base o sin catálogo da { corrections: [], count: 0 } (no hay errores que contar).
//       aiHelp       { status(), prepare(entry, { answer?, message? }) }   app/aiHelpSource.js; `ai` es createAi con los ajustes (sin caché ni registro: aquí solo se lee `availability()`).
//                    Antes de que los ajustes carguen, status() dice { available: false, reason: 'no_ai' } (sin IA: la hoja ofrece Llevar al chat).
//       dictionary   { prepare(), search(q), mine(lemma), add(word), addTranslation(lemma, text) }   app/dictionarySource.js; el léxico = el `lexicon` de los paquetes (`itemResolver.lexicon()`; el semilla no trae)
//                    MÁS el diccionario básico de `content/taxonomy/lemmas.json` (app/lemmaLexicon.js: lema y banda, sin traducción); la entrada de un paquete manda sobre la básica.
//     Los métodos asíncronos esperan `services.studyReady` (y el diccionario también `services.storageReady`) si existen, y NUNCA lanzan por eso: si esa espera falla, la anotan en `log` y siguen con lo que haya. Los errores de las fuentes se propagan
//     como en la fuente (la hoja los cuenta sin culpa y el ejercicio no se toca).
//     Las fuentes se arman una vez por cada `study`/`db`/`settings` distinto, no en cada toque.
import { createExamplesSource } from './examplesSource.js';
import { createCorrectionsSource } from './correctionsSource.js';
import { createAiHelpSource } from './aiHelpSource.js';
import { createDictionarySource } from './dictionarySource.js';
import { createLemmaLexicon, mergeLexicon } from './lemmaLexicon.js';
import { createAi, configFromSettings } from '../core/ai/index.js';

const NO_AI = Object.freeze({ available: false, reason: 'no_ai' });
const EMPTY_CORRECTIONS = Object.freeze({ corrections: Object.freeze([]), count: 0 });

export function createHelpServices({ services, fetchFn = globalThis.fetch?.bind(globalThis), log = console.error } = {}) {
  if (services === null || typeof services !== 'object') throw new Error('createHelpServices: services debe ser un objeto');
  if (typeof log !== 'function') throw new Error('createHelpServices: log debe ser una función');

  // Memoriza `make()` mientras la clave no cambie (identidad): si `study` se reemplaza, la fuente se arma de nuevo.
  const memo = (keyOf, make) => {
    let madeFor; let made = null; let has = false;
    return () => { const k = keyOf(); if (!has || madeFor !== k) { made = make(k); madeFor = k; has = true; } return made; };
  };
  const wait = async (what, p) => { try { await p; } catch (e) { log(`Ayudas: ${what} no está listo`, e); } };
  const ready = () => wait('el estudio', services.studyReady);

  const examplesSource = memo(() => services.study ?? null, (study) => createExamplesSource({
    loadItems: (ids) => (services.itemResolver ? services.itemResolver.byTopics(ids) : []),
    topics: study?.topics ?? [],
  }));
  const examples = Object.freeze({
    async forEntry(entry, options) { await ready(); return examplesSource().forEntry(entry, options); },
  });

  const correctionsSource = memo(() => services.study ?? null, (study) => (study?.errors ? createCorrectionsSource({ errors: study.errors, catalog: study.catalog ?? null }) : null));
  const corrections = Object.freeze({
    async forEntry(entry) { await ready(); return correctionsSource()?.forEntry(entry) ?? EMPTY_CORRECTIONS; },
  });

  // El cliente de IA lee los ajustes en cada llamada (un cambio vale al instante); solo se crea cuando los ajustes ya existen.
  const aiClient = memo(() => services.settings ?? null, (settings) => {
    if (!settings || typeof fetchFn !== 'function') return null;
    try { return createAi({ getConfig: configFromSettings(settings), fetchFn }); } catch (e) { log('Preguntas IA: no se pudo preparar el cliente', e); return null; }
  });
  const describeItem = async (entry) => {
    const item = typeof entry?.itemId === 'string' && services.itemResolver ? await services.itemResolver.resolve(entry.itemId) : null;
    const text = [item?.prompt_en, item?.prompt_es].find((t) => typeof t === 'string' && t.trim() !== '');
    return text ?? null;
  };
  // Se pasa un envoltorio y no el cliente: los ajustes pueden cargar después de armar la fuente, y status() debe verlos sin rearmarla.
  const lazyAi = Object.freeze({ availability: () => aiClient()?.availability() ?? NO_AI });
  const aiSource = memo(() => services.study ?? null, (study) => createAiHelpSource({
    ai: lazyAi, corrections, mastery: study?.mastery ?? null, describeItem, clock: study?.clock ?? null, log,
  }));
  const aiHelp = Object.freeze({
    status() {
      try { return aiSource().status(); } catch (e) { log('Preguntas IA: no pude leer la disponibilidad', e); return NO_AI; }
    },
    async prepare(entry, options) { await ready(); return aiSource().prepare(entry, options); },
  });

  // Reloj perezoso: la fuente se arma antes de que `study` exista (una busqueda previa a prepare()), pero la fecha de «Añadir» debe salir del reloj del estudio cuando ya esté.
  const lazyClock = Object.freeze({ now: () => services.study?.clock?.now() ?? new Date() });
  const lemmaLexicon = createLemmaLexicon({ fetchFn, log });
  const dictionarySource = memo(() => services.db ?? null, (db) => createDictionarySource({
    loadLexicon: async () => mergeLexicon(services.itemResolver ? await services.itemResolver.lexicon() : [], await lemmaLexicon.load()),
    db, clock: lazyClock, log,
  }));
  const dictionary = Object.freeze({
    async prepare() { await wait('el almacén', services.storageReady); return dictionarySource().prepare(); },
    search: (query) => dictionarySource().search(query),
    mine: (lemma) => dictionarySource().mine(lemma),
    async add(word) { await ready(); await wait('el almacén', services.storageReady); return dictionarySource().add(word); },
    async addTranslation(lemma, text) { await ready(); await wait('el almacén', services.storageReady); return dictionarySource().addTranslation(lemma, text); },
  });

  return Object.freeze({ examples, corrections, aiHelp, dictionary });
}
