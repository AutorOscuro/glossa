# CHANGELOG — Sophia Inglés

Formato (roadmap 12.3): `## v<x.y.z> — <fecha> — <subparte>` con secciones `ADD`, `CHANGE`, `FIX`, `REMOVE`.

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
- `tests/onboarding.test.mjs` (20 pruebas).

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
- `tests/design.test.mjs` (28 pruebas), `tests/scenarios/0.3.md`, `docs/DESIGN.md` completo.

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
