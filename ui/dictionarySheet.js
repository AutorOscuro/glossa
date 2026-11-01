// @purpose: Hoja «Diccionario» (2.7-T4): búsqueda local mientras se escribe, tolerante a mayúsculas y acentos; si la palabra no está, ofrece «Añadir» sin culpa.
// Va sobre createSheet: el ejercicio sigue montado debajo. Los textos viven en DI_TEXT para poder auditarlos (cadenas sin culpa, 2.6-T3).
//
//   createDictionarySheet({ source, onOpen?, onClose?(motivo), doc?, container?, log? }) → { open(), close(), isOpen(), destroy() }
//     source   app/dictionarySource.js: `prepare()`, `search(q)` y `add(word)`; OPCIONALES `addTranslation(lemma, text)` y `mine(lemma)` (sin ellos no hay «Añadir mi traducción»). prepare() se llama en CADA apertura; si falla: aviso amable y motivo al log.
//     Entradas del diccionario básico (`entry.basic`, sin traducción): «Palabra del inglés, banda 1K.» y el botón «Añadir mi traducción» (campo + Guardar, nota local para 4.1). No marca ninguna palabra como conocida.
import { createSheet } from './components/index.js';
import { h as domH } from './dom.js';

export const DI_TEXT = Object.freeze({
  title: 'Diccionario',
  close: 'Cerrar',
  loading: 'Abriendo el diccionario…',
  label: 'Busca una palabra',
  hint: 'Escribe en inglés o en español. No importan las mayúsculas ni los acentos.',
  empty: 'Escribe una palabra para buscarla.',
  none: 'No encontré «{w}» en tu diccionario.',
  add: 'Añadir «{w}»',
  added: 'Listo: «{w}» quedó en tus palabras.',
  existed: '«{w}» ya estaba en tus palabras.',
  cantAdd: 'No pude añadir esa palabra ahora. Puedes intentarlo otra vez en un momento.',
  badWord: 'Solo puedo añadir palabras con letras. Prueba con otra.',
  failed: 'No pude abrir el diccionario ahora. Puedes volver a abrir esta hoja en un momento.',
  keep: 'Tu ejercicio sigue como lo dejaste.',
  basicNote: 'El Diccionario es básico por ahora.',
  basicWord: 'Palabra del inglés, banda {b}.',
  addMine: 'Añadir mi traducción',
  mineLabel: 'Tu traducción al español',
  mineSave: 'Guardar',
  mineSaved: 'Listo: guardé tu traducción de «{w}».',
  mineUpdated: 'Listo: actualicé tu traducción de «{w}».',
  mineEmpty: 'Escribe tu traducción para guardarla.',
  mineFailed: 'No pude guardar esa traducción ahora. Puedes intentarlo otra vez en un momento.',
  mine: 'Tu traducción: {t}',
});

export function createDictionarySheet({ source, onOpen, onClose, doc = globalThis.document, container, log = console.error } = {}) {
  if (!source || typeof source.prepare !== 'function' || typeof source.search !== 'function' || typeof source.add !== 'function') throw new TypeError('dictionarySheet: "source" debe tener prepare(), search() y add()');
  const { h } = domH.with(doc);
  let token = 0;
  let destroyed = false;

  const note = (text) => h('p', { class: 'dictionary__note text-sm text-muted' }, text);
  const wrap = (...nodes) => h('div', { class: 'dictionary stack', 'aria-live': 'polite' }, ...nodes);
  const fill = (tpl, w, key = '{w}') => tpl.replace(key, w);

  const sheet = createSheet({
    title: DI_TEXT.title, closeLabel: DI_TEXT.close, doc, container,
    children: [wrap(note(DI_TEXT.loading))],
    onOpen,
    onClose: (reason) => { token += 1; onClose?.(reason); },
  });

  function paintReady(mine) {
    const live = () => !destroyed && mine === token;
    const out = h('div', { class: 'dictionary__out stack' });
    const status = h('p', { class: 'dictionary__status text-sm', role: 'status' });
    const field = h('input', { type: 'text', class: 'input dictionary__field', 'aria-label': DI_TEXT.label, placeholder: DI_TEXT.label, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });

    async function doAdd(word) {
      let r;
      try { r = await source.add(word); } catch (e) { log('No se pudo añadir la palabra', e); r = { ok: false, reason: 'failed' }; }
      if (!live()) return;
      if (r?.ok) status.textContent = fill(r.existed ? DI_TEXT.existed : DI_TEXT.added, r.id ?? word);
      else status.textContent = r?.reason === 'invalid' ? DI_TEXT.badWord : DI_TEXT.cantAdd;
    }

    // «Añadir mi traducción» (solo entradas básicas, sin traducción): botón → campo + Guardar. Guarda una nota local; no cambia el estado de la palabra.
    function mineBlock(entry) {
      if (entry.basic !== true || typeof source.addTranslation !== 'function') return null;
      const box = h('div', { class: 'dictionary__mine stack' });
      const saved = () => (typeof source.mine === 'function' ? source.mine(entry.lemma) : null);
      const showButton = () => {
        const mine = saved();
        // Sin `null` en replaceChildren: un navegador lo escribiría como el texto «null».
        const parts = [h('button', { type: 'button', class: 'btn btn--secondary btn--lg btn--block dictionary__add-mine', onClick: showEditor }, DI_TEXT.addMine)];
        if (mine) parts.unshift(h('p', { class: 'dictionary__mine-text', lang: 'es' }, fill(DI_TEXT.mine, mine, '{t}')));
        box.replaceChildren(...parts);
      };
      const showEditor = () => {
        const input = h('input', { type: 'text', class: 'input dictionary__mine-field', 'aria-label': DI_TEXT.mineLabel, placeholder: DI_TEXT.mineLabel, autocomplete: 'off', maxlength: '120', lang: 'es' });
        if (typeof input.value === 'string' && saved()) input.value = saved();
        const msg = h('p', { class: 'dictionary__mine-status text-sm', role: 'status' });
        const save = async () => {
          let r;
          try { r = await source.addTranslation(entry.lemma, typeof input.value === 'string' ? input.value : ''); } catch (e) { log('No se pudo guardar la traducción', e); r = { ok: false, reason: 'failed' }; }
          if (!live()) return;
          if (r?.ok) { showButton(); status.textContent = fill(r.existed ? DI_TEXT.mineUpdated : DI_TEXT.mineSaved, entry.lemma); }
          else msg.textContent = r?.reason === 'invalid' ? DI_TEXT.mineEmpty : DI_TEXT.mineFailed;
        };
        box.replaceChildren(input, h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block dictionary__save-mine', onClick: save }, DI_TEXT.mineSave), msg);
        if (typeof input.focus === 'function') { try { input.focus(); } catch (e) { log('No se pudo enfocar el campo de traducción', e); } }
      };
      showButton();
      return box;
    }

    function render() {
      status.textContent = '';
      const raw = typeof field.value === 'string' ? field.value : '';
      let r;
      try { r = source.search(raw); } catch (e) { log('No se pudo buscar en el diccionario', e); r = { found: false, results: [], reason: 'empty' }; }
      const list = Array.isArray(r?.results) ? r.results.filter((x) => x?.entry && typeof x.entry.lemma === 'string') : [];
      if (list.length > 0) {
        const anyBasic = list.some(({ entry }) => entry.basic === true);
        out.replaceChildren(
          h('ul', { class: 'dictionary__list' }, ...list.map(({ entry }) => h('li', { class: 'dictionary__item' },
            h('p', { class: 'dictionary__lemma', lang: 'en' }, entry.lemma),
            Array.isArray(entry.es) && entry.es.length > 0 ? h('p', { class: 'dictionary__es', lang: 'es' }, entry.es.filter((x) => typeof x === 'string').join(', ')) : null,
            entry.basic === true && typeof entry.band === 'string' ? h('p', { class: 'dictionary__band text-sm text-muted', lang: 'es' }, fill(DI_TEXT.basicWord, entry.band, '{b}')) : null,
            typeof entry.def_en === 'string' && entry.def_en !== '' ? h('p', { class: 'dictionary__def text-sm text-muted', lang: 'en' }, entry.def_en) : null,
            typeof entry.false_friend_note_es === 'string' && entry.false_friend_note_es !== '' ? h('p', { class: 'dictionary__note text-sm text-muted', lang: 'es' }, entry.false_friend_note_es) : null,
            mineBlock(entry)))),
          ...(anyBasic ? [note(DI_TEXT.basicNote)] : []),
        );
        return;
      }
      const word = raw.trim();
      if (r?.reason === 'none' || r?.reason === 'short') {
        out.replaceChildren(
          h('p', { class: 'dictionary__none' }, fill(DI_TEXT.none, word)),
          h('button', { type: 'button', class: 'btn btn--secondary btn--lg btn--block dictionary__add', onClick: () => doAdd(word) }, fill(DI_TEXT.add, word)),
        );
        return;
      }
      out.replaceChildren(h('p', { class: 'dictionary__none text-muted' }, DI_TEXT.empty));
    }

    field.addEventListener('input', render);
    sheet.setContent(wrap(note(DI_TEXT.hint), field, out, status));
    render();
    if (typeof field.focus === 'function') { try { field.focus(); } catch (e) { log('No se pudo enfocar el buscador', e); } }
  }

  async function open() {
    if (destroyed || sheet.isOpen()) return false;
    sheet.setContent(wrap(note(DI_TEXT.loading)));
    if (!sheet.open()) return false;
    const mine = token;
    try { await source.prepare(); } catch (e) {
      log('No se pudo abrir el diccionario', e);
      if (!destroyed && mine === token) sheet.setContent(wrap(h('p', { class: 'dictionary__none' }, DI_TEXT.failed), note(DI_TEXT.keep)));
      return true;
    }
    if (!destroyed && mine === token) paintReady(mine);
    return true;
  }

  return Object.freeze({
    open,
    close: () => sheet.close(),
    isOpen: () => sheet.isOpen(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      token += 1;
      sheet.destroy();
    },
  });
}
