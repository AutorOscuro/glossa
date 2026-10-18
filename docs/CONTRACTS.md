# CONTRATOS DE DATOS Y APIs (CONGELADOS) — Sophia Inglés

> Referencia viva. Parte 1: **copia literal de la sección 8 del roadmap v1.3** (no editar; solo el Administrador cambia contratos, ver roadmap 3.4). Parte 2 (al final): **ampliaciones** que cada subparte registra al afinar un detalle (contrato de `data` por tipo de ejercicio, firmas finas de `core/`, etc.).
> Cambiar cualquier cosa de la Parte 1 requiere aprobación del Administrador + migración + subir `schemaVersion`.

---

## CONTRATOS DE DATOS Y APIs (CONGELADOS)

> Cambiar cualquier cosa de esta sección requiere aprobación del Administrador (ver 3.4) + migración + subir `schemaVersion`. Estos contratos se copian a `docs/CONTRACTS.md` en la subparte 0.1.

### 8.1 Convenciones
- **IDs estables y legibles:** `área.tema.subtema` para temas (`gram.present_perfect.for_since`), `área.paquete.nnnn` para ítems (`g.pp.0001`). Minúsculas, `[a-z0-9_.]`, nunca se reutilizan ni se renombran (si hay que cambiar, se crea uno nuevo y se marca el viejo `deprecated`).
- **Prefijos de área:** `gram` (gramática), `vocab` (vocabulario), `verb` (verbos), `phr` (phrasal verbs), `prep` (preposiciones/patrones), `read` (lectura), `listen`, `speak`, `pron`, `write`, `med` (mediación), `spell` (ortografía).
- **Niveles CEFR:** `PreA1, A1, A2, B1, B2, C1, C2`.
- **Fechas:** ISO 8601 en UTC (`2026-10-15T14:00:00.000Z`) para `ts`/`due`; la "fecha de día" local se guarda como `YYYY-MM-DD` según la zona del dispositivo.
- **Idioma del contenido:** inglés americano; explicaciones en español neutro/colombiano.
- **Apóstrofos:** el contenido usa `'` recto; `normalize.js` trata `’` igual.

### 8.2 Tema (`Topic`) — nodo del mapa (en `content/taxonomy/topics.json`)
```json
{
  "id": "gram.present_perfect.for_since",
  "area": "gram",
  "level": "A2",
  "title_es": "Present perfect con for y since",
  "title_en": "Present perfect with for / since",
  "prereq": ["gram.present_perfect.form"],
  "priority": 1,
  "diagnosed_gap": true,
  "theory": {
    "rule_es": "...", "form": "have/has + participio", "use_es": "...",
    "examples": [{"en": "I've lived here for two years.", "es": "Vivo aquí desde hace dos años."}],
    "typical_errors": [{"wrong": "I'm living here since two years.", "right": "I've lived here for two years.", "why_es": "...", "code": "TNS.SINCE_FOR"}],
    "es_contrast_es": "..."
  },
  "min_items": 12,
  "tags": ["transfer_es"],
  "status": "active"
}
```
`prereq` son **sugerencias**, nunca candados. `priority`: 1 (más urgente) a 5.

### 8.3 Ítem (`Item`) — un ejercicio concreto (dentro de paquetes)
```json
{
  "id": "g.pp.0001",
  "type": "fix_error",
  "topics": ["gram.present_perfect.for_since"],
  "level": "A2",
  "facet": null,
  "prompt_es": "Corrige el error en la oración.",
  "prompt_en": "I'm living here since two years.",
  "data": { },
  "accept": ["I've lived here for two years.", "I have lived here for two years.", "I've been living here for two years."],
  "distractors": [{"text": "I live here since two years.", "code": "TNS.SINCE_FOR"}],
  "explain_es": "Con 'for' + duración usamos present perfect...",
  "grammar_note_es": "Si usas have/has + participio, hablas de algo que empezó antes y sigue...",
  "nuance_es": null,
  "situation": "Presentarse con un nuevo vecino",
  "error_codes": ["TNS.SINCE_FOR"],
  "audio": null,
  "image": null,
  "needs_ai": false,
  "source": "original",
  "version": 1
}
```
- `type` ∈ catálogo de 8.9. `data` varía por tipo (ver contrato de cada componente en la subparte que lo construye; se documenta en `docs/CONTRACTS.md`).
- `accept` es la lista de respuestas válidas completas (la normalización de 8.5 se aplica antes de comparar). Para tipos de elección, `data.options` + `data.correct` en vez de `accept`.
- `source` siempre `"original"` (o `"ai_generated_unverified"` para lo creado en vivo por IA).

### 8.4 Tarjeta de repaso (`Card`) — estado FSRS por ítem/faceta (store `cards`)
```json
{
  "id": "g.pp.0001#0",
  "itemId": "g.pp.0001",
  "facet": 0,
  "topics": ["gram.present_perfect.for_since"],
  "state": 0,
  "due": "2026-10-16T00:00:00.000Z",
  "stability": 0, "difficulty": 0,
  "reps": 0, "lapses": 0,
  "last_review": null,
  "suspended": false, "leech": false,
  "fav": false,
  "created": "..."
}
```
- `facet`: para verbos, 0=presente, 1=pasado, 2=participio (**una tarjeta por forma**); para el resto, 0.
- `state`: 0 nueva, 1 aprendiendo, 2 repaso, 3 reaprendiendo.
- **Unidad de repaso = el ítem (faceta), NO el tema.**
- **Nivel visible 1–5** (cortes por estabilidad en días; ajustables en `core/srs.js`): L1 < 1 d · L2 1–<4 d · L3 4–<21 d · L4 21–<90 d · L5 ≥ 90 d. Etiqueta "Repaso en …" calculada desde `due` (min/h/días/sem/meses/años).
- **Sanguijuela (leech):** ≥ 8 fallos (configurable) → `suspended=true, leech=true` y entra a la lista "Explícamelo en el chat".

### 8.5 Normalización y comparación de respuestas (`core/normalize.js`)
`compare(userText, accept[], opts) → { result: 'correct'|'almost'|'wrong', matched, diff, spellingFlags[] }`
1. Normalización: trim; colapsar espacios; minúsculas; `’`→`'`; quitar puntuación final (`. , ! ?`) salvo que el ejercicio la evalúe; expandir/contraer contracciones de forma **equivalente** (`I've` ≡ `I have`, `don't` ≡ `do not`, `I'm` ≡ `I am`, `won't` ≡ `will not`, `can't` ≡ `cannot`); quitar diacríticos solo en comparación ES.
2. `correct`: coincide exactamente (post-normalización) con alguna respuesta aceptada.
3. `almost`: distancia de **Damerau-Levenshtein ≤ 1** por palabra (máx. 1 palabra con error, palabras de ≥ 4 letras) → se acepta como correcta para el SRS, pero se marca el error ortográfico y se crea una tarjeta `spell`.
4. `wrong`: el resto. No se acepta "casi" si el cambio produce **otra palabra válida distinta** (ej. `bad`/`bed`): en ese caso `wrong` (lista de pares en `content/taxonomy/confusables.json`).
5. El mayúscula de `I` se evalúa como error de mecánica (`MECH.CAP_I`) pero **no** invalida la respuesta.

### 8.6 Evento (`Event`) — inmutable, append-only (store `events`)
```json
{
  "id": "evt_20261015T1400_ab12",
  "ts": "2026-10-15T14:00:00.000Z",
  "day": "2026-10-15",
  "type": "answer",
  "sessionId": "ses_...",
  "cardId": "g.pp.0001#0",
  "itemId": "g.pp.0001",
  "topics": ["gram.present_perfect.for_since"],
  "exerciseType": "fix_error",
  "result": "wrong",
  "rating": 1,
  "ms": 8400,
  "hint": false,
  "dontKnow": false,
  "responseRaw": "I live here since two years",
  "errorCodes": ["TNS.SINCE_FOR"],
  "mode": "mech",
  "channel": "keyboard"
}
```
- `type` ∈ `answer | session_start | session_end | tap_word | ai_call | exam_entry | exam_exit | import | note`.
- `result` ∈ `correct | almost | wrong | skipped | dont_know`. `channel` ∈ `keyboard | voice | tap`.
- **Todo se recalcula a partir de los eventos** (estadísticas, dominio). Nunca se editan; las correcciones son eventos nuevos.

### 8.7 Dominio de un tema (`core/mastery.js`)
`mastery(topicId, now) → { pct: 0..100, band, confidence: 'low'|'mid'|'high', signals: {R,P,U,E}, evidence: n }`
- **R** = retención media estimada (retrievabilidad FSRS) de las tarjetas del tema con ≥ 1 repaso.
- **P** = proporción de acierto en ejercicios de **producción** (escribir/hablar) de los últimos 30 días (ponderar más lo reciente).
- **U** = uso correcto evaluado por IA en escritura/conversación para ese tema (si no hay datos, `null`).
- **E** = tasa de reincidencia de errores relacionados (0 = sin reincidencia, 1 = alta).
- `pct = 100 · (0.35·R + 0.30·P + 0.20·U + 0.15·(1−E))`; si `U` es `null`, los pesos se reparten proporcionalmente entre R, P y E, y la confianza **baja un escalón**.
- `pct = 0` solo si no hay eventos del tema (banda "Sin ver").
- **Confianza:** Baja (< 8 eventos o 1 sola sesión) · Media (≥ 8 eventos y ≥ 2 sesiones distintas) · Alta (≥ 20 eventos, ≥ 3 sesiones en ≥ 7 días y ≥ 2 tipos de ejercicio).
- **Descensos:** 2 fallos seguidos en repaso del mismo ítem, o el mismo error 3 veces en 14 días → el tema no puede mostrar más que el tope de la banda inferior hasta que haya evidencia nueva (la regla aplica un **tope**, no un restar arbitrario).
- Pesos, cortes y topes viven en `core/mastery.config.js` (editables).

### 8.8 Error registrado (`ErrorRecord`) (store `errors`)
```json
{
  "id": "err_...",
  "ts": "...", "day": "2026-10-15",
  "original": "I didn't can to send it",
  "correction": "I couldn't send it",
  "context": "email a profesor",
  "topics": ["gram.modals.can_could"],
  "code": "VRB.CAN_TO",
  "origin": "transfer_es",
  "kind": "systematic",
  "impact": "high",
  "count": 3,
  "source": "app",
  "itemId": null
}
```
- `origin` ∈ `transfer_es | developmental | unknown_pure`. `kind` ∈ `slip | systematic`. `impact` ∈ `low | mid | high`. `source` ∈ `app | chat | ai`.
- Un error dispara: crear/reactivar tarjeta de repaso del tema/ítem, aplicar regla de descenso, y entrar al ranking de "errores top" (frecuencia × impacto).
- **Catálogo inicial de códigos** (`content/taxonomy/error_codes.json`, a completar en 1.6 y C1): `TNS.PP_PS`, `TNS.SINCE_FOR`, `TNS.PERF_FORM`, `VRB.IRREG_REGULARIZE`, `VRB.DOUBLE_PAST`, `VRB.CAN_TO`, `VRB.THIRD_S_OMIT`, `VRB.THIRD_S_EXTRA`, `Q.WORD_ORDER`, `Q.AUX_OMIT`, `Q.INDIRECT`, `GER.INF_AFTER_PREP`, `GER.AVOID_TO`, `GER.STOP_REMEMBER`, `PREP.DEP`, `NEG.DOUBLE`, `SUBJ.OMIT`, `CONN.CONTRAST_BECAUSE`, `CONN.DESPITE_OF`, `FUT.WILL_PLAN`, `FUT.WILL_PAST`, `FUT.AUX_MIX`, `ADJ.SUPERLATIVE`, `ADJ.ADV_CONFUSION`, `ADJ.BORED_BORING`, `ADJ.ORDER`, `ADJ.PLURAL`, `NOUN.COUNT_UNCOUNT`, `NOUN.PLURAL_IRREG`, `CAUS.MAKE_ME_WORKS`, `LEX.FALSE_FRIEND`, `LEX.CALQUE`, `SPELL.GENERAL`, `MECH.CAP_I`, `MECH.EVERYDAY`, `ART.GEO`, `PRON.-ED`, `PRON.-S`, `PRON.CLUSTER`, `PRON.S_CLUSTER`, `PRON.VOWEL`, `PRON.V_B`, `PRON.TH`, `PRON.FINAL_VOICING`, `PRON.R`.

### 8.9 Catálogo de tipos de ejercicio (`type`)
Cada tipo = un componente en `ui/exercises/<type>.js` con contrato `mount(container, item, ctx) → { destroy(), getResponse(), … }` y una función pura `grade(item, response, ctx)` en `core/` o junto al componente (probable con Node). Columnas: **A**=autocalificable sin IA, **IA**=requiere/mejora con IA, **Au**=usa audio.

| Frente | Tipos (`type`) | A | IA | Au |
|---|---|---|---|---|
| Vocabulario | `mcq_en_es`, `mcq_es_en`, `match_pairs`, `cloze_bank`, `unscramble_letters`, `first_letter`, `collocation_fill`, `translate_word`, `def_to_word`, `derive_form`, `odd_one_out`, `categorize`, `pick_fits`, `lightning` (ronda 2 min) | ✔ | — | — |
| Vocabulario (audio) | `spell_from_audio` | ✔ | — | ✔ |
| Vocab. transferencia | `own_sentence_word` | — | ✔ | — |
| Gramática | `choose_correct`, `ab_natural`, `fill_verb`, `order_blocks`, `discover_rule`, `transform`, `keyword_transform`, `join_sentences`, `fix_error`, `fix_paragraph`, `trap_translate` | ✔ | (mejora) | — |
| Gramática transferencia | `own_sentence_grammar`, `explain_rule` | — | ✔ | — |
| Verbos/phrasal/prep | `choose_tense`, `phrasal_meaning`, `particle_pick`, `prep_pick`, `three_forms`, `group_irregulars`, `pronoun_placement`, `formal_synonym`, `own_sentence_verb` | ✔ (último IA) | | |
| Frases/diálogos | `order_blocks`, `build_from_keywords`, `complete_dialogue`, `most_natural`, `order_dialogue`, `register_shift`, `translate_bank`, `translate_free` | ✔ (libre: IA) | | |
| **Tarjeta de lección (Epop)** | `phrase_cloze` (frase ES→EN con hueco; teclado o voz) | ✔ | | ✔ |
| Escucha | `dictation`, `cloze_audio`, `connected_speech`, `minimal_pair_listen`, `listen_comprehension`, `what_did_they_say`, `follow_instruction`, `extensive_listening` | ✔ | | ✔ |
| Habla/pronunciación | `read_aloud_score`, `echo_repeat`, `minimal_pair_speak`, `sound_drill`, `stress_mark`, `rhythm_sentence`, `describe_image_speak`, `voice_chat` | ✔ (Azure) | ✔ | ✔ |
| Lectura | `read_local_q`, `read_global_q`, `read_tfng`, `read_reference`, `order_paragraphs`, `match_headings`, `gap_sentences`, `read_inference`, `summarize_one_line`, `free_read_tap` | ✔ (resumen: IA) | | |
| Escritura | `write_guided`, `write_hidden_goals`, `write_email`, `write_describe_image`, `write_continue_story`, `write_essay`, `write_rewrite`, `write_own_errors` | — | ✔ | — |
| Mediación | `med_summarize`, `med_explain_layperson`, `med_register`, `med_speech_act`, `med_cross_language` | — | ✔ | — |
| Integradores | `detective_errors`, `weekly_mission`, `simulacro`, `daily_session` (son **sesiones**, no ítems: los arma `core/session.js`) | | | |

### 8.10 Paquete de contenido (`Pack`) (`content/packs/<pack_id>.json`)
```json
{
  "schema": 1,
  "pack_id": "gram_perfect_tenses_v1",
  "version": 1,
  "title_es": "Tiempos perfectos (A2-B1)",
  "created": "2026-10-20",
  "authors": "Claude",
  "license_note": "Original",
  "topics": ["gram.present_perfect.form", "gram.present_perfect.for_since"],
  "items": [ /* Item[] */ ],
  "lexicon": [ /* LexEntry[] (opcional) */ ],
  "stories": [ /* Story[] (opcional) */ ]
}
```
- `content/index.json` lista paquetes: `{pack_id, version, path, topics, items_count, size_kb}`.
- **Regla de calidad:** cada tema debe tener ≥ 12 ítems de ≥ 3 tipos distintos (para rotar sin repetir). Todo ítem de elección debe tener distractores basados en errores reales de hispanohablantes (campo `code`).
- Cada paquete se valida con `tools/validate-content.mjs` (1.3) antes de entregarse.
- **Los paquetes se agregan al repo SOLO con `npm run add-pack` (`tools/add-pack.mjs`, 1.3)**, que valida, copia a `content/packs/` y actualiza `content/index.json`. Nadie edita `index.json` a mano.

### 8.11 Entrada léxica (`LexEntry`) (vocabulario)
```json
{
  "id": "vocab.body.knee",
  "lemma": "knee", "pos": "noun",
  "family": "vocab.body", "level": "A1", "band": "1K", "priority": 1,
  "es": ["rodilla"],
  "def_en": "the joint in the middle of your leg",
  "examples": [{"en": "My knee hurts.", "es": "Me duele la rodilla."}],
  "collocations": ["bend your knee"],
  "derivation": [],
  "false_friend_note_es": null,
  "audio": null, "image": null
}
```

### 8.12 Historia (`Story`)
```json
{
  "id": "story.a1.0001", "level": "A1", "title_en": "...", "title_es": "...",
  "topic_tags": ["daily_life"], "grammar_targets": ["gram.present_simple.routines"],
  "vocab_targets": ["vocab.home.kitchen"],
  "segments": [{"id": "s1", "text": "...", "translation_es": "...", "audio": "audio/story.a1.0001.s1.mp3", "new_words": ["..."]}],
  "questions": [ /* Item[] de lectura/escucha */ ],
  "comprehensibility": {"known_pct_estimate": null},
  "source": "original"
}
```

### 8.13 Almacenes de IndexedDB (nombre → clave → índices)
`meta(key)` · `settings(key)` · `cards(id; idx due, itemId, topics*, state)` · `events(id; idx ts, day, cardId, itemId, type, topics*)` · `errors(id; idx day, code, topics*)` · `words(id=lemma; estado `known|learning|unknown`, idx state)` · `generated(id; contenido IA guardado, idx itemId)` · `sessions(id; idx day)` · `plans(day)` · `notes(id)` · `content_cache(pack_id)` · `audio_index(id)`. `schemaVersion` en `meta`. Toda migración es **hacia adelante, sin perder datos**, con prueba.

### 8.14 Puente con el chat (sync) — formato `SOPHIA-EN-SYNC v1`
Texto plano pegable, con bloque JSON delimitado:
```
=== SOPHIA-EN-SYNC v1 ===
tipo: <errores | estado | llevar_al_chat | bitacora>
generado: <ISO>
{ ...JSON... }
=== FIN ===
```
- **App → chat** ("Llevar al chat"): tema, ítem, respuesta del usuario, errores recientes, dominio actual, mensaje de duda.
- **Chat → app** ("Importar"): lista de `ErrorRecord` con `source:"chat"` y (opcional) ajustes de estado de temas; la app valida el JSON, muestra una vista previa y solo entonces importa. Idempotente (reimportar no duplica).
- **Bitácora de texto plano:** resumen legible (fecha, qué se hizo, pendientes, decisiones) para pegar al inicio de un chat.
- **Backup completo:** `sophia-ingles-backup_<fecha>.json` con todos los almacenes, validación de versión al restaurar.

### 8.15 API pública mínima de `core/` (firmas; el detalle se afina y registra en `docs/CONTRACTS.md` en cada subparte)
```
db.open(), db.get(store,key), db.put(store,obj), db.delete(store,key), db.query(store,{index,range,limit}), db.tx(stores,fn), db.exportAll(), db.importAll(data)
events.log(ev), events.byCard(id), events.since(ts), events.countByDay(range)
srs.newCard(itemId,facet,now) , srs.review(card,rating,now) → card', srs.retrievability(card,now), srs.levelOf(card), srs.dueLabel(card,now)
grading.rate({result,ms,hint,dontKnow},baselineMs) → 1|2|3|4
normalize.compare(userText, accept, opts)
mastery.compute(topicId, ctx, now)
session.build({now, minutes, energy, newCap, reviewCap, areas?, topicFocus?, rng}) → SessionPlan
errors.record(rec), errors.top(n, range), errors.byTopic(id)
content.loadIndex(), content.loadPack(id), content.validatePack(pack), content.importPacksToDb()
ai.complete({task, messages, json?, maxTokens, temperature}) → {ok, text|json, error?, cached?}
whitelist.check(text, knownLemmas) → {unknown[], pctKnown}
sync.exportBackup(), sync.importBackup(json), sync.makeChatBlock(kind, payload), sync.parseChatBlock(text)
```

### 8.16 Seguridad y privacidad (contrato)
- CSP en `index.html` (`default-src 'self'`; `connect-src` solo a los hosts de IA/Azure configurados; `media-src 'self' blob:`; sin scripts remotos).
- Claves en el almacén `settings` (IndexedDB), con botón "borrar claves"; nunca se incluyen en backups por defecto (casilla explícita).
- Las grabaciones de voz **no** se guardan por defecto; opcional "guardar las últimas N" solo en local.
- Contenido de IA siempre tratado como **no confiable** (se escapa; JSON se valida con esquema antes de usarse).
- La app no envía datos de aprendizaje a ningún servidor propio (no hay backend).


---

# PARTE 2 — AMPLIACIONES POR SUBPARTE

> Formato por entrada: `## <id subparte> — <tema> — v<x.y.z> — <fecha>` y debajo el detalle (firma exacta, tipos, errores, ejemplos). Una ampliación **afina** un contrato; si lo **contradice**, es un cambio de contrato y pasa por el Administrador (roadmap 3.4) antes de escribirse aquí.

## 0.2 — Convenciones de herramientas de calidad — v0.2.0 — 2026-10-15

- **Marca de pendiente en código:** `MARCA(<id>)`, donde `<id>` es una subparte (`2.3`) o un lote de contenido (`C3`). Cualquier otra forma la rechaza `tools/audit.mjs`.
- **API de `tools/audit.mjs`:** `audit(root) → { findings: { file, line, rule, message }[], filesScanned }`. Reglas: `EVAL`, `NEW_FUNCTION`, `DOCUMENT_WRITE`, `CONSOLE_LOG`, `DEBUGGER`, `TODO_SIN_ID`, `LOCAL_STORAGE`, `HTML_INTERPOLADO`, `CLAVE`, `ARCHIVO_LARGO`, `IMPORT_ROTO`, `IMPORT_SIN_EXPORT`, `JSON_INVALIDO`, `ID_DUPLICADO`, `LECTURA`, `RAIZ`.
- **API de `tools/check-structure.mjs`:** `checkStructure(root) → { ok, problems[] }`.
- **Ayudantes de prueba** (`tests/_helpers.mjs`): `makeClock`, `makeRng`, `makeItem`, `makeCard`, `makeEvent`, `resetFactories`, `makeMemoryDb`, `makeTempRepo` (firmas y comportamiento documentados en el encabezado del archivo).
- **Comandos:** `npm test` (= `node --test`), `npm run audit`, `npm run check`.

## 0.4 — Shell, router, vistas y DOM seguro — v0.4.0 — 2026-10-16

- **Rutas (hash):** `#/hoy` `#/mapa` `#/practicar` `#/errores` `#/mas` `#/sesion/:id` `#/tema/:id` `#/ajustes` `#/404`. `resolveHash(hash) → { name, path, params, query, tab, title, requested?, redirect? }` (pura, nunca lanza); `buildHref(name, params?) → '#/…'` (codifica; lanza si falta un parámetro); `createRouter({ win, onChange, log? }) → { start, stop, navigate(name, params?), current }`.
- **Vistas:** `createView(setup, { log? }) → () => { mount(root, params?, services?), destroy(), listenerCount() }`. `ctx = { root, params, services, alive(), on(el, type, fn, opts), later(fn, ms), cleanup(fn) }`. `services = { toast, version, navigate }`. `destroy()` es idempotente y nunca lanza.
- **DOM seguro (`ui/dom.js`):** `h(tag, props?, ...hijos)`, `hs` (SVG), `h.with(doc)`, `esc(valor)`, `on(el, tipo, fn, opts) → off`, `qs`. `h` lanza con props `html/innerHTML/outerHTML/srcdoc`, atributos `on*` con texto y URLs `javascript:`/`vbscript:`/`data:text/html`.
- **Componentes:** `createBottomNav({ doc? }) → { el, setActive(tab|null), destroy() }`; `createToaster({ doc?, container, max=3, duration=4000, timers? }) → { show(kind, mensaje, { duration? }), dismissAll, destroy }`; `formatErrorDetail(error, { version, route, now })` y `renderErrorScreen({ doc?, error, version, route, now, onRetry, clipboard?, log? })`.
- **Arranque:** `startApp({ doc, win, version, views?, log?, timers? }) → { router, toast, show(match), showError(error), destroy() }`. Tema inicial: `?tema=` válido o sugerencia de `prefers-color-scheme` (`app/theme.js`).

## 0.5 — Biblioteca de componentes UI — v0.5.0 — 2026-10-16

Ampliación (no modifica la Parte 1). Contrato común de `ui/components/*.js`:

- `createX({ …opciones, doc?, win?, timers?, now? }) → { el, …métodos, destroy() }`. `destroy()` es idempotente y no deja listeners, temporizadores ni capas abiertas. Props inválidas lanzan `TypeError` en español (`componente: "prop" …`).
- Importación única: `ui/components/index.js`. Texto de usuario/contenido/IA siempre entra como texto (nunca HTML).
- `createModal(...).open()` y `createConfirmDanger(...).open()` devuelven `Promise<boolean>` (true = confirmó; Esc, fondo, cancelar y `destroy()` = false).
- `createWordDiff({ words })`: `words` = `string | { text, status }`, `status ∈ correct|almost|wrong|missing` (alias aceptados: ok/green · near/amber/close · bad/red/incorrect · absent/gap). **1.2 (`normalize.wordDiff`) debe devolver este formato o un adaptador**; pendiente de confirmación del Administrador.
- `createProgressBar`: modo valor (`value/max`) o pasos (`current/total`, texto "X/N"); `setMascot(nodo)`.
- `createTextInput({ mode: 'exercise' })`: `autocapitalize=off autocorrect=off autocomplete=off spellcheck=false enterkeyhint=done lang=en`. Todas las pantallas de ejercicio deben usarlo para respuestas.
- `createSlider({ stops })`: `getValue()` devuelve el `value` real del salto, no su posición.
- Orden de estilos: `tokens → themes → base → components → widgets`.

## 0.6A — PWA: caché, service worker y manifest (mitad A) — 2026-10-17

Ampliación (no modifica la Parte 1).

- **Caché del shell:** `sophia-shell-<VERSION>-<hash8>` (`app/versionCompare.js: cacheVersionName/parseCacheVersion`). Las cachés `sophia-packs-v1` y `sophia-audio-v1` sobreviven a las actualizaciones del shell.
- **`asset-manifest.json`** `{ schema: 1, version, cacheVersion, files: [{ path, hash, size }] }`, generado por `npm run build`; determinista. Lo lee `sw.js` al instalar.
- **Mensajes app ↔ SW:** la app envía `{ type: 'SKIP_WAITING' }` (activar la versión que espera) o `{ type: 'GET_VERSION' }`; el SW responde `{ type: 'VERSION', cacheVersion }`.
- **Qué intercepta el SW:** solo GET del mismo origen y dentro de su carpeta. Nunca otros orígenes (APIs de IA/Azure), ni `Range`, ni `sw.js`/`asset-manifest.json`.
- **Para las demás subpartes:** (1) tras tocar archivos del shell, `npm run build`; (2) los packs de contenido viven en `content/packs/` y se actualizan solos (stale-while-revalidate); (3) el audio va en `audio/` (7.x, tope de 60 entradas en caché); (4) rutas SIEMPRE relativas (la app puede servirse desde una subcarpeta de GitHub Pages).

## 0.6B — Registro del service worker y aviso de actualización — 2026-10-17

Ampliación (no modifica la Parte 1).

- **`app/swRegister.js`:** `swPolicy({hostname, search}) → {enabled, cleanup, reason}` y `registerServiceWorker({win, notice, toast?, log?, timers?, now?}) → Promise<{status: 'unsupported'|'disabled'|'registered'|'failed', destroy()}>`.
- **Modo desarrollo:** SW apagado en localhost/127.x/::1; `?sw=off` apaga, `?sw=on` fuerza.
- **`ui/components/updateNotice.js`:** `createUpdateNotice({doc?, container}) → {show({message, actionLabel, dismissLabel?, onAction, onDismiss?}), hide(), isVisible(), destroy()}`.
- **`startApp`** devuelve además `toastStack` (contenedor de avisos).
- **Para las demás subpartes:** no registren otro service worker ni recarguen la página por su cuenta; para avisar de algo persistente usen `createUpdateNotice`, para lo pasajero `services.toast`.

## 0.7A — Almacenamiento: contrato, motor en memoria, migraciones, reloj, azar y store — 2026-10-17

Ampliación (afina 8.13 y 8.15; no los contradice). Mitad A de la 0.7: todo lo probable con Node. El motor de IndexedDB real (`core/db.idb.js`) llega en la mitad B y debe pasar **la misma** suite (`tests/_dbContract.mjs`).

- **API de un motor** (todo devuelve Promesa): `open() → {schemaVersion, migratedFrom|null, persistent}` (idempotente) · `close()` · `get(store,key) → registro|null` · `put(store,registro) → key` (sobrescribe) · `delete(store,key) → boolean` · `query(store,{index?,value?,range?:{gt|gte,lt|lte},direction?:'next'|'prev',limit?}) → registro[]` · `count(store,{index?,value?,range?})` · `tx(stores[], async (t)=>…)` con `t={get,put,delete,query,count}` · `exportAll({includeSecrets?})` · `importAll(data,{mode:'replace'|'merge',keepSecrets?})`.
- **Claves:** texto no vacío (`keyPath` de cada almacén, 8.13). `meta.schemaVersion` es **reservada** (se lee; escribirla o borrarla da `RESERVED_KEY`).
- **Consultas:** orden por clave de índice (o primaria sin índice) y, en empate, por clave primaria; `prev` invierte ambos. Orden de claves como IndexedDB (números antes que textos). Un registro sin el campo, o con `null`/booleano/objeto, **no entra al índice** pero sí a la lista general. Índice `multi` (`topics`): un registro aparece por cada valor y **una sola vez** en un rango. Opciones desconocidas, índices inexistentes, `value`+`range`, `limit` negativo/decimal → `BAD_QUERY` (`count` no acepta `limit` ni `direction`). `limit: 0` devuelve `[]`.
- **Copias:** los motores guardan y devuelven copias (`structuredClone`); mutar lo devuelto o lo entregado no cambia lo guardado.
- **Transacciones:** una a la vez (cola FIFO; también `put`→`get` sin `await` respeta el orden). Dentro de `fn` se usa **solo `t`** (llamar a `db.put` desde dentro esperaría a la propia transacción). `t` solo toca los almacenes declarados (`TX_SCOPE` si no) y deja de servir al terminar. Si `fn` lanza: no se escribe nada y se propaga **ese mismo error**. Lo escrito dentro se ve dentro (leer-lo-escrito) y fuera solo al confirmar. En IndexedDB, dentro de `fn` no se debe esperar nada que no sea de la propia transacción (temporizadores, `fetch`).
- **Errores:** siempre `DbError` (`core/dbErrors.js`) con `code`, `message` técnico, `friendly` (español amable), `retryable`, y a veces `store`, `cause`, `problems`. Códigos: `UNAVAILABLE NOT_OPEN CLOSED UNKNOWN_STORE BAD_RECORD BAD_KEY BAD_QUERY RESERVED_KEY TX_SCOPE QUOTA ABORTED BAD_IMPORT MIGRATION NEWER_VERSION BLOCKED UNKNOWN`. `classifyError(rawError, {store?})` traduce errores de IndexedDB (`QuotaExceededError`→`QUOTA`, `DataCloneError`→`BAD_RECORD`, `VersionError`→`NEWER_VERSION`, `AbortError`→`ABORTED`…) y nunca lanza.
- **Esquema:** `STORES` (core/db.js) = 8.13 en forma `{keyPath, indexes:{nombre:{path, multi?}}}`; `SCHEMA_VERSION = 1`. `validateSchema`, `compileQuery`, `runQuery`, `indexKeys`, `compareKeys` son puras y compartidas por los motores.
- **Migraciones** (`core/migrations.js`, puras): paso = `{to:n, description, transform?:{almacén:(registro)=>registro|null}}`, consecutivos desde la v2. `runMigrations(data,{from,to,migrations,keyPathOf})` devuelve una copia. Índices y almacenes nuevos salen del esquema de la versión nueva, no del paso. `MIGRATIONS` real = `[]` (la v1 es el esquema inicial). Si un paso falla: `open()` rechaza con `MIGRATION` y los datos viejos quedan **intactos**. Datos más nuevos que el código: `NEWER_VERSION`, sin tocar nada. Una migración que necesite lógica entre almacenes es un cambio de contrato (roadmap 3.4).
- **Respaldo:** `exportAll()` → `{format:'sophia-ingles-db', schemaVersion, exportedAt (ISO del reloj), stores:{todos los almacenes, registros ordenados por clave}}`; sin `meta.schemaVersion`; sin registros de `settings` con `secret: true` salvo `includeSecrets` (**0.8 debe marcar la clave de IA con `secret: true`**). `importAll` valida TODO antes de escribir (`BAD_IMPORT` con `problems`, máx. 20, o `NEWER_VERSION`), migra respaldos viejos a la versión actual y es atómica. `replace` (por defecto) vacía solo los almacenes que trae el respaldo y conserva las claves secretas actuales que no trae (`keepSecrets`, por defecto sí); `merge` sobrescribe por clave sin vaciar. Se ignora `meta.schemaVersion` del respaldo.
- **`core/db.memory.js`:** `createMemoryDb({schema?, schemaVersion?, migrations?, disk?, clock?, onWrite?})`; `createMemoryDisk()` simula el medio persistente (dos instancias con el mismo `disk` comparten datos; sirve para reabrir y migrar); `memoryDiskSnapshot(disk)`; `db.setWriteHook(fn)` (fn recibe `{op, stores, writes}` y puede lanzar para simular cuota llena). `open()` devuelve `persistent:false` (no sobrevive a recargar la página): es también el modo "solo memoria" de emergencia.
- **`core/clock.js`:** **`now` es un objeto `Date`**; lo guardado son cadenas ISO UTC (`…Z`); `day` es el día LOCAL `AAAA-MM-DD`. `toDate`, `toIso`, `localDay`, `addDays`, `createClock(fuente?) → {now, nowMs, iso, day}`, `systemClock`. Ninguna función de `core/` llama a `Date.now()` por su cuenta.
- **`core/rng.js`:** `createRng(semilla)` (determinista, igual que `makeRng` de las pruebas) y `systemRng`: `next`, `int(min,max)` inclusivo, `pick`, `shuffle` (copia).
- **`core/store.js`:** `createStore(inicial, {onError?}) → {get, set(parche|fn), reset, subscribe(fn,{select?}), subscriberCount}`. Estado congelado; avisa solo si algo cambió; un suscriptor que falla no impide avisar a los demás; `set` dentro de un aviso se encola.

## 0.7B1 — Motor IndexedDB (`core/db.idb.js`) — 2026-10-17

Ampliación (no cambia el contrato de la 0.7A). `createIdbDb({ name, schema?, schemaVersion?, migrations?, clock?, factory? })` devuelve el mismo objeto que `createMemoryDb` (sin `setWriteHook` ni `disk`), con `kind: 'indexeddb'`; `open()` devuelve `persistent: true`.
- Sin `indexedDB` disponible, `open()` rechaza con `UNAVAILABLE` (la decisión de caer a memoria con aviso es de la B2).
- `BLOCKED` si otra conexión impide la actualización más de 3 s.
- Regla de IndexedDB: dentro de `tx(...)` no esperar nada ajeno a la transacción (timers, `fetch`); si no, el navegador la cierra y falla con `ABORTED`.
- Un almacén del esquema que falte en una base de la misma versión da `MIGRATION` (no se repara solo).
- Se prueba con `python3 tools/idb-check.py` (Chromium real); no forma parte de `npm run check`.

## 0.8-1 — Ajustes (`core/settings.js`) — 2026-10-17

Ampliación (no cambia 8.13). Almacén `settings`: `{ key, value }` y, para claves, `{ key, value, secret: true }`.
`createSettings({ db?, onError? })` → `load() · get(k) · set(k,v) · setMany({…}) · reset(k) · resetAll() · clearSecrets() · onChange(k, fn) · onAnyChange(fn) · snapshot() · hasSecret(k) · describe(k) · keys() · persistent()`.
Ajustes: `theme` (auto|aurora|neo|claro), `textSize` (small|normal|large|xlarge), `retention` (0,80–0,95; 0,90), `dailyReviewCap` (10–500; 100), `dailyNewCap` (0–50; 10), `leechThreshold` (3–20; 8), `spellingTolerance`, `sounds`, `vibration`, `aiMode` (auto|mechanical), `aiProvider` (groq), `aiModel` (texto; vacío), `aiKey` (secreto), `azureRegion`, `azureKey` (secreto; "se activa en la Fase 8"), `userName` (≤ 40), `onboardingDone`.
Errores: `SettingsError` con `code` `UNKNOWN_SETTING` | `BAD_SETTING` y `friendly`; los de guardado son `DbError`. `set` devuelve `false` si ya valía eso. `setMany` es todo o nada.

## 0.8-2A — Campo de clave y apariencia en vivo — 2026-10-17

Ampliación (no cambia 8.13). Sin cambios en `core/settings.js`.
- `createKeyField({ label, saved?, hint?, placeholder?, disabled?, text?, onSave(valor) → Promesa, onClear() → Promesa, doc? }) → { el, input, getValue, isSaved, setSaved, setDisabled, setError, focus, destroy }`. La pantalla pasa `onSave: (v) => settings.set('aiKey', v)` y `onClear: () => settings.set('aiKey', '')` (o `clearSecrets`). Los rechazos con `friendly` (p. ej. `SettingsError`, `DbError`) se muestran tal cual; cualquier otro error da un texto genérico.
- `createAppearance({ doc, win, settings, log? }) → { apply(), destroy() }`, `resolveTheme(elección, win)`, `applyTextSize(doc, tamaño)`, `TEXT_SIZES`.
- `startSettings({ storageReady, doc, win, log? }) → Promesa<{ settings, appearance }>` (nunca rechaza). `main.js` publica `services.settingsReady`, `services.settings` y `services.appearance`; las vistas hacen `await services.settingsReady` (y `services.settings` puede estar solo en memoria si `services.db` es null).
- DOM: `<html data-theme="aurora|neo|claro">` (lo escribe `applyTheme`) y `<html data-text-size="small|normal|large|xlarge">`.

## 0.8-2B — Pantalla de ajustes (`ui/views/settings.js`) — 2026-10-17

Ampliación (no cambia 8.13). Vista `ajustes` (ruta `#/ajustes`, sin cambios). Usa `ctx.services`: `version`, `storageReady`, `settingsReady` y `settings`; sin ajustes disponibles muestra un mensaje amable. Solo llama `settings.set` (y `hasSecret` para el estado de las claves); no escribe en `localStorage` ni en la consola valores de ajustes.

## 0.8-3A — Respaldo y herramientas de datos (`core/sync.js`, `app/dataTools.js`) — 2026-10-17

Ampliación (no cambia 8.13 ni el formato de la base). **`core/sync.js` es provisional**: la 1.12 lo amplía (puente con el chat, `SOPHIA-EN-SYNC v1`) y conserva estos nombres.
- `createSync({ db, clock? }) → { exportBackup({ includeSecrets? }), importBackup(text, { mode?, keepSecrets? }) }`. `exportBackup` → `{ json, filename, counts }` (solo `includeSecrets === true` exacto incluye las claves). `importBackup` → `{ stores, migratedFrom, total }`; valida antes de tocar nada (`BAD_IMPORT`, `NEWER_VERSION`); por defecto reemplaza y conserva las claves del dispositivo. Sin `db` lanza `UNAVAILABLE`. `backupFilename(date)` → `sophia-respaldo-AAAA-MM-DD.json`. Tope de texto: `MAX_BACKUP_CHARS` (50 millones).
- `createDataTools({ db?, settings }) → { clearKeys(), wipeAll(), afterRestore() }`. `wipeAll` borra todos los almacenes en una sola transacción (atómica; conserva solo lo reservado del motor) y recarga los ajustes (valores por defecto, en vivo). Sin `db` solo restablece los ajustes en memoria. `afterRestore` recarga los ajustes tras importar.

## 0.8-3B — Tarjetas de datos en Ajustes (`ui/views/settingsData.js`, `app/fileIO.js`) — 2026-10-17

Ampliación (no cambia 8.13). La pantalla `#/ajustes` pasa a 9 tarjetas: Apariencia, Repaso, Sonido y vibración, Inteligencia artificial, Pronunciación (Azure), **Respaldo**, **Claves**, Acerca de, **Zona de peligro**.
- `buildDataCards({ ctx, settings, db, sync, tools, io, toast, track, refreshers }) → { backup, keys, danger }`. Un solo trabajo a la vez; si falla, aviso `danger` con `friendly` y nada queda a medias. Sin `db`, Exportar/Importar deshabilitados con aviso.
- `createFileIO({ doc?, win? }) → { download(filename, text, mime?), pickFile({accept?}) → {name,text}|null, destroy() }`.
- `settings.js` acepta servicios opcionales para pruebas: `services.sync`, `services.dataTools`, `services.fileIO`, `services.toast` (si no están, crea los reales). `services.db` se lee de `storageReady`.
- Confirmaciones: Importar y Borrar claves usan `createModal` (danger); Borrar todo usa `createConfirmDanger` (frase `BORRAR`).

## 0.8-4A — Vista de bienvenida (`ui/views/onboarding.js`) — 2026-10-17

Ampliación (no cambia 8.13). Vista creada sin ruta ni cableado; la mitad B (4B, abajo) los pone. Exporta `ONBOARDING_STEPS` (3), `ENERGY_KEY` (`'energyCheck'`) y `NAME_MAX` (40).
- Usa `ctx.services`: `settings` (o `settingsReady`), `storageReady`/`db`, `navigate`, `clock?`. Sale al terminar o saltar con `navigate('hoy', undefined, { replace: true })` (desde 4B; antes `navigate('hoy')`).
- Al terminar o saltar: `settings.setMany({ onboardingDone: true, userName })` (todo o nada). `userName` solo se guarda si cabe en `NAME_MAX`.
- Energía (opcional): `meta.energyCheck = { key: 'energyCheck', value: 'low'|'mid'|'high', at: ISO }`. **Vocabulario fijado por el Administrador** (2026-10-17; antes `medium`). Quien lea este valor (3.4, 1.8) debe ignorar cualquier otro. Si guardarla falla, no bloquea.
- Si faltan los ajustes: tarjeta amable con botón "Ir a Hoy".

## 0.8-4B — Ruta de bienvenida, primer arranque y "Repetir bienvenida" (`app/firstRun.js`) — 2026-10-17

Ampliación (no cambia 8.13). Cierra la 0.8.
- **Ruta nueva:** `{ name: 'onboarding', path: '/bienvenida', tab: null, title: 'Bienvenida' }` en `ROUTES` (ahora 10 rutas; las 9 del roadmap más esta) y `VIEWS.onboarding` en `app/shell.js`. `buildHref('onboarding')` = `#/bienvenida`. Sin pestaña activa.
- **`router.navigate(name, params?, { replace }?)`:** con `{ replace: true }` reemplaza la entrada actual del historial (`history.replaceState` + resolver a mano, porque `replaceState` no dispara `hashchange`). Sin opciones se comporta igual que antes. `services.navigate(name, params, options)` del shell reenvía las opciones.
- **`startFirstRun({ settingsReady, router, initialHash, log? }) → Promesa<motivo>`** (nunca rechaza): espera `settingsReady`; si `onboardingDone` es falso, el hash con que se abrió la app era la "puerta de entrada" (vacío, `#/`, `#/hoy`) y la ruta actual sigue siendo `hoy`, hace `router.navigate('onboarding', undefined, { replace: true })`. Motivos: `redirected`, `skipped:done`, `skipped:deep-link`, `skipped:moved`, `skipped:no-settings`, `skipped:again`. Se decide **una sola vez por carga**. `isFrontDoor(hash)`. `resetFirstRunForTests()` solo para pruebas.
- **`app/main.js`:** guarda `window.location.hash` ANTES de `startApp` (el router lo normaliza) y llama a `startFirstRun` justo después de asignar `services.settingsReady`.
- **`ui/views/settings.js`:** pasa a 10 tarjetas (nueva **Bienvenida**, entre Claves y Acerca de) con el botón "Repetir bienvenida" → `services.navigate('onboarding')` (se lee al tocar, no al montar).
- **Tras "Borrar todo":** `onboardingDone` vuelve a falso pero NO se redirige al instante; la bienvenida sale al reabrir la app (ver `DECISIONS.md`).

## 1.1-1 — Esquema de eventos (`core/eventSchema.js`) — 2026-10-17

Ampliación (afina 8.6; no lo contradice ni cambia 8.13). Parte pura; `core/events.js` (cuartos 2–3) la usa para registrar y consultar.
- **`validateEvent(input, { stored? }) → { ok, value } | { ok:false, problems:[{ path, message }] }`.** Nunca lanza. `stored=false`: entrada de `log()`: `id` y `day` NO se envían, `ts` es opcional. `stored=true`: evento guardado (respaldos): exige `id` (`evt_AAAAMMDDTHHMM_` + `[a-z0-9]{4,}`), `ts` y `day` (`AAAA-MM-DD`). `value` es una copia con los 18 campos de 8.6 en orden estable. Se rechaza todo campo fuera de 8.6.
- **Formas:** `ts` = ISO UTC con milisegundos y `Z`, fecha real, sin límites de rango. `itemId`/cada tema = `[a-z0-9_.]{1,100}`; `cardId` = `<itemId>#<faceta>` y debe empezar por el `itemId` si ambos vienen; `sessionId` = `[A-Za-z0-9_.-]{1,80}`; `exerciseType` = `[a-z][a-z0-9_]{0,39}` (el catálogo lo fija 1.3); `errorCodes` = `MAYÚSCULAS.CÓDIGO` (admite `PRON.-ED`); `rating` entero 1–4; `ms` 0–86.400.000 (se redondea); `responseRaw` ≤ 2.000 caracteres, sin caracteres de control salvo tab/salto de línea; máx. 20 temas y 20 códigos (los repetidos se reducen).
- **Enumerados:** `type` (9 de 8.6), `result` (5), `channel` (3) según 8.6. **`mode` ∈ `mech | ai` (confirmado por el Administrador;** 8.6 no lo enumera).
- **Obligatorios por tipo** (8.6 no los fija; confirmados por el Administrador, sin campo `data`): `answer` → `itemId, topics (≥1), exerciseType, result, mode, channel`; `session_start`/`session_end` → `sessionId`; `tap_word`/`note` → `responseRaw`; `exam_entry`/`exam_exit` → `topics (≥1)`; `ai_call`/`import` → ninguno. Opcionales: por defecto `null`, `[]` o `false`.
- **Coherencia:** `dontKnow` verdadero ⇔ `result === 'dont_know'` (se deduce si no se envía).
- **`buildEvent(input, { now: Date, idGen }) → Event`** (lanza `EventError`, `code: 'BAD_EVENT'`, con `problems` y `friendly`): `ts` del reloj si falta; `day = localDay(ts)` (zona del dispositivo en ese instante; si ese día no cabe en `AAAA-MM-DD`, años 0 o 9999, lanza `EventError` en `ts`); `id = idGen.next(ts)`. `validateEvent` lee la entrada una sola vez y nunca lanza.
- **`createIdGenerator({ rng? }) → { next(ts), peek() }`.** ID = `evt_<AAAAMMDDTHHMM UTC>_<contador base 36, ≥4 cifras><3 al azar>`. Único dentro de la instancia; `log()` (cuarto 2) comprueba además contra la base.


## 1.1-2 — Registro de eventos (`core/events.js`, mitad A: `log`) — 2026-10-17

Ampliación (concreta `events.log(ev)` de 8.15; no cambia 8.6 ni 8.13). Las consultas llegan en el cuarto 3.
- **`createEvents({ db, clock?, rng?, idGen? }) → { log }`.** `db` = cualquier motor de `core/db.js` (obligatorio, necesita `tx`); `clock` por defecto `systemClock` (su `now()` da el `ts` si falta); `idGen` por defecto uno nuevo con `rng`.
- **`log(ev) → Promise<evento>`** con los 18 campos de 8.6 (`id` y `day` incluidos; copia independiente). La entrada sigue las reglas de `validateEvent` (1.1-1): `id` y `day` no se envían.
- **Errores:** evento inválido → `EventError` (`code: 'BAD_EVENT'`), sin tocar la base. Fallo de la base → `DbError` con su `code` (`QUOTA`, `ABORTED`, `CLOSED`, `NOT_OPEN`, `UNKNOWN`…) y NO se guarda nada. Un error crudo del motor se clasifica con `classifyError`.
- **Atomicidad e inmutabilidad:** una sola transacción sobre `['events']`; dentro se comprueba que el id no exista y solo entonces se escribe (nunca sobrescribe). Si existe, pide otro id (máx. `MAX_ID_TRIES` = 5; si todos chocan, `DbError` `ABORTED` reintentable).
- **Para la 1.2 (decisión del Administrador, sin adaptador):** `normalize.wordDiff` devuelve `[{ text, status }]`, `status ∈ ok | close | wrong | missing | extra`. La 1.2 AMPLÍA `createWordDiff` (0.5) para entender esos 5 estados directamente: conserva los alias existentes, `wrong`/`missing` pintan como hoy, `extra` (palabra sobrante del usuario) = rojo con texto tachado, y un estado desconocido se ve como `wrong` sin lanzar. Una prueba por estado (incluido el desconocido) y revisión de `tests/scenarios/0.5.md`. La 1.2 anota el cambio aquí en esta Parte 2 y en `DECISIONS.md`.
- **Para la 1.8 / 3.4:** la energía es `low | mid | high`; los topes diarios se validan solo como enteros ≥ 0 con un máximo razonable (la política se decide en el piloto M1).

## 1.1-2B — Contrato de `log` sobre cualquier motor — 2026-10-17

Sin cambios de contrato. `events.log` se verifica con la misma suite (`tests/_eventsContract.mjs`, 7 pruebas) sobre el motor en memoria y sobre IndexedDB real (`python3 tools/idb-check.py events`). `createEvents` aún no está cableado en `app/storage.js` ni en `services`: la 2.1 lo creará con `services.db` (que puede ser null).

## 1.1-3A — Consultas de eventos (`byCard`, `byItem`, `byTopic`, `since`) — 2026-10-17

Ampliación (concreta `events.byCard(id)` y `events.since(ts)` de 8.15; no cambia 8.6 ni 8.13). `createEvents(...)` devuelve ahora `{ log, byCard, byItem, byTopic, since }`; `countByDay` y `recentErrorsByCode` llegan en la mitad B del cuarto 3.
- **`byCard(cardId, opts?)`, `byItem(itemId, opts?)`, `byTopic(topicId, opts?)` → `Promise<Event[]>`.** Índices `cardId`, `itemId` y `topics` (multi: un evento sale en la consulta de CADA uno de sus temas, una sola vez).
- **`since(ts, opts?) → Promise<Event[]>`.** `ts` = Date, milisegundos o texto ISO. **Inclusivo**: eventos con `ts` ≥ el dado. Índice `ts`.
- **`opts = { order?: 'asc' | 'desc' = 'asc', limit?: entero ≥ 0 }`.** Orden cronológico por `ts` y, en empate, por `id`; `desc` lo invierte exacto; `limit` se aplica después de ordenar (`{ order: 'desc', limit: 5 }` = los 5 más recientes). Opción desconocida → error.
- **Errores:** argumento no válido → `DbError` `BAD_QUERY`; fallo de la base → `DbError` con su `code` (`CLOSED`, `NOT_OPEN`…). Nunca devuelven "todo" por un argumento mal escrito.
- **Resultados:** copias independientes (modificarlas no cambia lo guardado). Un evento con `cardId`/`itemId` null o sin temas no aparece en esa consulta.
- **Aviso para 1.4, 1.7, 1.9:** `byCard`/`byItem`/`byTopic` leen TODOS los eventos de ese valor y luego ordenan y recortan; son baratas para una tarjeta o un ítem (decenas o cientos de eventos) pero no para un tema muy grande: para estadísticas por rango usar `since`, o `countByDay` (mitad B).

## 1.1-3B — Conteo por día y errores recientes (`countByDay`, `recentErrorsByCode`) — 2026-10-17

Ampliación (concreta `events.countByDay(range)` de 8.15; no cambia 8.6 ni 8.13). `createEvents(...)` devuelve ahora `{ log, byCard, byItem, byTopic, since, countByDay, recentErrorsByCode }`.
- **`countByDay(range) → Promise<{ "AAAA-MM-DD": n }>`** (decisión del Administrador: objeto, no lista). Cuenta **todos** los eventos (cualquier `type`) por su campo `day`, que es el día **LOCAL** del dispositivo en el momento de registrarlos. **No incluye los días sin eventos** (un día vacío no aparece; quien necesite ceros los rellena). Las claves salen en orden cronológico y el objeto es nuevo en cada llamada.
  - `range = { from?, to? }`, ambos **inclusivos**. Cada límite es un día real `"AAAA-MM-DD"` (`"2026-02-30"` se rechaza), un `Date` o milisegundos (estos dos se convierten al día local del dispositivo). Un texto ISO con hora (`"2026-10-14T00:00:00Z"`) se rechaza a propósito: se prestaría a confundir día UTC con día local.
  - `range` es **obligatorio**: `countByDay()` rechaza; `countByDay({})` pide todo el historial a propósito. `from` posterior a `to`, claves desconocidas o tipos raros → `DbError` `BAD_QUERY`.
  - Cuenta por el `day` **guardado**, no lo recalcula desde `ts`: si la persona viaja y cambia de zona, lo ya registrado conserva su día (los eventos son inmutables).
  - Índice `day`, una sola consulta con `range` `gte`/`lte`.
- **`recentErrorsByCode(code, { since, order?, limit? }) → Promise<Event[]>`.** Eventos con `ts ≥ since` cuyo `errorCodes` incluye `code` (comparación **exacta**: ni prefijos ni otra capitalización). `since` acepta Date, milisegundos o texto ISO, es **inclusivo** y es **obligatorio**. `order` y `limit` como en `since` (cronológico por `ts` y luego `id`; `limit` se aplica **después de filtrar y ordenar**, así `{ order: 'desc', limit: 3 }` son los 3 más recientes **con ese código**). Valor por defecto de `order`: `'asc'`, igual que el resto de consultas. `code` vacío o que no es texto → `BAD_QUERY`; un código que no existe devuelve `[]`.
  - **Sin índice de `errorCodes`** (8.13 no lo tiene y no se añade): usa el índice `ts` (igual que `since`) y filtra en memoria. Por eso `since` es obligatorio: sin cota recorrería todo el historial.
- **Errores y copias:** como en 1.1-3A (`BAD_QUERY`, `DbError` de la base, resultados independientes de lo guardado).
- **Coste (medido en este entorno: Node 22, 1 CPU; 50.000 eventos repartidos en 80 días, 625 al día; mejor de 3 intentos por consulta dentro de cada corrida):**

| Consulta | Motor en memoria (4 corridas) | IndexedDB real (Chromium 141, 2 corridas) |
|---|---|---|
| `countByDay` de 14 días (8.750 eventos) | 36–86 ms | 115–189 ms |
| `recentErrorsByCode` con ventana de 14 días (8.750 eventos) | 30–64 ms | 137–177 ms |
| `countByDay({})` — PEOR CASO, los 50.000 eventos | 278–505 ms | 885–1051 ms |
| `recentErrorsByCode` desde siempre — PEOR CASO | 237–616 ms | 885–1016 ms |

  El coste crece de forma **lineal con las filas que hay que leer**, no con el tamaño del historial: el motor devuelve copias de cada fila (contrato de `db.query`), y solo copiar 50.000 eventos con `structuredClone` ya cuesta 180–290 ms en este entorno. Con una ventana de 30 días a este ritmo (18.750 eventos) y un script de perfil aparte (no forma parte de la suite): `countByDay` 92–151 ms y `recentErrorsByCode` 122–227 ms, en memoria. La suite exige **< 200 ms con ventana de 14 días en el motor en memoria**; en IndexedDB real solo documenta el tiempo (mismo criterio que la 0.7); allí la variación entre corridas es grande y la ventana de 14 días llegó a 189 ms, cerca del límite. El **peor caso no cumple 200 ms**: queda documentado, con el resultado exacto comprobado, y consultado al Administrador (ver `DECISIONS.md`, 1.1-3B).
- **Aviso para 1.6, 1.7 y 1.9:** pedir siempre una **ventana** (14 o 30 días) y no el historial entero; para "cuántos eventos hay en total" usar `db.count('events', {})` (5–21 ms con 50.000 en memoria). Los días ya pasados no cambian (eventos inmutables), así que 1.9 puede guardar en memoria los conteos de días cerrados y pedir solo el día de hoy. Tiempos medidos en un ordenador, no en el teléfono.

## 1.1-4A — Inmutabilidad y borrar todo (`clearAll`) — 2026-10-17

Ampliación (concreta "inmutabilidad" de la 1.1 y `events` de 8.15; no cambia 8.6 ni 8.13). `createEvents(...)` devuelve ahora `{ log, byCard, byItem, byTopic, since, countByDay, recentErrorsByCode, clearAll }`, **congelado** (`Object.freeze`).
- **Inmutabilidad:** la API no tiene `update`, `put`, `delete`, `remove` ni nada parecido, y no se pueden añadir después. `log` nunca pisa un evento existente (1.1-2) y todo lo que devuelve son copias. Una prueba compara la lista exacta de claves públicas: añadir una función a `createEvents` obliga a cambiar la prueba y, con ella, este contrato.
- **`clearAll() → Promise<número>`:** borra **todos** los eventos de cualquier tipo en **una** transacción sobre `events` y devuelve cuántos había (0 si estaba vacío; llamarlo dos veces es seguro). Si la base falla (`QUOTA`, `ABORTED`, `CLOSED`…) no se borra nada y rechaza con `DbError`. No toca tarjetas, errores, ajustes, claves ni la versión del esquema. Después, `log` y las consultas funcionan sobre un registro vacío.
- **Relación con la Zona de peligro (0.8):** `wipeAll` de `app/dataTools.js` ya vacía el almacén `events` junto con todo lo demás en su propia transacción; **no usa** `clearAll`. `clearAll` es el borrado de eventos por sí solo (para quien lo cablee: 2.1 crea `createEvents` con `services.db`, que puede ser `null`).
- **Coste (medido; solo documentado, sin límite en la suite):** 10.000 eventos → memoria 88–97 ms; **IndexedDB real (Chromium 141) 6–8 s**. La causa no está en `events.js` sino en `tx.delete` de `core/db.idb.js`, que por cada fila hace `count` y luego `delete` y espera cada petición; `db.importAll` en modo `replace` usa `objectStore.clear()` y no tiene este coste. Con 50.000 eventos serían ≈ 30–40 s (calculado, no medido). `wipeAll` tiene el mismo coste porque borra fila a fila. Arreglarlo de verdad exige una operación `clear(store)` en el motor de base (contrato 8.13/0.7): decisión del Administrador, ver `PROJECT_STATE.md` sección 5.
