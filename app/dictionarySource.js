// @purpose: Fuente de «Diccionario» (2.7-T4): carga el léxico local, busca con core/lexSearch.js y guarda «añadir» como palabra desconocida en el almacén `words`.
// Pegamento sin DOM entre la hoja y el contenido. La crea app/helpServices.js (2.9-T3) con el léxico de los paquetes mezclado con el básico de lemmas.json (2.9-T4, app/lemmaLexicon.js).
//
//   createDictionarySource({ loadLexicon, db?, clock?, log? }) → { prepare(), search(query), add(word), addTranslation(lemma, text), mine(lemma) }
//     loadLexicon()  Promesa de la lista de LexEntry (de `pack.lexicon`). Se llama en CADA prepare() para ver los paquetes nuevos; si falla, prepare() se rechaza.
//     prepare()      Promesa; deja listo el índice. Búsquedas antes de prepare() devuelven vacío (reason 'empty').
//     search(q)      → resultado de createLexSearch(...).search (síncrono, sobre el índice ya cargado).
//     add(word)      → Promesa de { ok:true, id, existed } | { ok:false, reason:'invalid' | 'no_db' | 'failed' }. Contrato (roadmap 8.13 `words`, id = lema):
//                    se guarda { id, state:'unknown', source:'dictionary', added } con el lema en minúsculas, sin tocar una palabra que ya esté en `words`.
//                    Va como «unknown» porque buscarla y no tenerla es justo «no la sé»: así nunca cuenta como conocida en la lista blanca (core/whitelistKnown.js la quita de las fuentes).
//     addTranslation(lemma, text) (2.9-T4) → Promesa de { ok:true, id, existed } | { ok:false, reason:'invalid' | 'no_db' | 'failed' }. «Añadir mi traducción» del diccionario básico: guarda una NOTA LOCAL
//                    en `notes` con id `dict_es:<lema>` y { id, kind:'translation', lemma, text, added } (la leerá 4.1). Reemplaza la nota anterior de ese lema (`existed` = ya había una). NO toca `words`:
//                    no marca la palabra como conocida ni como desconocida. Texto: sin caracteres de control, recortado, 1 a 120 letras.
//     mine(lemma) (2.9-T4) → texto | null: la traducción propia ya guardada de ese lema (se lee de `notes` en prepare() y se actualiza al guardar). Síncrona; sin base da null.
import { createLexSearch } from '../core/lexSearch.js';
import { normalize } from '../core/normalize.js';

export const WORD_RE = /^\p{L}[\p{L}'’ -]{0,58}\p{L}$|^\p{L}$/u;

export const NOTE_MAX = 120;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

export function createDictionarySource({ loadLexicon, db = null, clock = null, log = console.error } = {}) {
  if (typeof loadLexicon !== 'function') throw new Error('createDictionarySource: loadLexicon debe ser una función');
  let index = createLexSearch([]);
  const mineByLemma = new Map(); // lema → traducción propia (notas `dict_es:`)
  return Object.freeze({
    async prepare() {
      const loaded = await loadLexicon();
      index = createLexSearch(Array.isArray(loaded) ? loaded : []);
      try {
        if (db && typeof db.query === 'function') {
          mineByLemma.clear();
          for (const n of await db.query('notes', {})) if (n && n.kind === 'translation' && typeof n.lemma === 'string' && typeof n.text === 'string') mineByLemma.set(n.lemma, n.text);
        }
      } catch (e) { log('No se pudieron leer tus traducciones guardadas', e); } // el diccionario sigue sin ellas
    },
    mine: (lemma) => (typeof lemma === 'string' ? mineByLemma.get(lemma.toLowerCase()) ?? null : null),
    search: (query) => index.search(query),
    async addTranslation(lemma, text) {
      const id = typeof lemma === 'string' ? normalize(lemma).replace(/\s+/g, ' ') : '';
      const body = typeof text === 'string' ? text.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX).trim() : '';
      if (id === '' || !WORD_RE.test(id) || body === '') return { ok: false, reason: 'invalid' };
      if (!db || typeof db.get !== 'function' || typeof db.put !== 'function') return { ok: false, reason: 'no_db' };
      try {
        const key = `dict_es:${id}`;
        const there = await db.get('notes', key);
        const now = clock && typeof clock.now === 'function' ? clock.now() : new Date();
        await db.put('notes', { id: key, kind: 'translation', lemma: id, text: body, added: now.toISOString() });
        mineByLemma.set(id, body);
        return { ok: true, id, existed: Boolean(there) };
      } catch (e) {
        log('No se pudo guardar la traducción', e);
        return { ok: false, reason: 'failed' };
      }
    },
    async add(word) {
      const id = typeof word === 'string' ? normalize(word).replace(/\s+/g, ' ') : '';
      if (id === '' || !WORD_RE.test(id)) return { ok: false, reason: 'invalid' };
      if (!db || typeof db.get !== 'function' || typeof db.put !== 'function') return { ok: false, reason: 'no_db' };
      try {
        const there = await db.get('words', id);
        if (there) return { ok: true, id, existed: true };
        const now = clock && typeof clock.now === 'function' ? clock.now() : new Date();
        await db.put('words', { id, state: 'unknown', source: 'dictionary', added: now.toISOString() });
        return { ok: true, id, existed: false };
      } catch (e) {
        log('No se pudo añadir la palabra', e);
        return { ok: false, reason: 'failed' };
      }
    },
  });
}
