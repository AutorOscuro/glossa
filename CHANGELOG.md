# CHANGELOG — Sophia Inglés

Formato (roadmap 12.3): `## v<x.y.z> — <fecha> — <subparte>` con secciones `ADD`, `CHANGE`, `FIX`, `REMOVE`.

## v0.29.0 — 2026-11-01 — 2.9 (cierre; CIERRA la subparte 2.9 y el HITO M1)

### ADD
- `tests/scenarios/HITO_M1.md`: guion único del hito M1 (33 pasos, ≈ 15 min lo obligatorio y ≈ 25 con todo), ordenado por pantalla; incluye las dos preguntas a William (gesto «atrás» sin preguntar; botón para retomar sesión).
- `tests/scenarios/2.9.md` (10 pasos) y `tests/seed29Criteria.test.mjs` (10 pruebas): CA 1 a CA 4 con el paquete semilla real; una de ellas vigila que ninguna nota de gramática se copie entre temas.
- `tests/simulation.test.mjs`: política de topes diarios (10 nuevas y 100 repasos).

### CHANGE
- Versión 0.29.0 (`core/version.js`, `package.json`, `asset-manifest.json`, `sw.js`); guiones 2.1–2.9, `HITO_M1.md` y `HITO_M0.md` (que citaba 0.14.0) citan la versión nueva.
- `content/packs/pack_seed_v1.json` pasa a v2 (`npm run add-pack`; `content/index.json` actualizado).
- Guiones corregidos: `2.9.md` (el primer día son 10 ejercicios de `can` y 4 tipos; los repasos empiezan el día 3), `2.8.md` paso 7 y `2.1.md` (sin botón «Retomar»; pregunta nueva sobre ese botón).
- `tests/contentStartup.test.mjs` y `tests/itemResolver.test.mjs`: la versión del paquete sale de `SEED.version` en vez de fijarla en 1.
- `PROJECT_STATE.md` compactado (237 líneas): 2.9 HECHA, tramos 2.9 T1–T5, cola de pruebas con 2.7, 2.8, 2.9 y HITO_M1.

### FIX
- 13 ítems del paquete semilla mostraban la nota de gramática de OTRO tema (10 `fix_error` con la de «since», 3 `phrase_cloze` con la de «desde hace»): `grammar_note_es` queda en `null` y los ítems en `version` 2.

### REMOVE
- Nada.

### Sin corregir (no son de T5)
- Con `TZ=Pacific/Auckland` fallan 3 pruebas que ya fallaban antes (`errors`, `eventSchema`, `sessionDriver`); ver `DECISIONS.md` «2.9-T5 punto D».

## Sin versión nueva — 2026-11-01 — 2.9-T5, parte 5 (CA 4 con evidencia; los CA 1–4 ya tienen prueba; 2.9-T5 sigue abierta)

### ADD
- `tests/seed29Criteria.test.mjs` pasa a 9 pruebas: 2 de CA 4. Con el `sw.js` REAL instalado y la red cortada: se importa el paquete (60 tarjetas), se estudia la sesión que arma la app por la pantalla real (con un fallo a propósito), sale el resumen, el error queda guardado, y 2 días después (reloj de prueba) vuelven repasos vencidos; CERO peticiones a la red en todo el recorrido. Control: sin instalar y sin conexión no hay nada que estudiar.

### CHANGE
- Nada de código.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T5, parte 4 (CA 1 con evidencia; 2.9-T5 sigue abierta)

### ADD
- `tests/seed29Criteria.test.mjs` pasa a 7 pruebas: 2 de CA 1 con la vista de sesión REAL, el registro REAL, el resumen real (`createSummarySource`) y los ítems REALES. Una sesión con un ejercicio de cada uno de los 6 tipos del paquete (`choose_correct`, `fix_error`, `fill_verb`, `phrase_cloze`, `cloze_bank`, `order_blocks`) y la sesión que arma la app con las 60 tarjetas (10 ejercicios, 4 tipos) se responden bien por la pantalla hasta «Sesión terminada»: eventos = ejercicios, todos `correct`, 0 errores guardados, sin avisos.

### CHANGE
- Nada de código.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T5, parte 3 (CA 2 y CA 3 con evidencia; 2.9-T5 sigue abierta)

### ADD
- `tests/seed29Criteria.test.mjs` (5 pruebas): CA 2 recorre la vista de sesión REAL con el registro REAL y los ítems REALES del paquete (`seed.can.0005`, `seed.irr.0002`, `seed.pp.0001`) y comprueba que «can to», «leaved» y «lives» (since + presente) se guardan con `VRB.CAN_TO`, `VRB.IRREG_REGULARIZE` y `TNS.SINCE_FOR`, con ítem, tema y corrección; control: acertar no guarda errores. CA 3, con 3 semillas: el día 1 no hay repasos y el día 3 hay repasos vencidos de tarjetas ya respondidas, con su próxima fecha en el futuro.

### CHANGE
- Nada de código.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T5, parte 2 (guion `tests/scenarios/2.9.md`; 2.9-T5 sigue abierta)

### ADD
- `tests/scenarios/2.9.md`: guion de 10 pasos para el hito M1 (instalar, modo avión, estudiar, acertar, fallar, cerrar a mitad, ayudas, errores, temas, repasos al día siguiente).

### CHANGE
- `tests/scenarios/2.8.md`, paso 7: ya no dice que la sesión a medias se retoma desde Practicar (no hay botón; solo desde su dirección).

### FIX
- Ninguno de código.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T5, parte 1 (política de topes diarios; 2.9-T5 sigue abierta)

### ADD
- `tests/simulation.test.mjs`: prueba de la política de topes (10 nuevas y 100 repasos por defecto; 14 días, 3 niveles de acierto). La política está en `DECISIONS.md`.

### CHANGE
- Nada de código: se mantienen los valores por defecto de `dailyNewCap` (10) y `dailyReviewCap` (100).

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T4, parte 3 (FIX de 1.7: dominio con poca evidencia, y Diccionario básico; completa 2.9-T4)

### ADD
- `core/mastery.config.js`: `EVIDENCE_CAP` y `SIGNAL_R.zeroAfterFail`; `lowEvidence` en el resultado del dominio, el resumen y su texto.
- `app/lemmaLexicon.js` (Diccionario básico con `content/taxonomy/lemmas.json`), `entries()` en `core/lemmas.js`, `addTranslation` y `mine` en `app/dictionarySource.js` (nota local `dict_es:<lema>` en `notes`).
- `tests/mastery.evidence.test.mjs` (10), `tests/lemmaLexicon.test.mjs` (17), 4 pruebas en `tests/helpServices.test.mjs` y 2 escenarios «un solo fallo» en `tests/simulation.test.mjs` (el simulador gana `outcome`).

### CHANGE
- Dominio: tope por evidencia (menos de 5 respuestas o 3 ítems: máximo 59 %, confianza baja) y R = 0 para una tarjeta cuyo último resultado fue fallo. Textos «poca evidencia todavía» en el desglose y en el resumen.
- `ui/dictionarySheet.js`: «Palabra del inglés, banda X», «Añadir mi traducción» y «El Diccionario es básico por ahora»; `services.dictionary` suma `mine`.
- 8 pruebas de 1.7 reescritas porque esperaban el comportamiento anterior (cambio de lógica; ver `docs/CONTRACTS.md`).

### FIX
- 1.7: un solo fallo como primera respuesta de un tema ya no da 100 % «Dominado».
- Hoja del Diccionario: no pasa `null` a `replaceChildren` (un navegador real habría escrito «null»).
- `services.dictionary` no exponía `mine`: la traducción guardada no se habría visto.

### REMOVE
- Nada.

## Sin versión nueva — 2026-11-01 — 2.9-T4, parte 2 (errores y dominio en la simulación; cierra 2.9-T4)

### ADD
- `tests/_simulation.mjs` envía errores con código y mide el dominio antes y después de cada respuesta; `tests/simulation.test.mjs` pasa a 22 pruebas.

## Sin versión nueva — 2026-11-01 — 2.9-T4, parte 1 (simulación de 5 días)

### ADD
- `tests/_simulation.mjs` (`simulate`) y `tests/simulation.test.mjs` (7 pruebas): tarjetas sin duplicar, `due` coherente, eventos = respuestas, tope de nuevas.

## Sin versión nueva — 2026-11-01 — 2.9-T3, punto 5 (servicios de la barra de ayudas; cierra 2.9-T3)

### ADD
- `app/helpServices.js` (`createHelpServices`) y `services.examples`, `corrections`, `aiHelp` y `dictionary`.
- `itemResolver.byTopics` y `itemResolver.lexicon`.
- `tests/helpServices.test.mjs` (31) y `tests/helpBar.test.mjs` (6).

### CHANGE
- `app/main.js` crea las fachadas; cabeceras de `app/main.js` y `ui/exercises/index.js` al día.

## Sin versión nueva — 2026-11-01 — 2.9-T3, punto 4 (resolvedor de ítems y «Estudiar ahora»)

### ADD
- `app/itemResolver.js` (`createItemResolver`), `app/exerciseTypes.js` (`registerExerciseTypes`) y `services.itemResolver`.
- `ui/views/hoy.js`: botón «Estudiar ahora» que lleva a la sesión nueva cuando el contenido está listo.
- `tests/itemResolver.test.mjs`, `tests/exerciseTypes.test.mjs`, `tests/hoy.test.mjs`; `tests/offlineFirstRun.test.mjs` monta los 60 ítems sin conexión.

### CHANGE
- `app/main.js`: el registro de ejercicios recibe `resolveItem` y los tipos se registran con un solo ayudante.
- Pruebas de cableado de 2.3 a 2.5 (`buildTypes`, `choiceWiring`, `orderBlocksWiring`, `textTypesScreen`, `threeFormsScreen`, `translateTypesScreen`), `noBlame26` y `shell` adaptadas.

## Sin versión nueva — 2026-11-01 — 2.9-T3, punto 3 (respaldo con vista previa y contenido tras borrar/importar)

### ADD
- `ui/views/importPreview.js` (`importSummary`, `IMPORT_MODES`) y `tests/importPreview.test.mjs` (5).
- `services.reimportContent()` en `app/main.js`; `afterChange` en `createDataTools`.

### CHANGE
- Ajustes › Importar respaldo: vista previa del impacto y elección «Fusionar» (por defecto) o «Reemplazar»; un archivo inválido avisa antes del diálogo.
- Tras «Borrar todo» o importar se vuelve a importar el paquete de contenido.
- Guiones `0.8.md` y `HITO_M0.md` con el diálogo nuevo; `settingsData`, `dataTools` y `contentStartup` con pruebas nuevas.

## Sin versión nueva — 2026-11-01 — 2.9-T3, punto 2 (precache de índice y paquetes)

### ADD
- `tests/offlineFirstRun.test.mjs` (5): con el `sw.js` real y sin red tras instalar, el paquete semilla se importa (60 tarjetas) y se planea una sesión desde el primer arranque.

### CHANGE
- `tools/build-manifest.mjs`: precachea `content/index.json` y `content/packs/`; un paquete nuevo o cambiado sube `cacheVersion` (la app ofrece «Actualizar»).
- `sw.js`: `content/*` se sirve con el shell; se borra `sophia-packs-v1` al activar. Sustituye al stale-while-revalidate de paquetes (aprobado por el Administrador; ficha en `docs/CONTRACTS.md`).
- `tests/sw.test.mjs`, `tests/build-manifest.test.mjs`: actualizadas al nuevo reparto.

### REMOVE
- La estrategia `packs` de `sw.js` (stale-while-revalidate) y la caché `sophia-packs-v1`.

## Sin versión nueva — 2026-11-01 — 2.9-T3, punto 1 (importar el contenido al arrancar)

### ADD
- `app/contentStartup.js` (`startContent`): al abrir la app, espera la base, lee la taxonomía y llama a `importPacksToDb`; no bloquea ni rechaza nunca. `tests/contentStartup.test.mjs` (10) con el paquete semilla real.

### CHANGE
- `app/main.js`: `services.contentReady = startContent(...)` tras los servicios de estudio.

## Sin versión nueva — 2026-10-31 — 2.9-T2 (semilla, parte 2; paquete INSTALADO)

### ADD
- 36 ítems originales en 3 temas nuevos: `gram.modals.no_to` (`seed.can.0001`–`0012`), `prep.patterns.gerund_after_verbs` (`seed.ger.0001`–`0012`) y `prep.dependent.adjective_prep` (`seed.prep.0001`–`0012`). Cada tema tiene 12 ítems y 5 o 6 tipos.
- `content/packs/pack_seed_v1.json` (60 ítems, 5 temas, v1) y `content/index.json`, creados con `npm run add-pack`.

### REMOVE
- `content/drafts/pack_seed_v1.json`: ya está instalado, no se deja una segunda copia.

## Sin versión nueva — 2026-10-31 — 2.9-T1, punto 2 (semilla: tema pasado irregular; cierra T1)

### ADD
- `content/drafts/pack_seed_v1.json`: 12 ítems originales de `verb.irregular.past_simple` (`seed.irr.0001` a `0012`, 6 tipos; errores `VRB.IRREG_REGULARIZE`, `TNS.PP_PS`, `VRB.DOUBLE_PAST`). El borrador queda en 24 ítems y 2 temas. Validado, no instalado.

## Sin versión nueva — 2026-10-31 — 2.9-T1, punto 1 (semilla: tema for/since)

### ADD
- `content/drafts/pack_seed_v1.json`: borrador del paquete semilla con 12 ítems originales de `gram.present_perfect.for_since` (6 tipos; errores `TNS.SINCE_FOR`, `TNS.PP_PS`, `TNS.PERF_FORM`). Validado, no instalado.

## v0.28.0 — 2026-10-31 — 2.8 (cierre; CIERRA la subparte 2.8)

Cierre del resumen de sesión: cifras desde los eventos, resumen parcial al abandonar, «Repetir los que fallé» y «Llevar al chat».

### ADD
- `tests/summary28Criteria.test.mjs` (6): los CA 1–4 de punta a punta con la vista de sesión y la fuente real.
- `tests/scenarios/2.8.md`: guion de prueba manual de 11 pasos, en cola para el hito M1.
- Tabla de evidencia de los CA 1–4 en `DECISIONS.md`.

### CHANGE
- Versión 0.28.0 (`core/version.js`, `package.json`, `asset-manifest.json`, `sw.js`); guiones 2.1–2.7 citan la versión nueva.

## Sin versión nueva — 2026-10-31 — 2.8-T3, punto 2 («Llevar al chat» del resumen)

### ADD
- `core/summaryChat.js`: `summaryChatWorthy` y `buildSummaryChatBlock` (bloque `llevar_al_chat` de 8.14 con tema, cifras, hasta 5 errores, dominio y un mensaje de duda).
- `app/chatCopy.js`: `copyForChat` (copia o devuelve el texto para copiarlo a mano).
- `ui/summaryPanel.js`: botón «Llevar al chat» con aviso «Copiado» o cuadro seleccionable; `ui/styles/summary.css` lo estiliza.
- `tests/summaryChat.test.mjs` (9) y pruebas nuevas en `tests/summaryPanel.test.mjs` y `tests/sesionView.resumen.test.mjs`.

### CHANGE
- `core/summaryText.js`: `actions.chat`. `ui/views/sesion.js`: conecta el botón (también en el resumen parcial).

## v0.27.0 — 2026-10-31 — 2.7 (cierre; CIERRA la subparte 2.7)

Cierre de la barra de 4 acciones: Otros ejemplos, Correcciones, Preguntas IA y Diccionario, sin perder el ejercicio.

### ADD
- `tests/actions27Criteria.test.mjs` (8): los CA 1–4 de punta a punta con la vista de sesión y las cuatro fuentes reales.
- `tests/scenarios/2.7.md`: guion de prueba manual de 12 pasos, en cola para el hito M1.
- Tabla de evidencia de los CA 1–4 en `DECISIONS.md`.

### CHANGE
- Versión 0.27.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js`; citada en `tests/scenarios/2.1.md` a `2.7.md`.
- `PROJECT_STATE.md`: 2.7 pasa a HECHA; «Siguiente» apunta a 2.8.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.7-T4, parte 2 (hoja «Diccionario» y «añadir»)

### ADD
- `app/dictionarySource.js`: `prepare()` (recarga el léxico en cada apertura), `search(q)` y `add(word)`; «añadir» guarda `{ id, state:'unknown', source:'dictionary', added }` en `words` sin pisar una palabra existente.
- `ui/dictionarySheet.js`: hoja «Diccionario» con búsqueda mientras se escribe y «Añadir» si la palabra no está; avisos sin culpa si falla.
- `ui/views/sesion.js`: con `services.dictionary` la barra suma «Diccionario» (orden fijo de 7.7, cronómetro descontado, ejercicio intacto).
- Pruebas: `dictionary` (12) y ampliación de `sesionView.ia` (3); `noBlame26` recorre `ui/dictionarySheet.js`.

## Sin versión nueva — 2026-10-31 — 2.7-T4, parte 1 (búsqueda en el léxico)

### ADD
- `core/lexSearch.js`: `createLexSearch(entries)` → `search(query)` por lema, traducción y derivados, sin distinguir mayúsculas ni acentos (usa `core/normalize.js`); orden exacto, prefijo, contiene; `reason` `none` para ofrecer «añadir». Puro, nunca lanza.
- `tests/lexSearch.test.mjs` (9): CA 4, orden, vacío, límites, entradas hostiles.

## Sin versión nueva — 2026-10-31 — 2.7-T3 (Preguntas IA y Llevar al chat)

### ADD
- `core/aiAsk.js`: `buildAskBlock` prepara el contenido de `llevar_al_chat` (tema, ítem, respuesta, hasta 10 errores, dominio, duda), lo recorta a los límites de 8.14 y reúsa `makeChatBlock` de `core/syncChat.js`; nunca lanza.
- `app/aiHelpSource.js`: `status()` (por `availability()` del cliente de IA) y `prepare()` (reúne correcciones y dominio; si una parte falla se omite y va al log). No llama a la IA: eso es la parte 5.
- `ui/aiSheet.js`: hoja «Preguntas IA»; sin IA dice «Conecta tu clave en Ajustes» y ofrece «Llevar al chat», que copia el bloque o, si el portapapeles falla, lo muestra seleccionable (CA 3).
- `ui/views/sesion.js`: con `services.aiHelp` la barra suma «Preguntas IA» (orden fijo de 7.7); lleva la respuesta en curso (`getResponse`) y el cronómetro descuenta la hoja abierta.
- Pruebas: `aiAsk` (11), `aiSheet` (9), `sesionView.ia` (8); `noBlame26` recorre `ui/aiSheet.js`. Estilos en `ui/styles/actionbar.css`.

## Sin versión nueva — 2026-10-31 — 2.7-T2 (Correcciones)

### ADD
- `app/correctionsSource.js`: reúne los errores propios que tocan el ítem o el tema del ejercicio; cada error cuenta una vez y los del propio ítem van primero (cuenta exacta, CA 2).
- `ui/correctionsSheet.js`: hoja «Correcciones» (lo escrito, lo correcto, pista y veces), con aviso amable si no hay o si falla la carga.
- `ui/views/sesion.js`: con `services.corrections` la barra suma «Correcciones» con la cuenta en la insignia; el ejercicio no se desmonta (CA 1).
- Pruebas: `correctionsSource`, `correctionsSheet` y ampliación de `sesionView.ayudas`; `noBlame26` recorre la hoja nueva.

## Sin versión nueva — 2026-10-31 — 2.7-T1 (barra de ayudas y «Otros ejemplos»)

### ADD
- `core/otherExamples.js`: ≥ 3 frases del mismo tema desde la teoría y los ítems del paquete, sin repetir y sin destripar el ejercicio actual ni los que vienen.
- `core/pausableVisibility.js`: el cronómetro descuenta el rato con una hoja de ayuda abierta.
- `ui/actionBar.js` (barra con insignia), `ui/examplesSheet.js` (hoja) y `app/examplesSource.js` (fuente).
- `ui/styles/actionbar.css`, enlazado en `index.html`.
- Pruebas: `otherExamples`, `pausableVisibility`, `actionBar`, `examplesSheet`, `examplesSource` y `sesionView.ayudas`.

### CHANGE
- `ui/views/sesion.js`: si hay `services.examples`, muestra la barra con «Otros ejemplos» y la hoja se abre encima del ejercicio sin tocarlo. Sin esa fuente nada cambia: **la barra no se ve en la app hasta 2.9-T3**, que cablea el cargador real de ítems.
- `tests/index.test.mjs` y `tests/design.test.mjs` incluyen el CSS nuevo.

### FIX
- `collectExamples(null)` lanzaba; ahora devuelve un resultado vacío.

### REMOVE
- Nada.

## v0.26.0 — 2026-10-31 — 2.6 (cierre; CIERRA la subparte 2.6)

Cierre de la retroalimentación: un panel común en las 9 pantallas, tono sin culpa, y nota y reporte locales.

### ADD
- Tabla de evidencia de los CA 1–4 en `DECISIONS.md`, apuntando a `family26Criteria`, `noBlame26` y `whyNote26`.

### CHANGE
- Versión 0.26.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js`; citada en `tests/scenarios/2.1.md` a `2.6.md`.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T3, punto 5 (guion de la prueba de 2.6)

### ADD
- `tests/scenarios/2.6.md`: guion de 15 pasos (~10 min) para el hito M1, mismo formato que `2.5.md`: acierto, fallo, «No sé» y «casi» con su mascota, sonido y vibración; nota «¿Por qué lo pensaste?» (solo al fallar en gramática, con el teclado abierto); menú «⋯»; textos sin culpa; cierre de sesión; ajustes `Sonidos` y `Vibración`; «Reducir animaciones», 3 temas, «Muy grande» y lector de pantalla. EN COLA: no se ejecuta ahora.

### CHANGE
- `ui/views/settings.js`: la ayuda de «Sonidos» decía «Efectos al acertar o fallar» y la de «Vibración» «una vibración corta como respuesta»; ahora dicen lo que hace la app (tono al acertar y al terminar; vibración muy corta solo al acertar).

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T3, punto 4 (auditoría de cadenas sin culpa)

### ADD
- `tests/_blameScan.mjs` (detector de culpa con 11 reglas y extractor de literales sin comentarios) y `tests/noBlame26.test.mjs` (7 pruebas): recorre los 18 objetos de textos exportados (con las funciones evaluadas con argumentos de muestra, más de 250 textos), comprueba que ningún archivo de `ui/` exporte textos sin auditar, y escanea los literales de todo `ui/` y de 9 archivos de `core/` y `app/` que ve la persona.
- `ui/views/sesion.js`: exporta `SESSION_TEXT` (antes `TEXT`, privado) para poder auditarlo.

### CHANGE
- «incorrecta» pasa a «no coincide» (etiqueta de palabra en `wordDiff`, lo lee el lector de pantalla) y «no encaja» (estado de palabra en `wordChip`).
- `clozeBank`: «✗ Incorrecto» pasa a «✗ No encaja».
- `core/masteryExplain.js`: «fallaste» pasa a «no te salió» (2 textos).
- `core/session.config.js`: «Tus errores aún no tienen ejercicios…» pasa a «Aún no hay ejercicios para practicar lo que anotaste en tu diario.»
- `ui/views/settings.js` («fallas tantas veces» → «se te resiste tantas veces»), `notFound.js` («mal escrito» → «no esté completo»), `settingsData.js` («sale mal» → «se pierde»), y el registro interno de `ui/exercises/index.js` («mal formada» → «con formato inválido»).
- Pruebas y guion que fijaban los textos viejos: `ui-components`, `masteryExplain`, `family24NotColorOnly`, `tests/scenarios/2.4.md` y dos líneas de `docs/CONTRACTS.md`.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T3, punto 3 (vibración)

### ADD
- `core/feedbackCues.js`: `vibrationFor(result, enabled)` (10 ms solo con `correct`) y `PULSE_MS`.
- `app/vibration.js`: `createVibration({ nav })` → `pulse(ms)`; único sitio que toca `navigator.vibrate`; nunca lanza.
- `tests/vibration26.test.mjs` (13 pruebas: lógica pura, adaptador, vista de sesión real, datos hostiles).

### CHANGE
- `ui/views/sesion.js`: tras `correct` pide un pulso corto si el ajuste `vibration` está en `true`. Al cerrar la sesión no vibra.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T3, punto 2 (sonido)

### ADD
- `core/feedbackCues.js`: `soundFor(result, enabled)` (solo `correct` suena), `soundForFinish(enabled)` y `TONES` (notas suaves, congeladas).
- `app/soundEngine.js`: `createSoundEngine({ win })` → `unlock()`, `play(name)`, `destroy()`. Web Audio, sin archivos; nunca lanza.
- `tests/sound26.test.mjs` (14 pruebas: lógica pura, motor con AudioContext falso, vista de sesión real, datos hostiles).

### CHANGE
- `ui/views/sesion.js`: suena el tono de acierto tras `correct` y el de cierre al mostrar el resumen, solo con el ajuste `sounds` en `true`; el `AudioContext` se crea en el primer toque o tecla de la sesión.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T3, punto 1 (mascota según el resultado)

### ADD
- `core/feedbackCues.js`: `mascotStateFor(result)` (feliz al acertar, «pensando» al fallar o en «No sé», neutral el resto) y `MASCOT_FOR`.
- `tests/feedbackCues26.test.mjs` (5 pruebas, la vista de sesión real incluida).

### CHANGE
- `ui/views/sesion.js`: la mascota usa `mascotStateFor`. Antes quedaba feliz con «casi» y neutral al fallar; ahora «casi» queda neutral y fallar o «No sé» la ponen «pensando».
- `asset-manifest.json` y `sw.js` regenerados con `npm run build`.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T2, punto 5 (Chromium y cierre del tramo)

### ADD
- Nada nuevo en la app.

### CHANGE
- `tools/report-menu-check.py` monta también «¿Por qué lo pensaste?» bajo el panel real, junto al menú «⋯»: orden, cerrado al inicio, `aria-expanded`, etiqueta del campo, 44 px, sin desbordes, guardar con aviso en texto, foco en «Guardar nota» y la nota como evento `note` en la base. 12 casos (corto y largo, 3 temas, «Normal» y «Muy grande»), 12 de 12.
- 2.6-T2 queda CERRADO sin subir versión (sigue en 0.25.0; faltan T3). `PROJECT_STATE.md`: «Siguiente: 2.6-T3».

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T2, punto 4 («¿Por qué lo pensaste?»)

### ADD
- `core/whyNote.js`: `createWhyNote({ events })` → `save(entry, item, text)`; guarda un evento `note` con `itemId`, `cardId`, temas, tipo de ejercicio y el texto en `responseRaw` (máx. 2000).
- `ui/whyNote.js`: botón «¿Por qué lo pensaste?» con campo opcional y «Guardar nota» (`whyNote`, `whyFor`, `WN_TEXT`). `app/whyNoteLazy.js`: `lazyWhyNote`.
- `tests/whyNote26.test.mjs` (17 pruebas). `ui/styles/widgets.css`: reglas `.fb__why*` (agrupadas con las de `.fb__report*` para no pasar de 800 líneas).

### CHANGE
- `ui/feedbackPanel.js`: opción `why`; solo se pinta al fallar o con «No sé», justo antes del menú «⋯».
- `ui/exercises/index.js` (`ctx.why`) y `app/main.js`. Las 8 pantallas con feedback pasan `why: whyFor(h, ctx, item)`.
- Cambio visible: al fallar un ítem de gramática (algún tema `gram.*`) aparece el botón. No hay evento `note` en tipos que no son de gramática.
- `asset-manifest.json` y `sw.js` regenerados con `npm run build`.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T2, punto 3 (menú «⋯» cableado a las pantallas)

### ADD
- `app/itemReportLazy.js`: `lazyItemReport(getStudy)` arma `createItemReport` cuando `services.study` ya existe (null sin base).
- `reportFor(h, ctx, item)` en `ui/reportMenu.js`: lo que cada pantalla pide al pintar el feedback.
- `tests/reportWiring26.test.mjs` (14 pruebas): opción `report` del panel, `reportFor`, `ctx.report` del registro, `lazyItemReport`, tres pantallas reales (elección, `phrase_cloze`, texto) al fallar y con «No sé», y una guardia que obliga a toda pantalla con feedback a pedir el menú.

### CHANGE
- `ui/feedbackPanel.js`: opción `report` (nodo), siempre el último del feedback.
- `ui/exercises/index.js`: opción `report` del registro y `ctx.report` para los componentes. `app/main.js` lo cablea con `lazyItemReport`.
- Las 8 pantallas que usan el panel (`textAnswer` con los tipos de texto, `threeForms`, `choice`, `orderBlocks`, `matchPairs`, `clozeBank`, `buildPieces`, `phraseCloze`) pasan `report: reportFor(h, ctx, item)`.
- Cambio visible: tras responder aparece el botón «⋯» al final del feedback. Sin base de datos no aparece y el feedback sale igual.
- `asset-manifest.json` y `sw.js` regenerados con `npm run build`.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T2, punto 2 (menú «⋯» de reporte)

### ADD
- `ui/reportMenu.js`: menú «⋯» con «Marcar como difícil» y «No me convence esta frase» sobre `core/itemReport.js`, con estado marcado, aviso con texto y error de guardado sin culpa.
- `tests/reportMenu.test.mjs` (14 pruebas) y `tools/report-menu-check.py` (Chromium, 12 casos).
- `ui/styles/widgets.css`: reglas `.fb__report*`.

### CHANGE
- `asset-manifest.json` y `sw.js` regenerados con `npm run build`.
- Sin cambio visible en la app: el menú aún no está en ninguna pantalla.

### FIX
- Ninguno en código ya entregado (el foco perdido con `disabled` se encontró y corrigió dentro del mismo punto).

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T2, punto 1 (reporte local de ítems)

### ADD
- `core/itemReport.js`: `createItemReport({ db, clock? })` con `mark`, `clear`, `get`, `list` y `keyOf`; guarda en `meta` la clave `report:<itemId>` (difícil / no me convence, uno por tipo, el último gana).
- `tests/itemReport.test.mjs` (10 pruebas), incluido el respaldo con `exportAll`/`importAll`.

### CHANGE
- Ninguno visible: ninguna pantalla usa todavía el reporte.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 7 (cierre del tramo)

### ADD
- Nada nuevo en código: cierre de fichas del tramo.

### CHANGE
- 2.6-T1 queda cerrado con la versión en 0.25.0 (2.6 tiene T2 y T3 pendientes). `PROJECT_STATE.md`: «Siguiente: 2.6-T2 · Pistas y notas» y fila de 2.6 en la tabla de estado.
- `tools/build-check.py` en Chromium sobre el estado final: 24 casos, 0 fallos.

### FIX
- Ninguno.

### REMOVE
- Nada.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 6 (limpieza de CSS del veredicto antiguo)

### ADD
- 4 pruebas en `tests/feedbackNoOwnVerdict26.test.mjs` (de 3 a 7): el CSS no define reglas `*__verdict` propias; ninguna clase de las familias migradas (`ta`, `ch`, `ob`, `ma`, `cb`, `bp`, `tf`, `pc`, `fb`) queda en el CSS sin una pantalla que la use; el CSS conserva las reglas del panel y las de la solución de cada pantalla; el lector de clases del CSS tiene su propia prueba.

### CHANGE
- `asset-manifest.json` y `sw.js` regenerados con `npm run build` (cambian los hashes de `components.css`, `widgets.css` y `textAnswer.js`).
- Aspecto: sin cambios (ningún elemento llevaba ya esas clases); Chromium con movimiento reducido: 834 de 834 capturas antes/después idénticas.

### FIX
- Ninguno.

### REMOVE
- `ui/styles/components.css`: `.ch__verdict`, `.ch__verdict--correct`, `.ob__verdict`, `.ob__verdict--correct`, `.ma__verdict`, `.ma__verdict--correct`, `.cb__verdict`, `.cb__verdict--correct`.
- `ui/styles/widgets.css`: `.bp__verdict`, `.bp__verdict--correct`, `.ta__verdict`, `.ta__verdict--correct`, `.ta__verdict--almost`, `.ta__correct`, `.ta__explain`, `.ta__nuance`, `.ta__box-label`, `.ta__box-text`, `.pc__verdict`, `.pc__verdict--correct`, `.pc__verdict--almost`, `.pc__explain` (22 clases en total, también donde iban en reglas compartidas).
- `ui/exercises/textAnswer.js`: ayudante `box`, definido y sin ninguna llamada desde el punto 2.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 5 (pruebas de cruce CA 1 y CA 3)

### ADD
- `tests/family26Criteria.test.mjs` (61 pruebas): por cada tipo del registro, fallo a propósito y «No sé» comprueban el veredicto del panel (CA 1) y la respuesta correcta visible (CA 3).

### CHANGE
- Sin cambios de código en `ui/`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 4 (ninguna pantalla fuera del panel)

### ADD
- `tests/feedbackNoOwnVerdict26.test.mjs` (3 pruebas): ninguna clase `*__verdict` propia en `ui/exercises/` y las ocho pantallas con feedback importan el panel.

### CHANGE
- Sin cambios de código en `ui/`. Búsqueda con grep: no había pantallas sin migrar.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 3 (`phraseCloze` migrada al panel común)

### ADD
- Una prueba en `tests/feedbackMigration26.test.mjs`: fallo con solución y explicación sin repetir gramática ni matiz, acierto sin explicación, «casi» con su aviso de ortografía en orden, y «No sé» con su veredicto.

### CHANGE
- `ui/exercises/phraseCloze.js` pinta veredicto, solución y `explain_es` con `feedbackNodes` (puede dar «casi»). Clases `pc__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`) y `pc__explain` a `fb__explain`; se conserva `pc__correct`. Textos del veredicto sin cambio.
- Gramática y matiz no se repiten tras fallar: ya están a la vista antes de contestar.
- `phraseClozeAnswer.test.mjs`, `phraseClozeBadges.test.mjs` y `tools/phrase-cloze-check.py` con las clases nuevas.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, Chromium de los selectores renombrados

### ADD
- Ninguno.

### CHANGE
- Sin cambios de código. Chromium con capturas fuera del repo: `text-answer-check.py` 18 casos, `translate-check.py` 12, `word-types-check.py` 72, `transform-check.py` 48 y `forms-check.py` 18, todos con 0 fallos.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, verificación del punto 7

### ADD
- Ninguno.

### CHANGE
- Sin cambios de código. `npm run check` completo: código 0, 4025 pruebas, 4024 pasan, 0 fallan, 1 omitida. `tools/build-check.py`: 24 casos, 0 fallos.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 7 (`buildPieces` migrada al panel común)

### ADD
- Una prueba en `tests/feedbackMigration26.test.mjs`: construir piezas con fallos muestra solución, aviso y notas; sin fallos solo el matiz breve; «No sé» con su veredicto, solución y notas, sin aviso de piezas.

### CHANGE
- `ui/exercises/buildPieces.js` pinta veredicto, solución y notas con `feedbackNodes` (binario: nunca «casi»). Clases `bp__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conservan `bp__correct` y `bp__misplaced`. Textos del veredicto (palabras y letras) sin cambio.
- Construir piezas muestra `explain_es`, `grammar_note_es` y `nuance_es` cuando no se acierta. Los avisos de piezas mal puestas o de más salen antes de la solución.
- `buildPiecesView.test.mjs`, `buildTypes.test.mjs` y `tools/build-check.py` con las clases `fb__verdict*`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 6 (`clozeBank` migrada al panel común)

### ADD
- Una prueba en `tests/feedbackMigration26.test.mjs`: huecos con banco con fallos muestra solución, aviso de huecos y notas; sin fallos solo el matiz breve; «No sé» con su veredicto, solución y notas, sin aviso de huecos.

### CHANGE
- `ui/exercises/clozeBank.js` pinta veredicto, solución y notas con `feedbackNodes` (binario: nunca «casi»). Clases `cb__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conservan `cb__correct` y `cb__review`. Textos del veredicto sin cambio.
- Huecos con banco muestra `explain_es`, `grammar_note_es` y `nuance_es` cuando no se acierta. El aviso de huecos sale antes de la solución.
- `clozeBankView.test.mjs` y `tools/cloze-check.py` con las clases `fb__verdict*`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 5 (`matchPairs` migrada al panel común)

### ADD
- Una prueba en `tests/feedbackMigration26.test.mjs`: emparejar con fallos muestra parejas y notas, sin fallos solo el matiz breve, y «No sé» con su veredicto, parejas y notas.

### CHANGE
- `ui/exercises/matchPairs.js` pinta veredicto, parejas y notas con `feedbackNodes` (binario: nunca «casi»). Clases `ma__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conserva `ma__correct`. Textos del veredicto sin cambio.
- Emparejar muestra `explain_es`, `grammar_note_es` y `nuance_es` cuando no se acierta limpio.
- `matchPairsView.test.mjs` y `tools/match-check.py` con las clases `fb__verdict*`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 4 (`orderBlocks` migrada al panel común)

### ADD
- Dos pruebas en `tests/feedbackMigration26.test.mjs`: notas al fallar y matiz breve al acertar en ordenar; «No sé» con su veredicto, la respuesta y las notas, sin aviso de bloques.

### CHANGE
- `ui/exercises/orderBlocks.js` pinta veredicto, respuesta y notas con `feedbackNodes` (binario). Clases `ob__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conservan `ob__correct` y `ob__misplaced` (el aviso de bloques sale antes de la respuesta). Textos del veredicto sin cambio.
- Ordenar muestra `explain_es`, `grammar_note_es` y `nuance_es` al fallar y en «No sé» (antes ninguna).
- Pruebas `order*` y `tools/order-check.py` con las clases nuevas.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 4 (`orderBlocks` migrada al panel común)

### ADD
- Dos pruebas en `tests/feedbackMigration26.test.mjs`: ordenar muestra respuesta y notas al fallar y solo el matiz breve al acertar; «No sé» con su veredicto, respuesta y notas, sin aviso de bloques mal puestos.

### CHANGE
- `ui/exercises/orderBlocks.js` pinta veredicto, respuesta correcta y notas con `feedbackNodes` (binario: nunca «casi»). Clases `ob__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conservan `ob__correct`, `ob__correct--lines` y `ob__misplaced`. Textos del veredicto sin cambio.
- Ordenar muestra `explain_es`, `grammar_note_es` y `nuance_es` al fallar. El aviso de bloques mal puestos sale antes de la respuesta.
- Pruebas `orderBlocksView`, `orderTypes` y `tools/order-check.py` con las clases `fb__verdict*`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 3 (`choice` migrada al panel común)

### ADD
- Una prueba en `tests/feedbackMigration26.test.mjs`: en elegir, al fallar salen explicación, gramática y matiz; al acertar solo el matiz breve.

### CHANGE
- `ui/exercises/choice.js` pinta veredicto, respuesta correcta y notas con `feedbackNodes` (binario: nunca «casi»). Clases `ch__verdict*` pasan a `fb__verdict*` (`dont_know` → `dont`); se conservan `ch__correct` y `ch__why`. Textos del veredicto sin cambio.
- Elegir ahora muestra `explain_es`, `grammar_note_es` y `nuance_es` al fallar (antes no mostraba ninguna). La pista del distractor sale antes de la respuesta.
- Pruebas `choice*` y `tools/choice-check.py` con las clases `fb__verdict*`.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 2 (textAnswer y threeForms usan el panel común)

### ADD
- `tests/feedbackMigration26.test.mjs` (2 pruebas): textos exactos del veredicto en `textAnswer` y `threeForms` (mal, casi, «No sé»).

### CHANGE
- `ui/exercises/textAnswer.js` y `ui/exercises/threeForms.js`: veredicto, respuesta correcta y notas salen de `feedbackNodes`; clases `fb__*` en vez de `ta__*` (los demás tipos de texto heredan el cambio de `textAnswer`). Al acertar puede verse `nuance_es` si tiene ≤ 160 caracteres.
- Pruebas existentes y `tools/{text-answer,transform,translate,word-types}-check.py`: selectores `ta__verdict/correct/explain/grammar/nuance/box-*` → `fb__*`.

### FIX
- Ninguno.

### REMOVE
- Helper `box` sin uso en `threeForms.js`.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 2 (`textAnswer` y `threeForms` migradas al panel común)

### ADD
- `tests/feedbackMigration26.test.mjs` (2 pruebas): textos exactos del veredicto (mal, casi, no sé) en `textAnswer` y `threeForms`.

### CHANGE
- `ui/exercises/textAnswer.js` y `ui/exercises/threeForms.js` pintan veredicto, respuesta correcta y notas con `feedbackNodes`; clases `ta__verdict/correct/explain/grammar/nuance` pasan a `fb__*`. Esto alcanza a todos los tipos que montan `textAnswer` (palabra, traducir, fix_error, transform…).
- Al acertar ahora puede salir `nuance_es` si tiene ≤ 160 caracteres (antes un acierto no mostraba notas).
- Pruebas de pantalla y los 4 `tools/*-check.py` (text-answer, transform, translate, word-types) con los selectores `fb__*`.
- `threeForms.js`: se quitó el ayudante `box`, que ya no se usa.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.6-T1, punto 1 (módulo común del panel de feedback; las pantallas aún no lo usan)

### ADD
- `ui/feedbackPanel.js` (`feedbackState`, `feedbackNodes`, `FB_TEXT`, `NUANCE_SHORT_MAX`) y sus estilos `.fb__*` en `ui/styles/widgets.css`.
- `tests/feedbackPanel.test.mjs` (10 pruebas: estados, orden, respuesta visible al fallar, notas por estado, binarios sin «casi», entradas hostiles y fuzz con semilla fija).

### CHANGE
- Ninguno en pantallas ni en lógica.

### FIX
- Ninguno.

## v0.25.0 — 2026-10-31 — 2.5-T5 (detector y cierre; CIERRA la subparte 2.5)

Cierre de la familia de producción corta: los 14 tipos corrigen, avisan con pista específica del detector del 1.6 y mandan entradas válidas a `errors.record`.

### ADD
- `core/textErrors.js`: `detectHits`, `withDetection` y `errorEntries`.
- Pruebas: `tests/textErrors.test.mjs`, `tests/family25T5Table.test.mjs` (más de 80 respuestas, con las del diagnóstico), `tests/textErrorsScreen.test.mjs`, `tests/family25Criteria.test.mjs` (CA 1–6 sobre los 14 tipos) y `tests/textErrorsMutants.test.mjs` (7 pruebas que cierran roturas vivas).
- `tests/scenarios/2.5.md`: guion de 10 pasos para el hito M1.

### CHANGE
- Los 6 tipos de palabra, `trap_translate`, `translate_bank` y `three_forms` corren el detector y envían `errors` al guardar (antes solo `fix_error` y `transform`). `app/main.js` pasa el catálogo a esos tipos.
- Un «casi» pasa a «mal» (`promoted: true`) si un aviso de gramática (no `SPELL.*`) cubre justo la palabra marcada como errata: «They had came late» frente a «come».
- `core/choiceFeedback.js` exporta `clean`.
- Versión 0.25.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js`; citada en `tests/scenarios/2.1.md` a `2.5.md`.
- `tests/textTypesScreen.test.mjs` y `tests/threeFormsScreen.test.mjs`: dos aserciones sobre el texto exacto de la línea de `main.js`.

### FIX
- `withDetection(g, null)` lanzaba al desestructurar `null`.
- En `three_forms` sin faceta, el mismo error en dos formas se registraba dos veces.

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 6 (fuzz y Chromium de la transformación y de la palabra; CIERRA el tramo 2.5-T4)

### ADD
- `tests/family25T4Fuzz.test.mjs` (6 pruebas con semilla fija: ítems válidos, 1000 casos de lógica con oráculo propio, respuestas aceptadas, `hasKeyword` con oráculo, 400 ítems hostiles y 150 secuencias de pantalla en los cinco tipos).
- `tools/transform-check.py` (Chromium 360 px, 48 casos: 8 escenarios de `fix_error`, `transform`, `keyword_transform`, `join_sentences` y `pronoun_placement` en 3 temas y 2 tamaños).
- `tools/word-types-check.py` (Chromium 360 px, 72 casos: los 6 tipos de 2.5-T2 con respuesta buena y mala en 3 temas y 2 tamaños; cierra el Chromium pendiente de T2).

### FIX
- Los comentarios de `core/fixError.js` y `core/transformTypes.js` y la ficha del punto 3 decían que el detector no se pregunta con trampa; el código sí lo pregunta (la pista se conserva, el código es el de la trampa y la pantalla pinta solo el aviso de la trampa). Corregida la documentación; el código no cambia.

### Verificación
- `npm run check`: 3965 pruebas (3964 pasan, 1 omitida a propósito —IndexedDB, que se corre en Chromium—, 0 fallos); estructura y auditoría en 0 hallazgos; `npm run map -- --check` OK. `transform-check.py` 48/48 y `word-types-check.py` 72/72 en Chromium (capturas fuera del repo). Roturas contra solo el fuzz: 39 probadas, 39 detectadas, 0 vivas. Sin prueba en teléfono real (cola del hito M1).

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 5 (`join_sentences` y `pronoun_placement`; el tramo 2.5-T4 sigue en curso)

### ADD
- `join_sentences` y `pronoun_placement` en `core/transformTypes.js` (`KEYWORD_TYPES`; `sourceOf(item, type)` con `prompt_en` para `pronoun_placement`) y en la pantalla `ui/exercises/transformTypes.js` (etiqueta «Conector:» y su aviso).
- Los dos tipos registrados en `app/main.js` por el mismo `registerTransformTypes` (ahora registra cuatro).
- `tests/transformTypes.test.mjs`: 24 pruebas (+4); `tests/transformTypesScreen.test.mjs`: 23 (+5).

### FIX
- Los documentos del punto 4 decían 19 pruebas en `tests/transformTypesScreen.test.mjs`; eran 18.

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 4 (pantalla de `transform` y `keyword_transform`; el tramo 2.5-T4 sigue en curso)

### ADD
- `ui/exercises/transformTypes.js`: `createTransformType`, `registerTransformTypes` y `TT_TEXT`; oración base, palabra clave como etiqueta de texto, campo vacío y avisos de sin cambios, trampa, palabra clave ausente y pista del detector.
- `ui/exercises/detectSource.js`: detector compartido por las pantallas de texto (`createDetectSource`, `readCatalog`).
- `transform` y `keyword_transform` registrados en `app/main.js` (el catálogo se lee al comprobar).
- Estilos `.ta__prompt--source`, `.ta__keyword` y `.ta__kwmissing` en `ui/styles/widgets.css`.
- `tests/transformTypesScreen.test.mjs` (18) y `tests/detectSource.test.mjs` (5).

### CHANGE
- `ui/exercises/fixError.js` usa `detectSource.js` en lugar de armar el detector por su cuenta; su comportamiento no cambia (mismas 14 pruebas).
- `asset-manifest.json` y la `CACHE_VERSION` de `sw.js` regenerados (`npm run build`) por los archivos nuevos; la versión sigue en 0.24.0.

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 3 (lógica pura de `transform` y `keyword_transform`; el tramo 2.5-T4 sigue en curso)

### ADD
- `core/transformTypes.js`: `TRANSFORM_TYPES`, `isTransformType`, `sourceOf`, `keywordOf`, `instructionFor`, `promptPlan`, `hasKeyword` y `gradeTransform` (sin cambios, palabra clave ausente, trampa y pista del detector).
- `tests/transformTypes.test.mjs` (20 pruebas).

### CHANGE
- `asset-manifest.json` y la `CACHE_VERSION` de `sw.js` regenerados (`npm run build`) por el archivo nuevo; la versión sigue en 0.24.0.

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 2 (pantalla de `fix_error`; el tramo 2.5-T4 sigue en curso)

### ADD
- `ui/exercises/fixError.js`: `createFixError`, `registerFixError` y `FX_TEXT`; oración con error, campo vacío, aviso de «sin cambios», trampa conocida y pista del detector.
- `fix_error` registrado en `app/main.js` (el catálogo se lee al comprobar).
- Estilos `.ta__prompt--error`, `.ta__unchanged` y `.ta__detect` en `ui/styles/widgets.css`.
- `tests/fixErrorScreen.test.mjs` (14 pruebas).

### CHANGE
- `asset-manifest.json` y la `CACHE_VERSION` de `sw.js` regenerados (`npm run build`) por el archivo nuevo de `ui/`; la versión sigue en 0.24.0.

## Sin versión nueva — 2026-10-31 — 2.5-T4, punto 1 (lógica pura de `fix_error`; el tramo 2.5-T4 sigue en curso)

### ADD
- `core/fixError.js`: `sentenceOf`, `promptPlan`, `gradeFix` (sin cambios, trampa y pista del detector) y `FIX_TYPE`.
- `tests/fixError.test.mjs` (14 pruebas).

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 6 (fuzz y Chromium de `three_forms`; CIERRA el tramo 2.5-T3)

### ADD
- `tests/family25T3Fuzz.test.mjs` (4 pruebas con semilla fija: lógica, exactas, validador hostil, pantalla).
- `tools/forms-check.py` (Chromium 360 px, 18 casos: `ok`, `swap` y `empty` en 3 temas y 2 tamaños).

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 5 (registro de `three_forms` y su validación; el tramo 2.5-T3 sigue en curso)

### ADD
- `core/contentData.js`: `data.forms` en la especificación `text_input`, `checkFormsItem` y `FORM_FIELDS` (obligatorio en `three_forms`, `FORMS_ONLY` en los demás).
- `tests/contentForms.test.mjs` (10 pruebas) y 4 pruebas nuevas en `tests/threeFormsScreen.test.mjs` (registro real por faceta, ítem incompleto, cableado, estilos).
- Estilos `.tf__form` y sus tres veredictos en `ui/styles/widgets.css`.

### CHANGE
- `core/contentTypes.js`: `three_forms` ya no exige `accept` (`ACCEPT_OPTIONAL`); `core/contentItem.js` llama a `checkFormsItem`.
- `app/main.js`: registra `three_forms`.
- `tests/contentTypes.test.mjs`: `three_forms` sale de la lista de tipos con `accept` obligatorio.

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 4 (pantalla de `trap_translate` y `translate_bank`; el tramo 2.5-T3 sigue en curso)

### ADD
- `ui/exercises/translateTypes.js`: `createTranslateType`, `registerTranslateTypes`, `TR_TEXT`. Traducir al inglés escribiendo, con aviso de la trampa conocida (texto, `role="note"`, pista del catálogo) y banco de palabras tocables que se insertan en el campo (`translate_bank`).
- `tests/translateTypesScreen.test.mjs` (29 pruebas, con fuzz de 60 secuencias y toques sobre botones deshabilitados) y `tools/translate-check.py` (Chromium 360 px, 12 casos).
- Estilos `.ta__bank` y `.ta__trap` en `ui/styles/widgets.css`; `app/main.js` registra los dos tipos con el catálogo perezoso.

### CHANGE
- `ui/exercises/textAnswer.js`: opciones aditivas `grade` y `notes` y ayudas `insertText` y `addControl` en el gancho `prompt` (sin ellas, igual que antes).
- `core/textTypes.js`: `translate_word` es siempre español → inglés (respuesta 8 del Administrador); `prompt_en` nunca se muestra en ese tipo. Siete pruebas de 2.5-T2 actualizadas.
- Roturas en primer plano (TRAMPA-16 y 34): 21 probadas, 20 detectadas y 1 equivalente razonada. `tools/text-answer-check.py` corrido en Chromium: 18/18.

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 3 (lógica pura de `trap_translate` y `translate_bank`; el tramo 2.5-T3 sigue en curso)

### ADD
- `core/translateTypes.js`: `TRANSLATE_TYPES`, `isTranslateType`, `instructionFor`, `bankOf` (`data.bank`: recortado, sin vacíos ni repetidos exactos, tope 30), `promptPlan(item, type)`, `trapOf` y `gradeTranslation`. La trampa es un error típico conocido: `item.distractors[{ text, code }]` (roadmap 8.3). Si lo escrito no acierta y ES uno de esos distractores (comparado con `compare`; una errata del distractor no cuenta), el resultado es `wrong` aunque `compare` lo viera cercano, y su código se suma a `errorCodes` sin repetirse. Si acierta manda `accept`.
- `tests/translateTypes.test.mjs`: 14 pruebas.

### CHANGE
- Roturas en primer plano (TRAMPA-16 y 34): 42 probadas, 35 detectadas y 7 equivalentes razonadas. Sin pantalla, sin registro y sin CSS todavía.

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 2 (pantalla de `three_forms`; el tramo 2.5-T3 sigue en curso)

### ADD
- `ui/exercises/threeForms.js`: `createThreeForms({ compare?, confusables?, log? })` y `TF_TEXT`. Tres campos (presente, pasado, participio) con nombre accesible; «Comprobar» exige las tres formas (si falta alguna, avisa, enfoca la primera vacía y no envía); corrección con una fila por forma (lo escrito, el veredicto, las variantes aceptadas si falla y, si se cambió de forma, con cuál); «No sé» y «Ver pista» como en la pantalla base; un solo envío, reintento tras un fallo de guardado y limpieza completa. NO se registra todavía.
- Envío (pregunta 10, provisional): la sesión trae una tarjeta por faceta, así que el `result` es el de la forma de `ctx.entry.facet`; las otras dos se enseñan corregidas pero no lo cambian (CA 4). Sin faceta válida (0 a 2) el `result` es el global. `responseRaw` lleva las tres formas («sing / sang / sung») por `toResponseRaw`.
- `tests/threeFormsScreen.test.mjs`: 29 pruebas.

### CHANGE
- Roturas en primer plano (TRAMPA-16 y 34): 61 probadas, 56 detectadas y 5 equivalentes razonadas. Sin CSS de `.tf__form`, sin registro y sin Chromium todavía.

## Sin versión nueva — 2026-10-31 — 2.5-T3, punto 1 (lógica pura de `three_forms`; el tramo 2.5-T3 sigue en curso)

### ADD
- `core/threeForms.js`: `FORM_KEYS`, `FORM_FACETS` (presente 0, pasado 1, participio 2), `readForms(item)` y `gradeForms(item, texts, opts?)`. Cada forma se califica sola con `gradeText`, de modo que un fallo en una no cambia las otras. Si lo escrito es exactamente otra forma del verbo (`sung` en el pasado de `sing`), la forma es `wrong` y `swappedWith` dice con cuál se confundió, aunque `compare` lo viera como errata.
- `tests/threeForms.test.mjs`: 15 pruebas.

### CHANGE
- Roturas en primer plano (TRAMPA-16 y 34): 30 probadas, 27 detectadas y 3 equivalentes razonadas. Sin pantalla, sin registro y sin CSS todavía.

## Sin versión nueva — 2026-10-31 — 2.5-T2, CIERRE (palabra y colocación; Chromium pendiente)

Cierre del tramo sin cambios de código. Entregado en 4 puntos: lógica pura (`core/textTypes.js`), envoltorios (`ui/exercises/textTypes.js`), registro en `app/main.js` con estilos, y fuzz con un arreglo de la base de 2.5-T1. Pendiente: correr `tools/text-answer-check.py` en un equipo con Chromium (no hay ítems de estos tipos en `pack_seed_v1` aún). Sigue en 0.24.0.

## Sin versión nueva — 2026-10-31 — 2.5-T2, punto 4 (fuzz de palabra y colocación y arreglo de la pantalla base; el tramo 2.5-T2 sigue a falta de Chromium)

### ADD
- `tests/textTypesFuzz.test.mjs`: 84 secuencias (12 por caso: los 6 tipos y `translate_word` inverso) con el registro real y `registerWordTypes`; comprueba un solo envío bueno, nunca vacío, `responseRaw` válido, instrucción y hueco presentes, deshabilitados sin envío y sin fugas.
- +2 pruebas en `tests/textAnswerScreen.test.mjs` (respuesta de 5000 letras; diferencia que `wordDiff` rechaza).

### FIX
- `ui/exercises/textAnswer.js`: una respuesta muy larga (miles de letras) hacía lanzar `wordDiff` (máx. 200 por palabra) al pintar la corrección, DESPUÉS de guardar, y la pantalla quedaba bloqueada con un error sin capturar. Ahora el texto se recorta a 200 con «…» y, si `wordDiff` aun así lanza, se avisa a `log` y la corrección se pinta sin la diferencia. Fallo de 2.5-T1 que el fuzz de T1 no alcanzó.

## Sin versión nueva — 2026-10-31 — 2.5-T2, punto 3 (registro y estilos de palabra y colocación; el tramo 2.5-T2 sigue en curso)

### ADD
- `app/main.js`: `registerWordTypes(app.services.exercises, { log: console.error })` tras `registerBuildTypes` y antes de `startFirstRun`. Los 6 tipos (`fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word`, `derive_form`) ya se montan desde la app.
- `ui/styles/widgets.css`: `.ta__instruction`, `.ta__aside` (texto pequeño y apagado) y `.ta__gap` (hueco subrayado, sin texto visible).
- `tests/textTypesScreen.test.mjs`: +1 prueba de cableado (import, una sola llamada y orden en `app/main.js`).

### CHANGE
- `asset-manifest.json` y `sw.js` (build: `app/main.js` y `widgets.css` cambian la caché).

## Sin versión nueva — 2026-10-31 — 2.5-T2, punto 2 (envoltorios y pantalla de palabra y colocación; el tramo 2.5-T2 sigue en curso)

### ADD
- `ui/exercises/textTypes.js`: `createWordType(type, { compare?, confusables?, log? })` (un componente por tipo, con la pantalla base `createTextAnswer`) y `registerWordTypes(registry, …)` (registra los 6 y devuelve la lista; NO se llama en `app/main.js` todavía). Pinta la instrucción (`.ta__instruction`), el texto principal con su `lang` (`.ta__prompt`; el hueco es `.ta__gap`, con `role="img"` y `aria-label="hueco"`) y el apoyo en español (`.ta__aside`). Usa `withDefaults` y `answerLangFor`; la pantalla base se crea en cada montaje porque la dirección de `translate_word` sale de cada ítem.
- `core/textTypes.js`: `promptPlan(item)` → `{ instruction, main, aside }`, el plan del enunciado (puro). En `translate_word` con `prompt_en` (responde en español) no se enseña `prompt_es`: podría ser la respuesta.
- `tests/textTypesScreen.test.mjs` (27 pruebas) y +10 en `tests/textTypes.test.mjs` (`promptPlan`).

### CHANGE
- `ui/exercises/textAnswer.js`: opción aditiva `prompt(item, { h, doc })` para pintar el enunciado (`null` o `[]` no pintan nada; si lanza, se avisa a `log` y vuelve el párrafo de `prompt_es`). Sin ella todo queda como en 2.5-T1. +6 pruebas en `tests/textAnswerScreen.test.mjs`.
- Roturas en primer plano (TRAMPA-16 y 34): 94 probadas, 93 detectadas y 1 equivalente razonada (33 de `promptPlan`, 20 de la opción `prompt`, 41 del envoltorio). Sin CSS nuevo, sin registro y sin Chromium en este punto.

## Sin versión nueva — 2026-10-31 — 2.5-T2, punto 1 (lógica pura de palabra y colocación; el tramo 2.5-T2 sigue en curso)

### ADD
- `core/textTypes.js`: tabla y funciones puras de los 6 tipos (`fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word`, `derive_form`): `WORD_TYPES`, `textTypeInfo`, `answerLangFor` (solo `translate_word` con `prompt_en` responde en español), `instructionFor` (una instrucción en español por tipo; traducir cambia con la dirección), `promptLines`, `gapParts` (hueco `___`) y `withDefaults` (`first_letter` recibe la máscara de primera letra si el ítem no trae `data.mask`).
- `tests/textTypes.test.mjs` (11 pruebas). Roturas en primer plano (TRAMPA-16 y 34): 40 probadas, 38 detectadas y 2 equivalentes razonadas.
- Sin pantalla ni registro todavía: llegan en los puntos siguientes. Sin cambios en `core/contentData.js` ni en el contenido.

## Sin versión nueva — 2026-10-31 — 2.5-T1, punto 3 (cierre del tramo 2.5-T1: Chromium, fuzz y ficha)

### ADD
- `tools/text-answer-check.py` (opcional, no entra en `npm run check`): la pantalla REAL en Chromium a 360×640, 3 temas × «Normal» y «Muy grande» × 3 casos (simple, largo, respuesta en español) = 18 casos, 18/18. Comprueba atributos del teclado y `lang`, sin desbordes, objetivos de 44 px, vacío sin envío, errata con aviso ortográfico, «No sé» y consola limpia. Capturas fuera del repo (TRAMPA-33).
- `tests/textAnswerFuzz.test.mjs`: 60 secuencias con el registro real, textos hostiles y toques al azar (también sobre deshabilitados y en ráfaga, con envío lento y primer envío fallido). Roturas de la pantalla con el fuzz: 6 de 7, la viva es equivalente.
- Ficha «2.5-T1» en `docs/CONTRACTS.md`.

### FIX
- `core/textAnswer.js`: `isBlank` ahora también cuenta como vacío un texto de solo caracteres de control (antes se enviaba como espacios). Hallazgo del fuzz. +2 pruebas en `tests/textAnswer.test.mjs`; roturas del cambio 11/11.

## Sin versión nueva — 2026-10-31 — 2.5-T1, punto 2 (pantalla de la entrada de texto; el tramo 2.5-T1 sigue en curso)

### ADD
- `ui/exercises/textAnswer.js`: `createTextAnswer({ compare?, confusables?, answerLang?, log? })`. Enunciado (`prompt_es`, `situation`), máscara visual con nombre accesible, pista opcional (`data.hint`), campo `createTextInput` en modo `exercise` (sin autocorrección ni mayúscula forzada; Enter envía), «Comprobar» y «No sé». Un solo envío; la respuesta vacía no se envía y avisa; si el guardado falla se puede reintentar. Corrección con `wordDiff`, respuesta, `explain_es` y cajas de gramática y matiz (solo si no acierta). `almost` con errata: aviso ortográfico y tarjeta de deletreo DESPUÉS de guardar. `responseRaw` por `toResponseRaw` (TRAMPA-32).
- Estilos `.ta` al final de `ui/styles/widgets.css` (767 líneas).
- `tests/textAnswerScreen.test.mjs` (25 pruebas con DOM falso).
- Roturas (primer plano, `timeout 285`, `cmp`; TRAMPA-16 y 34): 52 probadas, 43 detectadas y 9 vivas razonadas (ver `DECISIONS.md`).
- `npm run build`: caché `sophia-shell-0.24.0-c1227c66`, 187 archivos.
- Sin cableado: `app/main.js` no registra ningún tipo todavía (llega con 2.5-T2). Sin Chromium todavía.

## Sin versión nueva — 2026-10-31 — 2.5-T1, punto 1 (lógica pura de la entrada de texto; el tramo 2.5-T1 sigue en curso)

### ADD
- `core/textAnswer.js`: base común de los tipos de producción corta. `readText(item)` (respuestas de `accept`, pista y máscara; ítem inválido devuelve el motivo), `isBlank(text)` (una respuesta vacía NO se envía; cuenta también NBSP y caracteres de ancho cero), `optionsFor(type, extra)` (opciones de `compare` por tipo: `translate_word` pasa `almostAtWordEnd: true`; `lang` solo `es`), `maskHint(item)` (máscara `first_letter` o `length` de la respuesta principal, con el apóstrofo visible) y `gradeText(item, text, opts)` (califica con `compare`, inyectable; ítem inválido lanza Error en español; devuelve `typed` y `empty`).
- `tests/textAnswer.test.mjs` (51 pruebas, con `compare` real y con `compare` falso): variantes de `accept`, contracciones (`I’m` ≡ `I am`; `'s` y `'d` listados en `accept`), errata = `almost` con su marca de ortografía, última letra solo `almost` en `translate_word`, vacío, máscara y opciones reenviadas.
- Roturas en primer plano (TRAMPA-34): 54 probadas, 52 detectadas y 2 equivalentes razonadas (`\s` ya incluye U+FEFF; el `typeof` de `acceptOf` es redundante porque `isBlank` ya descarta lo que no es texto).
- No hay pantalla todavía: el componente (con `ui/components/textInput.js` en modo `exercise`) es el punto siguiente.

## v0.24.0 — 2026-10-31 — 2.4-T4, punto 3e (cierra la subparte 2.4)

Cierre de la familia ordenar/emparejar/completar: los 6 tipos (`order_blocks`, `order_dialogue`, `match_pairs`, `cloze_bank`, `unscramble_letters`, `build_from_keywords`) tienen lógica, pantalla, estilos, registro, guion y evidencia de los CA 1–5. No cambia el código de los componentes.

### CHANGE
- Versión 0.24.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js` (caché `sophia-shell-0.24.0-…`); versión citada en `tests/scenarios/2.1.md`, `2.2.md`, `2.3.md` y los 4 encabezados de `2.4.md`.
- `PROJECT_STATE.md`: 2.4 pasa a HECHA; siguiente paso 2.5-T1.
- `DECISIONS.md`: entrada de cierre de 2.4 con la evidencia de los CA 1–5 y sus límites.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-31 — 2.4-T4, punto 3d (decisión del arrastre opcional; el tramo 2.4-T4 sigue en curso)

### CHANGE
- Decisión confirmada: el arrastre opcional NO se implementa en 2.4 (ya anotado en el punto 2; aquí se confirma con su razón y su vigilancia). Los 6 tipos se resuelven solo con toques. Solo documentación: `DECISIONS.md`, `PROJECT_STATE.md` y el Delta del mapa; ni código ni pruebas nuevas.

## Sin versión nueva — 2026-10-31 — 2.4-T4, punto 3c (evidencia de los CA 1–5 de 2.4; el tramo 2.4-T4 sigue en curso)

### ADD
- `tests/family24Criteria.test.mjs` (16 pruebas, solo pruebas: no cambia `core/`, `ui/`, `app/` ni `tools/`). **CA 1 (sin arrastre obligatorio) no tenía prueba propia**: ahora el código de los 6 tipos no puede usar APIs de arrastre ni de gestos continuos, y cada tipo montado (tras tocar todo lo tocable) solo escucha `click`. Además, una matriz `EVIDENCIA` ata los CA 1 a 5 a pruebas concretas por su título: si una prueba citada se renombra o se borra, falla y obliga a actualizar la evidencia.
- Evidencia por criterio (archivo de prueba · prueba):
  - **CA 1 sin arrastre:** `family24Criteria` (sin APIs de arrastre; solo «click») · `family24ScreenFuzz` (los 6 tipos con solo toques) · las pruebas de «orden correcto/envía correct» de `orderBlocksView`, `orderTypes`, `matchPairsView`, `clozeBankView`, `buildPiecesView` y `buildTypes`.
  - **CA 2 varios órdenes válidos:** `orderBlocks` (accept, orden alternativo, bloques repetidos), `orderBlocksView`, `orderDialogue`, `orderTypes`, `buildPieces`, `buildPiecesView`, y `clozeBank` (varias respuestas por hueco).
  - **CA 3 deshacer en todos los pasos:** `orderBlocks` (deshacer todo vuelve al inicio), `clozeBank`, `buildState`, las tres vistas, y `family24Fuzz` (en cada toque comprueba que deshacer es el inverso exacto). Emparejar queda fuera: no tiene «deshacer» (ver Límites).
  - **CA 4 sin estados imposibles:** doble toque y fuzz en `orderBlocks`, `matchPairsState`, `clozeBank`, `buildState` y sus vistas; `family24Fuzz` (argumentos hostiles) y `family24ScreenFuzz`.
  - **CA 5 con 2 y con 12:** `orderBlocks`/`orderBlocksView` (2 y 12), `buildPieces`/`buildPiecesView` (2 y 12, y 16 con las 4 de más), `family24Fuzz` (topes), `family24ScreenFuzz`; en los tipos cuyo contrato topa antes se prueban sus extremos (diálogo 2 y 8, emparejar 2 y 10, banco 1 y 6 huecos con 20 fichas).
- **Límites** (escritos en la prueba y en `DECISIONS.md`): emparejar no tiene «deshacer» (provisional, ficha «2.4-T2»); «2 y 12» no se puede probar en 12 donde el contrato topa antes (diálogo 8, emparejar 10 parejas, banco 6 huecos).

### CHANGE
- Documentación: `DECISIONS.md`, `PROJECT_STATE.md` (la ficha 2.4 ya no dice que falta la «2.4-T2» ni los pasos del guion) y el Delta del mapa.

## Sin versión nueva — 2026-10-31 — 2.4-T4, punto 3b (pasos de T2 en el guion; el tramo 2.4-T4 sigue en curso)

### ADD
- `tests/scenarios/2.4.md`: tramos 2a (emparejar, 10 pasos) y 2b (banco de palabras, 10 pasos), entre los de ordenar y construir, en cola para el hito M1. Los textos citados salen de `MA_TEXT` y `CB_TEXT`. Solo documentación.

## Sin versión nueva — 2026-10-31 — 2.4-T4, punto 3a (ficha «2.4-T2»; el tramo 2.4-T4 sigue en curso)

### ADD
- Ficha «2.4-T2» en `docs/CONTRACTS.md` (emparejar y banco de palabras), entre las de T1 y T3: datos, lógica, estados, pantallas, envío, registro, estilos, pruebas y límites. Solo documentación; sin cambios en el código.

## Sin versión nueva — 2026-10-31 — 2.4-T4, punto 2 (fuzz de pantalla, «no solo color» y barras fijas; el tramo 2.4-T4 sigue en curso)

### ADD
- `tests/family24ScreenFuzz.test.mjs` (12): los 6 tipos montados con el registro real y DOM falso, con 2 y 12 bloques (o el tope del contrato: diálogo 8, emparejar 10, banco 6). Toques al azar también sobre botones deshabilitados, ráfagas de 2 a 3 toques sin esperar, envío lento (la pantalla no cambia mientras está pendiente) y primer envío fallido; como mucho un envío por ejercicio y sin fugas de escuchas.
- `tests/buttonDisabled.test.mjs` (8): `ui/components/button.js` no dispara `onClick` si está deshabilitado o cargando, ni con toques repetidos.
- `tests/family24NotColorOnly.test.mjs` (6): en ordenar, diálogo, construir, letras, banco y emparejar toda marca ✓/✗ lleva texto o nombre accesible.
- `tools/build-check.py --bars`: comprobación en Chromium de las 4 barras fijas con el máximo de piezas (12 casos: 6 × «Normal» y «Muy grande»); toda pieza se puede dejar por encima de la barra, ninguna queda tapada al final y la barra no pasa del 40 % de la pantalla.

### CHANGE
- Sin cambios en `core/`, `ui/` ni `app/`. La barra fija NO recibe `padding-bottom` (respuesta 7 del Administrador, reemplazada tras la medición; ver `DECISIONS.md`).

### Notas
- Roturas: `button.js` 9/9; componentes 28 (14 detectadas + 14 equivalentes); barras 5/5; «no solo color» 10 (8 + 2 combinadas).
- Trampas nuevas: TRAMPA-35, 36 y 37; mejorada la 24.

## Sin versión nueva — 2026-10-30 — 2.4-T4, punto 1 (fuzz de la lógica de toques de la familia ordenar/emparejar/completar; el tramo 2.4-T4 sigue en curso)

### ADD
- `tests/family24Fuzz.test.mjs`: 21 pruebas. Secuencias de toques al azar (60 por caso, 300 acciones cada una) contra un MODELO independiente en los 4 estados: ordenar con 2, 5 y 12 bloques; construir con 2 piezas, 2 + 4 de más y 12 + 4 de más; banco con 1 a 6 huecos y 1 a 20 fichas; emparejar con 2 a 10 parejas y hasta 4 de más. Tras CADA toque comprueba: mismo resultado que el modelo, MISMO objeto si la acción no procede (doble toque incluido), estado congelado, estado anterior sin mutar, bandeja fija y deshacer como inverso exacto. Más: argumentos hostiles, historial lleno (200) y tope de intentos de emparejar.

### Notas
- Roturas del fuzz (solo con esta prueba): 51 probadas, 49 detectadas a la primera y 2 tras una prueba nueva (hueco real: «Empezar de nuevo» con el historial agotado pero piezas aún puestas, en `core/clozeBank.js` y su gemela de `core/orderBlocks.js`); 0 vivas. Sin cambios en `core/`, `ui/` ni `app/`.
- Rareza inofensiva anotada (no se corrige): `placeBlock(estado, -0)` guarda `-0` en `placed` y se comporta como 0; la pantalla solo manda enteros >= 0.

## Sin versión nueva — 2026-10-30 — 2.4-T3, punto 5 (cierre del tramo de construir con piezas)

### ADD
- Ficha «2.4-T3» en `docs/CONTRACTS.md` y pasos de construir en `tests/scenarios/2.4.md` (en cola para el hito M1).

### Notas
- 2.4-T3 queda CERRADO sin subir versión (0.23.0). Verificación: `npm run check` 3574 pruebas (3573 pasan, 1 omitida, 0 fallos) y auditoría en 0; `order-check`, `match-check`, `cloze-check` y `build-check` en Chromium: 24 de 24 cada uno. Siguiente: 2.4-T4.

## Sin versión nueva — 2026-10-30 — 2.4-T3, punto 4 (estilos `.bp`, registro de los 2 tipos de construir y Chromium; el tramo 2.4-T3 sigue en curso)

### ADD
- Estilos `.bp` al final de `ui/styles/widgets.css` (solo tokens existentes; 704 a 747 líneas). `ui/exercises/buildTypes.js` (`BUILD_TYPES`, `registerBuildTypes`) y su registro en `app/main.js`, tras `registerOrderTypes`.
- `tests/buildTypes.test.mjs`: 15 pruebas. `tools/build-check.py`: 4 casos × 3 temas × 2 tamaños (24 de 24) en Chromium 141, con estilos calculados y hover.

### Notas
- Roturas del CSS: 172 probadas, 155 detectadas y 17 equivalentes razonadas. Roturas del registro: 41 probadas, 35 detectadas y 6 equivalentes (ver `DECISIONS.md`). No visto en teléfono real; no alcanzable desde la interfaz hasta 2.9-T3.

## Sin versión nueva — 2026-10-30 — 2.4-T3, punto 3 (componente de pantalla de `unscramble_letters` y `build_from_keywords`; el tramo 2.4-T3 sigue en curso)

### ADD
- `ui/exercises/buildPieces.js` (`createBuildPieces`, `BP_TEXT`): bandeja fija con piezas de más, zona de respuesta, «Deshacer», «Empezar de nuevo», «Comprobar» (exige tantas piezas como tiene la respuesta), «No sé» siempre a la vista, corrección con ✓/✗/«Sobra» y la respuesta correcta, y «Comprobar» de nuevo si el envío falla. `responseRaw` por `toResponseRaw` (TRAMPA-32).
- `tests/buildPiecesView.test.mjs`: 55 pruebas (incluye 150 secuencias de toques al azar).

### Notas
- Roturas: 83 probadas, 75 detectadas y 8 equivalentes razonadas (ver `DECISIONS.md`). Sin CSS ni registro todavía: no se ve ni es alcanzable (punto 4; la pantalla de ítems llega con 2.9-T3). No visto en Chromium ni en un teléfono.

## Sin versión nueva — 2026-10-30 — 2.4-T3, punto 2 (estado de toques de construir con piezas; el tramo 2.4-T3 sigue en curso)

### ADD
- `core/buildPieces.js`: `createBuildState` y `gradeBuildState` (hasta 16 piezas: 12 + 4 de más), con las acciones de ordenar.
- `core/orderBlocks.js`: `createOrderState` acepta `max` (12 a 32) y se exporta `STATE_MAX_CEILING`; sin `max` nada cambia para ordenar.
- `tests/buildState.test.mjs`: 13 pruebas (incluye 300 secuencias de toques al azar con 2, 12 y 16 piezas).

### Notas
- Roturas: 22 probadas, 21 detectadas y 1 equivalente (ver `DECISIONS.md`). Sin pantalla ni registro todavía (puntos 3 a 5).

## Sin versión nueva — 2026-10-30 — 2.4-T3, punto 1 (lógica pura de `unscramble_letters` y `build_from_keywords`; el tramo 2.4-T3 sigue en curso)

### ADD
- `core/buildPieces.js` (`BUILD_LIMITS`, `readBuild`, `gradeBuild`): lee el ítem (piezas, piezas de más, `accept`, barajado) y califica; sin DOM, sin reloj y sin azar. Sin `almost`.
- `tests/buildPieces.test.mjs`: 22 pruebas.

### Notas
- Roturas: 40 probadas, 38 detectadas y 2 equivalentes razonadas (ver `DECISIONS.md`). Sin estado de toques, pantalla ni registro todavía (puntos 2 a 5).

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 5c (estilos `.cb`, registro y Chromium de `cloze_bank`; el tramo sigue en curso)

### ADD
- Estilos `.cb` en `ui/styles/components.css`, registro de `cloze_bank` en `app/main.js` y `tools/cloze-check.py` (24/24 en Chromium).

### Notas
- Roturas del CSS: 8 válidas, 7 detectadas, 1 equivalente (ver `DECISIONS.md`). Contraste AA correcto en los 3 temas. No visto en teléfono real. Con esto queda CERRADO el tramo 2.4-T2 sin subir versión.

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 5b (componente de pantalla de `cloze_bank`; el tramo 2.4-T2 sigue en curso)

### ADD
- `ui/exercises/clozeBank.js` (`createClozeBank`, `CB_TEXT`): frase con un botón por hueco, bandeja fija de palabras, «Deshacer», «Empezar de nuevo», «Comprobar» (exige todos los huecos llenos), «No sé» siempre a la vista, corrección con ✓/✗ por hueco y la frase correcta, y «Enviar otra vez» si el envío falla (se desbloquea y avisa). `responseRaw` por `toResponseRaw` (TRAMPA-32).
- `tests/clozeBankView.test.mjs`: 51 pruebas (incluye 150 secuencias de toques al azar).

### Notas
- Roturas: 123 probadas, 110 detectadas y 13 equivalentes razonadas (ver `DECISIONS.md`). Sin CSS ni registro todavía: no se ve ni es alcanzable (punto 5c; la pantalla de ítems llega con 2.9-T3). No visto en Chromium ni en un teléfono.

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 5a (lógica pura de `cloze_bank`; el tramo 2.4-T2 sigue en curso)

### ADD
- `core/clozeBank.js`: `readClozeBank` (1 a 6 huecos, banco de 1 a 20 fichas obligatorio, comprobación de que se puede resolver con fichas distintas), `gradeClozeBank` (binario, con `wrongGaps`) y el estado de toques (`createClozeState`, `placeWord`, `removeFill`, `undoLast`, `resetCloze`, `freeWords`, `isClozeComplete`).
- `tests/clozeBank.test.mjs`: 34 pruebas (incluye 150 secuencias de toques al azar sin estados imposibles).

### Notas
- Roturas: 101 probadas, 99 detectadas y 2 equivalentes razonadas (ver `DECISIONS.md`). Sin pantalla, estilos ni registro todavía (puntos 5b y siguientes).

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 4 (estilos, registro y verificación de `match_pairs`; el tramo 2.4-T2 sigue en curso)

### ADD
- `ui/styles/components.css`: estilos `.ma` (dos columnas de tarjetas táctiles de 44 px o más, estados seleccionada, fallo y resuelta, marca «✓ n» con línea reservada, barra de acciones fija con «No sé»).
- `app/main.js`: `match_pairs` registrado en el registro de ejercicios.
- `tools/match-check.py`: verificación opcional en Chromium 360×640 (24 casos: 4 × 3 temas × 2 tamaños de texto); capturas por defecto en `/tmp/match-shots` (TRAMPA-33). 24/24 con el CSS limpio.

### CHANGE
- La marca «✓ n» ocupa siempre su línea para que las tarjetas no se muevan al acertar (ver `DECISIONS.md`).

### Notas
- Contraste de los estilos `.ma` medido; hallazgo abierto sobre `.ob` en `DECISIONS.md`. Roturas del CSS: 2 detectadas y 1 viva razonada como equivalente provisional.
- No visto en un teléfono real; la pantalla sigue sin ser alcanzable desde la interfaz hasta 2.9-T3.

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 3 (componente de pantalla de `match_pairs`; el tramo 2.4-T2 sigue en curso)

### ADD
- `ui/exercises/matchPairs.js`: `createMatchPairs({ rng?, leftLang?, rightLang?, log? }).mount(container, item, ctx) → { el, destroy(), getResponse() }` y `MA_TEXT`. Dos columnas de tarjetas por toques (cualquier orden): acierto bloquea la pareja con su número y «✓»; fallo marca «✗» en las dos hasta el siguiente toque; progreso «X de N parejas». Al resolver la última se envía solo (`correct` sin fallos, si no `wrong`, con `responseRaw` por `toResponseRaw`); «No sé» siempre a la vista; si el envío falla, aviso y «Enviar otra vez» sin perder nada. Sin CSS ni registro (punto 4).
- `tests/matchPairsView.test.mjs` (40, DOM falso): montaje, barajado, selección, acierto, fallo, doble toque, envío, «No sé», errores de envío, bloqueo mientras se envía, destruir a mitad, texto sin HTML, 2 y 10 parejas con distractores y 150 secuencias de toques al azar.
- Roturas: 59 probadas, 35 detectadas a la primera, 24 vivas: 20 cerradas con pruebas nuevas y 4 equivalentes razonadas en `DECISIONS.md`.

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 2 (estado de toques y calificación de `match_pairs`; el tramo 2.4-T2 sigue en curso)

### ADD
- `core/matchPairs.js`: `createMatchState(pairCount, extraCount, { rng, shuffle? })`, `pickMatch(state, side, index)`, `isMatchComplete(state)` y `gradeMatch(item, attempts)`. Estado congelado y puro; el feedback por pareja es inmediato (un toque en cada lado resuelve el intento: acierto bloquea la pareja, fallo limpia la selección); una pareja resuelta no se puede volver a tocar (doble toque = mismo estado). `gradeMatch` devuelve `result` (`correct` solo completo y sin fallos; si no, `wrong`), `solved`, `mistakes`, `firstTry`, `wrongLefts` y `text`.
- `tests/matchPairsState.test.mjs` (32): barajado nunca en el orden original (muchas semillas), selección, acierto, fallo, empezar por la derecha, distractores, bloqueos, toques inválidos, tope de intentos, calificación, intentos hostiles y 3000 secuencias de toques al azar.

### CHANGE
- `MATCH_LIMITS` suma `attempts: 400` (solo para el estado de toques); `tests/matchPairs.test.mjs` ajustado.
- Roturas: 74 probadas, 61 detectadas a la primera, 13 vivas: 11 cerradas con pruebas nuevas y 2 equivalentes razonadas en `DECISIONS.md`.

## Sin versión nueva — 2026-10-30 — 2.4-T2, punto 1 (lectura de `match_pairs`; el tramo 2.4-T2 sigue en curso)

### ADD
- `core/matchPairs.js`: `MATCH_LIMITS = { min: 2, max: 10, textLength: 120, extraMax: 4 }` y `readMatch(item) → { ok: true, pairs, lefts, rights, extra } | { ok: false, reason }` con `reason` ∈ `no_data | bad_pairs | bad_extra`. Solo lee `data.pairs` y `data.extra_right` (el contrato `matching` de `core/contentData.js`); recorta los textos; rechaza `left` o `right` repetidos y un `extra_right` repetido o igual a un `right` de pareja. Puro, sin DOM ni azar. Aún no califica ni tiene pantalla.
- `tests/matchPairs.test.mjs` (13): caso feliz, bordes 2/10, 120 y 4, cada dato dañado, repetidos (también tras recortar), no muta el ítem y coherencia con el validador (400 ítems al azar).
- Roturas: 27 probadas, 27 detectadas (18 en la primera orden; 9 se repitieron con otro texto ancla porque el original no era único), 0 vivas.

## Sin versión nueva — 2026-10-30 — 2.4-T1, punto 10 (cierre del tramo «Ordenar»; la versión sigue en 0.23.0 porque 2.4 tiene 4 tramos)

### ADD
- `core/responseText.js`: `toResponseRaw(texto, max = 2000)`, UNA función que cambia por espacio (1 a 1) los caracteres de control que el evento rechaza (0–8, 0B, 0C, 0E–1F, 7F–9F; tab, salto de línea y retorno sí valen) y recorta al máximo; exporta también `EVENT_CONTROL` y `RESPONSE_RAW_MAX`. Pedido del Administrador para que esta clase de bug no reaparezca en 2.5 ni en otros tipos. Registrada como **TRAMPA-32** en el mapa. También se registra **TRAMPA-33** (`tools/order-check.py` deja `order-shots/` dentro del repo: usa `--out /tmp/order-shots`).
- `tests/responseText.test.mjs` (13): barrido 0–0x9F contra `validateEvent`, solo cambia lo que el evento rechaza, desde U+00A0 no se toca, recorte después de limpiar, máximo inválido, entradas que no son texto, y una guardia que exige que `choice`, `orderBlocks` y `phraseCloze` la importen y no traigan su propia lista de controles ni su propio `.slice(0, 2000)`.
- `tests/orderBlocksControl.test.mjs` (3): el mismo barrido 0–0x9F montando el componente `order_blocks` real. Falló antes del arreglo (3 de 3 en rojo; U+0080 ya dejaba el evento inválido).
- `docs/CONTRACTS.md`: ficha «2.4-T1» (contratos de datos, límites, API de `core/orderBlocks.js`, `createOrderBlocks` y sus opciones, `ORDER_TYPES`/`registerOrderTypes`, forma del envío, razones `no_data`/`bad_blocks`/`bad_lines`/`bad_accept`, `toResponseRaw`) enlazada con la ampliación 1.3-2A.
- `tests/scenarios/2.4.md`: guion de 10 pasos para el teléfono, EN COLA para el hito M1 (la pantalla no es alcanzable hasta 2.9-T3).

### FIX
- `ui/exercises/orderBlocks.js`: la limpieza de `responseRaw` (`/[\u0000-\u001F\u007F]/g`) no cubría U+0080 a U+009F, que el evento también rechaza: con uno de esos 32 caracteres en un bloque la respuesta se perdía (hallazgo del punto 9). Ahora usa `toResponseRaw`, también en `getResponse`. Solo ocurría con contenido sin validar (el validador ya los rechaza en `data.blocks`).

### CHANGE
- `core/choice.js` (`typed`), `ui/exercises/orderBlocks.js` y `ui/exercises/phraseCloze.js` usan `toResponseRaw`; se quitan sus tres expresiones propias (`EVENT_CONTROL` en `choice` y `phraseCloze`, `CONTROL_RE` y `RESPONSE_MAX` en `orderBlocks`). El comportamiento de `choice` y `phraseCloze` no cambia.
- Roturas: 36 probadas, 33 detectadas en la primera ronda (92 %), 3 vivas equivalentes explicadas en `DECISIONS.md`.

## Sin versión nueva — 2026-10-30 — 2.4-T1, punto 9 (FIX de caracteres de control en `phrase_cloze`; el tramo sigue en curso)

### FIX
- `ui/exercises/phraseCloze.js`: `responseRaw` salía de `g.typed.slice(0, 2000)` sin limpiar. Con un texto pegado que trajera un carácter de control, `validateEvent` rechazaba el evento («contiene caracteres de control») y la respuesta se perdía. Reproducido antes del arreglo: 62 de los 160 códigos de 0 a 0x9F (0–8, 0B, 0C, 0E–1F, 7F–9F) daban un evento inválido. Ahora se cambian por espacio (`EVENT_CONTROL`, los mismos que rechaza `eventSchema`) antes de recortar; tab, salto de línea y retorno se conservan. Lo que se muestra (`getResponse`) no cambia.

### ADD
- `tests/phraseClozeControl.test.mjs` (6): barrido 0–0x9F contra `validateEvent` (falla antes del arreglo, pasa después), cambio por espacio, `getResponse` intacto, campo de 200 controles, y que lo que el evento acepta (tab, LF, CR, U+00A0 a U+02FF, U+2028, U+200B) no se toca.
- Roturas sobre la línea corregida: 22 probadas, 19 detectadas en la primera ronda (86 %), 3 vivas equivalentes explicadas en `DECISIONS.md`.

## Sin versión nueva — 2026-10-30 — 2.4-T1, punto 8 (validación de `order_blocks` y `order_dialogue` en el contenido; el tramo sigue en curso)

### ADD
- `core/contentData.js`: `checkOrderItem` (reglas cruzadas de la familia `ordering`: `order_blocks` exige `data.blocks`, `order_dialogue` exige `data.lines`, los demás tipos siguen con `data.pieces`; un campo en el tipo equivocado da `ORDER_ONLY`) y los campos `blocks`, `lines` y `shuffle` en la especificación `ordering`. Los topes se importan de `core/orderBlocks.js` (`ORDER_LIMITS`, `DIALOGUE_LIMITS`), sin duplicar números.
- `tests/contentOrder.test.mjs` (17): bordes 2/12, 2/8, 200, 20 y 600, cada dato dañado, compatibilidad de `pieces`, coherencia con `readOrder` (300 ítems al azar) y paquete de muestra.
- Paquete de muestra: `g.samp.0020` (`order_blocks` con `shuffle` y `accept`) y `g.samp.0021` (`order_dialogue`, 3 líneas con `accept`); ahora tiene 21 ítems.
- Roturas: 27 probadas, 25 detectadas en la primera ronda (93 %), 2 vivas cerradas con pruebas nuevas, 0 equivalentes.

### CHANGE
- `core/contentData.js`: `pieces` de `ordering` pasa de obligatorio a opcional en la forma; lo exige `checkOrderItem` a los tipos que lo usan. `core/contentItem.js` llama a `checkOrderItem` (solo con las especificaciones oficiales y `data` sin errores).
- **Ruptura puntual (sin paquetes instalados):** un `order_blocks` con `data.pieces` ya NO es válido (debe usar `data.blocks`); el ítem `g.samp.0013` del paquete de muestra se migró. `content/packs/` está vacía, así que ningún paquete real se ve afectado.
- Pruebas existentes: `contentData.test.mjs` (2 aserciones de `order_blocks` pasan a `blocks`; `build_from_keywords` conserva `pieces`) y los conteos de ítems 19 → 21 en `add-pack`, `content`, `contentImport` y `validate-content`.

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 7 (componente, envoltorio y registro de `order_dialogue`; el tramo sigue en curso)

### ADD
- `ui/exercises/orderTypes.js`: tabla `ORDER_TYPES` (`order_blocks`, `order_dialogue`) y `registerOrderTypes(registry, { rng, log })`, como `choiceTypes.js` en 2.3.
- `tests/orderTypes.test.mjs` (21): tabla congelada, registro real, registro doble que lanza, `rng` y `log` que llegan, y `order_dialogue` en pantalla («Hablante: texto», envío sin hablante, `accept`, corrección por renglones, «No sé», 2 y 8 líneas, nombres accesibles).
- `tools/order-check.py`: caso `dialogo` (8 líneas, hablante de 20 caracteres, una línea con una palabra larguísima). Ahora 24 casos en Chromium, 24/24 sin fallos.
- Roturas del envoltorio y del componente: 22 probadas, 16 detectadas en la primera ronda (73 %), 21 al reforzar con 4 pruebas y 1 equivalente explicada en `DECISIONS.md`.

### CHANGE
- `ui/exercises/orderBlocks.js`: muestra `read.labels` («Hablante: texto») cuando existen; compara, envía (`responseRaw`) y devuelve en `getResponse` solo el texto sin hablante; en la corrección de un diálogo cada línea va en su renglón con su hablante.
- `app/main.js`: ya no registra `order_blocks` a mano; llama una vez a `registerOrderTypes`, que registra los 2 tipos. `tests/orderBlocksWiring.test.mjs` ajustado a eso.

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 6 (lectura y calificación de `order_dialogue` en el núcleo; el tramo sigue en curso)

### ADD
- `core/orderBlocks.js`: `DIALOGUE_LIMITS` (2 a 8 líneas, hablante de hasta 20) y `readOrder` lee `data.lines = [{ speaker, text }]` cuando `item.type === 'order_dialogue'`. Devuelve `blocks` (el texto, lo que se compara), `labels` («Hablante: texto», lo que se mostrará) y `speakers`. `accept` se escribe sin hablante. Razón nueva: `bad_lines`. Calificar y el estado de toques no cambian.
- `tests/orderDialogue.test.mjs` (19): contrato, topes en los bordes, recortes, turnos seguidos del mismo hablante, `accept` sin hablante, compatibilidad con `order_blocks`. Roturas: 23 probadas, 22 detectadas en la primera ronda (96 %) y 23 al reforzar una prueba.
- Sin cambios para `order_blocks`: sus 52 pruebas pasan sin tocarlas.

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 5 (registro de `order_blocks` en `app/main.js`; el tramo sigue en curso)

### ADD
- `app/main.js`: importa `createOrderBlocks` y registra `order_blocks` una sola vez, después de los tipos de elección y antes de la bienvenida, con `log: console.error`.
- `tests/orderBlocksWiring.test.mjs` (3): `main.js` se importa de verdad sin errores de arranque, el tipo se registra una sola vez dentro del arranque y no choca con los tipos de elección. Roturas del cableado: 6/6 detectadas.
- Efecto en la app: nada visible todavía; sin resolvedor de ítems (2.9-T3) la pantalla sigue sin ser alcanzable desde la interfaz.

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 4c (comprobación en Chromium de `order_blocks`; el tramo sigue en curso)

### ADD
- `tools/order-check.py`: monta el componente real a 360×640 en los 3 temas y con texto «Normal» y «Muy grande» (casos de 2, 3 y 12 bloques, uno con una palabra larguísima). Comprueba desbordes, objetivos de 44 px, palabras partidas, bloques recortados, «No sé» y «Comprobar» dentro de la pantalla, grupos con nombre, que la bandeja no se mueva, deshacer, orden correcto, incorrecto y «No sé». 18/18 casos sin fallos. No forma parte de `npm run check`.

### FIX
- La frase «Aquí aparece tu frase.» estaba fuera del recuadro: al colocar el primer bloque toda la pantalla subía unos 29 px. Ahora va dentro del recuadro y un espaciador del alto de un bloque reserva el sitio (también con «Muy grande», donde antes quedaba 7 px más baja).
- `tests/orderBlocksView.test.mjs`: la prueba de la frase vacía comprueba también el espaciador.

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 4b (CSS de `order_blocks`; el tramo sigue en curso)

### ADD
- `ui/styles/components.css`: bloque `.ob` (frase armada con alto mínimo, bandeja que se ajusta a la línea, bloques de 44 px de alto como mínimo con texto que baja de línea, bloque usado con borde punteado y texto atenuado, marcas `--off`/`--ok` con borde rojo o verde, acciones fijas abajo como en `choice`, veredicto y posiciones mal puestas). Solo usa variables que ya existen y no lleva `!important` ni estilos en línea. Sin comprobar todavía en un navegador (punto 4c).

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 4a (componente de pantalla de `order_blocks`, sin CSS; el tramo sigue en curso)

### ADD
- `ui/exercises/orderBlocks.js`: `createOrderBlocks({ rng, lang, log }).mount(container, item, ctx)` con bandeja fija, frase armada por toques, «Deshacer», «Empezar de nuevo», «Comprobar» (exige todos los bloques) y «No sé» siempre a la vista. Al responder pinta el veredicto, la frase correcta y las posiciones mal puestas. No registra el tipo en `app/main.js`.
- `tests/orderBlocksView.test.mjs`: 33 pruebas con DOM falso (22 + 11 que cerraron huecos de las roturas) (toques, deshacer, reiniciar, envío, `accept`, fallo al guardar, 2 y 12 bloques, bloques repetidos, texto con marcas HTML, `responseRaw` sin controles y con tope de 2000, `destroy`). Roturas del componente: 33 probadas, 31 detectadas (19 en la primera ronda, 58 %) y 2 equivalentes explicadas en `DECISIONS.md`.

### CHANGE
- `ui/exercises/orderBlocks.js`: se quitó un `render()` redundante tras un fallo al guardar (`lock(false)` ya deja los botones y la bandeja como deben estar).

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 3 (estado de toques de `order_blocks`; el tramo sigue en curso)

### ADD
- `core/orderBlocks.js`: estado de toques con funciones puras que devuelven un estado nuevo y congelado: `createOrderState(count, { rng, shuffle })`, `placeBlock`, `removeBlock`, `undoLast`, `resetOrder`, `bankOf`, `isComplete`. La bandeja (`tray`) es fija: un bloque no se puede colocar dos veces ni perder. El barajado nunca deja la bandeja en el orden original (reintenta 10 veces y gira un lugar). Deshacer quitar devuelve el bloque a su posición. Historial con tope de 200 (se conservan las acciones más recientes). Una acción que no procede devuelve el mismo objeto. `ORDER_LIMITS` gana `history: 200`.
- `tests/orderBlocks.test.mjs`: de 27 a 52 pruebas, con un fuzz de 3000 acciones en 2, 5 y 12 bloques que comprueba invariantes y que nada lanza. Roturas: 43 probadas, 42 detectadas y 1 equivalente (explicada en `DECISIONS.md`); 2 huecos de pruebas encontrados y cerrados (`shuffle` con valores distintos de `false`, y el tope del historial conservando lo reciente).

### CHANGE
- `removeBlock` ya no comprueba el rango antes de buscar el índice (era redundante: `placed` solo tiene índices válidos).

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 2 (calificación de `order_blocks`; el tramo sigue en curso)

### ADD
- `core/orderBlocks.js`: `gradeOrder(item, placed)` → `{ result, placed, text, matched, complete, empty, misplaced }`. `placed` son los índices de `data.blocks` en el orden que puso la persona; lo que no es un índice válido o está repetido se ignora. Es `correct` solo con todos los bloques y el texto unido coincidiendo con `accept` según `compare`; si no, `wrong` (no hay `almost` en ordenar). `misplaced` marca las posiciones mal puestas respecto al orden de `data.blocks`, solo en respuestas completas y erróneas. Lanza un Error en español si el ítem no es válido, como `gradeChoice`.
- `tests/orderBlocks.test.mjs`: de 13 a 27 pruebas. Roturas de `gradeOrder`: 26 probadas, 25 detectadas, 1 equivalente (explicada en `DECISIONS.md`); 6 huecos de pruebas encontrados por las roturas y cerrados con 5 pruebas (espacios en bloques, incompleto que coincide con un `accept` corto, «casi» de `compare`, un solo bloque puesto, `misplaced` en incompleto).

## Sin versión nueva — 2026-10-29 — 2.4-T1, punto 1 (lectura de ítems `order_blocks`; el tramo sigue en curso)

William autorizó adelantar un punto pequeño de 2.4-T1 en el mismo chat de 2.3-T3. La versión sigue en 0.23.0.

### ADD
- `core/orderBlocks.js`: `ORDER_LIMITS` (2 a 12 bloques, bloque ≤ 200, `accept` ≤ 600) y `readOrder(item)` → `{ ok, blocks, solution, accept, shuffle }` o `{ ok: false, reason }` con `no_data | bad_blocks | bad_accept`. Los bloques van en el orden correcto en `data.blocks` y se identifican por posición (dos bloques con el mismo texto son distintos); `item.accept` añade otros órdenes válidos. Sin DOM ni azar.
- `tests/orderBlocks.test.mjs` (13 pruebas). Roturas: 23 probadas, 23 detectadas (4 intentos iniciales cayeron en un comentario, se descartaron y se repitieron en la línea real).

## v0.23.0 — 2026-10-29 — 2.3-T3, parte 5 (cierra la subparte 2.3)

Cierre de la familia de elección: verificación de los CA 1–5 con evidencia y subida de versión. No cambia el código de los componentes.

### ADD
- `DECISIONS.md`, sección 2.3-T3: tabla de evidencia de los CA 1–5 y su límite.

### CHANGE
- Versión 0.23.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js` (caché `sophia-shell-0.23.0-…`); versión citada en `tests/scenarios/2.1.md`, `2.2.md` y `2.3.md`.
- `PROJECT_STATE.md`: 2.3 pasa a HECHA; siguiente paso 2.4-T1; cola de pruebas con el guion 2.3.

### FIX
- Ninguno.

## Sin versión nueva — 2026-10-29 — 2.3-T3, parte 4 (guion `tests/scenarios/2.3.md`; el tramo sigue en curso)

### ADD
- `tests/scenarios/2.3.md`: guion de 11 pasos para William (6 min), EN COLA para el hito M1 (la pantalla de elección aún no es alcanzable desde la interfaz). Cubre opciones barajadas, «Comprobar» sin elegir, acierto, fallo con «Pista:», «No sé», selección múltiple, opciones largas, «Muy grande» en los tres temas y lector de pantalla. Los textos citados salen de `CH_TEXT` (`ui/exercises/choice.js`).

## Sin versión nueva — 2026-10-29 — 2.3-T3, parte 3 (prueba estadística de barajado de los 9 tipos; el tramo sigue en curso)

### ADD
- `tests/choiceShuffleTypes.test.mjs` (3 pruebas, CA 1): monta cada uno de los 9 tipos 600 veces con `registerChoiceTypes` y cuenta la posición en pantalla de la correcta (4 opciones con semilla fija, 2 opciones y azar del sistema con cotas anchas). Comprueba también que no se pierde ni se repite ninguna opción. Roturas: 5 probadas, 3 detectadas, 2 equivalentes (explicadas en `DECISIONS.md`).

## Sin versión nueva — 2026-10-29 — 2.3-T3, partes 1 y 2 (envoltorios y cableado de `choice`; el tramo sigue en curso)

William autorizó empezar T3 por partes pequeñas. La parte 1 no tocó `app/main.js`; la parte 2 lo cablea: los 9 tipos quedan registrados en la app (siguen sin ítems: el resolvedor es 2.9-T3).

### ADD
- `ui/exercises/choiceTypes.js`: `CHOICE_TYPES` (los 9 tipos; solo `mcq_en_es` lleva `optionsLang: 'es'`) y `registerChoiceTypes(registry, { rng?, catalog?, log? })`, que registra cada tipo con su propio `createChoice`.
- `tests/choiceTypes.test.mjs` (11); roturas 17 probadas, 17 detectadas (una era un hueco real: el `log` no se comprobaba).
- Parte 2: `app/main.js` llama a `registerChoiceTypes(app.services.exercises, { catalog: () => app.services.study?.catalog ?? null, log: console.error })` tras registrar `phrase_cloze`; `tests/choiceWiring.test.mjs` (3: importa `main.js` de verdad y comprueba que no hay error de arranque, y el texto del cableado); roturas 8 probadas, 8 detectadas (la 8.ª repite la 1.ª).

## Sin versión nueva — 2026-10-29 — 2.3-T2 (retroalimentación y errores de `choice`)

Segundo tramo de la familia de elección: pistas del catálogo por distractor y registro de errores. Sigue sin registrarse ningún tipo (2.3-T3) y el resolvedor de ítems sin cablear (2.9-T3).

### ADD
- `core/choiceFeedback.js`: `explainChoice(item, graded, { catalog? }) → { hints, errors }`. Solo actúa si el resultado es `wrong`; los textos se limpian y se recortan a `LIMITS` de `core/errors.js`; un code que no está en el catálogo se descarta; sin catálogo devuelve listas vacías.
- `ui/exercises/choice.js`: opción `catalog` (objeto con `has`/`hint`, función que lo devuelve, o null; se lee al comprobar), «Pista:» tras fallar (una si todas son iguales, si no una por opción con su texto) y `errors` en el envío solo si hay.
- `ui/styles/components.css`: `.ch__why` y `.ch__why-opt`.
- `tests/choiceFeedback.test.mjs` (29), `tests/choiceFeedbackView.test.mjs` (17), `tests/choiceErrorsSession.test.mjs` (10, sesión real con servicios y base en memoria).
- `tools/choice-check.py`: casos de la «Pista:» (una y una por opción, con palabra larguísima) a 360×640, 3 temas, «Normal» y «Muy grande»: 36 casos, 0 fallos en Chromium.
- Roturas 4.R: 107 probadas, 105 detectadas tras añadir 9 pruebas, 2 equivalentes explicadas.
- Trampas nuevas en `docs/REPO_MAP.md`: TRAMPA-28 y TRAMPA-29.

### CHANGE
- `ui/exercises/choice.js`: «No sé» nunca registra errores; si explicar falla, la respuesta se envía igual.
- `tests/choice.test.mjs`: 28 pruebas (eran 24).

### FIX
- `core/choice.js`: `typed` (va a `responseRaw` del evento) cambia por espacio los caracteres de control que el evento rechaza. Antes, una opción con uno de ellos invalidaba el evento y se perdía la respuesta.

## Sin versión nueva — 2026-10-27 — 2.3-T1 (componente base `choice`)

Primer tramo de la familia de elección: lógica pura y componente base. No se registra ningún tipo todavía y el resolvedor de ítems sigue sin cablear (2.9-T3).

### ADD
- `core/choice.js`: `CHOICE_LIMITS`, `readChoice`, `arrange`, `gradeChoice`.
- `ui/exercises/choice.js`: `createChoice` (opciones barajadas, «No sé» siempre a la vista, selección múltiple opcional, objetivos de 44 px) y sus estilos en `ui/styles/components.css`.
- `tests/choice.test.mjs` (24), `tests/choiceSession.test.mjs` (8), `tests/choiceView.test.mjs` (27); roturas 46/44/1.
- `tools/choice-check.py`: verificación opcional en Chromium (no entra en `npm run check`).
- Trampas nuevas en `docs/REPO_MAP.md`: TRAMPA-26 (DOM falso: `ownerDocument` y `classList.toggle`) y TRAMPA-27 (código de salida de `grep -c`).

### CHANGE
- Ninguno.

### FIX
- Ninguno.

### REMOVE
- Ninguno.

## v0.22.0 — 2026-10-27 — 2.2-T4 (cierra la subparte 2.2)

Cierre de la tarjeta de lección `phrase_cloze`: verificación de los CA 1–6 con evidencia, guion para el teléfono y subida de versión. No cambia el código de la tarjeta ni los estilos.

### ADD
- `tools/phrase-cloze-check.py`: verificación opcional en Chromium real (no entra en `npm run check`). Monta la tarjeta real a 360×640 en los 3 temas y con texto «Normal» y «Muy grande» (diálogo, texto largo y simple: 18 casos). Comprueba que no haya desbordes ni objetivos táctiles menores de 44 px, que el hueco tenga nombre accesible «hueco», que el micrófono esté deshabilitado con su aviso, y que funcionen la hoja del «?», las 2 pistas, la corrección con errata y el corazón. Sale con 1 si algo falla y con 2 si falta Playwright.
- `tests/scenarios/2.2.md`: guion de 10 pasos (≈ 5 min) para el teléfono, en cola para el hito M1.
- `DECISIONS.md`, sección 2.2-T4: tabla de evidencia de los CA 1–6 y el límite de esa evidencia.

### CHANGE
- Versión 0.22.0 en `core/version.js`, `package.json`, `asset-manifest.json` y `sw.js` (caché `sophia-shell-0.22.0-…`); versión citada en `tests/scenarios/2.1.md`.
- `PROJECT_STATE.md`: 2.2 pasa a HECHA; siguiente paso 2.3; cola de pruebas con el guion 2.2.

### FIX
- Ninguno.

## v0.21.0 — 2026-10-27 — 2.2-T3 (sin subir versión)

Insignias y efectos de `phrase_cloze`: `Nivel N (?)`, `New`, `Repaso en …`, corazón (favorita) y, con `almost`, aviso ortográfico y tarjeta de deletreo. La versión sigue en 0.21.0 (la sube 2.2-T4 a 0.22.0 al cerrar la subparte).

### ADD
- `core/cardBadges.js` (puro): `isNewCard(card)` (estado 0 y sin repeticiones), `badgesOf(card, now)` → `null` o `{ level, isNew, due, fav }` y `levelHelp()` (texto de la hoja del «?» con los cortes reales de `LEVEL_CUTS_DAYS`: 1, 4, 21 y 90 días).
- `core/spellCard.js` (puro): `SPELL_TOPIC` (`spell.common_misspellings`, PROVISIONAL), `spellKey(word)` (solo a–z, de 4 a 40 letras) y `spellCardPlan(flag, { now, topic? })` → `{ ok, word, itemId, cardId, card, event }` o `{ ok: false, reason }` (`no_flag`, `bad_word`, `bad_time`). La tarjeta es `spell.<palabra>#0` (faceta 0) y el evento es un `note` con `responseRaw` `spell_card <palabra> <- <escrito>`.
- `app/cardActions.js`: `createCardActions({ db, events, clock, log })` → `{ now, read, setFav, ensureSpell }` (nunca rechaza; `setFav` solo cambia `fav`; `ensureSpell` escribe primero el evento y luego la tarjeta, devuelve `created`, `exists`, `skipped` o `error`, y comparte el trabajo de llamadas simultáneas por palabra) y `lazyCardActions(getStudy, log)`, que arma las acciones con `services.study` cuando existe y devuelve `null` si no hay base.
- `ui/exercises/cardBar.js`: barra de insignias (`Nivel N (?)` con hoja de los 5 niveles y «Tu tarjeta está aquí», `New` solo si nunca se respondió, `Repaso en …`, corazón con `aria-pressed` que se desactiva mientras guarda, sin `lockMs`, y que vuelve a su estado y avisa si falla); `refresh({ dueLabel })` tras responder; se oculta si no hay tarjeta legible.
- `tests/phraseClozeBadges.test.mjs` (44 pruebas): insignias puras, plan de deletreo, acciones, barra, tarjeta, registro y un recorrido real con vista de sesión, registro, servicios y base en memoria.

### CHANGE
- `ui/exercises/index.js`: el registro acepta la opción `cards` (objeto o función que se evalúa en cada montaje; `null` si lanza) y la entrega al componente como `ctx.cards` (extensión del contrato de componente de 2.1-T4; la sección 8 no cambia).
- `ui/exercises/phraseCloze.js`: con `ctx.cards` y `entry.cardId` pone la barra de insignias arriba; si la respuesta es `almost` con `spellingFlags` muestra el aviso («escribiste «X» y se escribe «Y»…») y pide `ensureSpell` DESPUÉS de guardar la respuesta (también si ya se pasó de ejercicio). Un fallo al crear la tarjeta nunca pierde la respuesta ni bloquea «Continuar»; si el guardado da error no se crea nada y el reintento crea una sola.
- `app/main.js`: el registro recibe `cards: lazyCardActions(() => app.services.study)`.
- `ui/styles/widgets.css` (704 líneas): estilos de la barra, la hoja del nivel y el aviso. `tools/check-structure.mjs`: `REQUIRED_FILES` incluye los cinco archivos nuevos. `asset-manifest.json` y `sw.js` los regenera `npm run build`.
- `DECISIONS.md`: sección «2.2-T3» con 7 entradas (dos PROVISIONALES: la tarjeta de deletreo sin ítem de contenido y la limitación del `fav`).
- `docs/CONTRACTS.md`: ficha «2.2-T3» (insignias, tarjeta y evento de deletreo, acciones de tarjeta, `ctx.cards`, aviso y límites); se quita de la ficha «2.2-T2» la línea de «Pendiente» (ya está hecho).
- `PROJECT_STATE.md`: fila 2.2 del tablero (T3 HECHO, falta T4), «Siguiente subparte» = 2.2-T4, filas de 2.2 en la tabla de tramos, «Bugs conocidos» (los de 2.1-T4 siguen; limitación del `fav` y tarjeta `spell` sin ítem), «Pendiente de verificación por William» (insignias, corazón, hoja del «?» y aviso ortográfico, aún no vistos en pantalla) y la fila del guion 2.2 en la cola de pruebas manuales.
- `docs/REPO_MAP.md`: bloque «Delta» de 2.2-T3 (una línea por archivo, «Trampas nuevas: ninguna», «Sin cambios a propósito»), una fila del puerto `cards` en «Servicios», una línea en «Cómo encaja todo» y corrección de la línea de `ui/exercises/` (ya no está vacía).

### FIX
- `app/cardActions.js`: `ensureSpell` rechazaba la promesa si el reloj lanzaba (`clock.now()` se llamaba fuera del `try`), contra la regla «nunca rechaza». Hallado en la auditoría de cierre con prueba que falló primero; ahora el plan se arma dentro del `try` y sale `{ status: 'error' }` sin escribir nada. Se añadió también la prueba de la errata con mayúsculas («Carrer»).
- Roturas (4.R): 46 probadas sobre lo nuevo, 45 detectadas y 1 explicada (viva equivalente: la guarda `due === ''` de `badgesOf` es defensiva); 6 huecos reales cerrados con pruebas nuevas.

## Sin versión nueva — 2026-10-27 — 2.2-T2 (respuesta de `phrase_cloze`)

### ADD
- `core/phraseCloze.js` (huecos, aceptadas, pista progresiva y `grade`), y en `ui/exercises/phraseCloze.js` un campo por hueco, micrófono deshabilitado («disponible pronto»), «Ver pista», «No sé», «Comprobar» y corrección con wordDiff; `phrase_cloze` se registra en `app/main.js`; estilos en `widgets.css`; `tests/phraseClozeAnswer.test.mjs` (21).

### FIX
- El botón del micrófono no se añadía a la tarjeta.

## Sin versión nueva — 2026-10-27 — 2.2-T1, entrega 1 (contrato de `phrase_cloze`: `key_es`, `key_en`, `turns`)

Respuestas del Administrador a las 3 preguntas de 2.1-T4 y 2.2-T1 (ver `DECISIONS.md`, sección «Respuestas del Administrador… 2026-10-27»).

### ADD
- 2.2-T1 entrega 2: `ui/exercises/phraseCloze.js` (render de la tarjeta: turnos A/B, clave en ES y EN, hueco accesible, cajas de gramática y matiz, situación), estilos `.pc*` en `ui/styles/widgets.css` y `tests/phraseClozeRender.test.mjs` (9). Aún no registrado en `app/main.js` (T2).
- `core/contentData.js`: la especificación `cloze` gana tres campos opcionales y compatibles, solo para `phrase_cloze`: `key_es` (≤ 120), `key_en` (≤ 60, por defecto `answers[0][0]`) y `turns` (2 a 6 elementos `{ who: "A"|"B", es (≤ 300), en? }`). Regla cruzada `checkPhraseClozeItem` y constante `PHRASE_CLOZE_FIELDS`: `KEY_NOT_IN_TEXT` si `key_es` no aparece (sin distinguir mayúsculas) en `prompt_es` ni en algún `turns[].es`; `PHRASE_CLOZE_ONLY` si otro tipo de la familia trae alguno de los tres.
- `tests/contentPhraseCloze.test.mjs` (14 pruebas): válido con y sin los campos, límites en el borde, `turns` de 2 a 6, `who`, otros tipos, entradas hostiles.
- `tests/scenarios/2.1.md`: pregunta para William sobre el gesto «atrás» del sistema (paso 11).

### CHANGE
- `core/contentItem.js`: llama a `checkPhraseClozeItem` para la familia `cloze` con las especificaciones oficiales.
- `tests/fixtures/sample_pack_v1.json`: el `phrase_cloze` de muestra usa `key_es`, `key_en` y `turns`.
- `docs/CONTRACTS.md`: ficha «2.2-T1 (entrega 1)» (ampliación de 1.3-2A) y el campo `early` del evento `answer` pasa a APROBADO (ampliación de 8.6).
- `PROJECT_STATE.md`: el gesto «atrás» queda resuelto (opción B); nota en «Contenido» (usar los campos en 2.9-T1, 2.9-T2 y C8).

### FIX
- Ninguno. Roturas (4.R): 37 probadas sobre lo nuevo, 37 detectadas (2 vivas cerradas con pruebas nuevas).

## v0.21.0 — 2026-10-27 — 2.1 (ejecutor de sesión): T4 registro de ejercicios y cierre

### ADD
- `ui/exercises/index.js` (`createExerciseRegistry({ resolveItem?, components?, log? })` → `register`, `has`, `types`, `mount`; `RESULTS`, `BAD_ANSWER`): elige el componente por tipo (el del plan; si falta, el del ítem), resuelve el ítem por `itemId` y entrega a la vista `{ destroy, getResponse }` o `null` («tipo no soportado todavía»). El `submit` que ve el componente completa `exerciseType`, rechaza respuestas mal formadas y queda inerte tras `destroy()`.
- `app/main.js` crea `services.exercises` (hoy sin tipos ni ítems: la sesión muestra la pantalla amable hasta que 2.2 a 2.5 y 2.9 lo llenen).
- Pruebas nuevas: `tests/exerciseRegistry.test.mjs` (18) y `tests/sesion.ca.test.mjs` (9: CA 1–6 de 2.1 con registro, vista y servicios reales).
- `tests/scenarios/2.1.md` (antes `2.1-T3.md`): guion de 10 pasos, EN COLA para el hito M1.

### CHANGE
- `core/version.js` y `package.json`: 0.21.0.
- `tools/check-structure.mjs`: `core/sessionRunner.js` y `core/sessionStore.js` entran en `REQUIRED_FILES` (faltaban desde T1 y T2) junto con los archivos de este tramo.

## Sin versión nueva — 2026-10-26 — 2.1-T3 (vista de sesión)

### ADD
- `core/sessionDriver.js` (`startSession`, `resumeSession`, `createSessionDriver`, `NEW_SESSION_ID = 'nueva'`): conductor sin DOM con cola de operaciones. `shown()` → `submit(answer)` → `next()`; `submit` hace tarjeta → `gradeAnswer` → `study.commit` (una transacción) → transición `SUBMIT` → `session.save` (el commit va SIEMPRE antes que el guardado). `skipUnsupported()` salta sin evento y sin tocar la tarjeta. El tiempo (`ms`, `interrupted`) lo pone el cronómetro; el ejercicio no puede imponerlo. El driver devuelto está congelado.
- `ui/views/sesion.js` (reescrita; el roadmap la llama `session.js`, el repo ya registraba la ruta `sesion`): cabecera con flecha y barra X/N con mascota, ejercicio vía `services.exercises.mount(slot, entry, { index, total, submit })`, botón «Continuar», resumen mínimo sin culpa, mensajes (sin material, sin base, sesión no encontrada, fallo al abrir), salir con confirmación (no hace `QUIT`: la sesión guardada se conserva y se retoma por `#/sesion/<id>`, caduca a las 12 h). La ruta `nueva` arma, guarda y navega a `#/sesion/<id>` con `replace`. Sin `services.exercises`, o si `mount` falla: panel «tipo no disponible» con «Saltar por ahora».
- CSS `.session__head`, `.session__body` y `.session__foot` al final de `ui/styles/components.css`.
- Pruebas nuevas: `tests/sessionDriver.test.mjs` (37), `tests/sesionView.test.mjs` (24), `tests/sesionView.adversarial.test.mjs` (10: sesión de 1 y de 100 ítems, texto con emoji, acentos, comillas curvas y HTML, respuesta de 50.000 caracteres, reloj hacia atrás, `session.load` que lanza, doble montaje, `destroy` con el modal abierto) y 2 en `tests/sessionStore.test.mjs` (25). Ayudantes compartidos en `tests/_sesionHarness.mjs`.
- `tools/check-structure.mjs` lista los archivos nuevos y el guion.
- `tests/scenarios/2.1-T3.md`: guion de 10 pasos, EN COLA para el hito M1 (la pantalla aún no es alcanzable desde la interfaz; se prueba tras 2.1-T4 y 2.9).

### FIX
- `core/sessionStore.js` (bug de 2.1-T2, encontrado en T3): `cleanItem` rechazaba `facet` entero; el armador de `core/session.js` lo entrega como entero 0..n y las pruebas de T2 usaban texto. Ahora acepta un entero de 0 a 999 o un texto corto. Dos pruebas nuevas («FIX 2.1-T3») y el comentario de cabecera actualizado.
- `ui/views/sesion.js` (hallazgo a 360×640 en Chromium): «Seguir practicando» se partía a media palabra en el botón del modal; la etiqueta ahora es «Seguir» (prueba: etiquetas ≤ 14 caracteres y palabras ≤ 9).
- `ui/styles/components.css` (mismo hallazgo): casi no había espacio entre la barra de progreso y la tarjeta; `.session__head` lleva `padding-bottom: var(--space-4)` (16 px medidos; una prueba lee el CSS).

### CHANGE
- El botón «Continuar» ya no lleva `lockMs: 400`: ocultaba el siguiente «Continuar» en pruebas rápidas y el conductor ya ignora el doble toque.

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 6 (la práctica extra no gasta cupo; IndexedDB real)

### ADD
- Evento `answer` con marca opcional `early: true` (repaso adelantado): `core/eventSchema.js` (`OPTIONAL_FLAGS`; solo se guarda si es verdadero) y `core/gradeAnswer.js` (`gradeAnswer` y `gradeManual` la ponen con `earlyInfo`). Un evento normal no cambia de forma.
- `tests/browser/study-idb.html` y `study-idb.entry.js` (7 pruebas en IndexedDB real: `commit`, sesión, foto diaria y repasos adelantados) y `python3 tools/idb-check.py study`.
- Pruebas nuevas: 8 en `tests/dailyUsage.test.mjs` (18), 3 en `tests/eventSchema.test.mjs`, 2 en `tests/gradeAnswer.test.mjs`, 1 en `tests/services.test.mjs` (31) y 1 en `tests/earlyReview.test.mjs` (23).

### CHANGE
- `core/dailyUsage.js`: `countToday` devuelve además `practiceToday` (tarjetas conocidas con todas sus respuestas de hoy adelantadas). `reviewsToday` ya no las cuenta, así que dejan de restarse de `dailyReviewCap`; siguen siendo actividad del día para estadísticas y dominio.

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 5 (repasos adelantados; cierra T2)

### ADD
- `core/earlyReview.js` (`earlyInfo`, `withEarlyReview`): detecta si una tarjeta se repasa antes de vencer y protege el caso en que FSRS no reiniciaba: un fallo adelantado en menos de 24 h del último repaso ahora deja la tarjeta en un intervalo corto (antes una tarjeta de 46 días solo bajaba a 13). Aciertos y el resto de casos delegan tal cual a `srs.review`.
- `tests/earlyReview.test.mjs` (22 pruebas: barridos con el motor FSRS y el simple, ruta completa `gradeAnswer` → `commit`, conteo de hoy) y 1 prueba nueva en `tests/services.test.mjs` (30).

### CHANGE
- `app/services.js`: `services.study.srs` ahora es `withEarlyReview(createSrs(...))` (mismos métodos; `review` y `previewIntervals` protegidos).

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 4 (foto diaria de dominio cableada)

### ADD
- `services.study.snapshot` (`take`, `takeIfMissing`, `list` de `core/masterySnapshot.js`) y `services.study.finish()`: al cerrar la sesión borra la sesión guardada y toma la foto diaria; si la foto falla no rechaza (avisa por log y devuelve `snapshotError`).
- `startServices` toma la foto con `takeIfMissing` en el primer arranque del día, sin bloquear el arranque; el resultado queda en `services.snapshotReady` (nunca rechaza).
- 7 pruebas nuevas en `tests/services.test.mjs` (29 en total).

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 3 (restauración de la sesión a mitad)

### ADD
- `core/sessionStore.js` (`createSessionStore`: `save`, `load`, `clear`): guarda en `meta` (clave `session_active`) el estado de la máquina y la lista de ítems de la sesión en curso, y la restaura al reabrir. Valida con `validateState`, guarda solo los campos conocidos, caduca a las 12 horas y descarta (y borra) lo dañado. Al restaurar, `answering` vuelve a `presenting` y `feedback` pasa a `next`.
- `tests/sessionStore.test.mjs` (23 pruebas) y 2 pruebas nuevas en `tests/services.test.mjs`.

### CHANGE
- `app/services.js`: `services.study.session` (`save`, `load`, `clear`; null sin base).

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 2 (persistencia atómica de una respuesta)

### ADD
- `core/answerCommit.js` (`createAnswerCommit`, `commit`): guarda el evento, la tarjeta y los errores de una respuesta en una sola transacción (todo o nada), con doble toque idempotente por sesión y tarjeta, e invalida el dominio al terminar.
- `tests/answerCommit.test.mjs` (22 pruebas).

### CHANGE
- `core/events.js` expone `prepare` e `insertIn`; `core/errors.js` expone `prepare` y `applyIn` (para escribir dentro de una transacción ajena). `log` y `record` se comportan igual.
- `app/services.js`: `services.study.commit`.
- `tests/errors.recurrence.test.mjs`: la lista exacta de métodos de `errors` incluye los dos nuevos.

## Sin versión nueva — 2026-10-26 — 2.1-T2, entrega 1 (`newToday` y `reviewsToday`)

### ADD
- `core/dailyUsage.js` (`countToday`): cuenta las tarjetas nuevas y los repasos de hoy (día local) desde los eventos, para descontarlos de los topes diarios.
- `tests/dailyUsage.test.mjs` (10 pruebas) y 5 pruebas nuevas en `tests/services.test.mjs`.

### CHANGE
- `app/services.js`: `plan()` calcula `newToday` y `reviewsToday` (las `options` los pisan; si contar falla avisa por `log` y valen 0). Cierra el límite aceptado de 2.1-T1.

## Sin versión nueva — 2026-10-26 — Respuestas del Administrador (24 preguntas, roadmap v1.11) y 2.1-T2 en curso

### ADD
- `core/syncChat.js`: un bloque pegado como cita (alguna línea empieza por `>` y el JSON no se lee) responde `BAD_JSON` con el aviso «Parece una cita: quita los '>' y vuelve a pegar.» (pregunta A5). No se añade un código nuevo a 8.14.
- `core/syncImport.js`: `previewErrors` suma a `warnings` «N errores omitidos por no traer fecha.» (singular y plural) cuando un error no trae `ts` ni hay `generado:` (pregunta A2).
- `core/masterySnapshot.js` (2.1-T2, primera parte): foto diaria de dominio por tema (`mastery_snap:<día>` en `meta`), con `tests/masterySnapshot.test.mjs`. Aún sin cablear.
- `tests/syncChat.test.mjs`, `tests/syncImport.test.mjs` y `tests/sync.test.mjs`: pruebas del aviso de cita, del aviso «sin fecha» y de «reemplazar» (pregunta A8).

### CHANGE
- `DECISIONS.md`: sección «Respuestas del Administrador a las 24 preguntas acumuladas» (A1 a F24).
- `PROJECT_STATE.md`: sin preguntas abiertas; tabla de tramos con 2.9-T3, 2.10, 5.1-T1, 5.1-T3, 9.2-T3, 9.3-T2 y las ventanas de 14 a 30 días.
- `docs/CONTRACTS.md`: notas de los dos avisos nuevos y comparación de la Parte 1 repetida (pregunta B11; sin cambios a la sección 8).

## Sin versión nueva — 2026-10-26 — 2.1-T1 (Cableado de servicios y máquina de estados; tramo intermedio, la versión sigue en 0.20.0)

### ADD
- `core/sessionRunner.js`: máquina de estados pura del ejecutor (`idle → presenting → answering → feedback → next → summary`): `createState`, `transition` (devuelve `{ state, changed, ignored }`; una acción no permitida en la fase, como un segundo toque en «Comprobar», no cambia nada), `validateState` (sirve para restaurar en 2.1-T2), `progress`, `summarize`, `canDo` y la tabla `TRANSITIONS`. El estado es serializable y está congelado.
- `app/services.js`: `createStudyServices` (eventos, repaso, errores, dominio, tablero y armador `plan()`; con `db` en `null` quedan solo `srs` y `plan`) y `startServices` (carga `error_codes.json` y `topics.json` con `fetch`, nunca rechaza y deja `services.study`).
- `tests/sessionRunner.test.mjs` (18 pruebas: tabla fase × acción, flujo, doble toque, validación, ida y vuelta por JSON y 3.000 secuencias al azar) y `tests/services.test.mjs` (15 pruebas).

### CHANGE
- `app/main.js`: arranca `startServices` tras la base y los ajustes y deja `services.studyReady`.
- `asset-manifest.json` y `sw.js`: regenerados por `npm run build` (archivo nuevo en el precache).

## v0.20.0 — 2026-10-26 — 1.12-T4 (Entradas hostiles y cierre de la 1.12; HITO M0.5)

### ADD
- `tests/syncHostile.test.mjs` (24 pruebas): `__proto__`, `constructor` y `prototype`, anidación extrema, tamaños enormes, JSON malformado, números infinitos y tiempo lineal, sobre todo el puente (respaldo y bloques del chat). Incluye una prueba con los topes `MAX_BACKUP_DEPTH` (100) y `MAX_BACKUP_CHARS` (50.000.000) escritos como valores literales.
- `tests/sync.ca.test.mjs` (16 pruebas): CA 1 a 4 de la 1.12, cada uno con su evidencia (tabla en `DECISIONS.md`, sección 1.12-T4).
- `tests/browser/sync-idb.html` y `sync-idb.entry.js`, con `python3 tools/idb-check.py sync`: importación de errores y respaldo contra IndexedDB real (7 de 7 en Chromium). Cierra el pendiente de la 1.12-T3.

### CHANGE
- `docs/CONTRACTS.md`: marcado «contratos v1 congelados»; la Parte 1 se resincronizó con la sección 8 del roadmap v1.11 (tres diferencias de la copia, ninguna del contrato; ver `DECISIONS.md`). No hay cambios a la sección 8.
- `core/sync.js`: `parseBackupText` rechaza con `BAD_IMPORT` más de 100 niveles de anidación, los campos `__proto__`, `constructor` y `prototype`, y los números infinitos. `core/syncChat.js` exporta `scanValue` (sin recursión).

### FIX
- `core/syncChat.js`: una línea `tipo:` o `generado:` muy larga colgaba `parseChatBlock` más de un minuto (ReDoS). Ahora se lee en tiempo lineal con `headerValue`.
- `core/sync.js`: un respaldo con registros muy anidados lanzaba un `RangeError` crudo en `previewBackup`, y uno con `__proto__` se aceptaba.
- `core/syncLog.js`: la bitácora imprimía código de función si el área o el impacto se llamaban `constructor` o `toString` (ahora `Object.hasOwn`).
- Roturas (4.R): `syncChat.js` 30/30, `sync.js` 10/10 y `syncLog.js` 6/6 detectadas.

### Límites aceptados
- `-0` se guarda como `0` (JSON no distingue el cero negativo). Un bloque pegado como cita con `> ` en cada línea no se lee.

Subparte 1.12 HECHA: núcleo de sincronización completo (respaldo con vista previa, bloques del chat, importación idempotente de errores, bitácora). Sin pantallas. `docs/DEPLOY.md` ya usa `autoroscuro.github.io/glossa/`. Pregunta abierta para el Administrador (no bloquea): aplicar `temas[].estado` desde el chat y dónde guardarlo.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.12-T3 (Errores del chat y bitácora)

### ADD
- `core/syncImport.js`: `createChatImport({ db, errors, catalog, clock?, topics?, board? })` con `previewErrors(text)` (no escribe) e `importErrors(text)` para el bloque `errores`: fecha estable por error (su `ts` o el `generado:` del bloque), importación idempotente (reimportar da todo `replay`), lo inválido se omite, `stopped` y `skipped` si la base falla a la mitad, y `board.invalidate` tras importar. Los cambios de estado de tema (`temas`) se validan y se muestran, pero no se aplican.
- `core/syncLog.js`: `buildLogText(data?, { now? })`, `LOG_LIMITS` y `AREA_LABELS`: bitácora en texto plano con cinco secciones fijas, topes y sin el texto escrito por la persona.
- `tests/syncImport.test.mjs` (33), `tests/syncImportEdge.test.mjs` (23) y `tests/syncLog.test.mjs` (20): idempotencia, vista previa, fallos a medias, ocurrencias antiguas con más de 10 fechas, bordes de 500 y 501 caracteres, bloques de 200 errores, reloj hacia atrás, entradas hostiles y un caso con motor real que demuestra la señal E vieja sin invalidar el tablero.

### CHANGE
- `core/sync.js`: `createSync` acepta además `errors`, `catalog`, `topics` y `board` (opcionales) y expone `previewChatErrors`, `importChatErrors`, `buildLog` y `makeLogBlock`.

### FIX
- `core/syncChat.js` (1.12-T2): el día del bloque `estado` (`dia`) ahora exige una fecha real (`isRealDay`), no solo la forma `AAAA-MM-DD`.
- Roturas (4.R) sobre `core/syncImport.js` y `core/syncLog.js`: 148 probadas, 143 detectadas, 5 equivalentes razonadas (`DECISIONS.md`).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.12-T2 (Bloques del chat)

### ADD
- `core/syncChat.js`: `makeChatBlock(kind, payload, { now? })` y `parseChatBlock(text)` del formato `SOPHIA-EN-SYNC v1` (8.14) para los cuatro tipos (`llevar_al_chat`, `errores`, `estado`, `bitacora`), más `validateChatPayload`, `ChatBlockError`, `BLOCK_KINDS` y `LIMITS`. La lectura tolera texto alrededor, vallas ``` y ~~~, citas y negritas, mayúsculas, espacios raros (NBSP, BOM, ancho cero), CRLF y CR suelto, y comillas curvas como comillas del JSON; no lanza nunca y devuelve `{ ok:false, error:{ code, message } }` con mensajes en español. Rechaza `__proto__`, `constructor` y `prototype`, más de 12 niveles, más de 20.000 nodos y campos que no son del tipo.
- `tests/syncChat.test.mjs` (30 pruebas: ida y vuelta de los 4 tipos, variantes de formato, fallos con su código, entradas hostiles, bordes exactos de límites y validación por tipo).

### CHANGE
- `core/sync.js`: `createSync` ofrece `makeChatBlock` (con su reloj) y `parseChatBlock`, y el módulo las reexporta con los nombres de 8.15. Ninguna otra función cambia.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.12-T1 (Respaldo con vista previa y `clear(store)`)

### ADD
- `clear(store)` en el contrato de almacenamiento y en los dos motores (`core/db.js`, `core/db.memory.js`, `core/db.idb.js`), directo y dentro de `tx` (`t.clear`). Vacía el almacén de una vez, devuelve cuántos registros había y conserva lo reservado (`meta.schemaVersion`).
- `core/sync.js`: `previewBackup(text, { mode, keepSecrets })` (vista previa del impacto de importar, sin escribir nada: añadidos, sobrescritos, idénticos, perdidos, claves conservadas y total final por almacén; avisa si el respaldo trae claves y de qué versión migra).
- `tests/sync.test.mjs` (30 pruebas), 10 pruebas de `clear` en `tests/_dbContract.mjs` (más 1 de cuota solo en memoria) y el banco `tests/browser/clear-idb.*` (`python3 tools/idb-check.py clear [only=…&runs=…]`).

### CHANGE
- `exportBackup` quita las claves por su cuenta aunque el motor las entregue, solo `includeSecrets: true` exacto las incluye, y devuelve además `includesSecrets`. `importBackup` devuelve también `mode` y valida el modo antes de leer el texto.
- `events.clearAll()` y `wipeAll()` (Borrar todo) vacían con `clear`; el reemplazo de `importAll` usa la misma operación en ambos motores. Medido en IndexedDB real con 10.000 eventos (mediana de 5): `clearAll` 9.516 → 1.048 ms; `wipeAll` 9.048 → 1.284 ms; reemplazar respaldo 1.124 → 1.276 ms (sin cambio real: ya usaba `os.clear()`).
- `tests/dataTools.test.mjs`: la prueba «wipeAll es atómico» simula el fallo en `tx.clear` (antes en `tx.delete`).
- `tools/idb-check.py`: argumento `clear` y consulta opcional de la página; el servidor ya no imprime las líneas `GET`.

### FIX
- Nada que corregir en subpartes anteriores. Roturas (4.R) sobre `core/sync.js`: 47 probadas, 45 detectadas, 2 equivalentes razonadas (`DECISIONS.md`).

## v0.19.0 — 2026-10-25 — 1.11-T3 (Chequeo y cierre de la 1.11)

### ADD
- `core/whitelist.js`: fachada de la lista blanca. `createWhitelist({ table, properNouns? })` → `{ check, markNew, isWithinTarget }`; `isWithinTarget` también suelta. `check(text, known)` da `{ unknown, pctKnown, total, knownCount, unknownCount, ignored, names }`; `markNew` da `{ marks, segments, newWords, pctKnown, total }`. Reexporta `knownLemmas`, `knownLemmasDetailed`, `createLemmaTable`, `loadLemmas`, `tokenize` y `TARGET_RANGE`.
- `core/whitelist.config.js`: `TARGET_RANGE` (0,90–0,95).
- `tests/whitelist.test.mjs` (47 pruebas) y `tests/whitelist.ca.test.mjs` (CA 1 a 4 y 10 textos de control contados a mano, con el `lemmas.json` real).
- `docs/CONTRACTS.md` y `DECISIONS.md`: entradas 1.11-T3. `tools/check-structure.mjs` registra los tres archivos nuevos.

### CHANGE
- `docs/ROADMAP.md` pasa a la versión 1.11 (sha256 `b4a16136…f7725`).

Sin pantalla: no hay guion de prueba manual. ¿Afecta contratos? no (la firma `whitelist.check(text, knownLemmas)` de 8.15 se respeta).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.11-T2 (Lematizador y conocidos)

### ADD
- `core/lemmas.js`: `createLemmaTable` (valida y construye la tabla de `lemmas.json`: `lemmasOf`, `has`, `info`, `analyze`), `loadLemmas` (cargador con `fetch` inyectado, tiempo límite y tope de bytes; nunca lanza).
- `core/whitelistKnown.js`: `knownLemmas(db, opts)` y `knownLemmasDetailed`: base A1 + palabras `known`/`learning` + lemas de `prompt_en` y `accept` de los ítems de temas con dominio ≥ umbral; `unknown` gana sobre todo.
- `core/whitelist.config.js`: `KNOWN_TOPIC_THRESHOLD` (60, provisional) y `A1_BASE` (265 lemas).
- `tests/whitelistKnown.test.mjs` (56 pruebas, con el `lemmas.json` real y con `createMastery` real).
- `docs/CONTRACTS.md` y `DECISIONS.md`: entradas 1.11-T2. `tools/check-structure.mjs` registra los cuatro archivos nuevos.

Sin pantalla: no hay guion de prueba manual. ¿Afecta contratos? no. No sube la versión (sigue 0.18.0).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.11-T1 (Tokenizador de la lista blanca)

### ADD
- `core/tokenize.js`: `tokenize(text)` (palabras, contracciones, guiones, números, siglas con puntos, letras con cifras; ignora emoji y símbolos; posiciones sobre el texto original; `cap` y `sentenceStart`), `splitContraction(word)` y `TOKEN_KINDS`. Pura, sin tope de largo, tiempo lineal.
- `tests/tokenize.test.mjs` (42 pruebas): CA-1 (`don't`, `well-known`, `U.S.`, `3rd`), CA-4 (vacío y emoji), tabla de contracciones, guiones, números, siglas, invariante de posiciones, invisibles, NFC/NFD, textos hostiles y rendimiento (1 millón de caracteres).
- `docs/CONTRACTS.md` y `DECISIONS.md`: entradas 1.11-T1. `tools/check-structure.mjs` registra los dos archivos nuevos.

Sin pantalla: no hay guion de prueba manual. ¿Afecta contratos? no.

## v0.18.0 — 2026-10-25 — 1.10-T4 (Verificación y cierre de la 1.10)

### ADD
- `tests/ai.ca.test.mjs` (17 pruebas): CA 1 a 5 de la 1.10 con la pila real (fachada, cola, caché, base en memoria, eventos), servidor falso y tiempo falso. Cubre 200, 401, 429, 500, timeout y JSON inválido; caché que evita llamadas (también tras reiniciar el cliente); sin clave no sale nada; reintentos con tope (4 llamadas, ≤ 45 s); y la clave ausente de eventos, caché, resultados y consola.
- `core/ai/providers/groq.js`: `GROQ_FREE_LIMITS` (límites del plan gratuito verificados: 30 por minuto, 1.000 por día, 8.000 tokens por minuto, 200.000 por día).

### CHANGE
- `core/ai/providers/groq.js`: el modelo por defecto pasa de vacío a `openai/gpt-oss-120b`, verificado en la documentación de Groq (`llama-3.3-70b-versatile` se retiró el 16-ago-2026). Un modelo vacío en Ajustes ya no da `no_model`: usa el defecto, y `available()` es verdadero con solo tener clave. Los modelos `openai/gpt-oss-*` reciben `reasoning_effort: 'low'`; los demás no mandan el campo.
- `tests/aiBase.test.mjs`, `tests/aiClient.test.mjs`, `tests/aiRecord.test.mjs`: las pruebas que daban por hecho «modelo vacío → `no_model`» pasan a la nueva regla; pruebas nuevas del modelo por defecto, del razonamiento y de los límites.
- `core/settings.js`: comentario de `aiModel` actualizado (sin cambio de valores).
- Versión 0.17.0 → 0.18.0 (cierra la subparte 1.10). `tools/check-structure.mjs` registra `tests/ai.ca.test.mjs`. Cambian `asset-manifest.json` y `sw.js` (`CACHE_VERSION`).

## Sin versión — 2026-10-25 — 1.10-T3 (Caché, disponibilidad y registro del cliente de IA)

### ADD
- `core/ai/cache.js`: `createCache({ db, clock?, hashFn?, maxEntries?, ttlMs? })` → `{ key, get, set, clear, size, stats }`. Clave = SHA-256 de tarea, mensajes, `json`, esquema, `maxTokens`, `temperature` y modelo (claves ordenadas). Guarda en `generated` con prefijo `aic_` y `kind: 'ai_cache'`; caduca a los 30 días y conserva hasta 500 entradas (borra las más viejas, con desempate por id). Un fallo de la base cuenta en `stats().errors` y se trata como «no hay caché»; un registro dañado o caducado se descarta. `stableStringify`, `hashText`, `CACHE_PREFIX`, `CACHE_KIND`, `CACHE_DEFAULTS`.
- `core/ai/escape.js`: `cleanText` (quita controles y marcas de dirección ocultas), `escapeHtml` (limpia y escapa los símbolos de marcado: ampersand, menor, mayor, comillas, apóstrofo, acento grave y barra) y `escapeDeep` (copia con cada texto y clave escapados; profundidad 12, 5000 nodos; nunca lanza).
- `core/ai/prompts/system.base.js`: `buildSystemPrompt({ level?, json? })` y `SYSTEM_BASE_VERSION` (1). Explica en español, ejemplos en inglés americano, no inventa reglas («Duda:»), el texto de la persona son datos y no órdenes.
- `core/ai/index.js`: `availability()` → `{ available, reason, retryAt? }` (sin red ni efectos; recuerda una clave rechazada y el cupo agotado) y `callRecord(...)`. Opciones de `createAi`: `cache`, `logEvent`, `rateLimitCooldownMs`. Petición: `cache`, `refresh`, `tutor`. Resultado: `cached` y `safe: { text?, json? }`.
- Evento `ai_call` por llamada de red o de caché: tarea, `mode: 'ai'`, `ms` y `responseRaw` = «ok=1 cached=0 attempts=1 tokens=7 est=0 [reason=…]». Sin clave, sin prompt y sin texto.
- `tests/aiCache.test.mjs` (29 casos, varios con barridos) y `tests/aiRecord.test.mjs` (28). Sin red y sin esperas reales.

### CHANGE
- `core/ai/index.js`: `available()` pasa a ser `availability().available`. Se consulta la caché antes de salir a la red (sirve sin conexión); el JSON se guarda ya validado. `tutor: true` antepone el prompt base como primer mensaje.
- `tools/check-structure.mjs`: 5 archivos nuevos. Ninguna versión sube (0.17.0): tramo intermedio. Cambian `asset-manifest.json` y `sw.js` (`CACHE_VERSION`).

### FIX
- `tests/aiClient.test.mjs`: la prueba «un éxito real borra el cierre» pasaba porque el reloj ya había reabierto la IA; ahora usa 50 ms.
- `core/ai/escape.js`: un comentario tenía una palabra que `audit` toma por marca de pendiente; reescrito (0 hallazgos).

## Sin versión — 2026-10-25 — 1.10-T2 (Cola y manejo de errores del cliente de IA)

### ADD
- `core/ai/queue.js`: `createQueue` (concurrencia 2, hasta 50 en espera, tiempo límite 20 s por intento, hasta 3 reintentos con espera exponencial y azar ante `rate_limit`, `server`, `network` y `timeout`; `empty` una sola vez; respeta Retry-After hasta 8 s; tope total 45 s; cancelación en fila, en el intento y en la espera). `backoffDelay`, `checkTimeout`, `QUEUE_DEFAULTS`.
- `core/ai/messages.js`: `friendlyMessage(reason)` y `AI_MESSAGES` (16 motivos, en español).
- `groq.js`: `retryAfterMs(res)` y campo `retryAfterMs` en los fallos 429 y 5xx cuando el servidor manda segundos enteros.
- `tests/aiQueue.test.mjs` (44), `tests/aiClient.test.mjs` (38) y `tests/_aiTime.mjs` (reloj y temporizadores falsos). Sin red y sin esperas reales.

### CHANGE
- `core/ai/index.js`: toda llamada pasa por la cola; un JSON inválido se repara con UN solo reintento; todo fallo trae `error` amable; todo resultado trae `attempts` (y `repaired` si se reparó); petición con `timeoutMs` opcional; `queueStats()`. Motivos nuevos: `timeout`, `queue_full`.
- `tests/aiBase.test.mjs`: el doble usa `maxRetries: 0` (T1 prueba clasificación) y la señal del proveedor ya no es la de quien llama sino una derivada.
- `tools/check-structure.mjs`: 5 archivos nuevos. `docs/ROADMAP.md` pasa a la versión 1.10.

## Sin versión — 2026-10-25 — 1.10-T1 (Base y proveedores del cliente de IA)

### ADD
- `core/ai/index.js`: fachada `createAi({ getConfig, fetchFn, clock? })` → `complete`, `available`, `providerId`; `configFromSettings`, `normalizeRequest`. Sin reintentos, caché ni registro (T2 y T3).
- `core/ai/providers/none.js` (responde `no_ai`, sin red) y `providers/groq.js` (formato OpenAI; endpoint y modelo editables; solo https; clave leída en cada llamada y solo en la cabecera Authorization).
- `core/ai/schema.js`: `parseJson` (cercas, texto alrededor, rechaza dos bloques, `__proto__`/`constructor`/`prototype` y profundidad > 12) y `validate` (esquema pequeño; los motivos no llevan el valor recibido).
- `tests/aiBase.test.mjs` (37 pruebas, `fetch` simulado, ninguna sale a la red).

### CHANGE
- `tools/check-structure.mjs` registra los 5 archivos nuevos. La versión NO sube (0.17.0): tramo intermedio. Cambian `asset-manifest.json` y `sw.js` (`CACHE_VERSION`).

## v0.17.0 — 2026-10-25 — 1.9-T3 (Informativos y cierre de la 1.9)

### ADD
- `core/stats.config.js`: XP por resultado (10 / 7 / 3 / 3) y 8 rangos neutros (Semilla … Bosque), congelados a fondo. Todo PROVISIONAL.
- `core/stats.js` (ampliado): `plannedVsDone` (horas planeadas vs. hechas, solo informativo) y `xpSummary` (XP y rango opcionales; `null` si están desactivados; nunca resta).
- `tests/statsInfo.test.mjs` (22 pruebas, valores calculados a mano) y `tests/statsPerf.test.mjs` (3 pruebas con 50.000 eventos y 50.000 tarjetas).

### CHANGE
- Rendimiento: `dayChecker()` recuerda dentro de cada llamada los días ya validados (sin estado global); con 50.000 eventos cada consulta bajó de 30–50 ms a 5–20 ms.
- Versión 0.16.0 → 0.17.0 (cierra la subparte 1.9). `tools/check-structure.mjs` registra los 3 archivos nuevos. Cambian `asset-manifest.json` y `sw.js` (`sophia-shell-0.17.0-7fff5535`).

### FIX
- Topes contra desbordes a `Infinity` (hallados con un fuzz de datos hostiles): un `ms` mayor que 24 h (`LIMITS.msMax`) no suma, aunque el intento cuenta; un plan de más de 1440 min se ignora; el XP por intento va de 0 a 1000 y el `min` de un rango de 0 a 1 000 000 000 (si no, `Error` en español).

## (sin versión nueva) — 2026-10-25 — 1.9-T2 (Tarjetas y pronósticos)

### ADD
- `core/stats.js` (ampliado): `cardsByLevel` (tarjetas por nivel 1–5), `forecastReviews` (repasos de los próximos 14 días), `retentionReport` (retención real vs. objetivo), `heatmap` (área × nivel con la media de `aggregate`) y `masteryTrend` (serie de dominio por área o nivel a partir de fotos diarias).
- `tests/statsCards.test.mjs` (11 pruebas con resultados calculados a mano; las fechas del pronóstico se construyen en hora local para que pasen en cualquier zona horaria).

### CHANGE
- `tools/check-structure.mjs` registra la prueba nueva. Cambia `CACHE_VERSION`. Versión 0.16.0 sin cambio (falta T3).

## (sin versión nueva) — 2026-10-25 — 1.9-T1 (Actividad y precisión)

### ADD
- `core/stats.js`: funciones puras sobre listas de eventos `answer`: `activityByDay` (minutos e ítems por día), `accuracyByType`, `accuracyByTopic`, `accuracyByArea` (acierto por tipo, tema y área) y `avgTimeByType` (tiempo medio por tipo). Rangos `{ from?, to? }` inclusivos sobre `day`; sin datos devuelven `[]`.
- `tests/stats.test.mjs` (12 pruebas con resultados calculados a mano, vacíos, entradas ilegibles e integración con eventos reales en memoria).

### CHANGE
- `tools/check-structure.mjs` registra los 2 archivos nuevos. Cambia `CACHE_VERSION` (se tocó `core/`). La versión sigue en 0.16.0: la 1.9 no está cerrada (faltan T2 y T3).

## v0.16.0 — 2026-10-25 — 1.8 (Armador de sesiones, cierre en T5)

### ADD
- `tests/session.integration.test.mjs` (3 pruebas con base en memoria, SRS, dominio y errores reales).
- `tests/session.ca.test.mjs` (18 pruebas): los 12 escenarios de la 1.8 (persona nueva, muy atrasada, un solo tema, energía baja, sin contenido, todo pausado, repasos y nuevas, tope de nuevas usado, poco material con repetidas, `topicFocus`, `errorFocus`, con dominio) y los CA 1–6 con oráculos calculados en la propia prueba. Tabla de evidencia en `DECISIONS.md` (sección 1.8-T5).

### CHANGE
- Versión 0.15.0 → 0.16.0 (cierra la subparte 1.8). `tools/check-structure.mjs` registra las 2 pruebas nuevas. Sin cambios en `core/session*.js`: el cierre no encontró fallos del armador.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.8-T4 (progresión y enfoques del armador de sesiones)

### ADD
- `core/sessionProgression.js` (`isProduction`, `masteryIndex`, `productionShare`, `orderByProgression`): reconocimiento → producción según el dominio del tema. «Producción» es la definición de 1.7 (`SIGNAL_P`). Ficha 1.8-T4 en `docs/CONTRACTS.md`.
- `core/sessionFocus.js` (`errorTargets`): puntúa los errores propios (veces × impacto) por ítem o por tema.
- `core/session.js`: parámetros `mastery`, `topicFocus`, `errorFocus` y `errors`; cada ítem del plan trae `production` y `errorScore`; `why` gana `practice` y `error`; `stats.progression`, `stats.errorFocus`, `stats.outOfFocus` y `stats.practice`. `core/session.config.js`: `PROGRESSION` y 3 razones de plan vacío (`topic_empty`, `no_errors`, `errors_no_cards`).
- `tests/sessionFocus.test.mjs` (32 pruebas: progresión, enfoque por tema, enfoque por errores, determinismo y 300 escenarios al azar).

### CHANGE
- `tools/check-structure.mjs` registra los 3 archivos nuevos. Cambia `CACHE_VERSION` (se tocó `core/`).

### Verificación (ejecutada)
- 43 roturas a mano sobre los módulos nuevos y la integración: 35 muertas a la primera, 8 vivas; 5 eran pruebas que faltaban (añadidas) y 3 son equivalentes razonadas en `DECISIONS.md`.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.8-T3 (intercalado y variedad del armador de sesiones)

### ADD
- `core/sessionInterleave.js` (`interleave`, `runExcess`): reordena el plan para que no haya más de 2 ítems seguidos del mismo tema ni del mismo tipo de ejercicio (si hay opciones), prefiere variar el formato dentro de cada tema y altera lo mínimo el orden de urgencia. Ficha 1.8-T3 en `docs/CONTRACTS.md`.
- `core/session.js`: aplica el intercalado al final; cada ítem del plan trae `topic`; `stats.interleave`. `core/session.config.js`: `maxRun`, `interleaveWindows`, `interleaveBudget`.
- `tests/sessionInterleave.test.mjs` (21 pruebas: propiedades con datos semillados, contraste con fuerza bruta, CA 2 dentro de `build`, rendimiento).

### CHANGE
- Dos pruebas de T2 en `tests/session.test.mjs` se ajustan porque las nuevas ahora pueden subir para separar repasos del mismo tema.
- `tools/check-structure.mjs` registra los 2 archivos nuevos. Cambia `CACHE_VERSION` (se tocó `core/`).

### Verificación (ejecutada)
- 39 roturas a mano: primera tanda 22 muertas y 17 vivas (7 eran pruebas que faltaban, añadidas); final 27 muertas y 12 vivas equivalentes razonadas en `DECISIONS.md`. No usé `tools/mutate.mjs` (su especificación no está en el repo).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.8-T2 (nuevas, cupos y energía del armador de sesiones)

### ADD
- `core/session.js`: tarjetas nuevas tras los repasos (tope `newCap − newToday`, sin rescate, máx. 3 temas en curso por área, temas ya empezados primero y luego por prioridad), parámetros `minutes`, `energy`, `newCap`, `newToday` y `areas`, y aplazamiento de ejercicios largos con energía baja. Ficha 1.8-T2 en `docs/CONTRACTS.md`.
- `core/session.config.js`: `newCap`, `maxNewTopicsPerArea`, `itemsPerMinute`, `maxMinutes`, `defaultEnergy`, `ENERGY_LEVELS`, `HEAVY_FAMILIES` y las razones `new_cap_reached` y `energy_deferred`.
- `tests/session.test.mjs`: de 29 a 51 pruebas (22 nuevas de T2).

### CHANGE
- Tres pruebas de T1 se actualizan porque asumían que las nuevas no se ofrecen (ahora van detrás de los repasos).
- Cambia `CACHE_VERSION` (se tocó `core/`).

### Verificación (ejecutada)
- 25 roturas a mano sobre el código nuevo: 21 muertas a la primera, 4 eran pruebas que faltaban (añadidas); segunda tanda 25 de 25. No usé `tools/mutate.mjs` (su especificación no está en el repo); las variantes fueron a mano.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.8-T1 (candidatos y orden base del armador de sesiones)

### ADD
- `core/session.js` (`build({ now, cards, rng, items?, topics?, deprecatedItemIds?, size?, reviewCap?, reviewsToday?, leechThreshold?, retrievability? })` → `SessionPlan` congelado) y `core/session.config.js` (`SESSION_CONFIG`, `EMPTY_REASONS`). Ficha 1.8-T1 en `docs/CONTRACTS.md`.
- Repasos vencidos primero (más atrasado primero), modo rescate (> 1,5 × tope → cupo 0,5 × tope, de menor a mayor retrievabilidad), exclusión de suspendidas, sanguijuelas (marcadas o por fallos), ítems retirados y temas todos `deprecated`, sin duplicados, plan vacío siempre con razón (`no_material`, `only_excluded`, `daily_cap_reached`, `nothing_due`), desempates con `rng` semillado.
- `tests/session.test.mjs` (29 pruebas).

### CHANGE
- `tools/check-structure.mjs`: registra los 3 archivos nuevos. Cambia `CACHE_VERSION` (se tocó `core/`).

### Verificación (ejecutada)
- Roturas (4.R) sobre `core/session.js` con `tools/mutate.mjs`: 89 variantes, 84 muertas, 5 vivas equivalentes razonadas en `DECISIONS.md` (la primera tanda dio 70 muertas y 18 vivas; 11 de ellas eran pruebas que faltaban y se añadieron).

## v0.15.0 — 2026-10-25 — 1.7-T4 (explicabilidad y cierre de la subparte 1.7)

- ADD: `core/masteryExplain.js` (`explain(result, { config?, codeLabels? })` → `{ topicId, summary, lines, text }`, desglose en español para mostrar al tocar el porcentaje); `board.explain(topicId, now?, opts?)`; `EXPLAIN` en `core/mastery.config.js` (`highRetention` 0,8, `lowProduction` 0,5); `tests/masteryExplain.test.mjs` (24 pruebas: textos, topes, escenarios nuevo / que falla / error recurrente / vuelve tras 3 semanas, rendimiento CA 6).
- CHANGE: `compute` añade `ignored` a `detail.R` y `detail.P` (elementos ilegibles descartados). Sin otros cambios de comportamiento.
- Roturas (4.R) sobre `masteryExplain.js`: 47 variantes, 46 detectadas, 1 equivalente razonada en `DECISIONS.md`.
- FIX: `tools/mutate.mjs` dejaba huérfano el proceso hijo de `node --test` al agotarse el tiempo (un `node x.test.mjs` con un bucle infinito gastando CPU por cada ejecución de la suite). Ahora corre en su propio grupo de procesos y lo mata entero. `tests/mutate.test.mjs`: 17 pruebas (+1: «no deja ningún proceso huérfano»).
- Subparte 1.7 HECHA: CA 1–6 comprobados, cada uno con su prueba (tabla de evidencia en `DECISIONS.md`, sección 1.7-T4). Suite completa: 1926 pruebas, 1925 pasan, 1 omitida a propósito.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-25 — 1.7-T3 (agregación y consultas)

### ADD
- `core/masteryAgg.js` (`weightOf`, `aggregate`, `atRisk`, `toStudy`) y `core/masteryBoard.js` (`createMasteryBoard`: caché por tema, `wrapEvents`, `invalidate`, consultas por nivel y área). Ficha 1.7-T3 en `docs/CONTRACTS.md`.
- `tools/mutate.mjs` (93 líneas) y `tests/mutate.test.mjs` (16 pruebas): la herramienta compartida de roturas (4.R.6).
- `tests/masteryAgg.test.mjs` (28) y `tests/masteryBoard.test.mjs` (31).

### CHANGE
- `core/mastery.config.js`: `AT_RISK`, `TO_STUDY`, `LEVELS` (y en `MASTERY_CONFIG`). `tools/check-structure.mjs`: registra los 6 archivos nuevos. Cambia `CACHE_VERSION` (se tocó `core/`).

### Verificación (ejecutada)
- Roturas con `tools/mutate.mjs`: `masteryAgg` 108 (103 muertas, 5 vivas equivalentes), `masteryBoard` 93 (91 muertas, 2 vivas equivalentes). Las vivas, razonadas en `DECISIONS.md`. **`tools/mutate.mjs`: tanda de 52 variantes lanzada pero cortada por tiempo (sin resultados): no verificada.**
- No sube versión (0.14.0).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-24 — 0.9-T3 mitad B de 2 (cierre de la 0.9; una entrega parcial previa a petición de William)

### ADD
- `docs/REPO_MAP.md`, bloque *Convenciones y trampas*: añadido lo histórico (proceso, CSS y seguridad, componentes y vistas, almacenamiento, motores de `core/`), recogido de `PROJECT_STATE.md` y `DECISIONS.md`. No se leyeron las bitácoras ni `CHANGELOG.md` completos: puede faltar algún detalle.
- `tests/check-structure.test.mjs`: 8 pruebas del mapa (archivos obligatorios, creado/modificado/eliminado, documento editado, bloque manual sin invalidar, cabecera rota, `{ map: false }`, lista acortada, CLI).

### CHANGE
- `tools/check-structure.mjs`: exige `docs/REPO_MAP.md` y `docs/REPO_MAP.hashes` y ejecuta `checkMap` (`repo-map --check`); `checkStructure(root, { map = true })`. Un mapa desactualizado hace fallar `npm run check`.
- `PROJECT_STATE.md`: compactado de 281 a ~205 líneas; el tablero, el siguiente paso, los bugs, lo pendiente de William, las preguntas abiertas, la cola de pruebas y el estado de la 1.7 se conservan.

### Verificación (ejecutada)
- 20/20 pruebas de `check-structure`; 8 roturas intencionales de la lógica nueva, 8 detectadas (una viva se cerró reforzando la prueba).
- 10 preguntas de control respondidas solo con el mapa; las firmas de 9 módulos coinciden con `import()`.
- **CA 1–7 de la 0.9 (ejecutados):** 1) `npm run map` dos veces seguidas: mismos bytes en el mapa y las huellas; 2) `--check` en una copia con un archivo creado, uno modificado y uno eliminado lista los tres y sale con 1; 3) `audit` marca `PURPOSE_FALTA` en un archivo sin `@purpose` y da 0 hallazgos en el repo; 4) los 296 archivos están en el mapa (0 ausentes); 5) `tests/repoMap.parse.test.mjs` 99/99 y `tests/repoMap.real.test.mjs` compara los exports del mapa con los reales en ≥ 40 módulos (en la mitad A se comprobaron 107); 6) 10 preguntas respondidas solo con el mapa; 7) `PROJECT_STATE.md` tiene 204 líneas.
- 0.9 HECHA. No sube versión (sigue 0.14.0; 1.7-T4 espera 0.15.0).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-24 — 0.9-T3 mitad A de 2 (primer mapa y secciones descriptivas)

### ADD
- `docs/REPO_MAP.md`: primer mapa del repositorio, generado con `npm run map` (296 archivos, 11 áreas; las secciones automáticas no se editan a mano). Bloques manuales escritos: *Cómo encaja todo* (28 líneas), *Servicios cableados y pendientes de cablear* (incluye el traspaso de 1.7 para 1.7-T3: archivos, contratos de las señales y los 7 datos de T3 verificados de nuevo), *Comandos y verificaciones* y una semilla de *Convenciones y trampas* (11 reglas comprobadas en el código). *Delta del último tramo* escrito.
- `docs/REPO_MAP.hashes`: huellas por archivo que usa `npm run map -- --check` (lo escribe la herramienta).

### CHANGE
- `PROJECT_STATE.md`: el tramo 0.9-T3 se divide en dos mitades (T3a HECHO, T3b SIGUIENTE); cabecera, fila 0.9 del tablero y «Siguiente subparte» al día. Todavía no está compactado (lo hace la mitad B).
- No cambia ningún archivo de código, de pruebas ni del shell: `asset-manifest.json` y `sw.js` no cambian (`CACHE_VERSION` sigue en `sophia-shell-0.14.0-6326a2cd`).

### Verificación del mapa (ejecutada)
- Cobertura: los 296 archivos del repo aparecen en el mapa. Exports: en 107 módulos de `core/`, `app/` y `ui/`, los nombres que lista el mapa coinciden con los de `import()` (0 discrepancias). Rutas e identificadores citados en los bloques manuales comprobados uno a uno. Un error propio corregido antes de entregar: «6 módulos de `core/`» (no 7) importa `app/`.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-24 — 0.9-T2 parte 2 de 2 (`@purpose` en `tests/` y regla en `audit`) · cierra 0.9-T2

### ADD
- `tools/audit.mjs`: regla **`PURPOSE_FALTA`**: todo `.js`, `.mjs`, `.cjs`, `.css` y `.html` (salvo `vendor/` y los `generados` de `tools/repo-map.config.json`) debe llevar `@purpose: <texto>` en sus primeras 12 líneas. Usa `requiresPurpose` y `extractPurpose` de `tools/repoMapParse.mjs`, así que audita con el mismo criterio que el mapa.
- `tests/audit.test.mjs`: 5 pruebas nuevas (cada tipo de archivo con y sin `@purpose`, límite de la línea 12, vacío y CRLF, excepciones y configuración rara, coincidencia exacta con los ⚠ del mapa, y una comprobación del repo real con un recorrido independiente del auditor).

### CHANGE
- Se añade una línea `@purpose` a los **99 archivos de `tests/`** (ayudantes, pruebas, y los de `tests/browser/`). Solo comentarios: una línea nueva por archivo, nada más tocado. Con esto los 227 archivos que faltaban ya la tienen (128 en la parte 1 y 99 aquí); el mapa ya no marca ningún ⚠ por falta de `@purpose`.
- `tests/audit.test.mjs`: el ayudante `run()` ignora `PURPOSE_FALTA` (los archivos de ejemplo de las demás reglas no llevan `@purpose`) y la prueba de la CLI usa un archivo con `@purpose` (el hallazgo pasa de la línea 1 a la 2). Las pruebas de las demás reglas no cambian.
- `asset-manifest.json` y `sw.js` no cambian en esta parte (`tools/` y `tests/` no son parte del shell).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-24 — 0.9-T2 parte 1 de 2 (`@purpose` en el código que no es de pruebas)

### CHANGE
- Se añade una línea `@purpose: <para qué sirve>` a **128 archivos**: `index.html`, `sw.js`, `app/` (15), `core/` (52), `ui/` (51: componentes, vistas y estilos) y `tools/` (8). Solo comentarios: una línea nueva por archivo (en la primera línea; en HTML, justo después de `<!doctype html>`), sin quitar ni tocar nada más. Falta `tests/` (99 archivos) y la regla de `audit.mjs`: parte 2 de 2.
- `npm run build` reescribió `asset-manifest.json` y la línea `CACHE_VERSION` de `sw.js` (`sophia-shell-0.14.0-2526f602` → `sophia-shell-0.14.0-6326a2cd`): es lo esperado, porque cambió el contenido de archivos del shell; el comportamiento no cambió.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-23 — 0.9-T1 Herramienta del mapa

### ADD
- `tools/repoMapParse.mjs`: analizadores puros del mapa (máscara de comentarios, cadenas, plantillas y regex; exports con firma y `kind`; imports; `@purpose`; conteo estático de pruebas; resumen de JSON; resolución de rutas). Guardas contra plantillas anidadas a más de 100 niveles y regex de más de 2000 caracteres.
- `tools/repoMapTree.mjs`: recorrido determinista (NFC, orden por unidad de código, exclusiones), huellas sha1 por archivo, tree-hash y `diffTrees`.
- `tools/repo-map.mjs` y `npm run map`: regenera el mapa y `docs/REPO_MAP.hashes` (solo escribe si cambia), `--check` (`OK <hash>` o lista `+ ~ -`, salida 1), `--root`/`--out`, bloques `MANUAL` conservados, reexportaciones resueltas, salidas 0/1/2.
- `tools/repo-map.config.json`: descripciones de áreas, propósitos de los archivos sin comentario (verificados uno a uno) y `generados`.
- `tests/repoMap.parse.test.mjs`, `repoMap.tree.test.mjs`, `repoMap.map.test.mjs`, `repoMap.real.test.mjs`: parser con formas sintéticas, recorrido y huellas, CLI sobre repos temporales y oráculo contra 94 módulos reales.

### CHANGE
- `package.json`: script `map`. `tools/check-structure.mjs`: los archivos nuevos entran en `REQUIRED_FILES` (`docs/REPO_MAP.md` y `--check` en `check-structure` llegan en 0.9-T3).
- `PROJECT_STATE.md`: roadmap v1.9, fila 0.9 en el tablero (T1 HECHA) y «Siguiente subparte: 0.9-T2». `docs/ROADMAP.md` ya era la copia exacta del roadmap 1.9 (verificada con `cmp`).

## Sin versión (tramo intermedio, no sube versión) — 2026-10-23 — 1.7-T2 Combinación y bandas

### ADD
- `core/mastery.js`: `createMastery(...).compute(topicId, now?)` (pct, banda, confianza, topes por descenso, señal U opcional) y las funciones puras `bandOf`, `combine`, `confidenceOf`, `masteryToSophiaVal`. Contrato `docs/CONTRACTS.md` 1.7-T2.
- `tests/mastery.test.mjs` (30 pruebas: bordes de bandas, pesos y reparto con U nula, confianza, topes, escenarios de estudiante nuevo, que falla y que vuelve, monotonía). `tools/check-structure.mjs`: archivos nuevos en la lista.

## Sin versión (tramo intermedio, no sube versión) — 2026-10-23 — 1.7-T1 Núcleo de señales

### ADD
- `core/mastery.config.js` (pesos, bandas, confianza, descensos y configuración de las señales R, P y E) y `core/masterySignals.js` (`signalR`, `signalP`, `signalE`, `isProduction`). Contrato `docs/CONTRACTS.md` 1.7-T1.
- `tests/masterySignals.test.mjs` (20 pruebas: casos calculados a mano, bordes de ventana, monotonía, FSRS real y registro de errores real en memoria). `tools/check-structure.mjs`: archivos nuevos en la lista.

### CHANGE
- `docs/ROADMAP.md` pasa a la versión 1.7 (sección 17: plan de tramos); `PROJECT_STATE.md` anota versión y sha256, y añade la tabla de tramos.

## v0.14.0 — 2026-10-22 — 1.6 Registro de errores y catálogo de códigos (cierre, cuarto 4 de 4)

### ADD
- Cuarto 1: `core/errorCatalog.js` (`createErrorCatalog`: `has`, `get`, `all`, `hint`, `byTopic`, `incomplete`; entradas inmutables) y `core/errors.js` (`createErrors`: `record` con deduplicación por código + texto normalizado + `itemId`, contador, `kind` que pasa a `systematic` al repetirse e idempotencia por `ts`; `get`, `list`, `count`; `ErrorRecordError`). Campo optativo `seen` en el registro (contrato `docs/CONTRACTS.md` 1.6-1).
- Pruebas: `tests/errorCatalog.test.mjs` (12; fija el CA 1: ≥ 45 códigos, todos los de 8.8, todos completos, temas existentes) y `tests/errors.test.mjs` (30). `tools/check-structure.mjs`: archivos nuevos en la lista.
- Cuarto 2: `core/errors.js` gana `recurrence` (pura), `recurrent`, `top(n, range, { by? })`, `byTopic` y las constantes `RECURRENCE` (3 veces en 14 días), `ORIGINS`, `IMPACTS`; `core/errorHook.js` (nuevo): interfaz del clasificador (`createErrorHook`, `classifyAndRecord`, `cleanVerdict`, `reconcile`; la IA se conecta en 5.5). Pruebas: `tests/errors.recurrence.test.mjs`, `tests/errors.top.test.mjs`, `tests/errorHook.test.mjs`. Contrato `docs/CONTRACTS.md` 1.6-2.
- Cuarto 3, mitad A: `core/errorDetect.js` (detector mecánico por reglas: `detectRules`, `createErrorDetector` con `detect` y `classify`; 30 códigos) y `tests/errorDetect.test.mjs` (40 pruebas). Contrato `docs/CONTRACTS.md` 1.6-3A.
- Cuarto 3, mitad B: `tests/errorDetect.table.test.mjs` (CA 2: 46 frases reales; CA 3: 35 de control) y regla `despite_of`.
- Cuarto 3, roturas (parcial): `tests/errorDetect.lists.test.mjs` (76 grupos palabra por palabra) y `tests/errorDetect.edges.test.mjs` (26 de bordes y posición). Pruebas: 1.600, 1.599 pasan, 0 fallan, 1 omitida a propósito. Roturas COMPLETAS: 1.973 variantes → 1.938 detectadas, 27 vivas (equivalentes o guardas defensivas, razonadas en DECISIONS.md), 6 de sintaxis, 2 de tiempo.
- Cuarto 4: `tests/errors.ca.test.mjs` (7 pruebas: los 5 CA de la 1.6 de punta a punta, detector → hook → registro → ranking, con oráculos independientes: los 45 códigos de 8.8 escritos a mano y la regla frecuencia × peso 1·2·3) y `tests/_errorTable.mjs` (las tablas `REAL` y `CONTROL`, movidas tal cual desde `errorDetect.table.test.mjs` para compartirlas sin duplicar pruebas).
- Cuarto 4: comprobación en IndexedDB REAL (Chromium): `tests/browser/errors-idb.html` + `errors-idb.entry.js` y `python3 tools/idb-check.py errors` (4 pruebas: crear/replay/ocurrencia nueva, cerrar y reabrir, `top` con y sin rango, detector → hook → registro). No forma parte de `npm run check`.
- Prueba nueva en `errorDetect.edges.test.mjs`: el señalamiento de «since last week» (`from`/`to`) con mayúsculas, comillas curvas, emoji, espacios de más y fin de texto.

### FIX
- `TNS.SINCE_FOR` con «last + unidad»: «I live here since last week» señalaba solo «live here since last» (faltaba «week»); lo mismo con «for last week». Ahora cubre la expresión completa (`POINT_END` en `core/errorDetect.js`). La prueba que fijaba el señalamiento corto se corrigió primero (falló), luego el código.

### CHANGE
- Versión 0.14.0 (MINOR por el cierre de la 1.6); `npm run build` regenerado (`sophia-shell-0.14.0-7bfece1e`); versión actualizada en los guiones `0.5.md`, `1.4.md`, `1.5.md` y `HITO_M0.md`.
- Cuarto 2 (decisión del Administrador): `kind` pasa a `systematic` desde la 3.ª ocurrencia (`count ≥ 3`), no desde la 2.ª; el `systematic` explícito se respeta; nunca baja. Cuatro pruebas del cuarto 1 actualizadas.

## v0.13.0 — 2026-10-20 — 1.5 Calificación por acierto + tiempo

### ADD
- Cuarto 1: `core/grading.config.js` y `core/grading.js` (`rate`, `rateDetailed`, `timeClass`, `defaultBaselineMs`, `validateConfig`; tabla de decisión de 120 casos). Cuarto 2: `core/gradingBaseline.js` (mediana personal por tipo, `loadBaselines`). Cuarto 3A: `core/answerTimer.js` (cronómetro que descuenta la pestaña oculta) y `app/visibility.js`.
- Cuarto 3B: `core/gradeAnswer.js` con `gradeAnswer` (respuesta + tiempo → rating → `srs.review` → evento 8.6 válido) y `gradeManual` (4 botones: rating directo). No guarda nada. Una tarjeta suspendida o sanguijuela, o con datos dañados, no pierde la respuesta (`scheduled: false` + motivo); un evento no válido lanza `EventError` antes de tocar la tarjeta. Contrato `docs/CONTRACTS.md` 1.5-3B.
- Cuarto 3B: `ui/components/ratingButtons.js` (`createRatingButtons`: Otra vez · Difícil · Bien · Fácil, con fechas de repaso opcionales, un solo toque califica y el doble toque no repite), textos en `_text.js`, estilos en `widgets.css`, grupo «Calificación manual» en la galería y exportación en `ui/components/index.js`.
- Pruebas nuevas del cuarto 3B: `tests/gradeAnswer.test.mjs` (21) y `tests/ratingButtons.test.mjs` (15). Guion `tests/scenarios/1.5.md` (en cola para el próximo hito; paso opcional añadido a `HITO_M0.md`).

- Cuarto 4 (cierre): `tests/grading.ca.test.mjs` (8 pruebas): los 4 CA del roadmap de punta a punta con un oráculo independiente (800 combinaciones resultado × pista × «no sé» × interrupción × tiempo, con los números 1,8 · 0,6 · 5 escritos aparte de la configuración), también por el puente completo, con el cronómetro real, con la base de datos en memoria (7 datos → constantes, 8 → mediana personal) y un recorrido cronómetro → mediana → `gradeAnswer` → `events.log` → la mediana aprende. `tests/grading.adversarial.test.mjs` (8 pruebas): textos con ñ/emoji/1000 caracteres, ids raros, eventos basura en el cargador de medianas, 50.000 eventos, 5.000 respuestas en la base, reloj del dispositivo cambiado, doble envío, entradas inválidas.

### CHANGE
- Versión 0.13.0 (MINOR: módulos y componente nuevos, sin cambio de contrato 8): `core/version.js`, `package.json`, guiones `0.5.md`, `1.4.md`, `1.5.md` y `HITO_M0.md`. `tools/check-structure.mjs`: archivos nuevos añadidos a la lista. `asset-manifest.json` y `sw.js` regenerados con `npm run build` (`sophia-shell-0.13.0`).

### Cierre (5 pasadas, roadmap 4.3)
- Pasada 1 (estática): sintaxis de todos los `.js`/`.mjs` y todos los `.json` válidos; `audit` 0 hallazgos.
- Pasada 2 (unitarias): suite completa verde (ver el reporte).
- Pasada 3 (escenarios): recorrido simulado de punta a punta en `grading.ca.test.mjs`; guion `tests/scenarios/1.5.md` para el próximo hito.
- Pasada 4 (adversarial): `grading.adversarial.test.mjs`; sin bugs de producción nuevos.
- Pasada 5 (regresión y limpieza): relectura de `gradeAnswer.js`, `ratingButtons.js` y el guion; documentación y versión al día.

## v0.12.0 — 2026-10-20 — 1.4 Motor de repaso espaciado (FSRS)

### ADD
- `vendor/ts-fsrs/` (`index.mjs` sin modificar, `LICENSE` MIT, `VERSION.txt` con origen y sha256): `ts-fsrs` 5.4.1, algoritmo FSRS-6, subido por William.
- `core/srs.js`: `newCard`, `levelOf` (cortes 1/4/21/90 d), `dueLabel` («Repaso en 4 sems»), `review`, `retrievability`, `previewIntervals`, `RATING`, retención configurable y fuzz apagado por defecto (si se enciende, exige semilla). Sin `Math.random` ni `Date.now`.
- `core/srsLeech.js`: sanguijuelas (8 fallos por defecto, configurable): `isLeech`, `markLeech`, `releaseLeech`, `leechList`.
- `core/srsRescue.js`: modo rescate proporcional al tope diario (decisión del Administrador): se activa con más de 1,5 × tope vencidas y el cupo es 0,5 × tope, por defecto 150 y 50; mensaje sin culpa; factores en `RESCUE_FACTORS`.
- `core/srs.simple.js`: motor de respaldo tipo Leitner con la misma interfaz y las mismas tarjetas; `core/srsEngine.js`: fachada `createSrs({ settings })` que elige motor y pasa retención, umbral y tope diario; `core/srsValid.js`: validación compartida.
- Ajuste `srsEngine` (`fsrs` por defecto) y control «Motor de repaso» (Normal / Simple (emergencia)) en Ajustes → Repaso.
- Pruebas: `srs.test`, `srs.fsrs.test`, `srs.care.test`, `srs.simple.test`, `srsEngine.test`, `srs.scenario.test` (recorrido simulado de 120 días con los dos motores, 40 días sin entrar, reloj cambiado, 5000 tarjetas, ids con emoji y de 1000 caracteres). Guion `tests/scenarios/1.4.md`.

### CHANGE
- `core/version.js`, `package.json`: 0.12.0. Guiones `0.5.md` y `HITO_M0.md` con la versión nueva (y la nota del nuevo control en el paso 7). `asset-manifest.json` y `sw.js` regenerados (`vendor/` y los módulos nuevos se precachean).
- `tests/settingsView.test.mjs`: los controles segmentados de Ajustes pasan de 3 a 4 (dos conteos) y una prueba nueva del interruptor.
- `tools/check-structure.mjs`: archivos nuevos añadidos a la lista.

### FIX
- Hallado por el recorrido simulado: una tarjeta repasada por primera vez con el motor simple quedaba con `difficulty: 0` y FSRS la rechazaba al volver a ese motor. Ahora el motor simple fija una dificultad neutra (5) y `review` de FSRS da un error claro si la memoria es inválida.

### Auditoría de cierre (4.3)
- Pasada 1: `--check` a 105 archivos `.js/.mjs` + tests y `JSON.parse` de 9 `.json`: 0 fallos; `audit`: 0 hallazgos; exports revisados a mano y con script.
- Pasada 2: suite completa verde.
- Pasada 3: recorrido simulado de 120 días con los dos motores y cambio a mitad; guion para William en `tests/scenarios/1.4.md`.
- Pasada 4: reloj cambiado (−10 años, +55 años, 1971), 0/1/5000 tarjetas (< 200 ms), ids con acentos, emoji y 1000 caracteres, tarjetas dañadas, ajuste corrupto en disco, sin `Math.random`/`Date.now`. No se pudo hacer captura en pantalla estrecha ni modo oscuro (sin navegador en este entorno): pendiente en `1.4.md`; el CSS de los controles segmentados ya salta de línea.
- Pasada 5: releído línea por línea de lo nuevo; documentos y versión del service worker al día.

## v0.11.3 — 2026-10-19 — C10 Lemas (lote de contenido, tanda 1 de 1)

### ADD
- `content/taxonomy/lemmas.json`: 3.477 lemas del inglés cotidiano (americano) con sus formas flexionadas, en bandas aproximadas 1K/2K/3K; formato `{ schema, version, source, note_es, bands, lemmas: [{ lemma, pos, band, forms }] }`.
- `tests/contentLemmas.test.mjs` (6 pruebas): forma del archivo, ≥ 3.000 lemas únicos, formas irregulares clave, cobertura de palabras muy comunes, modales sin formas inventadas y comprobador a prueba de copias rotas.

### CHANGE
- `core/version.js`, `package.json`: 0.11.3. Guiones `0.5.md` y `HITO_M0.md` con la versión nueva. `asset-manifest.json` y `sw.js` regenerados (el archivo se precachea).

## v0.11.2 — 2026-10-19 — C2 Taxonomía de temas (lote de contenido, tanda 1 de 1)

### ADD
- `content/taxonomy/topics.json`: 248 temas (gram 190, verb 8, prep 13, phr 11, vocab 7, pron 11, spell 8) con prerrequisitos, prioridad 1–5 y etiquetas de lote (`c3`…`c14`); la semilla de 18 temas se conserva.
- `tests/contentCodes.test.mjs` (+1): todo id de `temas_relacionados` existe en `topics.json`.
- Lote C14 (gramática restante) en `PROJECT_STATE.md` por la v1.5 del roadmap.

### CHANGE
- `tests/contentTaxonomy.test.mjs`: la prueba de la semilla de 18 temas se reemplaza por la de la taxonomía completa (igual de exigente; roadmap 1.5, Pista C paso 6).
- `content/taxonomy/error_codes.json`: +23 ids en `temas_relacionados` de 15 códigos.
- `docs/ROADMAP.md` pasa a la v1.5. `core/version.js`, `package.json`: 0.11.2. Guiones `0.5.md` y `HITO_M0.md` con la versión nueva. `asset-manifest.json` y `sw.js` regenerados.

## v0.11.1 — 2026-10-18 — C1 Catálogo de errores (lote de contenido, tanda 1 de 1)

### ADD
- `content/taxonomy/error_codes.json`: 67 códigos (los 45 de 8.8 con su título exacto + 22 nuevos de 7.10: `PASS.FORM`, `REL.WHO_WHOM_WHOSE`, `Q.TAG_FORM`, `COND.UNLESS`, `COND.TYPE3_MIXED`, `WISH.FORM`, `MOD.DEDUCTION_PERFECT`, `REP.REPORTED_SPEECH`, `CAUS.HAVE_DONE`, `INV.NEG_ADV`, `SUBJV.SUGGEST_BE`, `CONN.AS_IF`, `DEG.SO_SUCH`, `FUT.PERF_CONT`, `SUBJ.PRONOUN_CASE`, `ADJ.COMPARATIVE_DOUBLE`, `NOUN.QUANT_FEW`, `PHR.SEPARABLE_PRONOUN`, `LEX.COLLOCATION`, `LEX.WORD_FORMATION`, `SPELL.HOMOPHONE`, `SPELL.ES_INTERFERENCE`), cada uno con `descripcion_es`, `origen_tipico`, `impacto_defecto`, `temas_relacionados`, `ejemplo_malo`, `ejemplo_bueno` y `pista_corta_es`.
- `tests/contentCodes.test.mjs` (+3): catálogo real completo con enumerados válidos, impacto según 7.10 y formato de los temas relacionados.

### CHANGE
- `core/version.js`, `package.json`: 0.11.1 (PATCH: la taxonomía se precachea). Guiones `0.5.md` y `HITO_M0.md` con la versión nueva. `asset-manifest.json` y `sw.js` regenerados.

## v0.11.0 — 2026-10-18 — 1.3 Esquemas de contenido, validador y cargador de paquetes (CUARTO 4 de 4, mitad 4B: `add-pack`; CIERRE)

### ADD
- `tools/add-pack.mjs` + script `npm run add-pack` (`package.json`): valida con `validateContent`, todo o nada, copia a `content/packs/`, regenera `content/index.json` ordenado, política de versiones, `--dry-run`, `--quiet`, `--force --reason`, escritura atómica con deshacer, sin enlaces simbólicos.
- `docs/ADD_PACK.md` (1 página: pasos, significado de los mensajes con ejemplos reales, 5 errores comunes).
- `tests/add-pack.test.mjs` (18): CA 6 de la 1.3, seguridad (`..`, enlaces, índice dañado), deshacer ante fallo de disco, CLI real, e idempotencia por huella; el CA 7 ejecuta los comandos del documento.
- `docs/CONTRACTS.md` 1.3-4B; `DECISIONS.md` (7 entradas); `check-structure` exige `add-pack.mjs`, `ADD_PACK.md`, `contentImport.js` y sus pruebas.

### CHANGE
- `core/version.js`, `package.json`: 0.11.0 (cierra la 1.3). Guiones `0.5.md` y `HITO_M0.md` con la versión nueva. `asset-manifest.json` y `sw.js` regenerados.

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (CUARTO 4 de 4, mitad 4A, parte 2: importación a la base)

### ADD
- `core/contentImport.js`: `importPackToDb` (tarjetas nuevas con los valores de 8.4, `deprecated` en `content_cache`, reactivación, una transacción por paquete, versión menor no retrocede), `deprecatedItemIds`, `cardIdOf`, `initialCard`.
- `core/content.js`: `importPacksToDb(db, fetchFn, opts)` (índice → paquetes → base; no vuelve a descargar lo ya importado) y reexportaciones.
- `tests/contentImport.test.mjs` (23): caso feliz, idempotencia, progreso intacto, migración v1→v2→v3, versión menor, ítems compartidos, atomicidad, entradas hostiles, registro dañado, rendimiento (5.000 ítems), reloj y `importPacksToDb`.
- `docs/CONTRACTS.md` 1.3-4A (parte 2); `DECISIONS.md` (7 entradas); `PROJECT_STATE.md` pregunta 9.

### CHANGE
- `asset-manifest.json` y `sw.js` regenerados con `npm run build` (`core/` se precachea).

## v0.9.2 — 2026-10-17 — Corrección del hito M0: BUG 3 (la hoja no se cerraba arrastrando el asa)

Solo corrección (PATCH). Queda pendiente el BUG 1 del hito M0 y el pulido visual a–d (ver `PROJECT_STATE.md`).

### ADD
- `tools/sheet-check.py` (opcional, Chromium real con TOQUES del protocolo del navegador, como un dedo): en las dos hojas de la galería comprueba que arrastrar 220 px la cierra, que 30 px lentos no, que un gesto rápido de 60 px la cierra, que agarrar por la zona de agarre (no solo por la barrita) también cierra, y que la zona mide ≥ 44 px.
- `tests/design.test.mjs` +2: la zona de agarre usa `--touch-min` y no se solapa con el encabezado; la hoja fija de la galería tiene `.sheet__grab` y el arrastre cableado con `dragDecision`.

### CHANGE
- `core/version.js`, `package.json`: 0.9.2. `tests/scenarios/HITO_M0.md`: versión 0.9.2 y el paso 13 avisa de que hay DOS botones "Abrir hoja" y que se prueban ambos.
- `ui/styles/widgets.css`: la zona de agarre de la hoja pasa de 24 a 44 px (`--touch-min`). La barrita queda donde estaba y el título baja unos 16 px.

### FIX
- `ui/styles/demo.html` y `ui/styles/demo-components.js`: la hoja fija de la sección "Hojas inferiores y avisos" (HTML de la 0.3) no tenía NINGÚN arrastre: solo `demo.js` abría y cerraba, así que arrastrar el asa no podía cerrarla. Ahora tiene zona de agarre y el mismo arrastre (misma decisión `dragDecision`) que la hoja real.
- `ui/styles/widgets.css`: la zona de agarre de la hoja real era de solo 24 px; con un dedo en el teléfono era fácil fallar la barrita y que no pasara nada.

## v0.9.1 — 2026-10-17 — Corrección del hito M0: BUG 2 (la galería se quedaba en "Cargando…")

Solo corrección (PATCH). Quedan pendientes los BUG 1 y 3 del hito M0 y el pulido visual a–d (ver `PROJECT_STATE.md`).

### ADD
- `tests/sw.test.mjs`: prueba que reproduce el BUG 2 (falla sin la corrección): navegar a `ui/styles/demo.html` (con y sin `?tema=`), a un PDF, a una página inexistente y sin conexión muestra esa página o el error real, nunca el index de la app; la raíz, `index.html` y rutas sin extensión siguen sirviendo la app.
- `tools/pwa-check.py`: comprueba en Chromium real, con el service worker activo, que `demo.html` abre "Galería de componentes" y que la app sigue abriendo en la raíz.

### CHANGE
- `core/version.js`, `package.json`: 0.9.1. `tests/scenarios/HITO_M0.md`: versión 0.9.1 y, en el paso 12, "actualiza la app antes de abrir la galería, en el mismo Chrome".
- `tools/pwa-check.py`: la pantalla de inicio puede ser "Hoy" o la bienvenida (desde la 0.8 la primera visita lleva a la bienvenida; la herramienta seguía esperando "Hoy" y fallaba 2 comprobaciones desde entonces).

### FIX
- `sw.js`: el service worker devolvía el index de la app para CUALQUIER navegación dentro de su alcance, así que `ui/styles/demo.html` cargaba el index con rutas relativas rotas y se quedaba en "Cargando…" (solo en el Chrome donde la app está instalada; en incógnito no hay service worker). Ahora solo la raíz, `index.html` y las rutas sin extensión reciben el index; una página con extensión se sirve como cualquier archivo (caché si está, si no la red, y 503 legible sin conexión).

## v0.9.0 — 2026-10-17 — 1.1 Registro de eventos (CUARTO 4 de 4, mitad B: cierre)

Cierra la 1.1. `VERSION` y `package.json` pasan de 0.8.0 a 0.9.0.

### ADD
- `tests/events.cierre.test.mjs`: los 4 criterios de aceptación de la 1.1 comprobados de punta a punta con la API pública (inválidos con mensaje que nombra el campo y sin escribir; 10.000 llamadas con ids únicos; día local en medianoche, extremos de zona y cambio de hora; consultas por rango por índice con rango).

### CHANGE
- `core/version.js`, `package.json`: 0.9.0. `tests/scenarios/HITO_M0.md`: la versión que se ve en "Más" es ahora 0.9.0.

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 4 de 4, mitad A: inmutabilidad y `clearAll`)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (mitad B del cuarto 4: revisión de los 4 criterios y paso a 0.9.0).

### ADD
- `core/events.js`: `clearAll()` → número de eventos borrados; único camino para quitar eventos. Una sola transacción sobre `events` (todo o nada); no toca otros almacenes.
- `tests/_eventsContract.mjs`: 8 pruebas nuevas (borra todo y deja los 6 índices vacíos, borra los 9 tipos de evento, sobre vacío devuelve 0, solo toca `events`, el registro sigue usable, base cerrada, API sin `update`/`delete` y congelada, volumen de 10.000). Corren en memoria y en IndexedDB real.
- `tests/events.test.mjs`: 4 pruebas independientes del motor (atomicidad ante cuota llena, una sola transacción sobre `events`, fallo crudo clasificado, 10.000 eventos).
- `docs/CONTRACTS.md` 1.1-4A y 4 decisiones en `DECISIONS.md`.

### CHANGE
- `core/events.js`: `createEvents` devuelve un objeto **congelado** (nadie puede añadirle ni cambiarle métodos).

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 3 de 4, mitad B: `countByDay`, `recentErrorsByCode` y volumen de CA-4)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (cuarto 4, pasará a 0.9.0).

### ADD
- `core/events.js`: `countByDay(range)` → `{ "AAAA-MM-DD": n }` por día local, sin días vacíos, por el índice `day`; y `recentErrorsByCode(code, { since, order, limit })` por el índice `ts` filtrando `errorCodes` (que no tiene índice). `BAD_QUERY` para argumentos no válidos.
- `tests/_eventsContract.mjs`: 13 pruebas nuevas (conteo por día, rango inclusivo, medianoche, Date/ms, día guardado, copias, argumentos inválidos, base cerrada; errores recientes con empates, `since` inclusivo, `limit` después de filtrar, copias, argumentos inválidos) y la prueba de volumen de CA-4 (50.000 eventos, resultados exactos contra una referencia calculada aparte, tiempos). Corren en memoria y en IndexedDB real.
- `tests/events.test.mjs`: 6 pruebas independientes del motor (una sola consulta por índice y con rango; argumento inválido no toca la base; agrupar y filtrar con filas desordenadas; fallo crudo clasificado; día local en Bogotá, Kiritimati, Pago Pago y cambio de hora de Nueva York).
- `docs/CONTRACTS.md` 1.1-3B (incluye la tabla de costes medidos) y 7 decisiones en `DECISIONS.md`.

### CHANGE
- `tools/idb-check.py`: espera hasta 300 s (antes 120 s); la corrida de `events` con 50.000 eventos tarda ≈ 120 s y estaba en el límite.
- `core/events.js`: `readOpts` admite opciones extra por consulta (solo `since` en `recentErrorsByCode`); las demás consultas siguen rechazando cualquier opción desconocida.

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 3 de 4, mitad A: consultas por tarjeta, ítem, tema y fecha)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (cuarto 4, pasará a 0.9.0). Faltan `countByDay` y `recentErrorsByCode` (mitad B del cuarto 3).

### ADD
- `core/events.js`: `byCard`, `byItem`, `byTopic` y `since` (con `order` y `limit`), por índices de `events`; orden por `ts` y luego `id`; errores `BAD_QUERY` para argumentos no válidos.
- `tests/_eventsContract.mjs`: 8 pruebas de consultas (orden y empates, temas múltiples, null no indexado, `desc` + `limit`, `since` inclusivo con Date/ms/ISO, copias, argumentos inválidos, base cerrada); corren en memoria y en IndexedDB real.
- `tests/events.test.mjs`: 2 pruebas de consultas independientes del motor (el orden no depende de cómo el motor devuelva las filas; fallos crudos de la base se clasifican).
- `docs/CONTRACTS.md` 1.1-3A y 5 decisiones en `DECISIONS.md`.

### CHANGE
- —

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 2 de 4, mitad B: `log` sobre IndexedDB real)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (cuarto 4, pasará a 0.9.0). Con esto el cuarto 2 queda cerrado.

### ADD
- `tests/_eventsContract.mjs` (7 pruebas de `log`: evento completo e índices, inválido sin escribir, no pisa un id ocupado, dos instancias con el mismo azar, volumen, cerrar y reabrir, base cerrada), corrido contra memoria (`tests/events.contract.test.mjs`, 10.000 llamadas) y contra IndexedDB real en Chromium (`tests/browser/events-idb.entry.js` y `.html`, 2.000 llamadas).
- `tools/idb-check.py events`: corre ese contrato en Chromium (sin argumento sigue corriendo la suite de la 0.7).
- Prueba de `log` en modo "solo memoria" (`openDatabase` sin IndexedDB) en `tests/events.test.mjs`.

### CHANGE
- `DECISIONS.md` y `docs/CONTRACTS.md`: la 1.2 AMPLÍA `createWordDiff` (0.5) con los 5 estados `ok | close | wrong | missing | extra`, sin adaptador (decisión del Administrador).

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 2 de 4, mitad A: `log` atómico)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (cuarto 4, pasará a 0.9.0). Faltan: mitad B del cuarto 2 (si queda algo por cerrar), cuarto 3 (consultas) y cuarto 4.

### ADD
- `core/events.js`: `createEvents({ db, clock, rng, idGen })` → `{ log }`. Valida y construye antes de abrir la transacción; escribe en `db.tx(['events'])` comprobando que el id no exista (nunca pisa un evento; pide otro id hasta 5 veces); errores de base como `DbError`, evento inválido como `EventError`.
- `tests/events.test.mjs` (16 pruebas): evento completo y copia, `ts` del reloj o de la entrada, inválidos sin escribir, error sin texto de la persona, cuota llena, base cerrada o sin abrir, id ya existente (no pisa), 5 choques → `ABORTED`, dos instancias con el mismo azar, 10.000 llamadas en el mismo ms, ráfaga con un fallo, cerrar y reabrir, zona horaria, error crudo de la base, transacción solo sobre `events`.
- `docs/CONTRACTS.md` 1.1-2; `DECISIONS.md`: las 5 decisiones del Administrador y las de este cuarto.
- `tools/check-structure.mjs`: exige `core/events.js` y `tests/events.test.mjs`.

### CHANGE
- Energía de la bienvenida: `low | mid | high` (antes `medium`), por decisión del Administrador: `ui/views/onboarding.js`, `tests/onboarding.test.mjs` y `docs/CONTRACTS.md`.
- `docs/CONTRACTS.md` 1.1-1: `mode ∈ mech | ai` y los obligatorios por tipo pasan de provisionales a confirmados.

### FIX
- —

## v0.8.0 (sin cambio de versión) — 2026-10-17 — 1.1 Registro de eventos (CUARTO 1 de 4: esquema y validación)

`VERSION` sigue en 0.8.0 hasta cerrar la 1.1 (cuarto 4, pasará a 0.9.0). `core/events.js` (registro y consultas) llega en los cuartos 2 y 3.

### ADD
- `core/eventSchema.js`: `validateEvent` (estricta, nunca lanza; copia normalizada con los 18 campos; `{ stored: true }` para eventos ya guardados), `buildEvent` (ts del reloj, `day` local, id), `createIdGenerator` / `makeEventId` (IDs únicos), `EventError` con ruta del campo.
- `tests/eventSchema.test.mjs` (31 pruebas): 55+ casos inválidos tabulados, entradas absurdas, fuzz de 3.000 objetos, medianoche y cambios de zona y de hora (Bogotá, Madrid, Kolkata, Auckland, Nueva York…), 10.000 IDs en el mismo ms, rendimiento, entradas hostiles (getters y Proxy que fallan) y fechas fuera de rango.
- `tools/check-structure.mjs`: exige los dos archivos nuevos.

### CHANGE
- —

### FIX
- —

## v0.8.0 — 2026-10-17 — 0.8 Ajustes, bóveda de claves y onboarding mínimo (CUARTO 4, mitad B: cierre; HITO M0)

Cierra la 0.8 y con ella el hito M0 (solo faltan las pruebas manuales de William en teléfono real).

### ADD
- Ruta `#/bienvenida` (vista `onboarding`, sin pestaña activa) en `app/router.js` y `app/shell.js`.
- `app/firstRun.js` (`startFirstRun`, `isFrontDoor`): al abrir la app sin haber visto la bienvenida, la muestra una sola vez; respeta enlaces a propósito. Cableado en `app/main.js`.
- Tarjeta **Bienvenida** en Ajustes con el botón "Repetir bienvenida".
- `router.navigate(name, params, { replace })`: reemplaza la entrada del historial.
- `tests/firstRun.test.mjs` (16), `tests/main.test.mjs` (5, importa el `main.js` real), pruebas nuevas en `router`, `settingsView` y `onboarding`.
- `tests/scenarios/0.8.md`: guion de William (bienvenida, ajustes, claves, respaldo, repetir bienvenida y borrar todo).

### CHANGE
- `VERSION` y `package.json` pasan a 0.8.0.
- La bienvenida sale a "Hoy" reemplazando su entrada del historial ("Atrás" no vuelve a ella).
- `ui/views/settings.js`: 10 tarjetas. `ROUTES`: 10 rutas.
- `tools/check-structure.mjs`: exige los archivos de la 0.8.
- `docs/DEPLOY.md`: dónde ver la versión en Ajustes.

### FIX
- —

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 4, mitad A: vista de bienvenida)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. La vista aún no está conectada al primer arranque ni a Ajustes (mitad B).

### ADD
- `ui/views/onboarding.js`: 3 pantallas saltables (bienvenida + nombre opcional, energía opcional, "Sin rachas, sin culpa").
- `tests/onboarding.test.mjs` (22 pruebas).

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 3, mitad B: tarjetas Respaldo, Claves y Zona de peligro)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. Con esto el cuarto 3 queda completo.

### ADD
- `ui/views/settingsData.js`: tarjetas Respaldo (exportar con casilla "incluir mis claves", importar con confirmación), Claves (borrar con confirmación) y Zona de peligro (borrar todo escribiendo BORRAR).
- `app/fileIO.js`: descarga de archivo y selector de archivo, inyectables.
- `tests/settingsData.test.mjs` (14 pruebas) y `tests/fileIO.test.mjs` (4).

### CHANGE
- `ui/views/settings.js`: 9 tarjetas; lee `db` de `storageReady`; acepta `sync`, `dataTools`, `fileIO` y `toast` en `services` para pruebas.
- `tests/settingsView.test.mjs`: la prueba de títulos espera las 9 tarjetas.

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 3, mitad A: respaldo y borrado, sin pantalla)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. La pantalla de estas funciones llega en la mitad B.

### ADD
- `core/sync.js` (provisional hasta la 1.12): `createSync` con `exportBackup` / `importBackup`, `backupFilename`.
- `app/dataTools.js`: `createDataTools` con `clearKeys`, `wipeAll` (atómico) y `afterRestore`.
- `tests/dataTools.test.mjs` (13 pruebas).

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 2, mitad B: pantalla de ajustes)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. Con esto el cuarto 2 queda completo.

### ADD
- `ui/views/settings.js`: pantalla `#/ajustes` con 6 tarjetas (Apariencia, Repaso, Sonido y vibración, Inteligencia artificial, Pronunciación (Azure), Acerca de). Guarda al instante con `settings.set`; si falla, el control vuelve al valor real y muestra el texto amable. Refleja cambios hechos desde fuera. Clave de IA con `createKeyField`; Azure presente pero deshabilitado ("Se activa en la Fase 8").
- `tests/settingsView.test.mjs` (18 pruebas).

### CHANGE
- `app/shell.js`: `VIEWS.ajustes` ahora apunta a `ui/views/settings.js`.

### REMOVE
- `ui/views/ajustes.js` (el marcador de posición de la 0.4).

### FIX
- —

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 2, mitad A: campo de clave y apariencia en vivo)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. Aún no hay pantalla de ajustes (es la mitad B del cuarto 2).

### ADD
- `ui/components/keyField.js` (`createKeyField`, exportado en `components/index.js`): campo de clave con mostrar/ocultar lo escrito, guardar y borrar. La clave ya guardada nunca vuelve al campo; si guardar falla se muestra solo el texto amable y se conserva lo escrito; en consola solo va el código del error.
- `app/appearance.js` (`createAppearance`, `resolveTheme`, `applyTextSize`): aplica tema y tamaño de texto al arrancar y en vivo desde `settings.onChange`; con tema "auto" sigue al sistema en vivo.
- `app/settingsBoot.js` (`startSettings`): crea y carga `settings` sobre la base (o en memoria si no abrió) y aplica la apariencia. `app/main.js` lo cablea: `services.settingsReady`, `services.settings`, `services.appearance`.
- `ui/styles/base.css`: reglas `html[data-text-size]` (87,5 % · 100 % · 112,5 % · 125 %, se suman al tamaño de letra del sistema). `ui/styles/components.css`: `.key-field`.
- `tests/keyField.test.mjs` (15), `tests/appearance.test.mjs` (9).

### CHANGE
- `ui/components/_text.js`: cadenas de `keyField`.

### FIX
- (propios de este cuarto, cazados por las pruebas nuevas antes de entregar) `keyField` pasaba un texto donde iba un booleano al bloquear el campo, y perdía `aria-pressed="false"` del botón Mostrar/Ocultar.

### REMOVE
- —

## v0.7.0 (sin cambio de versión) — 2026-10-17 — 0.8 Ajustes (CUARTO 1: núcleo de ajustes)

`VERSION` sigue en 0.7.0 hasta cerrar la 0.8. La app aún no usa este módulo.

### ADD
- `core/settings.js` (`createSettings`): 17 ajustes con valores por defecto y validación por rangos (retención 0,80–0,95, defecto 0,90; sanguijuela 3–20, defecto 8; etc.), persistencia en `settings`, cambios en vivo (`onChange`, `onAnyChange`), `setMany` de todo o nada, `reset`/`resetAll`, `clearSecrets`, `snapshot()` con secretos ocultos.
- `tests/settings.test.mjs` (14 pruebas).

### CHANGE
- —

### FIX
- —

### REMOVE
- —

## v0.7.0 — 2026-10-17 — 0.7 Capa de almacenamiento (CIERRE: B2b)

### ADD
- `app/storage.js` (`startStorage`): abre la base al arrancar, muestra el aviso persistente "solo memoria" (botón "Entendido") y gestiona `persist()`: la "primera sesión real" la marca `markSessionDone()` (la llamará el ejecutor de sesión, 2.1).
- `app/main.js`: cablea `startStorage({ name: DB_NAME })`; las vistas reciben `services.storageReady`, `services.storage` y `services.db`.
- `tests/storage.test.mjs` (8 pruebas), `tests/scenarios/0.7.md`.

### CHANGE
- `app/shell.js`: `startApp` devuelve también `services` (el mismo objeto que reciben las vistas).
- `VERSION` 0.7.0; tablero 0.7 → HECHA.

### FIX
- —

### REMOVE
- —

## v0.6.0 (sin cambio de versión) — 2026-10-17 — 0.7 Almacenamiento (MITAD B2a: selección de motor y persist())

### ADD
- `core/dbOpen.js` (`openDatabase`): IndexedDB si hay; si no hay o está bloqueada (`UNAVAILABLE`) cae a memoria con `warning` amable. Otros errores se propagan (no se esconden datos reales).
- `core/persist.js` (`requestPersistence`): pide `navigator.storage.persist()` una vez tras la primera sesión real y guarda el resultado en `meta.persistRequest`; no insiste.
- `tests/dbOpen.test.mjs` (9 pruebas). `tools/check-structure.mjs` lista los tres archivos de la 0.7B.

## v0.6.0 (sin cambio de versión) — 2026-10-17 — 0.7 Almacenamiento (MITAD B1: motor IndexedDB real)

`VERSION` sigue en 0.6.0. Falta la B2 (`persist()` y aviso "solo memoria"). La app aún no usa estos módulos.

### ADD
- `core/db.idb.js`: motor sobre IndexedDB real con el mismo contrato que `db.memory.js`. Registros en "sobre" `{k, v, x}`; claves de índice calculadas por `indexKeys` (misma semántica que memoria); migración dentro de la transacción de cambio de versión (si falla, se aborta y todo queda como estaba); cola FIFO; `tx` en una sola transacción de IndexedDB; reapertura automática tras `versionchange`.
- `tools/idb-check.py` y `tests/browser/` (`idb-contract.html`, `idb-contract.entry.js`, reemplazos de `node:test`, `node:assert/strict`, `node:fs|os|path`): corren la suite de contrato `tests/_dbContract.mjs` en Chromium real.

### CHANGE
- `tests/db.contract.test.mjs`: la nota de IndexedDB ahora apunta a `tools/idb-check.py`.

### FIX
- —

### REMOVE
- —

## v0.6.0 (sin cambio de versión) — 2026-10-17 — 0.7 Almacenamiento (MITAD A: contrato, motor en memoria, migraciones)

`VERSION` sigue en 0.6.0 hasta cerrar la 0.7 (la caché del shell cambia igual: `sophia-shell-0.6.0-<hash>`). La app aún no usa estos módulos.

### ADD
- `core/db.js`: esquema `STORES` (8.13), `SCHEMA_VERSION`, validación de registros, reglas de consulta (`compileQuery`/`runQuery`), `buildExport`, `prepareImport`, `planImport`.
- `core/dbErrors.js`: `DbError` (códigos, texto amable en español, `retryable`) y `classifyError`.
- `core/db.memory.js`: motor en memoria con transacciones atómicas, índices (incluido multi), cuota simulada, `disk` para reabrir/migrar.
- `core/migrations.js`: `runMigrations` puro, `checkMigrations`, lista real `MIGRATIONS` (vacía: la v1 es la inicial).
- `core/clock.js` (`now` = `Date`, día local), `core/rng.js`, `core/store.js` (estado + pub/sub).
- `tests/_dbContract.mjs` + `tests/db.contract.test.mjs`: 42 pruebas de contrato contra el motor en memoria (la de IndexedDB figura OMITIDA hasta la mitad B); `tests/clock-rng.test.mjs`, `tests/store.test.mjs`, `tests/migrations.test.mjs`.
- `docs/CONTRACTS.md`: ampliación 0.7A.

### CHANGE
- `tools/check-structure.mjs` exige los archivos nuevos; `asset-manifest.json` y `sw.js` regenerados.

## v0.6.0 — 2026-10-17 — 0.6 PWA (MITAD B: registro, aviso de actualización y guía de despliegue)

Cierra la 0.6. `VERSION` pasa a 0.6.0 (la caché del shell pasa a `sophia-shell-0.6.0-<hash>`).

### ADD
- `app/swRegister.js`: `swPolicy` (pura) y `registerServiceWorker`. Registra `sw.js` tras `load`; versión nueva en espera → aviso; "Actualizar" manda `SKIP_WAITING` y recarga UNA vez al `controllerchange`; nunca recarga sola; distingue versión nueva, contenido nuevo, versión MÁS ANTIGUA y "actualizada en otra ventana"; busca versión al volver a la app (máx. cada 30 min); primera visita: "Lista para usar sin conexión.".
- `ui/components/updateNotice.js` (+ estilos `.update-notice`): aviso persistente con botones "Actualizar" / "Ahora no".
- `docs/DEPLOY.md` (guía para William: repo, subida con GitHub Desktop o navegador por tandas, Pages, instalar, modo avión, actualizar, qué hacer si queda la versión vieja, aviso de que borrar datos borra el progreso) y `tests/scenarios/0.6.md`.
- `.nojekyll` (sin él GitHub Pages oculta los archivos que empiezan con `_` y la app no abre).
- `tests/swRegister.test.mjs` (25 pruebas) y 1 prueba nueva en `tests/shell.test.mjs`.
- `tools/pwa-check.py`: parte 2 en Chromium real con el registro desde `main.js` (19 comprobaciones nuevas).

### CHANGE
- `app/main.js` registra el SW (resuelve la marca de pendiente de la 0.4); `index.html` enlaza `manifest.webmanifest`; `app/shell.js` devuelve también `toastStack`; `ui/components/index.js` exporta `createUpdateNotice`.
- `core/version.js` y `package.json`: 0.6.0. `tools/check-structure.mjs` exige los archivos nuevos.

## v0.5.0+0.6A — 2026-10-17 — 0.6 PWA (MITAD A: manifest, iconos, caché y service worker)

La versión de la app sigue en 0.5.0: el service worker todavía NO se registra (eso es la mitad B), así que el comportamiento de la app no cambia. `VERSION` pasará a 0.6.0 al terminar la 0.6.

### ADD
- `manifest.webmanifest` (standalone, `start_url`/`scope`/`id` relativas, colores Aurora, iconos 192/512 y maskable 512).
- `icons/`: icono original con la mascota "Chispa" (SVG + PNG 192, 512 y maskable 512) y `tools/make-icons.py` (opcional, regenera los iconos).
- `sw.js`: precache del shell leyendo `asset-manifest.json` (`cache: 'reload'`, sin caché a medias, rechaza una subida a medias), stale-while-revalidate para `content/packs/*`, audio con tope de 60 y sin tocar Range, nunca intercepta otros orígenes ni `sw.js`/manifest, nueva versión en espera (sin `skipWaiting` automático; acepta `SKIP_WAITING` y `GET_VERSION`).
- `tools/build-manifest.mjs` (`npm run build` / `--check`): `asset-manifest.json` determinista (hash por archivo, sin fechas) y nombre de caché `sophia-shell-<VERSION>-<hash8>` escrito en `sw.js`.
- `app/versionCompare.js` (pura): `compareVersions`, `isNewerVersion`, `cacheVersionName`, `parseCacheVersion`, `updateKind`.
- `tools/pwa-check.py` (opcional, Chromium real): instala el SW bajo `/sophia/`, recarga sin conexión, comprueba actualización en espera sin recarga, `SKIP_WAITING`, borrado de la caché vieja y rechazo de subida a medias (14 comprobaciones).
- Pruebas: `sw` (11, ejecuta el `sw.js` real con cachés/red falsas), `build-manifest` (9), `pwa` (5), `versionCompare` (4).

### CHANGE
- `package.json`: script `build`. `tools/check-structure.mjs`: exige los archivos nuevos de 0.5 y 0.6A.
- **Proceso nuevo:** tras tocar cualquier archivo del shell hay que ejecutar `npm run build`; si no, la prueba "asset-manifest al día" falla (es a propósito: evita publicar una caché que no coincide con el código).

## v0.5.0 — 2026-10-16 — 0.5 Biblioteca de componentes UI reutilizables

### ADD
- `ui/components/`: `button`, `chip`, `badge`, `card`, `sheet` (arrastre), `modal`, `confirmDanger`, `progressBar` (ranura de mascota), `mascot` (SVG original "Chispa": neutral/happy/thinking), `tabs`, `segmented`, `toggle`, `slider`, `textInput` (modo `exercise`), `emptyState`, `skeleton`, `wordChip`, `wordDiff`; `index.js` (punto único de importación); internos `_shared.js`, `_overlay.js`, `_text.js`.
- `ui/styles/widgets.css` (estilos de los componentes; se carga después de `components.css`), `ui/styles/demo-components.js` y sección "Biblioteca de componentes" en la galería.
- `tests/ui-components.test.mjs` (23 pruebas) y `tests/scenarios/0.5.md`. `docs/DESIGN.md` secciones 12–13 y `docs/CONTRACTS.md` ampliación 0.5.

### CHANGE
- `index.html` y `demo.html` cargan `widgets.css`. `tests/_fakeDom.mjs`: `document` ahora admite eventos (cuenta en `stats.live()`). `tools/contrast.mjs`: dos comprobaciones nuevas (barra de peligro e interruptor encendido); tabla de `DESIGN.md` regenerada.
- Tests de diseño e `index` incluyen `widgets.css` en sus listas.

### FIX
- (Hallado por las pruebas antes de entregar) `slider`: sin callback `onInput`/`onChange` el valor y el relleno no se actualizaban.
- (Hallado por `visual-check`) el botón "?" de la insignia de nivel medía 20 px; ahora es un botón real de 44 px.

## v0.4.0 — 2026-10-16 — 0.4 Shell de la app, router y ciclo de vida de vistas

### ADD
- `index.html` (CSP de 8.16 en meta, sin código en línea), `app/main.js`, `app/shell.js` (arranque, vistas, errores globales, desplazamiento y foco), `app/router.js` (hash, rutas, `resolveHash`/`buildHref`/`createRouter`), `app/theme.js`, `app/boot-check.js` (red de seguridad si la app no arranca).
- `ui/dom.js` (`h`, `hs`, `esc`, `on`, `qs`; rechaza innerHTML y URLs `javascript:`), `ui/views/_viewBase.js` (`createView`), vistas provisionales: hoy, mapa, practicar, errores, mas, sesion, tema, ajustes, notFound.
- `ui/components/bottomNav.js`, `toast.js`, `errorBoundary.js`; estilos `.app-shell`, `.app-main`, `.bottom-nav` en `components.css`.
- Pruebas: `dom`, `router`, `view`, `components`, `shell`, `index` (94 nuevas) y `tests/_fakeDom.mjs`; `tests/scenarios/0.4.md`.

### CHANGE
- `tools/check-structure.mjs`: exige los archivos de 0.4. `core/version.js` y `package.json`: 0.3.0 → 0.4.0. `docs/DESIGN.md`: sección de estructura y navegación.

### FIX
- —

### REMOVE
- —

## v0.3.0 — 2026-10-16 — 0.3 Sistema de diseño: tokens, temas y estilos base

### ADD
- `ui/styles/tokens.css`, `themes.css` (Aurora por defecto, Neo, Claro), `base.css`, `components.css` (`.glass .card .btn .chip .badge .progress .callout .input .sheet .toast`).
- `ui/styles/demo.html` (+ `demo.css`, `demo.js`): galería de componentes con cambio de tema en vivo, hoja inferior y avisos; compatible con la CSP de 8.16.
- `tools/contrast.mjs` (contraste WCAG calculado desde `themes.css`; `npm run contrast`), `tools/css-lite.mjs` (lector mínimo de CSS), `tools/visual-check.py` (verificación visual opcional con Chromium).
- `tests/design.test.mjs` (29 pruebas), `tests/scenarios/0.3.md`, `docs/DESIGN.md` completo.

### CHANGE
- `tools/check-structure.mjs`: exige los archivos de 0.3. `package.json`: script `contrast`. `core/version.js` y `package.json`: 0.2.0 → 0.3.0.

### FIX
- —

### REMOVE
- `ui/styles/.gitkeep` (la carpeta ya tiene contenido).

## v0.2.0 — 2026-10-15 — 0.2 Arnés de pruebas y auditoría automática

### ADD
- `tools/audit.mjs`: patrones prohibidos, claves con forma real, límite de 800 líneas, imports (archivo y nombre exportado), JSON inválido e IDs duplicados en `content/`.
- `tests/_helpers.mjs`: reloj falso, azar con semilla, fábricas de ítem/tarjeta/evento, base de datos mínima en memoria y carpeta temporal.
- `tests/audit.test.mjs` (positivo/negativo por regla) y `tests/helpers.test.mjs`.
- `package.json` sin dependencias, `"type": "module"`, scripts `test`, `audit`, `check`.

### CHANGE
- `tools/check-structure.mjs`: exige `package.json`, `tools/audit.mjs`, `tests/_helpers.mjs`; valida scripts, ausencia de dependencias y que `package.json` y `core/version.js` tengan la misma versión.
- `core/version.js`: 0.1.0 → 0.2.0.

### FIX
- —

### REMOVE
- —

## v0.1.0 — 2026-10-15 — 0.1 Repositorio, documentos vivos y contratos

### ADD
- Esqueleto de carpetas de la sección 6 del roadmap (cada una con `.gitkeep`).
- `docs/ROADMAP.md` (copia exacta del roadmap v1.3) y `docs/CONTRACTS.md` (sección 8 literal + espacio para ampliaciones).
- `PROJECT_STATE.md` (tablero de las 80 subpartes + 13 lotes de contenido, y las 7 secciones obligatorias), `DECISIONS.md`, `CHANGELOG.md`, `docs/DESIGN.md` (stub), `README.md`, `.gitignore`.
- `core/version.js` (`VERSION = '0.1.0'`) y `app/config.js` (constantes, sin claves).
- `tools/check-structure.mjs` y `tests/check-structure.test.mjs`.

### CHANGE
- —

### FIX
- —

### REMOVE
- —

## 0.9.3 — 2026-10-18
- Pulido visual: sin tema "Automático"; rediseño de Aurora, Neo y Claro; barra inferior flotante; renombrado a Glossa (respaldos viejos siguen valiendo); DEPLOY.md con la dirección real.
- FIX BUG 1 (hito M0): los botones segmentados ya no parten las palabras (`flex-wrap`, ancho por contenido, sin `overflow-wrap: anywhere`) y la etiqueta "Practicar" de la barra inferior ya no se corta con texto "Muy grande".
- Nueva `tools/label-check.py` (opcional, Chromium real): 112/112 a 360 y 412 px con los 4 tamaños de texto; con el CSS anterior falla.

## v0.10.0 — 2026-10-18 — 1.2 Normalización y comparación de respuestas (CIERRE: cuarto 4, mitad B)

Cierra la 1.2. `VERSION` y `package.json` pasan de 0.9.3 a 0.10.0 (MINOR: subparte entregada). Resumen de toda la 1.2 (cuartos 1A, 1B, 2A, 2B, 3A, 3B, 4A y 4B):
### ADD
- `core/normalize.js`: `normalize(text, opts)` (1A: invisibles, apóstrofos, minúsculas, NFC, espacios, puntuación final; 1B: opciones `contractions:'expand'`, `stripDiacritics`), `expandContractions`, `hasLowercaseI`.
- `tests/normalize.test.mjs` (110 pruebas, incluido fuzz de 1000 cadenas con todas las opciones).
- 2A: `damerauLevenshtein(a, b, max?)` en `core/normalize.js`; `core/confusables.js` (`createConfusables`); `content/taxonomy/confusables.json` (104 parejas); `tests/damerau.test.mjs` y `tests/confusables.test.mjs` (68 pruebas).
- 2B: `core/compare.js` con `compare(userText, accept, opts) → { result, matched, diff, spellingFlags, errorCodes }` (`correct` / `almost` / `wrong`; `MECH.CAP_I` en `errorCodes`; `diff` y `spellingFlags` quedaban en `[]` hasta el 3B) y `tests/compare.test.mjs` (21 pruebas: tabla de más de 60 casos, contracciones, confusables con TODA la lista, Unicode, vacío/null, palabras gigantes y fuzz de 1000 cadenas).
- 3A: `core/wordDiff.js` con `wordDiff` y `alignWords` (ok/close/wrong/extra/missing, `expected`, coste de alineación), `core/typo.js` (reglas compartidas) y `tests/wordDiff.test.mjs` (6 pruebas: tabla de 29 casos, oráculo independiente en 300 pares, fuzz de 1000 pares coherente con `compare`).
- 3B: `compare` llena `diff` (contra `matched`, o contra la aceptada más cercana si es `wrong`) y `spellingFlags` (`[{ word, expected, index }]`, una marca en `almost`); `wordCore` en `core/typo.js`; `tests/compare.diff.test.mjs` (23 pruebas: tabla de `almost`, referencia elegida entre varias aceptadas, opciones que llegan al diff, tope de 100 aceptadas, más de 250 palabras, rendimiento y fuzz de 1000 de coherencia).
- 4B: `tests/compare.ca.test.mjs` (6 pruebas: amarra cada uno de los 5 CA de la 1.2 con la API pública). `tests/scenarios/0.5.md` gana los pasos 10 y 11 (corrección con "sobra" y tamaño "Muy grande").
- 4A: `createWordDiff` entiende `ok|close|wrong|extra|missing` (y `expected`) sin adaptador; estilo `.word-diff__word--extra` (rojo, tachado); `TEXT.wordStatus.extra` y `TEXT.wordExpected`; la galería muestra "sobra". `tests/ui-components.test.mjs`: la prueba de wordDiff se amplió y hay 5 pruebas nuevas (desconocido→wrong, formato de core sin adaptador, `expected` y HTML, 250 + 250 palabras, CSS).
### CHANGE
- `core/compare.js`: la puntuación interior se ignora (decisión del Administrador, 1b); las reglas comunes pasan a `core/typo.js`. `tests/compare.test.mjs` +12 casos. 3B: `compare` ya no devuelve `diff` ni `spellingFlags` vacíos (la prueba de forma de `tests/compare.test.mjs` se actualizó). 4B: versión 0.10.0 en `core/version.js`, `package.json` y `tests/scenarios/HITO_M0.md` (el paso 5 y el 12 piden ver 0.10.0). 4A: `createWordDiff.counts()` devuelve 5 claves y un estado desconocido ya no lanza (se ve como `wrong`); `docs/DESIGN.md` actualizado.
### FIX
- —
### REMOVE
- —
(Nota: la app aún no usa `normalize` ni `compare`; las usará la 2.1 en adelante.)

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 Esquemas de contenido, validador y cargador de paquetes (CUARTO 1 de 4, mitad A: reglas comunes y Topic)

### ADD
- `core/contentRules.js`: informe con rutas exactas (`createReport`, `joinPath`, `formatProblem`), reglas de texto (sin HTML, sin control, sin invisibles; avisos de espacios y apóstrofos curvos), constructores de especificaciones (`text`, `int`, `bool`, `oneOf`, `idOf`, `errorCode`, `list`, `obj`, `custom`, `optional`, `nullable`) y `check`, que no lanza nunca.
- `core/contentTopic.js`: `validateTopic` / `checkTopic` (contrato 8.2): enumerados, `id` coherente con el área, `prereq` sin repetidos ni autorreferencia, `theory` con rutas anidadas, aviso `THEORY_MISSING`.
- `tests/contentRules.test.mjs` (29 pruebas) y `tests/contentTopic.test.mjs` (22 pruebas), con fuzz de 1000 casos cada una y objetos hostiles. Los 45 códigos de 8.8 se comparan con el roadmap.
- `docs/CONTRACTS.md` 1.3-1A y 8 entradas en `DECISIONS.md` (incluida la división de la 1.3 en 4 cuartos).

### CHANGE
- `tools/check-structure.mjs` exige los 4 archivos nuevos.

### FIX
- —

### REMOVE
- —

(Nota: sin cambio de versión; la 1.3 sube a 0.11.0 al cerrar. La app aún no usa estos módulos.)

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 Esquemas de contenido, validador y cargador de paquetes (CUARTO 1 de 4, mitad B: registro de tipos, Item común, Pack, LexEntry y Story)

### ADD
- `core/contentTypes.js`: registro de los 85 tipos de 8.9 con su familia y banderas (`auto`, `ai`, `audio`, `acceptRequired`), los 4 integradores, `typeInfo`, `isItemType`, `isIntegratorType`, `typesOfFamily`, `suggestType`.
- `core/contentItem.js` (`validateItem` / `checkItem` / `ambiguousContractionGaps`): campos comunes de 8.3 con rutas exactas, tipo del catálogo (integradores rechazados), `accept` obligatorio en los tipos que se escriben, `needs_ai` en los solo-IA, distractor ≠ respuesta, regla de `'s`/`'d`, rutas de audio e imagen; `data` por especificación de su familia cuando el contexto la trae.
- `core/contentPack.js` (`validatePack` / `checkPack`), `core/contentLex.js` (`validateLexEntry`), `core/contentStory.js` (`validateStory`) y `core/contentCommon.js` (piezas compartidas).
- `tests/contentTypes.test.mjs` (9), `tests/contentItem.test.mjs` (31), `tests/contentLexStory.test.mjs` (22) y `tests/contentPack.test.mjs` (26): 88 pruebas, con fuzz de 1000 casos (500 en Pack), objetos hostiles, límites de cada lista y el registro comparado con la tabla del roadmap.
- `docs/CONTRACTS.md` 1.3-1B y 11 entradas en `DECISIONS.md`.

### CHANGE
- `tools/check-structure.mjs` exige los 10 archivos nuevos.

### FIX
- —

### REMOVE
- —

(Nota: sin cambio de versión; la 1.3 sube a 0.11.0 al cerrar. La app aún no usa estos módulos. `contentRules.js` y `contentTopic.js` (1A) no se tocaron.)

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (adopción del roadmap v1.4, antes de la mitad 2A)

### CHANGE
- `docs/ROADMAP.md` pasa de la v1.3 a la **v1.4** (copia exacta del adjunto; sección 8 sin cambios). `PROJECT_STATE.md` anota `Versión del roadmap: 1.4 (sha256 …)`, la Pista C pasa a \"en cadena\", se avisa de que tras la 1.3 siguen C1 → C2 → C10 y se añade la sección \"8. Contenido\" (tabla `lote | tanda | temas hechos | ítems | estado`).
- `tools/check-structure.mjs` comprueba que la línea de versión y el sha256 de `PROJECT_STATE.md` coincidan con `docs/ROADMAP.md` y que exista la sección \"Contenido\".
- `docs/CONTRACTS.md`: la cabecera cita el roadmap v1.4 (Parte 1 sin cambios).

### ADD
- `tests/check-structure.test.mjs` +4: coincidencia de versión y hash, detección de versión/hash distintos, línea ausente o mal formada, sección Contenido ausente.

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (cuarto 2, mitad 2A: `data` de las familias autocalificables)

### ADD
- `core/contentData.js`: `DATA_SPECS` para `choice`, `text_input`, `ordering`, `matching`, `cloze` y `transform`; reglas entre campos (`correct` en rango, parejas sin repetir, huecos = respuestas, respuestas dentro del banco) y `checkChoiceDistractors` (cada opción incorrecta de un ítem de elección lleva su distractor con `code`, regla de calidad 8.10).
- `tests/contentData.test.mjs`: 15 pruebas (de 5), con 10 mutaciones comprobadas.
- `docs/CONTRACTS.md` 1.3-2A: el contrato `data` de las 6 familias y los códigos de error nuevos.

### CHANGE
- `core/contentItem.js`: usa `DATA_SPECS` por defecto cuando el contexto no trae `dataSpecs`, y aplica la regla de distractores a la familia `choice`.
- `tools/check-structure.mjs`: exige `core/contentData.js` y su prueba.
- 4 pruebas de la 1B pasan `dataSpecs: {}` explícito para seguir probando solo el Item común y la historia.

(Nota: la app aún no usa estos módulos. La mitad 2B congela `audio`, `speak`, `reading`, `writing`, `mediation` y `open_ai`.)

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (cuarto 2, mitad 2B, parte 1: familia `audio`)

### ADD
- `core/contentData.js`: especificación `audio` en `DATA_SPECS` (7 familias) y `checkAudioItem` (contestable, `cloze_audio` con hueco).
- `tests/contentData.test.mjs`: 21 pruebas (de 15), con 9 mutaciones comprobadas.
- `docs/CONTRACTS.md` 1.3-2B (parte 1).

### CHANGE
- `core/contentItem.js`: aplica `checkAudioItem` a la familia `audio` cuando `data` no tiene errores.

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (cuarto 2, mitad 2B, parte 2: speak, reading, writing, mediation, open_ai; cierra el cuarto 2)

### ADD
- `core/contentData.js`: las 12 familias en `DATA_SPECS`; `checkTypedItem` (obligatorios por tipo, `answer` solo en `read_tfng`, lectura contestable); `CODE_OPTIONAL_CHOICE_TYPES` y `SPEECH_ACTS` exportadas.
- `tests/contentData.test.mjs`: 34 pruebas (de 21), con 13 mutaciones comprobadas.
- `docs/CONTRACTS.md` 1.3-2B (parte 2): los contratos `data` de todo el catálogo 8.9 quedan congelados.

### CHANGE
- Decisión del Administrador (pregunta 5): `code` del distractor opcional en los 5 tipos de elección de vocabulario; obligatorio en el resto (`docs/CONTRACTS.md` 1.3-2A actualizado).
- `core/contentItem.js`: aplica `checkTypedItem` a las familias speak, reading, writing, mediation y open_ai.
- `tests/contentItem.test.mjs`: la prueba de `needs_ai` pasa `dataSpecs: {}`.

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (cuarto 3, mitad 3A, parte 1: catálogo de códigos de error)

### ADD
- `content/taxonomy/error_codes.json`: los 45 códigos de 8.8 con `id` y `titulo_es`.
- `core/contentCodes.js`: `validateErrorCodes` y `errorCodeSet` (el `Set` para `ctx.errorCodes`).
- `tests/contentCodes.test.mjs`: 8 pruebas, con 9 mutaciones comprobadas; leen los códigos del roadmap.
- `docs/CONTRACTS.md` 1.3-3A (parte 1).

### CHANGE
- `tools/check-structure.mjs`: exige los 3 archivos nuevos.

(Nota: nada lee todavía el archivo del disco; lo harán el CLI (3B) y el cargador (4A).)


## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 (cuarto 3, mitad 3A, parte 2: temas, ids únicos globales y avisos por tema; cierra la 3A)

### ADD
- `content/taxonomy/topics.json`: semilla de 18 temas de prioridad 1 del diagnóstico (roadmap 7.10), en `draft`.
- `core/contentTaxonomy.js`: `validateTopics` (forma, ids únicos, `UNKNOWN_PREREQ`, `PREREQ_CYCLE` sin recursión), `topicIdSet` y `topicInfo`.
- `core/contentInstalled.js`: `summarizePack` e `installedIndex` (paquetes instalados como resúmenes serializables).
- `core/contentPack.js`: `DUPLICATE_INSTALLED` (ids únicos globales) y avisos `TOPIC_FEW_ITEMS` / `TOPIC_FEW_TYPES` por tema activo (con `ctx.installed` y `ctx.topicInfo`).
- `tests/contentTaxonomy.test.mjs` (19) y `tests/contentPack.global.test.mjs` (20); 37 mutaciones sobre lo nuevo, todas detectadas (1 equivalente, explicada en el reporte).
- `docs/CONTRACTS.md` 1.3-3A (parte 2).

### CHANGE
- `core/contentCommon.js` recibe `PACK_LIMITS`, `STORY_QUESTIONS_MAX`, `DEFAULT_MIN_ITEMS` y `MIN_TYPES_PER_TOPIC`; `contentPack.js` sigue reexportando `PACK_LIMITS`.
- `tools/check-structure.mjs`: exige los 5 archivos nuevos.
- `npm run build`: `asset-manifest.json` y `sw.js` regenerados (`content/taxonomy/` se precachea).

(Nota: nada lee todavía los archivos del disco; lo harán el CLI (3B) y el cargador (4A). La versión sube a 0.11.0 al cerrar la 1.3.)

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 Esquemas de contenido (CUARTO 3 de 4, mitad B: validador de línea de comandos)

Sin cambio de versión: sube a 0.11.0 al cerrar la 1.3. No toca `core/` ni nada que se precachee (el manifiesto sale idéntico).

### ADD
- `tools/validate-content.mjs` (CLI y `validateContent`/`formatResult`/`parseArgs`/`main`) y `tools/contentFs.mjs` (lectura segura, taxonomía, instalados y contexto por paquete). Contrato: `docs/CONTRACTS.md` 1.3-3B.
- `tests/fixtures/` (taxonomía mínima y `sample_pack_v1.json`), `tests/_samplePack.mjs`, `tests/validate-content.invalid.test.mjs` (32 pruebas: 29 paquetes inválidos + control) y `tests/validate-content.test.mjs` (26).
- Script `npm run validate-content`.

### CHANGE
- `npm run check` ejecuta también `validate-content --quiet`: el contenido instalado debe ser siempre válido.
- `tools/check-structure.mjs`: exige los 8 archivos nuevos.

### FIX
- Hallazgos de la propia auditoría de la 3B (antes de entregar): `| head` reventaba el CLI con un EPIPE (ahora sale limpio y conserva el código); el mensaje de un JSON roto salía sin línea cuando Node no da la posición (ahora «cerca de la línea N»); un archivo dado a mano que ya había llegado dentro de una carpeta se omitía en silencio si no parecía paquete (ahora vale como explícito); un `.json` ajeno en `content/packs/` se contaba como instalado ilegible.

## v0.10.0 (sin cambio de versión) — 2026-10-18 — 1.3 Esquemas de contenido (CUARTO 4 de 4, mitad 4A, parte 1: índice y carga de paquetes)

La parte 2 de la 4A (`importPacksToDb`, migración v1→v2) queda pendiente. Sin cambio de versión: sube a 0.11.0 al cerrar la 1.3.

### ADD
- `core/content.js`: `validateIndex`, `loadIndex`, `loadPack` (fetch inyectable, tiempo máximo, errores con código y mensaje en español) y reexporta `validatePack`. Contrato: `docs/CONTRACTS.md` 1.3-4A (parte 1). `tests/content.test.mjs` (18 pruebas; 3 mutaciones del código fueron detectadas).

### CHANGE
- `tools/check-structure.mjs` exige `core/content.js` y su prueba. `asset-manifest.json` y `sw.js` regenerados con `npm run build` (`core/` se precachea; el nombre de caché cambia por el hash, la versión no).
