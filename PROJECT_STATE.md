# PROJECT_STATE — Sophia Inglés

> Estado vivo del proyecto. **Cada chat constructor lo actualiza al entregar.** La fuente de verdad del plan es `docs/ROADMAP.md` (solo el Administrador lo cambia).
> Última actualización: 2026-10-17 · Versión del repo: **0.9.0** (la 1.1 está cerrada; el HITO M0, que cierra la 0.8, sigue pendiente de las pruebas de William) · Roadmap: v1.3

## 1. Tablero de subpartes

Estados: `PENDIENTE` · `EN CURSO` · `HECHA` · `BLOQUEADA`. Una subparte solo se empieza si todas sus dependencias están `HECHA`.

| ID | Nombre | Estado | Versión | Fecha | Notas |
|---|---|---|---|---|---|
| 0.1 | Repositorio, documentos vivos y contratos | HECHA | 0.1.0 | 2026-10-15 | Dep.: ninguna |
| 0.2 | Arnés de pruebas y auditoría automática | HECHA | 0.2.0 | 2026-10-15 | Dep.: 0.1 |
| 0.3 | Sistema de diseño: tokens, temas y estilos base | HECHA | 0.3.0 | 2026-10-16 | Dep.: 0.1 |
| 0.4 | Shell de la app, router y ciclo de vida de vistas | HECHA | 0.4.0 | 2026-10-16 | Dep.: 0.2, 0.3 |
| 0.5 | Biblioteca de componentes UI reutilizables | HECHA | 0.5.0 | 2026-10-16 | Dep.: 0.4 |
| 0.6 | PWA: manifest, service worker, iconos, actualizaciones y guía de despliegue | HECHA | 0.6.0 | 2026-10-17 | Dep.: 0.4. Mitad A (manifest, iconos, sw.js, build-manifest, versionCompare) + mitad B (swRegister, aviso "Actualizar", registro en main.js, `.nojekyll`, DEPLOY.md, guion 0.6) |
| 0.7 | Capa de almacenamiento (IndexedDB) con adaptador de pruebas y migraciones | HECHA | 0.7.0 | 2026-10-17 | Dep.: 0.2. A (contrato, motor en memoria, migraciones, reloj, azar, store) + B1 (`core/db.idb.js` pasa la suite de contrato en Chromium real, 39/40, 1 omitida a propósito) + B2 (`dbOpen`, `persist`, `app/storage.js`, aviso "solo memoria", cableado en `main.js`, guion 0.7) |
| 0.8 | Ajustes, bóveda de claves y onboarding mínimo | HECHA | 0.8.0 | 2026-10-17 | Dep.: 0.5, 0.7 · **Cierra HITO M0.** Cuarto 1: `core/settings.js`. Cuarto 2: `ui/components/keyField.js`, `app/appearance.js`, `app/settingsBoot.js` y `ui/views/settings.js` (pantalla de ajustes). Cuarto 3: `core/sync.js` (respaldo, provisional hasta 1.12), `app/dataTools.js`, `app/fileIO.js` y `ui/views/settingsData.js` (Respaldo, Claves y Zona de peligro). Cuarto 4: `ui/views/onboarding.js` (bienvenida de 3 pantallas) y `app/firstRun.js` (primer arranque, ruta `#/bienvenida`, "Repetir bienvenida" en Ajustes, guion `tests/scenarios/0.8.md` y consolidado `HITO_M0.md`) |
| 1.1 | Registro de eventos | HECHA | 0.9.0 | 2026-10-17 | Dep.: 0.7 · Se entrega en 4 cuartos (roadmap 3.3). **Cuarto 1 HECHO:** `core/eventSchema.js` (validación estricta, día local, IDs únicos). **Cuarto 2 HECHO (mitades A y B):** `core/events.js` con `log` atómico (id comprobado dentro de la transacción, nunca pisa un evento), probado en memoria y en IndexedDB real. **Cuarto 3 HECHO (mitades A y B):** `byCard`, `byItem`, `byTopic`, `since` (índices, orden por `ts` e `id`, `order`/`limit`, `BAD_QUERY`), `countByDay` (objeto por día local, sin días vacíos) y `recentErrorsByCode` (por `since`, filtrando; sin índice de `errorCodes`), con la prueba de volumen de CA-4 (50.000 eventos; ventana de 14 días < 200 ms; el peor caso con todo el historial NO cumple 200 ms y está consultado al Administrador, ver sección 5). **Cuarto 4, mitad A HECHA:** inmutabilidad (API sin `update`/`delete`, objeto congelado) y `clearAll()` (único borrado; una transacción; probado en memoria y en IndexedDB real; en IndexedDB real tarda 6–8 s con 10.000 eventos, ver sección 5). **Cuarto 4, mitad B HECHA:** los 4 CA comprobados de punta a punta en `tests/events.cierre.test.mjs` y versión 0.9.0. Las 2 preguntas de costes de la sección 5 siguen abiertas y no bloquean. Sin pantallas: no hay guion manual. |
| 1.2 | Normalización y comparación de respuestas | PENDIENTE | — | — | Dep.: 0.2 · Debe ampliar `createWordDiff` (0.5) con `ok|close|wrong|missing|extra`, sin adaptador, y revisar `tests/scenarios/0.5.md` (decisión del Administrador) |
| 1.3 | Esquemas de contenido, validador y cargador de paquetes | PENDIENTE | — | — | Dep.: 0.7, 1.2 |
| 1.4 | Motor de repaso espaciado (FSRS) | PENDIENTE | — | — | Dep.: 0.7, 1.1 |
| 1.5 | Calificación por acierto + tiempo | PENDIENTE | — | — | Dep.: 1.4 |
| 1.6 | Registro de errores y catálogo de códigos | PENDIENTE | — | — | Dep.: 1.1, 1.2 |
| 1.7 | Motor de dominio por tema | PENDIENTE | — | — | Dep.: 1.1, 1.4, 1.6 |
| 1.8 | Armador de sesiones | PENDIENTE | — | — | Dep.: 1.3, 1.4, 1.7 |
| 1.9 | Consultas de estadísticas | PENDIENTE | — | — | Dep.: 1.1, 1.7 |
| 1.10 | Cliente de IA (proveedores, caché, límites, JSON seguro) | PENDIENTE | — | — | Dep.: 0.8 |
| 1.11 | Validador de lista blanca (lemas dominados) — principio 90–95 % | PENDIENTE | — | — | Dep.: 1.3, 1.7 |
| 1.12 | Núcleo de sincronización: respaldo y puente con el chat | PENDIENTE | — | — | Dep.: 0.7, 1.1, 1.6 · Cierra HITO M0.5 |
| 2.1 | Ejecutor de sesión | PENDIENTE | — | — | Dep.: 1.8, 0.5 |
| 2.2 | Tarjeta de lección `phrase_cloze` (réplica de la interacción Epop, con teclado) | PENDIENTE | — | — | Dep.: 2.1 |
| 2.3 | Familia de elección: `choose_correct`, `ab_natural`, `mcq_en_es`, `mcq_es_en`, `pick_fits`, `odd_one_out`, `choose_tense`, `prep_pick`, `particle_pick` | PENDIENTE | — | — | Dep.: 2.1 |
| 2.4 | Familia de ordenar/emparejar/completar: `order_blocks`, `unscramble_letters`, `cloze_bank`, `match_pairs`, `order_dialogue`, `build_from_keywords` | PENDIENTE | — | — | Dep.: 2.1 |
| 2.5 | Familia de producción corta: `fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word`, `derive_form`, `three_forms`, `trap_translate`, `translate_bank`, `fix_error`, `transform`, `keyword_transform`, `join_sentences`, `pronoun_placement` | PENDIENTE | — | — | Dep.: 2.1, 1.2 |
| 2.6 | Retroalimentación, pistas y flujo "No sé" | PENDIENTE | — | — | Dep.: 2.2–2.5 |
| 2.7 | Barra de 4 acciones: Otros ejemplos · Correcciones · Preguntas IA · Diccionario (versión mecánica) | PENDIENTE | — | — | Dep.: 2.2, 1.6 |
| 2.8 | Resumen de sesión y revisión de errores | PENDIENTE | — | — | Dep.: 2.1, 1.9 |
| 2.9 | Paquete semilla S0 y recorrido de extremo a extremo | PENDIENTE | — | — | Dep.: 2.1–2.8, 1.3 · Cierra HITO M1 |
| 3.1 | Vista de mapa de contenidos | PENDIENTE | — | — | Dep.: 2.9, 1.7 |
| 3.2 | Detalle de tema y fichas cortas de teoría | PENDIENTE | — | — | Dep.: 3.1 |
| 3.3 | Ciclo de examen de entrada y de salida por tema | PENDIENTE | — | — | Dep.: 3.2, 1.8 |
| 3.4 | Pantalla "Hoy" y plan flexible del día | PENDIENTE | — | — | Dep.: 1.8, 1.9, 3.1 |
| 3.5 | Vistas de semana y mes | PENDIENTE | — | — | Dep.: 3.4 |
| 3.6 | Estadísticas y progreso | PENDIENTE | — | — | Dep.: 1.9, 3.1 |
| 3.7 | Pantalla de errores (diario de errores) | PENDIENTE | — | — | Dep.: 1.6, 3.1 |
| 3.8 | Test de nivelación inicial y calibración (opcional) | PENDIENTE | — | — | Dep.: 3.3 · Cierra HITO M2 |
| 4.1 | Léxico, familias y ficha de palabra | PENDIENTE | — | — | Dep.: 3.1, 1.3 |
| 4.2 | Ejercicios de vocabulario | PENDIENTE | — | — | Dep.: 4.1, 2.3–2.5 |
| 4.3 | Examen de entrada "limpio" por familia | PENDIENTE | — | — | Dep.: 4.1, 3.3 |
| 4.4 | Verbos irregulares y regulares (una tarjeta por forma) | PENDIENTE | — | — | Dep.: 4.1, 1.4 |
| 4.5 | Phrasal verbs | PENDIENTE | — | — | Dep.: 4.1 |
| 4.6 | Preposiciones dependientes y patrones verbales (gerundio/infinitivo) | PENDIENTE | — | — | Dep.: 4.1 |
| 4.7 | Ortografía: tarjetas de deletreo y diccionario | PENDIENTE | — | — | Dep.: 2.5, 4.1 · Cierra HITO M3 |
| 5.1 | Configuración, prueba de conexión y estado de IA | PENDIENTE | — | — | Dep.: 1.10, 0.8 |
| 5.2 | "Otros ejemplos" con IA (3 capas) | PENDIENTE | — | — | Dep.: 5.1, 2.7, 1.11 |
| 5.3 | "Preguntas IA" contextuales | PENDIENTE | — | — | Dep.: 5.1, 2.7 |
| 5.4 | Calificación de respuestas abiertas con IA | PENDIENTE | — | — | Dep.: 5.1, 2.5 |
| 5.5 | Clasificación de errores con IA | PENDIENTE | — | — | Dep.: 5.4, 1.6 |
| 5.6 | Ciclo de feedback de escritura | PENDIENTE | — | — | Dep.: 5.4, 5.5 |
| 5.7 | Generador de frases con vocabulario dominado | PENDIENTE | — | — | Dep.: 1.11, 5.2 |
| 5.8 | Conversación y juegos de rol (por texto) | PENDIENTE | — | — | Dep.: 5.3, 5.5 |
| 5.9 | Mediación y pragmática | PENDIENTE | — | — | Dep.: 5.4 |
| 5.10 | Señal de uso real "U" y entrenador semanal | PENDIENTE | — | — | Dep.: 5.6, 5.8, 1.7 · Cierra HITO M4 |
| 6.1 | Lector con "tocar palabra" (estilo LingQ) | PENDIENTE | — | — | Dep.: 4.1, 2.7 |
| 6.2 | Ejercicios de comprensión lectora | PENDIENTE | — | — | Dep.: 6.1 |
| 6.3 | Biblioteca de historias y flujo RAIO-inspirado | PENDIENTE | — | — | Dep.: 6.1, 7.2 (audio; mientras no exista, modo solo texto con TTS del navegador) |
| 6.4 | Comprobador de comprensibilidad 90–95 % | PENDIENTE | — | — | Dep.: 1.11, 6.3 |
| 6.5 | Sondas de techo | PENDIENTE | — | — | Dep.: 6.4, 3.5 |
| 6.6 | Lectura extensiva y seguimiento | PENDIENTE | — | — | Dep.: 6.1 · Cierra HITO M5 |
| 7.1 | Tubería de audio en el PC de William (herramientas) | PENDIENTE | — | — | Dep.: 1.3 |
| 7.2 | Reproductor de audio | PENDIENTE | — | — | Dep.: 7.1, 0.6 |
| 7.3 | Dictado y cloze auditivo | PENDIENTE | — | — | Dep.: 7.2, 2.5 |
| 7.4 | Habla conectada y pares mínimos auditivos | PENDIENTE | — | — | Dep.: 7.2 |
| 7.5 | Comprensión auditiva y escucha extensiva | PENDIENTE | — | — | Dep.: 7.2, 6.2 |
| 7.6 | Shadowing diario | PENDIENTE | — | — | Dep.: 7.2, 6.3 · Cierra HITO M6 |
| 8.1 | Reconocimiento de voz (STT) con color por palabra | PENDIENTE | — | — | Dep.: 2.2, 7.2 |
| 8.2 | Azure Pronunciation Assessment: cliente y configuración | PENDIENTE | — | — | Dep.: 8.1, 0.8 |
| 8.3 | Ejercicios de pronunciación | PENDIENTE | — | — | Dep.: 8.2, 7.4 |
| 8.4 | Conversación por voz con IA | PENDIENTE | — | — | Dep.: 5.8, 8.1, 7.2 |
| 8.5 | Alternativas locales (opcional, solo si hace falta) | PENDIENTE | — | — | Dep.: 8.2 |
| 8.6 | Exportar grabaciones para verificación humana | PENDIENTE | — | — | Dep.: 8.3 · Cierra HITO M7 |
| 9.1 | Recordatorios (honestos con las limitaciones de la PWA) | PENDIENTE | — | — | Dep.: 3.4 |
| 9.2 | Ajustes completos y pulido de UX | PENDIENTE | — | — | Dep.: todo lo previo relevante |
| 9.3 | Respaldo y restauración robustos | PENDIENTE | — | — | Dep.: 1.12 |
| 9.4 | Rendimiento y contenido masivo | PENDIENTE | — | — | Dep.: P4–P8 según avance |
| 9.5 | Accesibilidad e internacionalización de cadenas | PENDIENTE | — | — | Dep.: 9.2 |
| 9.6 | Auditoría de seguridad y privacidad | PENDIENTE | — | — | Dep.: 9.2 |
| 9.7 | Regresión total y recorrido de extremo a extremo | PENDIENTE | — | — | Dep.: 9.1–9.6 |
| 9.8 | Documentación final y empaquetado | PENDIENTE | — | — | Dep.: 9.7 · Cierra HITO M8 |

### Pista C — producción de contenido (paralela)

| ID | Nombre | Estado | Versión | Fecha | Notas |
|---|---|---|---|---|---|
| C1 | Catálogo de errores | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C2 | Taxonomía de temas | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C3 | **Gramática prioridad 1** (huecos de alto impacto) | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C4 | Gramática prioridad 2 | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C5 | Gramática de huecos confirmados | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C6 | Vocabulario esencial 1K | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C7 | Vocabulario 2K–3K + profundidad | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C8 | Frases y diálogos | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C9 | Verbos | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C10 | Lemas | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C11 | Historias | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C12 | Escucha y pronunciación | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |
| C13 | Escritura/mediación/roleplay | PENDIENTE | — | — | Pista de contenido; no se produce contenido final hasta que 1.3 esté HECHA |

## 2. Siguiente subparte

**1.2, Normalización y comparación de respuestas** (dep. 0.2, HECHA). La 1.1 está cerrada (v0.9.0). Si el Administrador responde las 2 preguntas de costes de la sección 5 (`clear(store)` en el motor; peor caso de `countByDay`/`recentErrorsByCode`), se aplican como subparte aparte, antes o después de la 1.2 según su prioridad; hasta entonces no bloquean. `createEvents` aún no está cableado en `services` (lo hará la 2.1).
**Nota para la 1.2:** debe ampliar `createWordDiff` (0.5) con los 5 estados `ok | close | wrong | missing | extra`, sin adaptador (decisión del Administrador; ver `DECISIONS.md` y `docs/CONTRACTS.md` 1.1-2) y revisar `tests/scenarios/0.5.md`.
Antes de empezar, el chat constructor **corrige primero lo que William reporte** de las pruebas del hito M0 (`tests/scenarios/HITO_M0.md`, formato BUG 12.4); si algo es de diseño, va al Administrador. Nunca dos chats sobre la misma subparte.

## 3. Bugs conocidos

Ninguno.

## 4. Pendiente de verificación por William

- **HITO M0 (sigue pendiente):** publicar y probar con `tests/scenarios/HITO_M0.md` (≈ 20–30 min; guía de publicación en `docs/DEPLOY.md`). La 1.1 no añade pantallas ni pasos al guion. Lo que William reporte (formato BUG 12.4) se corrige antes de empezar la siguiente subparte.
- **1.1-4A:** igual que 1.1-3B, los tiempos de `clearAll` se midieron en un ordenador, no en el teléfono; sin pantallas no hay guion.
- **1.1-3B:** los tiempos de `countByDay` y `recentErrorsByCode` se midieron en un ordenador (Node y Chromium de escritorio), no en el teléfono. Sin pantallas no hay guion; se confirmarán en el teléfono cuando exista una pantalla que las use (3.5 o 3.6).

- **0.3:** solo el teléfono real confirma: que la hoja inferior no quede tapada por la barra de gestos de Android (zona segura), el rendimiento del desenfoque de vidrio, cómo se ven los colores en su pantalla y la letra grande del sistema. Guion en `tests/scenarios/0.3.md` (en cola para M0).
- **0.5:** solo el teléfono real confirma: el arrastre táctil de la hoja, que no la tape la barra de gestos, el teclado móvil sin autocorrección en `exercise`, el "?" cómodo de tocar y la mascota quieta con "quitar animaciones". Guion en `tests/scenarios/0.5.md` (en cola para M0).
- **0.6:** solo el teléfono real confirma: "Instalar app" de Chrome en Android, el icono maskable recortado por el lanzador, el modo avión del teléfono y el aviso de actualización con un despliegue real en GitHub Pages. Guion en `tests/scenarios/0.6.md` (en cola para M0).
- **0.4:** solo el teléfono real confirma: que la barra de pestañas no quede tapada por la barra de gestos, el botón atrás de Android, el portapapeles de "Copiar detalle" y el aspecto con letra grande (a 200 % se recortan 3 etiquetas con "…"). Guion en `tests/scenarios/0.4.md` (en cola para M0).

- **0.8 (cuarto 2A):** solo el teléfono real confirma: que el tamaño de texto se vea bien en 4 niveles sobre la letra grande del sistema, que Chrome no ofrezca guardar la clave como contraseña, y si hay parpadeo del tema al abrir cuando se eligió un tema distinto al del sistema (ver `DECISIONS.md`). Pantalla de ajustes (2B): solo el teléfono real confirma el aspecto de las 6 tarjetas, el arrastre táctil de los deslizadores y el cambio de tema/tamaño en vivo. Guion en `tests/scenarios/0.8.md`.
- **0.8-3 (respaldo y borrado):** solo el teléfono real confirma: que la descarga del archivo de respaldo funcione en Chrome de Android (dónde queda), que el selector de archivos abra y devuelva el archivo, el aspecto de las tarjetas Respaldo, Claves y Zona de peligro, y que el teclado deje escribir BORRAR. Guion en `tests/scenarios/0.8.md`.
- **0.8-4 (bienvenida):** solo el teléfono real confirma: que las 3 pantallas se vean bien y quepan sin desplazarse mucho, el teclado al escribir el nombre, el control de energía táctil y que el foco/lector de pantalla anuncie cada título. Guion en `tests/scenarios/0.8.md` (y dentro de `HITO_M0.md`, pasos 1 a 2 y 10 a 11).

## 5. Preguntas abiertas para el Administrador

**1 abierta (1.1-3B, no bloquea el cuarto 4):** `countByDay({})` y `recentErrorsByCode` desde siempre, con los 50.000 eventos dentro de la ventana, tardan 237–616 ms en memoria (varía con la carga de la máquina) y ~0,9–1,05 s en IndexedDB real (límite de referencia: 200 ms); con ventana de 14 días cumplen (36–86 ms en memoria, 115–189 ms en IndexedDB). El suelo es copiar las filas que devuelve el motor. Opciones y recomendación en el PROMPT PARA ADMIN entregado con la mitad B; la respuesta condiciona sobre todo a la 1.9 (CA-3: < 200 ms con 50.000 eventos).

**2 abierta (1.1-4A, no bloquea la mitad B):** `clearAll()` de 10.000 eventos tarda 6–8 s en IndexedDB real (88–97 ms en memoria) porque `tx.delete` de `core/db.idb.js` hace `count` + `delete` por fila y espera cada petición; `wipeAll` (0.8, Zona de peligro) tiene el mismo coste. Con 50.000 eventos se calcula ≈ 30–40 s (no medido). Pedir las bajas en paralelo solo ahorró ≈ 20 %. La solución es una operación `clear(store)` en el motor (contrato 0.7/8.13: `objectStore.clear()` en IndexedDB y vaciar el almacén en memoria, respetando la clave reservada de `meta`): lo decide el Administrador. Opciones: (a) añadir `clear(store)` y usarlo en `clearAll` y `wipeAll`; (b) dejarlo así y avisar en la pantalla "Borrando…" (la operación no bloquea la interfaz, pero es larga); (c) poner un límite de retención de eventos en M1.

Resueltas el 2026-10-17 (detalle en `DECISIONS.md`, entradas `ADMIN`): `wordDiff` devuelve `[{ text, status }]` con `ok|close|wrong|missing|extra` y la 1.2 amplía el componente de la 0.5, sin adaptador (ver `DECISIONS.md`); aviso de actualización persistente aprobado; topes diarios solo enteros ≥ 0 con máximo razonable (política en M1); energía `low|mid|high`; obligatorios por tipo de evento y `mode ∈ mech | ai` confirmados, sin campo `data`.

## 6. Contratos modificados

Ninguno (1.1-1, 1.1-2, 1.1-3A y 1.1-3B añaden ampliaciones en `docs/CONTRACTS.md` Parte 2: esquema de eventos, `log` y las consultas (1.1-3B: `countByDay` devuelve `{ "AAAA-MM-DD": n }`, decisión del Administrador); la energía de `meta.energyCheck` pasa a `low|mid|high`; la 0.5 solo añade una ampliación en `docs/CONTRACTS.md` Parte 2; 0.8-3A añade otra: `core/sync.js` y `app/dataTools.js`). `docs/CONTRACTS.md` Parte 1 es copia de la sección 8 del roadmap v1.3 (sin cambios); la 0.4 solo añadió una ampliación en la Parte 2.

## 7. Cola de pruebas manuales

Se ejecutan juntas en el siguiente hito de publicación (roadmap 5.H). Cada chat añade su guion aquí al entregar. **M0:** todo lo de abajo está consolidado en `tests/scenarios/HITO_M0.md` (ordenado por pantalla); los guiones por subparte quedan como detalle.

| Subparte | Guion | Estado |
|---|---|---|
| 0.3 | `tests/scenarios/0.3.md` | EN COLA (hito M0; pasos 4, 12 y 13 de `HITO_M0.md`) |
| 0.4 | `tests/scenarios/0.4.md` | EN COLA (hito M0; pasos 4 y 5) |
| 0.5 | `tests/scenarios/0.5.md` | EN COLA (hito M0; pasos 13 y 14) |
| 0.6 | `tests/scenarios/0.6.md` | EN COLA (hito M0; incluye crear el repo y activar Pages con `docs/DEPLOY.md`; pasos 1, 3, 15 y 16) |
| 0.7 | `tests/scenarios/0.7.md` | EN COLA (hito M0; paso 1) |
| 0.8 | `tests/scenarios/0.8.md` | EN COLA (hito M0; pasos 1 a 3 y 6 a 11) |
| M0 | `tests/scenarios/HITO_M0.md` | **LISTO PARA WILLIAM** (guion consolidado del hito) |
