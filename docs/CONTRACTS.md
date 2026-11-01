# CONTRATOS DE DATOS Y APIs (CONGELADOS) — Glossa (antes Sophia Inglés)

> Referencia viva. **Estado: contratos v1 congelados** (cierre del HITO M0.5, 1.12-T4, 2026-10-26). Parte 1: **copia literal de la sección 8 del roadmap v1.11** (sha256 `b4a16136…f7725`; no editar; solo el Administrador cambia contratos, ver roadmap 3.4). Parte 2 (al final): **ampliaciones** que cada subparte registra al afinar un detalle (contrato de `data` por tipo de ejercicio, firmas finas de `core/`, etc.).
> Cambiar cualquier cosa de la Parte 1 requiere aprobación del Administrador + migración + subir `schemaVersion`.

---


> **Comparación del cierre del M0.5 (1.12-T4):** Parte 1 contra la sección 8 del roadmap v1.11 línea por línea. Tres diferencias, todas en la copia y ninguna en el contrato: (1) el encabezado ahora lleva el número «8.»; (2) 8.7 gana el bloque «Implementación congelada (1.7-T1 y 1.7-T2)», que la copia de la v1.4 no tenía y cuyo detalle ya está en las fichas 1.7-T1 y 1.7-T2 de la Parte 2; (3) la firma de `mastery.compute` en 8.15 pasa a `createMastery({…}).compute(topicId, now?)`, que es lo que ya fijó la ficha 1.7-T2. La Parte 1 se resincronizó con la sección 8. **Ningún cambio exige modificar la sección 8, así que no hay PROMPT PARA ADMIN.** Detalle en `DECISIONS.md`, sección 1.12-T4. **Repetida el 2026-10-26 (Administrador, B11):** misma conclusión; la sección 8 de la v1.11 ya trae la firma real de `mastery.compute`, así que no hace falta v1.12.

---

## 8. CONTRATOS DE DATOS Y APIs (CONGELADOS)

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

**Implementación congelada (1.7-T1 y 1.7-T2, verificada el 2026-10-23; el detalle vive en `docs/CONTRACTS.md`, fichas 1.7-T1 y 1.7-T2, y las razones en `DECISIONS.md`).** Donde esta lista y el texto de arriba difieran, manda esta lista: concreta lo que el texto dejó abierto.
- **Firma:** `createMastery({ db, events, errors, srs, clock?, config?, u? })` devuelve un objeto congelado `{ compute, bandOf, confidenceOf, combine }`; se usa `compute(topicId, now?)`. Las dependencias inyectadas son el `ctx` de 8.15. `u(topicId, now) → 0..1 | null` es opcional: lo conectará 5.10; sin él, U es `null`. Exporta también `bandOf`, `bandIndex`, `combine`, `confidenceOf` y `masteryToSophiaVal`.
- **Qué devuelve `compute`:** `{ topicId, pct, rawPct, band, label, symbol, confidence, signals: {R,P,U,E}, evidence, caps, detail }`. `band` es el **id** (`unseen | initial | progress | solid | mastered`); `label` y `symbol` salen de `BANDS`. `signals` son números 0–1 o `null` (R, P y U; **E nunca es `null`**: sin reincidencia vale 0). `evidence` = número de eventos `answer` del tema. `caps` = lista de topes activos. `detail` = `{ R: {cards}, P: {attempts}, E: {codes} }` (la evidencia de cada señal; T4 la usa para el desglose).
- **Señal R:** media de la retrievabilidad de las tarjetas del tema con ≥ 1 repaso (suspendidas incluidas), calculada con `srs.retrievability` del **motor activo** (`fsrs` o `simple`). Sin tarjetas con repaso → `null`.
- **Señal P:** acierto en ejercicios de producción de los últimos 30 días; cada evento pesa `0,5^(edad en días / 10)`; `correct` y `almost` valen 1, `wrong` y `dont_know` valen 0, `skipped` no es un intento. «Producción» = ver 7.12. Sin intentos → `null`.
- **Señal E:** por cada código recurrente (≥ 3 veces en 14 días, regla de la 1.6, vía `errors.recurrent({ by: 'code', topic, now })`) aporta `min(1, (veces − 2) / 4)`; los aportes se unen como probabilidades: `E = 1 − Π(1 − aporte)`. No pondera por impacto (esas filas no traen `impact`).
- **`pct`:** `Math.round` de la combinación; la **banda se calcula sobre el entero** (29,5 → 30). `pct = 0` **solo** si el tema no tiene eventos `answer`; con respuestas el mínimo es 1; con R, P y U `null` vale 1. Un evento con varios `topics` cuenta en cada uno de ellos. Cuando falta cualquier señal (R, P o U), sus pesos se reparten en proporción entre las que están.
- **Confianza (`low | mid | high`):** sesiones por `sessionId`; los eventos `answer` sin `sessionId` (no es obligatorio en ese tipo, ver 8.6) se agrupan **por día local** como una sesión. Si U es `null` baja un escalón, así que **«Alta» es inalcanzable hasta que 5.10 conecte U** (la confianza máxima será «Media»). La interfaz (3.1) debe mostrar siempre el % junto a la confianza: con una sola respuesta correcta y la tarjeta recién repasada, un tema puede llegar a «Dominado» con confianza «Baja».
- **Topes:** `caps` con `kind: 'consecutive_fails'` (`key` = tarjeta o ítem) o `kind: 'recurrent_error'` (con `code` e `inWindow`). «2 fallos seguidos» = los dos últimos intentos calificados de la misma tarjeta (`skipped` no cuenta, `almost` no es fallo). «Evidencia nueva» que levanta el tope = un acierto posterior (fallos seguidos), o un acierto del tema posterior a la última aparición del error / pasar los 14 días (error recurrente). Con tope activo, `pct = min(rawPct, máximo de la banda inferior)`; desde «Inicial» o «Sin ver» el % no cambia, pero los topes se listan igual.
- **`masteryToSophiaVal(pct)`** = `round(pct / 25)` recortado a 0–4.
- **Trampa conocida (no es un bug):** la retrievabilidad de FSRS justo después de repasar con «Otra vez» es ≈ 1, por lo que R **no refleja un fallo reciente** (medido: a los 20 días con dos «Otra vez», `stability` 0,10 y R 0,44). Un estudiante que acaba de fallar puede mostrar un % alto; P y los topes lo compensan. Las pruebas de T2 lo tienen en cuenta y las de T4 («estudiante que falla») también deben hacerlo. Con FSRS, al pasar exactamente `stability` días tras un repaso la retrievabilidad es ≈ 0,9 (caso conocido para pruebas).

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
createMastery({db,events,errors,srs,clock?,config?,u?}).compute(topicId, now?) → { pct, band, confidence, signals, evidence, … }   // ver 8.7: aquí el `ctx` son las dependencias inyectadas
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
- **Arranque:** `startApp({ doc, win, version, views?, log?, timers? }) → { router, toast, show(match), showError(error), destroy() }`. Tema inicial: `?tema=` válido o Aurora (`app/theme.js`); desde 0.9.3 no existe el tema `auto` y no se sigue al sistema.

## 0.5 — Biblioteca de componentes UI — v0.5.0 — 2026-10-16

Ampliación (no modifica la Parte 1). Contrato común de `ui/components/*.js`:

- `createX({ …opciones, doc?, win?, timers?, now? }) → { el, …métodos, destroy() }`. `destroy()` es idempotente y no deja listeners, temporizadores ni capas abiertas. Props inválidas lanzan `TypeError` en español (`componente: "prop" …`).
- Importación única: `ui/components/index.js`. Texto de usuario/contenido/IA siempre entra como texto (nunca HTML).
- `createModal(...).open()` y `createConfirmDanger(...).open()` devuelven `Promise<boolean>` (true = confirmó; Esc, fondo, cancelar y `destroy()` = false).
- `createWordDiff({ words })`: `words` = `string | { text, status }`, `status ∈ correct|almost|wrong|missing` (alias aceptados: ok/green · near/amber/close · bad/red/incorrect · absent/gap). **(1.2 lo resolvió sin adaptador: ver 1.2-4A) 1.2 (`normalize.wordDiff`) debe devolver este formato o un adaptador**; pendiente de confirmación del Administrador.
- `createProgressBar`: modo valor (`value/max`) o pasos (`current/total`, texto "X/N"); `setMascot(nodo)`.
- `createTextInput({ mode: 'exercise' })`: `autocapitalize=off autocorrect=off autocomplete=off spellcheck=false enterkeyhint=done lang=en`. Todas las pantallas de ejercicio deben usarlo para respuestas.
- `createSlider({ stops })`: `getValue()` devuelve el `value` real del salto, no su posición.
- Orden de estilos: `tokens → themes → base → components → widgets`.

## 0.6A — PWA: caché, service worker y manifest (mitad A) — 2026-10-17

Ampliación (no modifica la Parte 1).

- **Caché del shell:** `sophia-shell-<VERSION>-<hash8>` (`app/versionCompare.js: cacheVersionName/parseCacheVersion`). Las cachés `sophia-packs-v1` y `sophia-audio-v1` sobreviven a las actualizaciones del shell. *[2.9-T3 punto 2: `sophia-packs-v1` ya no existe; se borra al activar.]*
- **`asset-manifest.json`** `{ schema: 1, version, cacheVersion, files: [{ path, hash, size }] }`, generado por `npm run build`; determinista. Lo lee `sw.js` al instalar.
- **Mensajes app ↔ SW:** la app envía `{ type: 'SKIP_WAITING' }` (activar la versión que espera) o `{ type: 'GET_VERSION' }`; el SW responde `{ type: 'VERSION', cacheVersion }`.
- **Qué intercepta el SW:** solo GET del mismo origen y dentro de su carpeta. Nunca otros orígenes (APIs de IA/Azure), ni `Range`, ni `sw.js`/`asset-manifest.json`.
- **Para las demás subpartes:** (1) tras tocar archivos del shell, `npm run build`; (2) los packs de contenido viven en `content/packs/` y se actualizan solos (stale-while-revalidate) *[sustituido en 2.9-T3 punto 2: van con el shell y suben `cacheVersion]*; (3) el audio va en `audio/` (7.x, tope de 60 entradas en caché); (4) rutas SIEMPRE relativas (la app puede servirse desde una subcarpeta de GitHub Pages).

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
Ajustes: `theme` (aurora|neo|claro; por defecto aurora; `auto` se retiró en 0.9.3), `textSize` (small|normal|large|xlarge), `retention` (0,80–0,95; 0,90), `dailyReviewCap` (10–500; 100), `dailyNewCap` (0–50; 10), `leechThreshold` (3–20; 8), `spellingTolerance`, `sounds`, `vibration`, `aiMode` (auto|mechanical), `aiProvider` (groq), `aiModel` (texto; vacío), `aiKey` (secreto), `azureRegion`, `azureKey` (secreto; "se activa en la Fase 8"), `userName` (≤ 40), `onboardingDone`.
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

### 1.2-1A — `core/normalize.js`: `normalize(text, opts?)` (base)
- `normalize(text, opts?) → string`. Pura, sin dependencias, nunca lanza. Entradas que no son texto (`null`, `undefined`, objetos, `NaN`, `Infinity`, booleanos, símbolos) → `''`; un número finito → su texto.
- Orden: corta a 10.000 caracteres → borra invisibles (U+200B–U+200D, U+2060, U+00AD, U+FEFF) y convierte `’ ‘ ʼ ´ \` ′` en `'` → minúsculas + NFC → todo espacio (tab, salto, NBSP…) pasa a un espacio, se colapsa y se hace trim → quita la puntuación FINAL (`. , ! ? …` y espacios alrededor).
- `opts.keepFinalPunctuation === true` conserva la puntuación final (para ejercicios que la evalúan). Cualquier otro `opts` se ignora.
- Es idempotente: `normalize(normalize(x)) === normalize(x)`.
- El resto del paso 1 de 8.5 (contracciones, `I` minúscula, diacríticos) se registra en 1.2-1B.

### 1.2-1B — `core/normalize.js`: contracciones, `I` minúscula y diacríticos
- `normalize(text, { contractions: 'expand' })`: escribe cada contracción como dos palabras. Esa es la forma CANÓNICA; nunca se "contrae". Aplicada a las dos partes, hace equivalentes `I've`≡`I have`, `don't`≡`do not`, `I'm`≡`I am`, `won't`≡`will not`, `can't`≡`cannot`≡`can not`. Cualquier otro valor de `contractions` (o ninguno) no toca nada.
- Se expanden solo las NO ambiguas: `n't` con `do does did is are was were has have had could should would must need might` (+ `can't`→`cannot`, `won't`→`will not`, `shan't`→`shall not`); `'re` con `you we they who what there`; `'m` con `i`; `'ve` con `i you we they could would should might must who what`; `'ll` con `i you he she it we they that there who what` (→ `will`); `let's`→`let us`.
- **NO se expanden** `'s` (is / has / posesivo) ni `'d` (would / had), ni `ain't`, ni palabras de otros idiomas: no se puede decidir sin adivinar. **Regla para el contenido (1.3):** si una respuesta lleva `'s` o `'d`, el ítem debe listar en `accept` las dos formas (`he's here` y `he is here`).
- `normalize(text, { stripDiacritics: true })`: quita tildes, diéresis y `ñ`→`n`; solo para comparar respuestas en español (`compare` lo activará solo en ejercicios ES; en inglés nunca).
- `expandContractions(text) → string` (exportada): la misma expansión sin el resto de la normalización.
- `hasLowercaseI(text) → boolean` (exportada): hay un `i` suelto en minúscula (`i`, `i'm`, `i've`, `i'll`, `i'd`; acepta `’`). Es el error `MECH.CAP_I` (8.5, regla 5). Se evalúa con el texto ORIGINAL; NO invalida la respuesta (`normalize` iguala `I` e `i`). Falso positivo conocido y aceptado: `(i)` como marcador de lista.
- Orden dentro de `normalize`: … minúsculas+NFC → diacríticos → colapsar espacios/trim → contracciones → puntuación final. Idempotente con cualquier combinación de opciones (fuzz de 1000 cadenas).
- **Lo que debían hacer los cuartos siguientes (`compare` ya está hecho en 1.2-2B):** `compare` (cuarto 2) llama `normalize` con `contractions:'expand'` en las dos partes, con `stripDiacritics` solo en ES y con `hasLowercaseI(userText)` sobre el texto original para marcar `MECH.CAP_I`.

### 1.2-2A — `damerauLevenshtein` (en `core/normalize.js`) y confusables (`core/confusables.js` + `content/taxonomy/confusables.json`)
- `damerauLevenshtein(a, b, max?) → número`: distancia de Damerau-Levenshtein COMPLETA (insertar, borrar, sustituir e intercambiar dos vecinas cuestan 1; no la variante "restringida": `ca`↔`abc` = 2). Cuenta puntos de código (un emoji = 1). Entradas que no son texto cuentan como `''`. Con `max` devuelve `max + 1` en cuanto se supera (más rápido). Más de 200 puntos de código en cualquiera de las dos → `Infinity` (no es una palabra; protege el rendimiento). No lanza nunca. Esta función NO normaliza: `compare` (2B) normaliza antes.
- `content/taxonomy/confusables.json`: `{ "version": 1, "note": "…", "pairs": [["bad","bed"], …] }`, hoy 104 parejas (≥ 60 exigidas; incluye bad/bed, ship/sheep, live/leave, its/it's, your/you're, then/than…). Palabras en minúscula `[a-z]+` con un apóstrofo recto opcional; el orden de cada pareja no importa; sin duplicados. Añadir parejas no exige tocar código.
- `createConfusables(data) → { size, areConfusable(a, b), partners(word) }` (objeto congelado). Con formato inválido LANZA un `Error` en español con la ruta (`confusables › pairs[3]: …`): es un dato del repositorio. `areConfusable` ignora orden, mayúsculas, espacios y `’`; no es transitivo (`bad/bed` y `bad/bid` no implican `bed/bid`); lo igual, lo vacío y lo que no es texto dan `false` sin lanzar. El módulo NO lee archivos: quien lo use le pasa el JSON ya leído (el cargador de contenido de la 1.3 lo hará en la app; las pruebas lo leen con `fs`).
- **Para el cuarto 2B (`compare`, HECHO: ver 1.2-2B):** recibe el detector por `opts.confusables` (resultado de `createConfusables`); si falta, no hay lista y "almost" solo se evalúa con la distancia. Regla 8.5: `almost` = distancia ≤ 1 en UNA sola palabra, de ≥ 4 letras, y nunca si `areConfusable(palabraUsuario, palabraAceptada)`.


### 1.2-2B — `core/compare.js`: `compare(userText, accept, opts?)`
- `compare(userText, accept, opts?) → { result, matched, diff, spellingFlags, errorCodes }`. Pura, sin dependencias de DOM ni de red; importa de `normalize.js`; **nunca lanza** (cualquier valor en cualquier argumento; lo que no es texto cuenta como vacío). Cada llamada devuelve arreglos nuevos.
- **`accept`:** lista de respuestas válidas completas (también vale un solo texto). Se ignoran las entradas que no son texto (los números finitos cuentan como su texto) y las que quedan vacías tras normalizar; se leen como máximo 1000. No se modifica.
- **`opts`** (todo opcional; un `opts` que no es objeto se ignora): `confusables` (resultado de `createConfusables`; si falta o no tiene `areConfusable`, "almost" solo usa la distancia), `lang: 'es'` (quita diacríticos en las dos partes; con cualquier otro valor NO, en inglés nunca), `keepFinalPunctuation: true` (la puntuación final cuenta), `almostAtWordEnd: true` (ver la regla de la última letra; solo el valor `true` la activa).
- **Normalización:** usuario y cada aceptada pasan por `normalize(…, { contractions: 'expand', stripDiacritics: lang === 'es', keepFinalPunctuation })` y después se quita la puntuación INTERIOR (`. , ! ? …` seguida de espacio; decisión del Administrador): una coma o un punto que falte no vuelve mala la respuesta, `Yes I do` ≡ `Yes, I do.` Los apóstrofos y los guiones SÍ cuentan (`dont` ≠ `don't`, `well known` ≠ `well-known`) y un punto o coma pegado a las dos letras vecinas no se toca (`3.5` ≠ `3,5`). Con `keepFinalPunctuation` la puntuación final se conserva. La lógica vive en `core/typo.js` (`readOptions`, `prepare`, `isNearTypo`), que comparten `compare` y `wordDiff`. Las contracciones se comparan ya expandidas (`didn't went` se lee `did not went`).
- **`result`:**
  - `'correct'`: igual tras normalizar con alguna aceptada. `matched` = esa aceptada TAL COMO viene en `accept` (la primera que coincide, y la exacta gana a cualquier "casi" anterior).
  - `'almost'`: mismo número de palabras, difiere UNA sola, y esa pareja cumple todo esto: las dos formas son solo letras con apóstrofos interiores (nada de números, guiones ni puntuación en medio); tienen ≥ 4 letras cada una; la puntuación pegada a la palabra es idéntica; `damerauLevenshtein(…, 1) === 1`; **no** es pareja de `confusables`; y **el cambio no toca la última letra** (las dos palabras acaban en la misma letra). `matched` = la primera aceptada que lo cumple. Si el detector lanza, se asume "confundible" (no se da "casi").
  - `'wrong'`: todo lo demás, y siempre con respuesta vacía. `matched = null`.
- **Regla de la última letra (decisión propia de 2B, CONFIRMADA por el Administrador; más estricta que 8.5):** `work`/`works`, `send`/`sent`, `take`/`taken`, `use`/`used` son otras palabras válidas y errores de GRAMÁTICA, no de tecleo; la lista de confusables no puede cubrirlos todos. Por eso un cambio en la última letra no es "almost". Efecto secundario aceptado: `littl`/`little` o `fomr`/`form` salen `wrong`. Con `almostAtWordEnd: true` pasan a `almost`. **Quien monte tarjetas de ortografía (4.7) y de traducir palabra (2.5) debe pasar `almostAtWordEnd: true`** (decisión del Administrador).
- **`errorCodes`:** `['MECH.CAP_I']` si la persona escribió `i` minúscula como pronombre (`hasLowercaseI` sobre el texto ORIGINAL), y `[]` si no; con `lang: 'es'` no se mira. Se informa con cualquier `result` y **no invalida** (regla 5 de 8.5). Es una clave NUEVA respecto a la firma de 8.5 (que no decía dónde va ese código); se llama como el campo `errorCodes` del evento (8.6).
- **`diff` y `spellingFlags`:** en 2B eran siempre `[]`; desde 3B los llena `compare` (ver 1.2-3B). No se quitó ninguna clave.

### 1.2-3A — `core/wordDiff.js`: `wordDiff` y `alignWords`
- `wordDiff(userText, reference, opts?) → [{ text, status, expected? }]`. Pura, nunca lanza. Alinea las palabras de lo escrito con UNA referencia (un texto; lo que no es texto cuenta como vacío). `opts` = los de `compare` (`lang`, `keepFinalPunctuation`, `confusables`, `almostAtWordEnd`), con las mismas reglas de `core/typo.js`.
- **`status`:** `ok` (coincide) · `close` (error de tecleo "casi", mismas reglas que `almost`; trae `expected`) · `wrong` (otra palabra donde iba `expected`) · `extra` (sobra una palabra escrita) · `missing` (falta una de la referencia; su `text` es la palabra que faltaba). `expected` solo existe en `close` y `wrong`. Es el formato que fijó el Administrador para la 1.2 (1.1-2); el componente `createWordDiff` (0.5) aún no entiende `extra` ni `expected`: es el cuarto 4.
- **`text`** es la palabra NORMALIZADA: minúsculas, contracciones expandidas (`don't` se ve `do not`), sin puntuación interior ni mayúsculas. El cuarto 4 decide si la pantalla muestra la forma original.
- **Orden:** el de lectura. Los elementos `ok/close/wrong/extra` siguen el orden de lo escrito y los `ok/close/wrong/missing` el de la referencia. Las palabras con guion cuentan como una (`well known` frente a `well-known` es `extra` + `wrong`).
- **`alignWords(userText, reference, opts?) → { diff, cost }`:** lo mismo más el coste mínimo de la alineación (programación dinámica): igual 0, `close` 0,5, `wrong` 1,5, `extra`/`missing` 1. En empate se prefiere emparejar, luego `extra`, luego `missing` (determinista). Sirve para elegir la aceptada más cercana (3B).
- **Tope:** se leen 250 palabras por lado (el componente admite 500 elementos); lo que pase se descarta y suma 1 por palabra al coste.
- **Coherencia con `compare` (probada con fuzz de 1000 pares):** `correct` ⇒ todo `ok`; `almost` ⇒ exactamente un `close` y el resto `ok`; `wrong` ⇒ hay algo que no es `ok`.

### 1.2-3B — `compare`: `diff` y `spellingFlags`
- **`diff`:** el de `wordDiff` (1.2-3A) contra UNA referencia, con las mismas `opts` que recibió `compare`. Referencia: `correct` y `almost` → `matched` (la aceptada que coincidió); `wrong` → la aceptada de menor `alignWords(...).cost` (empate: la primera de `accept`; solo se miran las **100 primeras** aceptadas válidas, porque cada alineación cuesta hasta 250 × 250). Se ignoran las aceptadas que no son texto o quedan vacías. `diff` es `[]` solo cuando no hay ninguna aceptada válida. Con respuesta vacía (`wrong`) son todas `missing` de la aceptada más corta. En `wrong` con dos errores de tecleo salen dos `close` en el `diff` y aun así el resultado es `wrong` y `spellingFlags` es `[]`.
- **`spellingFlags`:** `[{ word, expected, index }]`. Para `almost` hay EXACTAMENTE una marca (en `almost` solo difiere una palabra); para `correct` y `wrong` es `[]`.
  - `word`: la palabra que escribió la persona, normalizada (minúsculas, sin diacríticos solo con `lang: 'es'`) y sin la puntuación pegada al final (con `keepFinalPunctuation`).
  - `expected`: la palabra correcta, normalizada y sin puntuación pegada, tomada de `matched`.
  - `index`: posición desde 0 entre las palabras de lo escrito YA normalizadas (una contracción expandida cuenta como dos: en `I don't recieve it` el índice de `recieve` es 3). En `almost` coincide con la posición del único `close` en `diff`.
  - Es lo que usan 2.2 y 2.5 para crear la tarjeta `spell`; el campo `expected` es la clave natural para no duplicar tarjetas. Las tarjetas de ortografía (4.7) y de traducir palabra (2.5) deben pasar `almostAtWordEnd: true` (ver 1.2-2B).
  - No depende del recorte de 250 palabras del `diff`: una errata pasada la palabra 250 sale en `spellingFlags` aunque el `diff` no la muestre.
- **Coherencia (fuzz de 1000):** `correct` ⇒ `diff` todo `ok` y sin marcas; `almost` ⇒ una marca, un solo `close` en `diff` en `diff[index]` con el mismo `text`/`expected`, el resto `ok`, y `diff` igual a `wordDiff(user, matched, opts)`; `wrong` ⇒ hay algo que no es `ok` (o `diff` es `[]` si no hay aceptadas válidas) y sin marcas.
- **Nuevo en `core/typo.js`:** `wordCore(word) → string` (la palabra sin la puntuación pegada al final). Pura, nunca lanza.

### 1.2-4A — `createWordDiff` (0.5) entiende los 5 estados de `wordDiff`
- **Sin adaptador:** `createWordDiff({ words })` acepta tal cual lo que devuelve `wordDiff` (core/wordDiff.js): `[{ text, status, expected? }]`, `status ∈ ok | close | wrong | extra | missing`. Se conservan los alias anteriores (`correct`/`green` · `almost`/`near`/`amber` · `bad`/`red`/`incorrect` · `absent`/`gap`) y se añade `extra` (alias `surplus`). Un texto sin estado sigue siendo `correct`. Máximo 500 elementos (un diff de `compare` con 250 + 250 palabras cabe).
- **`extra`:** palabra que la persona escribió de más. Se pinta rojo con el texto TACHADO (`.word-diff__word--extra`, mismos colores `--danger`/`--on-danger` que `wrong`); `wrong` sigue con subrayado ondulado, `almost` punteado y `missing` con borde punteado: el color nunca es la única señal. Lector de pantalla: `(sobra)`.
- **Estado desconocido (cambio respecto a 0.5, decisión del Administrador):** ya NO lanza; se pinta como `wrong`. El resto de errores claros (`words` no es arreglo, texto vacío, falta `text`, más de 500) siguen igual.
- **`expected`:** solo se conserva en `wrong` y `almost`/`close` (texto, ≤ 200; vacío se ignora). NO se dibuja: lo lee el lector de pantalla (`(no coincide; se esperaba: go)`). El texto de la persona y `expected` se muestran como texto, nunca como HTML.
- **`counts()`** devuelve ahora 5 claves: `{ correct, almost, wrong, missing, extra }` (antes 4). `DIFF_STATUSES` pasa a `['correct', 'almost', 'wrong', 'missing', 'extra']`. `TEXT.wordStatus.extra = 'sobra'` y `TEXT.wordExpected = 'se esperaba'`.
- La leyenda (`showLegend`) incluye el estado `extra`. La galería (`ui/styles/demo-components.js`) lo muestra.

## 1.3-1A — Reglas de contenido y `Topic` (`core/contentRules.js`, `core/contentTopic.js`) — 2026-10-18

Ampliación (concreta 8.1–8.2 y el alcance de la 1.3; no cambia la Parte 1). Puro: sin DOM, base de datos ni archivos. Lo reutilizan Item, Pack, LexEntry y Story (1B), el validador de línea de comandos y `add-pack`: hay una sola implementación.
- **Informe.** `createReport(max?) → { error(path, rule, msg), warn(path, rule, msg), result() }`; `result() → { ok, errors, warnings, errorTotal, warningTotal }`. Cada problema es `{ path, rule, message }`. `ok` ⇔ `errorTotal === 0` (los avisos no invalidan). Se guardan solo los primeros 200 de cada lista (`LIMITS.maxProblems`), pero `errorTotal`/`warningTotal` cuentan todos. `rule` es un código estable; `message`, español sin jerga. `formatProblem(p, file?)` → `archivo › items[12].accept[0]: mensaje` (la raíz se nombra `(raíz)`); `joinPath(base, key)`.
- **Rutas exactas:** `items[12].accept[0]`, `theory.typical_errors[0].why_es`, `topics[3].level`.
- **Especificaciones (datos, no código):** `text(max, {multiline, allowEmpty})`, `int(min, max)`, `bool()`, `oneOf([…])`, `idOf(regex, qué)`, `errorCode()`, `list(spec, {min, max, unique})`, `obj({campo: spec})`, `custom(fn)`, `optional(spec)`, `nullable(spec)` (puede ser `null` o faltar; ausente ≡ `null`). `check(report, path, valor, spec, ctx?)` las recorre. Nunca lanza, ni con getters que fallan, Proxy o `__proto__` (se informa `UNREADABLE` o `UNKNOWN_FIELD`). Un campo `undefined` cuenta como ausente. **Campo desconocido = error** (validación estricta). Una lista solo revisa los primeros `max` elementos.
- **Reglas de texto** (todo texto del contenido). **Errores:** `TYPE`, `TEXT_EMPTY` (vacío o solo espacios), `TEXT_TOO_LONG`, `TEXT_CONTROL` (cualquier carácter de control; el salto de línea solo se permite en campos `multiline`), `TEXT_INVISIBLE` (ancho cero U+200B–200F, direccionales U+202A–202E, U+2060–2064, guion blando U+00AD, BOM U+FEFF: `normalize` los borra y pueden esconder diferencias), `TEXT_HTML` (etiquetas `<b`, `</p`, `<!`, `<?` y entidades `&amp;`, `&#39;`; `a < b` y `Tom & Jerry` son texto normal; `x<y` sin espacio SÍ se rechaza). **Avisos (no invalidan):** `TEXT_SPACES` (espacios al inicio, al final o dobles), `TEXT_CURLY_APOSTROPHE` (`’ ‘ ʼ ´ ` ′`; el contrato 8.1 pide `'` recto, y `normalize` ya los iguala al comparar).
- **Límites** (`LIMITS`): títulos 120, frase 600, explicación 2000 caracteres; listas 50 por defecto; id 100; código de error 60.
- **Otras reglas:** `REQUIRED`, `UNKNOWN_FIELD`, `ENUM`, `RANGE`, `FORMAT`, `LIST_SIZE`, `DUPLICATE`, `UNKNOWN_CODE`. `errorCode()` exige la forma `GRUPO.CÓDIGO` (igual que `core/eventSchema.js`, admite `PRON.-ED`) y, solo si `ctx.errorCodes` (un `Set`) viene, que el código exista.
- **`validateTopic(input, ctx?)` / `checkTopic(report, path, input, ctx?)`** (8.2). Obligatorios: `id`, `area`, `level`, `title_es`, `title_en`, `prereq` (lista, puede ir vacía), `priority` (entero 1–5), `status`. Opcionales con su valor por defecto: `diagnosed_gap` (false), `theory` (null), `min_items` (12; entero 1–200), `tags` (`[]`; hasta 12, `[a-z][a-z0-9_]{0,39}`, sin repetir). `id` = `área.tema[.subtema…]` (`[a-z0-9_]`, ≥ 2 tramos, ≤ 100) y su primer tramo debe ser el `area` (`AREA_MISMATCH`). `area` ∈ las 12 de 8.1; `level` ∈ `PreA1…C2`. `prereq`: ids de tema, hasta 20, sin repetidos y sin el propio id (`SELF_REFERENCE`); que existan y no formen ciclos se comprueba en 3A (necesita ver todos los temas).
- **`theory`** (si viene): `rule_es` obligatorio (multilínea); `examples` obligatorio, lista de `{ en, es }` (hasta 20); `form`, `use_es`, `es_contrast_es` anulables; `typical_errors` opcional, lista de `{ wrong, right, why_es, code? }` con `code` válido. Un tema `active` sin `theory`, o con `examples` vacío, da el AVISO `THEORY_MISSING` (no error).
- **`status` ∈ `active | draft | deprecated` — PROVISIONAL.** 8.2 solo muestra `active`; 8.1 menciona `deprecated`; `draft` = tema sembrado sin contenido todavía (la regla de la 1.3 de "≥ 12 ítems y ≥ 3 tipos" solo aplica a `active`). Pendiente de confirmar por el Administrador (ver `PROJECT_STATE.md`, sección 5).
- **Para 1B:** el validador de Item usa estas mismas piezas (`obj`, `list`, `text`, `errorCode`, …) y un registro de los tipos del catálogo 8.9; `data` se comprueba por tipo en el cuarto 2.


## 1.3-1B — Registro de tipos, Item común, Pack, LexEntry y Story (`core/contentTypes.js`, `contentCommon.js`, `contentItem.js`, `contentPack.js`, `contentLex.js`, `contentStory.js`) — 2026-10-18

Ampliación (concreta 8.3 y 8.9–8.12; no cambia la Parte 1). Puro. Todos devuelven `{ ok, errors, warnings, errorTotal, warningTotal }` como la 1.3-1A, nunca lanzan y no modifican la entrada. Cada uno tiene `validateX(input, ctx?)` y `checkX(report, rutaBase, input, ctx?)` (este escribe en un informe existente: así un paquete anida ítems, léxico e historias con rutas exactas como `items[12].accept[0]` o `stories[0].questions[1].distractors[0].code`).
- **`ctx` (todo opcional):** `errorCodes` (Set de `error_codes.json`), `topicIds` (Set de `topics.json`; si viene, un tema inexistente es `UNKNOWN_TOPIC`), `dataSpecs` (`{ familia: especificación }`, lo aporta el cuarto 2 para comprobar `data`).
- **`core/contentTypes.js`.** `ITEM_TYPES` (congelado): los **85 tipos** de 8.9, cada uno `{ family, auto, ai, audio, acceptRequired }`; la prueba los lee del roadmap, no de un conteo a mano. `FAMILIES` (12): `choice`, `text_input`, `ordering`, `matching`, `cloze`, `transform`, `audio`, `speak`, `reading`, `writing`, `mediation`, `open_ai`. `INTEGRATOR_TYPES`: `detective_errors`, `weekly_mission`, `simulacro`, `daily_session`. Funciones: `typeInfo(t)` (null si no es ítem; no se deja engañar por `constructor`/`__proto__`), `isItemType`, `isIntegratorType`, `typesOfFamily(f)`, `suggestType(t)` (el tipo más parecido a ≤ 2 ediciones, o null). Banderas = columnas A / IA / Au de 8.9: `auto` (se califica sin IA; habla = sí, por Azure), `ai` (requiere o mejora con IA), `audio`, `acceptRequired` (se escribe, así que el ítem debe traer `accept`: familias `text_input` y `transform`, y `phrase_cloze`). Las familias agrupan por MECÁNICA, no por frente del catálogo (p. ej. `order_paragraphs` → `ordering`, `match_headings` → `matching`, `gap_sentences` → `cloze`, `lightning` → `choice`).
- **`validateItem` / `checkItem`** (8.3). **Obligatorios:** `id`, `type`, `topics` (1–5, sin repetidos, ids de tema), `level`, `prompt_es`, `data` (objeto), `explain_es`, `source`, `version` (entero 1–9999). **Opcionales:** `facet` (null o 0–2, 8.4), `prompt_en` (null), `accept` (null; hasta 50 textos, sin repetidos), `distractors` (`[{ text, code? }]`, hasta 20), `grammar_note_es`, `nuance_es`, `situation` (null), `error_codes` (hasta 10, sin repetidos), `audio`, `image` (null), `needs_ai` (false). `id`: `a.b[.c…]`, minúsculas, `[a-z0-9_]`, ≥ 2 tramos, sin `#`. `source ∈ original | ai_generated_unverified` (chequeo anti-derechos: cualquier otro valor es `ENUM`). Textos: `prompt_*`, `situation` ≤ 600 una línea; `explain_es`, `grammar_note_es`, `nuance_es` ≤ 2000 y admiten salto de línea. `audio` = `audio/<nombre>.<mp3|ogg|m4a|wav>` e `image` = `images/<nombre>.<png|jpg|jpeg|webp|svg>`: una sola carpeta, minúsculas, sin `..`, sin URL (`FORMAT`).
- **Reglas del Item (códigos estables):** `UNKNOWN_TYPE` (con "¿quisiste decir…?"), `INTEGRATOR_TYPE` (los integradores son sesiones, no ítems), `ACCEPT_REQUIRED` (tipo `acceptRequired` con `accept` ausente, null o vacío), `AI_REQUIRED` (tipo con `auto: false` y `needs_ai` distinto de `true`), `DISTRACTOR_IS_ANSWER` (un distractor igual a una respuesta válida tras normalizar con contracciones expandidas), `CONTRACTION_PAIR_MISSING`. **Aviso** `ACCEPT_DUPLICATE` (misma respuesta al normalizar; las idénticas ya son `DUPLICATE`).
- **Contracciones ambiguas** (decisión del Administrador, DECISIONS 1.2-1B): si una respuesta de `accept` lleva `'s` tras `he|she|it|that|there|here|what|who|where|how|when|why` o `'d` tras `i|you|he|she|it|we|they|who|there|that|what|where|how`, `accept` debe traer otra respuesta igual pero con cada contracción escrita completa (`is`/`has`, `would`/`had`; mayúsculas y puntuación final no cuentan). Con varias contracciones en la misma respuesta, la expandida debe cubrirlas todas. Solo se exige de contraída a expandida (lo contrario no se puede decidir: "Yes, it is." no se contrae). Un posesivo (`John's`, `Kit's`) no cuenta. `ambiguousContractionGaps(lista)` devuelve los índices sin pareja y la reutilizan los `data` del cuarto 2.
- **`data`:** sin especificación de su familia solo se exige que sea un objeto (`TYPE`). Si `ctx.dataSpecs[familia]` existe, se aplica con ruta `data.…`. El cuarto 2 congela el contenido de cada familia.
- **`validateLexEntry`** (8.11). Obligatorios: `id`, `lemma` (≤ 60), `pos`, `family`, `level`, `es` (1–10, sin repetidos), `def_en`, `examples` (`[{ en, es }]`, hasta 20; vacío = AVISO `LEX_NO_EXAMPLE`). Opcionales: `band` (null; `1K`…`20K` u `OFF`), `priority` (1–5), `collocations`, `derivation` (hasta 20), `false_friend_note_es`, `audio`, `image`. `family` tiene ≥ 2 tramos y el `id` empieza por ella (`LEX_FAMILY_MISMATCH`: `vocab.body.knee` en `vocab.body`). `pos` ∈ `noun verb adjective adverb preposition pronoun determiner conjunction interjection numeral phrase phrasal_verb` (PROVISIONAL).
- **`validateStory`** (8.12). Obligatorios: `id` (`story.…`), `level`, `title_en`, `title_es`, `segments` (1–200 de `{ id, text, translation_es?, audio?, new_words? }`; ids `[a-z][a-z0-9_]{0,19}` únicos, `DUPLICATE`), `source`. Opcionales: `topic_tags` (hasta 12), `grammar_targets` (temas, hasta 20), `vocab_targets` (hasta 20), `questions` (hasta 30 ítems completos con ruta `questions[i]…`; deben ser de familia `reading` o `audio`, si no `STORY_QUESTION_TYPE`; ids únicos), `comprehensibility` (`{ known_pct_estimate: null | 0–100 }`).
- **`validatePack`** (8.10). Obligatorios: `schema` (exactamente 1), `pack_id` (`[a-z][a-z0-9_]{2,59}`: va en el nombre del archivo), `version` (1–9999), `title_es`, `created` (fecha real `AAAA-MM-DD`, año ≥ 2000), `authors`, `license_note`, `topics` (1–100, sin repetidos), `items` (hasta 5000; puede ser `[]`). Opcionales: `lexicon` (hasta 5000), `stories` (hasta 500). **Reglas dentro del paquete:** ids de ítem únicos (también contra las preguntas de las historias; `DUPLICATE` con "ya existe en items[0]"), ids de léxico y de historia únicos, cada tema de un ítem o pregunta debe estar en `topics` (`ITEM_TOPIC_NOT_IN_PACK`), `PACK_EMPTY` (sin ítems, léxico ni historias). **Avisos:** `TOPIC_WITHOUT_ITEMS` (un tema del paquete que ningún ítem ni pregunta usa; solo si hay ítems), `AI_SOURCE_IN_PACK`. `LIMITS`: `PACK_LIMITS = { topics: 100, items: 5000, lexicon: 5000, stories: 500 }`.
- **Lo que NO hace todavía** (llega después): `data` por tipo (cuarto 2), ids únicos contra otros paquetes ya instalados, ciclos de `prereq`, ≥ 12 ítems y ≥ 3 tipos por tema `active`, distractores de elección con `code` (cuarto 2 y 3A), lectura de archivos y tamaño en bytes (CLI, 3B).

## 1.3-2A — `data` de las familias autocalificables (`core/contentData.js`) — 2026-10-18

Ampliación (concreta 8.3 y 8.10; no cambia la Parte 1). Puro. Exporta `DATA_SPECS` = `{ choice, text_input, ordering, matching, cloze, transform }` (congelado; mismo formato que `ctx.dataSpecs` de la 1.3-1B), `checkData` y `checkChoiceDistractors`. `validateItem`/`checkItem` aplican `DATA_SPECS` **por defecto** sobre `data` (rutas `data.…`); un `ctx.dataSpecs` propio lo reemplaza entero (una familia ausente solo exige que `data` sea un objeto). Todos los `data` son estrictos: un campo que no figura aquí es `UNKNOWN_FIELD`. Los tipos de cada familia están en `core/contentTypes.js` (1.3-1B); las familias `audio`, `speak`, `reading`, `writing`, `mediation` y `open_ai` se congelan en la 2B.

| Familia | `data` (obligatorios · opcionales) | Reglas entre campos |
|---|---|---|
| `choice` | `options` (2–8 textos ≤ 600, sin repetidos) · `correct` (entero 0–7: índice en `options`) · `shuffle` (bool) | `correct` < `options.length` (`RANGE`); regla de distractores (abajo) |
| `text_input` | — · `hint` (texto o null), `mask` (`none` \| `first_letter` \| `length`) | `accept` del Item es obligatorio (1.3-1B) |
| `ordering` | `pieces` (2–12 textos ≤ 120, **en el orden correcto**; la app los mezcla) · `extra_pieces` (hasta 4 señuelos) | — |
| `matching` | `pairs` (2–10 de `{ left, right }`, textos ≤ 120) · `extra_right` (hasta 4) | `left` y `right` no se repiten entre parejas (`DUPLICATE`) |
| `cloze` | `text` (con uno o más `___`), `answers` (una lista de 1–10 respuestas válidas **por hueco**, 1–6 listas) · `bank` (hasta 20 palabras) | nº de `___` = nº de listas (`CLOZE_NO_BLANK`, `CLOZE_BLANKS_MISMATCH`); con `bank`, cada hueco tiene alguna respuesta dentro del banco (`CLOZE_BANK_MISSING_ANSWER`) |
| `transform` | `source` · `instruction_es` (null), `keyword` (null) | `accept` del Item es obligatorio (1.3-1B) |

- **Distractores de elección** (8.10: "todo ítem de elección debe tener distractores basados en errores reales, campo `code`"). Para los tipos de la familia `choice` **salvo los de vocabulario** (ver la excepción abajo), cada opción incorrecta de `data.options` debe tener un distractor en `Item.distractors` con el mismo texto (se compara con `normalize`) y un `code` real. Códigos estables, con la ruta exacta: `CHOICE_DISTRACTOR_MISSING` (en `data.options[i]`: la opción incorrecta no tiene distractor), `CHOICE_CODE_MISSING` (en `distractors[j].code`: falta el `code`; el catálogo lo valida `UNKNOWN_CODE` si el contexto trae `errorCodes`), `DISTRACTOR_NOT_OPTION` (el distractor no está en `options`), `CHOICE_DISTRACTOR_IS_CORRECT` (el distractor es la opción correcta) y `DUPLICATE` (dos opciones iguales al normalizar). **Excepción (decisión del Administrador, pregunta 5, 2026-10-18):** en `CODE_OPTIONAL_CHOICE_TYPES` = `mcq_en_es`, `mcq_es_en`, `odd_one_out`, `pick_fits`, `lightning` (los de elección de la fila «Vocabulario» de 8.9) el distractor y su `code` son OPCIONALES: no rigen `CHOICE_DISTRACTOR_MISSING` ni `CHOICE_CODE_MISSING`; un distractor presente sigue sin poder ser la opción correcta ni estar fuera de `options`, y si trae `code` debe existir en `error_codes.json` (`UNKNOWN_CODE`, 3A). Un falso amigo o calco de verdad lleva `LEX.FALSE_FRIEND` o `LEX.CALQUE` (lo hace el chat de contenido; el validador no lo exige). La lista es una constante exportada de `core/contentData.js`. Solo se comprueba si el resto de `data` no tiene errores (no se apilan avisos). La regla se aplica con las especificaciones oficiales, no con un `ctx.dataSpecs` propio.
- **Fuera de alcance de la 2A** (llega después): `data` de las familias de la 2B; que las `pieces` de `ordering` reproduzcan alguna respuesta de `accept`; que las `answers` de `cloze` coincidan con `accept` en `phrase_cloze`. La función `grade` de cada tipo la escribe la subparte que construye su componente (2.2–2.5).
- **Provisional** (confirmado por el Administrador el 2026-10-18; se revisa cuando un lote de contenido muestre una necesidad): `shuffle` (la 2.3 decide su efecto), `mask`, `extra_pieces` y `extra_right`.

## 1.3-2B (parte 1) — `data` de la familia `audio` (`core/contentData.js`) — 2026-10-18

Ampliación (concreta 8.3 y 8.9; no cambia la Parte 1). `DATA_SPECS` gana `audio` (ahora 7 familias). Cubre los 9 tipos de escucha de `core/contentTypes.js`: `spell_from_audio`, `dictation`, `cloze_audio`, `connected_speech`, `minimal_pair_listen`, `listen_comprehension`, `what_did_they_say`, `follow_instruction`, `extensive_listening`. El archivo de audio va en `Item.audio` (puede ser null: mientras no exista, la app lee `transcript` con la voz del navegador, roadmap 4.7 y 7.x).

- **`data`:** obligatorio `transcript` (texto ≤ 2000, lo que dice el audio). Opcionales: `text` (≤ 600; en `cloze_audio` es la frase con `___`), `options` (2–6 textos sin repetidos) y `correct` (entero 0–5, índice en `options`), `speed` (`slow` \| `normal` \| `fast`, velocidad inicial), `max_plays` (1–10), `show_transcript` (bool; `false` = sin transcripción mientras se contesta). Campo desconocido = `UNKNOWN_FIELD`.
- **Reglas entre campos:** `options` y `correct` van juntos (`AUDIO_CHOICE_INCOMPLETE`, en la ruta del que falta); `correct` < `options.length` (`RANGE`).
- **Reglas del Item (solo si `data` no tiene errores):** debe poder contestarse: `data.options` + `data.correct` (elección) o `accept` no vacío (escrita), si no `AUDIO_NOT_ANSWERABLE` (ruta `accept`); `extensive_listening` queda exento (se califica por el tiempo escuchado). `cloze_audio` exige `data.text` con al menos un `___` (`CLOZE_NO_BLANK`, ruta `data.text`). Las reglas se aplican con las especificaciones oficiales, no con un `ctx.dataSpecs` propio.
- **Fuera de alcance** (llega después): que `accept` de `dictation` coincida con `transcript`; que `Item.audio` exista cuando se publique el audio (7.1); `data` de `speak`, `reading`, `writing`, `mediation` y `open_ai` (siguientes partes de la 2B).
- **Provisional** (pregunta 6 de `PROJECT_STATE.md`): el reparto «escribir o elegir» no depende del tipo sino de qué campos trae el ítem; `speed`, `max_plays` y `show_transcript` los usa 7.3 a 7.5.

## 1.3-2B (parte 2) — `data` de `speak`, `reading`, `writing`, `mediation` y `open_ai` (`core/contentData.js`) — 2026-10-18

Ampliación (concreta 8.3 y 8.9; no cambia la Parte 1). `DATA_SPECS` queda con las **12 familias** de `core/contentTypes.js`; con esto los contratos `data` de todo el catálogo 8.9 quedan congelados. Todos los campos son opcionales en la forma; cada TIPO exige algunos con `DATA_FIELD_REQUIRED` (ruta `data.<campo>`, solo si `data` no tiene errores). Campo desconocido = `UNKNOWN_FIELD`. Las reglas por tipo se aplican con las especificaciones oficiales, no con un `ctx.dataSpecs` propio.

| Familia | Campos (límites) | Obligatorios por tipo y reglas |
|---|---|---|
| `speak` | `target` (≤ 600), `sound` (≤ 120), `pair` (2 textos), `syllables` (2–8), `stress` (0–7), `scenario_es` (≤ 2000), `tip_es` (≤ 600, pista de cómo colocar la boca), `max_seconds` (5–300) | `read_aloud_score`, `echo_repeat`, `rhythm_sentence`: `target` · `sound_drill`: `target` y `sound` · `minimal_pair_speak`: `pair` · `stress_mark`: `syllables` y `stress` (`stress` < `syllables.length`, `RANGE`) · `describe_image_speak`, `voice_chat`: `scenario_es` |
| `reading` | `passage` (≤ 2000), `segment` (id `[a-z][a-z0-9_]{0,19}`), `options` (2–6, sin repetidos), `correct` (0–5), `answer` (`true` \| `false` \| `not_stated`) | `read_tfng`: `answer`. `answer` solo en `read_tfng` (`READING_ANSWER_ONLY_TFNG`). `options` y `correct` van juntos (`READING_CHOICE_INCOMPLETE`) y `correct` en rango (`RANGE`). Todo tipo salvo `read_tfng` y `free_read_tap` (no se califica) debe poder contestarse con `options` + `correct` o `accept` (`READING_NOT_ANSWERABLE`, ruta `accept`). `passage` puede faltar: en una `Story` el ítem lee sus segmentos (un ítem suelto sin texto lo comprueba el cargador, 4A) |
| `writing` | `min_words`, `max_words` (1–2000), `goals` (1–10 textos sin repetidos), `source_text` (≤ 2000), `rubric_es` (1–8 textos) | `write_hidden_goals`: `goals` · `write_rewrite`, `write_continue_story`: `source_text` · `min_words` ≤ `max_words` (`WORDS_RANGE`) |
| `mediation` | `source_text`, `source_lang` (`en` \| `es`), `audience_es` (≤ 120), `speech_act` (`request` `refuse` `apologize` `suggest` `complain` `thank`; constante `SPEECH_ACTS`), `register` (`informal` \| `neutral` \| `formal`), `rubric_es` | `med_summarize`, `med_explain_layperson`: `source_text` · `med_register`: `source_text` y `register` · `med_speech_act`: `speech_act` · `med_cross_language`: `source_text` y `source_lang` |
| `open_ai` | `target` (≤ 600), `source_text`, `min_words`, `max_words`, `rubric_es` | `own_sentence_word`, `own_sentence_grammar`, `own_sentence_verb`, `explain_rule`: `target` · `translate_free`, `summarize_one_line`: `source_text` · `min_words` ≤ `max_words` (`WORDS_RANGE`) |

- Los tipos solo-IA (`writing`, `mediation`, `open_ai`, y `speak` junto a Azure) siguen exigiendo `needs_ai: true` en el Item (1.3-1B). `rubric_es` es lo que ve la IA al calificar (5.4–5.9) y, al final, William.
- **Fuera de alcance:** que `Item.audio` exista en los tipos de `speak`; que `goals` sean temas existentes; que `reading` tenga texto disponible (4A). La calificación de cada tipo la escribe la subparte que construye su componente.
- **Provisional** (barato de cambiar, constantes en `contentData.js`): los nombres de campo de estas 5 familias se revisan cuando 5.x, 7.x u 8.x construyan sus componentes; cualquier cambio entonces pasa por el Administrador.

## 1.3-3A (parte 1) — Catálogo de códigos de error (`content/taxonomy/error_codes.json`, `core/contentCodes.js`) — 2026-10-18

Ampliación (concreta 8.8 y 1.3; no cambia la Parte 1). Puro. Archivo `{ "schema": 1, "codes": [ … ] }` con 1–500 códigos. `validateErrorCodes(input)` → `{ ok, errors, warnings, errorTotal, warningTotal }` (como 1.3-1A; nunca lanza ni modifica la entrada). `errorCodeSet(input)` → `Set` de ids para `ctx.errorCodes` de `validateItem`/`validatePack`/…: solo lee `codes[i].id`, ignora entradas raras y, ante una entrada hostil que falle, devuelve un `Set` vacío (nunca uno parcial). Constantes: `ERROR_CODES_SCHEMA` (1), `MAX_ERROR_CODES` (500), `ERROR_ORIGINS`, `ERROR_IMPACTS` (enumerados de 8.8).

- **Entrada de un código:** obligatorios `id` (`GRUPO.CÓDIGO` en mayúsculas, mismo formato que `eventSchema`: `TNS.SINCE_FOR`, `PRON.-ED`) y `titulo_es` (≤ 120, sin HTML). Opcionales, con forma, para que la 1.6 y el lote C1 los completen sin tocar el validador: `descripcion_es`, `origen_tipico` (`transfer_es` \| `developmental` \| `unknown_pure`), `impacto_defecto` (`low` \| `mid` \| `high`), `temas_relacionados` (ids de tema, hasta 10 sin repetir), `ejemplo_malo`, `ejemplo_bueno`, `pista_corta_es`. Campo desconocido = `UNKNOWN_FIELD`.
- **Reglas (códigos estables, con ruta exacta `codes[i].campo`):** `ENUM` (schema ≠ 1), `REQUIRED`, `TYPE`, `LIST_SIZE` (lista vacía o > 500), `FORMAT` (id mal formado), `DUPLICATE` (id repetido, en la ruta del repetido), `TEXT_HTML` y demás reglas de texto de 1.3-1A.
- **Contenido actual:** los 45 códigos de 8.8 en el mismo orden, solo con `id` y `titulo_es`. Una prueba lee la lista del roadmap y exige que el archivo los contenga todos (puede tener más: la 1.6 y C1 añaden). Los títulos son descripciones cortas del tipo de error, no microexplicaciones: esas son de C1.
- **Cableado:** lo hace el CLI (3B) y el cargador (4A): `errorCodeSet(JSON.parse(archivo))` → `ctx.errorCodes`. Con ese `Set`, un `code` inexistente en un distractor o en `error_codes` del ítem es `UNKNOWN_CODE`.
- **Fuera de alcance de esta parte:** leer el archivo del disco (CLI), `topics.json` y los avisos de ≥ 12 ítems y ≥ 3 tipos por tema, ids únicos contra paquetes instalados y ciclos de `prereq` (siguientes partes de la 3A).


## 1.3-3A (parte 2) — Temas, ids únicos globales y avisos por tema (`content/taxonomy/topics.json`, `core/contentTaxonomy.js`, `core/contentInstalled.js`, `core/contentPack.js`) — 2026-10-18

Ampliación (concreta 8.2, 8.10 y 1.3; no cambia la Parte 1). Puro. Cierra la mitad 3A.

**Archivo de temas.** `{ "schema": 1, "topics": [ Topic… ] }` con 1–2.000 temas (`MAX_TOPICS`). `validateTopics(input, ctx?)` → `{ ok, errors, warnings, errorTotal, warningTotal }` (como 1.3-1A; nunca lanza ni modifica la entrada). Cada tema pasa por `checkTopic` (1.3-1A) con la ruta `topics[i].campo`; `ctx.errorCodes` (Set) comprueba el `code` de los errores típicos. Lo que solo se ve con todos los temas a la vez:
- `DUPLICATE` — id repetido, en la ruta del repetido (`topics[2].id`); el mensaje nombra al primero. Con un id repetido manda el primero.
- `UNKNOWN_PREREQ` — un `prereq` con forma de id que no existe en el archivo (`topics[1].prereq[1]`). Un `prereq` con formato roto solo da `FORMAT`, no ambas.
- `PREREQ_CYCLE` — un ciclo de prerrequisitos, en la arista que lo cierra (`topics[1].prereq[0]`); el mensaje trae el anillo (`gram.a.a → gram.b.b → gram.a.a`). Cada arista que cierra un ciclo se informa una vez. Un tema prerrequisito de sí mismo sigue siendo `SELF_REFERENCE` (1.3-1A), no ciclo. Un id repetido no aporta aristas. Búsqueda sin recursión: cada tema se visita una sola vez (una escalera de 60 niveles, 2^60 caminos, valida al instante).
Los `prereq` siguen siendo sugerencias en la app (8.2); el validador los exige coherentes porque un ciclo no tiene orden posible y un id inexistente es casi siempre una errata.

`topicIdSet(input)` → `Set` de ids para `ctx.topicIds` (solo lee `topics[i].id`, no valida; entrada hostil → `Set` vacío, nunca parcial). `topicInfo(input)` → `Map<id, { status, min_items }>` para `ctx.topicInfo` (`min_items` por defecto 12; mismas garantías).

**Semilla `topics.json`.** 18 temas de prioridad 1, todos `status: "draft"`, `diagnosed_gap: true`, `min_items: 12`, sin `theory`, de los seis grupos de errores de ALTO impacto del roadmap 7.10: tiempos perfectos (4), irregulares y pasado (3), preguntas (4), `can/could + to` y gerundio/infinitivo (3), preposiciones dependientes (2), doble negación y sujeto (2). Incluye los ids de los ejemplos de 8.2 y 8.10. `tags` solo donde el origen en el español es claro (`transfer_es`). Es una semilla: la completan C2 y la 1.6; los ids de un tema no se renombran una vez que un paquete los usa (8.1).

**Paquetes ya instalados.** `summarizePack(pack)` → `{ pack_id, version, items: [id…], lexicon: [id…], stories: [id…], topics: { [temaId]: { count, types: [tipo…] } } } | null` (`null` si no es un paquete; nunca lanza). Es serializable. `items` junta ítems y preguntas de historia (mismo espacio de ids); `lexicon` y `stories` son otros espacios. `topics` cuenta ítems y preguntas por tema (un tema repetido dentro de un ítem cuenta una vez) y sus tipos, ordenados. `installedIndex(resúmenes, exceptPackId?)` → `{ items, lexicon, stories, topics }` (Maps; con un id repetido manda el primero; los conteos de tema se suman y los tipos se unen; un resumen sin `pack_id` o hostil se ignora; no-lista → índices vacíos). El CLI (3B) y el cargador (4A) arman la lista leyendo `content/packs/`.

**`validatePack` — nuevo en `ctx`:** `installed` (lista de resúmenes) y `topicInfo` (Map de `topicInfo`). Sin ellos, se comporta como en 1.3-1B.
- `DUPLICATE_INSTALLED` (error) — el `id` de un ítem, pregunta de historia, palabra o historia ya existe en OTRO paquete instalado (ruta del elemento, `.id`; el mensaje nombra el paquete). Solo en la primera aparición dentro del paquete (las demás ya son `DUPLICATE`). Un paquete con el mismo `pack_id` que uno instalado es un reemplazo (`add-pack`, versión mayor) y no choca con su propia versión. Los espacios de ids no se mezclan: ítems y preguntas, léxico, historias.
- `TOPIC_FEW_ITEMS` y `TOPIC_FEW_TYPES` (avisos, nunca errores) — por cada tema `active` que el paquete declara y usa, si entre este paquete y los instalados (sin la versión instalada del propio paquete) no suma `min_items` del tema (12 por defecto) ítems, o menos de 3 tipos de ejercicio distintos. Ruta `topics[k]`. Los temas `draft` y `deprecated` no avisan. Un tema que el paquete declara pero ningún ítem usa solo da `TOPIC_WITHOUT_ITEMS` (1.3-1B). Sin `ctx.topicInfo` no hay avisos de cantidad.
- Constantes compartidas, ahora en `core/contentCommon.js`: `PACK_LIMITS` (`contentPack.js` lo sigue reexportando), `STORY_QUESTIONS_MAX` (30), `DEFAULT_MIN_ITEMS` (12), `MIN_TYPES_PER_TOPIC` (3).

**Cableado (3B y 4A):** `ctx = { errorCodes: errorCodeSet(JSON.parse(error_codes.json)), topicIds: topicIdSet(topics), topicInfo: topicInfo(topics), installed: [summarizePack(cada paquete de content/packs/)…] }`. Validar el archivo de temas y el de códigos antes que los paquetes.
**Fuera de alcance de esta parte:** leer archivos del disco y el código de salida (CLI, 3B), los 25 paquetes inválidos y el paquete de muestra (3B), `importPacksToDb` y `add-pack` (cuarto 4).

## 1.3-3B — Validador de línea de comandos (`tools/validate-content.mjs`, `tools/contentFs.mjs`) — 2026-10-18

Ampliación (concreta 1.3; no cambia la Parte 1). Solo LEE el disco; toda la validación es la de `core/` (una sola implementación, la que reutilizará `add-pack`).

**Comando.** `node tools/validate-content.mjs [--root <carpeta>] [--quiet|-q] [--all] [--help|-h] [ruta …]` (script `npm run validate-content`; `npm run check` ahora lo ejecuta con `--quiet`). Sin rutas valida la taxonomía y los paquetes instalados (`content/packs/*.json`); con rutas (archivos `.json` o carpetas, sin entrar en subcarpetas) valida la taxonomía y ese lote.
- **Código de salida:** `0` todo en orden (los avisos no cuentan) · `1` hay errores de contenido · `2` uso incorrecto (ruta que no existe, ruta vacía, enlace simbólico dado a mano, carpeta sin ningún paquete, opción desconocida, raíz inválida).
- **Salida (español).** Todo a stdout salvo el veredicto de fallo y los errores de uso (stderr). Cada problema: `archivo.json › items[12].accept[0]: mensaje [CÓDIGO]`. Por archivo se muestran hasta 30 errores y 10 avisos (`--all` los muestra todos); `--quiet` solo deja lo que falla y el resumen.
- **Orden:** primero `error_codes.json`, luego `topics.json`. Si alguno tiene errores, **no se validan paquetes** (se contrastarían con una taxonomía rota y saldrían errores en cascada) y sale 1.
- **Contexto de cada paquete** (`contextFor`): `errorCodes`, `topicIds`, `topicInfo` de la taxonomía más `installed` = los instalados que el lote NO reemplaza (mismo `pack_id`) y los demás paquetes del lote. Así dos paquetes nuevos no pueden traer el mismo id, y un paquete que sustituye a otro instalado no choca con su versión vieja ni con la de sus vecinos del lote.
- **Reglas de archivo/lote nuevas** (código estable, ruta en el archivo): `FILE_MISSING`, `FILE_EMPTY`, `FILE_TOO_BIG` (> 20 MB), `FILE_SYMLINK`, `FILE_NOT_REGULAR`, `FILE_UNREADABLE`, `JSON_INVALID` (con línea y columna, o «cerca de la línea N» cuando el motor no da la posición), `INSTALLED_UNREADABLE` (un instalado ilegible o sin `pack_id` es error: sin él no se comprueban ids únicos), `DUPLICATE_PACK_ID` (mismo `pack_id` en dos archivos del lote), `FILE_NAME` (el archivo no se llama `<pack_id>.json`: AVISO fuera de `content/packs/`, ERROR dentro).
- **Qué se considera paquete:** un archivo dado a mano siempre; en una carpeta, un `.json` objeto con alguna de las claves `pack_id`, `items`, `lexicon`, `stories`, `schema`. Lo demás se omite y se avisa con el motivo (`.md`, informes, subcarpetas, enlaces simbólicos, no `.json`); los archivos que empiezan por `.` se ignoran sin aviso. Un `.json` ajeno dentro de `content/packs/` no cuenta como instalado.
- **Seguridad:** no escribe nunca; no sigue enlaces simbólicos; tope de 20 MB y 1.000 archivos por ejecución; acepta BOM; `__proto__` y anidación enorme se tratan como campo desconocido / JSON inválido sin romper; si quien lee la salida la cierra (`| head`) sale con el código ya calculado, sin traza.
- **Como módulo** (para `add-pack`, 4B): `validateContent({ root, inputs, cwd })` → `{ taxonomy, stoppedByTaxonomy, installedProblems, files: [{ file, display, packId, version, counts, pack, ok, errors, warnings, errorTotal, warningTotal }], skipped, errorTotal, warningTotal, exitCode }` (lanza `UsageError` en uso incorrecto); `formatResult(resultado, { quiet, all })` → `{ out, err }`; en `contentFs.mjs`: `readJsonFile`, `collectCandidates`, `loadPackFiles`, `loadTaxonomy`, `loadInstalled`, `contextFor`. La política de versiones (mayor reemplaza, menor o igual-distinta falla) NO está aquí: es de `add-pack`.

**Fixtures de prueba** (`tests/fixtures/`): taxonomía mínima propia (9 códigos, 3 temas) y `sample_pack_v1.json` (19 ítems de 9 tipos en 2 temas, 1 palabra, 1 historia con 1 pregunta; limpio, 0 avisos incluso con el tema `for_since` en `active`). Las pruebas NO dependen de la taxonomía real, para que C1 y C2 puedan cambiarla; una prueba aparte exige que el repo real (taxonomía e instalados) valide.
**Pruebas de la CA-2/CA-4/CA-5:** `tests/validate-content.invalid.test.mjs` (29 paquetes inválidos, uno por regla, con ruta y mensaje exactos, más el CLI real) y `tests/validate-content.test.mjs` (26). Medido: 2.000 ítems, de leer el archivo a tener el informe, 106 ms.

## 1.3-4A (parte 1) — Índice y carga de paquetes (`core/content.js`) — 2026-10-18

Ampliación (concreta 8.10 y 8.15; no cambia la Parte 1). Sin DOM, sin base de datos y sin red propia: el `fetch` se inyecta. Ninguna función lanza. La parte 2 añadirá `importPacksToDb` y la migración v1→v2.

**`content/index.json`** (lo escribe `add-pack`, 4B; nadie lo edita a mano): `{ "schema": 1, "packs": [ { pack_id, version, path, topics, items_count, size_kb } ] }`, hasta 1.000 paquetes. `pack_id` con el formato de `validatePack`; `version` 1–9999; `path` = exactamente `content/packs/<pack_id>.json` (`INDEX_PATH` si no; así un índice no puede mandar a pedir otro archivo); `topics` 1–100 sin repetir; `items_count` y `size_kb` enteros ≥ 0 (`size_kb` = KB redondeados hacia arriba); `pack_id` únicos (`DUPLICATE`). El contrato 8.10 no fija la forma de la raíz: **`schema` + `packs` es decisión de la 1.3** (pregunta 8 de `PROJECT_STATE.md`).
- `validateIndex(input)` → `{ ok, errors, warnings, errorTotal, warningTotal }` con rutas `packs[0].path`.
- `loadIndex(fetchFn, opts?)` → `{ ok:true, index, missing }` | `{ ok:false, error }`. Pide `<base>index.json` (base `content/`). **Sin `index.json` (404) no es fallo:** índice vacío con `missing: true` (aún no hay paquetes).
- `loadPack(entry, fetchFn, opts?)` → `{ ok:true, pack, warnings }` | `{ ok:false, error }`. `entry` = entrada del índice. **Siempre pide `content/packs/<pack_id>.json`** (la ruta se deriva del id, no se usa `entry.path`). Comprueba `pack_id` (`PACK_MISMATCH`) y, si la entrada trae versión, que coincida (`STALE`: la caché del navegador puede mezclar versiones, «stale-while-revalidate»); luego `validatePack(pack, opts.ctx)` (`INVALID_PACK`; `validate: false` lo omite). Los avisos se cuentan y no impiden cargar.
- `validatePack` se reexporta (8.15). `opts`: `base`, `timeoutMs` (15.000; cancela con `AbortController` y no deja temporizadores vivos), `maxBytes` (20 MB), `ctx`, `validate`.
- **`error` = `{ code, message (español), detail? }`**, códigos estables: `NO_FETCH`, `NETWORK`, `TIMEOUT`, `NOT_FOUND`, `OFFLINE` (503: es lo que responde `sw.js` sin conexión), `HTTP`, `TOO_BIG`, `BAD_JSON`, `BAD_INDEX` (`detail` = primeros problemas), `BAD_ENTRY`, `PACK_MISMATCH`, `STALE` (`detail` = `{ expected, got }`), `INVALID_PACK` (`detail` = `{ total, first }`).
- **Aviso para 4B / cableado:** `sw.js` clasifica `content/index.json` como «shell» (solo `content/packs/*` es stale-while-revalidate); si el índice no está en el manifiesto de precaché, sin conexión daría `OFFLINE` aunque haya paquetes guardados. *[Resuelto en 2.9-T3 punto 2: índice y paquetes están en el manifiesto.]* Hay que decidirlo al cablear la app (precachear el índice o añadirlo a la estrategia de paquetes).

## 1.3-4A (parte 2) — Importación a la base de datos (`core/contentImport.js`, `core/content.js`) — 2026-10-18

Ampliación (concreta 8.4, 8.13 y 8.15; no cambia ningún campo de 8.4). Sin DOM ni red propia; ninguna función lanza. Todo error es `{ ok:false, error:{ code, message (español), detail? } }`.

- `importPackToDb(db, pack, { now })` → `{ ok:true, pack_id, version, status, cardsCreated, cardsRetopiced, deprecated[], reactivated[] }`. `pack` ya validado (por `loadPack`). `now` = `Date`, número o ISO (obligatorio, `BAD_ARGS` si falta). Una sola transacción sobre `content_cache` y `cards`: si algo falla no queda nada a medias (`DB`, mensaje amable de `dbErrors`). `BAD_PACK` si el paquete no tiene `pack_id`/`version`/`items` válidos, un id con forma rara o repetido, `facet` fuera de null/0/1/2 o `topics` vacío.
- **`status`:** `new` (paquete no importado antes) · `updated` (cambió algo: ítems, versión, tarjetas creadas o temas) · `unchanged` (nada cambió: no se escribe nada) · `older` (la versión es menor que la instalada: no se hace nada; `version` devuelve la instalada).
- **Tarjetas.** Por cada ítem (y cada pregunta de cada historia) se crea la tarjeta `itemId#faceta` (`facet` null → 0) si no existe, con los valores iniciales de 8.4: `state 0`, `due = created = now (ISO)`, `stability 0`, `difficulty 0`, `reps 0`, `lapses 0`, `last_review null`, `suspended/leech/fav false`. **Una tarjeta que ya existe no se toca**, salvo `topics` si cambiaron (índice; `cardsRetopiced`). Nunca se borra una tarjeta ni un evento. (`initialCard` es provisional hasta que la 1.4 traiga `srs.newCard`.)
- **`content_cache`** (clave `pack_id`): `{ pack_id, version, imported, updated, items:[{id,facet}], deprecated:[ids ordenados] }`. `deprecated` = ítems que una versión nueva ya no trae (y que ningún otro paquete instalado trae). Un ítem retirado que reaparece vuelve a `items` y sale de `deprecated` (`reactivated`). Un registro dañado cuenta como «sin historial».
- `deprecatedItemIds(db)` → `Set` de ids retirados y que ningún paquete vigente trae. **El armador de sesiones (1.8) debe excluirlos.**
- `importPacksToDb(db, fetchFn, opts)` → `{ ok, missing, results[], failed[] }` o `{ ok:false, error }` si falla el índice. Para cada entrada del índice: si ya está importada en esa versión o mayor no se vuelve a descargar (`skipped: true`; así abre sin conexión), salvo `force: true`; si no, `loadPack` + `importPackToDb`. Un paquete que falla va a `failed` (`{ pack_id, error }`) y no impide los demás. Mismas `opts` que `loadIndex`/`loadPack` más `now`. Un paquete que ya no está en el índice no se retira solo.
- **Migración v1→v2 (simulada en pruebas):** ítem nuevo → tarjeta nueva; ítem que ya no está → `deprecated` con tarjeta e historial intactos; tema cambiado → solo `topics`; v3 que lo devuelve → reactivado; v1 después de v2 → `older`.

## 1.3-4B — Comando `add-pack` (`tools/add-pack.mjs`) — 2026-10-18

Ampliación (concreta 1.3 y 8.10; no cambia la Parte 1). Único camino para agregar contenido; nadie edita `content/index.json` a mano. La validación es la de `validate-content` (`validateContent`, `formatResult`).

**Comando.** `npm run add-pack -- [--dry-run] [--quiet|-q] [--root <carpeta>] [--force --reason "…"] [--help] <archivo.json | carpeta> …`. Salida **0** todo en orden (también «nada que hacer») · **1** errores de contenido o de versión, o fallo de escritura deshecho (no queda nada escrito) · **2** uso incorrecto (sin rutas, opción desconocida, `--force` sin `--reason`, ruta inexistente, `index.json` ilegible o inválido, `content/` o `content/packs/` que son enlaces). Solo escribe con `process.stdout/stderr.write`.

**Flujo.** (1) `validateContent` de todo el lote (taxonomía, ids únicos contra los instalados y dentro del lote, avisos); un solo error → no se escribe nada. (2) Por paquete, contra `content/packs/<pack_id>.json`: no instalado → `add`; versión **mayor** → `replace` (los retirados quedarán `deprecated` al importar); misma versión e idéntico (comparación profunda) → `unchanged`; misma versión distinto → error `VERSION_SAME_DIFFERENT`; versión menor → `VERSION_LOWER`; instalado ilegible o sin versión → `INSTALLED_UNREADABLE`; destino que no es un archivo normal → `TARGET`. Con `--force` los dos casos de versión pasan a `replace` (marcado FORZADO). (3) Escritura: cada paquete como JSON con sangría de 2 espacios y `\n` final, en `content/packs/<pack_id>.json` (el nombre sale del `pack_id`, nunca de la ruta dada). (4) `content/index.json` = `{ schema: 1, packs: [...] }` con las entradas del lote puestas o actualizadas y las demás intactas, ordenado por `pack_id`; entrada = `{ pack_id, version, path, topics, items_count (= items.length), size_kb (bytes del archivo ÷ 1024, hacia arriba, mínimo 1) }`. (5) Archivos temporales + renombrar; si algo falla se restaura lo anterior, se borran temporales y las carpetas creadas. Sin cambios → no se escribe nada (huella idéntica).

**Funciones exportadas** (para pruebas y para quien las reutilice): `planAddPack({ root, inputs, cwd, force? })` → `{ ok, validation, actions[{ packId, version, display, target, content, action, from?, code?, message?, forced? }], index:{ action:'create'|'update'|'unchanged' }, writes[], errors[] }` (no escribe; lanza `UsageError`); `applyPlan(plan, { rename? })` → `{ written }` (lanza con código `WRITE_FAILED` tras deshacer); `addPack(opts)` (plan + escritura salvo `dryRun`; añade `exitCode`, `written`, `writeError?`; `opts.io` = `{ rename }`); `formatAddPack(plan, { quiet })` → `{ out, err }`; `parseArgs`, `main`.

**Guía:** `docs/ADD_PACK.md` (1 página). `tests/add-pack.test.mjs` ejecuta los comandos del documento sobre un repo temporal.

## C1 — Catálogo de errores completo (`content/taxonomy/error_codes.json`) — 2026-10-18

Sin cambio de forma: el archivo sigue siendo `{ schema: 1, codes: [...] }` y `core/contentCodes.js` no cambió. Cada código del catálogo real trae ahora los 7 campos opcionales: `descripcion_es`, `origen_tipico` (`transfer_es | developmental | unknown_pure`), `impacto_defecto` (`low | mid | high`, misma escala que `ErrorRecord.impact` de 8.8), `temas_relacionados` (ids de tema), `ejemplo_malo`, `ejemplo_bueno` y `pista_corta_es` (≤ 140 caracteres, para mostrar al fallar). 67 códigos: los 45 de 8.8 y 22 más (ver `DECISIONS.md`). **Ampliación, no cambio:** 8.8 pide «45+». Los `temas_relacionados` pueden citar ids que aún no están en `topics.json` (C2 los revisa); el validador solo comprueba su formato.

**Confirmación del Administrador (2026-10-18, pregunta 8 de la 1.3-4A):** la raíz de `content/index.json` (`{ schema: 1, packs: [...] }`, `path` obligatorio) queda como está en 1.3-4A (parte 1). `sw.js` debe precachear `content/index.json` y los paquetes que lista; lo hará el primer chat que cablee la carga de contenido (2.1 o 2.9), ampliando `tools/build-manifest.mjs`.

## 1.4-1 — Piezas de `core/srs.js` sin FSRS: `newCard`, `levelOf`, `dueLabel` — 2026-10-19

- `newCard(itemId, facet, now, topics = []) → Card`: tarjeta con los valores iniciales de 8.4 (`state 0`, `due` y `created` = `now` en ISO, `stability`/`difficulty`/`reps`/`lapses` 0, `last_review null`, `suspended`/`leech`/`fav` false). `id = "<itemId>#<facet>"`; `facet` ausente (`null`/`undefined`) vale 0; solo 0, 1 o 2. `topics` se copia. Lanza `Error` con `itemId`, `facet`, `topics` o `toDate` en el mensaje si algo no es válido. Devuelve lo mismo que `initialCard` de `core/contentImport.js` (prueba cruzada); la importación seguirá usando su ayudante hasta que un cuarto posterior la cambie.
- `levelOf(card) → 1..5` por `card.stability` (días): L1 < 1 · L2 [1, 4) · L3 [4, 21) · L4 [21, 90) · L5 ≥ 90. `LEVEL_CUTS_DAYS = [1, 4, 21, 90]` (congelado). Estabilidad ausente, negativa, no finita o no numérica → 1.
- `dueLabel(card, now) → string` en español, desde `card.due`: `due ≤ now` → `"Repaso ahora"`; < 1 h → `"Repaso en N min"` (mínimo 1); < 1 d → `"N h"`; < 7 d → `"N d"`; < 56 d → `"N sem"`/`"N sems"`; < 365 d → `"N mes"`/`"N meses"` (30,4375 d por mes); desde 365 d → `"N año"`/`"N años"` (365,25 d). Siempre hacia abajo. `due` o `now` inválidos lanzan `Error` (`toDate`). No muta la tarjeta. Con el reloj hacia atrás da una espera mayor, nunca NaN ni negativos.
- Ni `newCard`, `levelOf` ni `dueLabel` usan `Date.now()` ni `Math.random()`.

## 1.4-3 — Sanguijuelas y modo rescate (`core/srsLeech.js`, `core/srsRescue.js`, reexportados por `core/srs.js`) — 2026-10-19

- `isLeech(card, threshold = 8) → boolean`: `card.lapses ≥ threshold`. `threshold` debe ser entero ≥ 1 (si no, `Error` con "umbral"). `lapses` no numérico → false.
- `markLeech(card, threshold = 8) → card'`: si llegó al umbral devuelve una copia con `suspended: true, leech: true`; si no, la misma tarjeta; si ya estaba marcada, la misma referencia (idempotente). No muta.
- `releaseLeech(card) → card'`: `suspended: false, leech: false`; NO borra `lapses` (8.4 no tiene campo para ello), así que `markLeech` la volverá a marcar en cuanto se llame de nuevo. El cuarto 4 de la 1.4 (`review`) debe llamar a `markLeech` solo tras un fallo (`Again`).
- `leechList(cards) → card[]`: las que tienen `leech === true`, de más a menos `lapses` y luego por `id`.
- `overdueCards(cards, now) → card[]`: `state ≠ 0`, no suspendida, no sanguijuela y `due ≤ now`. Las nuevas no cuentan como atraso.
- **[SUSTITUIDO por 1.4-3b en lo de `threshold`/`cap` y sus cifras]** `rescuePlan(cards, now, { threshold = 30, cap = 20, retrievability }) → { active, overdueCount, queue, today, postponed, message_es }`. `retrievability(card, now)` es OBLIGATORIA e inyectada (el cuarto 2 pasará `srs.retrievability`). `active` = más de `threshold` vencidas. Activo: `queue` por menor retrievabilidad (empates por `due`, luego `id`) y `today` = las primeras `cap`; inactivo: `queue` por `due` y `today` = todas, sin mensaje (`message_es: null`). Retrievabilidad no numérica cuenta como 0 (más urgente). `postponed = queue.length − today.length`. El mensaje es neutro, sin culpa ni rachas. `threshold` y `cap` enteros ≥ 1. No muta y es determinista (sin azar).
- (Los valores 30 y 20 de esta entrada ya no rigen: ver 1.4-3b.)

## 1.4-2 — Planificador FSRS en `core/srs.js` (`review`, `retrievability`, `previewIntervals`) sobre `vendor/ts-fsrs` 5.4.1 (FSRS-6) — 2026-10-20

- `RATING = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }`. Toda respuesta acepta ese número o `'again'|'hard'|'good'|'easy'` (sin importar mayúsculas); otro valor lanza `Error` con "rating".
- `review(card, rating, now, opts = {}) → card'`: copia nueva (no muta) con `state`, `due` (ISO), `stability`, `difficulty`, `reps`, `lapses` y `last_review` (ISO) actualizados; el resto de campos se conserva. Tras `Again` llama a `markLeech(card', opts.leechThreshold ?? 8)`. Lanza `Error` si la tarjeta está suspendida ("suspendida") o dañada (state fuera de 0–3, `stability`/`difficulty` no finitos o negativos, `reps`/`lapses` no enteros ≥ 0, `due`/`last_review` no ISO, `state ≠ 0` sin `last_review`).
- `opts`: `retention` (por defecto 0,9; el motor acepta 0,70–0,99 y lanza "retención" fuera de ese rango; Ajustes ofrecerá 0,80–0,95), `fuzz` (por defecto false; si es `true` EXIGE `opts.seed`, un texto no vacío, y el resultado queda determinado por `seed + reps + instante`), `leechThreshold`.
- Sin pasos de aprendizaje en minutos (`learning_steps: []`, `relearning_steps: []`): la tarjeta 8.4 no guarda ese contador, así que una nueva pasa directa a `state 2` con intervalo en días. El primer "Otra vez" de una tarjeta nueva NO suma `lapses` (semántica FSRS: solo cuentan los olvidos de lo ya aprendido). La repetición dentro de la sesión corresponde a la 1.8. Los estados 1 y 3 se aceptan al leer pero este planificador no los produce.
- `retrievability(card, now, opts?) → number` en [0, 1]. Nueva o con estabilidad 0 → 0. Resultado no finito → 0.
- `previewIntervals(card, now, opts?) → { again, hard, good, easy }`, cada uno `{ due: ISO, label: "Repaso en …" }`. No muta ni exige que la tarjeta no esté suspendida.
- Reloj hacia atrás (`now` < `last_review`): se usa `last_review` como hora efectiva en `review`, `retrievability` y `previewIntervals` (como si no hubiera pasado tiempo): nunca NaN ni intervalos negativos.
- Sin `Math.random()` ni `Date.now()`: probado sustituyéndolos por funciones que lanzan error. `FSRS_VERSION` = `"v5.4.1 using FSRS-6.0"`.
- Vendorización: `vendor/ts-fsrs/index.mjs` sin modificar, `LICENSE` (MIT) y `VERSION.txt` con la versión, el origen y los sha256 (una prueba comprueba que coinciden). Solo `core/srs.js` la importa.

## 1.4-3b — Modo rescate según el tope diario (decisión del Administrador, 2026-10-20) — sustituye cifras de 1.4-3

- `rescuePlan(cards, now, { dailyCap = 100, factors = RESCUE_FACTORS, retrievability }) → { active, overdueCount, threshold, quota, queue, today, postponed, message_es }`.
- `threshold = factors.activation × dailyCap` (por defecto 1,5 × 100 = 150): se activa si las vencidas son **más** que eso (150 no activa, 151 sí).
- `quota = max(1, floor(factors.quota × dailyCap))` (por defecto 0,5 × 100 = 50): en rescate, `today` son las `quota` de menor retrievabilidad (empates por `due`, luego `id`). Sin rescate, `today` = todas las vencidas.
- `RESCUE_FACTORS = { activation: 1.5, quota: 0.5 }` (congelado) está SOLO en `core/srsRescue.js`: es el único sitio donde se cambian. `DEFAULT_DAILY_REVIEW_CAP = 100`. Ambos reexportados por `core/srs.js`; desaparecen `DEFAULT_RESCUE_THRESHOLD` y `DEFAULT_RESCUE_DAILY_CAP` y las opciones `threshold`/`cap`.
- Validación: `dailyCap` entero ≥ 1; `factors.activation` número finito > 0; `factors.quota` número finito en (0, 1]; si no, `Error` con "dailyCap" o "factors". El resto (retrievability inyectada obligatoria, no numérica = 0, mensaje sin culpa, no muta, determinista) no cambia.
- La 1.8 y Ajustes deben pasar el tope diario real de la persona (`dailyCap`), no un número fijo.

## 1.4-4 — Motor simple de respaldo, fachada `createSrs` y ajuste `srsEngine` — 2026-10-20

- **Ajuste `srsEngine`** (`core/settings.js`): enumerado `'fsrs' | 'simple'`, por defecto `'fsrs'`, etiqueta «Motor de repaso». Un valor inválido en disco (o de otra versión) cae al defecto. Control en Ajustes → tarjeta «Repaso» (sin tarjeta nueva): «Normal» / «Simple (emergencia)». Solo se cambia a mano; el código NUNCA cambia de motor por su cuenta.
- **`core/srs.simple.js`** (respaldo tipo Leitner): misma interfaz que `core/srs.js` (`newCard`, `levelOf`, `dueLabel` reexportados; `review(card, rating, now, opts?)`, `retrievability(card, now)`, `previewIntervals(card, now)`) y las MISMAS tarjetas 8.4: cambiar de motor en cualquier momento no migra nada. Cajas en días `LEITNER_DAYS = [1, 3, 7, 14, 30, 60, 120, 240]`; `stability` = intervalo de la caja; la caja actual es la más alta cuyo intervalo no supera la `stability` (admite tarjetas de FSRS). Again → caja 1 (y suma `lapses` si ya la sabía); Hard → misma caja; Good → +1; Easy → +2 (tarjeta nueva: Again/Hard caja 1, Good caja 2, Easy caja 3). `retrievability = 0,9^(t/intervalo)` (0,9 al vencer; nueva → 0; en [0, 1]). Marca sanguijuela tras `Again` igual que FSRS; rechaza tarjetas suspendidas o dañadas; reloj hacia atrás = «no ha pasado tiempo». Ignora `opts.retention` y `opts.fuzz`.
- **Dificultad:** el motor simple conserva `difficulty` y, si valía < 1 (tarjeta nueva), la fija en `NEUTRAL_DIFFICULTY = 5`; FSRS exige 1–10 en una tarjeta ya vista. (Error hallado en el recorrido simulado y corregido en la causa; `review` de FSRS ahora lanza «una tarjeta con state N necesita difficulty ≥ 1 y stability > 0» en vez del error interno de la librería.)
- **`core/srsValid.js`:** `parseCard(card, who)`, `parseRating(r)` y `RATING_NAMES`, compartidos por los dos motores.
- **`core/srsEngine.js` — `createSrs({ settings? }) → { engine(), newCard, review, retrievability, previewIntervals, levelOf, dueLabel, rescue, leechList }`:** lee los ajustes EN VIVO en cada llamada (`srsEngine`, `retention`, `leechThreshold`, `dailyReviewCap`); sin `settings` usa los defectos (FSRS, 0,9, 8, 100). `rescue(cards, now)` = `rescuePlan` con el `dailyCap` de Ajustes y la retrievabilidad del motor activo. `ENGINES = { fsrs, simple }`.
- La 1.5 y la 1.8 deben llamar al motor SOLO a través de `createSrs` (para respetar el interruptor de Ajustes), y pasar el tope diario real mediante los ajustes.


## 1.5-1 — Reglas de calificación por acierto + tiempo (`core/grading.js`, `core/grading.config.js`) — 2026-10-20

- **`rate({ result, ms, hint, dontKnow, interrupted }, baselineMs, config?) → 1 | 2 | 3 | 4`** (firma de 8.15 con un campo opcional más, `interrupted`). `result` ∈ los 5 de 8.6 (otro valor lanza `Error` en español); `hint`, `dontKnow` e `interrupted` son booleanos (`null`/ausente = falso; otro tipo lanza). `ms` y `baselineMs` ilegibles (no numéricos, ≤ 0, NaN, ∞, negativos por reloj atrás) NO lanzan: el tiempo se ignora. Puro: sin reloj ni azar.
- **Tabla de decisión:** Again(1) si `wrong`, `dont_know`, `skipped` o `dontKnow=true` (siempre, aunque venga rápido o con pista). Hard(2) si `almost`, o correcto con pista, o correcto y `ms` > `slowFactor` × mediana. Easy(4) si correcto, sin pista y `ms` < `fastFactor` × mediana. Good(3) en el resto, incluido el tiempo ignorado. Los bordes exactos (1,8 × y 0,6 ×) NO cuentan: Good.
- **Tiempo ignorado** (`time.cls = 'ignored'`, nunca baja ni sube el rating; queda en Good): `interrupted=true` (pestaña oculta, cuarto 3), `ms` ilegible (`unknown_time`), mediana ilegible (`no_baseline`) o `ms` > `ignoreFactor` × mediana (`extreme`; 5 × exacto aún cuenta).
- **`rateDetailed(…) → { rating, reason, time }`:** `reason` ∈ `again_dont_know`, `again_wrong`, `again_skipped`, `hard_almost`, `hard_hint`, `hard_slow`, `easy_fast`, `good_time_ignored`, `good_normal`; `time` = `{ cls: 'fast'|'normal'|'slow'|'ignored', why? }` (o `null` si el resultado ya era Again).
- **`timeClass(ms, baselineMs, interrupted?, config?)`**, **`defaultBaselineMs(exerciseType, config?)`** (por tipo → por familia → `fallbackBaselineMs`; tipos desconocidos usan el general) y **`validateConfig(config)`** → `{ ok, problems }` (`fastFactor` < 1 < `slowFactor` < `ignoreFactor`, `minSamples` ≤ `window`, enteros ≥ 1). `rate` lanza `grading: configuración no válida` si se le pasa una config incoherente.
- **`core/grading.config.js` (solo datos, congelado):** `GRADING = { slowFactor: 1.8, fastFactor: 0.6, ignoreFactor: 5, minSamples: 8, window: 30, fallbackBaselineMs: 12000, lookbackDays: 120, interruptAfterHiddenMs: 3000 }` (`lookbackDays` se añadió en el cuarto 2 y `interruptAfterHiddenMs` en el cuarto 3; `validateConfig` exige entero ≥ 1 y número ≥ 0); `FAMILY_BASELINE_MS` (12 familias: choice 6 s, text_input 12 s, ordering 15 s, matching 20 s, cloze 10 s, transform 20 s, audio 15 s, speak 15 s, reading 30 s, writing 90 s, mediation 60 s, open_ai 45 s) y `TYPE_BASELINE_MS` (`lightning` 3 s). Son valores iniciales provisionales; `minSamples` y `window` los usa el cuarto 2.
- Lo que añaden los cuartos siguientes (mediana personal, cronómetro con pausas, botones manuales, puente con `createSrs`) se anota en 1.5-2, 1.5-3 y 1.5-4. El contrato 8.4/8.6 no cambia.

## 1.5-2 — Mediana personal de tiempo por tipo (`core/gradingBaseline.js`) — 2026-10-20

- **Qué es:** la `baselineMs` que recibe `rate` (1.5-1). Mediana de `ms` de las **últimas `window` (30) respuestas correctas de ese `exerciseType`**; con menos de `minSamples` (8) se usa `defaultBaselineMs(tipo)` (constante por tipo/familia). Todo sale de `GRADING` (`core/grading.config.js`).
- **Muestra válida:** evento `type: 'answer'`, `result: 'correct'`, **sin** `hint` y sin `dontKnow`, con `ms` finito, > 0 y ≤ 24 h (`LIMITS.msMax`). Quedan fuera `almost`, fallos, «no sé», saltos, respuestas con pista y eventos de otros tipos. El evento 8.6 no guarda si la pestaña estuvo oculta: el cronómetro (1.5-3) descuenta esas pausas ANTES de guardar `ms`. Los eventos mal formados se saltan en silencio (nunca lanzan).
- **`collectSamples(events, config?) → Map<exerciseType, ms[]>`:** las `window` muestras más recientes por tipo (más nueva primero; orden por `ts` y, si empatan, por `id`; no depende del orden de entrada). No modifica la entrada.
- **`baselineFor(exerciseType, events, config?) → { ms, source: 'personal' | 'default', samples }`:** `samples` es el número de muestras válidas encontradas (puede ser < 8 aunque `source` sea `default`). Un tipo no texto, vacío o desconocido da la constante general sin lanzar.
- **`loadBaselines({ events, now, config? }) → Promise<{ forType(t), types() }>`:** lee UNA vez `events.since(now − lookbackDays)` (120 días) con la API de `core/events.js` y devuelve un objeto congelado; `forType(t)` = mismo resultado que `baselineFor`, `types()` = tipos con alguna muestra (orden alfabético). `now` es Date o milisegundos (inválido → error); sin `events.since` → error. Lo que se lee es solo eso: no escribe nada.
- **`medianOf(numbers)`:** mediana (par = promedio de los dos centrales); ignora no numéricos; vacío → `null`; no reordena la entrada.
- **Errores:** configuración incoherente → `gradingBaseline: configuración no válida`; lista de eventos que no es lista → error en español.
- Los cuartos 3 y 4 no cambian este contrato; la 1.8 y las pantallas de ejercicios (P2) llamarán a `loadBaselines` al abrir una sesión y pasarán `forType(tipo).ms` a `rate`.

## 1.5-3A — Cronómetro de respuesta (`core/answerTimer.js`, `app/visibility.js`) — 2026-10-20

- **`createAnswerTimer({ clock, visibility?, config? }) → { start(), stop(), peek(), running() }`** (objeto congelado). `clock` = `{ now() → Date }` (`createClock()` de `core/clock.js`); `visibility` = `{ hidden() → boolean, onChange(fn) → desuscribir() }`, por defecto «siempre visible». Sin `Date.now` ni `document` en `core/`: el único sitio que toca `document` es `app/visibility.js`.
- **Resultado (`peek()`/`stop()`)**: `{ ms, hiddenMs, interrupted }`. `ms` = entero ≥ 0 con la pestaña VISIBLE (tope `LIMITS.msMax`), listo para guardar en el evento 8.6 (el tiempo oculto YA está descontado; el evento no tiene campo de pausas). `hiddenMs` = tiempo oculto. `interrupted` = `hiddenMs > interruptAfterHiddenMs` (3000 ms; 3000 exactos no interrumpen) **o** el reloj fue hacia atrás / falló / dio un valor ilegible. Se pasa tal cual a `rate` (1.5-1): con `interrupted` el tiempo se ignora (Good, nunca baja ni sube).
- **Ciclo de vida:** `start()` con el cronómetro en marcha no hace nada (doble toque); `start()` tras `stop()` mide de cero. `stop()` repetido devuelve una copia de lo mismo. Sin `start()`, `peek`/`stop` dan `{ ms: 0, hiddenMs: 0, interrupted: true }` (sin medición no hay tiempo fiable). Se suscribe a la visibilidad al empezar y se desuscribe al parar. Si la pestaña ya estaba oculta al empezar, ese tiempo cuenta como oculto; si se responde oculta, el tramo final cuenta como oculto.
- **Reloj:** un salto hacia atrás no suma ni resta lo ya medido y marca `interrupted`; un salto enorme hacia adelante se topa en 24 h y lo ignora `rate` (> 5 × mediana). Un reloj o una visibilidad que lanzan nunca rompen la respuesta (reloj → no fiable; visibilidad → «visible»). El cronómetro solo lee el reloj al empezar, ante un cambio de visibilidad y en `peek`/`stop`.
- **`createDocumentVisibility(doc?) → { hidden(), onChange(fn) }` (`app/visibility.js`):** `hidden()` = `doc.visibilityState === 'hidden'`; `onChange` escucha `visibilitychange` y devuelve la función para quitar el aviso. Sin `document` (Node) o con uno incompleto: siempre visible, sin errores.
- **Errores:** reloj sin `now()`, `visibility` sin `hidden()`/`onChange()` o config incoherente → `Error` en español al crear.
- **Mitad B:** el puente `gradeAnswer`/`gradeManual` y los 4 botones manuales están en 1.5-3B (abajo).

## 1.5-3B — Puente de calificación y 4 botones manuales (`core/gradeAnswer.js`, `ui/components/ratingButtons.js`) — 2026-10-20

El evento 8.6 y la tarjeta 8.4 NO cambian; no hay campos nuevos en la base. `core/gradeAnswer.js` es puro (sin DOM, base de datos, reloj ni azar) y **no guarda nada**.

- **`gradeAnswer({ answer, card, srs, now, exerciseType, baselineMs?, baselines?, sessionId?, topics?, mode?, channel? }) → GradeResult`.**
  `answer = { result, ms?, hint?, dontKnow?, interrupted?, responseRaw?, errorCodes? }`: `result` ∈ los 5 de 8.6; `ms` e `interrupted` salen de `createAnswerTimer().stop()` (1.5-3A); `hint`/`dontKnow`/`interrupted` son booleanos (otro tipo lanza). **`dontKnow: true` y `result: 'dont_know'` se equivalen** (el evento exige que coincidan): gana «no sé» y el rating es 1. `card` = tarjeta 8.4 (no se muta); `srs` = `createSrs({ settings })` (1.4-4; cualquier objeto con `review` sirve, `dueLabel` es opcional); `now` = Date, ms o ISO (core/clock.js); `exerciseType` obligatorio. Mediana: `baselineMs` (número > 0) manda; si falta, `baselines.forType(exerciseType).ms` (el objeto de `loadBaselines`, 1.5-2); si falta o es ilegible, `defaultBaselineMs(exerciseType)` (1.5-1). `topics` por defecto los de la tarjeta; `mode` `'mech'`; `channel` `'keyboard'`.
- **`gradeManual({ rating, card, srs, now, exerciseType, sessionId?, topics?, mode?, channel? }) → GradeResult`:** tarjetas de recuerdo libre SIN verificación. `rating` entero 1–4 (otro valor, incluido `'good'` o `'3'`, lanza); pasa directo, **sin `rate`** (ni tiempo ni pista). `channel` por defecto `'tap'`. El evento sale con `result: 'wrong'` si el rating es 1 y `'correct'` si es 2, 3 o 4; `ms: null` (el tiempo hasta pulsar un botón no es tiempo de respuesta y NO entra en la mediana personal: `collectSamples` exige `ms` > 0); `hint`/`dontKnow` falsos; `responseRaw: null`; `errorCodes: []`.
- **`GradeResult = { rating, reason, time, event, card, scheduled, notScheduled, dueLabel }`.** `reason`/`time` = los de `rateDetailed` (1.5-1); en `gradeManual`: `reason` = `manual_again|manual_hard|manual_good|manual_easy`, `time` = `null`. `event` = objeto válido para `events.log` (`type: 'answer'`, `ts` = `now`, `cardId`, `itemId`, `topics`, `exerciseType`, `result`, `rating`, `ms` (redondeado; > 24 h se topa en 24 h; ilegible → `null`), `hint`, `dontKnow`, `responseRaw`, `errorCodes`, `mode`, `channel`, `sessionId`), sin `id` ni `day`. `card` = tarjeta siguiente (copia) o, si no se programó, una copia SIN cambios.
- **`scheduled` / `notScheduled`:** `scheduled: true` si `srs.review` programó la tarjeta; `dueLabel` = `srs.dueLabel(card', now)` («Repaso en 4 d»), o `null` si el motor no lo da. `scheduled: false` con `notScheduled = { code, message }` si no se pudo: `'SUSPENDED'` (tarjeta suspendida o sanguijuela: no se llama a `review`) o `'REVIEW_FAILED'` (`review` lanzó, p. ej. fecha dañada). **La respuesta no se pierde:** el evento sale igual y quien llama lo guarda; solo la tarjeta queda como estaba. El primer «Otra vez» de una tarjeta nueva no suma `lapses` (1.4).
- **Errores:** entradas inválidas (sin objeto, `card` sin `id`/`itemId`, `srs` sin `review`, `exerciseType` vacío, `now` ilegible, `topics` que no es lista, `result` desconocido, booleano de otro tipo, `baselineMs` ≤ 0 o no numérico, `rating` fuera de 1–4) lanzan `Error` en español que empieza por `gradeAnswer:`. Un evento que no pasa `validateEvent` (p. ej. tarjeta sin temas, `exerciseType` con forma rara, `errorCodes` mal formados, `responseRaw` > 2000) lanza `EventError` (`code: 'BAD_EVENT'`). **Todo o nada:** el evento se valida ANTES de llamar a `review`.
- **Orden de guardado recomendado (lo hace el ejecutor de sesión, 2.1):** (1) `events.log(result.event)`; (2) `db.put('cards', result.card)` solo si `scheduled`. Si falla (2) queda el evento —que es la fuente de verdad— y la tarjeta se puede recalcular; al revés, una tarjeta cambiada sin evento no tendría explicación.
- **`createRatingButtons({ label?, labels?, previews?, disabled?, onRate?(rating, evento), doc?, win?, timers?, now? }) → { el, setPreviews(p|null), setDisabled(b), reset(), isLocked(), destroy() }`** (también exportado por `ui/components/index.js`, con `normalizePreviews` y `RATING_KEYS`). Grupo (`role="group"`, nombre «¿Cómo te salió?») con 4 `<button type="button">` en orden **Otra vez · Difícil · Bien · Fácil** (`data-rating` 1–4). `labels` cambia los textos (claves `again|hard|good|easy`, ≤ 40 caracteres); `previews` pone bajo cada botón la fecha de repaso y acepta textos o lo que devuelve `srs.previewIntervals(card, now)` (`{ again: { due, label }, … }`). **Un solo toque califica:** tras el primero los 4 botones quedan bloqueados (el elegido lleva `aria-pressed="true"` y `.is-chosen`) hasta `reset()`: un doble toque no califica dos veces. Si `onRate` devuelve una promesa, siguen bloqueados mientras dura; si rechaza (o `onRate` lanza) se desbloquean para reintentar y el error SE PROPAGA. Props inválidas lanzan `TypeError` en español que empieza por `ratingButtons:`. Estilos en `ui/styles/widgets.css`: ≥ 44 px, la palabra no se parte (el botón entero baja de línea), ninguno es rojo (el rojo es de errores de interfaz) y se distinguen también por el color del borde inferior.
- **Uso previsto (2.1):** `const baselines = await loadBaselines({ events, now })` al abrir la sesión; `const timer = createAnswerTimer({ clock, visibility: createDocumentVisibility() })`, `timer.start()` al mostrar el ejercicio; al responder: `const t = timer.stop(); const r = gradeAnswer({ answer: { result, ms: t.ms, interrupted: t.interrupted, hint, dontKnow, responseRaw, errorCodes }, card, srs, now, exerciseType, baselines, sessionId })`. Para recuerdo libre: `createRatingButtons({ previews: srs.previewIntervals(card, now), onRate: (rating) => gradeManual({ rating, card, srs, now, exerciseType, sessionId }) })`.

## 1.6-1 — Catálogo de errores y registro de errores (`core/errorCatalog.js`, `core/errors.js`) — 2026-10-20

El contrato 8.8 (`ErrorRecord`) no cambia; solo gana UN campo optativo, `seen` (abajo). El archivo `content/taxonomy/error_codes.json` ya trae 67 códigos completos (los 45 de 8.8 y 22 más de la 1.3); la 1.6 no cambia su formato.

- **`createErrorCatalog(json) → catálogo congelado`.** Valida con `validateErrorCodes` (1.3) y lanza `Error` en español (`createErrorCatalog: el catálogo de errores no es válido (…)`) si no pasa: un catálogo roto no se usa a medias. `size`, `ids()`, `has(id)`, `get(id)` (entrada inmutable con los 9 campos; los opcionales ausentes salen `null` / `[]`), `all()`, `hint(id)` (= `pista_corta_es`), `byTopic(topicId) → id[]`, `incomplete() → [{ id, missing[] }]` e `isComplete()`. Entradas absurdas (no texto, `__proto__`) dan `false` / `null` / `[]`, nunca lanzan. `COMPLETE_FIELDS` = los 8 campos que hacen «completo» a un código.
- **`createErrors({ db, catalog, clock? }) → { record, get, list, count }`** (congelado). Usa solo el almacén `errors` (8.13).
- **`record(input) → { record, created, counted, replay }`.** `input = { original, code, correction?, context?, topics?, origin?, kind?, impact?, source?, itemId?, ts? }`; cualquier otra clave se rechaza. `original` 1–500 caracteres (recortado, sin caracteres de control salvo salto de línea); `code` debe existir en el catálogo; `correction` ≤ 500 y distinta del original; `context` ≤ 200; `topics` ≤ 10 ids de tema (por defecto —y si llega `[]`— los `temas_relacionados` del código); `origin`/`impact` por defecto los del código; `kind` `'slip'` por defecto; `source` `'app'`; `ts` Date | ms | ISO, por defecto el reloj, y más de 24 h en el futuro se rechaza. Entrada no válida → `ErrorRecordError` (`code: 'BAD_ERROR_RECORD'`, `problems[]`, `friendly`) sin tocar la base; base que falla → `DbError` y no se guarda nada.
- **«El mismo error»** = mismo `code` + mismo `original` normalizado (`core/normalize.js`: minúsculas, apóstrofo curvo = recto, espacios, sin puntuación final) + mismo `itemId` (`null` = ninguno). Se busca por el índice `code` dentro de UNA transacción, así que reconoce también registros venidos del chat con otro id.
  - **Primera vez:** crea el registro, `count: 1`, `kind: 'slip'` (salvo que la entrada diga otra cosa), id `err_` + 11 caracteres base 36 (hash de la clave; si lo ocupa OTRO error se prueba `_1`, `_2`…). `{ created: true, counted: true, replay: false }`.
  - **Repetición:** el mismo registro sube `count + 1`; `ts`/`day` pasan a la ocurrencia MÁS RECIENTE; `kind` pasa a `'systematic'` desde `count ≥ 3` (o si ya lo era o la entrada lo pide; antes `'slip'`; nunca baja — cambio del cuarto 2, ver 1.6-2); `impact` toma el mayor; `correction` y `context` se rellenan solo si estaban vacíos; `origin`, `topics`, `source` y `original` se conservan. `{ created: false, counted: true, replay: false }`.
  - **Idempotencia:** si el `ts` ya consta entre las ocurrencias recordadas, no cambia nada: `{ created: false, counted: false, replay: true }`. Reenviar o reimportar el mismo aviso no duplica; un aviso nuevo trae otro `ts` y sí cuenta (también si llega fuera de orden).
- **Ampliación de 8.8 (optativa): `seen`** = hasta 10 `ts` ISO (ascendentes) de las ocurrencias más recientes; `ts` = la última. Un registro sin `seen` (venido del chat) se lee como `[ts]`. Si una ocurrencia más vieja que las 10 guardadas llega tarde, cuenta en `count` pero no entra en `seen` (y su repetición exacta volvería a contarse; caso extremo aceptado). Los cuartos 2–3 (reincidencia 3 veces/14 días, `top`) leen `seen` y `count`.
- **`get(id)`** → copia o `null`. **`list({ code?, topic?, day?, order?, limit? })`** → copias ordenadas por `ts` (`'desc'` por defecto; empate por id). **`count({ code? })`** → número de REGISTROS (errores distintos), no de ocurrencias. Opciones desconocidas o mal formadas → `DbError` `BAD_QUERY`, nunca «todo» en silencio.
- **No hace (cuartos siguientes):** detector mecánico (cuarto 3). La reincidencia, `top` y el hook de IA llegaron en el cuarto 2 (1.6-2). Tampoco crea tarjetas de repaso ni aplica el tope de dominio (eso lo dispara quien llama; 1.7 y las pantallas de ejercicios): `record` solo anota.

## 1.6-2 — Reincidencia, ranking y hook de clasificación (`core/errors.js`, `core/errorHook.js`) — 2026-10-21

Sin cambio de la sección 8. Se amplía `createErrors` y se añade un módulo.

- **`createErrors(...) → { record, get, list, count, byTopic, recurrent, top }`** (congelado). `kind`: `'slip'` hasta la 3.ª ocurrencia, `'systematic'` desde `count ≥ 3`; si la entrada trae `'systematic'` se respeta; nunca baja.
- **Constantes exportadas:** `RECURRENCE = { times: 3, days: 14 }` (congelada; el MISMO umbral manda en `kind` y en la reincidencia), `ORIGINS`, `IMPACTS`.
- **`recurrence(rec, now) → { inWindow, recurrent, last }`** (pura). Cuenta las ocurrencias FECHADAS de `seen` con `ts ∈ [now − 14 d, now]` (bordes inclusivos, el futuro no cuenta); `recurrent` = `inWindow ≥ 3`; las no fechadas no cuentan. Un registro dañado o no objeto da `{ 0, false, null }`; un `now` ilegible lanza `Error`.
- **`recurrent({ by?, topic?, code?, now? }) → Promise<entrada[]>`.** `by` `'error'` (defecto: misma frase) | `'code'`. `now` por defecto el reloj. Entrada = `{ key, by, code, record|null, records, topics, inWindow, last }` (`record` es copia, solo con `by: 'error'`). Orden: `inWindow` ↓, `last` ↓, `key` ↑. Opciones mal formadas → `DbError` `BAD_QUERY`. No escribe.
- **`top(n, range, { by? }) → Promise<entrada[]>`.** `n` entero ≥ 0; `range` OBLIGATORIO `{ from?, to? }` (días locales `AAAA-MM-DD`, `Date` o ms, inclusivos; `{}` = todo); `by` `'code'` (defecto) | `'error'`. Entrada = `{ key, by, code, record|null, records, topics (unión ordenada), frequency, impact (el mayor), weight, score, last }`. `score = frequency × weight` (low 1, mid 2, high 3; ilegible 1). Sin rango `frequency` = suma de `count`; con rango = ocurrencias fechadas dentro (máximo 10 por error: es lo que recuerda `seen`); las de frecuencia 0 no salen. Orden: `score` ↓, `frequency` ↓, `last` ↓, `key` ↑. Mal formado → `BAD_QUERY`. No escribe.
- **`byTopic(topicId)`** = `list({ topic })`; id ausente, vacío o no texto → `BAD_QUERY`.
- **Hook: `createErrorHook({ errors, catalog, classifier? }) → { hasClassifier, classifyAndRecord }`** (congelado). **Clasificador** = objeto con `classify(entries) → Promise<Array<veredicto | null>>`; `entries` = `[{ original, correction, context, itemId }]` (4 textos o `null`, de 1 a `CLASSIFY_BATCH_MAX = 20` por llamada); la respuesta debe ser una lista del mismo tamaño y orden, o se descarta entera. `veredicto = { code?, kind?, origin?, impact?, topics? }`.
  - **`classifyAndRecord(entries, { classify? }?) → { classifier: { used, ok, sent, error }, results, recorded }`.** `entries` 1–`MAX_ENTRIES` (100) con la forma de `errors.record`. El campo explícito gana; el veredicto solo rellena huecos (`null`, `undefined`, `code: ''` y `topics: []` cuentan como hueco). `classify` `'missing_code'` (defecto) | `'all'`. `results[i] = { index, status, result, discarded, error }`; `status` `'recorded'` (`result` = lo de `record`) | `'unclassified'` (sin código) | `'rejected'` (entrada no válida) | `'failed'` (la base falló). `discarded = [{ field, reason, value }]` (valor recortado a 60, nunca un objeto). Nunca lanza por una entrada mala o un clasificador roto; sí lanza `ErrorRecordError` por argumentos absurdos (lista vacía o de más de 100, opciones desconocidas).
  - También exporta `cleanVerdict(verdict, catalog) → { clean, discarded }` y `reconcile(entry, clean)` (puras).
- **No hace:** no implementa ninguna IA ni el detector mecánico (cuarto 3); no crea tarjetas de repaso ni aplica el tope de dominio (1.7).

## 1.6-3A — Detector mecánico de errores (`core/errorDetect.js`) — 2026-10-21

Sin cambio de la sección 8. Módulo nuevo, puro (sin DOM, base de datos ni red).

- **`detectRules(text) → hit[]`** (sin catálogo): `hit = { code, rule, text, from, to }` (congelado), ordenado por posición. Texto no válido o vacío → `[]`. Lee como máximo `MAX_TEXT = 2000` caracteres. Una regla que falla no tumba a las demás.
- **`createErrorDetector({ catalog }) → { detect, classify, rules }`** (congelado). Lanza `Error` si falta el catálogo o si el código de alguna regla no está en él.
  - `detect(text)`: como `detectRules` más `hint` (`pista_corta_es`), ordenado por prioridad: impacto del código ↓, orden de regla, posición.
  - `classify(entries) → Promise<Array<veredicto | null>>`: contrato de `errorHook.js` (mismo tamaño y orden; lee solo `original`; `null` = sin veredicto; `entries` que no es lista → rechaza). `veredicto = { code, origin, impact, topics: [primer tema del catálogo] }` del hit de mayor prioridad.
  - `rules`: lista congelada `{ id, code }`. `RULE_LIST` y `MAX_TEXT` también se exportan.
- **Cubre 30 códigos** (ver DECISIONS.md); no cubre `Q.INDIRECT`, `GER.STOP_REMEMBER`, `FUT.WILL_PLAN`, `ADJ.ORDER`, `LEX.FALSE_FRIEND`, `PRON.*` ni `ART.GEO`.
- **CA 2 y CA 3:** tabla de 46 frases reales y 35 de control en `tests/_errorTable.mjs` (la usan `errorDetect.table.test.mjs` y `errors.ca.test.mjs`).
- **Señalamiento (`from`/`to`):** cubre la expresión completa de la señal; en `since`/`for` + «last + unidad» incluye la unidad («live here since last week», no «… since last»).

## 1.6-4 — Cierre de la 1.6 — 2026-10-22

Sin cambio de la sección 8 ni de las firmas de 1.6-1, 1.6-2 y 1.6-3A. Los 5 CA se amarran de punta a punta en `tests/errors.ca.test.mjs` (detector → `createErrorHook` → `errors.record` → `errors.top`). Única corrección de comportamiento: el `from`/`to` de `TNS.SINCE_FOR` con «last + unidad» (ver 1.6-3A, «Señalamiento»). Versión 0.14.0.

## 1.7-T1 — Núcleo de señales del dominio (`core/mastery.config.js`, `core/masterySignals.js`) — 2026-10-23

Sin cambio de la sección 8 (8.7 se respeta; las fórmulas que el roadmap no fija quedan fijadas aquí). Funciones puras: reciben datos ya leídos y no tocan la base.

- **`core/mastery.config.js`** (todo congelado): `WEIGHTS` (R 0,35 · P 0,30 · U 0,20 · E 0,15), `BANDS` (○ Sin ver 0 · ◔ Inicial 1–29 · ◑ En progreso 30–59 · ◕ Sólido 60–84 · ● Dominado 85–100), `CONFIDENCE`, `DROPS` (T2), `SIGNAL_R`, `SIGNAL_P`, `SIGNAL_E`, `MS_PER_DAY`, `MASTERY_CONFIG`.
- **`signalR(cards, now, { retrievability, config? })` → `{ value: 0..1|null, cards, ignored }`.** Media de `retrievability(card, now)` (la de `core/srsEngine.js`) de las tarjetas con `reps ≥ 1` (incluye suspendidas). Valores fuera de [0,1] se recortan; no numéricos cuentan 0. Sin tarjetas repasadas → `null`.
- **`signalP(events, topicId, now, { config? })` → `{ value: 0..1|null, attempts, ignored }`.** Eventos `answer` del tema, de producción, con `ts` en [now − 30 d, now]; peso `0,5^(edad/10 d)`; valores correct 1 · almost 1 · wrong 0 · dont_know 0; `skipped` no es intento. Sin intentos → `null`.
- **`signalE(rows, { config? })` → `{ value: 0..1, codes: [{ code, inWindow, contribution }] }`.** `rows` = `errors.recurrent({ by: 'code', topic, now })`. Aporte por código `min(1, (inWindow − 2) / 4)`; unión `E = 1 − Π(1 − aporte)`. Sin reincidencia → `0` (no `null`).
- **`isProduction(exerciseType, config?)`.** Producción = familias `text_input`, `transform`, `speak`, `writing`, `mediation`, `open_ai` + el tipo `phrase_cloze` (vía `typeInfo` de `core/contentTypes.js`).
- Elementos ilegibles dentro de las listas se ignoran y se cuentan en `ignored`; una entrada que no es lista, un `topicId` vacío, un `now` ilegible o un `retrievability` ausente lanzan `Error` en español.

## 1.7-T2 — Combinación, bandas, confianza y topes (`core/mastery.js`) — 2026-10-23

Sin cambio de la sección 8. La firma de 8.7 (`mastery(topicId, now)`) y la de 8.15 (`mastery.compute(topicId, ctx, now)`) se contradicen: se fija **`createMastery({ db, events, errors, srs, clock?, config?, u? }).compute(topicId, now?)`** (el `ctx` de 8.15 son las dependencias inyectadas).

- **`compute(topicId, now?)` → `Promise<{ topicId, pct, rawPct, band, label, symbol, confidence, signals: { R, P, U, E }, evidence, caps, detail }>`.** `pct` entero 0–100; `band` es el id (`unseen|initial|progress|solid|mastered`), `label` y `symbol` salen de `BANDS`; `signals` son números 0–1 o `null` (R, P y U; E nunca es `null`); `evidence` = número de eventos `answer` del tema; `detail` = `{ R: { cards }, P: { attempts }, E: { codes } }`. Lee `cards` por el índice `topics`, `events.byTopic` y `errors.recurrent({ by: 'code', topic, now })`; `R` usa `srs.retrievability`. Sin `now` usa el reloj inyectado.
- **`pct = 0` solo si no hay eventos `answer` del tema** (banda `unseen`, confianza `low`). Con respuestas es ≥ 1; sin ninguna señal positiva (R, P y U nulas) vale 1.
- **`combine({ R, P, U, E })`** = `100·(0,35R + 0,30P + 0,20U + 0,15(1−E))`; una señal `null` se quita y los demás pesos se reparten en proporción. Redondeo del `pct`: `Math.round`; la banda se calcula sobre el entero (`bandOf(29,5)` = En progreso).
- **Confianza** (`confidenceOf(answers, uKnown)`): Baja < 8 eventos o 1 sesión · Media ≥ 8 eventos y ≥ 2 sesiones · Alta ≥ 20 eventos, ≥ 3 sesiones, rango ≥ 7 días y ≥ 2 tipos de ejercicio. Sin U baja un escalón. Sesión = `sessionId`; sin él, un día local. **Mientras U sea siempre `null` (hasta 5.10) la confianza máxima es «Media».**
- **Topes por descenso** (`caps`): `consecutive_fails` (los dos últimos intentos calificados de una misma tarjeta, `cardId ?? itemId`, son `wrong`/`dont_know`; `skipped` se ignora; un acierto posterior lo levanta) y `recurrent_error` (código recurrente de `errors.recurrent`; lo levanta un `correct`/`almost` del tema estrictamente posterior a su última aparición, o que pase la ventana de 14 días). Con algún tope activo, `pct = min(rawPct, máximo de la banda inferior)`; si la banda es «Inicial» o «Sin ver» no hay banda inferior que mostrar y el % no cambia (los topes igual se listan).
- **`masteryToSophiaVal(pct)`** = `round(pct/25)` recortado a 0–4.
- **`u`** (opcional): `async (topicId, now) → número | null`; se recorta a 0–1 y lo no numérico cuenta `null`. La conecta 5.10. Errores: dependencias ausentes o `topicId`/`now` inválidos lanzan `Error` en español; fallos de la base o de `u` rechazan la promesa (`classifyError`).

## 1.7-T3 — Agregación, consultas y tablero con caché (`core/masteryAgg.js`, `core/masteryBoard.js`) y `tools/mutate.mjs` — 2026-10-25

Sin cambio de la sección 8. `core/mastery.config.js` añade `AT_RISK = { retention: 0.7 }`, `TO_STUDY = { maxBand: 'progress' }` y `LEVELS` (PreA1…C2), también dentro de `MASTERY_CONFIG` (`atRisk`, `toStudy`, `levels`). Cifras de diseño, no de una fuente.

- **Los temas se pasan como dato** (la lista de `content/taxonomy/topics.json`: `{ id, area, level, priority, min_items, status }` + `itemCount?`). Nada lee archivos. Hoy los 248 son `draft`: solo `deprecated` se excluye.
- **`weightOf(topic)`**: `itemCount` si es número finito ≥ 0; si no, `min_items`; si tampoco, 0 (no pesa).
- **`aggregate(topics, results, { by: 'level'|'area', config? })` → `{ by, groups, all, skipped }`.** Grupo = `{ key, topics, seen, weight, avg, pct, band, label, symbol, confidence }`. `avg` = media ponderada de los `pct` de los temas; **los «Sin ver» entran con 0**. `pct = 0` si `seen = 0`; si no, `max(1, round(avg))` (tope 100). `confidence` = nivel medio ponderado (low 0, mid 1, high 2) de los temas vistos, redondeado hacia abajo. Niveles en el orden de `LEVELS` (los desconocidos, al final); áreas por primera aparición. Los temas sin `level`/`area` van a `skipped` y solo cuentan en `all`. Sin temas: `groups: []` y `all` a 0, sin NaN. `results` = lista de resultados de `compute` o `Map`; un tema sin resultado es «Sin ver».
- **`atRisk(topics, results)`** → `[{ topicId, reasons, pct, band, priority, R, E }]`: tema con respuestas y (`R < 0,7` estricto, o `E > 0`, o algún tope en `caps`). Razones `low_retention`, `recurrent_error`, `cap`. Orden: más razones, `pct` ascendente, id.
- **`toStudy(topics, results)`** → `[{ topicId, pct, band, priority, seen }]`: «Sin ver» o banda hasta `maxBand`; orden por `priority` (1 = más urgente; sin dato al final), `pct` ascendente, id.
- **`createMasteryBoard({ mastery, db, clock?, config? })`** → `{ get, results, byLevel, byArea, atRisk, toStudy, invalidate, wrapEvents, stats }`. `get(topicId, now?)` devuelve el resultado de `compute` **congelado y compartido**. **Caché** por tema, válida si coinciden el **día local** de `now`, la **firma de las tarjetas** del tema (`id, due, reps, lapses, suspended, stability, last_review`) y que no se haya invalidado. `wrapEvents(events)` devuelve una copia cuyo `log` invalida los temas del evento (si el `log` falla, no). **Los errores no entran en la firma:** quien los registre sin un `log` posterior llama a `invalidate(ids)`. Un cálculo en curso cuando se invalida no se guarda. `events` real no tiene suscripción: por eso el envoltorio. 2.1 debe registrar los eventos con `board.wrapEvents(events)`.
- **`tools/mutate.mjs`** (93 líneas): `mutate({ root, file, tests, mutants: [[nombre, original, nuevo]], timeoutMs?, run? })` → filas `killed | survived | invalid`; CLI `node tools/mutate.mjs <spec.json|spec.mjs> [--root <dir>]` (salida 0/1/2). Exige que la base pase, restaura siempre (`finally`, `exit`, SIGINT/SIGTERM), deja respaldo temporal y verifica byte a byte.
- Errores de uso: `Error` en español (`topics debe ser una lista`, `` `by` debe ser … ``, `now debe ser una fecha`…).


## 1.7-T4 — Explicabilidad (`core/masteryExplain.js`) — 2026-10-25
- **`explain(result, { config?, codeLabels? })`** → objeto congelado `{ topicId, summary, lines, text }`. `result` = resultado de `mastery.compute`; sin respuestas devuelve «Sin ver…» y `lines` vacío. `summary`: «Tu dominio es 54 % (En progreso), con confianza media: retención 70 %, producción 40 %, uso sin datos, sin errores repetidos.» `lines`: retención, producción, uso, errores repetidos (cada una con su peso efectivo), topes (con «Sin los topes tu porcentaje sería X %…»), confianza y datos descartados (`detail.R.ignored`, `detail.P.ignored`). `codeLabels` opcional `{ CÓDIGO: 'nombre' }`. Un `result` inválido lanza `Error` («explain: result debe ser el resultado de mastery.compute»).
- **`board.explain(topicId, now?, { codeLabels? })`** = `explain(await board.get(topicId, now))`.
- **`mastery.config.js`:** `EXPLAIN = { highRetention: 0.8, lowProduction: 0.5 }` (dentro de `MASTERY_CONFIG.explain`).
- **`compute`:** `detail = { R: { cards, ignored }, P: { attempts, ignored }, E: { codes } }`.


## 1.8-T1 — Candidatos y orden base (`core/session.js`, `core/session.config.js`) — 2026-10-25

Sin cambio de la sección 8 (la firma de `session.build` de 8.15 se desarrolla por tramos; T1 fija la parte de repasos).
- **`build({ now, cards, rng, items?, topics?, deprecatedItemIds?, size?, reviewCap?, reviewsToday?, leechThreshold?, retrievability? })` → `SessionPlan`** (congelado). `now` Date; `cards` lista (8.4); `rng` de `core/rng.js` (obligatorio); `items` lista o `Map` de ítems (da `exerciseType`); `topics` lista `{ id, status }`; `deprecatedItemIds` Set o lista; `size` entero 1–100 (20); `reviewCap` entero ≥ 1 (100); `reviewsToday` entero ≥ 0 (0); `leechThreshold` entero ≥ 1 (8); `retrievability(card, now)` (por defecto la de FSRS; con otro motor pasar `srs.retrievability`). Entradas inválidas lanzan `Error` en español (`session.build: …`).
- **`SessionPlan = { version: 1, generatedAt, requested, count, items, reason, rescue, stats }`.** `items[i] = { cardId, itemId, facet, topics, exerciseType|null, kind: 'review', why: 'overdue'|'rescue', r, daysOverdue }` (`r` con 4 decimales). `reason` es `null` si hay ítems, y `{ code, message_es }` si no (`no_material | only_excluded | daily_cap_reached | nothing_due`). `rescue = { active, overdueCount, threshold, quota, message_es }`. `stats = { overdue, selected, left, notStarted, notDue, invalid, duplicates, excluded: { suspended, leech, deprecated_item, deprecated_topic } }`.
- **Orden:** normal, más atrasada primero; rescate, menor retrievabilidad primero. Cupo del día = `reviewCap` (o el cupo de rescate, 0,5 × `reviewCap`) − `reviewsToday`; el plan tiene `min(size, cupo, vencidas)` ítems. Desempates: id → mezcla con `rng` → orden estable.
- **Todavía no:** tarjetas nuevas, cupos por área y `energy` (T2), intercalado (T3), progresión, `topicFocus` y `errorFocus` (T4). Los parámetros de T2–T4 se ignoran si se pasan.
- **`SESSION_CONFIG = { size: 20, maxSize: 100, reviewCap: 100, leechThreshold: 8 }`** y **`EMPTY_REASONS`** en `core/session.config.js`.

## 1.8-T2 — Nuevas, cupos y energía (`core/session.js`, `core/session.config.js`) — 2026-10-25

Sin cambio de la sección 8. Amplía la ficha 1.8-T1:
- **Parámetros nuevos de `build`:** `minutes?` (entero 1–600), `energy?` (`'low'|'mid'|'high'`; otro valor se ignora → `'mid'`), `newCap?` (entero ≥ 0, por defecto 10), `newToday?` (entero ≥ 0), `areas?` (lista de textos). `topics[i]` puede traer `area` y `priority`.
- **`SessionPlan`** gana `energy` y `newBudget`; `requested` es el tamaño efectivo (tras `minutes` y `energy`). `items[i].kind` puede ser `'new'` (con `why: 'new'`, `r: null`, `daysOverdue: 0`). `stats` gana `newSelected`, `deferredHeavy`, `newSkipped`.
- **`reason.code`** gana `new_cap_reached` y `energy_deferred`.
- **`session.config.js`:** `SESSION_CONFIG` añade `newCap`, `maxNewTopicsPerArea`, `itemsPerMinute`, `maxMinutes`, `defaultEnergy`; nuevos `ENERGY_LEVELS` y `HEAVY_FAMILIES`.
- **Todavía no:** intercalado (T3), progresión, `topicFocus` y `errorFocus` (T4); estos dos se ignoran si se pasan.

## 1.8-T3 — Intercalado y variedad (`core/sessionInterleave.js`, `core/session.js`) — 2026-10-25

Sin cambio de la sección 8. Amplía las fichas 1.8-T1 y T2:
- **`interleave(items, { maxRun = 2, windows = [6, Infinity], budget = 50000 })` → `{ items, moved, window, maxRun, violations: { topic, type } }`.** Pura y determinista; no cambia el conjunto de ítems. También exporta `runExcess(keys, limit)`.
- **`SessionPlan.items[i]`** gana `topic` (primer tema no retirado, o `null`). El orden de `items` ya viene intercalado: nunca más de 2 seguidos del mismo `topic` ni del mismo `exerciseType` cuando existe algún orden que lo permita.
- **`stats.interleave = { moved, window, maxRun, violations: { topic, type } }`** (congelado).
- **`SESSION_CONFIG`** añade `maxRun`, `interleaveWindows`, `interleaveBudget`.
- **Todavía no:** progresión reconocimiento → producción, `topicFocus` y `errorFocus` (T4); se ignoran si se pasan.

## 1.8-T4 — Progresión y enfoques (`core/sessionProgression.js`, `core/sessionFocus.js`, `core/session.js`) — 2026-10-25

Sin cambio de la sección 8. Amplía las fichas 1.8-T1 a T3. Todo es opcional: sin los parámetros nuevos `build` se comporta como en T3.
- **`build({ …, mastery?, topicFocus?, errorFocus?, errors? })`.**
  - `mastery`: dominio por tema (Map tema→pct, objeto, o lista de resultados de `createMastery(...).compute` con `{ topicId, pct }`). Con él, las tarjetas NUEVAS de cada tema mezclan reconocimiento y producción según la banda (`PROGRESSION.shareByBand`): sin ver/inicial 0, en progreso 1 de cada 3, sólido 1 de cada 2, dominado 2 de cada 3. Con parte 0 la producción entra solo cuando se acaba el reconocimiento. Solo ordena; nunca excluye. Un tema sin dato cuenta como 0. Los repasos vencidos no se tocan.
  - `topicFocus` (texto): solo tarjetas con ese tema. Orden: vencidas, nuevas (el cupo de temas por área no aplica; el tope diario sí) y, si queda hueco y no hay rescate, práctica (`why: 'practice'`, tarjetas aún no vencidas, de menor a mayor retrievabilidad, mezcladas con la progresión). Rescate y tope de repasos se calculan sobre ese tema. El intercalado vigila solo el tipo.
  - `errorFocus` (`true`) con `errors` (registros de `core/errors.js`; obligatorio): solo tarjetas ya empezadas. Primero las de ítems con errores propios (por puntuación), luego las de temas con errores sin ítem. `why: 'error'`. Sin nuevas, sin rescate, sin descontar los repasos de hoy. Se puede combinar con `topicFocus`.
- **`SessionPlan.items[i]`** gana `production` (`true | false | null` si el tipo no se conoce) y `errorScore` (`null` salvo en `errorFocus`). `why` puede ser también `practice` o `error`.
- **`stats`** gana `progression { enabled, ignored, newProduction, newRecognition }`, `errorFocus { used, ignored, candidates }`, `outOfFocus` y `practice`.
- **Razones de plan vacío nuevas:** `topic_empty`, `no_errors`, `errors_no_cards` (textos neutros en `EMPTY_REASONS`).
- **Errores de entrada (lanzan):** `topicFocus` no es texto no vacío; `errorFocus` no es booleano; `errorFocus: true` sin `errors`; `errors` no es lista; `mastery` no es Map, objeto ni lista. Las entradas ilegibles dentro de `mastery` y `errors` se ignoran y se cuentan.
- **Para 2.1:** `why: 'practice'` y `why: 'error'` son repasos que pueden no estar vencidos; quien los califique decide si actualizan el calendario del SRS.

## 1.8-T5 — Escenarios y cierre (`tests/session.ca.test.mjs`) — 2026-10-25

Sin cambio de la sección 8 ni de las fichas 1.8-T1 a T4: este tramo solo añade pruebas y cierra la subparte (0.16.0). Contrato vigente de `build`: ver la ficha 1.8-T4 y el encabezado de `core/session.js`. Los CA 1–6 de la 1.8 quedan cubiertos (tabla en `DECISIONS.md`, sección 1.8-T5).

## 1.9-T1 — Actividad y precisión (`core/stats.js`) — 2026-10-25

Sin cambio de la sección 8. Funciones puras; `events` = lista de eventos (solo cuentan los `answer` con resultado `correct | almost | wrong | dont_know`); `range` = `{ from?, to? }` con días `AAAA-MM-DD` reales, inclusivos, sobre `day`.
- `activityByDay(events, range?) → [{ day, minutes, items, ms }]` (días con actividad, cronológico).
- `accuracyByType(events, range?)`, `accuracyByTopic(events, range?)`, `accuracyByArea(events, topics, range?) → [{ key, attempts, correct, almost, wrong, dontKnow, accuracy }]` (orden por `key`; `accuracy` en 0–1; `topics` = lista de `{ id, area }`; área desconocida → `unknown`).
- `avgTimeByType(events, range?) → [{ type, samples, avgMs }]`.
- Vacío → `[]`. Eventos que no son lista, temas que no son lista o un rango mal formado → `Error` en español. Razones y roturas: `DECISIONS.md`, sección 1.9-T1.

## 1.9-T2 — Tarjetas y pronósticos (`core/stats.js`) — 2026-10-25

Sin cambio de la sección 8. Se añaden a `core/stats.js` (firmas completas en su cabecera):
- `cardsByLevel(cards) → [{ level: 1..5, count }]` (state ≠ 0, no suspendidas; `[]` sin tarjetas contables).
- `forecastReviews(cards, now, { days = 14 }?) → [{ day, count, overdue }]` (días locales; las vencidas van en hoy).
- `retentionReport(events, { target = 0.9, from?, to? }?) → { target, reviews, retained, actual, series: [{ day, reviews, retained, actual }] }` (pasa el historial completo; `actual` es `null` sin repasos).
- `heatmap(topics, results, { config? }?) → { areas, levels, cells: [{ area, level, topics, seen, weight, avg, pct, band, label, symbol, confidence }] }`.
- `masteryTrend(snapshots, topics, { by = 'area' }?) → { by, days, series: [{ key, points: [{ day, pct, seen }] }] }` (fotos `{ day, results }`; hoy nada las guarda).

## 1.9-T3 — Informativos y cierre (`core/stats.js`, `core/stats.config.js`) — 2026-10-25

Sin cambio de la sección 8. Se añaden a `core/stats.js` (firmas completas en su cabecera):
- `plannedVsDone(events, plans, range?) → { days: [{ day, plannedMinutes, doneMinutes, differenceMinutes }], totals: { plannedDays, plannedMinutes, doneMinutes, differenceMinutes, unplannedMinutes, plannedHours, doneHours } }`. `plans = [{ day, minutes }]` con `minutes` de 0 a 1440 (fuera de ese rango, el plan se ignora); el último plan de un día sustituye. Un día con actividad y sin plan lleva `plannedMinutes` y `differenceMinutes` en `null`. Solo informativo: sin campos de deuda ni atraso.
- `xpSummary(events, { from?, to?, config?, enabled? }?) → null | { xp, attempts, byDay: [{ day, xp }], rank: { index, id, label, min }, next: null | { id, label, min, remaining }, progress }`. **`null` cuando está desactivado** (`enabled: false` en la llamada o `enabled: false` en la configuración; la llamada manda) y no calcula nada. Nunca resta.
- `core/stats.config.js` exporta `STATS_CONFIG = { xp: { enabled, perResult: { correct, almost, wrong, dont_know }, ranks: [{ id, label, min }] } }`, congelado a fondo. Valores PROVISIONALES.
- Topes: `ms` > 86 400 000 no suma (el intento cuenta); plan > 1440 min se ignora; XP por intento 0–1000; `min` de rango 0–1 000 000 000 (si no, `Error` en español).
- Entradas mal usadas (no-lista, rango mal formado, configuración inválida) → `Error` en español; vacío → estructuras vacías. Razones, roturas y tabla de evidencia: `DECISIONS.md`, sección 1.9-T3.


## 1.10-T1 — Base y proveedores (`core/ai/`) — 2026-10-25

Sin cambio de la sección 8. Firmas completas en la cabecera de cada archivo.
- `createAi({ getConfig, fetchFn, clock? }) → { complete(req), available(), providerId() }`. `getConfig() → { mode: 'auto'|'mechanical', provider, model, endpoint?, key }` se lee en cada llamada. `configFromSettings(settings, { endpoint? })` lo arma desde `core/settings.js` (`aiMode`, `aiProvider`, `aiModel`, `aiKey`).
- `complete({ task, messages, json?, schema?, maxTokens?, temperature?, signal? })`: `task` `^[a-z][a-z0-9_.-]{0,59}$`; 1–40 mensajes `{ role: system|user|assistant, content }` (≤ 100 000 caracteres en total); `maxTokens` entero 1–8000 (800); `temperature` 0–2 (0,2); `schema` implica `json`. Un uso incorrecto lanza `Error` en español.
- Éxito `{ ok: true, text, json?, provider, model, usage: { promptTokens, completionTokens }, ms }`; fallo `{ ok: false, reason, provider, ms, status?, text? (bad_json, schema), errors? (schema) }`. Ningún resultado contiene la clave.
- `parseJson(text) → { ok, value } | { ok: false, reason: 'bad_json' }`; `validate(value, schema) → { ok, value } | { ok: false, errors }` (tipos, `enum`, `required`, `properties`, `additionalProperties` (por defecto no), `items`, mínimos y máximos).
- Pendiente: T2 cola, reintentos, tiempo límite y mensajes; T3 caché, `ai_call` y prompt base; T4 verificación de modelo y límites.

## 1.10-T2 — Cola y errores (`core/ai/queue.js`, `messages.js`) — 2026-10-25

Sin cambio de la sección 8. Añade a lo de 1.10-T1:
- `createAi({ getConfig, fetchFn, clock?, concurrency?, maxPending?, maxRetries?, emptyRetries?, baseDelayMs?, maxDelayMs?, maxTotalMs?, timeoutMs?, rng?, timers? })`. Defaults: 2 · 50 · 3 · 1 · 500 · 8000 · 45000 · 20000 (ms). Valores fuera de rango lanzan `Error` en español al crear. `queueStats() → { running, waiting, concurrency }`.
- `complete(...)` admite `timeoutMs` (entero 1000–300000). Resultado: todo fallo lleva `error` (mensaje amable) y todo resultado `attempts` (intentos de red hechos; 0 con `none`); `repaired: true` si hubo reparación de JSON; `retryAfterMs` en un `rate_limit` o `server` si el servidor lo pidió. Motivos nuevos: `timeout`, `queue_full`.
- Reintentos: `rate_limit`, `server`, `network`, `timeout` hasta `maxRetries`; `empty` hasta `emptyRetries`; nunca `auth`, `bad_request`, `bad_response`, `aborted`. JSON inválido: una sola reparación.
- `createQueue(opts).run(attempt(signal), { signal?, timeoutMs? })`, `backoffDelay`, `checkTimeout`, `friendlyMessage(reason)`, `AI_MESSAGES`.
- Pendiente: T3 `cached`, `ai_call`, prompt base, `available()` fino; T4 verificación de modelo y límites.

## 1.10-T3 — Caché, disponibilidad y registro (`core/ai/cache.js`, `escape.js`, `prompts/system.base.js`) — 2026-10-25

Sin cambio de la sección 8 (no hay campos nuevos en eventos ni en la base). Añade a lo de 1.10-T1 y 1.10-T2:
- `createAi({ ..., cache?, logEvent?, rateLimitCooldownMs? })`: `cache` = resultado de `createCache` (sin él no hay caché); `logEvent(ev) → promesa` (p. ej. `events.log`; sin él no se registra); `rateLimitCooldownMs` entero 0–900000 (60000). Valores inválidos lanzan `Error` en español al crear.
- Petición `complete(...)`: `cache?: boolean` (`false` ni lee ni escribe), `refresh?: boolean` (no lee, escribe), `tutor?: true | { level? }` (antepone el prompt base; cuenta como un mensaje más, máx. 40).
- Resultado: `cached: true` si salió de la caché (`attempts: 0`); `safe: { text?, json? }` con el texto ya escapado: **la interfaz muestra `safe.*` o usa `textContent`, nunca `text`**.
- `availability() → { available: boolean, reason: null | 'no_ai' | 'no_key' | 'no_model' | 'bad_endpoint' | 'auth' | 'rate_limit', retryAt? }`; `available()` = `availability().available`. Sin red y sin efectos; nunca lanza.
- `createCache({ db, clock?, hashFn?, maxEntries?, ttlMs? }) → { key(req, model), get(key), set(key, value, { task, model }), clear(), size(), stats() }` (congelado). Registro en `generated`: `{ id: 'aic_<sha256>', kind: 'ai_cache', task, model, createdAt (ISO), value: { text, json?, usage? } }`. `maxEntries` 1–100000 (500); `ttlMs` 1 s–10 años (30 días). `get/set/clear/size/key` nunca lanzan; `stats() → { hits, misses, writes, evicted, errors }`.
- `escapeHtml(valor)`, `cleanText(valor)`, `escapeDeep(valor)` (`core/ai/escape.js`): un valor que no es texto da `''`; `escapeDeep` devuelve `null` en lo que excede 12 niveles o 5000 nodos.
- `buildSystemPrompt({ level?, json? }) → string`; `SYSTEM_BASE_VERSION = 1`.
- Evento `ai_call` (8.6): `type: 'ai_call'`, `mode: 'ai'`, `exerciseType` = tarea (`.` y `-` → `_`, ≤ 40), `ms`, `responseRaw` = `ok=<0|1> cached=<0|1> attempts=<n> tokens=<n> est=<0|1> [reason=<motivo>]`. Sin clave, sin prompt, sin texto de la IA. Se registra solo con llamada de red o respuesta de la caché.
- Pendiente: T4 verificación del modelo por defecto y de los límites de Groq.

## 1.10-T4 — Verificación y cierre (`core/ai/providers/groq.js`) — 2026-10-25

Sin cambio de la sección 8. Corrige y añade a lo de 1.10-T1 a T3:
- **`GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'`** (verificado el 2026-10-25; antes vacío). Un modelo vacío o con solo espacios en la configuración usa ese valor: **ya no hay `no_model`** en el camino normal (el motivo sigue existiendo como defensa), `availability()` no lo devuelve con modelo vacío y `available()` solo exige clave, modo `auto`, proveedor `groq` y endpoint válido.
- El cuerpo enviado lleva `reasoning_effort: 'low'` solo si el modelo empieza por `openai/gpt-oss-`; en otros modelos no se envía el campo.
- `GROQ_FREE_LIMITS = { verified, model, rpm, rpd, tpm, tpd }` (congelado): `{ '2026-10-25', 'openai/gpt-oss-120b', 30, 1000, 8000, 200000 }`. Solo informativo.
- La clave de caché usa el modelo efectivo (el defecto si el de Ajustes está vacío).
- Pendiente fuera de esta subparte: 5.1 (`aiEndpoint` en Ajustes y host de Groq en la CSP).

## 1.11-T1 — Tokenizador (`core/tokenize.js`) — 2026-10-25

Sin cambio de la sección 8 (el `whitelist.check` de 8.15 llega en T3). Firmas completas en la cabecera del archivo.
- `tokenize(text) → Token[]`: pura, nunca lanza (lo que no es texto ni número finito cuenta como `''`; un número finito se trata como su texto), sin tope de largo (costo lineal: 1 millón de caracteres en menos de 1 s en las pruebas; las cadenas hostiles `U.U.U.…`, `a-a-a-…` y similares también).
- `Token = { text, start, end, kind, norm, parts, hyphenated, cap, sentenceStart }`. `text` es el trozo EXACTO del original y `text.slice(start, end) === text` siempre (posiciones UTF-16); `norm` es minúsculas, NFC, sin invisibles, con apóstrofo y guion rectos.
- `kind`: `word` (una o más palabras: `don't`, `well-known`, `5-year-old`), `number` (`42`, `3.5`, `1,000`, `10:30`, `2026-10-25`, `3rd`, `1990s`, `10am`), `acronym` (solo con puntos: `U.S.`, `U.S.A.`, `e.g.`, `a.m.`; `NASA` y `TV` son palabras) y `alnum` (letras con cifras que no son número: `mp3`, `4x4`, `B2B`).
- `parts`: las palabras a buscar en la lista, en minúsculas. `don't` → `['do','not']`, `well-known` → `['well','known']`, `5-year-old` → `['year','old']`. **Vacío si `kind` no es `word`.** `'s` y `'d` no aportan palabra (pueden ser `is`/`has`/`would`/`had` o posesivo).
- `cap`: `lower | title | upper | mixed | none` (`none` = número o sin letras; `I` suelto es `title`). `sentenceStart`: primero del texto o precedido por `. ! ? …` o salto de línea (límite conocido: `Mr. Smith` marca `Smith`). Con `cap` sirven para el nombre propio opcional de T3.
- Emoji, símbolos y puntuación no son tokens y las palabras de alrededor se conservan; `—` y `–` separan, `- ‐ ‑ ‒ −` unen; apóstrofos `’ ‘ ʼ ´ ` ′` valen como `'` (igual que `normalize`); un apóstrofo o guion en el borde de una palabra se ignora.
- `splitContraction(word) → string[]` (lista nueva cada vez): `n't`, `'re`, `'ve`, `'ll`, `'m` añaden `not`, `are`, `have`, `will`, `am`; irregulares `can't`, `won't`, `shan't`, `ain't` (→ `be not`), `let's` (→ `let us`), `y'all` (→ `you all`), `o'clock` (→ `clock`); apilados (`shouldn't've` → `should not have`); si queda un apóstrofo (`rock'n'roll`) se parte en él. `TOKEN_KINDS` (congelado) lista los cuatro tipos.
- Para T2 y T3: solo `parts` se busca en `lemmas.json`; `number`, `acronym` y `alnum` no tienen partes y T3 decide si cuentan (la propuesta de T1: no cuentan ni como conocidos ni como desconocidos). Una parte de una letra (`T-shirt` → `t`) la resuelve T2. No hay URL ni correo: se parten en palabras.

## 1.11-T2 — Lematizador y conocidos (`core/lemmas.js`, `core/whitelistKnown.js`, `core/whitelist.config.js`) — 2026-10-25

Sin cambio de la sección 8 (`whitelist.check` de 8.15 llega en T3). Firmas completas en la cabecera de cada archivo.
- `createLemmaTable(json) → LemmaTable`: valida `lemmas.json` (schema 1; `lemmas` 1–20.000; cada lema en minúscula, sin repetir, con `pos` y `band` válidos; hasta 40 `forms` de palabra en minúscula, con un apóstrofo interno permitido) y lanza `Error` en español que empieza por «lemmas.json:». Tabla inmutable: `size`, `lemmasOf(form)`, `has(lemma)`, `info(lemma)`, `analyze(token)`.
- `lemmasOf(form) → string[]`: los lemas posibles de una forma, **ordenados**, en una lista nueva cada vez; `[]` si no está o si no es texto. El lema cuenta como forma de sí mismo; no se deja engañar por `constructor` o `__proto__`. **No hay lematizador por sufijos**: lo que la tabla no lista no se adivina (`dogz` → `[]`).
- Una forma con dos lemas (`left` → `['leave','left']`) se considera conocida si CUALQUIERA lo es (nota C10).
- `analyze(token) → { parts: [{ part, lemmas }], listed }`: `parts` sale de `token.parts` de `tokenize` (solo si `kind` es `word`); `listed` es `true` solo si hay partes y TODAS tienen algún lema. Números, siglas y códigos dan `parts: []` y `listed: false` (T3 decide cómo se cuentan; propuesta de T1: no cuentan). Una parte sin lema queda con `lemmas: []` (`T-shirt` → la parte `t` no está; `Bucaramanga` tampoco): T3 la trata como desconocida y devuelve la forma original del token.
- `loadLemmas(fetchFn, { path?, timeoutMs?, maxBytes? }) → { ok:true, table } | { ok:false, error:{ code, message } }`: nunca lanza. Códigos: `NO_FETCH`, `NOT_FOUND` (404), `HTTP`, `NETWORK`, `TIMEOUT` (aborta la señal), `TOO_BIG`, `BAD_JSON`, `BAD_LEMMAS`. Por defecto `content/taxonomy/lemmas.json`, 15 s, 5 MB. El mensaje nunca lleva la ruta ni el contenido.
- `knownLemmas(db, opts) → Promise<Set<string>>` y `knownLemmasDetailed(db, opts) → { lemmas, bySource:{ base, words, topics }, topicsUsed, topicsSkipped:[{ topic, reason:'compute'|'pct' }], unknown }`. `opts`: `table` (obligatorio), `mastery` (`createMastery(...)`), `items` (arreglo o función asíncrona de ítems de los paquetes), `threshold` (0–100; por defecto 60, PROVISIONAL), `base` (por defecto `A1_BASE`; `false` la apaga), `now`.
- Fuentes: (1) lista base A1 (`A1_BASE`, 265 lemas, todos presentes en `lemmas.json`); (2) almacén `words` con estado `known` o `learning` (el id es el lema; se añade tal cual, esté o no en la tabla); (3) lemas de `prompt_en` y `accept` de los ítems de cada tema con `mastery.compute(topic, now).pct ≥ umbral`. Los distractores no cuentan. Cada tema se calcula una vez. Sin `mastery` o sin `items`, la fuente (3) se omite.
- Una palabra con estado `unknown` en `words` se **quita de las tres fuentes** (es lo que la persona dijo). Un tema cuyo dominio falla o no es número se salta y queda en `topicsSkipped`: nunca se da por sabido lo que no se pudo medir. Los errores de la base se propagan. Argumentos incorrectos lanzan `Error` en español. El conjunto devuelto es nuevo en cada llamada.
- Los paquetes no viven en la base (solo `content_cache` con ids): quien llama carga los ítems con `content.loadPack` y los pasa en `items`. Esa conexión la hace quien cablee la app (5.2/6.4), no T2.

## 1.11-T3 — Chequeo y cierre (`core/whitelist.js`) — 2026-10-25

Sin cambio de la sección 8: `whitelist.check(text, knownLemmas) → {unknown[], pctKnown}` de 8.15 se respeta (el resultado trae además campos de apoyo). Firmas completas en la cabecera del archivo.
- `createWhitelist({ table, properNouns? }) → { check, markNew, isWithinTarget }` (congelado). `table` = `LemmaTable` de T2; sin ella lanza `Error` en español. `properNouns`: `'ignore'` (por defecto) o `'count'`; también se puede pasar por llamada.
- `check(text, known, opts?)`: `known` es un `Set` de lemas en minúscula (lo que da `knownLemmas`) o un arreglo de textos (se recortan y pasan a minúscula); otra cosa lanza. Un texto que no es texto cuenta como vacío. Pura, nunca toca la base.
- Qué cuenta: cada palabra, UNA VEZ POR APARICIÓN. Es conocida si CADA parte (`don't` → do, not) tiene algún lema en `known`, o si la propia parte está en `known` (las palabras de `words` entran tal cual). Una forma con dos lemas (`left`) vale si cualquiera lo es. **No cuentan** (ni conocidas ni desconocidas): números (`3rd`, `1990s`), siglas con puntos (`U.S.`), códigos (`mp3`) y nombres propios.
- Nombre propio (modo `ignore`): mayúscula inicial o mezclada, la tabla no lo lista y no está en `known`, y NO está al inicio de frase; al inicio de frase solo si el mismo texto aparece como nombre en otro lugar. `ZELDA` (todo mayúsculas) no es nombre. Límites: `T-shirt` en medio de frase se toma por nombre; una palabra en camelCase sin lema también.
- Resultado de `check`: `pctKnown` es una fracción 0..1 sin redondear (`null` si no hay palabras: vacío, solo emoji o solo números); `total`, `knownCount`, `unknownCount`; `ignored: { numbers, acronyms, codes, names }`; `names` (textos de los nombres omitidos, una vez cada uno); `unknown`: una entrada por palabra distinta (clave en minúsculas), en orden de aparición: `{ text` (forma original de la 1.ª aparición), `norm`, `lemma` (probable, de la 1.ª parte desconocida), `lemmas` (candidatos de las partes desconocidas, sin repetir), `parts` (solo las desconocidas, `{ part, lemmas, listed }`), `listed`, `count`, `start`, `end }`.
- `isWithinTarget(pct, { min = 0.90, max = 0.95 } = {}) → boolean`: ambos extremos incluidos; `null`, `NaN`, texto o fuera de 0..1 → `false`; un rango inválido (fuera de 0..1 o `min > max`) lanza `Error`.
- `markNew(text, known, opts?) → { marks, segments, newWords, pctKnown, total }`: `marks` = una por aparición `{ start, end, text, norm, lemma }`; `segments` parte TODO el texto en tramos seguidos `{ text, start, end, isNew }` sin tramos vacíos (para pintar con `textContent`); `newWords` = la lista de estudio (las mismas entradas de `unknown`).
- Para 5.2, 5.7 y 6.4: reciben `check` ya ligado a la tabla; la tabla y los conocidos los carga quien cablee la app (`loadLemmas`, `knownLemmas` con `items` de los paquetes).

## 1.12-T1 — Respaldo con vista previa y `clear(store)` — 2026-10-25

Ampliación (no cambia 8.13 ni el formato `glossa-db`; 8.15 solo da firmas mínimas). Firmas completas en la cabecera de `core/sync.js` y `core/db.js`.
- **`clear(store) → Promise<número>`** (ambos motores; también `t.clear(store)` en `tx`): vacía el almacén y devuelve cuántos registros había (0 si estaba vacío; repetirlo es seguro). Las claves reservadas (`meta.schemaVersion`) se conservan y no cuentan. Dentro de `tx` respeta alcance (`TX_SCOPE`), atomicidad (si `fn` lanza, no se borra nada) y lectura de lo propio (después de `t.clear` el almacén se ve vacío y se puede volver a escribir). Almacén desconocido → `UNKNOWN_STORE`; sin abrir → `NOT_OPEN`; cerrado → `CLOSED`. Va en orden con el resto de operaciones aunque no se espere.
- **Quién lo usa:** `events.clearAll()`, `wipeAll()` de `app/dataTools.js` y el modo reemplazar de `importAll` (en los dos motores). Sustituye a lo descrito en 1.1-4A sobre el coste de borrar fila a fila (medidas en `DECISIONS.md`, 1.12-T1).
- **`createSync({ db, clock?, schema?, schemaVersion?, migrations? })`:** `schema`, `schemaVersion` y `migrations` valen por defecto lo de `core/db.js` y `core/migrations.js`; solo se pasan si la base se creó con otros (pruebas de migración).
- **`previewBackup(text, { mode = 'replace', keepSecrets = true }) → { format, schemaVersion, exportedAt|null, migratedFrom|null, mode, hasSecrets, stores, totals }`:** no escribe nada y lanza exactamente lo mismo que `importBackup` (`BAD_IMPORT`, `NEWER_VERSION`, `MIGRATION`, `UNAVAILABLE`). `stores` trae solo los almacenes del respaldo: `{ before, incoming, added, overwritten, unchanged, removed, kept, after }`. `removed` y `kept` solo existen en modo reemplazar (en fusionar son 0); `kept` = claves secretas actuales que el respaldo no trae y se conservan con `keepSecrets`; `after = before − removed + added` y coincide con lo que queda tras importar (lo comprueba una prueba en ambos modos). `meta.schemaVersion` nunca cuenta. `totals` suma `incoming`, `added`, `overwritten`, `unchanged`, `removed`, `kept`.
- **`exportBackup({ includeSecrets? }) → { json, filename, counts, includesSecrets }`:** sin `includeSecrets: true` (exacto) no sale ninguna clave del dispositivo, aunque el motor la entregue.
- **`importBackup(text, { mode = 'replace', keepSecrets = true }) → { stores, migratedFrom, total, mode }`:** igual que antes más `mode`; un modo desconocido es `BAD_IMPORT` y se comprueba antes de leer el texto. Sigue siendo atómico y por defecto conserva las claves del dispositivo.
- **Todavía no hay pantalla de vista previa:** Ajustes sigue importando como en la 0.8; quien la cablee llama a `previewBackup` y pide confirmación antes de `importBackup`. Los bloques del chat (`makeChatBlock`, `parseChatBlock`) llegan en 1.12-T2.

## 1.12-T2 — Bloques del chat (`core/syncChat.js`, `core/sync.js`) — 2026-10-25

Cumple 8.14 y 8.15 (`sync.makeChatBlock(kind, payload)`, `sync.parseChatBlock(text)`). Contenido por tipo PROVISIONAL (ver `DECISIONS.md`). Firmas completas en la cabecera de `core/syncChat.js`.
- **Formato:** `=== SOPHIA-EN-SYNC v1 ===` / `tipo: <kind>` / `generado: <ISO>` / JSON con sangría de 2 espacios / `=== FIN ===`. El JSON sale con los saltos de línea escapados, así que un texto con «=== FIN ===» dentro no corta el bloque.
- **`makeChatBlock(kind, payload, { now? }) → string`:** `kind ∈ BLOCK_KINDS` (`llevar_al_chat`, `errores`, `estado`, `bitacora`). Valida y normaliza el contenido; lanza `ChatBlockError` (`code`, `friendly` en español) si el tipo o el contenido no valen o `now` no es una fecha. En `createSync`, `now` por defecto es el reloj inyectado.
- **`parseChatBlock(text) → { ok:true, kind, generatedAt|null, payload, others } | { ok:false, error:{ code, message } }`:** nunca lanza. Códigos: `NO_TEXT`, `TOO_BIG`, `NO_BLOCK`, `NO_END`, `BAD_VERSION`, `NEWER_VERSION`, `BAD_KIND`, `BAD_DATE`, `NO_JSON`, `BAD_JSON`, `HOSTILE`, `BAD_PAYLOAD`. Lee el primer bloque; `others` = cuántos bloques más venían después. `generado:` es opcional al leer (si falta, `generatedAt` es `null`; si está y no es una fecha, `BAD_DATE`); al armar siempre se escribe. `payload` sale ya normalizado y limpio (objetos planos nuevos, textos recortados). **Cita (Administrador, 2026-10-26):** si el JSON no se lee y alguna línea del bloque empieza por `>`, `BAD_JSON` lleva el mensaje «Parece una cita: quita los '>' y vuelve a pegar.»; el código no cambia.
- **Tolerancia:** texto antes y después; vallas ``` y ~~~ dentro o fuera; citas `>` y negritas en las marcas y en `tipo:`/`generado:`; mayúsculas; espacios raros, NBSP, BOM y ancho cero; CRLF y CR suelto; comillas curvas `“ ” „ ‟ « »` como comillas del JSON (solo si el JSON tal cual no se lee); `tipo:` y `generado:` en cualquier orden y repetidos (manda el primero).
- **Contenido por tipo** (claves desconocidas se rechazan): `llevar_al_chat` `{ tema?, item?, respuesta?, errores?: [{ code, original, correction? }] (≤ 10), dominio?: { pct 0–100, banda? }, mensaje? }` · `errores` `{ errores: [{ original (1–500), code, correction?, context?, topics?, origin?, kind?, impact?, itemId?, ts? }] (1–200), temas?: [{ id, estado }] (≤ 200) }`, cada error sale con `topics: []` e `itemId: null` por defecto y `source: 'chat'` (un `source` distinto de `chat` se rechaza) · `estado` `{ dia? (AAAA-MM-DD), areas?: [{ area, pct }], temas?: [{ id, pct?, banda? }], notas? }` · `bitacora` `{ texto }` (≤ 20.000 caracteres).
- **Seguridad:** se rechazan (`HOSTILE`) las claves `__proto__`, `constructor` y `prototype` en cualquier nivel, más de 12 niveles y más de 20.000 nodos; el texto entero se limita a 300.000 caracteres. Ningún tipo admite un campo libre, así que una clave del dispositivo no puede viajar en un bloque. `validateChatPayload(kind, payload) → { ok, payload | error }` hace la misma validación sin armar texto.
- **Para 1.12-T3 (ya resuelto en la ficha siguiente):** `errores` se importa con `errors.record`, que solo es idempotente con el mismo `ts`; por eso T3 da a cada error una fecha estable (ver `DECISIONS.md`, nota de 1.12-T2). `bitacora` lleva el texto armado por `buildLogText`.
- **No hay pantalla:** quien cablee «Llevar al chat» o «Importar» llama a `makeChatBlock` / `parseChatBlock` y muestra `error.message` tal cual.

## 1.12-T3 — Errores del chat y bitácora (`core/syncImport.js`, `core/syncLog.js`, `core/sync.js`) — 2026-10-25

Cumple 8.14 y 8.15 para los bloques `errores` y `bitacora`. Firmas completas en la cabecera de cada archivo.

**`createChatImport({ db, errors, catalog, clock?, topics?, board? }) → { previewErrors(text), importErrors(text) }`** (objeto congelado; lanza `Error` en español si falta `db.query`, `errors.record`, `catalog.get`, el reloj es inválido, `topics` no es lista o `board` no tiene `invalidate`).
- `topics`: lista `[{ id, status }]` de la taxonomía, solo para reconocer ids y estados de `temas`. `board`: tablero de dominio; tras importar se llama a `board.invalidate(temas de los errores contados)`.
- **`previewErrors(text)`** → `{ ok:true, kind:'errores', generatedAt, items, totals, canImport, topicAdjustments, warnings, others }` o `{ ok:false, error:{ code, message } }`. No escribe. Decide con las mismas reglas que `errors.record` (`validateErrorInput`, `errorKey`, `seenOf`) y simula en memoria los duplicados del propio bloque. Si falla la lectura de la base, lanza el `DbError`. **Sin fecha (Administrador, 2026-10-26):** un error sin `ts` propio y sin `generado:` se omite y `warnings` suma «N errores omitidos por no traer fecha.» (singular «1 error omitido por no traer fecha.»).
- **`importErrors(text)`** → lo mismo más `applied` (`new + repeat`) y `stopped` (`null` o `{ index, message }`). Informa lo que pasó de verdad, no lo que dijo la vista previa.
- **Texto que no sirve:** nunca lanza; devuelve `{ ok:false, error }` con el código de `parseChatBlock` o `WRONG_KIND` si el bloque es de otro tipo. Ningún mensaje lleva texto escrito por la persona.
- **Ítem:** `{ index, status, code, original, ts, tsSource, topics, countAfter, message? }`. `status`: `new` (error nuevo) · `repeat` (ya existía: una ocurrencia más) · `replay` (esa ocurrencia ya estaba: no cambia nada) · `invalid` (se omite; `message` dice por qué) · `skipped` (solo al importar: no se llegó a guardar porque la base falló). `tsSource`: `own` (el `ts` del error), `block` (el `generado:` del bloque) o `null`.
- **Totales:** `{ new, repeat, replay, invalid, skipped }`. `canImport = new + repeat > 0`.
- **Fecha estable:** cada error usa su `ts` o, si no lo trae, el `generado:` del bloque. Sin ninguno de los dos queda `invalid`. La hora de importar no interviene.
- **Idempotencia (CA 2):** reimportar el mismo bloque da todo `replay`. Dos errores iguales dentro de un bloque (mismo código, texto e ítem) son una ocurrencia. Los errores se procesan de la ocurrencia más vieja a la más nueva (a igual fecha, en el orden del bloque), así que el orden dentro del bloque no cambia el resultado. Como `errors` solo recuerda las `ERROR_LIMITS.seen` (10) fechas más recientes, una fecha más vieja que todas ellas, con 10 ya recordadas, se toma como ya contada (`replay`): se prefiere perder una ocurrencia remota a contarla de nuevo en cada reimportación. Un `replay` informa el conteo final de su error.
- **Fallos a medias:** cada error se guarda en su propia transacción con `errors.record`. Lo inválido se omite y se lista. Si la base falla (`DbError`), `stopped = { index, message }` (mensaje amable), el resto queda `skipped` y repetir el bloque termina el trabajo sin duplicar. Un error que no sea de la base se propaga. Un `ErrorRecordError` suelto marca ese ítem `invalid` y sigue.
- **Tablero:** con `board`, tras importar se llama a `board.invalidate` con los temas de los errores contados (los `replay` no). Si eso falla, se añade un aviso en `warnings` y el resultado sigue valiendo.
- **`topicAdjustments`** (de `temas`): `[{ id, estado, status, current }]`, `status` ∈ `ok | unchanged | bad_status | unknown_topic`; `estado` se valida contra `TOPIC_STATUSES`. **Solo se muestran: no se aplican ni se guardan** (el estado de un tema vive en `topics.json`; PROVISIONAL, ver `DECISIONS.md`). Va un aviso en `warnings`.

**`buildLogText(data?, { now? }) → string`** (`core/syncLog.js`, puro). `data = { day?, done?, pending?, decisions?, areas?: [{ area, pct, band? }], topErrors?: [{ code, title?, frequency, impact? }], windowDays? }`. Cinco secciones fijas (qué se hizo, dominio por área, errores top, pendientes, decisiones); las vacías llevan «- (nada registrado)». `windowDays` (1–365, defecto 14) solo afecta al encabezado. Un campo desconocido o un dato mal formado lanza `Error` en español. Topes `LOG_LIMITS`: items 20, decisions 15, areas 30, topErrors 10, line 200, maxChars 19.000 (cabe en los 20.000 del bloque `bitacora`). `AREA_LABELS`: las 12 áreas de `core/contentRules.js`; un área desconocida se muestra con su clave. No incluye el texto escrito por la persona.

**`createSync({ db, clock?, schema?, schemaVersion?, migrations?, errors?, catalog?, topics?, board? })`** (firma ampliada; los cuatro últimos son opcionales):
- `previewChatErrors(text)` / `importChatErrors(text)`: delegan en `createChatImport`; lanzan `Error` claro si faltan `errors` y `catalog`.
- `buildLog(data?)` (async): si no se dan `topErrors`, los rellena con `errors.top` de los últimos `windowDays` días con el título del catálogo; si no se dan `areas`, usa `board.byArea(topics)` solo con las áreas que tienen temas vistos.
- `makeLogBlock(data?)` (async): bloque `bitacora` con `{ texto }` y la misma hora en `generado:` y en «Generada:».
- **No hay pantalla:** quien la cablee muestra `items`, `totals` y `warnings` de la vista previa y pide confirmación antes de `importChatErrors`.

## 2.1-T1 — Máquina de estados y cableado de servicios (`core/sessionRunner.js`, `app/services.js`) — 2026-10-26

**`core/sessionRunner.js`** (puro: sin DOM, base ni reloj). Fases: `idle → presenting → answering → feedback → next → summary`. Acciones: `START {total 0–100}`, `SHOWN`, `SUBMIT {result}` (`correct | almost | wrong | skipped | dont_know`), `CONTINUE`, `ADVANCE`, `QUIT`, `RESET`. Tabla exportada `TRANSITIONS`.
- `createState()` → estado inicial. Estado congelado y serializable: `{ v: 1, phase, index, total, answers: [{ index, result }], ended: null | 'completed' | 'quit' | 'empty' }`.
- `transition(state, action) → { state, changed, ignored }`. Acción como texto o `{ type, … }`. Una acción válida pero no permitida en la fase (p. ej. un segundo `SUBMIT`) devuelve el MISMO `state`, `changed: false` e `ignored: 'not_allowed'`. Tipo desconocido, `START` con total no válido o `SUBMIT` con resultado no válido lanzan `Error` en español. `START` con 0 ítems → `summary` con `ended: 'empty'`; `ADVANCE` desde el último ítem → `summary` con `ended: 'completed'`; `QUIT` → `summary` con `ended: 'quit'` conservando lo respondido.
- `validateState(state)` lanza `Error` («Estado de sesión no válido: …») si el estado es incoherente (versión, fase, rangos, una respuesta por ítem y en orden, respuesta del ítem actual presente en `feedback`/`next` y ausente en `presenting`/`answering`, `ended` solo en `summary`). Lo usan todas las demás funciones; 2.1-T2 lo usa para restaurar.
- `progress(state) → { index, total, answered, position, fraction }` · `summarize(state) → { total, answered, correct, almost, wrong, dontKnow, skipped, accuracy, ended }` (`accuracy` = aciertos / respondidas, `null` sin respuestas) · `canDo(state, type) → boolean`.

**`app/services.js`.** `createStudyServices({ db?, settings?, catalog?, topics?, clock?, rng?, log? })` → objeto congelado `{ available, missing, db, settings, clock, srs, events, errors, catalog, topics, mastery, board, plan }`. Con `db` en `null` quedan `srs` y `plan`; sin `catalog` no hay `errors`, `mastery` ni `board` (`missing` lista `'db'` y/o `'catalog'`). `events` es `board.wrapEvents(events)`: solo su `log` invalida la caché del dominio. `plan(options?)` lee las tarjetas y los ítems retirados, toma `dailyNewCap`, `dailyReviewCap` y `leechThreshold` de los ajustes, pasa `srs.retrievability` y llama a `session.build`; `options` pisa esos valores; no escribe nada; `newToday` y `reviewsToday` valen 0 salvo que se pasen. `startServices({ storageReady, settingsReady, services, fetchFn?, clock?, rng?, log? })` nunca rechaza, carga `content/taxonomy/error_codes.json` y `topics.json` y deja `services.study`; `main.js` expone la promesa como `services.studyReady`.

## 2.1-T2 (primera parte) — Foto diaria de dominio (`core/masterySnapshot.js`) — 2026-10-26

Ampliación (concreta «Foto diaria de dominio» del roadmap 17; no cambia la Parte 1). `createMasterySnapshot({ db, board, topics, clock?, maxDays? })` → objeto congelado `{ take, takeIfMissing, list, keyOf }`. Guarda UNA foto por día local en `meta` con la clave `mastery_snap:<AAAA-MM-DD>` y valor `{ key, v: 1, day, results: [{ topicId, pct, band, confidence, evidence }] }`, solo con los temas que tienen respuestas. `take(now?)` es idempotente y devuelve `{ day, key, saved, changed, count, pruned }`; `takeIfMissing` no calcula si ya hay foto; `list({ from?, to? })` devuelve `[{ day, results }]` listos para `masteryTrend`. Conserva hasta 400 días. Si la base falla se rechaza con `DbError` y no borra nada. Aún no está cableada (queda para el resto de T2).

## 2.1-T2 (entrega 1) — Conteo de lo estudiado hoy (`core/dailyUsage.js`, `app/services.js`) — 2026-10-26

Ampliación (concreta 8.6 y el armador de 1.8; no cambia la Parte 1). **`countToday({ events, now }) → Promesa { day, newToday, reviewsToday }`.** `events` = `createEvents(...)` o su versión envuelta (solo se usan `since` y `byCard`); `now` = Date, ms o ISO. Mira los eventos `answer` con `cardId` cuyo `day` es el día LOCAL de `now` y cuenta tarjetas distintas: `newToday` = su primera respuesta de la historia es de hoy; `reviewsToday` = la primera fue antes. Lee `since(medianoche local)` y un `byCard` por tarjeta de hoy; no escribe. Lanza `Error` si faltan `events.since` o `events.byCard` o si `now` no es una fecha; si la base falla, rechaza con su error. **`services.study.plan(options)`** pasa a llamarlo y fija `newToday` y `reviewsToday` por defecto; lo que traiga `options` manda; si contar falla, avisa por `log` y valen 0; sin base no cuenta.

## 2.1-T2 (entrega 2) — Persistencia atómica de una respuesta (`core/answerCommit.js`) — 2026-10-26

Ampliación (concreta 8.4, 8.6 y 8.8; no cambia la Parte 1). **`createAnswerCommit({ db, events, errors?, board? }) → { commit }`** (congelado; lanza `Error` en español si faltan `db.tx`, `events.prepare`/`insertIn`, `errors.prepare`/`applyIn` o `board.invalidate`). **`commit({ grade, errors? }) → Promesa { duplicate, event, card, cardSaved, errors }`.** `grade` es lo que devuelven `gradeAnswer` o `gradeManual` (1.5); `event.cardId` debe ser `card.id`. `errors` = lista (≤ 20, `MAX_ERRORS_PER_ANSWER`) de entradas de `errors.record`; `ts` e `itemId` por defecto los del evento. Escribe el evento, la tarjeta (solo si `grade.scheduled`) y cada error en UNA transacción: todo o nada. Valida antes de abrirla (lanza `EventError`, `ErrorRecordError` o `Error` sin tocar la base); si la base falla rechaza con `DbError`. **Doble toque:** con `sessionId`, si ya existe un evento `answer` con la misma sesión y tarjeta no escribe nada y devuelve `{ duplicate: true, event: el guardado, card: null, cardSaved: false, errors: [] }`; sin `sessionId` siempre escribe. Tras guardar invalida el dominio (`board.invalidate`) con los temas del evento y de los errores; si eso falla no rechaza. La última escritura gana (sin comprobar cambios de otra pestaña).

**Ampliaciones de API (aditivas):** `createEvents(...)` ahora también devuelve `prepare(input) → evento completo` (lanza `EventError`, no toca la base) e `insertIn(t, evento)` (guarda dentro de una transacción ya abierta con `events`); `createErrors(...)` devuelve `prepare(input) → { v, key }` (lanza `ErrorRecordError`) y `applyIn(t, prepared)` (busca y escribe dentro de una transacción ya abierta con `errors`). `log` y `record` los usan por dentro y no cambian. **`app/services.js`:** `createStudyServices` suma `commit` (null sin base; sin catálogo guarda evento y tarjeta y rechaza si se le piden errores).

## 2.1-T2 (entrega 3) — Restauración de la sesión a mitad (`core/sessionStore.js`) — 2026-10-26

Ampliación (no cambia la Parte 1 ni la sección 8; añade una clave a `meta`). **`createSessionStore({ db, clock?, maxAgeMs? }) → { save, load, clear, KEY }`** (congelado). Clave de `meta`: `session_active` = `{ key, v: 1, sessionId, savedAt, state, items }`. **`save({ sessionId, state, items, now? }) → Promesa { saved, cleared }`:** `state` pasa por `validateState`; `items` debe tener exactamente `state.total` elementos (`{ cardId, itemId }` obligatorios; `facet`, `topic`, `exerciseType`, `kind`, `why` y `topics` opcionales; el resto se descarta); con fase `idle` o `summary` borra lo guardado y devuelve `{ saved: false, cleared }`; una entrada mala lanza `Error` sin escribir. **`load(now?) → Promesa { status, sessionId?, state?, items?, ageMs? }`** con `status` `none | restored | expired | invalid` (las dos últimas borran el registro). Al restaurar, `answering` → `presenting` y `feedback` → `next`. **`clear() → { cleared }`.** Por defecto la sesión caduca a las 12 horas. **`app/services.js`:** `services.study.session` = `{ save, load, clear }` (null con `db` en null). Uso previsto en 2.1-T3: `commit` primero y `save` después.

## 2.1-T2 (entrega 4) — Foto diaria de dominio cableada (`app/services.js`) — 2026-10-26

Ampliación (no cambia la Parte 1 ni la sección 8). **`services.study.snapshot`** = `{ take, takeIfMissing, list }` de `createMasterySnapshot` (null sin base, sin catálogo o sin temas). **`services.study.finish() → Promesa { cleared, snapshot, snapshotError } | null`:** borra la sesión guardada (`session.clear`) y toma la foto con `take`; si la foto falla, avisa por `log` y devuelve `snapshot: null` con el mensaje en `snapshotError`; si falla el borrado de la sesión, se rechaza; con `db` en null devuelve null. **`startServices`** lanza `takeIfMissing` en el primer arranque del día sin esperarla y deja la promesa en `services.snapshotReady` (NUNCA rechaza; vale null si no hay foto posible o falla). Uso previsto en 2.1-T3/T4: llamar a `finish()` al llegar al resumen.

## 2.1-T2 (entrega 5) — Repasos adelantados (`core/earlyReview.js`) — 2026-10-26

Ampliación (concreta el punto de acople de 2.1-T2; no cambia la Parte 1 ni la sección 8). **`earlyInfo(card, now) → { early, daysEarly }`:** `early` es verdadero si la tarjeta ya tiene historia (`state` distinto de 0, `last_review` legible) y `due > now`; `daysEarly` = días que faltaban (2 decimales). No lanza. **`withEarlyReview(srs) → objeto congelado`** con los mismos métodos que `srs` y dos protegidos: `review(card, rating, now, …)` y `previewIntervals(card, now)`. Solo cambia el `again` de una tarjeta no vencida con menos de 24 h desde `last_review` y motor FSRS: se calcula como a las 24 h y se desplaza para que `due` cuente desde `now` y `last_review` sea `now`. El resto delega tal cual. Los ítems `practice` y `error` no vencidos se califican con `gradeAnswer` y se guardan con `commit` como cualquier otro. `services.study.srs` ya es el envuelto.

## 2.1-T2 (entrega 6) — Práctica extra y marca `early` (`core/eventSchema.js`, `core/gradeAnswer.js`, `core/dailyUsage.js`) — 2026-10-26

Ampliación (no cambia la Parte 1; AMPLÍA 8.6 con un campo opcional compatible; APROBADO por el Administrador el 2026-10-27). **Evento `answer`: campo opcional `early`.** Fuera de los 18 campos de `EVENT_FIELDS` (constante `OPTIONAL_FLAGS = ['early']`). Debe ser verdadero o falso y solo vale en eventos `answer`; se guarda SOLO cuando es verdadero (`early: false` equivale a ausente), al final del objeto. Un evento sin adelanto conserva exactamente su forma anterior y los eventos viejos (respaldos) siguen siendo válidos. **`gradeAnswer` y `gradeManual`** ponen `early: true` en `event` cuando `earlyInfo(card, now).early` es verdadero (la tarjeta ya tiene historia y su `due` es posterior a `now`); si no, el campo no existe. **`countToday({ events, now }) → { day, newToday, reviewsToday, practiceToday }`:** `newToday` sin cambios; `reviewsToday` = tarjetas conocidas con AL MENOS una respuesta de hoy a tiempo (sin `early`); `practiceToday` = tarjetas conocidas cuyas respuestas de hoy fueron TODAS adelantadas. Solo `reviewsToday` gasta `dailyReviewCap` (`services.study.plan` lo pasa al armador; `practiceToday` no se pasa). La práctica extra sigue contando como actividad del día para estadísticas y dominio, porque leen los eventos. Una tarjeta nueva de hoy es nueva aunque su repetición salga adelantada. Los eventos sin `early` cuentan como a tiempo.

## 2.1-T3 — Conductor y vista de sesión (`core/sessionDriver.js`, `ui/views/sesion.js`, `core/sessionStore.js`) — 2026-10-26

Ampliación (no cambia la Parte 1 ni la sección 8). **`core/sessionDriver.js`** (sin DOM; el reloj es `study.clock`, el azar del identificador sale de `rng`, por defecto `systemRng`).
- `NEW_SESSION_ID = 'nueva'`: valor del parámetro de `#/sesion/:id` que pide una sesión nueva.
- **`startSession({ study, options?, rng? }) → Promesa`** `{ status: 'started', sessionId, state, items, plan }` o `{ status: 'empty', plan }` (`plan.reason.message_es` dice por qué). Arma el plan con `study.plan(options)`, crea el estado con `START` y lo guarda con `study.session.save` (la última sesión guardada gana). Si guardar falla rechaza: no se empieza lo que no se podría retomar. Sin `study` o sin base rechaza con `Error` en español. El identificador es `ses_<AAAAMMDDTHHMM en UTC>_<4 caracteres a-z0-9>`.
- **`resumeSession({ study, sessionId }) → Promesa`** `{ status: 'restored', sessionId, state, items }` o `{ status: 'none' | 'expired' | 'invalid' | 'other' }` (`other`: hay una sesión guardada pero es otra; no se borra). El resto lo decide `study.session.load`.
- **`createSessionDriver({ study, timer, sessionId, state, items, log? }) → objeto congelado`** `{ getState(), getItems(), current(), idle(), prepare(), shown(), submit(answer), skipUnsupported(), next() }`. `timer` es `createAnswerTimer(...)`. `items.length` debe ser igual a `state.total`. Una cola de promesas ejecuta las operaciones de una en una; el fallo de una no frena a las siguientes.
  - `idle()` espera a que termine todo lo que hay en la cola. `prepare()` carga la mediana personal por tipo (`loadBaselines`); nunca rechaza (si falla usa las constantes por tipo). `shown()`: `presenting → answering` y arranca el cronómetro; devuelve `true` si cambió.
  - **`submit(answer)`** → `{ status: 'saved' | 'duplicate', result, rating, dueLabel, event, sessionSaved }` o `{ status: 'ignored', reason }` (`reason` es la fase actual). Orden fijo: tarjeta → `gradeAnswer` → `study.commit({ grade, errors })` (evento + tarjeta + errores en UNA transacción) → transición `SUBMIT` → `study.session.save`. Si el commit falla rechaza y el estado NO cambia (se puede repetir; el tiempo medido se conserva). Si solo falla el guardado de la sesión, la respuesta ya está guardada: devuelve `sessionSaved: false` y avisa por `log`. `duplicate` = el commit detectó la misma respuesta (sesión y tarjeta).
  - **Formato de `answer`:** `{ result, exerciseType?, hint?, dontKnow?, responseRaw?, errorCodes?, errors? }`. `result` ∈ `correct | almost | wrong | skipped | dont_know`. `exerciseType` viene de la respuesta o, si falta, del ítem. **`ms` e `interrupted` se IGNORAN** aunque vengan: los pone el cronómetro. `errors` pasa tal cual a `commit`.
  - `skipUnsupported()` → `{ status: 'skipped', sessionSaved }` o `{ status: 'ignored', reason }`. Salta SIN evento y SIN tocar la tarjeta; cuenta como `skipped` en el resumen.
  - `next()` → `{ status: 'advanced', state }`, `{ status: 'finished', state, summary, finish }` o `{ status: 'ignored', reason, state }`. Al terminar llama a `study.finish()` (borra la sesión guardada y toma la foto diaria); si eso falla avisa por `log` y el resumen se muestra igual.
  - Ningún método devuelve `status: 'error'`: un fallo de lectura o de commit RECHAZA la promesa. El `'error'` que ve el ejercicio lo pone la vista (ver abajo).

**Anfitrión de ejercicios (contrato nuevo, UI; lo implementa 2.1-T4 en `ui/exercises/index.js`).** `services.exercises.mount(slot, entry, ctx) → { destroy() }` (o una promesa de ese objeto). `slot` es el contenedor; `entry` es la entrada del plan `{ cardId, itemId, facet, topic, exerciseType, kind, why, topics }` (no el ítem de contenido: el registro lo resuelve por `itemId`); `ctx` es `{ index, total, submit(answer) }`. `ctx.submit` es el ÚNICO camino para registrar una respuesta y devuelve `{ status: 'saved' | 'duplicate' | 'ignored' | 'error', … }`: los tres primeros vienen del conductor; `ignored` con `reason: 'stale'` si el ejercicio ya no es el actual; `error` (con `message` en español) si el commit rechazó. Un segundo toque devuelve `ignored`: nunca duplica el evento. `destroy()` debe ser idempotente y quitar todo lo que el ejercicio registró. Sin `services.exercises`, o si `mount` lanza o no devuelve nada, la vista muestra «tipo no disponible» con «Saltar por ahora». Relación con el roadmap (sección 7): cada tipo sigue el contrato `mount(container, item, ctx) → { destroy(), getResponse() }`; el registro de T4 lo envuelve y llama a `ctx.submit`.

**`ui/views/sesion.js`** (`#/sesion/:id`, `createView`). `nueva` arma, guarda y navega a `#/sesion/<id>` con `replace`; otro valor retoma la sesión guardada. Pantallas: cargando, mensaje (sin material, sin base, sesión no encontrada, fallo al abrir; sin culpa), ejercicio, resumen. Cabecera con flecha «Salir de la sesión» (confirmación en modal; salir NO envía `QUIT`: la sesión guardada se conserva y se retoma, caduca a las 12 h) y barra con mascota que cuenta ítems RESPONDIDOS. Cronómetro de `core/answerTimer.js` con `services.visibility` o `createDocumentVisibility()`; invisible. Botón «Continuar» sin `lockMs`. Todo el texto de usuario se inserta con `h()` (nunca como HTML).

**Cambio en `core/sessionStore.js`.** `facet` de cada ítem acepta un entero de 0 a 999 (lo que entrega el armador de `core/session.js`) o un texto corto (datos viejos o de prueba); cualquier otra cosa lanza `Error` sin escribir. El resto del contrato de la entrega 3 no cambia.

## 2.1-T4 — Registro de ejercicios (`ui/exercises/index.js`) — 2026-10-27

Ampliación (no cambia la Parte 1 ni la sección 8). Cierra el contrato del anfitrión de 2.1-T3.

**`createExerciseRegistry({ resolveItem?, components?, log? }) → objeto congelado { register, has, types, mount }`.** `resolveItem(itemId) → ítem de contenido | null` (síncrono o promesa; si lanza o devuelve algo que no es un objeto cuenta como «sin ítem»); sin él no hay ítems. `components` es `{ tipo: componente }` y equivale a llamar a `register` por cada uno. Opciones inválidas lanzan `Error` en español.
- **`register(type, component)`:** `type` texto no vacío; `component` objeto con función `mount`; un tipo repetido lanza. `has(type)` y `types()` (lista ordenada) consultan lo registrado.
- **`mount(slot, entry, ctx) → Promesa<{ destroy(), getResponse() } | null>`.** Nunca rechaza. `entry` es la entrada del plan y `ctx` es `{ index, total, submit }` de la vista. El tipo es `entry.exerciseType` o, si es `null`, `item.type`; si ambos existen y difieren no se monta ninguno. Devuelve `null` («tipo no soportado todavía»; la vista pinta la pantalla amable y ofrece «Saltar por ahora») cuando: el tipo no tiene componente (sin aviso, es lo esperado), el ítem no se pudo leer (aviso, si el tipo sí tiene componente), el tipo del plan y el del ítem no coinciden, o el componente lanzó o no devolvió un objeto con `destroy` (el espacio se limpia y su `submit` queda inerte). El manejador está congelado; `destroy()` es idempotente y no lanza; `getResponse()` devuelve lo del componente o `null` (tras `destroy`, sin función o si lanza).
- **Contrato del componente (roadmap sección 7):** `mount(container, item, ctx) → { destroy(), getResponse?() }` (o una promesa de ello). `ctx = { index, total, entry, item, type, submit(answer) }`.
- **`ctx.submit(answer)`** (la envoltura): `answer = { result, hint?, dontKnow?, responseRaw?, errorCodes?, errors?, exerciseType? }` con `result` ∈ `RESULTS = correct | almost | wrong | skipped | dont_know`. Pone `exerciseType` (el del tipo montado) si falta y reenvía a la vista, que entrega el formato de `core/sessionDriver.js` `submit`. Devuelve `{ status: 'saved' | 'duplicate' | 'ignored' | 'error', … }` de la vista; una respuesta mal formada devuelve `{ status: 'error', message: BAD_ANSWER }` SIN llegar a la vista; tras `destroy()` o si el montaje falló devuelve `{ status: 'ignored', reason: 'stale' }`; si la vista lanza devuelve `error`. Nunca lanza. `ms` e `interrupted` los ignora el conductor.
- **Cableado:** `app/main.js` crea `services.exercises` sin tipos y sin `resolveItem` (decisión 2 de 2.1-T4: `content_cache` solo guarda ids; 2.9-T3 cablea la lectura del paquete). Cada subparte 2.2 a 2.5 añade sus tipos con `services.exercises.register(...)` en ese archivo.

## 2.2-T1 (entrega 1) — `phrase_cloze`: `key_es`, `key_en` y `turns` (`core/contentData.js`, `core/contentItem.js`) — 2026-10-27

Ampliación de 1.3-2A (decisión del Administrador, 2026-10-27; AMPLÍA 8.3 con campos opcionales y compatibles en `data` de `phrase_cloze`; no cambia la Parte 1). La especificación de la familia `cloze` gana tres campos opcionales; los ítems y paquetes anteriores siguen siendo válidos.
- **`key_es`** (texto, 1–120): la palabra o expresión clave en español, la que la tarjeta resalta en verde. Debe aparecer como fragmento, sin distinguir mayúsculas, en `prompt_es` o en algún `turns[].es`; si no, error `KEY_NOT_IN_TEXT` en `data.key_es`.
- **`key_en`** (texto, 1–60): la clave en inglés. Si falta, la tarjeta usa `answers[0][0]`.
- **`turns`** (lista de 2 a 6): cada elemento `{ who: "A"|"B", es (obligatorio, ≤ 300), en (opcional, ≤ 600) }`, sin campos extra. Cuando existe, la vista pinta los turnos con A/B; `prompt_es` sigue siendo obligatorio (8.3) y sirve de resumen o texto alternativo. `data.text` sigue siendo la réplica en inglés con el hueco.
- **Solo `phrase_cloze`:** en `cloze_bank`, `complete_dialogue` y `gap_sentences` los tres campos dan `PHRASE_CLOZE_ONLY` (en `data.<campo>`).
- **API:** `checkPhraseClozeItem(report, path, item)` y `PHRASE_CLOZE_FIELDS` (`['key_es', 'key_en', 'turns']`) en `core/contentData.js`; `validateItem` la llama con las especificaciones oficiales y solo si `data` no tiene errores.
- **No se valida** (a propósito): que `key_en` aparezca en el texto inglés ni que el turno con hueco coincida con `data.text`.
- **Quien escribe contenido:** usar los tres campos en el paquete semilla de 2.9-T1 y T2 y en el lote C8.
- **Pruebas:** `tests/contentPhraseCloze.test.mjs` (14).

## 2.2-T1 (entrega 2) — Render de `phrase_cloze` (`ui/exercises/phraseCloze.js`) — 2026-10-27

Cumple el contrato de componente de 2.1-T4: `createPhraseCloze().mount(container, item, ctx) → { el, destroy(), getResponse() }`. Lanza `TypeError` en español si el ítem no es `phrase_cloze` o falta `prompt_es`. Esta entrega solo dibuja: `getResponse()` es `null` y NO se registra aún (lo hace 2.2-T2 con `services.exercises.register('phrase_cloze', createPhraseCloze())`).
- **Datos:** `prompt_es`, `situation`, `grammar_note_es`, `nuance_es`, `data.text`, `data.answers`, `data.key_es`, `data.key_en` (por defecto `answers[0][0]`), `data.turns`.
- **DOM:** `.pc` > `.pc__situation?`, `.pc__es` (lista `.pc__turns` con `.pc__who` A/B, o párrafo), `.pc__en` (con `.pc__gap` = `role="img" aria-label="hueco"`), `.pc__grammar.callout?`, `.pc__nuance?`. Clave: `<strong class="pc__key">`. Todo texto como nodo de texto.
- **API:** `splitKey(texto, clave)` y `PC_TEXT`. **Pruebas:** `tests/phraseClozeRender.test.mjs`.

## 2.2-T2 — Respuesta de `phrase_cloze` (`core/phraseCloze.js`, `ui/exercises/phraseCloze.js`) — 2026-10-27

Sin cambios a la sección 8. `createPhraseCloze({ compare?, confusables? })` (opciones inyectables) sigue el contrato de componente de 2.1-T4 y se registra con `services.exercises.register('phrase_cloze', createPhraseCloze())`.
- **`core/phraseCloze.js`:** `countGaps(text)`, `fillGaps(text, fills)`, `acceptList(item)` (`item.accept` o producto de `data.answers`, tope 50), `hintFor(item, nivel 1|2)`, `grade(item, fills, { compare?, confusables? }) → { result, matched, diff, spellingFlags, errorCodes, typed, empty }`.
- **Envío:** `ctx.submit({ result, hint, responseRaw (frase completa, ≤ 2000), errorCodes })` al comprobar; `ctx.submit({ result: 'dont_know', dontKnow: true, hint })` con «No sé». Una respuesta vacía NO se envía. `hint` es `true` si se vio cualquier pista. Si `submit` devuelve `error`, la tarjeta se desbloquea y avisa; con `saved`/`duplicate` pinta la corrección y se bloquea.
- **Micrófono:** botón deshabilitado con aviso «disponible pronto» (lo activa 8.1-T3).

## 2.2-T3 — Insignias y efectos de `phrase_cloze` (`core/cardBadges.js`, `core/spellCard.js`, `app/cardActions.js`, `ui/exercises/cardBar.js`) — 2026-10-27

Sin cambios a la sección 8: la tarjeta `spell` es una tarjeta 8.4 normal y su «evento» es un `note` de 8.6. El registro de ejercicios gana un campo opcional de `ctx` (`cards`), extensión del contrato de componente de 2.1-T4.
- **`core/cardBadges.js` (puro):** `isNewCard(card) → boolean` (estado 0 y sin repeticiones); `badgesOf(card, now) → null | { level 1..5, isNew, due: 'Repaso en …' | null, fav }` (`null` si no hay tarjeta; una tarjeta nueva no trae `due`; el nivel sale de `levelOf`, es la estabilidad FSRS de 8.4 y NO el dominio del tema); `levelHelp() → { title, intro, levels: [{ level, text }] }` (los 5 textos salen de `LEVEL_CUTS_DAYS` de `core/srs.js`: cortes de 1, 4, 21 y 90 días; una sola fuente de verdad).
- **`core/spellCard.js` (puro):** `SPELL_TOPIC = 'spell.common_misspellings'` (PROVISIONAL, lo refina 4.7-T1); `spellKey(word) → palabra | null` (solo a–z, de 4 a 40 letras, en minúsculas); `spellCardPlan(flag, { now, topic? }) → { ok: true, word, itemId, cardId, card, event } | { ok: false, reason: 'no_flag' | 'bad_word' | 'bad_time' }`. `flag` es una marca de `spellingFlags` (`{ word, expected, index }`) y la clave es `expected`: la misma palabra correcta no repite tarjeta.
- **Forma de la tarjeta `spell` y del evento (ejemplo con «carrer» por «career»):** tarjeta nueva de 8.4 (`srs.newCard`) con `id` `spell.career#0`, `itemId` `spell.career` (cumple `^[a-z0-9_.]{1,100}$`), `facet` 0, `topics` `["spell.common_misspellings"]`, `state` 0, `reps` 0, `fav` false. Evento `{ type: 'note', itemId: 'spell.career', cardId: 'spell.career#0', topics: ['spell.common_misspellings'], responseRaw: 'spell_card career <- carrer' }` (el escrito se limpia a letras, cifras, apóstrofo, guion y espacio, ≤ 40). Un `note` no cuenta como respuesta en estadísticas ni en dominio.
- **`app/cardActions.js`:** `createCardActions({ db, events?, clock?, log? })` → objeto congelado `{ now(), read(cardId), setFav(cardId, fav), ensureSpell(flag, { topic? }?) }`. Todo devuelve Promesas y NUNCA rechaza (un fallo de la base se registra con `log` y sale como estado). `read` → tarjeta | `null`. `setFav` → `{ status: 'saved', card } | { status: 'missing' } | { status: 'error' }` y solo cambia `fav`. `ensureSpell` → `{ status: 'created' | 'exists' | 'skipped' | 'error', word?, reason? }`: escribe PRIMERO el evento y luego la tarjeta; `exists` si `spell.<palabra>#0` ya está (no escribe nada); `skipped` si la palabra no sirve (apóstrofo, acento, cifras, menos de 4 letras); `error` si falla o no hay base ni `events` (un reintento tras fallo de la tarjeta puede añadir otro `note` pero nunca otra tarjeta); dos llamadas simultáneas por la misma palabra comparten el trabajo. `events` debe ser el de `services.study.events` (el que invalida la caché del dominio).
- **`lazyCardActions(getStudy, log?) → () => acciones | null`:** arma las acciones con `services.study` (`db`, `events`, `clock`) cuando ya existe (TRAMPA-05) y reutiliza las mismas mientras `study` no cambie; sin base devuelve `null`.
- **`ctx.cards` (registro, `ui/exercises/index.js`):** `createExerciseRegistry({ resolveItem?, components?, cards?, log? })`; `cards` es un objeto de acciones o una función que se evalúa en cada montaje (`null` si lanza). El componente recibe `ctx = { index, total, entry, item, type, cards, submit }` con `cards` posiblemente `null`; sin él, el ejercicio funciona sin insignias ni tarjeta de deletreo. Un `cards` que no sea objeto ni función lanza `Error` al crear el registro.
- **`ui/exercises/cardBar.js`:** `createCardBar({ cards, cardId, doc?, win?, timers?, now? }) → { el, ready, refresh({ dueLabel? }?), getCard(), destroy() }`. Lee la tarjeta una vez y dibuja `Nivel N (?)` (la hoja lista los 5 niveles y marca «Tu tarjeta está aquí»), `New` (solo si nunca se respondió), `Repaso en …` (si ya se respondió) y el corazón (`<button>` con `aria-pressed` y etiqueta «Marcar como favorita» / «Quitar de favoritas»). El corazón no usa `lockMs` (TRAMPA-20): se desactiva mientras guarda y, si falla, vuelve a su estado y avisa («No se pudo guardar la favorita. Inténtalo otra vez.»). `refresh({ dueLabel })` relee la tarjeta tras responder y usa esa etiqueta de la calificación como «Repaso en …». Sin tarjeta legible, la barra se oculta. `destroy()` es idempotente y cierra la hoja.
- **`ui/exercises/phraseCloze.js`:** con `ctx.cards` y `ctx.entry.cardId` pone la barra arriba. Si la respuesta es `almost` y trae `spellingFlags`, la corrección añade el aviso «Ojo con la ortografía: escribiste «carrer» y se escribe «career».» seguido de una frase según `ensureSpell`: `created` «La dejé como tarjeta de deletreo para que la repases.», `exists` «Ya la tienes entre tus tarjetas de deletreo.», `error` «Ahora no pude crear la tarjeta de deletreo; tu respuesta sí quedó guardada.»; `skipped` o sin acciones, sin frase. `ensureSpell` se pide DESPUÉS de guardar la respuesta (`saved` o `duplicate`), también si la persona ya pasó de ejercicio; un fallo ahí nunca pierde la respuesta ni bloquea «Continuar». Si el guardado da `error` no se crea nada y el reintento crea una sola tarjeta.
- **Límites conocidos:** (1) el tema `spell.common_misspellings` y la tarjeta sin ítem de contenido son PROVISIONALES hasta 4.7-T1; una tarjeta `spell` sin ítem entrará al plan y la sesión mostrará «tipo no soportado todavía» con «Saltar por ahora» hasta que 4.7 la resuelva (el resolvedor de ítems tampoco está cableado hasta 2.9-T3). (2) Solo palabras a–z de 4 a 40 letras: las contracciones y las palabras con acento se omiten. (3) `compare` no da `almost` con una errata dentro de una contracción (limitación heredada de 1.2). (4) Si se toca el corazón en la ventana de milisegundos entre que el conductor lee la tarjeta y la guarda al responder, el `fav` podría perderse (lectura y escritura sin transacción compartida; el flujo normal lo conserva; PROVISIONAL, ver `DECISIONS.md`).

## 2.3-T1 — Componente base `choice` (`core/choice.js`, `ui/exercises/choice.js`) — 2026-10-27

Sin cambios a la sección 8: `data.{options, correct, shuffle?}` ya existía (8.3); el componente solo lo lee. `multiple` es una extensión DEL COMPONENTE y no del contrato de contenido (que sigue con un `correct` entero). T1 NO registra ningún tipo en `app/main.js`: los 9 tipos de la familia serán envoltorios de este componente (2.3-T3).
- **`core/choice.js` (puro, sin DOM ni reloj):** `CHOICE_LIMITS = { min: 2, max: 8, response: 2000 }` (mismas cotas que `data.options` en `core/contentData.js` y `responseRaw`). `readChoice(item, { multiple? }) → { ok: true, options, correct, multiple, shuffle } | { ok: false, reason }` con `reason` ∈ `no_data | bad_options | bad_correct`; `correct` sale siempre como lista de índices ordenada y sin repetidos; con `multiple`, `data.correct` puede ser un entero o una lista. `arrange(count, { rng, shuffle? })` → permutación de `0..count-1` (índices ORIGINALES en el orden mostrado); `shuffle: false` da el orden original; con barajado exige `rng.shuffle` y comprueba que el resultado sea una permutación (no se pierde ni se repite ninguna opción). `gradeChoice(item, picked, { multiple? }) → { result, picked, correct, missed, distractors, errorCodes, typed, empty }`: `result` ∈ `correct | wrong` (la elección no tiene «casi»); sin `multiple` se exige exactamente una opción y con `multiple` el conjunto elegido debe ser IGUAL al correcto; `distractors` = `[{ index, text, code }]` casando el texto normalizado con `item.distractors` (`code` es `null` si no hay distractor o si no cumple la forma de 8.8); `typed` = textos elegidos unidos con « | » (≤ 2000); `empty: true` si no hay elección calificable. Un ítem inválido lanza `Error` en español.
- **`ui/exercises/choice.js`:** `createChoice(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }` (contrato de componente de 2.1-T4). Opciones (todas opcionales): `rng` (por defecto `systemRng`; se baraja en CADA montaje), `multiple` (false), `confirm` (true; con false y sin `multiple`, tocar una opción responde al instante), `optionsLang` ('en'), `stemLang` ('en'), `log` (`console.error`). Datos que usa: `item.prompt_es` (obligatorio), `prompt_en`, `situation`, `data.*` y `item.distractors` (solo para los códigos).
- **Envío:** `ctx.submit({ result, hint: false, responseRaw, errorCodes })` con «Comprobar»; `ctx.submit({ result: 'dont_know', dontKnow: true })` con «No sé». Una elección vacía NO se envía. Si `submit` devuelve error, el ejercicio se desbloquea y avisa. «No sé» y «Comprobar» van en un bloque fijo abajo y se ocultan al pintar la corrección. Tras responder pinta solo lo mínimo (veredicto, respuesta correcta y marcas ✓/✗ con texto, no solo color); la explicación del distractor y el registro del error son de 2.3-T2 y el panel común es de 2.6. Todo texto entra como nodo de texto (nunca HTML). Objetivos táctiles de 44 px; `tools/choice-check.py` lo mide en Chromium (opcional, no entra en `npm run check`).
- **Límites conocidos:** (1) el resolvedor de ítems no está cableado (2.9-T3): las pruebas inyectan ítems; (2) no hay semilla por ítem a propósito (la persona memorizaría la posición); (3) la verificación visual en Chromium se hace con `tools/choice-check.py`, no en el teléfono (M1).

## 2.3-T2 — Retroalimentación y errores de `choice` (`core/choiceFeedback.js`, `ui/exercises/choice.js`, `core/choice.js`) — 2026-10-29

Sin cambios a la sección 8: el envío ya admitía `errors` (contrato del conductor de 2.1-T3) y el componente solo lo rellena. T2 NO registra ningún tipo en `app/main.js` (2.3-T3).
- **`core/choiceFeedback.js` (puro, sin DOM, reloj ni base):** `explainChoice(item, graded, { catalog? }) → { hints, errors }`. `graded` es lo que devuelve `gradeChoice` (se usan `result`, `correct` y `distractors`). Solo hay `hints` y `errors` si `graded.result === 'wrong'` y el catálogo sirve (objeto con `has(code)` y `hint(code)`); con «No sé», un acierto, sin catálogo o con uno roto devuelve `{ hints: [], errors: [] }` y no lanza. Un `item` o un `graded` que no son objetos (o sin `distractors`/`correct` en lista) lanzan `Error` en español.
- **`hints`:** `[{ index, text, code, hint }]`, uno por distractor elegido cuyo `code` existe en el catálogo, sin repetir (`code` + texto normalizado); `hint` es la `pista_corta_es` o `null`.
- **`errors`:** `[{ code, original, correction?, context?, topics? }]`, siempre válidas para `errors.record`: textos sin caracteres de control, recortados a `LIMITS` de `core/errors.js` (sin cortar un par sustituto), vacíos omitidos. `correction` = opciones correctas unidas con « | »; `context` = `item.situation`; `topics` = los del ÍTEM que cumplen `TOPIC_ID_RE` (≤ `LIMITS.topics`, sin repetir). `ts` e `itemId` los pone el commit. Un `code` ausente del catálogo se descarta de `errors` pero sigue en `errorCodes` del evento.
- **`ui/exercises/choice.js`:** opción nueva `catalog` (catálogo con `has`/`hint`, función que lo devuelve, o `null`; se lee AL COMPROBAR, no al montar). Es una opción del componente, no `ctx.catalog`: el contrato de contexto de 2.1-T4 no cambia. Tras fallar se pinta «Pista:» (una si todas son iguales; si no, una por opción con «texto»: pista) y `ctx.submit` añade `errors` solo si hay. «No sé» nunca registra errores. Si explicar falla, la respuesta se envía igual.
- **FIX en `core/choice.js`:** `gradeChoice(...).typed` (va a `responseRaw`) cambia por espacio los caracteres de control que el evento rechaza (`/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g`; tab, salto de línea y retorno de carro sí valen). La forma del resultado no cambia.
- **Límites conocidos:** (1) el resolvedor de ítems no está cableado (2.9-T3): las pruebas inyectan ítems; (2) la «Pista:» está verificada en Chromium (`tools/choice-check.py`), no en el teléfono (M1); (3) tope de 20 errores por respuesta (el de `errors.record`).

## 1.3-2A (ampliación de 2.4-T1, punto 8) — `data.blocks`, `data.lines` y `accept` de ordenar (`core/contentData.js`) — 2026-10-30

Ampliación aprobada por el Administrador (AMPLÍA 8.3 con campos opcionales; no cambia la Parte 1). La especificación `ordering` gana `blocks`, `lines` y `shuffle`; `pieces` pasa a opcional en la forma y lo exige `checkOrderItem` a los tipos que lo usan. Los topes salen de `core/orderBlocks.js` (`ORDER_LIMITS`, `DIALOGUE_LIMITS`).
- **`order_blocks`:** `data.blocks` (obligatorio), lista de 2 a 12 textos en el orden CORRECTO, cada uno con contenido y ≤ 200; `data.shuffle` (bool, opcional). `accept` (opcional): frases completas, ≤ 600 cada una (tope del Item común).
- **`order_dialogue`:** `data.lines` (obligatorio), lista de 2 a 8 `{ speaker (1–20), text (1–200) }` sin campos extra; `shuffle` igual; `accept` se escribe con el texto de cada línea sin hablante.
- **Resto de la familia** (`unscramble_letters`, `build_from_keywords`, `order_paragraphs`): sin cambios, siguen con `data.pieces` (2–12, ≤ 120) y `extra_pieces`.
- **Errores:** campo obligatorio ausente → `DATA_FIELD_REQUIRED` (en `data.blocks` o `data.lines`); `blocks`, `lines`, `pieces`, `extra_pieces` o `shuffle` en un tipo que no los usa → `ORDER_ONLY` (el mensaje nombra el tipo y el campo que sí usa). Un `order_blocks` con `data.pieces` deja de ser válido (migrar a `blocks`).
- **Compatibilidad:** `content/packs/` vacía; el paquete de muestra tiene 21 ítems (3 de ordenar). **API:** `checkOrderItem(report, path, item)`; `validateItem` la llama con las especificaciones oficiales y solo si `data` no tiene errores.
- **Pruebas:** `tests/contentOrder.test.mjs` (17). La ficha completa del tramo (API, componente, envío) está en «2.4-T1» (abajo).

## 2.4-T1 — Ordenar: `order_blocks` y `order_dialogue` (`core/orderBlocks.js`, `core/responseText.js`, `ui/exercises/orderBlocks.js`, `ui/exercises/orderTypes.js`) — 2026-10-30

Primer tramo de la subparte 2.4 (sin subir versión: 2.4 tiene 4 tramos). Datos validados por la ampliación **1.3-2A** (arriba, «ampliación de 2.4-T1, punto 8»); `order_dialogue` es una ampliación compatible de la familia `ordering` (aprobada por el Administrador) y NO cambia la sección 8 del roadmap.
- **Contrato de datos.** `order_blocks`: `item.data.blocks` = 2 a 12 textos en el ORDEN CORRECTO (cada uno con contenido, ≤ 200); `item.data.shuffle` (false conserva el orden; por defecto se baraja); `item.accept` (opcional) = frases completas que también valen, ≤ 600 cada una. `order_dialogue`: `item.data.lines` = 2 a 8 `{ speaker (1–20), text (1–200) }` en el orden correcto; `shuffle` igual; `accept` SÍ aplica y se escribe con el texto de cada línea SIN hablante; turnos seguidos del mismo hablante permitidos; solo texto (el audio llega en 7.x); sin códigos de error. Con `item.type === 'order_dialogue'` solo se lee `data.lines`; con cualquier otro tipo, solo `data.blocks`.
- **`core/orderBlocks.js` (puro, sin DOM ni reloj; el azar solo por `rng`).** `ORDER_LIMITS = { min: 2, max: 12, blockLength: 200, acceptLength: 600, history: 200 }` y `DIALOGUE_LIMITS = { min: 2, max: 8, speakerLength: 20 }` (los topes del validador de contenido salen de aquí).
  - `readOrder(item) → { ok: true, blocks, solution, accept, shuffle } | { ok: false, reason }`; con `order_dialogue` añade `labels` («Hablante: texto», lo que se muestra) y `speakers`. `reason` ∈ `no_data | bad_blocks | bad_accept` (formato de bloques) y `no_data | bad_lines | bad_accept` (diálogo): un diálogo con `data.blocks` da `bad_lines`; un `order_blocks` con `data.lines` da `bad_blocks`. Los bloques se identifican por su POSICIÓN en `data.blocks`/`data.lines` (dos bloques con el mismo texto son distintos). `solution` = los textos unidos con un espacio; `accept` = `solution` primero y luego las de `item.accept` sin repetir.
  - `gradeOrder(item, placed) → { result, placed, text, matched, complete, empty, misplaced }`. `placed` son ÍNDICES (lo inválido o repetido se ignora; no lanza por `placed`; un ítem inválido lanza `Error` en español). `result` ∈ `correct | wrong` (sin «casi»): `correct` solo si están TODOS los bloques y el texto unido coincide con alguna frase de `accept` según `compare`. `misplaced` = posiciones (desde 0) fuera de lugar frente a `data.blocks`, solo si es `wrong` y está completo.
  - Estado de toques (funciones puras; cada una DEVUELVE un estado nuevo congelado y una acción que no procede devuelve el MISMO objeto): `createOrderState(count, { rng, shuffle? })` → `{ count, tray, placed, history }` (bandeja fija; el barajado nunca deja el orden original con ≥ 2 bloques), `placeBlock`, `removeBlock`, `undoLast`, `resetOrder` (no vuelve a barajar y borra el historial), `bankOf`, `isComplete`. Un bloque no se puede colocar dos veces (sin estados imposibles).
- **`core/responseText.js` (nuevo, TRAMPA-32).** `toResponseRaw(texto, max = 2000)` cambia por espacio, 1 a 1, los controles que el evento rechaza (0–8, 0B, 0C, 0E–1F, 7F–9F; tab, salto de línea y retorno sí valen) y recorta a `max`; lo que no es texto da `''`. Exporta también `EVENT_CONTROL` y `RESPONSE_RAW_MAX` (= `LIMITS.responseRaw`). **Regla: todo `responseRaw` de un ejercicio pasa por esta función.** La usan `core/choice.js` (`typed`), `ui/exercises/orderBlocks.js` y `ui/exercises/phraseCloze.js`; los ejercicios nuevos (2.5 en adelante) la importan en vez de limpiar a mano.
- **`ui/exercises/orderBlocks.js`.** `createOrderBlocks({ rng?, lang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }` (contrato de 2.1-T4). `rng`: azar con `shuffle` (por defecto `systemRng`; se baraja en CADA montaje); `lang`: código de idioma de los bloques ('en'); `log`: recibe los fallos al pintar la corrección (`console.error`). Opciones inválidas lanzan `TypeError`. Datos que usa: `item.prompt_es` (obligatorio), `situation`, `data.{blocks | lines, shuffle}`, `accept`. Interacción SOLO por toques (sin arrastre): tocar un bloque de la bandeja lo coloca al final; tocar uno de la frase lo quita; la bandeja no cambia de sitio. Botones: «Deshacer», «Empezar de nuevo», «Comprobar» (exige todos los bloques: si no, «Coloca todos los bloques o toca «No sé».» y no envía) y «No sé» (siempre visible mientras se responde). Todo texto entra como nodo de texto (nunca HTML); las marcas ✓/✗ llevan texto. `getResponse()` devuelve el texto armado (o lo enviado tras comprobar; `null` si no hay).
- **Envío.** «Comprobar» → `ctx.submit({ result, hint: false, responseRaw, errorCodes: [] })`; «No sé» → `ctx.submit({ result: 'dont_know', dontKnow: true, hint: false })`. `responseRaw` = bloques unidos con un espacio, SIN hablante, pasado por `toResponseRaw`. Nunca se envía `errors`. Si `submit` devuelve error, el ejercicio se desbloquea y avisa «No se pudo guardar. Inténtalo otra vez.».
- **`ui/exercises/orderTypes.js`.** `ORDER_TYPES = { order_blocks: {}, order_dialogue: {} }` (hoy ningún tipo cambia opciones: el diálogo se distingue por `data.lines`) y `registerOrderTypes(registry, { rng?, log? }) → ['order_blocks', 'order_dialogue']`, con un `createOrderBlocks` propio por tipo; un tipo ya registrado hace lanzar al registro. `app/main.js` la llama UNA vez: `registerOrderTypes(app.services.exercises, { log: console.error })`.
- **Estilos y comprobación.** `.ob` en `ui/styles/components.css` (solo variables existentes; objetivos táctiles de 44 px; si la frase crece a otra fila la bandeja baja, aceptado). `tools/order-check.py` (Chromium 360×640, 3 temas, texto Normal y Muy grande, casos `dos`, `simple`, `largo`, `dialogo`) da 24/24; es opcional y no entra en `npm run check`.
- **Pruebas.** `tests/orderBlocks.test.mjs` (52), `orderBlocksView.test.mjs` (33), `orderDialogue.test.mjs` (19), `orderTypes.test.mjs` (21), `orderBlocksWiring.test.mjs` (3), `contentOrder.test.mjs` (17), `orderBlocksControl.test.mjs` y `responseText.test.mjs` (FIX de controles y guardia de TRAMPA-32).
- **Límites conocidos.** (1) El resolvedor de ítems no está cableado (2.9-T3): la pantalla NO es alcanzable desde la interfaz y las pruebas inyectan ítems; (2) nada se ha probado en un teléfono real (solo DOM falso y Chromium emulado); guion en cola: `tests/scenarios/2.4.md`; (3) sin «casi» ni pista por error: calificación solo `correct`/`wrong`; (4) arrastre no incluido (opcional en 2.4-T4 si es sólido); (5) `order_paragraphs` y el resto de la familia `ordering` siguen con `data.pieces` y sin componente hasta 2.4-T3.

## 2.4-T2 — Emparejar y banco de palabras: `match_pairs` y `cloze_bank` (`core/matchPairs.js`, `core/clozeBank.js`, `ui/exercises/matchPairs.js`, `ui/exercises/clozeBank.js`) — 2026-10-30 (ficha añadida el 2026-10-31, en 2.4-T4)

Segundo tramo de la subparte 2.4 (sin subir versión: sigue en 0.23.0). Los datos son los de las familias `matching` y `cloze` ya validadas por **1.3** (`core/contentData.js`); NO cambia la sección 8 del roadmap ni se tocó `core/contentData.js`. Esta ficha faltaba al cerrar T2 y se escribió después a partir del código.

- **Contrato de datos de `match_pairs`.** `item.data.pairs` = 2 a 10 objetos `{ left, right }` (cada texto con contenido y ≤ 120); la pareja es su POSICIÓN. `item.data.extra_right` (opcional) = hasta 4 distractores del lado derecho (≤ 120). El «5–6 pares» del roadmap es una guía de contenido, no un tope. Ningún `left` ni `right` se repite y un `extra_right` no puede ser igual a un `right` de pareja (comparación por el texto recortado); es más estricto que el validador en esto (hueco conocido).
- **`core/matchPairs.js` (puro, sin DOM ni reloj; el azar solo por `rng`).** `MATCH_LIMITS = { min: 2, max: 10, textLength: 120, extraMax: 4, attempts: 400 }`.
  - `readMatch(item) → { ok: true, pairs, lefts, rights, extra } | { ok: false, reason }`; `reason` ∈ `no_data | bad_pairs | bad_extra`.
  - Estado: `createMatchState(pairCount, extraCount, { rng, shuffle? })` → `{ pairCount, cardCount, tray, solved, selected, attempts, last }`. Las tarjetas de la derecha tienen índice k < `pairCount` (el `right` de la pareja k) o k ≥ `pairCount` (distractor); `tray` es fijo. `pickMatch(state, side, index)`: sin selección selecciona; con selección del mismo lado cambia (el mismo índice la quita); con el lado contrario resuelve AL INSTANTE (acierto: queda resuelta y bloqueada; fallo: nada se resuelve) y limpia la selección. Una pareja resuelta no se puede volver a tocar (devuelve el MISMO estado). `isMatchComplete`. Sin deshacer: el feedback inmediato es definitivo (decisión provisional en `DECISIONS.md`).
  - `gradeMatch(item, attempts) → { result, complete, empty, solved, mistakes, firstTry, wrongLefts, text }`: `correct` solo si están TODAS resueltas y no hubo ningún fallo; si no, `wrong`; NUNCA `almost`. Lo que no es un intento válido se ignora; no lanza por `attempts` (un ítem inválido lanza `Error` en español).
- **Contrato de datos de `cloze_bank`.** `item.data.text` con 1 a 6 huecos marcados `___`; `item.data.answers` = una lista por hueco (1 a 10 textos ≤ 120); `item.data.bank` = 1 a 20 textos ≤ 120, OBLIGATORIO aquí (en `cloze` es opcional) y puede traer distractores. Las fichas se identifican por su POSICIÓN en el banco (dos «the» son dos fichas). Más estricto que el validador: cada hueco debe poder llenarse con una ficha DISTINTA y el banco no puede ser más corto que los huecos (si no, `unsolvable`). La respuesta cuenta tras `normalize`.
- **`core/clozeBank.js` (puro).** `CLOZE_BANK_LIMITS = { minGaps: 1, maxGaps: 6, bankMax: 20, textLength: 120, answersMax: 10, history: 200 }`.
  - `readClozeBank(item) → { ok: true, parts, gaps, answers, bank } | { ok: false, reason }`; `reason` ∈ `no_data | bad_text | bad_answers | bad_bank | unsolvable`.
  - Estado: `createClozeState(gapCount, bankCount, { rng, shuffle? })` → `{ gapCount, bankCount, tray, fills, history }` (bandeja fija); `placeWord(state, w, gap?)` (sin `gap`, el primer hueco vacío), `removeFill`, `undoLast`, `resetCloze` (no vuelve a barajar), `freeWords`, `isClozeComplete`. Una ficha no se puede poner dos veces ni se vacía un hueco vacío: sin estados imposibles.
  - `gradeClozeBank(item, fills) → { result, fills, filled, complete, empty, wrongGaps, sentence }`; `fills` son ÍNDICES del banco; `correct` si todos los huecos están llenos y cada ficha vale para SU hueco; si no, `wrong`; NUNCA `almost`. `wrongGaps` solo si está completo y es `wrong`.
- **`ui/exercises/matchPairs.js`.** `createMatchPairs({ rng?, leftLang?, rightLang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }` (contrato de 2.1-T4). Dos columnas por toques, en cualquier orden; acierto = las dos tarjetas bloqueadas con el mismo número y «✓»; fallo = las dos con «✗» hasta el siguiente toque. La columna derecha se baraja en CADA montaje. Al resolver la última pareja se envía solo, sin «Comprobar»; «No sé» siempre a la vista.
- **`ui/exercises/clozeBank.js`.** `createClozeBank({ rng?, lang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }`. Tocar una palabra de la bandeja la pone en el PRIMER hueco libre (no se elige el destino: quitar y deshacer cubren el error); tocar un hueco lleno quita su palabra. Botones «Deshacer», «Empezar de nuevo», «Comprobar» (exige todos los huecos llenos) y «No sé». Corrección por hueco con «✓ Correcto» o «✗ No encaja».
- **Envío.** `match_pairs`: al completar, `ctx.submit({ result, hint: false, responseRaw, errorCodes: [] })`; «No sé» → `ctx.submit({ result: 'dont_know', dontKnow: true, hint: false })`. `cloze_bank`: lo mismo con «Comprobar». `responseRaw` por `toResponseRaw` (TRAMPA-32). Si `submit` devuelve error: en emparejar las tarjetas siguen bloqueadas y aparece «Enviar otra vez» con el aviso «No se pudo guardar. Inténtalo otra vez.» sin perder nada; en el banco el ejercicio se desbloquea y avisa.
- **Registro.** `app/main.js` registra los dos tipos sueltos, cada uno con su componente: `register('match_pairs', createMatchPairs({ log: console.error }))` y `register('cloze_bank', createClozeBank({ log: console.error }))`. No hay un `…Types.js` como en ordenar y construir.
- **Estilos y comprobación.** `.ma` y `.cb` están en `ui/styles/components.css` (que está en el tope de 800 líneas; por eso `.bp` fue a `widgets.css`). `tools/match-check.py` y `tools/cloze-check.py` (Chromium 360×640, 3 temas, texto Normal y Muy grande) dan 24/24 cada una; son opcionales y no entran en `npm run check`. `tools/build-check.py --bars` mide también sus barras fijas (2.4-T4).
- **Pruebas.** `tests/matchPairs.test.mjs` (13), `matchPairsState.test.mjs` (32), `matchPairsView.test.mjs` (40), `clozeBank.test.mjs` (34), `clozeBankView.test.mjs` (51); y del tramo T4: `family24Fuzz.test.mjs`, `family24ScreenFuzz.test.mjs`, `family24NotColorOnly.test.mjs`.
- **Límites conocidos.** (1) El resolvedor de ítems no está cableado (2.9-T3): las pantallas NO son alcanzables desde la interfaz; (2) no vistas en un teléfono real; el guion de T2 está en `tests/scenarios/2.4.md` (tramos 2a y 2b, en cola para el hito M1; el paquete semilla actual no trae ítems de estos dos tipos); (3) en emparejar no hay «deshacer» (decisión provisional); (4) en el banco no se elige el hueco de destino (decisión provisional).

## 2.4-T3 — Construcción: `unscramble_letters` y `build_from_keywords` (`core/buildPieces.js`, `ui/exercises/buildPieces.js`, `ui/exercises/buildTypes.js`) — 2026-10-30

Tercer tramo de la subparte 2.4 (sin subir versión: sigue en 0.23.0). Los datos son los de la familia «ordering» ya validada por la ampliación **1.3-2A** (`data.pieces`, `data.extra_pieces`, `accept`); NO cambia la sección 8 del roadmap ni se tocó `core/contentData.js`.

- **Contrato de datos.** `item.data.pieces` = 2 a 12 textos en el ORDEN CORRECTO (≤ 120 cada uno); `item.data.extra_pieces` (opcional) = hasta 4 piezas de más que no van en la respuesta; `item.data.shuffle` (false conserva el orden; por defecto se baraja); `item.accept` (opcional) = respuestas completas que también valen, ≤ 600 cada una. `unscramble_letters` une las piezas SIN espacio; `build_from_keywords` las une con UN espacio. Las piezas se identifican por su POSICIÓN (dos piezas «a» son distintas): los índices `0..pieces.length-1` son las de la respuesta y los siguientes las de más.
- **`core/buildPieces.js` (puro, sin DOM ni reloj; el azar solo por `rng`).** `BUILD_LIMITS = { min: 2, max: 12, extraMax: 4, pieceLength: 120, acceptLength: 600 }`.
  - `readBuild(item) → { ok: true, pieces, extras, all, solution, accept, joiner, shuffle } | { ok: false, reason }`; `reason` ∈ `no_data | bad_type | bad_pieces | bad_extra | bad_accept`. `accept` = `solution` primero y luego las de `item.accept` sin repetir.
  - `gradeBuild(item, placed) → { result, placed, text, matched, complete, empty, usedExtra, misplaced }`. `placed` son ÍNDICES de `all` (lo inválido o repetido se ignora; no lanza por `placed`; un ítem inválido lanza `Error` en español). `result` ∈ `correct | wrong`, NUNCA `almost`. `complete` = están todas las piezas de la respuesta; `usedExtra` = piezas de más que se pusieron; `misplaced` = posiciones fuera de lugar, solo si es `wrong`, está completo y no se usó ninguna pieza de más (si no, `[]`).
  - `createBuildState(item, { rng })` y `gradeBuildState(item, state)`: el estado es el de ordenar con tope de 16 piezas (`{ count, tray, placed, history }`, bandeja fija); se usan las mismas acciones de `core/orderBlocks.js` (`placeBlock`, `removeBlock`, `undoLast`, `resetOrder`, `bankOf`). Una pieza no se puede colocar dos veces ni quitar si no está colocada: sin estados imposibles.
- **Ampliación de `core/orderBlocks.js`.** `createOrderState(count, { rng, shuffle?, max? })` acepta `max` opcional (12 a 32; se exporta `STATE_MAX_CEILING`). Sin `max` el comportamiento de ordenar no cambia.
- **`ui/exercises/buildPieces.js`.** `createBuildPieces({ rng?, lang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }` (contrato de 2.1-T4), UN componente para los dos tipos (el tipo del ítem decide el texto «palabra» o «frase» y cómo se unen las piezas). `rng`: azar con `shuffle` (por defecto el del sistema; se baraja en CADA montaje); `lang`: idioma de las piezas ('en'); `log`: recibe los fallos al pintar la corrección. Interacción solo por toques: tocar una pieza de la bandeja la coloca al final y tocar una colocada la quita; la bandeja no cambia de sitio. Las piezas de más se ven igual que las demás. Botones: «Deshacer», «Empezar de nuevo», «Comprobar» y «No sé» (siempre visible). Las marcas ✓/✗/«✗ Sobra» van en el nombre accesible de cada pieza y, como texto visible, solo en las líneas «Fuera de lugar (posición …)» y «Sobra: …». Todo texto entra como nodo de texto (nunca HTML).
- **Envío.** «Comprobar» → `ctx.submit({ result, hint: false, responseRaw, errorCodes: [] })`; «No sé» → `ctx.submit({ result: 'dont_know', dontKnow: true, hint: false })`. `responseRaw` = lo armado, por `toResponseRaw` (TRAMPA-32). Si `submit` devuelve error, se desbloquea y avisa «No se pudo guardar. Inténtalo otra vez.». «Comprobar» exige al menos `pieces.length` piezas puestas (si no, avisa y no envía).
- **`ui/exercises/buildTypes.js`.** `BUILD_TYPES` (congelado; hoy ningún tipo cambia opciones) y `registerBuildTypes(registry, { rng?, log? }) → ['unscramble_letters', 'build_from_keywords']`, con un `createBuildPieces` propio por tipo; un registro inválido lanza en español y un tipo ya registrado hace lanzar al registro. `app/main.js` lo llama UNA vez tras `registerOrderTypes`: `registerBuildTypes(app.services.exercises, { log: console.error })`.
- **Estilos y comprobación.** `.bp` al final de `ui/styles/widgets.css` (solo tokens existentes; 747 líneas; `components.css` está en el tope de 800). `tools/build-check.py` (Chromium 360×640, 3 temas, texto Normal y Muy grande, casos `letras`, `frase`, `maximo`, `largo`) da 24/24; es opcional y no entra en `npm run check`.
- **Pruebas.** `tests/buildPieces.test.mjs` (22), `buildState.test.mjs` (13), `buildPiecesView.test.mjs` (55), `buildTypes.test.mjs` (15).
- **Límites conocidos.** (1) El resolvedor de ítems no está cableado (2.9-T3): la pantalla NO es alcanzable desde la interfaz; (2) no visto en un teléfono real (solo DOM falso y Chromium emulado); guion en cola: `tests/scenarios/2.4.md`; (3) la barra fija puede tapar parte de la bandeja con «Muy grande» (medido: tapa 107–145 px sin desplazar con 6–12 piezas; el clic de Playwright desplaza hasta que nada tapa; mismo comportamiento ya aceptado en `.cb`); (4) «Comprobar» exige `pieces.length` piezas, así que no deja enviar una respuesta más corta aunque esté en `accept` (hoy ningún ítem la tiene; «No sé» siempre queda); (5) sin «casi» ni pista por error, y sin arrastre (opcional en 2.4-T4 si es sólido). La sección 8 del roadmap no cambia.

## 2.5-T1 — Base de entrada de texto (`core/textAnswer.js`, `ui/exercises/textAnswer.js`) — 2026-10-31

Primer tramo de la subparte 2.5 (sin subir versión: sigue en 0.24.0). Base común de los tipos de producción corta (`fill_verb`, `translate_word`, `first_letter`, …). NO cambia la sección 8 del roadmap ni `core/contentData.js`; lee solo campos que el ítem ya puede traer.

- **Datos que lee.** `item.accept` (obligatorio: textos no vacíos; las variantes y las dos formas de `'s`/`'d` van ahí), `item.prompt_es`, `item.situation`, `item.explain_es`, `item.grammar_note_es`, `item.nuance_es`, `item.data.hint` (texto; solo con el botón «Ver pista»), `item.data.mask` (`none | first_letter | length`; cualquier otro valor vale `none`). El ítem NO trae el idioma de la respuesta.
- **`core/textAnswer.js` (puro, sin DOM, reloj ni azar).** `readText(item) → { ok: true, type, accept, hint, mask } | { ok: false, reason }` (`no_item | no_accept`); `isBlank(text)` (no es texto, o solo espacios, NBSP, ancho cero o caracteres de control: la pantalla no lo envía); `optionsFor(type, extra)` (opciones de `compare`: `TYPE_OPTIONS` por tipo, hoy solo `translate_word` con `almostAtWordEnd: true`, y de `extra` solo `confusables`, `lang: 'es'`, `keepFinalPunctuation` y `almostAtWordEnd`); `maskHint(item)` (máscara de `accept[0]`); `gradeText(item, text, { compare?, …extra }) → { result, matched, diff, spellingFlags, errorCodes, typed, empty }`. Un ítem inválido lanza `Error` en español.
- **`ui/exercises/textAnswer.js`.** `createTextAnswer({ compare?, confusables?, answerLang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }` (contrato de 2.1-T4). `answerLang` ('en' por defecto | 'es') lo fija quien registra el tipo: pone `lang` en el campo y `lang: 'es'` en `compare` (traducir palabra inverso). Un ítem sin `accept` lanza `TypeError` al montar (el registro lo cuenta como «tipo no soportado»). Campo `createTextInput` en modo `exercise` (`autocapitalize`, `autocorrect`, `autocomplete` en `off`, `spellcheck="false"`; Enter envía). Botones «Comprobar», «No sé» y, si hay `data.hint`, «Ver pista».
- **Envío.** «Comprobar» → `ctx.submit({ result, hint, responseRaw, errorCodes })` con `responseRaw` por `toResponseRaw` (TRAMPA-32); «No sé» → `ctx.submit({ result: 'dont_know', dontKnow: true, hint })` sin `responseRaw`. Una respuesta vacía NO se envía (avisa y deja el campo libre). Un solo envío bueno: tras guardar, todo queda deshabilitado; si `submit` devuelve `error` o lanza, se desbloquea y se puede reintentar. `ignored` no pinta nada.
- **`almost` con errata.** Si la calificación es `almost` y trae `spellingFlags`, la corrección avisa de la ortografía y, DESPUÉS de guardar (`saved` o `duplicate`), pide `ctx.cards.ensureSpell(flag)`; un fallo ahí solo cambia el aviso, nunca pierde la respuesta.
- **Corrección.** `wordDiff`, la respuesta (la variante que coincidió) y, si no acierta, `explain_es` y las cajas de gramática y matiz; «No sé» sin `wordDiff` ni lenguaje de fallo. Insignias de la tarjeta (`cardBar`) si hay `ctx.cards` y `entry.cardId`.
- **Límites conocidos.** No hay tipos registrados todavía (`app/main.js` no los cablea hasta 2.5-T2); los tres campos de `three_forms` y el detector mecánico llegan en 2.5-T3 y 2.5-T5. Pruebas: `tests/textAnswer.test.mjs` (lógica), `tests/textAnswerScreen.test.mjs` (pantalla), `tests/textAnswerFuzz.test.mjs` (60 secuencias) y `tools/text-answer-check.py` (Chromium, 18 casos, opcional).

## 2.5-T2 — Palabra y colocación (`core/textTypes.js`, `ui/exercises/textTypes.js`) — 2026-10-31

Sin subir versión (sigue en 0.24.0). Los 6 tipos `fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word` y `derive_form` son la pantalla base de 2.5-T1 con enunciado propio. NO cambia la sección 8 del roadmap ni el contenido.

- **`core/textTypes.js` (puro).** `WORD_TYPES`, `textTypeInfo(type)`, `answerLangFor(item)` (siempre `'en'`: `translate_word` es español → inglés, respuesta 8 del Administrador), `instructionFor(item)`, `promptLines`, `gapParts` (parte la frase por cada `___`), `withDefaults(item)` (`first_letter` recibe máscara `first_letter` si no trae `data.mask`; un `none` explícito se respeta) y `promptPlan(item) → { instruction, main, aside }`. En `translate_word` con `prompt_en` no se enseña `prompt_es` (podría ser la respuesta).
- **Dirección de `translate_word` (pregunta 8, RESUELTA por el Administrador).** Siempre español → inglés: `prompt_es` es la palabra española y la respuesta es la forma inglesa de `accept`. No hay `data.direction`; la dirección contraria se hace con `mcq_en_es` o `def_to_word`. Si el ítem trae `prompt_en` NUNCA se muestra (sería la respuesta).
- **`ui/exercises/textTypes.js`.** `createWordType(type, { compare?, confusables?, log? }).mount(container, item, ctx)` (contrato de 2.1-T4); el tipo del envoltorio manda sobre el `type` del ítem (se monta una copia). `registerWordTypes(registry, opts)` registra los 6 y devuelve la lista. Un ítem sin `accept` lanza `TypeError` al montar.
- **Marcado.** `.ta__instruction`, `.ta__prompt` con `lang` (el hueco es `.ta__gap`, `role="img"`, `aria-label="hueco"`) y `.ta__aside` con `lang`. Opción aditiva `prompt(item, { h, doc })` en `createTextAnswer`.
- **Cableado.** `app/main.js` llama `registerWordTypes(app.services.exercises, { log: console.error })` una vez, tras `registerBuildTypes`.
- **Límites conocidos.** Fuzz hecho (`tests/textTypesFuzz.test.mjs`, 84 secuencias); sin Chromium todavía; la corrección recorta palabras de más de 200 caracteres; sin ítems de estos tipos en `pack_seed_v1`. Pruebas: `tests/textTypes.test.mjs`, `tests/textTypesScreen.test.mjs`.

## 2.5-T3 (punto 4) — Traducir con trampa y con banco (`ui/exercises/translateTypes.js`) — 2026-10-31

Sin subir versión (sigue en 0.24.0). Pantalla de `trap_translate` y `translate_bank` sobre la base de texto de 2.5-T1, con la lógica de `core/translateTypes.js`. NO cambia la sección 8 del roadmap ni el contenido. Respuesta 11 del Administrador: `prompt_es` es la frase en español y se responde ESCRIBIENDO en inglés (`accept`).

- **`ui/exercises/translateTypes.js`.** `createTranslateType(type, { compare?, confusables?, catalog?, log? }).mount(container, item, ctx)` (contrato de 2.1-T4); `registerTranslateTypes(registry, opts)` registra `trap_translate` y `translate_bank` y devuelve la lista. El tipo del envoltorio manda sobre el `type` del ítem. Un ítem sin `accept` lanza `TypeError` al montar. `catalog` es un catálogo de errores (`has` y `hint`) o una función que lo devuelve; se lee al comprobar, no al montar.
- **Trampa.** Si lo escrito es un distractor conocido (`item.distractors[{ text, code }]`), el resultado es `wrong`, su `code` viaja en `errorCodes` (sin repetir) y la corrección muestra `.ta__trap` (`role="note"`) con «Ese es un error típico: escribiste «…»» y la pista del catálogo si existe (si no, un texto genérico). El aviso es texto: acierto y fallo no dependen solo del color. Un distractor sin `code` avisa igual pero no pide pista ni añade código.
- **Banco (`translate_bank`).** `.ta__bank` (`role="group"`, nombre «Banco de palabras», `lang="en"`) con un botón por palabra de `data.bank` (nombre accesible = la palabra). Tocar una palabra la añade al campo con un espacio (tope de 200 letras) y borra el aviso de «escribe tu respuesta»; la respuesta sigue siendo texto libre. Los botones se bloquean al enviar y se desbloquean si el guardado falla; un toque sobre un botón deshabilitado no cambia nada.
- **Ampliación aditiva de `createTextAnswer`.** `grade(item, text, opts)` (calificación propia; si lanza se avisa a `log` y se usa `gradeText`), `notes(res, { h })` (avisos extra bajo el veredicto) y, en el gancho `prompt`, las ayudas `insertText(texto)` y `addControl(control)`. Sin estas opciones la pantalla base se comporta igual.
- **Cableado y estilos.** `app/main.js` llama `registerTranslateTypes(app.services.exercises, { catalog: () => app.services.study?.catalog ?? null, log: console.error })` tras `registerWordTypes`. Estilos `.ta__bank` y `.ta__trap` en `ui/styles/widgets.css`.
- **Límites conocidos.** Sin ítems de estos tipos en `pack_seed_v1` (se añaden en 2.9-T1 y T2). Falta el registro de `three_forms`, el fuzz de T3 y el cierre. Pruebas: `tests/translateTypesScreen.test.mjs` (29, con fuzz de 60 secuencias) y `tools/translate-check.py` (Chromium, 12 casos, opcional).

## 1.3-2A (ampliación de 2.5-T3, punto 5) — `data.forms` de `three_forms` y `accept` opcional (`core/contentData.js`, `core/contentTypes.js`) — 2026-10-31

Ampliación pedida por el Administrador (respuestas 9 y 10 de 2.5; AMPLÍA 8.3 con un campo opcional y compatible en `data`; no cambia la Parte 1). La especificación `text_input` gana `forms`.
- **`three_forms`:** `data.forms = { present, past, participle }` es OBLIGATORIO (`DATA_FIELD_REQUIRED` en `data.forms` si falta). Cada forma es un texto (≤ `LIMITS.short`) o una lista de 1 a 10 textos con las grafías válidas (`learnt` y `learned`). Un campo extra o una forma ausente, vacía o de otro tipo es error del esquema.
- **`accept` OPCIONAL** solo en `three_forms` (`ITEM_TYPES.three_forms.acceptRequired = false`): sus respuestas ya viven en `data.forms`. El resto de los tipos que se escriben sigue exigiendo `accept`. Si un ítem de `three_forms` lo trae, se valida igual que siempre (duplicados, contracciones).
- **Los demás tipos de `text_input`:** `data.forms` es un error `FORMS_ONLY`.
- **API:** `checkFormsItem(report, path, item)` y `FORM_FIELDS` en `core/contentData.js`; `validateItem` la llama con las especificaciones oficiales y solo si `data` no tiene errores.
- **Compatibilidad:** no había ítems de `three_forms` en `content/packs/` ni en el paquete de muestra; ningún paquete anterior cambia de validez.
- **Pruebas:** `tests/contentForms.test.mjs` (10) y la fila de `acceptRequired` de `tests/contentTypes.test.mjs`.

## 2.5-T3 (punto 5) — Registro de `three_forms` (`app/main.js`, `ui/exercises/threeForms.js`) — 2026-10-31

Quinto punto del tramo 2.5-T3 (sin subir versión). La pantalla y la lógica son las de los puntos 1 y 2; este punto las cablea.
- **Registro:** `app.services.exercises.register('three_forms', createThreeForms({ log: console.error }))` en `app/main.js`, antes de `startFirstRun`. Un ítem sin las tres formas hace que el registro devuelva `null` («tipo no soportado todavía»).
- **Una tarjeta por faceta (presente 0, pasado 1, participio 2):** `ctx.entry.facet` decide qué forma cuenta. El evento lleva el `result` de la forma de ESA tarjeta; las otras dos se enseñan corregidas pero no lo cambian (CA 4 de 2.5). Sin faceta válida, el `result` es el global de las tres.
- **`responseRaw`:** las tres respuestas, «sing / sang / sung», por `toResponseRaw` (TRAMPA-32). «No sé» no lleva `responseRaw`.
- **Estilos:** `.tf__form` y sus tres veredictos en `ui/styles/widgets.css`; el veredicto de cada forma es TEXTO («Bien», «Casi», «Todavía no»), el color solo refuerza.
- **Pruebas:** `tests/threeFormsScreen.test.mjs` (33): flujo por el registro real en las 3 facetas, ítem incompleto, cableado y estilos.

## 2.5-T3 (punto 6) — Fuzz y Chromium de `three_forms` (`tests/family25T3Fuzz.test.mjs`, `tools/forms-check.py`) — 2026-10-31

Sexto y último punto del tramo 2.5-T3 (sin subir versión; 2.5 tiene 5 tramos). No cambia ningún contrato.
- **Fuzz con semilla fija** (4 pruebas): 400 casos de lógica (cada forma se califica SOLA; resultado global coherente; forma cambiada siempre «wrong»), la respuesta exacta de cada forma, 500 ítems hostiles contra el validador con un oráculo independiente, y 60 secuencias de pantalla (un solo envío, resultado de la faceta, sin listeners al cerrar, sin aviso tras enviar).
- **Chromium:** `tools/forms-check.py` (opcional, no entra en `npm run check`): 3 casos × 3 temas × 2 tamaños de texto a 360 px = 18, con 3 campos con nombre accesible, filas por forma con veredicto en texto, forma cambiada y campo vacío sin envío.

## 2.5-T4 (punto 1) — Lógica de `fix_error` (`core/fixError.js`) — 2026-10-31

Primer punto del tramo 2.5-T4 (sin subir versión). No cambia la sección 8: usa `prompt_en` (la oración con error), `prompt_es` (la instrucción), `accept`, `distractors` y `error_codes` del ítem (8.3); `data` queda vacío.
- **API:** `FIX_TYPE`, `sentenceOf(item)`, `promptPlan(item)` → `{ instruction, main: { text, lang: 'en' } | null }` y `gradeFix(item, text, { compare?, detect? })` → `{ ...gradeText, unchanged, trap, hits, hint }`.
- **Sin cambios:** dejar la oración tal cual es `wrong` con `unchanged: true` y los `error_codes` del ítem; se mira ANTES que `almost`.
- **Trampa y detector:** otra corrección mala conocida (`distractors`) da `trap` y su código; si no, el detector de 1.6 (`detect`) aporta `hits`, la pista del primero y su código. Solo se pregunta cuando el resultado es `wrong`; si lanza, no rompe la calificación.
- **Pruebas:** `tests/fixError.test.mjs` (14). La pantalla y el registro llegan en los puntos siguientes.

## 2.5-T4 (punto 2) — Pantalla de `fix_error` (`ui/exercises/fixError.js`) — 2026-10-31

Segundo punto del tramo 2.5-T4 (sin subir versión). No cambia la sección 8. Envoltorio de `createTextAnswer` con la lógica de `core/fixError.js`.
- **API:** `createFixError({ compare?, confusables?, catalog?, detect?, log? })` → `{ mount }` y `registerFixError(registry, opts)` → `['fix_error']`; `FX_TEXT` con los textos propios.
- **Pantalla:** instrucción en español (`prompt_es` o «Corrige el error en la oración.»), oración con error en inglés (`.ta__prompt--error`) y campo VACÍO en inglés. El tipo del envoltorio manda sobre el del ítem; un ítem sin `accept` lanza TypeError.
- **Avisos (uno solo, en texto, `role="note"`):** `.ta__unchanged` (sin cambios), `.ta__trap` (trampa conocida con pista del catálogo) o `.ta__detect` (pista del detector de 1.6).
- **Detector:** `detect` inyectable; si falta, `createErrorDetector` con el catálogo leído al comprobar; sin catálogo válido, `detectRules` sin pista. Un fallo del detector se avisa a `log` y no rompe el envío.
- **Registro:** `app/main.js` llama a `registerFixError`.
- **Pruebas:** `tests/fixErrorScreen.test.mjs` (14). Chromium queda para el cierre del tramo.

## 2.5-T4 (punto 3) — Lógica de `transform` y `keyword_transform` (`core/transformTypes.js`) — 2026-10-31

Tercer punto del tramo 2.5-T4 (sin subir versión). No cambia la sección 8: usa el contrato `data` ya congelado en 1.3-2A (`source`, `instruction_es`, `keyword`) y `accept`, `distractors` y `error_codes` del ítem (8.3). Se contesta escribiendo la oración reescrita en inglés.
- **API:** `TRANSFORM_TYPES`, `isTransformType`, `sourceOf(item)`, `keywordOf(item, type)`, `instructionFor(type, item?)`, `promptPlan(item, type)` → `{ instruction, main: { text, lang: 'en' } | null, keyword }`, `hasKeyword(text, keyword)` y `gradeTransform(item, text, type, { compare?, detect? })` → `{ ...gradeText, unchanged, keyword, keywordMissing, trap, hits, hint }`.
- **Palabra clave:** solo en `keyword_transform`. `hasKeyword` busca palabras enteras (sin mayúsculas ni apóstrofos tipográficos); «does» no cuenta como «do». `keywordMissing` solo se marca cuando el resultado es `wrong` y es una pista: no cambia el resultado.
- **Sin cambios, trampa y detector:** igual que en `fix_error` (se mira «sin cambios» antes que `almost`; el detector solo se pregunta si es `wrong`, hay texto y no es «sin cambios»; también con trampa, ver el punto 6; si lanza, no rompe la calificación).
- **Pruebas:** `tests/transformTypes.test.mjs` (20). La pantalla y el registro llegan en el punto siguiente.

## 2.5-T4 (punto 4) — Pantalla de `transform` y `keyword_transform` (`ui/exercises/transformTypes.js`, `ui/exercises/detectSource.js`) — 2026-10-31

Cuarto punto del tramo 2.5-T4 (sin subir versión). No cambia la sección 8. Envoltorio de `createTextAnswer` con la lógica de `core/transformTypes.js`.
- **API:** `createTransformType(type, { compare?, confusables?, catalog?, detect?, log? })` → `{ mount }`, `registerTransformTypes(registry, opts)` → `['transform', 'keyword_transform']` y `TT_TEXT`. El tipo del envoltorio manda sobre el del ítem; un tipo ajeno lanza Error en español; un ítem sin `accept` lanza TypeError.
- **Pantalla:** instrucción en español, oración base en inglés (`.ta__prompt--source`), campo VACÍO en inglés y, solo en `keyword_transform` con clave, la etiqueta `.ta__keyword` («Palabra clave: …», en texto).
- **Avisos (`role="note"`, siempre en texto):** `.ta__unchanged` va solo; si no, `.ta__trap` y `.ta__kwmissing` (clave ausente) pueden salir juntos, y `.ta__detect` (pista del detector) solo si no hay trampa.
- **`detectSource.js`:** `createDetectSource({ catalog?, detect?, log? })` → `(text) → hit[]` y `readCatalog(catalog)`. El catálogo se lee al comprobar; sin catálogo válido usa `detectRules` sin pista; nunca lanza. `fixError.js` lo usa también.
- **Registro:** `app/main.js` llama a `registerTransformTypes`.
- **Pruebas:** `tests/transformTypesScreen.test.mjs` (18) y `tests/detectSource.test.mjs` (5). Chromium queda para el cierre del tramo.

## 2.5-T4 (punto 5) — `join_sentences` y `pronoun_placement` (`core/transformTypes.js`, `ui/exercises/transformTypes.js`) — 2026-10-31

Quinto punto del tramo 2.5-T4 (sin subir versión). No cambia la sección 8 ni añade campos al contenido.
- **Datos:** `join_sentences` (familia `transform`): `data.source` = las oraciones a unir, `data.keyword` = el conector (opcional). `pronoun_placement` (familia `text_input`): oración base en `prompt_en` (o `data.source` si existe), instrucción en `prompt_es`, respuestas en `accept` y la trampa («Pick up it») en `distractors`.
- **Lógica:** `TRANSFORM_TYPES` pasa a cuatro tipos y se añade `KEYWORD_TYPES = ['keyword_transform', 'join_sentences']`; `sourceOf(item, type?)` usa `prompt_en` solo con `pronoun_placement` y sin `data.source`; `keywordOf` solo da clave en `KEYWORD_TYPES`. Instrucciones por defecto: «Une las oraciones en una sola.» y «Cambia el objeto por un pronombre y colócalo bien.».
- **Pantalla:** `join_sentences` pinta `.ta__keyword` como «Conector: …» y su aviso de ausencia dice «el conector»; `pronoun_placement` no pinta etiqueta ni aviso de clave. `registerTransformTypes` registra los cuatro: `['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']`.
- **Pruebas:** `tests/transformTypes.test.mjs` (24) y `tests/transformTypesScreen.test.mjs` (23).

## 2.5-T4 (punto 6) — Fuzz y Chromium de la transformación y de la palabra (`tests/family25T4Fuzz.test.mjs`, `tools/transform-check.py`, `tools/word-types-check.py`) — 2026-10-31

Sexto y último punto del tramo 2.5-T4 (sin subir versión: 2.5 tiene T5 pendiente). No cambia ningún contrato de datos ni de código; solo corrige una frase de los puntos 1 y 3.
- **Aclaración del detector con trampa:** cuando lo escrito es una trampa conocida el detector SÍ se pregunta (ya lo probaba `fix_error`): su pista se conserva en `hint`, pero el código de `errorCodes` es el de la trampa y la pantalla pinta solo el aviso de la trampa. Los puntos 1 y 3 decían «ni trampa»; el código no cambia, sí los comentarios de `core/fixError.js` y `core/transformTypes.js`.
- **Fuzz con semilla fija** (6 pruebas, 10 ítems válidos para el validador real, 2 por tipo): 1000 casos de lógica (determinismo; resultado, «sin cambios» y «almost» contra un oráculo propio hecho con `gradeText` y `compare`; extras solo en `wrong`; trampa siempre un distractor del ítem; clave ausente exactamente cuando falta, solo en `keyword_transform` y `join_sentences`; el detector no cambia el resultado y no se pregunta con acierto, errata, vacío ni «sin cambios»), todas las respuestas aceptadas con cualquier detector, `hasKeyword` (1500 casos con oráculo independiente), 400 ítems hostiles (lo que acepta el validador se monta y se califica; lo demás falla con un error propio) y 150 secuencias de pantalla en los cinco tipos (un solo envío, resultado y avisos iguales a los del grado, todos `role="note"` y en texto, manda el tipo del envoltorio, sin listeners al cerrar).
- **Chromium (opcionales, no entran en `npm run check`):** `tools/transform-check.py` (8 casos × 3 temas × 2 tamaños = 48) para `fix_error`, `transform`, `keyword_transform`, `join_sentences` y `pronoun_placement`; y `tools/word-types-check.py` (6 tipos × 2 respuestas × 3 × 2 = 72) para los 6 tipos de 2.5-T2, que seguían sin casos propios. Miran instrucción, hueco accesible, etiqueta «Palabra clave:» o «Conector:», avisos en texto con `role="note"`, un solo envío, veredicto en texto, campo bloqueado y sin desbordes a 360 px.
- **Límites conocidos:** sin ítems de estos tipos en `pack_seed_v1` (van en 2.9-T1 y T2); el detector mecánico con pista específica y el mapeo a `ErrorRecord` llegan en 2.5-T5; la prueba en teléfono real sigue en la cola del hito M1.

## 2.5-T5 — Detector y cierre de la familia de producción corta (`core/textErrors.js`) — 2026-10-31

Último tramo de 2.5 (sube a 0.25.0). Sin DOM, sin reloj, sin azar y sin base.
- `detectHits(detect, typed) → hit[]`: nunca lanza; sin función, texto en blanco o detector roto devuelven `[]`.
- `withDetection(g, { detect }) → g'`: si `g.result` es `wrong`, no vacío y sin `g.hits` previo, añade `{ hits, hint }` y suma el código del primer aviso a `errorCodes` (sin repetir; con trampa conocida manda el código de la trampa y la pista queda en `hint`). Si `g.hits` ya es lista, devuelve `g` igual (idempotente). `correct` y `dont_know` no se tocan. Acepta `options` nulo.
- **Promoción de «casi»:** un `almost` pasa a `wrong` con `promoted: true` y `spellingFlags: []` solo si un aviso cuyo código NO empieza por `SPELL.` incluye en su texto la palabra marcada (sin distinguir mayúsculas; el apóstrofo cuenta como letra). Una errata real o un aviso `SPELL.*` no promueven.
- `errorEntries(item, g, { catalog, max }) → entrada[]`: solo con `g.result === 'wrong'`, sin `g.unchanged` y con catálogo que tenga `has` y `hint` (sin él no hay `services.errors` y el commit rechazaría todo). Primero la trampa, luego los avisos; sin repetir código + texto normalizado; solo códigos que `catalog.has`; tope `max` (entero positivo, por defecto 5, máximo 20). `original` es el trozo del aviso o la respuesta entera; `correction` la aceptada que coincide o la primera; `context` es la situación; `topics` son los válidos del ítem, únicos y dentro de `LIMITS`.
- Pantallas: `fix_error` y `transform` ya lo hacían; ahora también los 6 tipos de palabra, `trap_translate`, `translate_bank` y `three_forms` (en `three_forms` sin faceta, un error repetido en dos formas se registra una vez).
- **Contrato del veredicto (CONFIRMADO por el Administrador, 2026-10-31):** un «casi» pasa a «mal» solo si un aviso de gramática (no `SPELL.*`) cubre justo la palabra marcada; las erratas reales y los avisos `SPELL.*` no promueven.

## 2.6 — Decisiones del Administrador que fijan contratos (2026-10-31; se implementan en 2.6-T1 a T3)
- **Estados del panel común:** correcto, casi, incorrecto y «No sé». «Casi» solo aparece donde la comparación puede devolver `almost` (texto escrito); elegir, ordenar y emparejar son binarios y nunca lo muestran.
- **Nota de «por qué lo pensaste»:** evento `note` de `core/eventSchema.js`, texto en `responseRaw` (máx. 2000). Se verifica en T2 si se asocia al ítem por `itemId`; si falta, se amplía solo lo mínimo y se registra aquí.
- **Reporte local:** almacén `meta`, clave `report:<itemId>`, valor `{ kind: 'hard' | 'doubt', at: <ISO> }`. Sin almacén nuevo. Un ítem tiene como máximo un reporte por tipo (el último gana). Debe entrar en el respaldo.
- **Sonido, vibración y mascota (T3):** se respetan los ajustes existentes `sounds` y `vibration` (ambos `true` por defecto); no se crean otros. Sonido: tono suave al acertar y otro al cerrar la sesión; nada al fallar ni en «No sé». Vibración: un pulso corto (≈ 10 ms) solo al acertar; nunca al fallar. Mascota Chispa: feliz al acertar, «pensando» al fallar o en «No sé», neutral el resto; respeta `prefers-reduced-motion`.
- **Textos y notas:** «Todavía no.» y «No pasa nada:» se mantienen (se auditan en T3). Las notas de gramática y matiz salen en TODOS los tipos al fallar. Al acertar solo `nuance_es`, si existe y es breve. `explain_es` y `grammar_note_es` solo al fallar. «¿Por qué lo pensaste?» va tras un botón, solo al fallar y solo en tipos de gramática o teoría, nunca obligatorio. «Marcar como difícil» y «No me convence esta frase» van en un menú «⋯» del panel.
- **Guion:** `tests/scenarios/2.6.md` (mismo formato que `2.5.md`), a la cola del hito M1.

## 2.6-T1 (punto 1) — Módulo común del panel de feedback (`ui/feedbackPanel.js`) — 2026-10-31

Sin DOM propio: recibe `h` y devuelve nodos. Aún no lo usa ninguna pantalla (se migran en los puntos siguientes).
- `feedbackState(result, { binary? })` → `'correct' | 'almost' | 'wrong' | 'dont'`. `dont_know` y `dont` dan `'dont'`; `almost` solo si `binary` no es `true`; cualquier otro valor da `'wrong'`.
- `feedbackNodes({ h, result, item, binary?, tail?, verdict?, before?, answer?, after? })` → `Node[]` en orden fijo: veredicto, `before`, respuesta correcta (si no acertó), notas del ítem, `after`. Veredicto = `verdict` (texto completo) o `FB_TEXT[estado]` + ` ` + `tail`. `answer` es texto («Respuesta: **texto**») o nodos propios.
- Notas: al fallar (`almost`, `wrong`, `dont`) salen `explain_es`, `grammar_note_es` y `nuance_es` si existen y no están en blanco; al acertar, solo `nuance_es` y con ≤ 160 caracteres (`NUANCE_SHORT_MAX`). Nunca lanza por un ítem raro; sin `h` lanza `TypeError`.
- Clases: `fb__verdict fb__verdict--<estado>`, `fb__correct`, `fb__explain`, `fb__box fb__grammar callout`, `fb__box fb__nuance`, `fb__box-label`, `fb__box-text`.

## 2.6-T1 (punto 2) — `textAnswer` y `threeForms` migrados al panel común — 2026-10-31

- `textAnswer` (y todos los tipos que lo usan: 6 de palabra, traducir, fix_error, transform, etc.): orden en pantalla = veredicto, diferencia de palabras, aviso del tipo o pista del detector (`.ta__detect`), tarjeta de deletreo, respuesta correcta, explicación, gramática, matiz. Textos de veredicto sin cambios: «Todavía no. Fíjate en la corrección:», «No pasa nada: así se dice.».
- `threeForms`: veredicto, filas `.tf__form` (la corrección, también al acertar), pista del detector, y notas del panel. «Casi»: «Casi: revisa la ortografía.»; mal: «Todavía no. Fíjate en cada forma:»; «No sé»: «No pasa nada: son estas.».
- Clases del veredicto y las notas: `fb__*` (contrato del punto 1). Siguen `ta__*` para enunciado, campo, avisos de tipo, `.ta__detect` y `.ta__spell`.
- Cambio visible: un acierto puede mostrar `nuance_es` si es breve (≤ 160).

## 2.6-T1 (punto 2) — `textAnswer` y `threeForms` usan el panel común — 2026-10-31

- Veredicto: `FB_TEXT[estado]` + `tail`. `textAnswer`: «Todavía no. Fíjate en la corrección:» (wrong), «No pasa nada: así se dice.» (dont_know), «Casi: revisa la ortografía de la palabra marcada.» (almost). `threeForms`: «Todavía no. Fíjate en cada forma:», «No pasa nada: son estas.» y, para «casi», su texto propio «Casi: revisa la ortografía.» (parámetro `verdict`).
- Orden en `textAnswer`: veredicto, extras (diferencia de palabras, aviso del tipo o pista del detector `.ta__detect`, tarjeta de deletreo), respuesta correcta, `explain_es`, gramática, matiz. En `threeForms` las filas `.tf__form` (la corrección, visibles también al acertar) van como extra y no se pinta «Respuesta:».
- Clases del panel: `fb__*`. Se conservan `.ta__detect`, `.ta__spell`, `.ta__trap` y demás extras propios del tipo.
- Al acertar: solo `nuance_es` y solo si ≤ 160 caracteres.

## 2.6-T1 (punto 3) — `choice` usa el panel común — 2026-10-31

- Binario (`binary: true`). Veredicto propio vía `verdict`: «¡Bien!», «Todavía no. La respuesta correcta está marcada.», «No pasa nada: esta es la respuesta.». Clases `fb__verdict--correct|wrong|dont`.
- Orden al fallar: veredicto, pista del distractor (`.ch__why`), respuesta correcta (`.ch__correct`, con `lang` de las opciones), `explain_es`, gramática, matiz. Al acertar: veredicto y, si es breve (≤ 160), matiz.

## 2.6-T1 (punto 4) — `orderBlocks` usa el panel común — 2026-10-31

- Binario. Veredicto propio vía `verdict`: «¡Bien!», el de fallo de `OB_TEXT.wrong` y «No pasa nada: así va en orden correcto:». Clases `fb__verdict--correct|wrong|dont`.
- Orden al fallar: veredicto, aviso de bloques mal puestos (`.ob__misplaced`, solo en `wrong`), respuesta (`.ob__correct`, una línea por hablante en diálogos), notas del ítem. Al acertar: veredicto y matiz breve (≤ 160).
\n

## 2.6-T1 (punto 4) — `orderBlocks` usa el panel común — 2026-10-31

- Binario. Veredicto propio vía `verdict`: «¡Bien!», «Todavía no…» (`OB_TEXT.wrong`), «No pasa nada: así va en orden correcto:». Clases `fb__verdict--correct|wrong|dont`.
- Orden al fallar o «No sé»: veredicto, aviso de bloques mal puestos (`.ob__misplaced`, solo si `wrong`), respuesta (`.ob__correct`, una línea por hablante en diálogo), `explain_es`, gramática, matiz. Al acertar: veredicto y matiz breve (≤ 160).

## 2.6-T1 (punto 5) — `matchPairs` usa el panel común — 2026-10-31

- Binario. Veredicto propio vía `verdict`: «¡Bien!», «Completado, con N fallo(s). Así van las parejas:» (`MA_TEXT.withMistakes`), «No pasa nada: así van las parejas:». Clases `fb__verdict--correct|wrong|dont`.
- Con fallos o «No sé»: veredicto, parejas (`.ma__correct`, una por renglón), `explain_es`, gramática, matiz. Sin fallos: veredicto y matiz breve (≤ 160).

## 2.6-T1 (punto 6) — `clozeBank` usa el panel común — 2026-10-31

- Binario. Veredicto propio vía `verdict`: «¡Bien!», «Todavía no. Así queda bien:», «No pasa nada: así queda bien:». Clases `fb__verdict--correct|wrong|dont`.
- Al fallar o «No sé»: veredicto, aviso de huecos mal puestos (`.cb__review`, solo si `wrong`), solución (`.cb__correct`), `explain_es`, gramática, matiz. Al acertar: veredicto y matiz breve (≤ 160).

## 2.6-T1 (punto 7) — `buildPieces` usa el panel común — 2026-10-31

- Binario. Veredicto propio vía `verdict` (variantes de letras y de palabras): «¡Bien!», «Todavía no. Así va la frase:» (o su variante de letras), «No pasa nada: así va la frase:» (o su variante de letras). Clases `fb__verdict--correct|wrong|dont`.
- Al fallar o «No sé»: veredicto, avisos de piezas (`.bp__misplaced`, solo si `wrong`), solución (`.bp__correct`), `explain_es`, gramática, matiz. Al acertar: veredicto y matiz breve (≤ 160).


## 2.6-T1 (punto 3) — `phraseCloze` usa el panel común — 2026-10-31

- Puede dar «casi» (texto escrito con errata), así que NO es binario. Veredicto propio vía `verdict`: «¡Bien!», «Casi: revisa la ortografía de la palabra marcada.», «Todavía no. Fíjate en la corrección:», «No pasa nada: así se dice.». Clases `fb__verdict--correct|almost|wrong|dont`.
- Orden: veredicto, `before` (diferencia de palabras `wordDiff`, no en «No sé»; aviso de ortografía `.pc__spell`), solución (`.pc__correct`, solo si no acertó), `explain_es` (`.fb__explain`).
- Excepción a «notas en todos los tipos»: la gramática y el matiz del ítem ya se pintan SIEMPRE en recuadros (`.pc__grammar`, `.pc__nuance`) antes de contestar, como parte de la pregunta. Al panel solo se le pasa `explain_es`, para que al fallar no salgan repetidos. Al acertar no sale matiz del panel por la misma razón.

## 2.6-T1 (punto 4) — Ninguna pantalla fuera del panel — 2026-10-31

- Búsqueda en `ui/`: no queda ninguna clase `*__verdict` propia (solo `fb__verdict*`). Los ocho componentes con feedback propio (`phraseCloze`, `threeForms`, `choice`, `textAnswer`, `clozeBank`, `orderBlocks`, `matchPairs`, `buildPieces`) importan `feedbackNodes`. Palabra, traducir, `fix_error` y transformar montan `textAnswer`; elegir, ordenar y construir son envolturas de `choice`, `orderBlocks` y `buildPieces`.
- Guardia estática `tests/feedbackNoOwnVerdict26.test.mjs` (3 pruebas): sin `*__verdict` propio en `ui/exercises/` y los ocho importan el panel (import al inicio de línea).

## 2.6-T1 (punto 5) — Pruebas de cruce de CA 1 y CA 3 — 2026-10-31

- `tests/family26Criteria.test.mjs` (61 pruebas): una tabla de los 30 tipos del registro cableado (se compara con `reg.types()`, así un tipo nuevo sin cubrir falla). Por tipo, dos pruebas con el componente real del registro: fallar a propósito y «No sé».
- CA 1: un solo `.fb__verdict` (`--wrong` o `--almost` al fallar, `--dont` con «No sé», texto «No pasa nada…»), ninguna clase `*__verdict` propia en todo el árbol, y las notas `explain_es`, `grammar_note_es` y `nuance_es` presentes al fallar (`phraseCloze`: gramática y matiz en `.pc__grammar` y `.pc__nuance`, excepción del punto 3).
- CA 3: la respuesta correcta está dentro del panel de feedback tras fallar y tras «No sé»; en elegir, la opción correcta lleva `.ch__option--right`.
- No cubre «acertar» (lo hacen las pruebas de cada pantalla en `feedbackMigration26`) ni el estado «casi» de cada tipo (solo `phraseCloze` y `threeForms`, en `feedbackMigration26`).

## 2.6-T1 (punto 6) — CSS del panel y de la solución de cada pantalla — 2026-10-31

- Quedan como estilos del feedback: `.fb__verdict` (con color solo en `--correct` y `--almost`; `--wrong` y `--dont` usan el color de texto normal, igual que antes), `.fb__correct`, `.fb__explain`, `.fb__nuance`, `.fb__box-label`, `.fb__box-text`, y la solución propia de cada pantalla (nodo con `lang` o varios renglones, pasado como `answer`): `.ch__correct`, `.ob__correct`, `.ma__correct`, `.cb__correct`, `.bp__correct`, `.pc__correct`.
- Ya no existen los `*__verdict*` de pantalla, `.ta__correct`, `.ta__explain`, `.ta__nuance`, `.ta__box-*` ni `.pc__explain`: veredicto, explicación y notas se estilan solo con `.fb__*` (en `phraseCloze`, gramática y matiz siguen en `.pc__grammar` y `.pc__nuance`, excepción del punto 3).
- Guardia `tests/feedbackNoOwnVerdict26.test.mjs` (7 pruebas): sin `*__verdict` propio en `ui/exercises/` ni en `components.css` y `widgets.css`; toda clase de los prefijos `ta`, `ch`, `ob`, `ma`, `cb`, `bp`, `tf`, `pc`, `fb` definida en el CSS la usa alguna pantalla (las armadas con plantilla, `fb__verdict--${estado}` y `tf__form--${veredicto}`, cuentan por su prefijo); y no se borran las reglas de la lista anterior. Una clase nueva de esos prefijos debe usarse en una pantalla en el mismo cambio, o la guardia la marca como huérfana.

## 2.6-T1 (cierre) — contrato del panel de feedback común — 2026-10-31

- Las 9 pantallas (`textAnswer`, `threeForms`, `choice`, `orderBlocks`, `matchPairs`, `clozeBank`, `buildPieces`, `phraseCloze` y los tipos que montan `textAnswer`) pintan veredicto y notas SOLO con `feedbackNodes` de `ui/feedbackPanel.js`. Orden fijo: veredicto · aviso propio (`before`) · respuesta correcta (si no acertó) · `explain_es`, `grammar_note_es`, `nuance_es` · `after`.
- Clases del veredicto: `fb__verdict fb__verdict--<correct|almost|wrong|dont>`. Ningún tipo define `*__verdict` propio (guardia `tests/feedbackNoOwnVerdict26.test.mjs`).
- Cruce CA 1 y CA 3 en `tests/family26Criteria.test.mjs`: por cada tipo del registro, fallar y «No sé» muestran el veredicto del panel y la respuesta correcta.
- Pendiente en 2.6: T2 (nota «¿por qué creías eso?» con el evento `note`; reportes en `meta`, clave `report:<itemId>`) y T3 (sonido, vibración, mascota, auditoría de cadenas, guion `tests/scenarios/2.6.md`).

## 2.6-T2 (punto 1) — Reporte local de ítems (`core/itemReport.js`) — 2026-10-31

- `createItemReport({ db, clock? })` → `{ mark(itemId, kind, now?), clear(itemId, kind), get(itemId), list(kind?), keyOf(itemId) }`. `kind` es `'hard'` («Marcar como difícil») o `'doubt'` («No me convence esta frase»).
- Almacén `meta`, clave `report:<itemId>` (itemId de 1 a 200 caracteres, sin espacios, barras ni comillas). Registro: `{ key, v: 1, itemId, kind, at, marks: { hard?: ISO, doubt?: ISO } }`. `kind` y `at` = el último reporte (la forma `{ kind, at }` fijada en «2.6»); `marks` = uno por tipo, el último gana.
- `get(itemId)` → `{ itemId, hard: ISO|null, doubt: ISO|null }` o `null`. `list(kind?)` ordenada por `itemId`. Ambas leen también un registro con solo `{ kind, at }` e ignoran lo ilegible.
- `clear` quita un tipo; si no queda ninguno borra el registro. Sin almacén nuevo; entra en el respaldo porque `exportAll` incluye todo `meta` (prueba con `exportAll`/`importAll`).
- Aclaración del contrato «2.6»: «un reporte por tipo» exige `marks`; la clave y el almacén no cambian.

## 2.6-T2 (punto 2) — Menú «⋯» de reporte (`ui/reportMenu.js`) — 2026-10-31

- `reportMenu({ h, itemId, report, onChange? })` → `Node | null`. `report` = `createItemReport(...)` (`get`, `mark`, `clear`, `keyOf`). Sin `report` válido o con un `itemId` que el almacén rechaza devuelve `null`; sin `h` lanza `TypeError`. `onChange(kind, marked)` se llama solo tras guardar con éxito y un error suyo se ignora.
- Estructura: `.fb__report` con el botón `.fb__report-toggle` («⋯», nombre accesible «Más opciones de este ejercicio», `aria-expanded`, `aria-controls`), la lista `.fb__report-list` (oculta con `hidden`) con dos `.fb__report-option` (`aria-pressed`) y `.fb__report-status` (`role="status"`, `aria-live="polite"`).
- Opciones: «Marcar como difícil» / «Quitar la marca de difícil» y «No me convence esta frase» / «Quitar «No me convence esta frase»». Textos en `RM_TEXT`.
- Mientras carga o guarda: `aria-disabled="true"` (nunca `disabled`, para no perder el foco) y se ignoran las pulsaciones. Si guardar falla el estado no cambia y el aviso no culpa.
- Todavía NO está cableado a ninguna pantalla ni a la sesión.

## 2.6-T2 (punto 3) — Menú «⋯» cableado al panel y a las pantallas — 2026-10-31

- `feedbackNodes({ …, report })`: `report` es un nodo (el menú) o nada; va SIEMPRE el último del feedback, en cualquier estado. Un valor que no es nodo se ignora.
- `reportFor(h, ctx, item)` (`ui/reportMenu.js`) → `Node | null`. Usa `ctx.entry.itemId` y, si falta, `item.id`. Sin `ctx.report`, sin id de texto o con un id que el almacén rechaza devuelve `null`; nunca lanza.
- `createExerciseRegistry({ …, report })`: `report` es un `createItemReport`, una función que lo devuelve (se llama al montar cada ejercicio) o null. Llega al componente como `ctx.report`. Si la función lanza, se registra con `log` y el ejercicio se monta sin menú.
- `app/itemReportLazy.js`: `lazyItemReport(getStudy)` → función `() => createItemReport | null` (null sin `services.study` o sin base; reutiliza el objeto mientras `study` no cambie).
- Las 8 pantallas con feedback pasan `report: reportFor(h, ctx, item)`; la guardia de `tests/reportWiring26.test.mjs` falla si una pantalla nueva con `feedbackNodes` no lo pasa.
- Sigue sin cablear: el campo «¿por qué creías eso?» (evento `note`).

## 2.6-T2 (punto 4) — Nota «¿por qué lo pensaste?» (evento `note`) — 2026-10-31

- `createWhyNote({ events })` (`core/whyNote.js`) → `{ save(entry, item, text), MAX: 2000 }`. `save` NUNCA rechaza: `{ status: 'saved', event }`, `{ status: 'empty' }` (texto vacío, solo espacios o solo controles; no escribe) o `{ status: 'error' }` (sin `itemId` válido o la base falla).
- Evento: `{ type: 'note', itemId, cardId?, topics, exerciseType?, responseRaw }`. El esquema de `core/eventSchema.js` ya admitía `itemId`, `cardId`, `topics` y `exerciseType` en `note`: NO se amplió. `itemId` sale de la entrada (o del ítem); `cardId` solo si empieza por `<itemId>#`; `topics` de la entrada o del ítem (los que tienen forma válida). Se omite lo que no vale en vez de perder la nota.
- Texto: sin caracteres de control (salvo tabulador y saltos de línea), recortado y cortado a 2000 caracteres. Cada guardado crea un evento nuevo (no se editan).
- Las notas no cuentan como respuestas: estadísticas, dominio, uso diario y armador solo leen eventos `answer` (prueba con `accuracyByType`).
- `whyNote({ h, why, entry, item })` y `whyFor(h, ctx, item)` (`ui/whyNote.js`) → `Node | null`. `whyFor` da `null` sin `ctx.why`, sin itemId o si ningún tema de la entrada o del ítem empieza por `gram.`. Estructura: `.fb__why` con `.fb__why-toggle` (`aria-expanded`, `aria-controls`), `.fb__why-body` (oculto con `hidden`; etiqueta, `<textarea maxlength=2000>`, `.fb__why-save`) y `.fb__why-status` (`role=status`). Mientras guarda, `aria-disabled` y no `disabled`. Si falla conserva el texto; el mismo texto ya guardado no se guarda otra vez. Textos en `WN_TEXT`.
- `feedbackNodes({ …, why })`: solo con los estados `wrong` y `dont`; va justo antes de `report`.
- `createExerciseRegistry({ …, why })`: objeto, función o null; llega como `ctx.why`. `app/whyNoteLazy.js`: `lazyWhyNote(getStudy)` (null sin `services.study.events`).
- «Tipos de gramática o teoría» se aplica por tema del ítem (`gram.*`), no por tipo de ejercicio. Teoría (`theory`) aún no existe como tema; ver DECISIONS.

## 2.6-T3 (punto 1) — Mascota según el resultado (`core/feedbackCues.js`) — 2026-10-31

- `mascotStateFor(result)` → `'happy'` con `correct`; `'thinking'` con `wrong`, `dont_know` y `dont`; `'neutral'` con cualquier otro valor (`almost`, `skipped`, valores raros). Nunca lanza.
- La vista de sesión (`ui/views/sesion.js`) lo aplica tras guardar la respuesta y vuelve a `neutral` al pasar al siguiente ejercicio. El movimiento sigue respetando `prefers-reduced-motion` (lo hace el componente `createMascot`, sin cambios).
- Sigue sin hacerse en T3: sonido, vibración, auditoría de cadenas y guion `tests/scenarios/2.6.md`.

## 2.6-T3 (punto 2) — Sonido (`core/feedbackCues.js`, `app/soundEngine.js`) — 2026-10-31
- `soundFor(result, enabled)` → `'correct'` solo si `result === 'correct'` y `enabled === true`; si no, `null`. `soundForFinish(enabled)` → `'finish'` o `null`. `TONES.correct` y `TONES.finish`: listas congeladas de `{ freq, at, dur, gain }` (seno, ganancia ≤ 0,1).
- `createSoundEngine({ win? })` → `{ unlock() → boolean, play(name) → boolean, destroy() }`. Único sitio que toca `AudioContext`/`webkitAudioContext`. `play` es síncrono, nunca lanza y devuelve `false` sin Web Audio, con contexto que no se crea o con nombre que no es de `TONES`.
- `ui/views/sesion.js` lee `services.settings.get('sounds')` en el momento de sonar (sin ajustes cargados vale el valor por defecto, `true`; si leer lanza, no suena). `services.sound` permite inyectar el motor (pruebas); la vista solo cierra el que creó ella. El contexto se crea en el primer `pointerdown` o `keydown` dentro de la sesión; `play` también lo intenta si aún no existe.
- No suena al fallar, en «No sé», con «casi» ni al saltar. No hay ajustes nuevos ni CSS.

## 2.6-T3 (punto 3) — Vibración (`core/feedbackCues.js`, `app/vibration.js`) — 2026-10-31
- `vibrationFor(result, enabled)` → `10` solo si `result === 'correct'` y `enabled === true`; si no, `0`. `PULSE_MS = 10`.
- `createVibration({ nav? })` → `{ pulse(ms) → boolean }`. Único sitio que toca `navigator.vibrate`. Solo acepta enteros de 1 a 50; sin `navigator.vibrate`, si lanza o devuelve distinto de `true`, devuelve `false`. Nunca lanza. Siempre un número, nunca un patrón.
- `ui/views/sesion.js` lee `services.settings.get('vibration')` al acertar (sin ajustes cargados vale `true`; si leer lanza, no vibra). `services.vibration` permite inyectarlo (pruebas). No vibra al fallar, en «No sé», con «casi», al saltar ni al cerrar la sesión. Sin ajustes nuevos ni CSS.

## 2.6-T3 (punto 4) — Auditoría de cadenas sin culpa (`tests/noBlame26.test.mjs`) — 2026-10-31
- Regla: ningún texto que ve la persona usa «incorrecto/a», «equivocar», «fallaste/fallas», «cometiste», «tu error», «error tuyo», «culpa» (salvo «sin culpa»), «mal» suelto, insultos, castigo ni «deberías/tienes que». Se comparan en minúsculas y sin tildes (`tests/_blameScan.mjs`, `BLAME_RULES`).
- Se mantienen «Todavía no.» y «No pasa nada:» (decisión del Administrador); una prueba fija su texto exacto.
- Alcance que la prueba recorre: los 18 objetos exportados `*_TEXT` (`SESSION_TEXT` incluido; si un archivo de `ui/` exporta uno nuevo y no está en la lista, la prueba falla) y los literales de cadena de todo `ui/`, `core/textErrors.js`, `masteryExplain.js`, `session.config.js`, `errorDetect.js`, `sessionDriver.js`, `itemReport.js`, `whyNote.js`, `feedbackCues.js` y `app/cardActions.js`. Un texto nuevo con culpa en esos archivos rompe `npm run check`.
- Cambios de texto visibles: etiqueta de palabra «incorrecta» → «no coincide» (`wordDiff`) y «no encaja» (`wordChip`); «✗ Incorrecto» → «✗ No encaja» (`clozeBank`); `masteryExplain`: «no te salió» en vez de «fallaste».



## 2.7-T1 — Barra de ayudas y «Otros ejemplos» (`ui/actionBar.js`, `ui/examplesSheet.js`, `app/examplesSource.js`, `core/otherExamples.js`, `core/pausableVisibility.js`) — 2026-10-31
- `collectExamples({ topicIds, topics?, items?, currentItem?, excludeItemIds?, min?, max? })` → `{ examples, count, min, enough, shortBy }`. `examples`: `[{ en, es | null, kind: 'theory' | 'item', itemId?, topicId? }]`, como mucho `max` (6), sin repetidas (`exampleKey`: sin mayúsculas, tildes, contracciones ni puntuación final). `min` = 3. Orden estable: teoría del tema, luego ítems del tema principal y de los demás, cada grupo por id. Nunca incluye el ítem actual ni sus frases, ítems de `excludeItemIds`, ítems no originales (`ai_generated_unverified`, `needs_ai`) ni respuestas que no estén en inglés (`translate_word`). Pura; nunca lanza. También `sentenceFromItem`, `sentencesFromTopic`, `exampleKey` y `EXAMPLES`.
- `createExamplesSource({ loadItems, topics? })` → `{ forEntry(entry, { excludeItemIds? }) }` (Promesa del resultado de `collectExamples`). `loadItems(topicIds)` devuelve ítems de contenido; si falla, la promesa se rechaza. **Nadie lo crea en la app real hasta 2.9-T3.**
- `createPausableVisibility(base?)` → `{ hidden(), onChange(fn) → desuscribir, setPaused(bool), paused() }`. Misma forma que entiende `core/answerTimer.js`. Solo `true` pausa. Una base que lanza se trata como visible.
- `createActionBar({ actions, onOpen?, doc? })` → `{ el, ids, has, setBadge(id, n | null), focus(id), destroy() }`. `ACTION_IDS` = `examples`, `corrections`, `ai`, `dictionary` (orden fijo de 7.7). Sin acciones, la barra queda oculta. Insignia con `n` entero ≥ 1 (`99+` si pasa de 99); el nombre accesible lleva la cuenta.
- `createExamplesSheet({ load, onOpen?, onClose?, doc?, container?, log? })` → `{ open(), close(), isOpen(), destroy() }`. `load()` se llama en CADA apertura; si se cierra antes de que llegue, se ignora. Textos en `EX_TEXT`. Va sobre `createSheet`: el ejercicio sigue montado.
- `ui/views/sesion.js`: si existe `services.examples`, dibuja la barra con `['examples']` debajo del ejercicio (visible mientras haya uno montado; oculta en mensajes y resumen). `onOpen` de la hoja pausa el cronómetro y `onClose` lo reanuda. `services.visibility` sigue siendo la base. Sin `services.examples` la vista es idéntica a la de 2.6.
- CSS en `ui/styles/actionbar.css` (nuevo, enlazado en `index.html`).

## 2.7-T3 y T4 (partes 1 y 2) — Preguntas IA, búsqueda en el léxico y Diccionario — 2026-10-31
- `buildAskBlock({ topic?, item?, answer?, errors?, mastery?, message? }, { now? })` (`core/aiAsk.js`) → `{ ok:true, text, payload } | { ok:false, error }`. Arma el tipo `llevar_al_chat` de 8.14 con `makeChatBlock`; recorta a los límites (≤ 10 errores) y nunca lanza. Sin duda escrita usa `ASK_DEFAULT_MESSAGE`.
- `createAiHelpSource({ ai?, corrections?, mastery?, describeItem?, clock?, log? })` (`app/aiHelpSource.js`) → `{ status() → { available, reason }, prepare(entry, { answer?, message? }) }`. Solo lee `availability()`; no llama a la IA (parte 5). Cada parte que falla se omite y va al log. **Nadie lo crea en la app real hasta 2.9-T3** (`services.aiHelp`).
- `createAiSheet({ source, getEntry?, getAnswer?, clipboard?, … })` (`ui/aiSheet.js`): sin IA muestra «Conecta tu clave en Ajustes»; «Llevar al chat» copia el bloque y, si el portapapeles falta o falla, lo muestra en un cuadro seleccionable.
- `createLexSearch(entries, { limit? })` (`core/lexSearch.js`) → `{ size, search(q, { limit? }) → { query, found, results:[{ entry, match, via }], reason } }`. Lema, traducciones `es` y `derivation`, sin mayúsculas ni acentos (ñ se junta con n). `reason`: `null | 'empty' | 'short' | 'none'`.
- `createDictionarySource({ loadLexicon, db?, clock?, log? })` (`app/dictionarySource.js`) → `{ prepare(), search(q), add(word) }`. **«Añadir» no necesita contrato nuevo:** usa el almacén `words` de 8.13 (id = lema en minúsculas) con `state:'unknown'`, `source:'dictionary'`, `added` (ISO). Una palabra ya presente no se toca. Nadie lo crea en la app real hasta 2.9-T3 / 4.1 (`services.dictionary`, con el `loadLexicon` real).
- `ui/views/sesion.js`: `services.aiHelp` y `services.dictionary` suman «Preguntas IA» y «Diccionario» a la barra; `services.clipboard` es opcional.

## 2.8-T1 — Cálculo del resumen de sesión (`core/sessionSummary.js`) — 2026-10-31
- `buildSessionSummary({ events, sessionId?, state?, errors?, catalog?, masteryBefore?, masteryAfter?, cards?, now? })` → resumen **congelado en profundidad**. Pura: no lee la base, el reloj ni el azar, y no modifica lo que recibe. **Nunca lanza**: con una entrada absurda devuelve un resumen vacío con `degraded: true`.
- **Las cifras salen solo de los eventos `answer`** de `sessionId` (sin repetir ids). `state` (de `core/sessionRunner.js`) aporta lo planeado (`planned`) y el motivo de cierre (`ended`); sin él, planeado = respondidas. Campos: `empty`, `partial`, `planned`, `answered`, `pending`, `skippedWithoutEvent`, `counts { correct, almost, wrong, dontKnow, skipped }`, `accuracy` (aciertos / respondidas; «casi» no cuenta como acierto) y `accuracyPct`, `time { ms, avgMs, counted }`, `byTopic`, `mastery`, `errors`, `nextReviews`, `failed`. Con 0 respuestas todo es 0 y lo no calculable es `null`; **ningún número es NaN ni Infinity**.
- **Parcial** (CA 2): `ended` 'quit' o ítems sin responder. Sin ninguna respuesta no es parcial, es vacío. Los ítems saltados sin evento (ejercicio aún no disponible) van a `skippedWithoutEvent`: no son fallo ni respuesta.
- **Errores nuevos y recurrentes:** una ocurrencia es «de esta sesión» si el registro trae en `seen` el `ts` de una respuesta de la sesión al mismo `itemId` (así lo guarda `core/answerCommit.js`; no depende de ventanas de tiempo). `times` = veces en la sesión; `priorCount` = `count` − `times` (≥ 0). **Nuevo** = `priorCount` 0; **recurrente** = `priorCount` ≥ 1. `title` y `hint` (la microexplicación) salen del catálogo; sin catálogo quedan en `null`.
- **Dominio:** solo los temas practicados con dato «después». `direction`: 'up' / 'down' / 'same' (con los porcentajes ya redondeados) o 'new' (antes no había dato). Lleva la `confidence` de «después» para que la pantalla diga cuándo es pronto para fiarse.
- **Próximos repasos:** `days` = días LOCALES desde hoy (vencida = 0, nunca negativo); `bucket` today / tomorrow / week (2–7) / later. Una tarjeta sin `due` legible va a `unknown`.
- **`failed`** (para la mini-sesión de 2.8-T3): tarjetas cuya última respuesta fue `wrong` o `dont_know`, en orden de respuesta.
- **Regla para 2.8-T2 (ventana obligatoria, sección 5 de `PROJECT_STATE.md`):** quien llame debe leer `events.since(inicio de la sesión)` y los errores de los ítems de la sesión, **no el historial completo**. La función no lo impone porque recibe los datos ya leídos.
- Pruebas: `tests/sessionSummary.test.mjs` (26; incluye 40 sesiones generadas contra un recuento independiente y entradas hostiles) y `tests/sessionSummary.cross.test.mjs` (4, con conductor, `answerCommit`, errores y tarjetas reales). Roturas: 8 + 3 probadas; 6 de las 8 primeras se detectaron, 1 era equivalente (se simplificó el código) y 1 era un hueco real (estado a mitad de sesión), cerrado con una prueba nueva; las 3 de la segunda ronda se detectaron.

## 2.8-T2 (punto 1) — Fuente de datos del resumen (`app/summarySource.js`) — 2026-10-31
- `createSummarySource({ study, log? })` → `{ load({ sessionId, state? }) → Promesa del resumen de 2.8-T1 }`. Lecturas **acotadas**: `events.since(ahora − 24 h)` filtrando por `sessionId`; `errors.list({ day })` solo para los días de esos eventos; `db.get('cards', id)` solo de las tarjetas respondidas; dominio «después» = `board.results` de los temas practicados.
- **«Antes» del dominio = la última foto diaria ANTERIOR a hoy** (`snapshot.list({ to: ayer })`), porque `finish()` toma la foto de hoy al terminar. Consecuencia: el cambio es «desde el último día con foto», no desde el inicio exacto de la sesión; con dos sesiones el mismo día, se suman. Sin foto previa los temas salen `new`.
- Fallo de eventos → rechaza (un resumen de 0 respuestas sería falso). Fallo de errores, tarjetas o dominio → esa parte queda vacía, se avisa por `log` y el resto sale.
- **Observación para el mensaje de 2.8-T2:** el motor de dominio (1.7) da 100 % («mastered») con confianza `low` tras una sola respuesta correcta. La pantalla debe mostrar siempre el porcentaje junto a su confianza y no celebrarlo como dominio cuando la confianza es baja.
- Pruebas: `tests/summarySource.test.mjs` (11, servicios reales). Roturas: 4 + 2 probadas; 2 huecos reales (foto de hoy en «antes», tarjetas de otras sesiones) cerrados con pruebas nuevas.

## 2.8-T2 (punto 2) — Contenido de la pantalla de resumen (`core/summaryText.js`) — 2026-10-31
- `describeSummary(summary, { topicName? })` → objeto congelado `{ kind: 'empty'|'partial'|'full', title, message, stats, breakdown, mastery { lines, more }, errors { fresh, recurrent, more }, reviews { lines, unknown }, actions { retry } }`. Puro y sin DOM; nunca lanza (una entrada que no es un resumen da el de «sin respuestas»). La vista (punto 3) solo lo dibuja. `SUMMARY_TEXT` agrupa todas las cadenas; sus funciones toleran argumentos ausentes y nunca escriben «undefined» ni «NaN».
- **Mensaje final honesto:** vacío, parcial (con lo hecho y lo pendiente; sin «Quedaron 0»), corto (< 3 respuestas: «es pronto para sacar conclusiones», aunque sea 100 %), sólido (**≥ 5 respuestas y ≥ 85 %**), buen avance (≥ 50 %) y «hoy costó más» (< 50 %). Nunca elogia lo que no se midió ni culpa por lo que costó.
- **Dominio:** cada porcentaje sale con su confianza («todavía es pronto para fiarse» / «va tomando forma» / «dato firme» / «sin confianza medida»); no se usan palabras de logro («dominado»). Una línea sin números afirmables se omite. Hasta 6 temas; `more` cuenta el resto.
- **Errores:** hasta 5 en pantalla, los recurrentes primero; cada línea `«original» → «corrección»`, microexplicación (`hint`) y nota («Ya había aparecido N veces antes», «Apareció dos veces hoy», «Conviene practicarlo con calma»). **Repasos:** solo las franjas con algo, y «Sin fecha de repaso todavía» si falta el dato. **Acción `retry`** solo si hay tarjetas fallidas (`wrong` / `dont_know`; «casi» no cuenta).
- **Auditoría sin culpa:** `tests/summaryText.test.mjs` revisa todo `SUMMARY_TEXT` y lo que sale de 300 resúmenes generados; `core/summaryText.js` entra en la lista de `tests/noBlame26.test.mjs`.
- Pruebas: `tests/summaryText.test.mjs` (15). Roturas: 10 probadas, 10 detectadas. Dos fallos reales corregidos al escribirlas (funciones de texto con «undefined» si faltaban argumentos; «NaN %» en una línea de dominio malformada).

## 2.8-T2 (punto 3) — Panel del resumen de sesión (`ui/summaryPanel.js`) — 2026-10-31
- `createSummaryPanel({ content, onRetry?, onBack?, doc? })` → `{ el, retryButton, backButton, destroy() }` (congelado). `content` = resultado de `describeSummary` (2.8-T2 punto 2); si no lo es (`null`, `{}`, texto…) dibuja el de «sin respuestas». Solo dibuja: no calcula, no lee base y no navega.
- **Estructura** (`<section class="summary summary--{empty|partial|full}">`): título `h2`, mensaje, cifras (`dl`), desglose, y las secciones «Tu dominio por tema», «Para afinar» (con «Vuelve a aparecer» antes que «Nuevo hoy») y «Próximos repasos» **solo si tienen algo**. Cada error: título, `«mal» → «bien»` (`lang="en"`), pista (`lang="es"`), nota y temas. «y N temas más» / «y N más» cuando `describeSummary` dejó cosas fuera.
- **Botones solo si funcionan:** «Repetir los que fallé» existe si `content.actions.retry` Y se pasó `onRetry(count)`; «Volver a Practicar» existe si se pasó `onBack`. Una acción que lanza se anota con `console.error` y el panel sigue vivo. Sin ninguno de los dos, no hay bloque de acciones.
- Textos propios en `SP_TEXT` (entra en `tests/noBlame26.test.mjs`). Todo texto entra como nodo de texto (sin `innerHTML`). Estilos en `ui/styles/summary.css` (enlazado en `index.html` tras `actionbar.css`).
- **Aún no conectado:** `ui/views/sesion.js` sigue dibujando su resumen mínimo; el punto 4 lo sustituye por este panel y por `createSummarySource`. «Llevar al chat» es de 2.8-T3 y no está en el panel.
- Pruebas: `tests/summaryPanel.test.mjs` (13, DOM falso). Roturas: 5 probadas, 5 detectadas (retry sin `onRetry`, sin `lang="en"`, sección de dominio vacía, orden de errores, falta del «y N más»).

## 2.8-T2 (punto 4) — Resumen completo conectado en `ui/views/sesion.js` — 2026-10-31
- Al terminar la sesión (`driver.next()` → `finished`), `showSummary` pone «Preparando tu resumen…», lee con `services.summarySource` (opcional; por defecto `createSummarySource({ study, log })`) llamando `load({ sessionId, state })`, lo pasa por `describeSummary` (nombres de tema = `title_es` de `study.topics`, o el id si falta) y dibuja `createSummaryPanel({ content, onBack })`. «Volver a Practicar» navega a `practicar`.
- **Si la fuente no se puede crear o falla**, se muestra el resumen mínimo de antes («Respondiste N ejercicios de M…») y el motivo va a `log`: nunca queda la pantalla vacía. Si la vista se cierra mientras se lee, no se dibuja nada (comprobado con el contador de listeners).
- **Cambio visible:** el resumen cuenta las respuestas con evento (un ejercicio saltado por «no soportado» no cuenta) y una sesión sin respuestas dice «Sesión sin ejercicios». Pruebas viejas de `sesion.ca` y `sesionView` actualizadas a esos textos.
- **No incluido (siguientes puntos):** abandonar a mitad todavía sale directo a Practicar (el resumen parcial de CA 2 va en el punto 5); «Repetir los que fallé» y «Llevar al chat» son de 2.8-T3.
- Pruebas: `tests/sesionView.resumen.test.mjs` (6). Roturas: 4 probadas, 4 detectadas (una prueba débil reforzada).

## 2.8-T2 (punto 5) — Abandonar a mitad = resumen parcial (`ui/views/sesion.js`) — 2026-10-31
- En la confirmación «¿Salir de la sesión?», «Salir» espera `driver.idle()` y, **con al menos una respuesta**, muestra el resumen PARCIAL: calcula `transition(estado, 'QUIT')` (`ended: 'quit'`) solo para el resumen, lo pasa a `summarySource.load({ sessionId, state })` y dibuja el panel («Sesión a medias», «x de N», «Quedaron M sin ver»). **Sin respuestas** va directo a Practicar, como antes.
- **La sesión guardada NO se borra** y el estado del driver no cambia: se puede retomar desde su dirección (caduca a las 12 h), como dice el mensaje parcial. Con el resumen en pantalla, la flecha de la cabecera sale sin volver a preguntar.
- Sin el tono de «sesión terminada» al abandonar (no se celebra lo que no se terminó). Si la fuente falla, resumen mínimo («Respondiste 1 ejercicio de 3.»).
- **Cambio visible:** «Salir» con respuestas ya no navega de inmediato: primero se ve el resumen y después «Volver a Practicar». Dos pruebas viejas (`sesion.ca` CA 5 y `sesionView`) actualizadas a eso.
- Pruebas: 6 nuevas en `tests/sesionView.resumen.test.mjs` (12 en total). Roturas: 4 probadas, 4 detectadas (una prueba débil, la del sonido, añadida).

## 2.8-T3 (punto 1) — «Repetir los que fallé» (`startRetrySession` + vista) — 2026-10-31
- **`startRetrySession({ study, items, rng? })`** (`core/sessionDriver.js`) → `{ status: 'started', sessionId, state, items }` | `{ status: 'empty' }`. Arma una sesión nueva con las entradas dadas (las de una sesión anterior): conserva el orden, descarta las que no son objetos o no tienen `cardId`/`itemId`, no repite tarjeta y corta en 100 (`MAX_ITEMS`). Sin ninguna válida devuelve `empty` y no escribe. Guarda como `startSession`: **la última sesión guardada gana**. Sin `study.session`/`study.clock` lanza `Error` en español («no hay dónde guardar la sesión»).
- **Vista:** el panel recibe `onRetry` solo si el resumen trae tarjetas fallidas (`summary.failed`: última respuesta `wrong` o `dont_know`). Al tocarlo, filtra `driver.getItems()` por esas tarjetas, llama a `startRetrySession` y navega a `#/sesion/<id nuevo>`. Un solo toque vale mientras se arma; si falla, aviso «No pude preparar la repetición. Puedes volver a intentarlo.», motivo al log y el botón sigue sirviendo. También sale en el resumen parcial.
- **Efecto a tener en cuenta:** repetir desde un resumen parcial **reemplaza** la sesión guardada que se había dejado a medias (última gana).
- Pruebas: `tests/sessionRetry.test.mjs` (6) y 6 nuevas en `tests/sesionView.resumen.test.mjs` (18 en total). Roturas: 6 probadas, 6 detectadas.

## 2.8-T3 (punto 2) — «Llevar al chat» del resumen (`core/summaryChat.js`, `app/chatCopy.js`, panel y vista) — 2026-10-31
- **`summaryChatWorthy(summary)`** → boolean: hay algo que llevar si el resumen crudo trae errores tocados, tarjetas fallidas o un tema cuyo dominio bajó. Sesión vacía: no.
- **`buildSummaryChatBlock(summary, { topicName?, now? })`** → `{ ok:true, text, payload }` | `{ ok:false, error:{ code, message } }` (`NOTHING_TO_SEND` si no hay nada). Nunca lanza. Reúsa `buildAskBlock` (tipo `llevar_al_chat` de 8.14, que `parseChatBlock` lee de vuelta). Lleva: tema = el del primer error (los que vuelven primero; sin errores, el del primer dominio que bajó), ítem = línea con ejercicios, aciertos y precisión («Sesión a medias» si es parcial), hasta 5 errores (los que vuelven, luego los nuevos), dominio del tema elegido y un mensaje que pide ayuda según lo que haya (errores, fallos, dominio bajó, sesión a medias).
- **`copyForChat(text, clipboard, { log? })`** (`app/chatCopy.js`) → `{ status:'copied' }` | `{ status:'manual', text }`. Sin portapapeles o si falla: motivo al log y el texto vuelve para copiarlo a mano. Nunca lanza.
- **`describeSummary`** suma `actions.chat: { label } | null` (solo si `summaryChatWorthy`).
- **Panel:** `createSummaryPanel({ ..., onChat? })` → suma `chatButton`. El botón existe solo con `actions.chat` Y `onChat`; `onChat` es asíncrona y devuelve `{ status:'copied' | 'manual' (con text) | 'failed' }`. El panel dice «Copiado. Pégalo en el chat.», muestra el bloque seleccionable o avisa sin culpa; un segundo toque en curso se ignora y destruir el panel corta lo pendiente. El botón primario sigue siendo «Repetir» si existe.
- **Vista:** `ui/views/sesion.js` arma el bloque al tocar (con el resumen crudo y los nombres de tema) y copia con `services.clipboard` o el del navegador. También sale en el resumen parcial.
- Pruebas: `tests/summaryChat.test.mjs` (9), 5 nuevas en `tests/summaryPanel.test.mjs` y 5 en `tests/sesionView.resumen.test.mjs`. Roturas: 7 probadas, 7 detectadas.

## 2.9-T3 (punto 1) — Importar el contenido al arrancar (`app/contentStartup.js`) — 2026-11-01
- **`startContent({ storageReady, fetchFn?, clock?, log? })`** → Promesa de `{ ok, skipped, missing?, reason?, results, failed }`. Espera la base, lee `content/taxonomy/error_codes.json` y `topics.json` para armar `ctx` (`errorCodes`, `topicIds`, `topicInfo`) y llama a `importPacksToDb(db, fetchFn, { ctx, now })`. `now` sale de `clock` o de `new Date()`.
- **Nunca rechaza.** Sin base → `{ ok:false, skipped:true, reason:'db' }`; sin fetch → `reason:'fetch'`; error inesperado → `reason:'error'`. Un índice que no existe NO es fallo (`ok:true`, `missing:true`, sin tarjetas). Un paquete inválido → `ok:false` con `failed` y sin tarjetas a medias. Si la taxonomía no carga, importa sin comprobar temas ni códigos y lo anota en `log`.
- **Cableado:** `app/main.js` guarda la promesa en `services.contentReady` justo después de `services.studyReady`. Es idempotente (no vuelve a descargar un paquete ya importado en esa versión o mayor).
- Pruebas: `tests/contentStartup.test.mjs` (10) con el paquete semilla real. Roturas: 7 probadas, 7 detectadas (2 sobrevivieron al principio y se cerraron con pruebas de taxonomía).
- **Límites conocidos:** no hay precache de `content/index.json` ni de paquetes (punto 2); tampoco resolvedor de ítems ni botón «Estudiar ahora» (siguientes puntos); no probado en navegador real (M1).

## 2.9-T3 punto 2 — Precache de `content/index.json` y de los paquetes con el shell — 2026-11-01

Ampliación del contrato de caché de 0.6A (aprobada por el Administrador, opción 1; **sustituye al stale-while-revalidate de paquetes de la sección 8 mientras el tamaño total de `content/` siga por debajo de 15 MB**). No cambia el texto de la Parte 1.

- **`tools/build-manifest.mjs`:** `INCLUDE_DIRS` gana `content/packs` e `INCLUDE_FILES` gana `content/index.json` (junto a `content/taxonomy`). Siguen fuera `audio/`, `content/drafts/`, tests, tools y docs. El hash de cada paquete entra en `cacheVersion`: **un paquete nuevo o cambiado sube `cacheVersion`**, el navegador instala la caché nueva en segundo plano y la app ofrece «Actualizar» (nunca se corta una sesión).
- **`sw.js`:** `content/*` se sirve como shell (primero caché, ignora `?v=`, sin revalidar en segundo plano; lo que no está en el manifest se pide a la red y no se guarda). Desaparece la clase `packs`. Al activar se borra `sophia-packs-v1` (ya no se usa). `sophia-audio-v1` no cambia.
- **Efecto sobre `loadPack`:** índice y paquete salen siempre de la misma instalación, así que `STALE` solo podría saltar por la caché HTTP del navegador; la comprobación se mantiene como defensa.
- **Coste:** cada lote de contenido sube la versión PATCH (regla ya vigente). `content/` pesa hoy 491.831 bytes (0,47 MB); el precache descarga todo al instalar.
- **Plan B (9.4-T4):** si `content/` supera 15 MB, separar los paquetes en su propia caché (SWR en `sophia-packs-v1`, sembrada al instalar).
- **Pruebas:** `tests/offlineFirstRun.test.mjs` (5): con el `sw.js` real y los archivos reales, instalada y SIN red, el índice y el paquete semilla se cargan y validan, `startContent` importa las 60 tarjetas, `plan()` arma una sesión con ítems del paquete, con 0 peticiones a la red y 0 avisos en `log`; control sin instalar. `tests/sw.test.mjs` y `tests/build-manifest.test.mjs` actualizadas. Roturas: 17 probadas, 17 detectadas.
- **Límite:** no se probó en un navegador ni en el teléfono (hito M1).

## 2.9-T3 punto 3 — Importar respaldo con vista previa y contenido tras borrar o importar — 2026-11-01

Ampliación (no modifica la Parte 1). `core/sync.js` NO cambia: `previewBackup` e `importBackup` ya admitían `mode: 'merge' | 'replace'` (1.12-T1); ahora la pantalla los usa.

- **Ajustes › Respaldo › Importar:** elegir archivo → `sync.previewBackup(texto, { mode })` para los dos modos (NO escribe; un archivo inválido avisa con el texto amable ANTES de abrir ningún diálogo) → diálogo «Importar respaldo» con el nombre del archivo, un selector «Fusionar» / «Reemplazar» y una frase de impacto → «Importar» llama a `sync.importBackup(texto, { mode })` y a `tools.afterRestore()`. **Entra en «Fusionar»** (no quita nada); «Reemplazar» anuncia cuántos datos se perderían. Las claves de este dispositivo se conservan en ambos modos. Cancelar no escribe nada.
- **`ui/views/importPreview.js`:** `importSummary(preview) → texto` (puro, nunca lanza; cifras inválidas cuentan 0) e `IMPORT_MODES`.
- **`createDataTools({ db?, settings, afterChange?, log? })`:** `afterChange` (función, opcional) se llama tras `wipeAll()` y tras `afterRestore()`; si lanza se anota en `log` y la operación sigue.
- **`services.reimportContent()`** (`app/main.js`) → vuelve a llamar a `startContent` y deja el resultado en `services.contentReady`. Ajustes lo pasa como `afterChange`. Motivo: «Borrar todo» (que ya vaciaba cada almacén con `clear(store)`, 0.8) o un respaldo sin tarjetas dejaban la base sin el paquete hasta cerrar la app.
- **Pruebas:** `tests/importPreview.test.mjs` (5), `tests/settingsData.test.mjs` (+3, 4 adaptadas), `tests/dataTools.test.mjs` (+1), `tests/contentStartup.test.mjs` (+2). Roturas: 19 probadas, 19 detectadas (una sobrevivió al principio y se cerró con una prueba de cifras inválidas).
- **Límite:** nada probado en un navegador ni en el teléfono (hito M1). Los guiones `0.8.md` y `HITO_M0.md` describen el diálogo nuevo.

## 2.9-T3 punto 4 — Resolvedor de ítems, registro de tipos compartido y «Estudiar ahora» — 2026-11-01

Ampliación (no modifica la Parte 1). Cumple lo que 2.1-T4 dejó provisional (`resolveItem` inyectado sin resolvedor real).

- **`app/itemResolver.js`:** `createItemResolver({ fetchFn?, log? })` → `{ resolve(itemId) → Promesa del ítem | null, preload() → Promesa de Map, reset() }`. Lee `content/index.json` y cada paquete con `loadPack` (que valida el paquete completo) y arma un mapa id → ítem; después sale de la memoria. `resolve` nunca rechaza (id desconocido o no texto, sin fetch, índice caído o paquete dañado → `null`, anotado en `log`); un id que no es texto no hace ninguna lectura. **Un fallo no se guarda:** si falló el índice o algún paquete, la siguiente llamada reintenta (los paquetes buenos sí se usan). Con un id repetido manda el primero del índice. Solo ítems (las preguntas de historias y el léxico usan otros espacios de ids: 4.x y 6.x).
- **`services.itemResolver`** (`app/main.js`) y `createExerciseRegistry({ resolveItem: (id) => services.itemResolver.resolve(id), … })`.
- **`app/exerciseTypes.js`:** `registerExerciseTypes(registry, { catalog?, log? })` registra los 30 tipos de 2.2 a 2.5 (antes en línea en `main.js`); lanza si alguno ya estaba. Las pruebas de cableado de 2.3 a 2.5 leen ahora este archivo; `tests/exerciseTypes.test.mjs` exige que todo tipo usado por el paquete semilla esté registrado.
- **`ui/views/hoy.js`:** marcador de Hoy (hasta la 3.4) con el botón «Estudiar ahora» → `services.navigate('sesion', { id: 'nueva' })`. Dice «Preparando…» y está deshabilitado hasta que `services.contentReady` se resuelve; si el contenido falló, avisa sin culpar y deja el botón disponible (la sesión explica qué falta). Se monta de forma síncrona (no retrasa la navegación) y no escribe nada si la vista ya se destruyó.
- **Prueba de extremo a extremo sin conexión:** `tests/offlineFirstRun.test.mjs` (6): con el `sw.js` real instalado y la red cortada, el primer ejercicio del plan se monta y los 60 ítems del paquete semilla se dibujan, sin avisos y con 0 peticiones a la red.
- **Roturas:** 27 probadas (resolvedor 10, Hoy 10, registro de tipos 7), 27 detectadas; 6 sobrevivieron al principio y se cerraron con pruebas (id repetido, ids no texto, vista destruida, Hoy síncrona, catálogo de palabra).
- **Límite:** nada probado en un navegador ni en el teléfono (hito M1). Los 4 servicios de la barra siguen sin crear (punto 5).

## 2.9-T3 punto 5 — Servicios de la barra de ayudas (`app/helpServices.js`) — 2026-11-01

Ampliación (no modifica la Parte 1). Cumple lo que 2.7 dejó pendiente: `ui/views/sesion.js` solo muestra un botón si su servicio existe, y hasta ahora ninguno existía.

- **`app/helpServices.js`:** `createHelpServices({ services, fetchFn?, log? })` → objeto congelado `{ examples, corrections, aiHelp, dictionary }`. Son fachadas perezosas con la misma forma que la fuente que envuelven (`examplesSource`, `correctionsSource`, `aiHelpSource`, `dictionarySource`), así que `sesion.js` no cambia. Leen `study`, `settings`, `db` e `itemResolver` al USARLAS (se completan tras el arranque) y arman cada fuente una sola vez por cada `study`/`db`/`settings` distinto.
- **Esperas:** los métodos asíncronos esperan `services.studyReady` (el diccionario, también `storageReady`) y nunca lanzan por esa espera: si falla, se anota en `log` y se sigue. Los errores de las fuentes se propagan como en la fuente (la hoja los cuenta sin culpa).
- **Sin IA:** antes de que carguen los ajustes, `aiHelp.status()` da `{ available: false, reason: 'no_ai' }` y la hoja de «Preguntas IA» ofrece «Llevar al chat». `correctionsSource` sin base o sin catálogo da `{ corrections: [], count: 0 }`.
- **`app/itemResolver.js`:** gana `byTopics(topicIds)` (ítems cuyo `topics` toca alguno; sin temas, `[]`) y `lexicon()` (el `lexicon` de los paquetes leídos; con lema repetido manda el primero). Ninguno rechaza: ante un fallo de lectura devuelven `[]` y lo anotan.
- **`app/main.js`:** crea las fachadas y asigna `services.examples`, `corrections`, `aiHelp` y `dictionary`. `fetchFn` es `globalThis.fetch?.bind(globalThis)` (con `window.fetch` se rompía el arranque en los entornos de prueba sin `fetch`).
- **Diccionario:** el paquete semilla no trae `lexicon`: hoy responde siempre «no encontrado» y ofrece añadir. Poblarlo con `content/taxonomy/lemmas.json` es una decisión de diseño abierta (PROJECT_STATE sección 5).
- **Pruebas:** `tests/helpServices.test.mjs` (31) y `tests/helpBar.test.mjs` (6: la barra aparece con las 4 acciones y, sin IA, «Preguntas IA» ofrece «Llevar al chat»).
- **Roturas:** 46 sobre `helpServices.js`, 46 detectadas (10 sobrevivieron al principio: 4 pruebas débiles, una que pasaba por coincidir la fecha del reloj de prueba con la de hoy, y un fallo real, el reloj del diccionario se capturaba antes de que existiera `study`; corregido y ahora es perezoso). 21 sobre `byTopics` y `lexicon`: 18 detectadas; las 3 vivas son guardas inalcanzables, porque `loadPack` ya rechaza un léxico con `null` y un ítem sin `topics`.
- **Límite:** nada probado en un navegador ni en el teléfono (hito M1).


## 2.9-T4 (parte 3) — FIX de 1.7 en 8.7 (dominio con poca evidencia) y Diccionario básico — 2026-11-01
**Ampliación de 8.7 (decisión del Administrador, 2026-11-01, pregunta 2).** Cambia el comportamiento de `core/mastery.js`, no la forma de sus llamadas.
- **Regla a, tope por evidencia.** `EVIDENCE_CAP = { minAnswers: 5, minItems: 3, maxBand: 'progress' }` en `core/mastery.config.js` (también `MASTERY_CONFIG.evidence`). Un tema con menos de 5 respuestas **o** menos de 3 ítems distintos no pasa de 59 % (máximo de «En progreso»), tiene confianza `low` y `compute` devuelve `lowEvidence: true`. `rawPct` sigue siendo el porcentaje antes de topes y de este tope. **No se añade a `caps`**: «en riesgo», `atRisk` y los topes por fallos seguidos o error repetido se calculan igual que antes. Sin respuestas: `pct` 0, banda `unseen` y `lowEvidence: false`.
- **Regla b, señal R.** `SIGNAL_R = { minReps: 1, zeroAfterFail: true }`. `signalR(cards, at, { retrievability, lastResult?, config })`: si `lastResult(card)` devuelve `wrong` o `dont_know`, esa tarjeta aporta 0 hasta que acierte; `skipped` no cuenta como intento. Sin `lastResult` se comporta como antes. `mastery.compute` lo obtiene de los eventos `answer` del tema.
- **Nuevo campo de salida.** `lowEvidence` (boolean) en `compute`, en `board.results`/`board.explain`, en `masteryAfter` de `buildSessionSummary` y en `changes[].lowEvidence` del resumen (`summarySource` lo pasa; solo `true` cuenta, lo raro se toma como `false`). Es opcional para quien lo consume: los consumidores que no lo conocen siguen funcionando.
- **Textos nuevos (sin culpa).** `masteryExplain`: «Poca evidencia todavía: N respuestas; hacen falta al menos 5 respuestas y 3 ejercicios distintos para pasar de X %.», la línea de tarjetas que cuentan 0 en la retención porque la última vez no salieron y «Con más práctica tu porcentaje podría ser Y %; por ahora se queda en X %.». `summaryText`: «poca evidencia todavía» en lugar de la frase de confianza.
- **Pruebas.** `tests/mastery.evidence.test.mjs` (10, fallan 10 de 10 con el código anterior), dos escenarios «un solo fallo» en `tests/simulation.test.mjs` y casos nuevos en `masterySignals`, `sessionSummary` y `summaryText`.
- **Cambio de LÓGICA, no de texto, en pruebas de 1.7:** 8 pruebas reescritas porque esperaban el resultado anterior (marcadas «FIX 2.9-T4»). **Cambio de TEXTO, no de contrato (2.6-T3, punto 7 del Administrador):** `wordDiff`, `wordChip`, `clozeBank`, `masteryExplain` («fallaste» → «no te salió»), `session.config` y Ajustes; **comprobado** contra el zip v0.25.0: las 3 pruebas de 1.7 (aserciones de `tests/masteryExplain.test.mjs`) cambiaron solo cadenas, y `session.config` cambió una sola cadena sin prueba que la fije (ver `DECISIONS.md`, «VERIFICADO»).

**Diccionario básico (decisión del Administrador, pregunta 1).**
- `lemmaEntries(table)` → `[{ lemma, band: '1K'|'2K'|'3K', pos, derivation, es: [], basic: true }]` (`derivation` = formas flexionadas sin el lema). `mergeLexicon(packEntries, basicEntries)`: las de los paquetes primero; la básica solo entra si su lema no está en un paquete (sin distinguir mayúsculas). `createLemmaLexicon({ fetchFn?, log? }).load()` guarda el resultado, no rechaza nunca y no guarda un fallo (`app/lemmaLexicon.js`). `createLemmaTable(...).entries()` (`core/lemmas.js`) devuelve copias.
- `createDictionarySource` gana `addTranslation(lemma, text)` → `{ ok, id, existed } | { ok:false, reason: 'invalid'|'no_db'|'failed' }` y `mine(lemma)` → texto | `null`. **Almacén `notes`** (ya existía): `{ id: 'dict_es:<lema>', kind: 'translation', lemma, text, added }`; texto de 1 a 120 caracteres sin control; reemplaza la anterior; **no toca `words`**. `prepare()` relee las notas.
- `services.dictionary` (`app/helpServices.js`) = `{ prepare, search, mine, add, addTranslation }`; su léxico es el de los paquetes más el de `lemmas.json`.
- Hoja (`ui/dictionarySheet.js`): para una entrada básica muestra «Palabra del inglés, banda X.», «Añadir mi traducción» (campo + «Guardar»), «Tu traducción: …» si existe y la nota «El Diccionario es básico por ahora.». No marca palabras como conocidas.
- Pruebas: `tests/lemmaLexicon.test.mjs` (17) y 4 en `tests/helpServices.test.mjs`. Rendimiento: ver `DECISIONS.md` (MEDIDA).
