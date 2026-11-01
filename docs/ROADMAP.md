# ROADMAP MAESTRO — APP "SOPHIA INGLÉS" (nombre de trabajo)

> **Versión del roadmap:** 1.11 · **Fecha:** 25 oct 2026 · *(1.11: decisiones del Administrador sobre las 20 preguntas acumuladas, colocadas en los tramos donde se aplican; nueva subparte 2.10 (rediseño de temas); 4.R.9 pruebas de rendimiento · 1.10: registro y uso obligatorio de TRAMPAS: cada chat lee las trampas de los anteriores, las cita antes de construir, las registra apenas las encuentra y las reporta en su bitácora, ver 4.T · 1.1: la guía y el comando "agregar paquete" pasan de 9.8 a 1.3 · 1.2: William publica y prueba por hitos, no por subparte: ver 5.H · 1.3: todo chat termina con el bloque "QUÉ HACES TÚ AHORA", ver 5.2 · 1.4: cadena autónoma: SECUENCIA MAESTRA con contenido incluido (sección 10), chats de contenido (Pista C y 14.B), reglas de versión del roadmap (sección 0) y sección 16 con el historial · 1.5: los chats de contenido pueden actualizar las pruebas que verifican directamente los archivos que reemplazan; lote C14 · 1.6: roturas intencionales con presupuesto (4.R), entregas parciales completas, preguntas que no bloquean y archivos externos, ver 3.A y 5.1 · 1.7: plan de tramos para cada subparte pendiente, sección 17 · 1.8: mapa del repositorio, lectura dirigida y arranque rápido sin explorar: subparte 0.9 · 1.9: estado real de 1.7-T1 y 1.7-T2 y guía verificada para 1.7-T3 y 1.7-T4 tomadas de los informes de traspaso (8.7, 8.15, 7.12, 4.R.6, 10 y 17), y la entrada 1.8, que estaba al final del archivo fuera de la sección 16, colocada en su sitio)* · **Autor:** Claude (chat Administrador Central)
> **Propietario del proyecto:** William (18 años, Bucaramanga, Colombia).
> **Este archivo es la fuente de verdad.** Si algo en tu chat contradice este archivo, gana este archivo. Si este archivo es ambiguo o parece equivocado, NO improvises: ve a la sección 3.4 (protocolo de consulta al Administrador).

---

## 0. LEE ESTO PRIMERO (instrucciones para el chat que recibe este archivo)

Eres uno de varios chats de Claude que construirán, UNA SUBPARTE A LA VEZ, una app de aprendizaje de inglés para una sola persona (William). Ningún chat puede construir todo; por eso el trabajo está fragmentado en subpartes pequeñas, con contratos de datos congelados, para que cada chat solo tenga que **ejecutar su subparte con rigor y entregarla sin bugs**.

**Tu rutina, en orden:**

1. **Lectura dirigida del roadmap (no leas todo; ahorra recursos).** Lee: la **cabecera** (versión), las secciones **0, 3, 4, 5, 12, 13 y 14**, la **sección 17: los "Puntos de acople" y solo tu tramo**, y el **texto completo de TU subparte** junto con las secciones 7 y 8 que ella cite. **No leas las demás Partes** (ni la Pista C, salvo que seas chat de contenido). Si algo de tu subparte menciona una sección que no conoces, búscala con `grep -n` y léela solo entonces. **Versión del roadmap (regla anti-confusión):** compara la cabecera con la línea `Versión del roadmap` de `PROJECT_STATE.md`. Si la de este archivo es **MAYOR**, es una actualización legítima del Administrador: lee **solo la última entrada de la sección 16** (qué cambió), anótalo en `DECISIONS.md`, copia ESTE archivo sobre `docs/ROADMAP.md` del repo, actualiza esa línea de `PROJECT_STATE.md` (versión y `sha256`) y sigue sin alarmas. Si es **IGUAL**, todo en orden. Si es **MENOR**, William te adjuntó un roadmap viejo: avísale y espera. **El hash es solo un registro, nunca un motivo de error si la versión es mayor.** Si el repo tiene una comprobación del hash del roadmap (p. ej. en `tools/check-structure.mjs`), actualízala al hash de este archivo. El archivo adjunto en este chat siempre manda sobre el `docs/ROADMAP.md` del zip.
2. **Arranque rápido: confía en el mapa y no explores.** El chat anterior ya investigó el repositorio y lo dejó descrito, de forma exhaustiva y comprobable, en `docs/REPO_MAP.md` (mapa de archivos con sus exportaciones, cómo encaja todo, convenciones y trampas, y el "Delta" del último tramo) y en `PROJECT_STATE.md` (estado vigente). Haz exactamente esto: (a) lee `PROJECT_STATE.md`; (b) lee `docs/REPO_MAP.md`: **su parte manual completa y solo las áreas que vas a tocar** (usa `grep -n "^## Área"` para encontrarlas); (c) ejecuta **`npm run map -- --check`**: si responde OK, **confía ciegamente** en lo que leíste; si lista diferencias, mira solo esos archivos y corrige el mapa; (d) **no uses `ls -R`, `find`, `tree` ni abras archivos de código por curiosidad**: abre solo los que vas a modificar y, de los demás, usa las firmas del mapa (abre uno solo si la firma no basta); (e) consulta `DECISIONS.md` y `docs/CONTRACTS.md` **buscando por el tema**, no leyéndolos completos; (f) **lee completa la sección manual «Convenciones y trampas» del mapa (es corta y es obligatoria, no es opcional) y aplica 4.T**: antes de construir, escribe qué trampas (por ID) afectan a tu tramo y cómo las vas a evitar. Si William NO adjuntó el zip y tu paso no es el primero, **detente y pídeselo**. Si `docs/REPO_MAP.md` aún no existe, tu paso es la **0.9** (el único chat que explora el repositorio completo). **Nota (v1.9):** el zip de 1.7-T2 aún no trae el mapa; por eso el siguiente chat hace primero la 0.9 y luego retoma 1.7-T3.
3. Identifica TU paso en la **SECUENCIA MAESTRA (sección 10)**: es el primero no `HECHO` cuyas dependencias estén `HECHAS`. William puede indicarte otro explícitamente; si te indica uno cuyas dependencias no están hechas, avísale y no lo construyas. Si tu paso es una subparte (0.x a 9.x) eres **Chat Constructor**; si es un lote `C` eres **Chat de Contenido**: sigue "Cómo trabaja un chat de contenido" (Pista C) y el prompt 14.B. **El nombre de la app es Glossa**: donde este documento diga "Sophia Inglés", léelo como "Glossa" (los nombres de archivo `sophia-ingles_…` se mantienen).
4. Construye SOLO esa subparte. No adelantes la siguiente aunque "te sobre tiempo". Si terminas con margen, usa ese margen para **auditar más** (sección 4), no para construir más.
5. Audita con el protocolo de la sección 4 (obligatorio, con evidencia ejecutada).
6. Antes de entregar ejecuta, en este orden, `npm run build` → **`npm run map`** (actualiza `docs/REPO_MAP.md` y escribe su sección "Delta") → `npm run check`. Entrega según la sección 5 (zip completo + reporte) apenas termines tu tramo; no acumules.
7. Cierra con la **bitácora de relevo** (plantilla en 12.1): **corta**, porque el conocimiento detallado vive en el mapa del repositorio.

**Qué NO hacer jamás:**

- **No ignorar una trampa registrada.** Si el mapa dice «no uses X, usa Y», usas Y. Solo puedes apartarte si demuestras con una prueba ejecutada que la trampa ya no aplica; en ese caso la corriges en el mapa y lo anotas en `DECISIONS.md`. Caer en una trampa ya escrita cuesta tiempo a William y se reporta (4.T).
- No rediseñar la arquitectura, los contratos de datos (sección 8) ni las decisiones de la sección 7 por tu cuenta.
- No "mejorar" cosas fuera de tu subparte. Si ves algo roto en una subparte anterior, lo reportas (sección 3.5); solo lo arreglas si es un bug bloqueante para tu propia subparte y lo documentas.
- No decir "terminado" ni "debería funcionar". Solo "terminado y verificado con estas pruebas ejecutadas: …".
- No inventar datos técnicos (precios, límites de APIs, nombres de modelos, versiones, licencias). Si tienes búsqueda web, búscalo; si no, consulta al Administrador.
- No escribir claves de API en el código. Nunca.
- No hacer preguntas triviales a William. Sí consúltale lo que solo él puede decidir (gusto, contenido personal, pruebas en su teléfono).

---

## 1. ROLES

| Rol | Quién | Hace |
|---|---|---|
| **Propietario** | William | Decide gustos y prioridades, prueba en su teléfono Android, sube/baja archivos, pega prompts entre chats. |
| **Administrador Central** | El chat donde nació este roadmap | Dueño del roadmap y de los contratos. Resuelve dudas de arquitectura, aprueba cambios de contrato, reordena el roadmap, mantiene coherencia. También es quien enseña inglés, diagnostica y corrige a William (ese es otro hilo de trabajo; aquí solo importa como fuente de contenido y de requisitos). |
| **Chat Constructor** | Tú | Ejecuta UNA subparte, la audita y la entrega. |
| **Chat Contenido** | Un constructor especializado | Genera paquetes de contenido JSON (pista C del roadmap) que deben pasar el validador. |

William tiene varias cuentas de Claude con límites de uso. Cada chat se corta cuando llega a su límite: por eso **todo** el estado vive en el repositorio (`PROJECT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md`) y no en tu memoria. No tienes memoria entre chats.

---

## 2. REGLAS DE TRABAJO CON WILLIAM (no negociables)

- Responde a William **siempre en español**. El contenido de inglés que la app enseña va en inglés (con explicaciones en español).
- Sé cálido, directo y honesto. Si algo falló, dilo claro. No edulcores.
- **Máximo una pregunta por mensaje** (salvo listas de verificación numeradas que él pidió).
- Interfaz móvil primero: William usa Android (pantalla ~360–412 px de ancho). Todo se diseña y se prueba en ese ancho primero.
- Nada de rachas obligatorias, nada de culpa, nada de bloqueos de contenido (los prerrequisitos son sugerencias). Gamificación opcional (XP/rangos) permitida, nunca obligatoria ni castigadora.
- Flexibilidad total: William es universitario; no puede garantizar horas fijas. La app **recibe bien** a quien vuelve tras una pausa.
- "No sé" es un dato válido y honorable. Toda pregunta con respuesta tiene un botón "No sé" sin penalización emocional (sí cuenta como fallo para el SRS).
- Cuando William expresa duda o razonamiento parcial, eso es información valiosa (la app debe dejar campo opcional "¿por qué crees eso?" en ejercicios de teoría).
- Investiga antes de prometer datos técnicos. No dejes cabos sueltos: si algo queda a medias, se informa y se cierra antes de avanzar.
- William pidió explícitamente: **cero bugs**. Esta es la prioridad de calidad más alta del proyecto.

---

## 3. PROTOCOLOS DE COMUNICACIÓN

### 3.1 Qué decides tú y qué no

| Decisión | ¿Quién? |
|---|---|
| Nombres de variables, helpers internos, estructura interna de un módulo | Tú |
| Detalles visuales dentro de los tokens de diseño ya definidos | Tú |
| Cualquier cambio a un contrato de la sección 8 (esquemas de datos, APIs públicas de módulos `core/`) | **Administrador** |
| Añadir/eliminar dependencias externas (librerías, CDN) | **Administrador** |
| Cambiar una decisión de la sección 7 | **Administrador** |
| Reordenar subpartes, fusionar o dividir subpartes | **Administrador** |
| Gustos de William (colores extra, mascota, textos de bienvenida) | William (pregúntale, una pregunta) |

### 3.2 Decisiones menores: regístralas
Toda decisión de implementación no trivial que tomes se anota en `DECISIONS.md` (formato: fecha · subparte · decisión · razón · alternativa descartada).

### 3.3 Subpartes demasiado grandes
Las subpartes ya vienen divididas en tramos (sección 17). Si al empezar ves que tu tramo no cabe en tu chat, **no la entregues a medias en silencio**. Divide: entrega lo que esté 100% terminado y verificado, marca la parte restante como nueva subparte `X.Ya` en `PROJECT_STATE.md` y avisa a William. Mejor entregar poco y sólido que mucho y roto. **Cada entrega parcial (cuarto, mitad o tanda) cumple 5.1 completa**: zip, reporte, bitácora de relevo y bloque "QUÉ HACES TÚ AHORA".

### 3.4 Protocolo de consulta al Administrador (IMPORTANTE)
Si tienes una duda que no puedes resolver con este archivo, o detectas una contradicción, un hueco, un riesgo, o crees que un contrato debe cambiar:

1. **Deja de construir lo que depende de esa duda.**
2. Dile a William, en español y en lenguaje simple, que necesitas consultar al Administrador.
3. Entrégale un **PROMPT PARA ADMIN** en un bloque de código, con esta estructura exacta (para que William lo copie y lo pegue en el chat del Administrador):

```
PROMPT PARA ADMIN
Subparte: <id y nombre>
Chat constructor número: <si lo sabes>
Duda/problema: <explicación clara en 3-8 líneas>
Contexto técnico relevante: <fragmentos de código, nombres de archivos, mensajes de error exactos>
Opciones que veo: <A / B / C con pros y contras>
Mi recomendación: <cuál y por qué>
Qué necesito de vuelta: <decisión / contrato modificado / aclaración>
Bloquea mi subparte: <sí/no, y qué parte>
```

4. William te devolverá la respuesta del Administrador. Aplícala y registra el cambio en `DECISIONS.md` y, si es un cambio de contrato, en `docs/CONTRACTS.md` (el Administrador te dirá cómo).

### 3.5 Reporte de bugs de subpartes anteriores
Si descubres un bug en algo ya entregado: no lo ocultes. Anótalo en `PROJECT_STATE.md` sección "Bugs conocidos" con pasos para reproducir, y avisa a William. Si bloquea tu trabajo, corrígelo mínimamente y documéntalo en `CHANGELOG.md` como `FIX`.

---

### 3.A Autonomía: la cadena debe avanzar sola
William solo consulta al Administrador cuando un chat se lo pide con un PROMPT PARA ADMIN (3.4). Por eso: (1) **decide tú** todo lo que quepa en 3.1 y en los valores por defecto de 7.12, y regístralo en `DECISIONS.md`; (2) **un hito no espera al Administrador**: el chat siguiente corrige lo que William reporte y aplica estas reglas; (3) solo pide PROMPT PARA ADMIN si hay que cambiar un contrato de la sección 8, una decisión de la sección 7, o si estás bloqueado sin alternativa razonable; (4) si William te dice que cambió de opinión sobre algo, avísale de que eso requiere al Administrador (15.2) en vez de improvisar; (5) cada chat deja a William su siguiente paso exacto (ver 5.2 y la sección 10), así que William nunca debe adivinar qué chat abrir; (6) **no le preguntes a William lo que ya está en este documento** (escalas, enumerados, nombres, valores por defecto: búscalos antes en las secciones 7 y 8 y en 7.12); a William solo le pides archivos, pruebas en su teléfono y preferencias suyas; (7) **preguntas que no bloquean:** decide con un valor por defecto razonable, regístralo como PROVISIONAL en `DECISIONS.md` y sigue; no las acumules como "preguntas abiertas" salvo que cambien un contrato de la sección 8 o algo que William vea en pantalla; (8) **archivos externos** (carpeta `vendor/`, p. ej. `ts-fsrs`): pídeselos a William en tu **primer mensaje**, con URL exacta, nombre exacto y pasos para quien no sabe de tecnología, y mientras llegan adelanta otros cuartos de tu subparte en lugar de detener la entrega.

## 4. PROTOCOLO DE CALIDAD "CERO BUGS" (obligatorio en CADA subparte)

Una IA que programa deja bugs sutiles. Este protocolo existe para cazarlos antes de entregar. **No se puede saltar ningún paso.** Si un paso no se puede ejecutar en tu entorno, lo declaras explícitamente en el reporte (sección 5.2) y lo trasladas a la lista de pruebas manuales para William.

### 4.1 Antes de escribir código
- Relee los criterios de aceptación de tu subparte y conviértelos en una lista numerada de comprobaciones (`CA-1`, `CA-2`, …).
- Relee los contratos de la sección 8 que toca tu subparte.
- Aplica 4.T: cita las trampas del mapa que afectan a tu tramo antes de escribir código.
- Escribe (en tu razonamiento o en comentarios de prueba) los **casos límite** que se te ocurran: vacíos, nulos, textos con acentos/ñ/emoji, apóstrofos rectos y curvos (`'` vs `’`), mayúsculas, espacios dobles, números, listas de 0/1/muchos elementos, datos viejos de otra versión, almacenamiento lleno, sin conexión, doble toque rápido, botón "atrás" del navegador, rotación de pantalla.

### 4.2 Mientras construyes
Reglas de código que evitan los bugs más comunes:

1. **Módulos pequeños y puros.** La lógica (SRS, calificación, normalización, dominio, selección de sesión) va en `core/` **sin tocar el DOM ni IndexedDB directamente**, para poder probarla con Node.
2. **Nada de estado global mutable disperso.** Estado en un único store (`core/store.js`) con funciones explícitas.
3. **Nunca `innerHTML` con texto que no sea 100% constante.** Texto de usuario, contenido de paquetes o respuestas de IA se insertan con `textContent` o con la función `h()` / `esc()` de `ui/dom.js`. (Previene XSS y roturas por `<`, `&`, `"`.)
4. **Toda operación asíncrona con `try/catch`** y un estado de error visible y amable en la UI. Prohibido `catch(e){}` vacío.
5. **Tiempo inyectable.** Toda función que use la hora recibe `now` como parámetro (o un reloj inyectable) para poder probarla.
6. **Aleatoriedad inyectable** (`rng`) en barajar/seleccionar, para pruebas deterministas.
7. **Sin `eval`, sin `new Function`, sin `document.write`, sin `localStorage` para datos de aprendizaje** (solo para 2–3 banderas triviales de UI si hace falta). Los datos van a IndexedDB vía `core/db.js`.
8. **Sin claves, tokens ni URLs privadas en el código.** Las claves las escribe William en Ajustes y se guardan solo en su dispositivo.
9. **Sin dependencias nuevas sin permiso** (ver 3.1).
10. **Cada archivo JS < 800 líneas.** Si crece, se parte.
11. **Funciones con una sola responsabilidad**, nombres claros, comentarios solo donde el "por qué" no sea obvio.
12. **Accesibilidad mínima:** botones reales (`<button>`), `aria-label` en iconos, contraste suficiente, objetivos táctiles ≥ 44 px.
13. **Dejar `console.error` útiles** (no `console.log` de ruido en la entrega).

### 4.3 Auditoría de cierre (5 pasadas, en este orden)

**Pasada 1 — Estática.**
- `node --check` a cada `.js` (o `node --input-type=module --check` para módulos) y validación de cada `.json` con `JSON.parse`.
- Ejecuta `node tools/audit.mjs` (creado en 0.2): busca patrones prohibidos (`eval`, `innerHTML =` con variables, claves con forma `sk-`/`gsk_`/`AIza`, `localStorage.setItem` fuera de la lista blanca, `console.log`, `debugger`, `TODO` sin ID de subparte, archivos > 800 líneas, imports rotos).
- Verifica a mano que cada `import` apunta a un archivo y export existentes.

**Pasada 2 — Pruebas unitarias.**
- Toda lógica de `core/` tiene pruebas en `tests/` con `node --test`. Mínimo: caso feliz, 3 casos límite, 1 caso de entrada inválida por función pública.
- Ejecuta **toda** la suite (no solo las tuyas). Debe pasar 100%. Pega la salida resumida en el reporte.
- Si tu código es lógica de decisión de `core/`, aplica además **4.R** (roturas intencionales, con presupuesto).

**Pasada 3 — Recorrido de escenarios.**
- Si hay navegador headless disponible en tu entorno (Playwright/Chromium/jsdom), ejecuta los flujos de la subparte con capturas. Si no lo hay, haz un **recorrido simulado**: ejecuta con Node los módulos con un DOM falso o con datos de ejemplo y reproduce el flujo completo de punta a punta.
- Escribe el guion del recorrido (`tests/scenarios/<subparte>.md`) con pasos y resultado esperado, para que William lo repita en su teléfono **cuando llegue el siguiente hito (ver 5.H; no se lo pidas antes)**.

**Pasada 4 — Adversarial ("intenta romperlo").** Prueba explícitamente:
- Datos vacíos / corruptos / de versión anterior (¿migra o falla con elegancia?).
- Textos con acentos, ñ, emoji, comillas curvas, mayúsculas raras, espacios al inicio/fin, 1000 caracteres.
- Doble clic, clic durante carga, volver atrás a mitad de sesión, cerrar y reabrir.
- Sin conexión; con la API de IA fallando (401, 429, 500, timeout, JSON inválido).
- IndexedDB no disponible o llena (debe avisar sin perder lo ya guardado).
- 0 ítems, 1 ítem, 5000 ítems (rendimiento: ninguna pantalla debe congelarse > 200 ms de forma perceptible).
- Pantalla de 360×640 y 412×915; modo claro y oscuro; tamaño de fuente del sistema grande.
- Reloj del dispositivo cambiado (fechas futuras/pasadas): no debe corromper el SRS.

**Pasada 5 — Regresión y limpieza.**
- Suite completa otra vez tras cualquier corrección.
- Revisión final línea por línea de TUS archivos nuevos/modificados (relee el código como si lo hubiera escrito otro y buscara el bug).
- Confirma que `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/CONTRACTS.md` (si aplica) y la versión del service worker están actualizados.

### 4.4 Regla de oro de la depuración
Cuando encuentres un bug: (1) reprodúcelo con una prueba que falle, (2) corrígelo en la causa raíz (no con parches que lo escondan), (3) verifica que la prueba ahora pasa, (4) busca si el mismo patrón existe en otros lugares (`grep`), (5) registra en `CHANGELOG.md`; (6) si la causa fue algo no obvio del entorno o de una herramienta (no un error de lógica tuyo), regístralo como trampa (4.T) en ese momento. Nunca "arregles" desactivando una prueba.

### 4.5 Honestidad sobre lo no probado
Hay cosas que ningún chat puede probar (el micrófono real, el audio real en el Android de William, notificaciones reales, rendimiento en su teléfono). Esas NO se declaran "funcionan": se listan como **"Pendiente de verificación por William"** con pasos claros de 3–6 líneas, y pasan a la **cola de pruebas manuales** (5.H), que William ejecuta en el próximo hito.

### 4.T Trampas: leerlas antes, registrarlas al instante, reportarlas al cerrar (obligatorio)
Una **trampa** es algo que parece correcto pero falla o hace perder tiempo en este proyecto (un carácter que rompe un comando, una herramienta que se comporta distinto de lo esperado, una orden que mata tu propia shell, una API con un caso raro). Las trampas son la memoria del proyecto: cada una que se descubre ahorra el mismo error a todos los chats siguientes.

1. **Antes de construir (lectura y cita).** Lee toda la sección manual «Convenciones y trampas» de `docs/REPO_MAP.md`. En tu confirmación inicial (paso 3 del prompt 14) escribe una línea: `Trampas que afectan a mi tramo: TRAMPA-nn (qué haré distinto), …` o `ninguna aplica` con una frase de por qué. No basta con haberlas leído: tienes que citarlas.
2. **Antes de cada acción de riesgo, búscalas.** Antes de ejecutar un comando de procesos (`pkill`, `kill`), de escribir con comillas, tildes, acentos, `\`, `$` o heredocs, de usar una herramienta del repo por primera vez en tu chat, de tocar el service worker, el build, el zip o el mapa, haz `grep -n -i "<palabra clave>" docs/REPO_MAP.md` sobre la sección de trampas. Si hay una trampa que cubre tu caso, aplica su alternativa **a la primera**.
3. **Apenas descubras una trampa nueva, regístrala en ese momento** (no al final, para no olvidarla ni perderla si el chat se corta): añade una entrada en la sección manual «Convenciones y trampas» con este formato, en una sola línea:
   `TRAMPA-<nn> · <síntoma: qué viste fallar> · <causa, si la sabes> · USA EN SU LUGAR: <alternativa probada> · <tramo que la descubrió>`
   Numeración correlativa, sin reutilizar números. Si las trampas existentes no tienen ID, el primer chat que lea esta regla las numera `TRAMPA-01…` en el sitio, sin reescribirlas (solo antepone el ID). Una trampa que se descubrió pero no se probó se marca `(sin confirmar)`. Si una trampa deja de aplicar, no se borra: se marca `(OBSOLETA desde <tramo>: <razón>)`.
4. **Si caes en una trampa que ya estaba escrita**, no la disimules: anótalo en la bitácora (línea «Trampas previas», ver 12.1) con una frase de por qué no la viste, y si la redacción de la trampa era ambigua, **mejórala en el mapa** para que el siguiente chat no caiga por lo mismo.
5. **Cierre.** El «Delta» del mapa lista las trampas nuevas (ID y una línea); la bitácora de relevo las repite (12.1); `PROJECT_STATE.md` no las duplica. Antes de entregar, haz `grep -c "^TRAMPA-" docs/REPO_MAP.md` y comprueba que el número coincide con las trampas que dices haber registrado.
6. Los chats de contenido aplican 4.T completo (con sus herramientas: `validate-content`, `add-pack`, etc.).

### 4.R Roturas intencionales (pruebas de mutación), con presupuesto
**Para qué:** comprobar que las pruebas detectan fallos reales, rompiendo el código a propósito y viendo que alguna prueba falla. **Es un medio, no un fin.**

**Cuándo se exige:** solo a lógica de decisión de `core/` (comparación, SRS, dominio, validadores, detectores, parsers, cálculo de fechas). **No se exige** a UI, código de conexión, documentos, contenido ni código trivial.

**Presupuesto obligatorio**
1. **Tope por entrega:** ≈ 40 roturas por función pública nueva o cambiada, ≈ 150 en total, y **≤ 10 minutos** de ejecución acumulados. Si necesitas más, el módulo es demasiado grande: divídelo (3.3).
2. **Con intención, no al azar:** cambia `>` por `>=` y al revés, suma o resta 1, niega una condición, quita una guarda, invierte un orden, devuelve un valor fijo, altera una constante. No mutes carácter por carácter.
3. **Cada rotura corre solo los archivos de prueba del módulo**, con **timeout de 30 s**; la suite completa se corre una vez al final.
4. **Una sola ronda y una sola corrección:** corre las roturas → clasifica las que sobreviven → (a) **hueco real**: añade la prueba que la mata; (b) **equivalente o defensiva**: justifícala en una línea, **agrupada** (no una por una) → repite **solo las que sobrevivieron**. No vuelvas a barrer todo el archivo.
5. **Meta:** ≥ 85 % de las roturas detectadas en las funciones objetivo, y lo que quede vivo explicado en `DECISIONS.md` en ≤ 10 líneas. **No persigas el 100 %.**
6. **Herramienta compartida:** `tools/mutate.mjs` (lista de `[nombre, texto original, texto nuevo]`; ejecuta solo las pruebas indicadas; **restaura SIEMPRE el archivo** en `finally`; imprime una tabla). Si no existe, el primer chat que lo necesite crea la versión mínima (≤ 150 líneas, con su prueba) y lo anota en `PROJECT_STATE.md`; los demás la reutilizan. Nunca mutes archivos del repo sin respaldo. **Estado a 23 oct 2026: `tools/mutate.mjs` NO existe todavía**; 1.7-T1 y 1.7-T2 usaron scripts privados fuera del repo (`/home/claude/mut.mjs`), que no viajan en el zip. **Lo crea 1.7-T3** (ver sección 17).
7. **Procesos:** antes de lanzar una corrida comprueba que no haya otra viva; **una a la vez**; **no dejes procesos en segundo plano al entregar**; si un comando pasa de ~2 minutos, redúcelo o pártelo.
8. **Se informa en una línea** en el reporte: "Roturas: N probadas, M detectadas, K explicadas."
9. **Pruebas de rendimiento:** se miden como **mediana de 5 corridas**, aisladas (sin otras pruebas en paralelo) y con margen razonable sobre el presupuesto; una sola corrida lenta no debe hacer fallar la suite. Declara en el reporte la mediana medida.

---

## 5. ENTREGA DE CADA SUBPARTE

### 5.1 Qué se entrega
1. **Un único archivo `.zip` con el repositorio completo** (no solo los archivos cambiados), nombrado `sophia-ingles_<id-subparte>_v<MAJOR.MINOR.PATCH>.zip`. Ej.: `sophia-ingles_P1.4_v0.9.4.zip`. Se entrega con `present_files`.
2. Dentro del zip: código, `PROJECT_STATE.md` actualizado, `CHANGELOG.md`, `DECISIONS.md`, `docs/CONTRACTS.md` si cambió, y `docs/ROADMAP.md` como **copia exacta del roadmap que recibiste adjunto en este chat** (nunca lo edites; ver regla de versión en la sección 0).
3. Un **reporte de entrega** en el chat (plantilla 5.2), breve.
4. La **bitácora de relevo completa** (12.1), en un bloque de código, y el bloque "QUÉ HACES TÚ AHORA" como último elemento.

**Una entrega está INCOMPLETA si falta cualquiera de las cuatro cosas** (zip, reporte, bitácora, bloque final). Vale también para entregas parciales y cuando el chat sigue en la misma conversación: **la bitácora se regenera completa y actualizada en cada entrega**; nunca se reutiliza una anterior ni se promete "para después".

### 5.2 Reporte de entrega (plantilla; en español, ≤ 1 pantalla de teléfono por sección)
```
ENTREGA <id> — <nombre> — v<x.y.z>
✅ Criterios de aceptación: CA-1 ✔, CA-2 ✔, … (todos)
🧪 Pruebas: <N> unitarias pasadas / <N> total · audit.mjs: 0 hallazgos · escenarios: <n> recorridos · Roturas: N probadas, M detectadas, K explicadas (4.R; si no aplica, "no aplica")
🔍 Bugs encontrados y corregidos en la auditoría: <lista corta>
⚠️ No probado en este entorno (para William): <pasos de prueba manual>
📌 Decisiones tomadas: <ver DECISIONS.md, resumen>
🐞 Bugs conocidos que quedan: <ninguno / lista>
➡️ Siguiente subparte: <id y nombre>

📋 BITÁCORA DE RELEVO (12.1) completa, en un bloque de código (ver 5.1)

👉 QUÉ HACES TÚ AHORA  (SIEMPRE es lo último del mensaje; usa exactamente UNA de las dos variantes)

**Variante A — NO hay hito (lo más común): solo pasar al siguiente**
👉 QUÉ HACES TÚ AHORA: no hay nada que probar ni publicar. Solo pasa al siguiente.
1. Descarga `<nombre-exacto-del-zip>.zip`.
2. Abre un chat nuevo de Claude.
3. Pega ahí: el roadmap (el archivo más reciente que tengas), el zip, la bitácora de relevo y el prompt de abajo.
<prompt de arranque ya rellenado con el SIGUIENTE PASO de la SECUENCIA MAESTRA (sección 14 si es una subparte; 14.B si es un lote de contenido), en bloque de código listo para copiar; di en una frase si el siguiente chat es "de construcción" o "de contenido">

**Variante B — esta entrega cierra un hito (M0, M1, M2…)**
👉 QUÉ HACES TÚ AHORA (≈ 20–30 min): toca publicar y probar.
1. Descarga `<nombre-exacto-del-zip>.zip` y descomprímelo.
2. Sube los archivos a tu repositorio de GitHub (guía: `docs/DEPLOY.md`, paso <n>) y espera a que Pages publique.
3. Abre la app en Chrome del Android (si ya la tenías instalada, toca "Actualizar").
4. Haz el guion `tests/scenarios/HITO_<Mx>.md` (≤ 15 min).
5. Vuelve a este chat con el resultado ("todo bien" o reportes BUG 12.4) — o, si prefieres seguir ya, pásalo al siguiente chat junto con los demás archivos.
<mismo prompt de arranque ya rellenado (14 o 14.B)>
```
**Reglas del bloque:** (1) español simple, pasos numerados, **máximo 6 líneas** sin contar el prompt; (2) nombres de archivo y IDs **exactos**, nunca "el zip" ni "la siguiente"; (3) si no hay nada que hacer, dilo con esas palabras ("no hay nada que probar ni publicar"); (4) si algo quedó bloqueado o hay una duda para el Administrador, el bloque lo dice primero y entrega el PROMPT PARA ADMIN (3.4) en lugar de la variante A/B; (5) no mezcles instrucciones de William en medio del reporte: todo lo que él debe hacer vive en este bloque.

### 5.3 Pruebas manuales de William (prueba de humo en el teléfono)
Cada subparte con UI incluye en `tests/scenarios/<id>.md` una **lista de 5–10 pasos numerados, de ≤ 5 minutos**, escritos en español simple, con "qué debes ver". **William NO la ejecuta al recibir cada subparte: se acumulan y las ejecuta juntas en el siguiente hito (5.H).** Si algo falla, William pega el reporte (12.4) al chat que construye en ese momento (o al Administrador si es de diseño).

### 5.H Publicación y pruebas por hitos (equilibrio: poca carga para William, errores detectados a tiempo)
**Principio:** entre hitos William solo pasa zips entre chats (no publica ni prueba nada). Publica y prueba **en los hitos**.

**Puntos de publicación:** M0 (única configuración inicial de GitHub Pages, guiada por `docs/DEPLOY.md`), y luego M1, M2, M3 … M8. **M0.5 no se publica** (es solo lógica, sin pantallas nuevas). Entre dos hitos no se pide publicar, salvo que el Administrador lo indique expresamente por un riesgo concreto.

**Cola de pruebas manuales:** `PROJECT_STATE.md` tiene la sección "Cola de pruebas manuales" (tabla `subparte | guion | estado`). Cada chat constructor, al entregar: (1) añade su guion a la cola; (2) **no** le pide a William que lo pruebe ahora; (3) en su reporte de entrega escribe "Prueba manual: en cola para el hito Mx".

**El chat que cierra un hito** (la última subparte antes de la marca HITO) además entrega `tests/scenarios/HITO_<Mx>.md`: un **guion único consolidado** con los pasos de todas las subpartes en cola, ordenados por pantalla (no por subparte), **máximo 15 minutos**, más los pasos de instalar/actualizar (`docs/DEPLOY.md`). Si la cola es demasiado larga, prioriza lo que más riesgo tiene (flujos de datos, offline, audio) y deja el resto marcado "opcional". Incluye siempre un apartado **"Contenido nuevo"**: abrir 5 ítems al azar de cada lote de contenido incorporado desde el último hito y confirmar que se leen bien (inglés natural, explicación clara, sin respuestas raras).

**Lo que hace William en un hito (≈ 20–30 min):** descomprimir el zip, subir los archivos a GitHub, esperar a Pages, abrir en Chrome/Android (actualizar si ya estaba instalada), hacer el guion `HITO_<Mx>.md` y devolver el resultado (todo bien / reportes BUG 12.4). El siguiente chat constructor **corrige primero lo reportado** antes de empezar su subparte; si algo es de diseño, va al Administrador.

**Mientras no haya publicación**, el chat se apoya en sus pruebas automáticas (sección 4) y declara con honestidad lo que solo el teléfono puede confirmar (4.5).

### 5.4 Versionado
- `MAJOR.MINOR.PATCH`. Hasta el hito M1 (primera sesión jugable) la versión es `0.x`. Cada subparte entregada sube MINOR (o PATCH si solo es corrección).
- La versión se escribe en `core/version.js` y se sincroniza con el nombre de caché del service worker (`tools/build-manifest.mjs` lo hace automático desde 0.6). **Olvidar subir la versión provoca que el teléfono siga con código viejo en caché: es un bug clásico; revísalo siempre.**

---

## 6. ESTRUCTURA DEL REPOSITORIO (contrato)

Sin bundler, sin `npm install` obligatorio para correr la app: **JavaScript vainilla con módulos ES** servido como archivos estáticos (GitHub Pages). Node.js se usa solo para pruebas y herramientas (`tools/`).

```
/
├─ index.html                 # shell mínimo; carga app/main.js (type=module)
├─ manifest.webmanifest
├─ sw.js                      # service worker (generado/versionado por tools/)
├─ icons/                     # íconos PWA (192, 512, maskable)
├─ app/
│  ├─ main.js                 # arranque, registro de vistas, SW, manejo de errores globales
│  ├─ router.js               # hash-router (#/hoy, #/mapa, #/sesion/…)
│  └─ config.js               # constantes (NO claves)
├─ core/                      # LÓGICA PURA (sin DOM). Testeable con Node.
│  ├─ version.js
│  ├─ db.js                   # IndexedDB + adaptador en memoria para tests + migraciones
│  ├─ store.js                # estado en memoria + pub/sub
│  ├─ clock.js, rng.js        # tiempo y azar inyectables
│  ├─ events.js               # registro inmutable de eventos
│  ├─ normalize.js            # normalización y comparación de respuestas
│  ├─ srs.js                  # envoltorio FSRS (interfaz Scheduler)
│  ├─ grading.js              # acierto+tiempo → rating 1..4
│  ├─ errors.js               # registro de errores + catálogo de códigos
│  ├─ mastery.js              # % de dominio por tema + confianza
│  ├─ session.js              # armado de sesiones (intercalado, cupos)
│  ├─ plan.js                 # plan día/semana/mes
│  ├─ stats.js                # consultas de estadísticas
│  ├─ content.js              # carga/validación/migración de paquetes
│  ├─ whitelist.js            # validador de lemas dominados
│  ├─ ai/                     # cliente IA, proveedores, prompts, caché
│  ├─ sync.js                 # export/import, formato de puente con el chat
│  └─ speech/                 # (fases 7-8) audio, STT, pronunciación
├─ ui/
│  ├─ dom.js                  # h(), esc(), helpers seguros
│  ├─ components/             # botones, tarjetas, modales, toasts, barras, chips…
│  ├─ views/                  # una vista por pantalla
│  ├─ exercises/              # un componente por TIPO de ejercicio
│  └─ styles/                 # tokens.css, base.css, themes.css, components.css
├─ content/
│  ├─ index.json              # lista de paquetes y versiones
│  ├─ taxonomy/               # topics.json (mapa), error_codes.json, lemmas.json
│  └─ packs/                  # paquetes de contenido (pista C)
├─ audio/                     # MP3 pre-generados (fase 7) + manifest
├─ vendor/                    # librerías de terceros vendorizadas (FSRS) con su LICENSE
├─ tools/                     # scripts Node: audit.mjs, build-manifest.mjs, validate-content.mjs, add-pack.mjs, repo-map.mjs, …
├─ tests/                     # node --test; tests/scenarios/*.md
└─ docs/
   ├─ ROADMAP.md              # ESTE archivo (copia exacta; solo el Administrador lo cambia)
   ├─ CONTRACTS.md            # contratos congelados (esquemas, APIs)
   ├─ DESIGN.md               # sistema de diseño (tokens, componentes)
   ├─ REPO_MAP.md             # mapa del repositorio (auto + manual): lo primero que lee cada chat (desde 0.9)
   ├─ ADD_PACK.md             # guía corta: cómo agregar un paquete de contenido (desde 1.3)
   └─ PROJECT_STATE.md  →  (en la raíz, ver abajo)
PROJECT_STATE.md              # estado vivo: tablero de subpartes, bugs, pendientes
DECISIONS.md                  # bitácora de decisiones
CHANGELOG.md                  # cambios por versión
```

---

## 7. CONTEXTO COMPLETO Y DECISIONES CERRADAS

### 7.1 Quién es William y qué necesita
- William, 18 años, hispanohablante colombiano (originario de Cartagena), estudia Ingeniería de Sistemas en la UIS (Bucaramanga), tercer semestre. Vive solo. Usa Claude en la app móvil de Android y tiene un PC para generar contenido en lote.
- Metas de inglés: estudio/universidad, trabajo/carrera, viajar o vivir en el exterior. Plazo: menos de un año. Variedad objetivo: **inglés americano**.
- Disponibilidad: hasta 4+ h/día en teoría, pero **sin exigencia**: necesita flexibilidad real.
- Historial: solo inglés de colegio.
- Presupuesto: muy ajustado (tarjeta Nequi con poco saldo). **La app debe funcionar con costo cero** (planes gratuitos, sin riesgo de cobros accidentales).
- Rasgos pedagógicos: metacognición excelente (explica su razonamiento y dice cuándo adivina); honesto consigo mismo; aprende bien con narrativa; su cuello de botella en lectura es el **vocabulario**, no la comprensión general.

### 7.2 Reparto de trabajo (decidido)
- **Chat/Administrador (Claude):** enseña teoría profunda, hace diagnósticos, corrige escritura a fondo, diseña el currículo y genera paquetes de contenido.
- **La app:** práctica intensiva y repetitiva, repaso espaciado, plan del día, registro de errores y estadísticas. Funciona sin depender del chat para lo repetitivo, con **IA integrada** (API propia con clave de William) para lo que requiere inteligencia.
- **Prioridad de diseño alta (palabras de William):** "todo lo posible en esta app debe estar potenciado con IA; solo cuando no haya disponible funciona de forma mecánica". → Todo ejercicio/función tiene **modo IA** y **modo mecánico de respaldo** (sin conexión o sin cupo).
- La teoría compleja se queda en el chat; la app solo tiene **fichas cortas de teoría** y un botón **"Llevar al chat"** que genera un bloque de texto listo para pegar con el contexto (tema, ítem, respuesta del usuario, errores).

### 7.3 Decisiones de producto no negociables
1. Sin rachas obligatorias ni presión de constancia (XP/rangos opcionales, sin culpa).
2. Sin bloqueos de contenido (prerrequisitos = sugerencias).
3. Plan flexible, no estricto. Reprogramación sin culpa; bienvenida al regresar tras pausas.
4. IA por defecto cuando sea posible; modo mecánico solo como respaldo.
5. Tolerancia ortográfica: aceptar la respuesta con error menor de ortografía, **marcarlo** y crear automáticamente una tarjeta de deletreo para esa palabra.
6. Ejercicios MUY variados: nunca un solo formato repetido para la misma habilidad.
7. Contenido "colosal" (miles de palabras, frases, reglas, historias), construido por partes.
8. Función **"tocar palabra"** (estilo LingQ): tocar cualquier palabra en un texto muestra su significado en español y permite marcarla *conocida / aprendiendo / desconocida*; al marcarla se guarda como tarjeta.
9. Todo el contenido es **ORIGINAL**. Prohibido copiar líneas de películas, series, canciones, libros, ni contenido de pago (cursos, apps comerciales). Se replican metodologías, nunca contenido con derechos de autor.
10. Claves de API: las escribe William en la app, se guardan solo en su navegador/dispositivo, **jamás en el código** (GitHub Pages es público).

### 7.4 Plataforma y tecnología (decidido, con fuentes verificadas)
- **PWA instalada desde Chrome** (ícono propio, offline, actualizaciones desde GitHub Pages). No requiere Play Store ni verificación de desarrollador.
- Las reglas nuevas de verificación de desarrolladores de Android: el traspaso anterior las describía como futuras (30-sep-2026) y en esa fecha ya pasó. **Para una PWA no aplican** (no es un APK sideloaded). Solo habría que re-verificarlas si algún día se empaqueta como APK (Fase final opcional con Capacitor).
- **Persistencia:** IndexedDB (no localStorage) para datos de aprendizaje; pedir `navigator.storage.persist()`.
- **Sin bundler:** módulos ES nativos. Fuentes del sistema (`system-ui`) para que funcione offline sin depender de Google Fonts.
- **Repaso espaciado: FSRS** (no SM-2). Implementación elegida: **`ts-fsrs`** (licencia **MIT**, verificada; la versión más reciente encontrada fue 5.4.1 — el chat de la subparte 1.4 debe re-verificar versión exacta y la ruta del archivo ESM/UMD). Como los chats pueden no tener red, **William descargará y subirá el archivo** (ver 1.4). Los parámetros por defecto de FSRS vienen entrenados con ~700 millones de repasos de ~10.000 usuarios; se puede optimizar tras ~1.000 repasos propios. Retención objetivo configurable (defecto 90%).
- **IA:** capa de proveedores abstracta (`core/ai/`). Proveedor inicial: **Groq** (William ya usa Groq en Sophia con `https://api.groq.com/openai/v1/chat/completions`, modelo por defecto en Sophia: `llama-3.3-70b-versatile`). Los nombres de modelos y los límites gratuitos cambian: el chat de 1.10 / 5.1 **debe verificarlos en la documentación actual** antes de fijar un modelo por defecto, y dejar el modelo editable en Ajustes.
- **Audio de salida:** pre-generado en el PC de William con **Kokoro** (82 M de parámetros, licencia Apache, gratis; demo WASM ≈ 120 MB — son dos medidas distintas: parámetros vs. tamaño del archivo) y guardado como MP3 dentro de la app. Respaldo: voz del navegador (`speechSynthesis`).
- **Pronunciación real:** **Azure Pronunciation Assessment** (plan gratuito F0: ~5 h de audio/mes; al superar el cupo el servicio se limita, **no cobra a menos que William cambie manualmente a S0**; prosodia solo en en-US, justo la variedad objetivo; acuerdo con evaluadores expertos ≈ 0,78 a nivel oración y 0,62 a nivel palabra → útil como guía formativa, **no** como juez perfecto). El cálculo "≈ 1.800 intentos/mes ≈ 60/día" es **estimación propia** (5 h ÷ ~10 s), no cifra oficial.
  - **Verificado hoy (15-oct-2026):** Azure for Students ofrece **sin tarjeta de crédito** crédito de 100 USD para estudiantes universitarios de tiempo completo con correo institucional (William usa correo UIS; **hay que confirmar que califique y que la región de Colombia no pida tarjeta para verificación de identidad**, pues la página indica que en algunos casos la tarjeta se pide solo para verificar identidad). Hay reportes de restricciones de región al crear el recurso Speech en suscripciones de estudiante y de que el F0 puede no estar disponible en ciertas regiones: el chat de 8.2 debe guiar a William para elegir una región válida. Si Azure no es viable, plan B: evaluación local (modelo de fonemas ≈ 355 MB, solo si el teléfono lo aguanta) o solo STT + verificación humana periódica.
  - **No se usa Google Chirp 3 HD** para generar audio porque exige facturación activada (riesgo de cobro accidental con presupuesto ajustado). **ElevenLabs** descartado (cupo gratis ~10.000 caracteres/mes insuficiente). **Speechace/SpeechSuper** descartados por precio.
- **Reconocimiento de voz (STT):** API del navegador (gratis; solo transcribe) y, opcional, **Moonshine** (WebGPU con respaldo WASM; no probado en el teléfono de William). STT ≠ evaluación de pronunciación.
- **Fuentes de audio real:** LibriVox (dominio público; lenguaje a veces anticuado) y VOA Learning English (dominio público, pensado para aprendices). Podcasts/series comerciales: solo como "bloque externo" fuera de la app.
- **Plan de plataforma en 3 fases:** (1) PWA con audio pre-generado; (2) Azure con clave personal; (3) APK con Capacitor solo si algo lo exige.

### 7.5 Estados de dominio (decisión final de William: **porcentajes por rangos**)
Sophia (archivo original `index.html`, 13.003 líneas / 717.686 caracteres, verificado) usa 5 estados con pesos: `○ Sin ver 0.00 · ◔ Visto en clase 0.10 · ◑ Entendido 0.33 · ◕ Practicado 0.66 · ● Sólido 1.00`. William prefirió **porcentajes divididos en rangos**. Decisión:

| Rango | Etiqueta | Símbolo |
|---|---|---|
| 0 % (sin evidencia) | Sin ver | ○ |
| 1–29 % | Inicial | ◔ |
| 30–59 % | En progreso | ◑ |
| 60–84 % | Sólido | ◕ |
| 85–100 % | Dominado | ● |

Siempre se muestra junto a un **nivel de confianza** (Baja/Media/Alta) según cantidad y variedad de evidencia. Función de compatibilidad `masteryToSophiaVal(pct)` para una futura integración con Sophia (0–4). Cálculo en 8.7.

### 7.6 Hallazgos de Sophia que se reutilizan (verificados en su código)
- **Se reutiliza:** el lenguaje visual (temas **Aurora** [por defecto: fondo `#070a1d`, acento `#FFC107`, morado `#8B5CF6`, azul `#38BDF8`, esmeralda `#10B981`, rojo `#FF4D67`; paneles de vidrio con `backdrop-filter: blur(18px)`; radios 30/24/18 px], **Neo** [fondo `#05050a`, cian `#00E5FF`, magenta `#C740FF`, verde `#00FF9C`] y un tercer tema claro [fondo `#F4F5FA`, acento `#4F46E5`]); navegación inferior móvil; chequeo de **energía** diaria; patrón de llamada a IA (Groq, clave del usuario en el navegador; si no hay clave, "lógica local"); patrón de `SYSTEM_PROMPT()` contextual; filosofía de "sin clave = modo local".
- **No se reutiliza:** el archivo monolítico (13.003 líneas, frágil), `localStorage` para todo, rachas, flashcards sin repetición espaciada real (Sophia NO tiene fechas de próximo repaso ni SM-2/FSRS).
- Sophia usa `localStorage` con claves `sophia_v7`, `sophia_cfg_v7`, `sophia_chat_v7`. Esta app NO comparte almacenamiento con Sophia (origen distinto o prefijo `sing_`). La integración futura es por exportación/importación JSON.
- Cuando una subparte necesite copiar un token de diseño, usa los valores de arriba; para detalles finos pide a William el archivo `index.html` de Sophia (él lo tiene).

### 7.7 Referencia de interfaz: app "Epop" (capturas de William; nombre sin confirmar)
Se replica **el diseño de interacción**, jamás el contenido. Detalles observados:
- **Cabecera:** botón atrás; barra de progreso de sesión con texto `X/20` y una **mascota** que avanza sobre la barra; ícono de ajustes. Fondo temático espacial (planeta, cráter). *Nuestra versión:* mascota y fondo **originales**, usando los temas Aurora/Neo.
- **Insignias de tarjeta:** `Nivel N` con "?" (explica qué significa), corazón (favorita), `Repaso en 4 sems` / `Repaso en 2 años` (**transparencia total** del siguiente repaso), etiqueta roja `New`.
- **Tarjeta de frase/mini-diálogo:** turnos **A / B**, texto en español arriba con la palabra clave en **verde**; versión en inglés abajo con la palabra clave resaltada también en verde, o con un **hueco** que se responde.
- **Caja de gramática** (fondo dorado) con regla breve en español; **caja de matiz/uso** (texto pequeño tipo "usado indistintamente con okay", "significa terminar una relación").
- **Respuesta:** micrófono circular grande para decir la respuesta, con alternativa **"Modo teclado"** y botón **"Ver pista"**. Una burbuja inferior muestra lo que el sistema entendió, con cada palabra coloreada (verde = correcta).
- **Barra de 4 acciones** fija: *Otros ejemplos · Correcciones (con contador) · Preguntas IA · Diccionario*.
- **Controles de audio:** *Normal* (velocidad; conejo = normal, tortuga = lento), *Otra vez* (repetir), *Siguiente*.
- **Lo que NO se copia:** la etiqueta "[Fuente del vocabulario] – <película/serie>" (esas líneas son de obras con derechos). Nuestra etiqueta de fuente será el **tema o situación** ("Diálogo: ruptura de pareja"), con texto original.
- El número `Nivel 1–5` de la tarjeta = **estabilidad FSRS del ítem** (ver 8.4 para los cortes), **no** el dominio del tema.

### 7.8 Método RAIO (Kale Anders) — qué se adopta
Curso comercial de pago; promesa de "fluidez en ~3 meses" **no verificada con evidencia independiente**; existen acusaciones de plagio del método de A. J. Hoge (Effortless English) **no verificadas**. No se accede ni se copia su contenido. Principios que SÍ se adoptan:
1. **Escuchar primero, siempre.** Toda estructura/frase nueva se presenta primero por **audio**, antes que por texto.
2. **Historias interactivas ORIGINALES** (muchas, por nivel), con vocabulario y gramática objetivo propios.
3. Flujo de historia: escuchar varias veces → ver texto → repetir en voz alta (shadowing) → ejercicios analíticos.
4. **Shadowing** breve diario (~5 min) dentro del plan.
5. **Gramática "intuitiva" parcial:** primero exposición a varios ejemplos para intuir el patrón, **luego** la regla explícita (el diagnóstico muestra errores sistemáticos de transferencia que necesitan instrucción explícita).

### 7.9 Principio transversal "90–95 %" y jerarquía base → avanzado
- Las secciones "avanzadas" (lectura, escritura, conversación, historias) **nunca presentan** estructuras/vocabulario por encima de lo que William tiene dominado en la "base" (gramática por temas y vocabulario por familias), salvo lo **marcado explícitamente como nuevo**.
- **Lectura:** cada texto con **90–95 %** de contenido ya conocido; el 5–10 % restante son elementos NUEVOS marcados, con glosa al tocar; pasan automáticamente a la lista de estudio.
- **Escritura/conversación:** las consignas y mensajes de la IA usan solo lo dominado; a William **no se le prohíbe intentar** usar algo no visto: ese intento es información valiosa (se marca, se corrige si hace falta y se envía a estudio).
- **Sondas de techo** cada 4–6 semanas: un texto/tarea deliberadamente por encima de su nivel, separado de la práctica diaria, para medir si el techo real subió.
- Limitación reconocida: el control fino depende de que los datos de dominio estén siempre actualizados.

### 7.10 Perfil diagnóstico (para priorizar contenido y diseñar distractores)
**Veredicto provisional (aproximado, ±1 nivel):** A2 en construcción (bajo a medio) con islas de B1 y destellos de B2. Gramática por nivel: A1 ≈ 80 %, A2 ≈ 50–55 %, B1 ≈ 35 %, B2 ≈ 15 %, C1 0/5. Lectura: sólida A1–B1; se degrada en B2 académico/económico/abstracto; cuello de botella = vocabulario. Escritura: A2 con intentos de B1; contenido bueno, ejecución gramatical débil; no detecta errores estructurales al autocorregirse. Vocabulario (medido SIN apoyo de contexto/cognados): muy débil; huecos incluso en la banda 1K; la banda 2K es mayormente desconocida; 3K+ casi nula. Profundidad (colocaciones, phrasal verbs, formación de palabras): muy débil.

**Fortalezas:** base A1 (to be, artículos, números, there is/are, do-support negativo, plurales irregulares, a/an); present perfect continuous en producción libre; condicional 1 (y 2 simple); used to, should, was able to, mustn't; preposiciones de tiempo con fechas; for/since en reconocimiento; do/make; each other; "neither…nor", participio "Walking down…", "so that"; metacognición excelente.

**Errores sistemáticos de ALTO impacto (prioridad #1 de contenido):**
1. **Tiempos perfectos:** confunde present perfect/past simple; for/since en producción ("I'm living here since two years"); forma `have + participio` inestable ("Were already to leave", "Had been study", "Had paseed").
2. **Irregulares/pasado:** regulariza ("leaved", "eated", "paseed") y dobla el pasado ("didn't went").
3. **Preguntas:** "Where live she?", "Who did brake the window?", "How many time do you have been waiting?"; preguntas indirectas.
4. **Gerundio vs. infinitivo:** "tired waiting", "avoid to speak", "suggested to go"; gerundio tras preposición ("for visit"); y **"can/could + to + verbo" (error de altísima frecuencia en escritura: "I didn't can to send", "so I can to send", "could to be studying")**.
5. **Preposiciones dependientes:** "interested about", "good in", "afraid to", "arrived to", "looked for" en lugar de "looked up".
6. **Doble negación y omisión de sujeto:** "I don't know nothing", "Is very important…".

**Impacto medio:** conectores de contraste (however/although/despite → los confunde con "because"; "despite of"); futuros ("will" para planes decididos; "will graduated"; "I've will sit"); adjetivos/adverbios ("most high", "beautiful" como adverbio, bored/boring, orden de adjetivos, plural en adjetivo "awesomes", "the more… the better"); contables/incontables (few/a few, luggage, advice, news, police; "many luggages"); causativas ("makes me works"); -s de tercera persona inconsistente (omite en "the train leave", añade en "can swims"); falsos amigos (actually/actualmente, sensible/sensato, approve/pass); calcos ("I get fun a lot" ← "me divertí mucho"; "give you an apologize").

**Huecos CONFIRMADOS (cero conocimiento; van directo a enseñanza, no repreguntar en diagnóstico):** voz pasiva; who/whom/whose; tag questions; unless; so/such; wish y would rather; condicionales 3 y mixtos; modales de deducción y perfectos (must have, should have); estilo indirecto con órdenes; causativa `have something done`; inversión (hardly, not until, were it not for); subjuntivo ("I suggest he be"); as if; remember/forget/stop (cambio de significado); future perfect y future continuous; artículos con nombres geográficos (parcial); "I vs. me" en sujetos compuestos (visto una vez; no consolidado).

**Mecánica/ortografía:** "i" minúscula, "an"/"and", "everyday/every day", "yesterdey", "semestre"/"semester", "carrer"/"career", "boos"/"boss", "oportunitys", "wether/whether", "cluidy/cloudy", "firts/first", "finaly", "brake/break".

**Vocabulario:** bandas 1K–3K con huecos reales (ej.: ceiling, scarf, thunder, fog, towel, cough, sheep, tire, drawer). Falsos amigos a vigilar. En profundidad: sabe `brush`, `turn down`; no `look after`, `run out of`, `pick up` (parcial), `happiness`←`happy`, `successful`, `colleague`.

**Pendiente en diagnóstico (lo hace el Administrador, no la app):** mediación/pragmática, ortografía/puntuación, fonética (William aún no decidió si la quiere) e informe final.

### 7.11 Prioridad de sonidos para pronunciación (fases 7–8)
1) terminaciones **-ed** (/t/, /d/, /ɪd/) y **-s** (/s/, /z/, /ɪz/); 2) consonantes finales y grupos ("asked"→"ask"); 3) **/s/ + consonante** inicial (evitar "e" inicial: "estar"→"star"); 4) vocales cortas/largas (/ɪ/ vs /iː/, /æ/, /ʌ/, /ɑː/, /ɜː/, /ə/); 5) **/v/ vs /b/**; 6) **/θ/ y /ð/**; 7) sonoridad final (d→t, b→p, v→f); 8) "s" final como /z/; 9) /r/ rótica americana.

### 7.12 Decisiones que quedaron ABIERTAS y su valor por defecto (los chats usan el defecto; William o el Administrador pueden cambiarlo)
| Tema | Defecto propuesto | Nota |
|---|---|---|
| Nombre de la app | "Sophia Inglés" | Cambiable en un solo archivo (`app/config.js` + manifest). |
| Día difícil de 45 min | **ELIMINADO** (William: "no lo necesito") | El plan se ajusta al tiempo/energía del día sin modo especial. |
| Verbos nuevos por día | **5 verbos irregulares/día** (cada uno = 3 tarjetas: presente, pasado, participio → hasta 15 tarjetas); **3 phrasal verbs/día**; **10 palabras nuevas/día** | Valores de partida de diseño según práctica común de SRS (no provienen de una fuente verificada); configurables (3–10 verbos, 1–6 phrasal, 5–25 palabras). Orden por **frecuencia** y agrupados por patrón (sing-sang-sung con ring-rang-rung). |
| Imágenes en fichas de vocabulario | **No** en v1 (solo texto + audio) | Dejar el campo `image` opcional en el esquema. |
| Tamaño de biblioteca de lectura inicial | 30 historias A1–A2 + 20 B1 en el primer lote (pista C) | Crece por lotes. |
| Notificaciones | PWA: **no confiables** → el Administrador/chat crea alarmas con las herramientas del teléfono; la app solo ofrece "recordatorio suave" al abrir | Ver 9.1. |
| Nivel de automatización contenido vs. revisión de William | Todo contenido de paquetes pasa por **validador + revisión cruzada de IA**; el contenido generado en vivo por IA se marca "no verificado" con botón "reportar" | |
| Fonética teórica (módulo 8 del diagnóstico) | Sin decidir | Se pregunta a William en su momento (Administrador). |
| Qué cuenta como «producción» en la señal P del dominio | Cuentan las familias `text_input`, `transform`, `speak`, `writing`, `mediation`, `open_ai` y el tipo `phrase_cloze`. **No** cuentan `ordering`, `matching`, `cloze_bank`, `audio` (dictado y `spell_from_audio` incluidos), `reading` ni `build_from_keywords` | Decidido en 1.7-T1 (8.7 dice «escribir/hablar»). Queda abierta al Administrador si dictado, `spell_from_audio` y `build_from_keywords` deben contar; **no bloquea**. Cambiarlo = editar `SIGNAL_P` en `core/mastery.config.js`. |
| Firma pública del dominio | `createMastery({ db, events, errors, srs, clock?, config?, u? }).compute(topicId, now?)` | **Resuelta** en 1.7-T2: 8.7 y 8.15 se contradecían; ya están alineados (ver 8.7 y 8.15). |

### 7.13 Verificaciones técnicas (estado)
| Verificación | Estado | Quién la cierra |
|---|---|---|
| Licencia/versión FSRS en JS | **MIT, `ts-fsrs` (última encontrada 5.4.1)** — re-verificar ruta exacta del archivo | 1.4 |
| Azure sin tarjeta / Azure for Students | **Parcialmente verificado**: Azure for Students no pide tarjeta (con correo institucional); posibles restricciones de región para Speech/F0; Colombia sin confirmar | 8.2 + William |
| Licencia Tatoeba | **PENDIENTE** (no usar frases de Tatoeba hasta confirmar licencia y requisitos de atribución) | Chat Contenido C8 |
| Licencia Wiktionary | **PENDIENTE** (datos léxicos; verificar licencia CC-BY-SA y qué implica) | Chat Contenido C6 |
| Notificaciones programadas en PWA Android | **PENDIENTE** (investigar Notification Triggers/Periodic Sync/Push) | 9.1 |
| Kokoro y Moonshine en el teléfono de William | **PENDIENTE** (Kokoro corre en el PC de William, no en el teléfono; Moonshine opcional) | 7.1, 8.5 |
| Modelo vigente de Groq y límites gratuitos | **PENDIENTE** | 1.10 / 5.1 |

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

## 9. ROADMAP DE CONSTRUCCIÓN — PARTES Y SUBPARTES

**Cómo leer cada subparte.** `Dep.` = dependencias (deben estar `HECHA`). `CA` = criterios de aceptación (tu lista de verificación; todos deben cumplirse). `Pruebas` = mínimo de pruebas a escribir/ejecutar. Tamaño objetivo de cada subparte: lo que un chat puede construir **y auditar** completo (≈ 300–700 líneas nuevas de código + pruebas). Si no cabe, aplica 3.3.

**Mapa general (hitos):**

| Parte | Contenido | Hito |
|---|---|---|
| **P0** | Cimientos: repo, pruebas, diseño, shell, PWA, almacenamiento, ajustes | **M0**: app instalable y vacía pero sólida |
| **P1** | Motores `core/`: eventos, normalización, contenido, FSRS, calificación, errores, dominio, sesiones, IA, lista blanca, sync | **M0.5**: motor completo con pruebas |
| **P2** | Sesión jugable estilo Epop con todos los tipos "no-IA, no-audio" básicos | **M1**: PRIMERA SESIÓN JUGABLE (versión 0.x → 1.0-beta) |
| **P3** | Mapa de temas, fichas, exámenes, plan, estadísticas, errores | **M2**: app de estudio diario usable |
| **P4** | Vocabulario, verbos, phrasal verbs, preposiciones, ortografía | **M3** |
| **P5** | IA: otros ejemplos, preguntas, feedback de escritura, generador, roleplay de texto | **M4** |
| **P6** | Lectura, "tocar palabra", historias RAIO, 90–95 %, sondas de techo | **M5** |
| **P7** | Audio: pipeline Kokoro, reproductor, dictado, escucha, shadowing | **M6** |
| **P8** | Voz: STT con colores, Azure, pronunciación, conversación por voz | **M7** |
| **P9** | Cierre: recordatorios, respaldo, rendimiento, accesibilidad, seguridad, regresión total | **M8**: 1.0 |
| **C** | Pista de contenido (en cadena con las demás, sección 10; usa el validador de 1.3) | — |

**Regla de orden:** P0 → P1 → P2 → P3 se hacen en ese orden. P4–P8 pueden alternarse con la pista C según prioridad (el Administrador decide), siempre respetando dependencias. P9 al final.

---

# PARTE 0 — CIMIENTOS

### 0.1 Repositorio, documentos vivos y contratos
- **Dep.:** ninguna. **Es la primera subparte del proyecto.**
- **Objetivo:** crear el esqueleto de carpetas (sección 6), los documentos vivos y copiar los contratos.
- **Archivos:** estructura completa vacía con `.gitkeep`; `PROJECT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md`, `docs/ROADMAP.md` (copia exacta de este archivo), `docs/CONTRACTS.md` (copia de la sección 8 en formato de referencia + espacio para ampliaciones), `docs/DESIGN.md` (stub), `README.md` (cómo correr localmente: `python3 -m http.server 8080` o `npx serve`, y cómo correr pruebas), `.gitignore`, `core/version.js` (`export const VERSION = '0.1.0'`), `app/config.js` (nombre de app, constantes; sin claves).
- **`PROJECT_STATE.md` debe contener:** (1) tabla de TODAS las subpartes de este roadmap con columnas `ID | Nombre | Estado (PENDIENTE/EN CURSO/HECHA/BLOQUEADA) | Versión | Fecha | Notas`; (2) "Siguiente subparte"; (3) "Bugs conocidos"; (4) "Pendiente de verificación por William"; (5) "Preguntas abiertas para el Administrador"; (6) "Contratos modificados"; (7) "Cola de pruebas manuales" (5.H).
- **CA:** 1) estructura exacta de la sección 6; 2) `docs/ROADMAP.md` idéntico al roadmap recibido en ese chat (verifica con `diff`) y `PROJECT_STATE.md` con la línea `Versión del roadmap: x.y (sha256 …)` y una sección "Contenido" (tabla `lote | tanda | temas hechos | ítems | estado`); 3) tabla de estado completa con todas las subpartes (0.1 … 9.8, C1…); 4) README claro; 5) ningún archivo con claves.
- **Pruebas:** script de verificación simple `tools/check-structure.mjs` que falla si falta alguna carpeta/archivo obligatorio.

### 0.2 Arnés de pruebas y auditoría automática
- **Dep.:** 0.1.
- **Objetivo:** que todos los chats tengan las mismas herramientas de calidad.
- **Archivos:** `tools/audit.mjs`, `tests/_helpers.mjs` (reloj falso, rng semillado, fábrica de datos, DB en memoria), `tests/audit.test.mjs`, `package.json` mínimo **sin dependencias** con scripts: `test` (`node --test tests/`), `audit` (`node tools/audit.mjs`), `check` (ejecuta structure+audit+test). 
- **`audit.mjs` busca:** patrones prohibidos de 4.3 pasada 1; archivos > 800 líneas; imports que no resuelven (analiza `import ... from './x.js'`); JSON inválidos; IDs duplicados en contenido; claves con forma `gsk_`, `sk-`, `AIza`, `AKIA`; `localStorage` fuera de lista blanca; `innerHTML` con interpolación; `TODO`/`FIXME` sin ID; `console.log`.
- **CA:** 1) `npm run check` pasa en repo limpio; 2) `audit` detecta cada patrón prohibido (hay prueba que crea un archivo malo temporal por patrón y verifica detección); 3) helpers documentados en el propio archivo; 4) salida clara en español.
- **Pruebas:** las del propio audit (positivo/negativo por patrón).

### 0.3 Sistema de diseño: tokens, temas y estilos base
- **Dep.:** 0.1. **Usa:** 7.6 (valores de Sophia). Si necesitas detalle fino de Sophia, pide a William `index.html` de Sophia.
- **Objetivo:** el lenguaje visual completo, móvil primero.
- **Archivos:** `ui/styles/tokens.css` (variables CSS de color/espaciado/radios/sombras/tipografía/z-index/duraciones), `themes.css` (Aurora por defecto, Neo, Claro; `[data-theme]`; respeta `prefers-color-scheme` solo como valor inicial sugerido), `base.css` (reset, tipografía `system-ui`, escala tipográfica, `:focus-visible`, `prefers-reduced-motion`), `components.css` (clases base: `.glass`, `.btn`, `.chip`, `.card`, `.sheet`, `.badge`, `.progress`…), `docs/DESIGN.md` (guía con capturas descritas, reglas, ejemplos de uso), `ui/styles/demo.html` (**galería de componentes** para inspección visual por William).
- **Requisitos:** objetivos táctiles ≥ 44 px; contraste AA en los 3 temas (calcula razones con script y súbelas al reporte); zona segura `env(safe-area-inset-*)`; sin dependencias externas ni fuentes remotas; tema cambiable en vivo.
- **CA:** 1) los 3 temas completos; 2) demo muestra tipografía, botones (primario/secundario/peligro/deshabilitado), chips, tarjetas de vidrio, barra de progreso, insignias ("Nivel N", "New", "Repaso en…"), hojas inferiores, toasts; 3) probado a 360 px y 412 px; 4) contraste AA documentado; 5) sin `!important` salvo justificación documentada.
- **Prueba manual (William):** abre `demo.html` en el teléfono, cambia de tema, confirma que se ve bien y nada se corta.

### 0.4 Shell de la app, router y ciclo de vida de vistas
- **Dep.:** 0.2, 0.3.
- **Objetivo:** navegación inferior (5 pestañas: **Hoy · Mapa · Practicar · Errores · Más**), router por hash, ciclo de vida de vistas y manejo global de errores.
- **Archivos:** `index.html` (shell, meta viewport, CSP del 8.16, `<noscript>`), `app/main.js`, `app/router.js`, `ui/dom.js` (`h()`, `esc()`, `on()`, `qs()`), `ui/views/_viewBase.js`, vistas placeholder para cada pestaña, `ui/components/bottomNav.js`, `ui/components/toast.js`, `ui/components/errorBoundary.js`.
- **Comportamiento:** rutas `#/hoy`, `#/mapa`, `#/practicar`, `#/errores`, `#/mas`, `#/sesion/:id`, `#/tema/:id`, `#/ajustes`, `#/404`; el botón atrás del navegador funciona; cada vista tiene `mount(root, params)` y `destroy()` (sin fugas de listeners); errores no capturados muestran una pantalla amable con "Reintentar" y "Copiar detalle" (para reportar) y se registran con `console.error`.
- **CA:** 1) navegar entre pestañas conserva estado razonable; 2) atrás/adelante OK; 3) ruta desconocida → 404 amable; 4) un error lanzado en una vista no tumba la app; 5) `destroy()` verificado (prueba cuenta listeners); 6) sin `innerHTML` con datos variables.
- **Pruebas:** router (resolución de rutas y params, 404), `h()`/`esc()` (XSS: `<img onerror>` queda como texto), ciclo de vida con DOM falso.

### 0.5 Biblioteca de componentes UI reutilizables
- **Dep.:** 0.4.
- **Objetivo:** piezas que usarán TODAS las pantallas y ejercicios.
- **Componentes (cada uno en `ui/components/`):** `button`, `chip`, `badge` (Nivel/New/Repaso), `card`, `sheet` (hoja inferior con arrastre), `modal` (confirmación con foco atrapado), `progressBar` (con slot para mascota), `mascot` (SVG **original** animable: estados neutro/feliz/pensando), `tabs`, `segmented`, `toggle`, `slider`, `textInput` (con teclado móvil adecuado, `autocapitalize`, `autocorrect="off"`, `spellcheck="false"` en ejercicios), `emptyState`, `skeleton`, `confirmDanger`, `kbd`-like "chip de palabra" (ficha de palabra tocable), `wordDiff` (muestra palabras con color verde/ámbar/rojo).
- **CA:** 1) todos con estados (normal/hover-focus/pressed/disabled/loading/error); 2) accesibles (roles, `aria-*`, foco visible, Esc cierra modal/sheet); 3) documentados en `docs/DESIGN.md` con ejemplo de uso; 4) galería `demo.html` actualizada; 5) la mascota respeta `prefers-reduced-motion`.
- **Pruebas:** props inválidas, textos largos (truncado/wrap), foco y teclado, destruir sin fugas.

### 0.6 PWA: manifest, service worker, iconos, actualizaciones y guía de despliegue
- **Dep.:** 0.4.
- **Objetivo:** app instalable desde Chrome, funcional offline, que se actualiza sin dejar al usuario con código viejo.
- **Archivos:** `manifest.webmanifest` (nombre, `display: standalone`, `start_url` relativa, `scope`, colores del tema, iconos 192/512/maskable), `icons/*` (ícono **original**; pide a William si quiere un diseño específico, si no genera uno simple SVG→PNG), `sw.js`, `tools/build-manifest.mjs` (genera `asset-manifest.json` con hash/versión de todos los archivos a precachear y escribe la versión de caché en `sw.js`), `app/swRegister.js`, `docs/DEPLOY.md`.
- **Estrategia de caché:** *precache* del shell (`app/`, `core/`, `ui/`, estilos, `taxonomy/`); *stale-while-revalidate* para `content/packs/*`; *cache-first con límite* para `audio/*` (fase 7); nunca cachear llamadas a APIs de IA/Azure. Al detectar versión nueva: aviso discreto "Hay una actualización — Actualizar" (nunca recarga forzada en mitad de una sesión de estudio).
- **`docs/DEPLOY.md` (para William):** pasos numerados, en español, para publicar en **GitHub Pages** (crear repo, subir archivos desde el PC, activar Pages, abrir desde Chrome en Android, "Instalar app"), cómo actualizar (subir archivos nuevos → esperar → abrir → tocar "Actualizar"), y qué hacer si se queda en versión vieja (limpiar datos del sitio **solo como último recurso: advertir que borra el progreso; recomendar exportar respaldo antes**).
- **CA:** 1) Lighthouse PWA/installable (si hay herramienta; si no, checklist manual); 2) funciona offline tras primera carga; 3) subir `VERSION` invalida la caché y la app ofrece actualizar; 4) el SW no rompe `localhost` en desarrollo (modo dev sin SW documentado); 5) `build-manifest` es determinista (misma entrada → mismo salida).
- **Pruebas:** `build-manifest` (hash estable, incluye/excluye lo correcto), lógica de comparación de versiones.
- **Prueba manual (William):** instalar la PWA, activar modo avión, abrirla; subir una versión nueva y confirmar el aviso de actualización. *(Va a la cola: se ejecuta en M0, ver 5.H; es la primera vez que William crea el repo y activa Pages, así que `DEPLOY.md` debe poder seguirse sin conocimientos previos.)*

### 0.7 Capa de almacenamiento (IndexedDB) con adaptador de pruebas y migraciones
- **Dep.:** 0.2.
- **Objetivo:** `core/db.js` según 8.13, 100 % probable con Node.
- **Archivos:** `core/db.js` (interfaz), `core/db.idb.js` (IndexedDB real), `core/db.memory.js` (adaptador en memoria con el MISMO contrato y la misma semántica de errores), `core/migrations.js`, `core/clock.js`, `core/rng.js`, `core/store.js` (estado en memoria + pub/sub), `tests/db.contract.test.mjs` (**la misma suite de contrato corre contra ambos adaptadores**; el real solo si el entorno tiene IndexedDB — si no, se declara).
- **Requisitos:** `navigator.storage.persist()` solicitado tras la primera sesión real; detección de cuota/errores con mensajes amables; transacciones atómicas para operaciones de varios almacenes (ej. guardar evento + actualizar tarjeta); `exportAll/importAll` con validación; **migraciones hacia adelante probadas** con datos de la versión previa simulada; si IndexedDB no está disponible → modo "solo memoria" con aviso visible (los datos no persistirán).
- **CA:** 1) contrato idéntico en ambos adaptadores; 2) `put/get/delete/query` con índices; 3) migración v1→v2 de prueba conserva datos; 4) fallo simulado de escritura no corrompe estado previo; 5) 5.000 tarjetas consultables por `due` en < 100 ms (en memoria; documentar tiempo en IDB real).
- **Pruebas:** contrato completo, atomicidad, cuota llena simulada, migración, export/import ida y vuelta.

### 0.8 Ajustes, bóveda de claves y onboarding mínimo
- **Dep.:** 0.5, 0.7.
- **Objetivo:** pantalla de ajustes y primer arranque.
- **Archivos:** `core/settings.js` (lectura/escritura con valores por defecto y validación), `ui/views/settings.js`, `ui/views/onboarding.js`, `ui/components/keyField.js` (campo de clave con mostrar/ocultar y botón borrar).
- **Ajustes:** tema; tamaño de texto; retención objetivo (80–95 %, defecto 90 %, con explicación del trade-off); tope diario de repasos y de tarjetas nuevas; umbral de sanguijuela (defecto 8); tolerancia ortográfica (on/off); sonidos y vibración; modo IA (auto / siempre mecánico); proveedor, modelo y **clave de IA** (guardada en `settings`, con aviso claro de privacidad: "solo en este dispositivo"); región/clave de Azure (campos presentes pero marcados "se activa en Fase 8"); borrar claves; **exportar/importar respaldo** (llama a stubs de `sync` hasta 1.12); "Acerca de" con versión; zona "Peligro" para borrar todo (doble confirmación, escribe "BORRAR").
- **Onboarding (≤ 3 pantallas, saltable):** bienvenida cálida; chequeo de **energía** (de Sophia) opcional; cómo funciona sin presión ("sin rachas, sin culpa"); pedir nombre opcional. Nada de test inicial aquí (el test de entrada vive en P3).
- **CA:** 1) valores por defecto razonables y validados (rangos); 2) cambios se aplican en vivo y persisten; 3) la clave nunca aparece en logs ni en `localStorage`; 4) borrar todo exige confirmación fuerte; 5) onboarding se puede saltar y se puede repetir desde Ajustes.
- **Pruebas:** validación de rangos, persistencia, que `audit` no encuentre claves, que `console` no registre la clave.

> **HITO M0 (tras 0.8) — primera publicación:** William crea el repo, activa GitHub Pages siguiendo `docs/DEPLOY.md`, instala la PWA, ve las 5 pestañas, cambia tema, guarda ajustes, ve la app funcionar sin conexión. El chat siguiente corrige primero lo que William reporte (3.A).

---

### 0.9 Mapa del repositorio y arranque rápido (se construye una sola vez; después cada tramo solo lo actualiza)
- **Dependencias:** 0.1–0.8 y todo lo que exista del repositorio en ese momento. **Este es el ÚNICO chat que explora el repositorio completo**: lo que descubra queda escrito en el mapa para que ningún chat posterior vuelva a investigar.
- **Objetivo:** que cada chat arranque confiando en `docs/REPO_MAP.md` y empiece a construir sin gastar recursos explorando, con una comprobación mecánica (no por lectura) de que la confianza está justificada.
- **Archivos:** `tools/repo-map.mjs` (script `npm run map`), `docs/REPO_MAP.md`, `tools/repo-map.config.json` (propósito de los archivos de datos), la convención `@purpose` en todo el código, regla en `audit.mjs`, integración en `tools/check-structure.mjs`.
- **Convención `@purpose`:** todo archivo `.js`, `.mjs`, `.css` y `.html` (salvo `vendor/` y los generados) lleva en sus primeras líneas un comentario `@purpose: <una línea que diga para qué sirve>`. `audit.mjs` exige que la tengan los archivos nuevos o modificados.
- **`tools/repo-map.mjs`:**
  - `npm run map` regenera **solo las secciones automáticas** de `docs/REPO_MAP.md` y respeta las manuales (entre marcadores `<!-- MANUAL:inicio:<nombre> -->` … `<!-- MANUAL:fin:<nombre> -->`). Salida determinista (dos corridas seguidas dan el mismo archivo).
  - `npm run map -- --check` calcula el **tree-hash** (sha256 de la lista ordenada `ruta sha1`, sin `.git`, `node_modules`, zips ni el propio mapa) y lo compara con el guardado en la cabecera del mapa. Imprime `OK <hash>` o la lista de archivos **creados / modificados / eliminados** y sale con código 1. Tarda menos de 2 s y cuesta cero análisis.
  - **Secciones automáticas** (todas comprobables contra el código): índice de áreas (`## Área: <carpeta>`) con número de archivos; por cada archivo `ruta · líneas · @purpose · exports con firma · importa de`; datos JSON (`ruta · bytes · claves de primer nivel · propósito según config`); pruebas (`archivo · nº de pruebas`); totales.
  - **Secciones manuales** (las mantienen los chats con **cambios pequeños en el sitio**, nunca reescribiéndolas): *Cómo encaja todo* (≤ 60 líneas: capas, flujo de datos, quién llama a quién), *Servicios cableados y pendientes de cablear*, *Convenciones y trampas* (acumulativa; cada trampa en una línea con ID `TRAMPA-nn`, formato y reglas en 4.T; es lectura obligatoria al arrancar), *Comandos y verificaciones*, y **Delta del último tramo** (esta sí se reemplaza en cada entrega: ≤ 25 líneas, una por archivo creado/modificado/eliminado con el porqué; contratos tocados; trampas nuevas).
- **`PROJECT_STATE.md` se compacta:** guarda solo el estado vigente (tablero, siguiente paso, preguntas abiertas, cola de pruebas manuales, tablas de contenido y de tramos; ≤ 250 líneas). Lo histórico vive en `CHANGELOG.md` y `DECISIONS.md`, que **no se leen enteros al arrancar**.
- **Integración con la entrega:** `check-structure` exige que `docs/REPO_MAP.md` exista y que `repo-map --check` pase. Una entrega con el mapa desactualizado **hace fallar la suite**, así que el mapa siempre está al día y el siguiente chat puede confiar en él.
- **Si el mapa se equivoca** (una función que no existe, una firma distinta): el chat que lo nota corrige esa línea, lo anota en el Delta como "Mapa corregido" y sigue. No es un fallo de nadie.
- **CA:** 1) `npm run map` genera el mapa y es idempotente; 2) `--check` detecta y lista un archivo modificado, uno nuevo y uno eliminado; 3) todo archivo de código (salvo `vendor/` y generados) tiene `@purpose` y `audit` lo exige; 4) el mapa incluye el 100 % de los archivos del repo (prueba cruzada contra el sistema de archivos); 5) las firmas de exports coinciden con el código (prueba sobre ≥ 10 archivos conocidos, incluidas `export function`, `async`, `const` flecha, `class`, `export { a, b }`, `export default` y reexportaciones); 6) el chat redacta 10 preguntas de control sobre el repo (dónde está X, qué exporta Y, qué servicio cablea Z) y comprueba que cada una se responde **solo con el mapa**; 7) `PROJECT_STATE.md` ≤ 250 líneas con todo lo vigente.
- **Versión:** la 0.9 es solo herramientas y comentarios: **no sube la versión de la app**.
- **Pruebas:** parser de exports (todas las formas), determinismo, detección de deriva, rutas con espacios o acentos, archivos sin `@purpose`, mapa que se desvía a propósito (se corrige solo con `npm run map`).

---

# PARTE 1 — MOTORES (`core/`)

> Todo en esta parte es **lógica pura probada con Node**. Cada subparte entrega pruebas muy completas, porque el resto de la app se apoya en esto. Si una prueba revela una ambigüedad de contrato → protocolo 3.4.

### 1.1 Registro de eventos
- **Dep.:** 0.7.
- **Objetivo:** `core/events.js` según 8.6.
- **Alcance:** `log(ev)` valida campos, asigna `id` y `day` (zona local del dispositivo; el reloj es inyectable), escribe de forma atómica; consultas `byCard`, `byItem`, `byTopic`, `since`, `countByDay`, `recentErrorsByCode`; **inmutabilidad** (no hay `update`/`delete` salvo borrar todo); ID único aunque se llame 2 veces en el mismo ms.
- **CA:** 1) rechaza eventos inválidos con error descriptivo; 2) IDs únicos (prueba con 10.000 llamadas); 3) `day` correcto en cambios de zona/medianoche; 4) consulta por rango eficiente con índices.
- **Pruebas:** validación, unicidad, medianoche, rango, volumen.

### 1.2 Normalización y comparación de respuestas
- **Dep.:** 0.2.
- **Objetivo:** `core/normalize.js` según 8.5 (+ `content/taxonomy/confusables.json` inicial con ≥ 60 pares: bad/bed, ship/sheep, live/leave, etc.).
- **Alcance:** `normalize(text,opts)`, `compare(user, accept[], opts)`, `damerauLevenshtein`, expansión/contracción de contracciones, tratamiento de `’`, mayúscula de `I`, puntuación opcional, devolución de `diff` por palabra para pintar verde/ámbar/rojo (`wordDiff`), `spellingFlags`.
- **CA:** 1) los 5 puntos de 8.5; 2) "ALMOST" nunca cuando el cambio crea otra palabra válida (confusables); 3) "I've/I have", "don't/do not", "can't/cannot" equivalentes; 4) respuestas con espacios dobles, mayúsculas, puntuación final ok; 5) entrada vacía/`null`/emoji no lanza excepción.
- **Pruebas:** ≥ 60 casos tabulados (los que fallan hoy en el diagnóstico de William: `leaved`, `eated`, `didn't went`, `can to`, etc., como respuestas incorrectas), contracciones, confusables, Unicode, fuzz con 1000 cadenas aleatorias sin excepción.

### 1.3 Esquemas de contenido, validador y cargador de paquetes
- **Dep.:** 0.7, 1.2.
- **Objetivo:** `core/content.js`, `tools/validate-content.mjs`, **`tools/add-pack.mjs` (comando para agregar paquetes) + `docs/ADD_PACK.md`** (y el script `add-pack` en `package.json`; `check-structure.mjs` pasa a exigir ambos archivos), `content/taxonomy/topics.json` (semilla con los temas de prioridad 1 del diagnóstico) y esquemas por tipo de ejercicio.
- **Alcance:** validación **estricta** de `Topic`, `Item`, `Pack`, `LexEntry`, `Story` (8.2–8.12) con mensajes que apuntan a la ruta exacta del error (`items[12].accept[0]`); validaciones semánticas: IDs únicos globales, referencias a temas existentes, `accept` no vacío cuando corresponde, `distractors` con `code` existente en `error_codes.json`, `type` válido, `data` conforme al esquema del tipo, ≥ 12 ítems y ≥ 3 tipos por tema cuando `status: active` (advertencia, no error, en paquetes parciales), **texto sin HTML**, longitud razonable, sin caracteres de control, y un **chequeo anti-derechos** simple (no hay campo `source` ≠ `original`/`ai_generated_unverified`); cargador `importPacksToDb()` idempotente (reimportar no duplica ni borra progreso: ítems nuevos → tarjetas nuevas; ítems retirados → `deprecated`); manejo de versiones de paquetes.
- **Comando `add-pack` (`tools/add-pack.mjs`, script `npm run add-pack -- <ruta…>`):** la forma única y simple de meter contenido al repo; la usan el chat constructor desde el primer lote y William después. *Lógica en funciones puras exportadas (testeables); el CLI es una capa fina.*
  - **Entrada:** uno o más archivos `.json` de paquete, o una carpeta que los contenga (William descomprime el zip del chat de Contenido; el comando **no** lee `.zip`, porque Node no trae descompresor y el proyecto no usa dependencias). Ignora archivos que no sean paquetes (p. ej. el informe) avisando cuáles omitió.
  - **Flujo:** (1) valida **todos** los paquetes con el mismo código que `validate-content.mjs` (no hay segunda implementación), incluyendo IDs únicos **contra los paquetes ya instalados** y temas existentes en `topics.json`; (2) **si hay un solo error, no escribe nada** (todo o nada); (3) copia cada paquete a `content/packs/<pack_id>.json` (formato estable: JSON con sangría de 2 espacios, `\n` final); (4) regenera la entrada correspondiente de `content/index.json` (`pack_id, version, path, topics, items_count, size_kb`), ordenada por `pack_id`; escritura atómica (archivo temporal + renombrar); (5) imprime un resumen en español y los **siguientes pasos** (subir `core/version.js` y ejecutar `npm run build` para regenerar el manifiesto y la caché del SW, y subir a GitHub).
  - **Versiones:** paquete nuevo → se agrega; mismo `pack_id` con `version` **mayor** → reemplaza y lo informa (ítems retirados quedarán `deprecated` al importar, según el cargador); misma versión con contenido idéntico → no hace nada (idempotente); misma versión con contenido distinto o versión menor → **error** con explicación (no se pisa por accidente). La opción `--force` solo existe para el Administrador y exige `--reason "…"`, que se anota en `DECISIONS.md` a mano.
  - **Opciones:** `--dry-run` (valida y muestra qué haría, sin escribir), `--quiet`. Salida con `process.stdout/stderr.write` (nunca `console.log`, para no violar `audit.mjs`). Código de salida ≠ 0 ante cualquier error. Mensajes de error con ruta exacta (`gram_x_v1.json › items[12].accept[0]`).
  - **Seguridad:** nunca escribe fuera de `content/`; rechaza rutas con `..`; `pack_id` solo `[a-z0-9_]`; no sigue enlaces simbólicos; no ejecuta nada del contenido.
  - **`docs/ADD_PACK.md`** (≤ 1 página, en español, sin jerga; la siguen los chats de contenido, que ejecutan `add-pack` ellos mismos, y William solo si algún día quiere agregar un paquete por su cuenta y tiene Node instalado): 1) descomprime el zip en una carpeta; 2) corre `npm run add-pack -- ruta/de/la/carpeta`; 3) qué significa cada mensaje (ejemplos reales de éxito, advertencia y error); 4) subir versión + `npm run build`; 5) abrir la app y ver el paquete importado; 6) cómo revertir (restaurar el commit anterior o borrar el paquete con `git`); 7) solución de los 5 errores más comunes.
- **Esquemas por tipo:** `docs/CONTRACTS.md` recibe el contrato `data` de **cada tipo del catálogo 8.9** (aunque el componente se construya después). *Esta es la subparte donde los contratos de ejercicios se congelan.* Para ahorrar espacio los tipos se agrupan en familias (`choice`, `text_input`, `ordering`, `matching`, `cloze`, `transform`, `open_ai`, `audio`, `reading`, …).
- **CA:** 1) un paquete válido de muestra pasa; 2) 25 paquetes inválidos (uno por regla) son rechazados con mensaje claro; 3) importación idempotente; 4) validador CLI devuelve código de salida ≠ 0 si hay errores; 5) rendimiento: validar un paquete de 2.000 ítems < 1 s; 6) **`add-pack`:** agregar el paquete de muestra a un repo temporal lo copia y deja `index.json` correcto; repetir el comando no cambia nada (hash idéntico); un lote con 1 paquete inválido entre 3 no escribe **ningún** archivo; versión mayor reemplaza, menor o igual-distinta falla; `--dry-run` no toca el disco; IDs duplicados contra un paquete ya instalado se detectan; rutas con `..` rechazadas; 7) `docs/ADD_PACK.md` existe y sus comandos funcionan tal cual están escritos.
- **Pruebas:** una por regla de validación, idempotencia, migración de paquete v1→v2 simulada; `tests/add-pack.test.mjs` (repo temporal en `os.tmpdir()`, cubre los casos del CA 6).

### 1.4 Motor de repaso espaciado (FSRS)
- **Dep.:** 0.7, 1.1.
- **Objetivo:** `core/srs.js` (interfaz `Scheduler`) + vendorización de `ts-fsrs`.
- **Pasos:** (1) **Pedir a William** que descargue desde jsDelivr el build **ESM** de `ts-fsrs` en la versión fijada (el chat debe verificar versión vigente y la ruta exacta del archivo; el Administrador sugiere 5.4.1 o la más reciente con ≥ 2 semanas de antigüedad) y lo suba, junto con su `LICENSE` (MIT); (2) colocar en `vendor/ts-fsrs/` con `VERSION.txt`; (3) envolver con la interfaz del contrato 8.15; (4) **fallback** documentado: `core/srs.simple.js` (intervalos tipo Leitner) para que la app no muera si FSRS falla, activable desde Ajustes (solo para emergencias).
- **Alcance:** `newCard`, `review(card,rating,now)`, `retrievability`, `levelOf` (cortes de 8.4), `dueLabel` ("Repaso en 4 sems"), `previewIntervals`, retención objetivo configurable, **modo rescate** (si hay > N vencidas: priorizar las de menor retrievabilidad y limitar el cupo diario, sin culpa), sanguijuelas (suspender + marcar), tarjetas con `facet`. Sin `Math.random` sin inyectar (FSRS tiene "fuzz": debe poder desactivarse o sembrarse para pruebas).
- **CA:** 1) intervalos crecen tras aciertos y se reducen tras fallo (propiedad verificada); 2) retrievabilidad ∈ [0,1] y decrece con el tiempo; 3) 8 fallos → sanguijuela; 4) `levelOf` y `dueLabel` en todos los bordes (1 min, 1 h, 1 d, 3 sem, 2 años); 5) reloj hacia atrás no produce NaN ni intervalos negativos; 6) licencia incluida.
- **Pruebas:** propiedades, bordes, determinismo con semilla, modo rescate, sanguijuela.

### 1.5 Calificación por acierto + tiempo
- **Dep.:** 1.4.
- **Objetivo:** `core/grading.js`: traducir resultado + tiempo a los 4 niveles de FSRS (**pedido explícito de William: "no solo si acerté sino el tiempo"**).
- **Reglas (valores iniciales en `grading.config.js`):** `Again(1)` si `wrong`/`dont_know`/`skipped`; `Hard(2)` si correcto pero tardó > 1,8× su mediana personal para ese tipo de ejercicio, o usó pista, o fue `almost`; `Good(3)` si correcto en rango normal; `Easy(4)` si correcto y < 0,6× su mediana y sin pista. La **mediana personal** se calcula por `exerciseType` con los últimos 30 eventos correctos (mínimo 8; antes de eso se usan constantes por tipo). Tiempos > 5× o pausas (pestaña oculta) se **recortan/ignoran** para no castigar distracciones. Tarjetas de recuerdo libre sin verificación: 4 botones manuales.
- **CA:** 1) tabla de decisión completa probada; 2) pestaña oculta/tiempo extremo no baja rating; 3) con < 8 datos usa constantes; 4) `dont_know` = 1 siempre.
- **Pruebas:** tabla exhaustiva, medianas, recortes.

### 1.6 Registro de errores y catálogo de códigos
- **Dep.:** 1.1, 1.2.
- **Objetivo:** `core/errors.js` según 8.8 + `content/taxonomy/error_codes.json` completo.
- **Alcance:** catálogo con, por código: `id`, `titulo_es`, `descripcion_es`, `origen_tipico`, `impacto_defecto`, `temas_relacionados`, `ejemplo_malo/bueno`, `pista_corta_es` (microexplicación para mostrar al fallar); detector **mecánico** de errores comunes por reglas/regex sobre respuestas de texto (can/could + to, doble negación, `didn't + pasado`, `-ed` sobre irregulares conocidos, `i` minúscula, `since`+duración, `interested about`…) para el modo sin IA; `record()` con deduplicación/contador, regla de reincidencia (3 veces/14 días), `top(n, rango)` por frecuencia × impacto; hook para clasificación por IA (se implementa en 5.5; aquí solo la interfaz y el modo mecánico).
- **CA:** 1) ≥ 45 códigos del catálogo del 8.8 completos; 2) detector mecánico acierta los ejemplos reales de William listados en 7.10 (tabla de prueba con ≥ 40 frases reales); 3) cero falsos positivos en 30 frases correctas de control; 4) `top` ordena correctamente; 5) idempotencia.
- **Pruebas:** tabla de frases reales/correctas, contadores, reincidencia, ranking.

### 1.7 Motor de dominio por tema
- **Dep.:** 1.1, 1.4, 1.6.
- **Objetivo:** `core/mastery.js` + `mastery.config.js` según 8.7.
- **Alcance:** señales R, P, U, E; `pct`, `band`, `confidence`; topes por descenso; `masteryToSophiaVal`; agregación por nivel y por área (media ponderada por cantidad de ítems); `atRisk(topics)` (tema con retrievabilidad baja o errores recientes); `toStudy(topics)`; **explicabilidad**: devuelve un desglose textual en español ("Tu dominio es 54 %: retención 70 %, producción 40 %, …") para mostrar al tocar el porcentaje; caché invalidada por eventos.
- **CA:** 1) sin eventos → 0 % "Sin ver"; 2) monotonía razonable (más aciertos no bajan el %); 3) topes de descenso; 4) U `null` reparte pesos y baja confianza; 5) bordes de bandas (0, 1, 29, 30, 59, 60, 84, 85, 100); 6) 100 temas × 5.000 eventos < 300 ms.
- **Pruebas:** escenarios construidos (estudiante nuevo, estudiante que falla, vuelve tras 3 semanas), bordes, rendimiento.
- **Estado (verificado el 2026-10-23 sobre `sophia-ingles_1.7-T2_v0.14.0.zip`):** T1 y T2 **HECHOS**, sin subir versión (el repo sigue en 0.14.0). Existen `core/mastery.config.js`, `core/masterySignals.js`, `core/mastery.js`, `tests/masterySignals.test.mjs` (23 pruebas) y `tests/mastery.test.mjs` (30). Cubiertos los CA 1–5. Faltan: agregación, `atRisk`, `toStudy`, caché (T3), explicabilidad y CA 6 (T4). El contrato real de lo ya construido está en 8.7 («Implementación congelada»).

### 1.8 Armador de sesiones
- **Dep.:** 1.3, 1.4, 1.7.
- **Objetivo:** `core/session.js`: dado tiempo/energía/cupos, produce una `SessionPlan` (lista ordenada de ítems/cards) de **20 ítems por defecto** (configurable).
- **Reglas:** (1) **primero** repasos vencidos (modo rescate si hay atraso); (2) luego tarjetas nuevas, con tope diario y **máx. 2–3 temas nuevos activos por área**; (3) **intercalado**: nunca > 2 ítems seguidos del mismo tema ni del mismo tipo de ejercicio (si hay opciones); (4) **variedad de formato** por tema; (5) excluir suspendidas/sanguijuelas; (6) respetar `energy` (bajo: ejercicios más ligeros y sesión más corta; no es un "modo especial"); (7) **sin rachas ni mensajes de culpa**; (8) opcional `topicFocus` (practicar un tema concreto) y `errorFocus` (detective de errores: ítems de los errores propios); (9) para ejercicios de producción, mezclar con reconocimiento en la progresión (reconocimiento → producción conforme sube el dominio); (10) determinista con `rng` semillado.
- **CA:** 1) 20 ítems exactos si hay material; menos si no hay (nunca duplica); 2) intercalado cumplido en todos los casos de prueba; 3) sin ítems suspendidos; 4) cupos respetados; 5) con 0 ítems devuelve plan vacío con razón ("no hay material: carga un paquete"); 6) determinismo.
- **Pruebas:** 12 escenarios (nuevo, atrasado, solo un tema, energía baja, sin contenido…), propiedades de intercalado.

### 1.9 Consultas de estadísticas
- **Dep.:** 1.1, 1.7.
- **Objetivo:** `core/stats.js`: funciones puras para las pantallas de P3.
- **Alcance:** minutos/ítems por día, precisión por tipo/tema/área, tiempo medio por tipo, tarjetas por nivel (1–5), pronóstico de repasos por día (próximos 14 días), retención real vs objetivo, mapa de calor (área × nivel), tendencias de dominio (serie), "horas planeadas vs hechas" (solo informativo), XP/rango **opcional** (fórmula simple en `stats.config.js`, sin penalizaciones).
- **CA:** 1) resultados correctos con datos de prueba conocidos; 2) rangos vacíos → estructuras vacías (no excepciones); 3) < 200 ms con 50.000 eventos.
- **Pruebas:** casos conocidos, vacíos, volumen.

### 1.10 Cliente de IA (proveedores, caché, límites, JSON seguro)
- **Dep.:** 0.8.
- **Objetivo:** `core/ai/` según 8.15.
- **Archivos:** `core/ai/index.js` (fachada `complete`), `providers/groq.js` (formato OpenAI-compatible; endpoint y modelo editables), `providers/none.js` (sin IA → devuelve `{ok:false, reason:'no_ai'}`), `queue.js` (cola con límite de concurrencia y reintentos con espera exponencial ante 429/5xx), `cache.js` (clave = hash de tarea+entrada; guarda en `generated`), `schema.js` (validación de JSON devuelto), `prompts/` (carpeta; vacía salvo `system.base.js` con el **prompt base del tutor**: español para explicaciones, inglés americano, nivel del usuario, formato JSON estricto cuando se pide, nunca inventar reglas, marcar duda).
- **Requisitos:** cero claves en código; timeout configurable (defecto 20 s); manejo explícito de 401 (clave inválida → mensaje amable), 429 (cupo: avisar y usar modo mecánico), red caída, respuesta no-JSON (reintento único con "corrige a JSON válido"), contenido vacío; **el texto de la IA siempre se escapa** al mostrarse; registro de cada llamada como evento `ai_call` (sin guardar la clave ni el prompt completo, solo tarea, tokens aprox., éxito/fallo, ms); **verificar en documentación actual** el nombre vigente del modelo por defecto y límites gratuitos de Groq y dejar el modelo editable; `ai.available()` para decidir modo IA vs. mecánico.
- **CA:** 1) con servidor falso (mock) pruebas de 200/401/429/500/timeout/JSON inválido; 2) caché evita llamadas repetidas; 3) sin clave → `available() === false` y nada intenta salir a red; 4) reintentos con tope; 5) ninguna clave en logs.
- **Pruebas:** mock de `fetch` para todos los casos; caché; cola; esquema.

### 1.11 Validador de lista blanca (lemas dominados) — principio 90–95 %
- **Dep.:** 1.3, 1.7.
- **Objetivo:** `core/whitelist.js` + `content/taxonomy/lemmas.json` (formas flexionadas → lema para ≥ 3.000 palabras inglesas más frecuentes; **se genera con la pista C — C10 — y aquí se entrega el cargador, el formato y una semilla de ≥ 300 palabras más el script de verificación**).
- **Alcance:** tokenizar (contracciones, guiones, números, nombres propios opcionales), lematizar con la tabla, `check(text, knownLemmas) → {unknown[], pctKnown}`; `knownLemmas(db)` = lemas con estado `known`/`learning` + lemas de los ítems de temas con dominio ≥ umbral + lista base A1 inicial; `isWithinTarget(pct, {min:0.90,max:0.95})`; utilidad para marcar las palabras nuevas de un texto (pasan a la lista de estudio).
- **CA:** 1) tokenización correcta de `don't`, `well-known`, `U.S.`, `3rd`; 2) palabras desconocidas se devuelven en su forma original y lema; 3) `pctKnown` correcto en 10 textos de control; 4) maneja texto vacío y emoji.
- **Pruebas:** tokenización, lematización, porcentajes, bordes.

### 1.12 Núcleo de sincronización: respaldo y puente con el chat
- **Dep.:** 0.7, 1.1, 1.6.
- **Objetivo:** `core/sync.js` según 8.14.
- **Alcance:** `exportBackup`/`importBackup` (validación de versión, modo "fusionar" vs. "reemplazar" con vista previa del impacto, **claves excluidas por defecto**); `makeChatBlock('llevar_al_chat'|'errores'|'estado'|'bitacora', payload)`; `parseChatBlock(text)` tolerante (ignora texto alrededor, comillas curvas, espacios, bloques markdown ```), con validación estricta del JSON y mensajes de error en español; importación idempotente de errores del chat; generador de **bitácora en texto plano** (fecha, qué se hizo, dominio por área, errores top, pendientes).
- **CA:** 1) ida y vuelta de respaldo sin pérdida (comparación profunda); 2) reimportar el mismo bloque no duplica; 3) JSON malformado o malicioso (`__proto__`, tamaños enormes) rechazado con mensaje claro; 4) el respaldo no contiene claves por defecto.
- **Pruebas:** round-trip, idempotencia, entradas hostiles, tolerancia de formato.

> **HITO M0.5 (tras 1.12):** toda la lógica existe y pasa la suite completa. El chat que cierra la 1.12 compara `docs/CONTRACTS.md` con la sección 8, escribe las diferencias en `DECISIONS.md` y marca el documento como "contratos v1 congelados"; solo si alguna diferencia exige cambiar la sección 8, emite un PROMPT PARA ADMIN.

---

# PARTE 2 — SESIÓN JUGABLE (estilo Epop)

> Objetivo de la Parte 2: que William pueda **estudiar de verdad** una sesión de 20 ítems con contenido real. Cada componente de ejercicio sigue el contrato `mount/destroy/getResponse` y usa las funciones puras de `core/`.

### 2.1 Ejecutor de sesión
- **Dep.:** 1.8, 0.5.
- **Objetivo:** `ui/views/session.js` + `core/sessionRunner.js` (máquina de estados pura): `idle → presenting → answering → feedback → next → summary`.
- **Alcance:** cabecera (atrás, barra `X/20` con la mascota que avanza, ajustes rápidos), manejo de **salir a mitad** (confirmación amable; lo respondido ya está guardado; se puede retomar), cronómetro por ítem (pausa si la pestaña se oculta), registro de evento + actualización de tarjeta de forma atómica **tras cada respuesta** (si se cierra la app a mitad no se pierde nada), registro de errores, selección de componente por `type` (registro `ui/exercises/index.js`), pantalla de "tipo no soportado todavía" amable (para tipos de partes futuras).
- **CA:** 1) flujo completo con ítems de prueba; 2) cerrar y reabrir a mitad restaura el estado; 3) cada respuesta produce exactamente 1 evento y 1 actualización de tarjeta (prueba); 4) doble toque en "Comprobar" no duplica evento; 5) atrás → confirmación; 6) tiempo en pestaña oculta ignorado.
- **Pruebas:** máquina de estados (tabla), atomicidad, idempotencia de toques, restauración.

### 2.2 Tarjeta de lección `phrase_cloze` (réplica de la interacción Epop, con teclado)
- **Dep.:** 2.1.
- **Objetivo:** la tarjeta central de la app (ver 7.7).
- **Alcance:** frase/mini-diálogo ES con turnos **A/B** y palabra clave en verde; versión EN con hueco; **caja de gramática** (fondo dorado) y **caja de matiz**; entrada por **teclado** (modo voz llega en 8.1: dejar el botón de micrófono **deshabilitado con aviso "disponible pronto"**); botón **Ver pista** (primera letra, luego estructura; cuenta como pista en grading); botón **No sé**; corrección con `wordDiff`; insignias `Nivel N (?)`, `New`, corazón (favorita), `Repaso en …`; el "?" explica el nivel 1–5 en una hoja; etiqueta de "situación" (no "fuente de película").
- **CA:** 1) renderiza correctamente con y sin caja de gramática/matiz; 2) palabra clave resaltada en ES y EN a la vez; 3) `almost` muestra aviso ortográfico y crea tarjeta de deletreo (evento + tarjeta `spell`); 4) corazón guarda `fav`; 5) 360 px sin cortes, textos largos hacen wrap; 6) accesible (lector de pantalla lee "hueco").
- **Pruebas:** render con DOM falso, `grade`, aviso de ortografía, pista progresiva.

### 2.3 Familia de elección: `choose_correct`, `ab_natural`, `mcq_en_es`, `mcq_es_en`, `pick_fits`, `odd_one_out`, `choose_tense`, `prep_pick`, `particle_pick`
- **Dep.:** 2.1.
- **Alcance:** un componente base `choice` parametrizable + envoltorios; opciones barajadas con `rng` (ordenar ≠ siempre en la misma posición); opción **"No sé"** siempre visible; feedback que **explica por qué** la opción escogida (si fue distractor con `code`) es el error típico (usa `pista_corta_es` de 1.6); selección múltiple opcional.
- **CA:** 1) la posición de la correcta varía (prueba estadística); 2) "No sé" registra `dont_know`; 3) distractor con `code` dispara registro del error; 4) tamaños táctiles ≥ 44 px; 5) opciones largas se ven completas.
- **Pruebas:** `grade`, barajado, registro de error por distractor.

### 2.4 Familia de ordenar/emparejar/completar: `order_blocks`, `unscramble_letters`, `cloze_bank`, `match_pairs`, `order_dialogue`, `build_from_keywords`
- **Dep.:** 2.1.
- **Alcance:** interacción táctil por **toques** (sin depender de arrastrar; arrastre opcional si es sólido en móvil), deshacer, reiniciar; `order_blocks` acepta varios órdenes válidos (`accept`); `match_pairs` con 5–6 pares y retroalimentación inmediata por par; `cloze_bank` con banco de palabras.
- **CA:** 1) sin arrastre obligatorio; 2) varios órdenes válidos aceptados; 3) deshacer funciona en todos los pasos; 4) no hay estados imposibles (doble toque en el mismo bloque); 5) correcto con 2 y con 12 bloques.
- **Pruebas:** `grade` con múltiples soluciones, secuencias de toques aleatorias (fuzz) sin excepciones.

### 2.5 Familia de producción corta: `fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word`, `derive_form`, `three_forms`, `trap_translate`, `translate_bank`, `fix_error`, `transform`, `keyword_transform`, `join_sentences`, `pronoun_placement`
- **Dep.:** 2.1, 1.2.
- **Alcance:** entrada de texto con `compare`; aceptación de variantes y contracciones; para `three_forms` tres campos con feedback por forma (cada forma = tarjeta/faceta distinta: grading por faceta); para `fix_error` mostrar la oración y pedir la versión corregida; **detector mecánico** de errores (1.6) sobre la respuesta incorrecta para dar pista específica ("Parece que usaste *can to*…"); mapeo de errores a `ErrorRecord` automático.
- **CA:** 1) variantes y contracciones aceptadas; 2) `almost` → marca ortografía; 3) respuesta vacía no se envía; 4) `three_forms` califica por forma; 5) errores conocidos se detectan y registran; 6) teclado móvil sin autocorrección ni mayúscula forzada.
- **Pruebas:** tabla de respuestas (≥ 80 casos con las del diagnóstico), errores detectados, facetas.

### 2.6 Retroalimentación, pistas y flujo "No sé"
- **Dep.:** 2.2–2.5.
- **Objetivo:** una capa común de feedback coherente en toda la app.
- **Alcance:** panel de feedback (correcto/casi/incorrecto/no sé) con tono cálido sin culpa; muestra respuesta correcta, `explain_es`, `grammar_note_es`, `nuance_es`; "No sé" no usa lenguaje de fallo; campo opcional "¿por qué creías eso?" (para teoría; se guarda como evento `note`); botón "Marcar como difícil"/"No me convence esta frase" (reporte local); sonidos/vibración sutiles opcionales; la mascota reacciona sin exagerar.
- **CA:** 1) mismo panel en todos los tipos; 2) textos sin culpa (revisión de cadenas); 3) respuesta correcta siempre visible tras fallar; 4) la nota se guarda y se asocia al ítem.
- **Pruebas:** snapshot de textos, guardado de nota.

### 2.7 Barra de 4 acciones: Otros ejemplos · Correcciones · Preguntas IA · Diccionario (versión mecánica)
- **Dep.:** 2.2, 1.6.
- **Alcance:** barra fija inferior (replicando 7.7). **Otros ejemplos (mecánico):** muestra ≥ 3 ejemplos del mismo tema/ítem desde el paquete (la versión IA llega en 5.2). **Correcciones:** hoja con los errores propios relacionados con este ítem/tema (contador en insignia). **Preguntas IA:** botón visible; sin IA muestra "Conecta tu clave en Ajustes" y ofrece **"Llevar al chat"** (genera bloque de 8.14). **Diccionario:** búsqueda en el léxico local; si la palabra no está, ofrece "añadir".
- **CA:** 1) las 4 acciones abren su hoja sin perder el ejercicio; 2) contador de correcciones exacto; 3) "Llevar al chat" copia el bloque (con fallback si el portapapeles falla); 4) diccionario tolera mayúsculas/acentos.
- **Pruebas:** contador, bloque de chat, búsqueda.

### 2.8 Resumen de sesión y revisión de errores
- **Dep.:** 2.1, 1.9.
- **Alcance:** al terminar (o abandonar), pantalla de resumen: ítems, aciertos, tiempo, mejoras de dominio por tema (con confianza), **errores nuevos y recurrentes con su microexplicación**, "próximos repasos" (cuándo vuelve cada cosa), botón "Repetir los que fallé" (mini-sesión), "Llevar al chat" lo más importante, mensaje final cálido y honesto (nunca de culpa, nunca falso elogio).
- **CA:** 1) cifras coinciden con eventos (prueba cruzada); 2) abandonar a mitad muestra resumen parcial; 3) mini-sesión de repaso de fallos funciona; 4) con 0 respuestas no muestra NaN.
- **Pruebas:** cruce eventos↔resumen, parcial, vacío.

### 2.9 Paquete semilla S0 y recorrido de extremo a extremo (HITO M1)
- **Dep.:** 2.1–2.8, 1.3.
- **Objetivo:** un paquete real mínimo (`pack_seed_v1`: **≥ 60 ítems originales**, ≥ 5 temas de prioridad 1: `present_perfect.for_since`, `irregular_past`, `can_base_verb`, `gerund_infinitive`, `dependent_prepositions`) y el recorrido completo.
- **Alcance:** autor del paquete = este chat (cumpliendo reglas de calidad de 8.10 y del apartado C-reglas de este documento); se instala con `npm run add-pack` (no a mano); import automático al primer arranque; botón "Estudiar ahora" en Hoy que arma la sesión 1.8; **guion de prueba manual de 10 pasos para William** (instalar, estudiar 20 ítems, cerrar a mitad y reabrir, fallar a propósito, ver errores, ver próximos repasos, modo avión, cambiar tema).
- **CA:** 1) William completa una sesión real sin errores; 2) los errores que él cometa (`can to`, `leaved`, `since two years`…) se registran con código correcto; 3) a los 2 días simulados (cambiar reloj de prueba) aparecen repasos vencidos; 4) todo funciona sin conexión.
- **Pruebas:** simulación de 5 días de uso con respuestas generadas (script) verificando invariantes (no hay tarjetas duplicadas, `due` coherente, eventos = respuestas, dominio no baja sin causa).

> **HITO M1:** primera sesión jugable. William prueba en su teléfono y reporta. El chat siguiente corrige lo reportado antes de seguir; un cambio de UX que altere un contrato va por PROMPT PARA ADMIN (3.A).

---

### 2.10 Rediseño de los temas Neo y Claro (2 tramos)
- **Dependencias:** 0.3 (tokens y temas), 2.9 (la app ya se usa).
- **Objetivo:** que Neo y Claro tengan la misma calidad visual que Aurora y que el proyecto de referencia de William (solo como inspiración).
- **Primer mensaje del chat:** pide a William, con pasos para quien no sabe de tecnología, el `index.html` del proyecto de referencia y 2–3 capturas de cada tema en su teléfono.
- **Alcance:** solo valores de `ui/styles/themes.css` y tokens (colores, fondos, sombras, bordes, tipografía) **sin cambiar nombres de variables ni estructura de componentes**; contraste AA en todo texto; Aurora no se toca.
- **CA:** 1) los 3 temas pasan las pruebas de contraste AA; 2) la galería (`demo.html`) y las 5 pestañas se ven bien en los tres; 3) ninguna prueba existente se rompe; 4) William confirma con capturas en el siguiente hito.

---

# PARTE 3 — MAPA, PLAN, ESTADÍSTICAS Y ERRORES

### 3.1 Vista de mapa de contenidos
- **Dep.:** 2.9, 1.7.
- **Alcance:** áreas → niveles (PreA1…C2) → temas, con % de dominio **y confianza**, símbolo de banda (○◔◑◕●), mapa de calor, filtros "A estudiar" / "En riesgo" / "Diagnosticado como hueco", búsqueda; prerrequisitos **solo sugeridos** (insignia "te conviene ver antes: …", nunca bloquea); al tocar el porcentaje, **desglose explicado** (1.7).
- **CA:** 1) 250 temas fluidos (virtualizar/paginar si hace falta); 2) filtros correctos; 3) ningún tema bloqueado; 4) % y confianza coinciden con `mastery`.
- **Pruebas:** filtros, datos grandes, coincidencia con el motor.

### 3.2 Detalle de tema y fichas cortas de teoría
- **Dep.:** 3.1.
- **Alcance:** ficha corta (regla, forma, uso, ejemplos con audio cuando exista, errores típicos de hispanohablantes, contraste con el español) **sin teoría extensa**; estado y desglose de dominio; botón **"Llevar al chat"** (bloque con ficha + errores propios + pregunta pendiente); botón "Practicar este tema" (sesión `topicFocus`); historial del tema (últimos eventos y errores).
- **CA:** 1) ficha renderiza con campos opcionales ausentes; 2) "Llevar al chat" incluye errores reales del usuario en ese tema; 3) practicar arma sesión solo del tema; 4) tema sin ítems muestra estado vacío útil.
- **Pruebas:** campos ausentes, bloque de chat.

### 3.3 Ciclo de examen de entrada y de salida por tema
- **Dep.:** 3.2, 1.8.
- **Alcance:** ciclo definido: **examen de entrada** (producción + una pregunta de teoría "explícame la regla" verificada por IA si hay, o por el chat si no) → si pasa, el tema pasa a *mantenimiento*; si no, se marca "a estudiar con el chat" → práctica graduada → **examen de salida con ítems NUEVOS** (no usados en práctica) → repaso espaciado normal. Formato "limpio" para vocabulario (7.10: sin pistas de contexto, opción "No sé" explícita). Mínimo de ítems por examen configurable (defecto 8; se arman de los ≥ 12 del tema).
- **CA:** 1) el examen de salida no repite ítems de la práctica reciente; 2) "No sé" cuenta como dato; 3) resultado actualiza dominio con eventos `exam_entry`/`exam_exit`; 4) no hay bloqueo si no se pasa; 5) temas con < 12 ítems avisan al usuario y degradan con elegancia.
- **Pruebas:** selección sin repetición, resultados, degradación.

### 3.4 Pantalla "Hoy" y plan flexible del día
- **Dep.:** 1.8, 1.9, 3.1.
- **Objetivo:** `core/plan.js` + vista.
- **Alcance:** pregunta ligera de **tiempo disponible hoy** (slider, valores como 15/30/45/60/90/120/más) y **energía** (de Sophia); el plan prioriza **siempre repasos vencidos**, luego tema nuevo, lectura o escritura/mediación alternando, conversación con IA, bloque externo (listening/speaking reales) y descansos; muestra bloques con tiempo estimado y se puede reordenar/saltar **sin culpa**; **bienvenida al regresar tras una pausa** (cálida, sin reproche; muestra cuánto se acumuló y activa modo rescate); sin "racha"; "horas planeadas vs. hechas" solo informativo; botón único **"Empezar"** siempre visible.
- **Reglas:** máx. 2–3 temas nuevos activos por área; sin modo "día difícil" (decisión de William): el plan se encoge solo con el tiempo/energía.
- **CA:** 1) con 15 min el plan es de ~1 bloque de repaso; 2) tras 10 días sin entrar → bienvenida + rescate, no pantalla de reproche; 3) reordenar y saltar funcionan y se recuerdan; 4) nunca aparece "perdiste tu racha".
- **Pruebas:** planes por tiempo/energía/atraso (tabla), regreso tras pausa.

### 3.5 Vistas de semana y mes
- **Dep.:** 3.4.
- **Alcance:** semana con **tema integrador** (ej. "viajar") que conecta vocabulario+gramática+lectura+escritura+roleplay del mismo campo semántico (el tema se elige de una lista en `content/taxonomy/weekly_themes.json`, que crea el Administrador/pista C), mini-diagnóstico semanal y lista **"Llevar al chat"** de la semana; mes con metas por área, hitos y **sondas de techo cada 4–6 semanas** (se agendan como sugerencia, no obligación); reprogramación sin culpa, días de gracia.
- **CA:** 1) tema semanal sugerido y cambiable; 2) sonda de techo aparece como sugerencia; 3) reprogramar no genera deuda visible; 4) listas "Llevar al chat" correctas.
- **Pruebas:** generación semanal, cadencia de sondas.

### 3.6 Estadísticas y progreso
- **Dep.:** 1.9, 3.1.
- **Alcance:** pantallas con gráficas **dibujadas en SVG/Canvas propios (sin librerías)**: actividad por día, precisión por tipo/tema, tarjetas por nivel 1–5, pronóstico de repasos 14 días, retención real vs. objetivo, tendencia de dominio por área, tiempos medios; XP/rangos **opcionales y desactivables**; todo con confianza/muestra visible; textos honestos ("poca evidencia todavía").
- **CA:** 1) cifras = `stats.js`; 2) gráficas legibles a 360 px; 3) vacío → mensaje amable; 4) desactivar gamificación la oculta por completo.
- **Pruebas:** coherencia números↔gráfica (datos de prueba), vacío.

### 3.7 Pantalla de errores (diario de errores)
- **Dep.:** 1.6, 3.1.
- **Alcance:** ranking "errores top" (frecuencia × impacto), filtro por código/tema/origen (transferencia/desarrollo/desconocimiento)/período, ficha de cada código con ejemplos propios y su microexplicación, acciones: "Practicar este error" (sesión `errorFocus`), "Llevar al chat", importar bloque de errores del chat (8.14, con vista previa); lista de **sanguijuelas** ("Explícamelo en el chat").
- **CA:** 1) ranking correcto; 2) importar bloque de ejemplo crea errores `source:"chat"` sin duplicar; 3) practicar error arma sesión con ítems relacionados; 4) sanguijuelas visibles con acción clara.
- **Pruebas:** ranking, importación idempotente, sesión por error.

### 3.8 Test de nivelación inicial y calibración (opcional)
- **Dep.:** 3.3.
- **Alcance:** carga **el resultado del diagnóstico** de William (de 7.10) como estado inicial **provisional**: marca los temas diagnosticados como "hueco confirmado" (no repreguntar), siembra el dominio inicial con confianza **baja**, y ofrece un test corto adaptativo por área para calibrar; todo editable. Respeta la regla: lo que William dijo "no sé" no se vuelve a preguntar en un diagnóstico.
- **CA:** 1) importación de estado inicial idempotente; 2) los huecos confirmados quedan marcados y no entran a exámenes de entrada (van directo a estudio); 3) la confianza inicial es baja; 4) se puede reiniciar.
- **Pruebas:** siembra, idempotencia, exclusión de huecos del examen de entrada.

> **HITO M2:** app de estudio diario usable: sesiones, mapa, plan, estadísticas, errores.

---

# PARTE 4 — VOCABULARIO, VERBOS, PHRASAL VERBS, PREPOSICIONES Y ORTOGRAFÍA

### 4.1 Léxico, familias y ficha de palabra
- **Dep.:** 3.1, 1.3.
- **Alcance:** almacén `words` y carga de `LexEntry` (8.11); **familias temáticas** (cuerpo, casa, ropa, ciudad, viaje, trabajo, salud, universidad, tecnología…) y **lingüísticas** (colocaciones, phrasal verbs, formación de palabras, falsos amigos, registro), cada una con nivel y prioridad (esenciales primero); ficha de palabra: lema, categoría, significado ES, definición simple EN, ejemplos, audio (si existe), colocaciones, familia de palabras, nota de falso amigo, banda de frecuencia; **estados de palabra** `desconocida / aprendiendo / conocida` (de "tocar palabra"); vista de familias con dominio por familia.
- **CA:** 1) ficha con campos ausentes; 2) cambiar estado persiste y crea/actualiza tarjeta; 3) búsqueda con acentos/mayúsculas; 4) 5.000 palabras fluidas.
- **Pruebas:** estados, búsqueda, volumen.

### 4.2 Ejercicios de vocabulario
- **Dep.:** 4.1, 2.3–2.5.
- **Alcance:** componentes faltantes del catálogo: `categorize`, `lightning` (ronda relámpago de 2 min, **sin penalización**, solo activación), `own_sentence_word` (stub con IA en 5.x; mecánico: copiar ejemplo y variar), `derive_form`; **progresión reconocimiento → producción** según el dominio de la palabra (regla en `core/session.js` extensión documentada: el Administrador aprueba el cambio de contrato).
- **CA:** 1) ronda relámpago cronometrada sin penalización; 2) la progresión sube de tipo cuando sube el dominio; 3) cada palabra tiene ≥ 3 tipos distintos disponibles.
- **Pruebas:** progresión, temporizador.

### 4.3 Examen de entrada "limpio" por familia
- **Dep.:** 4.1, 3.3.
- **Alcance:** formato validado en el diagnóstico: **oración neutra sin pistas de significado + opciones en español + opción E "No sé" explícita** (los cognados inflan el resultado; nunca usar palabra real vs. inventada). Resultado por banda de frecuencia; las palabras fallidas entran a estudio; las "No sé" se registran como dato válido.
- **CA:** 1) ninguna oración contiene pistas de significado (revisión + lista de verificación en el validador); 2) opción "No sé" siempre presente; 3) resultado por banda (1K/2K/3K); 4) no repite palabras ya conocidas.
- **Pruebas:** estructura de ítems, bandas.

### 4.4 Verbos irregulares y regulares (una tarjeta por forma)
- **Dep.:** 4.1, 1.4.
- **Alcance:** `three_forms` y `group_irregulars` (agrupados por patrón: sing-sang-sung con ring-rang-rung); **cada forma (presente, pasado, participio) es una tarjeta separada** en el repaso (faceta 0/1/2); reglas de pronunciación de **-ed** (/t/, /d/, /ɪd/); lote diario configurable (**defecto 5 irregulares/día**, 3–10), orden por frecuencia; clasificación de errores (`VRB.IRREG_REGULARIZE`, `VRB.DOUBLE_PAST`).
- **CA:** 1) 3 tarjetas por verbo con vencimientos independientes; 2) lote diario respeta el tope; 3) agrupación por patrón correcta; 4) fallo en una forma no penaliza las otras.
- **Pruebas:** facetas, lote, agrupación.

### 4.5 Phrasal verbs
- **Dep.:** 4.1.
- **Alcance:** frente propio: separables/no separables, literal/figurado, `pronoun_placement` (`pick it up`, no `pick up it`), `particle_pick`, `phrasal_meaning` con contexto, `formal_synonym`; lote diario (**defecto 3**, 1–6).
- **CA:** 1) separables aceptan el orden correcto con pronombre y rechazan el incorrecto; 2) significados múltiples de un mismo phrasal son tarjetas distintas; 3) lote respeta tope.
- **Pruebas:** colocación de pronombre (tabla), significados múltiples.

### 4.6 Preposiciones dependientes y patrones verbales (gerundio/infinitivo)
- **Dep.:** 4.1.
- **Alcance:** familias `prep` y patrones fijos (`avoid + -ing`, `suggest + -ing`, `tired of + -ing`, `interested in`, `good at`, `afraid of`, `arrived at/in`, `look up`…), con **distractores tomados de los errores reales de William** (7.10), nota de contraste con el español (el español usa infinitivo tras preposición; el inglés usa gerundio), ejercicio `explain_rule` (IA o chat).
- **CA:** 1) cada patrón con ≥ 12 ítems de ≥ 3 tipos (validador); 2) distractores con `code`; 3) contraste ES visible en la ficha.
- **Pruebas:** validador de paquete de muestra.

### 4.7 Ortografía: tarjetas de deletreo y diccionario
- **Dep.:** 2.5, 4.1.
- **Alcance:** generación automática de tarjetas `spell` desde errores de ortografía (flujo de 2.2/2.5) y desde palabras recurrentes (`oportunitys`, `carrer`, `wether`, `firts`…); ejercicios: `spell_from_audio` (cuando haya audio; mientras tanto TTS del navegador), letras desordenadas, completar letras faltantes, homófonos (their/there/they're), duplicación de consonantes, letras mudas, `-y→-ies`; **vista Diccionario** del usuario (palabras tocadas, favoritas, deletreo difícil).
- **CA:** 1) error ortográfico → tarjeta `spell` automática sin duplicados; 2) homófonos con contexto; 3) diccionario filtra por estado.
- **Pruebas:** generación sin duplicados, filtros.

> **HITO M3.**

---

# PARTE 5 — INTELIGENCIA ARTIFICIAL

> Reglas comunes de la Parte 5: toda función IA tiene **modo mecánico de respaldo**; el contenido generado se muestra **escapado**, marcado "no verificado" con botón **"Reportar"**, se guarda localmente en `generated` para no repetir llamadas; los prompts viven en `core/ai/prompts/` con versión y pruebas con respuestas simuladas; ningún prompt incluye datos personales innecesarios; **se limita a la lista blanca** (1.11) cuando el contenido es de práctica.

### 5.1 Configuración, prueba de conexión y estado de IA
- **Dep.:** 1.10, 0.8.
- **Alcance:** pantalla "IA": proveedor, modelo (editable), clave, **botón "Probar conexión"** con diagnóstico claro (clave inválida, sin cupo, sin red), indicador global discreto "IA activa / modo mecánico", contador de llamadas del día, **verificación en documentación actual** de modelo por defecto y límites gratuitos (reporta lo que encontró).
- **CA:** 1) probar conexión cubre 401/429/red/éxito; 2) estado global coherente en toda la app; 3) sin clave todo sigue funcionando mecánico.
- **Pruebas:** mocks de cada resultado.

### 5.2 "Otros ejemplos" con IA (3 capas)
- **Dep.:** 5.1, 2.7, 1.11.
- **Alcance:** capa 1: ejemplos del paquete; capa 2: fuentes abiertas (solo si licencias verificadas en C6/C8); capa 3: el botón pide a la IA **3–5 frases nuevas con la palabra/estructura, en contextos distintos, limitadas a lo dominado**, con traducción y nota de matiz; guarda en `generated`; marca "no verificado" + "Reportar"; respuesta validada con esquema JSON.
- **CA:** 1) frases solo con lemas conocidos (≥ 90 % por `whitelist`) o marcadas lo nuevo; 2) sin IA cae a ejemplos del paquete; 3) no repite llamadas (caché); 4) JSON inválido → reintento único → respaldo.
- **Pruebas:** mocks, lista blanca, caché.

### 5.3 "Preguntas IA" contextuales
- **Dep.:** 5.1, 2.7.
- **Alcance:** mini-chat en hoja inferior **ligado al ítem actual** (conoce el ítem, la respuesta del usuario, el tema, sus errores recientes); respuestas en español, ejemplos en inglés, cortas; botón "Esto no me quedó claro → Llevar al chat"; límite de turnos; historial por ítem.
- **CA:** 1) el contexto enviado incluye lo necesario y **nada de claves**; 2) respuestas escapadas; 3) límite de turnos; 4) errores de red con mensaje amable.
- **Pruebas:** construcción del contexto, límites, mocks.

### 5.4 Calificación de respuestas abiertas con IA
- **Dep.:** 5.1, 2.5.
- **Alcance:** para `translate_free`, `own_sentence_*`, `explain_rule`, `summarize_one_line`: la IA devuelve JSON `{verdict, score, errors[{code,span,fix,explain_es}], praise_es}` con **rúbrica fija** (acierto de estructura objetivo, naturalidad, errores críticos); fusión con el comparador mecánico (si el mecánico dice correcto exacto, no se llama a IA); **casos ambiguos** pasan por IA; sin IA → `needs_review` (queda pendiente para el chat) y no se pierde.
- **CA:** 1) JSON validado con esquema; 2) errores mapeados a códigos existentes (los desconocidos van a `unknown` y se reportan); 3) sin IA no bloquea; 4) la IA no puede "aprobar" lo que el mecánico rechaza por error grave conocido sin dejar rastro (log).
- **Pruebas:** mocks de veredictos, mapeo de códigos, fusión.

### 5.5 Clasificación de errores con IA
- **Dep.:** 5.4, 1.6.
- **Alcance:** la IA clasifica cada error: `kind` (descuido/sistemático), `origin` (transferencia/desarrollo/desconocimiento), `impact`, tema causante; **sin IA** usa el detector mecánico; reconciliación (el mecánico gana si es explícito); lote (varios errores en una llamada) para ahorrar cupo.
- **CA:** 1) campos válidos o descartados con registro; 2) lote ≤ N errores; 3) sin IA no hay regresión.
- **Pruebas:** mocks, reconciliación.

### 5.6 Ciclo de feedback de escritura
- **Dep.:** 5.4, 5.5.
- **Alcance:** ciclo **consigna → escritura → feedback → reescritura → comparación**: consigna con estructuras ocultas de la semana (`write_hidden_goals`) usando solo lo dominado; William escribe (puede usar `[corchetes]` para palabras que no sabe, estrategia válida de circunlocución, que se **fomenta**); feedback en español: 3 aciertos, hasta 5 errores priorizados **por impacto y por tema**, explicación breve, versión corregida; las palabras en corchetes pasan a estudio; los errores van al registro; **reescritura** y comparación 1ª vs 2ª; métricas: palabras, cumplimiento de tarea (p. ej. "quedó corta"), estructuras objetivo logradas; tipos: `write_guided`, `write_email`, `write_describe_image`(sin imágenes: descripción textual), `write_continue_story`, `write_essay`, `write_rewrite`, `write_own_errors`.
- **CA:** 1) feedback prioriza ≤ 5 errores; 2) corchetes detectados y enviados a estudio; 3) reescritura compara versiones; 4) sin IA: guarda el texto y genera "Llevar al chat" con instrucciones de corrección; 5) los errores de William no se "corrigen" sin explicar.
- **Pruebas:** parser de corchetes, mocks de feedback, comparación.

### 5.7 Generador de frases con vocabulario dominado
- **Dep.:** 1.11, 5.2.
- **Alcance:** genera práctica nueva **solo con lemas dominados** (+ máx. 5–10 % nuevo marcado); validación posterior con `whitelist.check` (si excede, se reintenta o se descarta); el usuario puede guardar frases propias para repasarlas.
- **CA:** 1) toda frase pasa el validador; 2) lo nuevo se marca; 3) frases guardadas entran a SRS.
- **Pruebas:** validador, reintento, descarte.

### 5.8 Conversación y juegos de rol (por texto)
- **Dep.:** 5.3, 5.5.
- **Alcance:** roleplay con situaciones (restaurante, aeropuerto, entrevista, universidad, compras, médico…), **objetivo oculto semanal** (estructura que se evalúa sin decirla), límites de turnos y duración, la IA responde con lenguaje **dentro de lo dominado**, no corrige en medio (feedback al cierre: errores por impacto + **3 frases sugeridas para repetir**), transcripción guardada, **guiones fijos de respaldo** sin IA; se registran errores y evidencia `U` de dominio.
- **CA:** 1) la IA respeta lista blanca ≥ 90 %; 2) feedback solo al final; 3) sin IA hay guiones; 4) objetivo oculto evaluado.
- **Pruebas:** mocks de turnos, límites, informe final.

### 5.9 Mediación y pragmática
- **Dep.:** 5.4.
- **Alcance:** `med_summarize`, `med_explain_layperson`, `med_register` (amigo vs. profesor vs. jefe), `med_speech_act` (pedir, rechazar, disculparse, sugerir, quejarse, agradecer; cortesía y atenuación), `med_cross_language` (leer ES y explicar en EN, y viceversa); rúbricas propias.
- **CA:** 1) cada acto de habla tiene rúbrica y ejemplos modelo; 2) feedback sobre registro; 3) sin IA queda pendiente para el chat.
- **Pruebas:** rúbricas, mocks.

### 5.10 Señal de uso real "U" y entrenador semanal
- **Dep.:** 5.6, 5.8, 1.7.
- **Alcance:** conectar la evidencia de uso correcto en escritura/conversación a `mastery` (señal U); **resumen semanal con IA** ("qué mejoró, qué sigue fallando, qué llevar al chat") + versión mecánica; tono honesto y sin culpa.
- **CA:** 1) U sube/baja con evidencia real; 2) el resumen no inventa (se valida contra datos); 3) sin IA hay resumen mecánico.
- **Pruebas:** impacto de U en %, resumen mecánico.

> **HITO M4.**

---

# PARTE 6 — LECTURA E HISTORIAS

### 6.1 Lector con "tocar palabra" (estilo LingQ)
- **Dep.:** 4.1, 2.7.
- **Alcance:** texto en el que **tocar cualquier palabra** muestra significado ES (+ lema, categoría), con botones *desconocida / aprendiendo / conocida*; colores por estado; al marcarla se guarda como tarjeta; frases/expresiones (selección de varias palabras); texto grande ajustable; **modo intensivo** (con ayudas) y **extensivo** (sin ejercicios, **tiempo registrado**).
- **CA:** 1) tocar es preciso con contracciones/guiones/puntuación; 2) estados persisten y colorean todo el texto; 3) palabra sin entrada en el léxico ofrece "añadir significado" (o IA si hay); 4) rendimiento con textos de 3.000 palabras.
- **Pruebas:** tokenización táctil, estados, rendimiento.

### 6.2 Ejercicios de comprensión lectora
- **Dep.:** 6.1.
- **Alcance:** `read_local_q`, `read_global_q`, `read_tfng` (**verdadero/falso/"el texto no lo dice"**), `read_reference`, `order_paragraphs`, `match_headings`, `gap_sentences`, `read_inference`, `summarize_one_line` (IA); preguntas en **español** para medir comprensión y no escritura; tras cada texto: **lista de palabras desconocidas autodeclarada** (práctica estándar del diagnóstico) y **autoevaluación de comprensión que se contrasta con los resultados** (honestidad metacognitiva).
- **CA:** 1) los 3 estados de TFNG; 2) lista de desconocidas se guarda; 3) autoevaluación vs. resultado visible sin juzgar.
- **Pruebas:** `grade` por tipo, lista de desconocidas.

### 6.3 Biblioteca de historias y flujo RAIO-inspirado
- **Dep.:** 6.1, 7.2 (audio; mientras no exista, modo solo texto con TTS del navegador).
- **Alcance:** biblioteca por nivel CEFR (muchas, crecen por lotes de la pista C); flujo por historia: **(1) escuchar varias veces sin texto → (2) ver el texto → (3) repetir en voz alta (shadowing) → (4) ejercicios analíticos (vocabulario, gramática, comprensión)**; progreso por historia; vocabulario/gramática objetivo visibles; repetición hasta que "se sienta natural" (contador, sin obligación).
- **CA:** 1) el orden del flujo se respeta (pero se puede saltar); 2) las palabras nuevas de la historia pasan a estudio; 3) continuidad entre segmentos; 4) funciona con y sin audio.
- **Pruebas:** estado de flujo, progreso.

### 6.4 Comprobador de comprensibilidad 90–95 %
- **Dep.:** 1.11, 6.3.
- **Alcance:** para cada texto calcula `pctKnown`; **selector de textos** que prioriza los que estén en 90–95 %; marca el 5–10 % nuevo en el texto y en el panel; advertencia amable si está fuera de rango; herramienta CLI `tools/check-story-levels.mjs` para la pista C.
- **CA:** 1) cálculo coincide con `whitelist`; 2) selector respeta el rango (configurable); 3) palabras nuevas listadas.
- **Pruebas:** textos de control con % conocido.

### 6.5 Sondas de techo
- **Dep.:** 6.4, 3.5.
- **Alcance:** cada 4–6 semanas, texto o tarea **por encima del nivel actual**, separada de la práctica diaria; mide comprensión y palabras nuevas; ajusta el "techo" estimado por área con confianza; nunca se presenta como juicio.
- **CA:** 1) sonda fuera del plan diario; 2) resultado actualiza techo estimado con confianza; 3) mensaje de resultado honesto sin culpa.
- **Pruebas:** actualización de techo.

### 6.6 Lectura extensiva y seguimiento
- **Dep.:** 6.1.
- **Alcance:** modo libre larga sin ejercicios, con tiempo y palabras leídas registrados; objetivos blandos y opcionales.
- **CA:** 1) tiempo real excluye pestaña oculta; 2) sin presión; 3) estadísticas lo reflejan.
- **Pruebas:** tiempo.

> **HITO M5.**

---

# PARTE 7 — AUDIO

### 7.1 Tubería de audio en el PC de William (herramientas)
- **Dep.:** 1.3.
- **Objetivo:** herramientas **que William ejecuta en su PC** para generar MP3 con **Kokoro** (Apache, local, gratis) sin costo ni riesgo.
- **Alcance:** `tools/audio/` con script(s) (Python o Node; **verificar instrucciones vigentes de instalación de Kokoro** y dependencias) que: lee los paquetes de `content/`, extrae cada texto con su `audio` objetivo, genera un MP3 por texto (voz en-US consistente por personaje A/B; velocidad normal y lenta si se pide), nombra `audio/<id>.mp3` (y `<id>.slow.mp3`), normaliza volumen, escribe `audio/manifest.json` (id → archivo, duración, hash del texto, voz); **incremental** (solo regenera lo que cambió); `docs/AUDIO_GUIDE.md` paso a paso para William.
- **CA:** 1) corre en un PC estándar con instrucciones verificadas; 2) incremental; 3) el manifest valida con el validador; 4) tamaño total estimado reportado (para decidir cuánto audio empaquetar; MP3 mono ~24–32 kbps para voz).
- **Pruebas:** parte de Node probada con textos de muestra (sin ejecutar Kokoro); el resto = prueba manual de William.

### 7.2 Reproductor de audio
- **Dep.:** 7.1, 0.6.
- **Alcance:** `core/speech/player.js`: reproducir por `id` con manifest, **velocidad 0.7×–1.2×**, repetir, siguiente, A–B opcional, caché con límite en el service worker, **respaldo a `speechSynthesis`** si no hay archivo, manejo de la política de autoplay de Android (primer toque), precarga del siguiente audio, controles *Normal (conejo) / Lento (tortuga) · Otra vez · Siguiente* (7.7).
- **CA:** 1) sin archivo cae a TTS del navegador sin error; 2) cambia velocidad sin re-descargar; 3) sin conexión reproduce lo cacheado; 4) no se superponen dos audios.
- **Pruebas:** selección de fuente, cola, manifest (con mocks de `Audio`).
- **Prueba manual (William):** reproducir lento/normal, modo avión.

### 7.3 Dictado y cloze auditivo
- **Dep.:** 7.2, 2.5.
- **Alcance:** `dictation` (frase completa; tolerancia ortográfica y marcado; velocidad y repeticiones), `cloze_audio`, `spell_from_audio`; **progresión:** con transcripción y lento → sin transcripción y a velocidad real.
- **CA:** 1) tolerancia coherente con 8.5; 2) contador de repeticiones influye en grading como pista; 3) progresión automática por dominio.
- **Pruebas:** `grade`, progresión.

### 7.4 Habla conectada y pares mínimos auditivos
- **Dep.:** 7.2.
- **Alcance:** `connected_speech` (enlaces, elisiones, formas débiles: *wanna, gonna, whaddaya*), `minimal_pair_listen` (ship/sheep, bit/beat, vote/boat…), `what_did_they_say`.
- **CA:** 1) pares con audio de ambas palabras; 2) distractores por fonema problemático; 3) errores se registran con `PRON.*`.
- **Pruebas:** `grade`, códigos.

### 7.5 Comprensión auditiva y escucha extensiva
- **Dep.:** 7.2, 6.2.
- **Alcance:** `listen_comprehension` (sin transcripción; preguntas; transcripción solo al final), `follow_instruction`, `extensive_listening` (tiempo registrado); fuentes: contenido propio + enlaces a **VOA Learning English** y **LibriVox** (dominio público; verificar términos antes de incluir archivos; si no se incluyen, solo enlaces).
- **CA:** 1) la transcripción no se ve hasta el final; 2) tiempo de escucha registrado; 3) verificación de licencias documentada.
- **Pruebas:** orden de revelado, tiempo.

### 7.6 Shadowing diario
- **Dep.:** 7.2, 6.3.
- **Alcance:** módulo de ~5 min: escuchar frase → repetir en voz alta (sin evaluación automática hasta la Parte 8) → auto-evaluación (3 caritas) → siguiente; integrado al plan (3.4).
- **CA:** 1) dura ≈ 5 min por defecto (configurable); 2) auto-evaluación guarda evento; 3) entra al plan.
- **Pruebas:** temporizador, evento.

> **HITO M6.**

---

# PARTE 8 — VOZ Y PRONUNCIACIÓN

> **Honestidad obligatoria:** ningún sistema automático sustituye a un hablante nativo. Azure es una **guía formativa diaria** (concordancia ≈ 0,78 oración / 0,62 palabra con expertos); se complementa con **verificación humana cada 4–6 semanas** (exportar grabación para que alguien nativo la escuche).

### 8.1 Reconocimiento de voz (STT) con color por palabra
- **Dep.:** 2.2, 7.2.
- **Alcance:** `core/speech/stt.js` con la API de voz del navegador (`SpeechRecognition`, `lang: en-US`), permisos de micrófono (HTTPS ya cubierto por GitHub Pages), estados claros (escuchando/procesando/error), burbuja "esto entendí" con **cada palabra coloreada** (verde = coincide, rojo = no) como en 7.7; **activa el micrófono en `phrase_cloze`** con "Modo teclado" siempre disponible; manejo de que Android/Chrome puede enviar el audio a un servicio externo: **informar a William con claridad**; fallbacks si la API no existe o falla; **no es evaluación de pronunciación** (solo si el reconocedor te entendió: indicador débil de inteligibilidad).
- **CA:** 1) denegar permiso no rompe nada y ofrece teclado; 2) sin soporte → ocultar micrófono con explicación; 3) palabras coloreadas correctamente; 4) no se guardan grabaciones.
- **Pruebas:** comparación de transcripción, estados con mocks.
- **Prueba manual (William):** hablar en 3 frases y ver colores.

### 8.2 Azure Pronunciation Assessment: cliente y configuración
- **Dep.:** 8.1, 0.8.
- **Alcance:** guía paso a paso (`docs/AZURE_GUIDE.md`) para crear el recurso **Speech con nivel F0 (gratuito)** vía **Azure for Students** con el correo UIS (sin tarjeta según la página oficial; **verificar disponibilidad por región/país y reportar al Administrador**; si no es viable, plan B en 8.5); campos clave/región en Ajustes; cliente `core/speech/azure.js` (SDK JS oficial o REST: **verificar la forma más ligera y vigente**; sin dependencias nuevas sin permiso) que envía audio **de ≈ 10 s** y devuelve precisión, fluidez, completitud, **prosodia (solo en-US)** a nivel palabra y fonema; **contador local de uso mensual** (aviso a 80 %; **jamás cambiar a plan de pago**; si el servicio se limita, mensaje claro); modo "sin Azure" = solo 8.1.
- **CA:** 1) clave/región vacías → función oculta con explicación; 2) errores 401/403/429 con mensajes amables; 3) contador de uso correcto; 4) cero claves en logs; 5) sin red → degrada.
- **Pruebas:** parser de resultados con respuestas simuladas, contador.
- **Prueba manual (William):** crear recurso y probar 5 frases.

### 8.3 Ejercicios de pronunciación
- **Dep.:** 8.2, 7.4.
- **Alcance:** `read_aloud_score` (puntaje por sonido en **verde/ámbar/rojo** con **pista en español de cómo colocar la boca**), `echo_repeat`, `minimal_pair_speak`, `sound_drill` dirigido a un sonido a la vez (orden de 7.11), `stress_mark`, `rhythm_sentence` (stress-timing), `describe_image_speak` (sin imágenes: descripción por consigna); **cada sonido fallado → tarjeta de repaso** (`PRON.*`); clasificación fina sustitución/omisión/adición **construida por nosotros** sobre datos crudos (reconocer limitación: Azure no la da).
- **CA:** 1) colores por umbrales configurables; 2) cada sonido fallado crea 1 tarjeta sin duplicados; 3) sin Azure degrada a STT; 4) pistas en español correctas por fonema.
- **Pruebas:** mapeo fonema→pista, creación de tarjetas, umbrales.

### 8.4 Conversación por voz con IA
- **Dep.:** 5.8, 8.1, 7.2.
- **Alcance:** flujo: hablas → STT → IA responde → se lee en voz alta (TTS del navegador o audio) → **modo manos libres**; elección de tema/rol; transcripción guardada; informe de errores al cierre + **3 frases sugeridas para repetir**; guiones de respaldo; límites de turnos/duración y de cupo.
- **CA:** 1) el ciclo completo sin tocar pantalla en modo manos libres; 2) cortes de red no pierden la transcripción; 3) informe final correcto; 4) respeta lista blanca.
- **Pruebas:** máquina de estados con mocks.

### 8.5 Alternativas locales (opcional, solo si hace falta)
- **Dep.:** 8.2.
- **Alcance:** evaluar **Moonshine** (STT en navegador, WebGPU/WASM) y el modelo local de fonemas (≈ 355 MB cuantizado; entrenado mayormente con voz de adultos nativos: acentos fuertes/ruido degradan el feedback) **solo si Azure no es viable**; medir tamaño, tiempo y calidad en el teléfono real de William; documentar recomendación.
- **CA:** informe con mediciones en el dispositivo real; decisión del Administrador.
- **Pruebas:** manuales en el teléfono.

### 8.6 Exportar grabaciones para verificación humana
- **Dep.:** 8.3.
- **Alcance:** opción **desactivada por defecto** "guardar las últimas N grabaciones" (solo local); botón para exportarlas y compartirlas con un hablante nativo (cada 4–6 semanas, p. ej., por intercambio de idiomas); recordatorio suave.
- **CA:** 1) nada se guarda si la opción está apagada; 2) borrar todas; 3) exportación funcional en Android.
- **Pruebas:** manual.

> **HITO M7.**

---

# PARTE 9 — CIERRE Y ENDURECIMIENTO

### 9.1 Recordatorios (honestos con las limitaciones de la PWA)
- **Dep.:** 3.4.
- **Alcance:** **investigar y documentar** qué es realmente confiable en una PWA en Android (Notification Triggers, Periodic Background Sync, Web Push: normalmente poco confiables sin servidor); implementar solo lo confiable (recordatorio suave al abrir; opción de "crear alarma" desde el chat del teléfono con las herramientas de alarma/calendario del Administrador); nada de culpa ni insistencia.
- **CA:** informe de viabilidad verificado + implementación mínima segura.
- **Pruebas:** manuales.

### 9.2 Ajustes completos y pulido de UX
- **Dep.:** todo lo previo relevante.
- **Alcance:** todas las opciones del 0.8 ya conectadas a su función real; estados vacíos, carga y error en todas las pantallas; textos revisados (cálidos, sin culpa); microinteracciones; háptica opcional.
- **CA:** recorrido completo de cada pantalla con lista de verificación; auditoría de cadenas.
- **Pruebas:** guion completo.

### 9.3 Respaldo y restauración robustos
- **Dep.:** 1.12.
- **Alcance:** respaldo automático local rotativo (últimos 3) + recordatorio suave de exportar; restauración con vista previa; **prueba de restauración en dispositivo limpio**; manejo de que Chrome puede borrar datos del sitio.
- **CA:** restaurar = estado idéntico (prueba de igualdad profunda); versiones antiguas migran.
- **Pruebas:** round-trip con datos de 10.000 eventos.

### 9.4 Rendimiento y contenido masivo
- **Dep.:** P4–P8 según avance.
- **Alcance:** carga perezosa de paquetes, índices, virtualización de listas largas, medición con datos sintéticos (20.000 ítems, 200.000 eventos), presupuesto de rendimiento documentado, tamaño de caché y de audio bajo control.
- **CA:** ninguna pantalla congela > 200 ms con el volumen objetivo; arranque en frío < 3 s en gama media (medido o estimado y declarado).
- **Pruebas:** benchmarks.

### 9.5 Accesibilidad e internacionalización de cadenas
- **Dep.:** 9.2.
- **Alcance:** lector de pantalla, tamaño de fuente, contraste, objetivos táctiles, reducción de movimiento; **todas las cadenas de UI en un único módulo** (`app/strings.es.js`) para facilitar cambios.
- **CA:** auditoría manual + lista de verificación; cero cadenas sueltas (`audit`).
- **Pruebas:** audit de cadenas.

### 9.6 Auditoría de seguridad y privacidad
- **Dep.:** 9.2.
- **Alcance:** revisar CSP, XSS (todo `innerHTML`), manejo de claves, contenido de IA no confiable, importación hostil, permisos de micrófono, dependencias vendorizadas con licencia, ausencia de telemetría; informe con hallazgos y correcciones.
- **CA:** cero hallazgos críticos/altos abiertos.
- **Pruebas:** casos hostiles automatizados.

### 9.7 Regresión total y recorrido de extremo a extremo
- **Dep.:** 9.1–9.6.
- **Alcance:** suite completa, simulación de **60 días de uso** con datos sintéticos verificando invariantes (SRS coherente, dominio explicable, sin duplicados, sin pérdida), guion manual completo para William (todas las pantallas), revisión de `docs/*`.
- **CA:** todo verde; lista de pendientes de William cerrada o documentada.

### 9.8 Documentación final y empaquetado
- **Dep.:** 9.7.
- **Alcance:** `README`, `DEPLOY`, guías de audio/Azure, manual de usuario corto, **guía de mantenimiento** (regenerar audio, actualizar versión, respaldo; para agregar paquetes **enlaza a `docs/ADD_PACK.md`**, que ya existe desde 1.3, y la revisa para que siga vigente), y **evaluación opcional de empaquetado APK con Capacitor** (solo si algo lo exige; verificar entonces las reglas vigentes de verificación de desarrollador de Android).
- **CA:** William puede, solo con la documentación, instalar, actualizar, respaldar y agregar contenido (verificando que `docs/ADD_PACK.md` sigue funcionando con la versión final).

> **HITO M8 = versión 1.0.**

---

# PISTA C — PRODUCCIÓN DE CONTENIDO (chats de contenido, dentro de la SECUENCIA MAESTRA)

> Cada entrega de contenido **debe pasar `tools/validate-content.mjs`** (1.3 completado). **Mientras 1.3 no esté hecha, no se produce contenido final.** Los lotes C van **dentro de la SECUENCIA MAESTRA (sección 10)**, en cadena con el resto de chats: nunca en paralelo, así no hay choques de archivos. **El chat de contenido instala el contenido él mismo** con `npm run add-pack`, así que William no necesita Node ni tocar JSON: recibe el zip completo del repositorio, como en cualquier otra entrega.

### Cómo trabaja un chat de contenido (autónomo)
1. **Recibe** (lo pega William): este roadmap, el último zip del repositorio y el prompt 14.B con el lote asignado.
2. **Lee primero:** las reglas de calidad de abajo, 7.10 (perfil de William), contratos 8.2, 8.3, 8.9, 8.10 (y 8.11/8.12 si el lote es de vocabulario o historias), `content/taxonomy/topics.json`, `content/index.json`, el catálogo de errores y la sección **"Contenido"** de `PROJECT_STATE.md` (qué tanda toca).
3. **Tamaño de tanda:** máximo ≈ 8 temas y ≈ 120 ítems por chat (calidad antes que cantidad). Un lote puede necesitar varias tandas (C3, C4, C5, C6, C7, C8, C11… casi seguro). La sección "Contenido" de `PROJECT_STATE.md` es una tabla `lote | tanda | temas hechos | ítems | estado`; un lote pasa a `COMPLETO` solo cuando cubre todo su alcance de la tabla de lotes y cada tema cumple las reglas. Mientras no esté `COMPLETO`, el siguiente paso sigue siendo el mismo lote ("tanda k+1").
4. **Flujo obligatorio:** borrador → **segunda pasada de revisión cruzada** (regla 2) → `node tools/validate-content.mjs` → `npm run add-pack` (lo ejecuta el chat) → `npm run build` y suite completa → subir **PATCH** en `core/version.js` y `package.json` (así la PWA avisa de la actualización).
5. **Si el entorno no puede ejecutar `node`:** no entregues el contenido como definitivo. Entrégalo como borrador marcado **NO VALIDADO**, díselo a William en lenguaje simple y no marques la tanda como hecha.
6. **Solo toca:** `content/`, `PROJECT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md`, la versión y lo que genera `npm run build`. **No toca código de la app.** Excepción: si una prueba existente verifica directamente el contenido que tu lote reemplaza o amplía (p. ej. "topics.json es la semilla de 18 temas"), **actualízala tú** para que verifique el contenido nuevo con la misma intención (sin debilitarla), y regístralo en `DECISIONS.md`; nunca toques pruebas de código ni de otros lotes. Si el contrato de contenido no alcanza para algo, emite un PROMPT PARA ADMIN (3.4).
7. **Convenciones:** `pack_id` en minúsculas con guion bajo, `<lote>_<tema>_v1` (ej. `c3_present_perfect_v1`); IDs de ítem estables; zip `sophia-ingles_<lote>-t<k>_v<x.y.z>.zip`.
8. **Entrega:** zip completo del repositorio + **informe de calidad** (≤ 1 pantalla: temas, ítems por tipo, errores cubiertos con su `code`, resultado del validador, dudas de naturalidad que quedaron) + bitácora de relevo (12.1) + bloque "QUÉ HACES TÚ AHORA" (casi siempre variante A: el contenido nuevo se verá en el próximo hito).

### Reglas de calidad de contenido (obligatorias)
1. **Original:** nada copiado de películas, series, canciones, libros, apps, cursos de pago ni sitios con derechos. Sin excepciones, sin "casi copiado". Diálogos y situaciones inventados.
2. **Inglés americano natural**, vigente (no libresco). Registro adecuado al nivel. Sin errores: tras generar, **segunda pasada de revisión cruzada** (releer cada ítem buscando: respuesta ambigua, varias correctas no listadas en `accept`, distractor que en realidad es correcto, ortografía, concordancia, naturalidad).
3. **Cada tema ≥ 12 ítems de ≥ 3 tipos distintos**; mezclar reconocimiento y producción; **explicación breve en español** y, si aplica, nota de gramática y de matiz.
4. **Distractores = errores reales de hispanohablantes** y de William (7.10), con `code`.
5. **Sin pistas de contexto** en los ítems de examen de vocabulario (formato limpio, con opción "No sé").
6. **90–95 %** en historias/lecturas respecto del currículo previo del nivel (`tools/check-story-levels.mjs`).
7. `source: "original"`; `version` incrementable; IDs estables.
8. Orden de producción: **primero lo diagnosticado como hueco**.

### Orden y lotes de contenido
| ID | Lote | Contenido |
|---|---|---|
| C1 | Catálogo de errores | `error_codes.json` completo (45+ códigos) con microexplicaciones. |
| C2 | Taxonomía de temas | `topics.json` con **150–250 temas de gramática** (agrupados desde las ~1.200 estructuras del English Grammar Profile como etiquetas internas), prerrequisitos sugeridos, prioridad. |
| C3 | **Gramática prioridad 1** (huecos de alto impacto) | Tiempos perfectos (forma, present perfect vs past simple, for/since, been/gone); irregulares y pasado (incl. didn't + base); **`can/could/be able to` + base (error `can to`)**; gerundio vs infinitivo; preposiciones dependientes; preguntas directas e indirectas; doble negación; sujeto obligatorio (it/there). |
| C4 | Gramática prioridad 2 | Conectores de contraste; futuros (will/going to/present continuous); adjetivos/adverbios y orden; contables/incontables; causativas (`make me work`); tercera persona -s; artículos. |
| C5 | Gramática de huecos confirmados | Voz pasiva; who/whom/whose; tag questions; unless; so/such; wish/would rather; condicionales 0-3 y mixtos; modales de deducción y perfectos; estilo indirecto; `have something done`; inversión; subjuntivo; as if; remember/forget/stop; future continuous/perfect. |
| C6 | Vocabulario esencial 1K | Familias cotidianas (cuerpo, casa, comida, ropa, ciudad, clima, familia, números/días, profesiones, universidad, tecnología) **empezando desde lo más básico** (hay fallos reales en 1K). Verificar licencia antes de usar Wiktionary. **Añade a `topics.json` sus familias `vocab.<familia>`** (y actualiza la prueba de taxonomía que lo verifique). |
| C7 | Vocabulario 2K–3K + profundidad | Colocaciones, phrasal verbs (por frecuencia), formación de palabras, falsos amigos, registro. |
| C8 | Frases y diálogos | Diálogos originales A/B para `phrase_cloze` (situaciones: pareja, trabajo, viaje, universidad…), con nota de gramática/matiz. **No usar Tatoeba hasta verificar su licencia y atribución.** |
| C9 | Verbos | Lista de irregulares por frecuencia y por patrón; verbos con patrón gerundio/infinitivo; modales; reglas de -ed. |
| C10 | Lemas | `lemmas.json` (≥ 3.000 palabras más frecuentes) para 1.11. |
| C11 | Historias | Lotes de historias originales por nivel (30 A1–A2 + 20 B1 primer lote), con segmentos, traducción, vocabulario/gramática objetivo, preguntas y pares de audio. |
| C12 | Escucha y pronunciación | Dictados, cloze auditivo, pares mínimos, frases de habla conectada, listas de sonidos prioritarios (7.11) con pistas en español. |
| C13 | Escritura/mediación/roleplay | Consignas por nivel, rúbricas, escenarios de roleplay, guiones de respaldo sin IA, temas semanales. |
| C14 | Gramática restante (temas con `lote: sin_lote` en `topics.json`) | Los temas de la taxonomía que no caen en C3–C5: básicos A1–B1 y varios B1–B2. Orden: primero B1–B2 y los temas que otros temas tienen como prerrequisito; los A1–A2 al final (el test de nivelación de 3.8 suele marcarlos como dominados). Tandas de ≈ 8 temas. |

---

# 10. SECUENCIA MAESTRA (orden fijo; avanza sola, sin intervención del Administrador)

Esta es la **única lista de qué va después de qué**. Al cerrar, cada chat lee aquí su siguiente paso y lo escribe en la bitácora (12.1) y en el bloque "QUÉ HACES TÚ AHORA" (5.2). **S** = subparte (chat constructor, prompt 14). **C** = lote de contenido (chat de contenido, prompt 14.B). Un lote C no termina hasta que `PROJECT_STATE.md` lo marque `COMPLETO` (puede llevar varias tandas).

| Orden | Pasos | Marca al terminar |
|---|---|---|
| 0* | S 0.9 (mapa del repositorio, 3 tramos) — **se intercala en cuanto este roadmap esté adjunto, antes de continuar la subparte en curso**. *Estado a 23 oct 2026: **0.9 pendiente y es el siguiente paso**. El zip 1.7-T2 se construyó con el roadmap 1.7 y no tiene `docs/REPO_MAP.md`, `tools/repo-map.mjs`, `npm run map` ni comentarios `@purpose` (comprobado). Los chats hacen la 0.9 como desvío (3 tramos: 0.9-T1 → T2 → T3; un chat puede hacer dos tramos contiguos, así que son 2 chats) y al cerrar 0.9-T3 retoman **1.7-T3**.* | — |
| 1 | S 0.1 → 0.8 | **HITO M0** (publicar: primera vez, `DEPLOY.md`) |
| 2 | S 1.1 → 1.2 → 1.3 | — |
| 3 | C1 → C2 → C10 | — |
| 4 | S 1.4 → 1.5 → … → 1.12 | HITO M0.5 (no se publica) |
| 5 | S 2.1 → 2.2 → … → 2.9 | **HITO M1** (publicar y probar) |
| 5b | S 2.10 (rediseño de los temas Neo y Claro, 2 tramos; William aporta el proyecto de referencia al empezar) | se prueba en el siguiente hito |
| 6 | C3 → C9 → C8 | — |
| 7 | S 3.1 → … → 3.8 | **HITO M2** |
| 8 | C6 → C4 | — |
| 9 | S 4.1 → … → 4.7 | **HITO M3** |
| 10 | C5 → C7 → C13 | — |
| 11 | S 5.1 → … → 5.10 | **HITO M4** |
| 12 | C11 | — |
| 13 | S 6.1 → … → 6.6 | **HITO M5** |
| 14 | C12 | — |
| 15 | S 7.1 → … → 7.6 | **HITO M6** |
| 16 | S 8.1 → … → 8.6 | **HITO M7** |
| 17 | S 9.1 → … → 9.8 | **HITO M8 = versión 1.0** |
| 18 | C14 (tandas hasta cubrir todos los temas `sin_lote`; no es requisito de la v1.0) | se publica en el siguiente hito o al terminar cada tanda grande, a petición de William |

**Reglas de la secuencia**
1. **Cadena lineal:** un solo chat a la vez, cada uno recibe el último zip completo y entrega otro. No hay paralelismo salvo que William lo pida expresamente (entonces lo ordena el Administrador y actualiza esta sección).
2. **Las dependencias mandan:** si un paso tiene una dependencia que no está `HECHA`, el chat avisa y hace primero la dependencia.
3. **Publicar solo en los HITOS marcados** (5.H). Los lotes C se verán en la app en el siguiente hito.
4. **Después del M8**, el contenido sigue creciendo con las tandas de C14 y con nuevas tandas de cualquier lote C cuando William lo pida (14.B).
5. **Cada subparte S se construye por tramos (sección 17)**: el paso siguiente se escribe `<subparte>-T<n>`; los lotes C siguen en tandas (Pista C).
6. Esta tabla solo la cambia el Administrador, con versión nueva del roadmap y anotación en la sección 16.

---

# 11. PRUEBAS MANUALES DE WILLIAM — PLANTILLA

Cada `tests/scenarios/<id>.md` usa este formato:
```
PRUEBA <id> — <nombre> — versión x.y.z — tiempo estimado: N min
Preparación: <qué abrir>
1. Haz <acción>. Debes ver: <resultado>.
2. ...
Si algo no coincide: describe qué viste y pega esto al chat: <qué copiar, p. ej. "Ajustes > Acerca de > Copiar detalle">.
```

---

# 12. PLANTILLAS

### 12.1 Bitácora de relevo (la entrega al final de cada chat constructor; en texto plano)
```
BITÁCORA DE RELEVO — <fecha>
Subparte completada: <id nombre> v<x.y.z> (zip: <nombre>)
Subpartes HECHAS hasta ahora: <lista>
Versión del roadmap usada: <x.y>
Siguiente paso (SECUENCIA MAESTRA, sección 10): <subparte>-T<n> (sección 17) o lote C con su tanda — tipo: constructor | contenido
Mapa del repo: tree-hash <12 primeros caracteres> — al día (verificado con `npm run map -- --check`)
Delta del tramo (copia de la sección "Delta" de docs/REPO_MAP.md; ≤ 25 líneas, una por archivo: creado/modificado/eliminado y por qué):
Convenciones o trampas nuevas (también añadidas al mapa; una línea por trampa con su ID, síntoma y alternativa, formato de 4.T; si ninguna: "ninguna"):
Trampas previas: <IDs que apliqué y me evitaron un error> · <IDs en las que caí aun estando escritas y por qué, o "ninguna"> · <IDs que corregí o marqué obsoletas>
Qué se hizo (resumen técnico en 5-10 líneas):
Decisiones tomadas (ver DECISIONS.md): 
Contratos modificados (si hubo, con aprobación del Administrador): 
Bugs conocidos que quedan: 
Pendiente de verificación por William: 
Preguntas abiertas para el Administrador: 
Instrucción para el próximo chat: "Aplica la lectura dirigida y el arranque rápido de la sección 0: confía en docs/REPO_MAP.md y PROJECT_STATE.md sin explorar el repositorio, comprueba con npm run map -- --check y ejecuta <siguiente paso>."
```
**Regla de traspaso (v1.9):** el «Delta» y el mapa dicen, por archivo, qué se **cambió** y qué se **dejó sin cambios a propósito**; el chat siguiente lee solo el mapa y `PROJECT_STATE.md`, no recorre carpetas.

**Las trampas nunca se recortan para ahorrar espacio:** la bitácora puede pasarse de líneas por ellas. Si el resto no cabe, se acorta lo demás.

**La bitácora es corta (≤ 60 líneas) y no repite lo que ya está en el mapa, `PROJECT_STATE.md`, `DECISIONS.md` o `docs/CONTRACTS.md`: remite a ellos.** El conocimiento detallado del repositorio viaja en el zip (`docs/REPO_MAP.md`), no en el chat.

### 12.2 Registro de decisión (`DECISIONS.md`)
`AAAA-MM-DD · <subparte> · DECISIÓN: … · RAZÓN: … · ALTERNATIVA DESCARTADA: … · ¿Afecta contratos? sí/no`

### 12.3 `CHANGELOG.md`
`## v<x.y.z> — <fecha> — <subparte>` con secciones `ADD`, `CHANGE`, `FIX`, `REMOVE`.

### 12.4 Reporte de bug (para William → chat)
```
BUG
Dónde: <pantalla/pestaña>
Qué hice: <pasos>
Qué esperaba:
Qué pasó:
Versión (Ajustes > Acerca de):
Detalle copiado de la app: <pega aquí>
```

---

# 13. CHECKLIST FINAL DE CADA ENTREGA (copiar/pegar y marcar)

```
[ ] Leí el ROADMAP completo y PROJECT_STATE.md
[ ] Construí SOLO mi subparte
[ ] Todos los CA cumplidos (lista numerada con evidencia)
[ ] node --check + JSON.parse en todos los archivos
[ ] tools/audit.mjs → 0 hallazgos
[ ] Suite completa node --test → 100 % verde (pegar resumen)
[ ] Pasada 3 (escenarios) y Pasada 4 (adversarial) ejecutadas y documentadas
[ ] Leí completa la sección «Convenciones y trampas» del mapa y cité al inicio las que afectaban a mi tramo (4.T)
[ ] Toda trampa nueva está en el mapa con ID TRAMPA-nn, en el Delta y en la bitácora; `grep -c "^TRAMPA-" docs/REPO_MAP.md` coincide
[ ] Revisión línea por línea de mis archivos
[ ] Sin claves, sin console.log, sin innerHTML con datos variables, sin TODO sin ID
[ ] Versión subida (core/version.js) y caché del SW regenerada (solo al CERRAR la subparte; los cuartos/mitades no suben versión, salvo los lotes de contenido: PATCH)
[ ] CHANGELOG, DECISIONS, PROJECT_STATE, CONTRACTS actualizados
[ ] docs/ROADMAP.md idéntico al roadmap recibido en este chat (diff vacío)
[ ] docs/REPO_MAP.md actualizado con `npm run map` (sección "Delta" escrita, secciones manuales al día) y `npm run map -- --check` en OK
[ ] Si la subparte tiene pantallas: tests/scenarios/<id>.md con guion para William, añadido a la "Cola de pruebas manuales" (si cierro un hito: también tests/scenarios/HITO_<Mx>.md). Sin pantallas: no hay guion.
[ ] ZIP completo entregado con present_files
[ ] Bloque "QUÉ HACES TÚ AHORA" (variante A o B) como ÚLTIMO elemento del mensaje, con nombres exactos y el prompt de arranque ya rellenado
[ ] Reporte de entrega y Bitácora de relevo COMPLETA escritos en esta entrega (5.1)
[ ] Roturas intencionales dentro del presupuesto de 4.R y sin procesos en segundo plano
```

---

# 14. PROMPT DE ARRANQUE (William lo pega en cada chat nuevo junto con este archivo y el zip)

```
Eres un Chat Constructor del proyecto "Glossa" (app de inglés). Te adjunto el roadmap (ROADMAP_SOPHIA_INGLES.md, versión más reciente) y el último zip del repositorio.
REGLA DE ORO: no gastes recursos investigando. El chat anterior ya investigó y lo dejó en docs/REPO_MAP.md y PROJECT_STATE.md: confía en ellos y empieza a construir.
1) Lectura dirigida del roadmap (sección 0): cabecera (versión), secciones 0, 3, 4, 5, 12, 13 y 14, la sección 17 de tu tramo y el texto completo de tu subparte con las secciones 7 y 8 que cite. No leas el resto.
2) Arranque rápido (sección 0): lee PROJECT_STATE.md y docs/REPO_MAP.md (su parte manual y solo las áreas que tocas) y ejecuta npm run map -- --check. Si dice OK, confía sin explorar; si lista diferencias, mira solo esos archivos. No uses ls -R, find ni leas código por curiosidad. DECISIONS.md y CONTRACTS.md solo con búsqueda por el tema.
3) Confirma en 3 líneas qué tramo te toca y añade una línea «Trampas que afectan a mi tramo: TRAMPA-nn (qué haré distinto)» tras leer completa la sección «Convenciones y trampas» del mapa (4.T). Antes de comandos de procesos, comillas/tildes/heredocs o herramientas del repo, busca con grep si hay una trampa que lo cubra y aplica su alternativa a la primera.
4) Construye SOLO ese tramo y audítalo con el protocolo de la sección 4 (cero bugs, con evidencia ejecutada).
5) Antes de entregar: npm run build, luego npm run map (actualiza el mapa y escribe su sección "Delta"), luego npm run check.
6) Cada trampa nueva que descubras la registras en el mapa en ese momento (TRAMPA-nn · síntoma · USA EN SU LUGAR, formato de 4.T), y la repites en el Delta y en la bitácora. Entrega el zip completo, el reporte (5.2) y la bitácora corta de relevo (12.1), y termina SIEMPRE con el bloque "QUÉ HACES TÚ AHORA" de 5.2.
7) Si tienes cualquier duda de arquitectura o contratos, dame un "PROMPT PARA ADMIN" (3.4) y espera.
Responde siempre en español. Una sola pregunta por mensaje. Empieza confirmando qué leíste.
Tramo asignado: <subparte>-T<n> (por ejemplo 1.7-T1). Lee su alcance en la sección 17 y el texto completo de la subparte.
```

### 14.B Prompt de arranque para un CHAT DE CONTENIDO (cuando el siguiente paso es un lote C)
```
Eres un Chat de Contenido del proyecto "Glossa" (app de inglés). Te adjunto el roadmap (ROADMAP_SOPHIA_INGLES.md, versión más reciente) y el último zip del repositorio.
REGLA DE ORO: no gastes recursos investigando el repositorio; confía en docs/REPO_MAP.md y PROJECT_STATE.md.
1) Lectura dirigida del roadmap (sección 0): cabecera (versión), secciones 0, 3, 4, 5, 12, 13 y 14, la Pista C completa ("Cómo trabaja un chat de contenido" y las reglas de calidad) y los contratos de 8 que cite. No leas las Partes 1 a 9.
2) Lee PROJECT_STATE.md (sección "Contenido") y docs/REPO_MAP.md (parte manual y las áreas content/ y tools/), ejecuta npm run map -- --check y lee completa la sección «Convenciones y trampas» y confirma en 3 líneas qué lote y qué tanda te toca, con una línea «Trampas que afectan a mi tanda: TRAMPA-nn» (4.T).
3) Produce SOLO esa tanda (máximo ≈ 8 temas y ≈ 120 ítems), todo original, con revisión cruzada, y valídala con tools/validate-content.mjs. Instálala tú mismo con npm run add-pack, ejecuta npm run build, luego npm run map y luego la suite completa, y sube la versión PATCH.
4) Si no puedes ejecutar node, no la presentes como definitiva: márcala NO VALIDADA y díselo a William.
5) Registra en el mapa, al descubrirla, cada trampa nueva (formato de 4.T) y repítela en el Delta y en la bitácora. Entrega el zip completo, el informe de calidad (≤ 1 pantalla), la bitácora de relevo (12.1) y termina SIEMPRE con el bloque "QUÉ HACES TÚ AHORA" de 5.2.
6) Si tienes una duda de contratos o de alcance, dame un "PROMPT PARA ADMIN" (3.4) y espera.
Responde siempre en español. Una sola pregunta por mensaje. Empieza confirmando que leíste el roadmap.
Lote asignado: <C#, tanda k de n>.
```

---

# 15. NOTAS FINALES DEL ADMINISTRADOR

1. **Orden de verdad:** si algo de este archivo se contradice, prevalece el orden: sección 2 y 7.3 (reglas y decisiones no negociables) > sección 8 (contratos) > sección 4 (calidad) > subparte específica > resto.
2. **Qué hacer si William cambia de opinión:** el cambio pasa por el Administrador, que actualiza este archivo y sube su versión (cabecera). Los chats constructores no editan este archivo.
3. **Cosas que este roadmap asume y conviene confirmar temprano (las cierra el Administrador con William):** que el entorno de los chats constructores permite ejecutar `node` (si no, la pasada 2 se reemplaza por ejecución mental documentada + pruebas en el navegador de William); si hay navegador headless (si no, más pruebas manuales); y que William puede subir y descargar `.zip`.
4. **Riesgos principales y su mitigación:** (a) bugs sutiles → protocolo de 5 pasadas + contratos + pruebas puras; (b) caché vieja del service worker → versión sincronizada y aviso de actualización; (c) pérdida de datos de IndexedDB → respaldos + `persist()`; (d) contenido con errores de inglés → segunda pasada de revisión + marca "no verificado" para lo generado en vivo + botón "Reportar"; (e) dependencia de servicios gratuitos que cambian → módulos con interfaz de proveedor y modo mecánico de respaldo; (f) derechos de autor → todo original; (g) fatiga de William → plan flexible sin rachas.
5. **Éxito = William estudiando cada día con gusto, sin culpa, viendo cómo suben sus porcentajes de forma honesta.**

6. **Autonomía:** la cadena está pensada para avanzar sin el Administrador: cada chat sabe su siguiente paso por la sección 10 y le deja a William un bloque "QUÉ HACES TÚ AHORA". El Administrador solo interviene ante un PROMPT PARA ADMIN o un cambio de opinión de William.

---

# 16. HISTORIAL DEL ROADMAP (qué cambió en cada versión)

- **1.0** — Versión inicial.
- **1.1** — La guía y el comando de agregar paquetes (`tools/add-pack.mjs`, `docs/ADD_PACK.md`) pasan de 9.8 a la subparte 1.3.
- **1.2** — William publica y prueba por hitos, no por subparte (5.H): cola de pruebas manuales y guion único por hito.
- **1.3** — Todo chat termina con el bloque "QUÉ HACES TÚ AHORA" (5.2), variante A o B.
- **1.4** — Cadena autónoma: SECUENCIA MAESTRA con los lotes de contenido intercalados (sección 10); chats de contenido ("Cómo trabaja un chat de contenido" en la Pista C y prompt 14.B); autonomía (3.A) y hitos sin revisión del Administrador; regla de versión del roadmap (el hash es solo un registro); nombre de la app: Glossa; contenido nuevo en el guion de cada hito.
- **1.5** — Los chats de contenido actualizan las pruebas que verifican directamente los archivos que su lote reemplaza (Pista C, paso 6); nuevo lote **C14** (gramática restante: temas `sin_lote`) y paso 18 de la secuencia, posterior a la v1.0.

- **1.6** — Roturas intencionales con presupuesto y reglas claras (nueva 4.R, `tools/mutate.mjs` compartido, tope de 150 roturas y 10 minutos por entrega, una sola ronda); entregas parciales completas (5.1) con bitácora obligatoria y regenerada; los chats no preguntan a William lo que ya está en el roadmap, deciden las preguntas que no bloquean con valor provisional (3.A), y piden los archivos externos en su primer mensaje; checklist ajustado (versión solo al cerrar subpartes, guion solo si hay pantallas).

- **1.7** — Sección 17 (PLAN DE TRAMOS): cada subparte pendiente (1.7 en adelante) viene dividida en 2 a 5 tramos de tamaño variable, con puntos de acople entre subpartes; un chat = un tramo; el siguiente paso se escribe `<subparte>-T<n>`.

- **1.8** — Arranque sin gastar recursos investigando: nueva subparte **0.9** (mapa del repositorio `docs/REPO_MAP.md` con `tools/repo-map.mjs`, convención `@purpose`, comprobación mecánica `npm run map -- --check`, secciones manuales con "Delta" por tramo, `PROJECT_STATE.md` compacto); lectura dirigida del roadmap (no se lee entero); bitácora corta que remite al mapa; prompts 14 y 14.B con "regla de oro: confía en el mapa"; la entrega ejecuta `build → map → check`.

- **1.9** — Se incorpora al roadmap el contenido de los informes de traspaso de 1.7-T1 y 1.7-T2 (verificado sobre el zip el 2026-10-23): 8.7 gana el bloque «Implementación congelada» (firma, fórmulas, redondeo, confianza, topes, trampa de R); 8.15 alinea la firma `compute`; 7.12 registra la definición de «producción» y la firma resuelta; 4.R.6 deja constancia de que `tools/mutate.mjs` no existe y se asigna a 1.7-T3; la secuencia (10) anota que la 0.9 sigue pendiente (el zip no la tiene) y se hace como desvío antes de 1.7-T3; la entrada 1.8 se mueve de la cola del archivo a esta sección (la regla de la sección 0 manda leer la última entrada de la 16); la sección 17 marca T1 y T2 como HECHOS y deja T3 y T4 con datos ya comprobados (estructura de `topics.json`, ausencia de suscripción en `events`, rendimiento pendiente), decisiones propuestas por defecto y trampas.

- **1.10** — Trampas como memoria obligatoria del proyecto (nueva 4.T): lectura completa y cita al arrancar, búsqueda con `grep` antes de acciones de riesgo, registro inmediato con ID `TRAMPA-nn` y formato fijo, reporte en el Delta y en la bitácora (12.1: líneas «trampas nuevas» y «Trampas previas»), reconocimiento de las trampas en las que se cae aun estando escritas, y dos puntos nuevos en el checklist 13; prompts 14 y 14.B actualizados; 0.9 y 4.4 enlazan con 4.T.

# 17. PLAN DE TRAMOS (cómo se divide cada subparte para que cada chat trabaje sin buscar por dónde empezar)

**Qué es un tramo:** la unidad de trabajo de **un chat**. Cada subparte pendiente (1.7 en adelante) viene ya dividida abajo en 2 a 5 tramos de tamaño parecido, ordenados por dependencia. En las bitácoras antiguas de 1.1–1.6, "cuarto" significa lo mismo que "tramo".

**Reglas de los tramos**
1. **El siguiente paso se escribe como `<subparte>-T<n>`** (ej. `1.7-T2`) en la bitácora, en el prompt (14) y en el zip (`sophia-ingles_<subparte>-T<n>_v<x.y.z>.zip`). La SECUENCIA MAESTRA (sección 10) sigue mandando el orden entre subpartes; esta sección manda el orden dentro de cada una.
2. **Un chat = un tramo.** Si el tramo salió pequeño y el chat tiene margen, puede hacer **el siguiente tramo contiguo de la misma subparte**, entregando cada uno completo (5.1) y nunca más de dos por chat.
3. **Cada tramo se entrega terminado:** código utilizable, pruebas y su ficha breve en `docs/CONTRACTS.md`; nada "a medias". La suite completa debe quedar en verde en cada tramo.
4. **Tramos intermedios:** pasadas 1, 2, 4 y 5 de 4.3 sobre sus archivos, roturas (4.R) si hay lógica de decisión, **sin subir versión**. **Último tramo de la subparte:** verifica **todos los CA de la subparte con evidencia**, ejecuta las 5 pasadas sobre el conjunto, escribe el guion `tests/scenarios/<id>.md` si hay pantallas, **sube la versión MINOR**, `npm run build`, y si cierra un hito, el guion del hito.
5. **Frontera ajustable:** si un tramo resulta demasiado grande o pequeño, el chat puede mover la frontera con el vecino, anotándolo en `DECISIONS.md` y en la tabla de tramos de `PROJECT_STATE.md` (columnas `subparte | tramo | estado`), sin pedir permiso. El alcance obligatorio sigue siendo el de la subparte y sus CA.
6. **Los tramos son guía de alcance, no reemplazan** el texto de la subparte (secciones de las Partes 1 a 9): léelo siempre completo antes de empezar.

**Puntos de acople entre subpartes (revísalos al empezar un tramo que los toque)**
- **Cableado de servicios** (`events`, `srs`, `errors`, `mastery`, `session`) en `app/services.js`: lo hace **2.1-T1**; `services.db` puede ser `null`.
- **Contenido en la app:** `importPacksToDb` al arrancar y **precache de `content/index.json` y de los paquetes en `sw.js`** (ampliando `tools/build-manifest.mjs`): **2.9-T3**.
- **Señal E del dominio:** usa `errors.recurrent({ by: 'code', topic })` (decisión del Administrador, 1.6).
- **Señal U del dominio:** 5.10 la conecta pasando `u(topicId, now) → 0..1 | null` a `createMastery`; hasta entonces U es `null` y la confianza «Alta» no existe (8.7).
- **`tools/mutate.mjs`:** lo crea 1.7-T3; desde entonces todos los chats lo reutilizan (4.R.6).
- **Tarjetas de ortografía y de traducir palabra:** pasan `almostAtWordEnd: true` a `compare` (2.5, 4.7). Las respuestas con `'s`/`'d` listan en `accept` las dos formas (regla del contenido).
- **`content/taxonomy/lemmas.json`** ya existe (C10): 1.11 usa el real, no una semilla.
- **`content/taxonomy/weekly_themes.json`** no está en ningún lote C: lo crea **3.5-T1** (≥ 12 temas, formato validado).
- **Extensión del armador de sesiones** para la progresión reconocimiento → producción (4.2-T3): **autorizada**; se anota en `CONTRACTS.md`, no requiere consultar al Administrador.
- **Lo que depende de audio** (6.3, 4.7 `spell_from_audio`, 7.x): mientras no haya archivos, usa TTS del navegador; el reproductor real llega en 7.2.
- **Cada función con IA** (Parte 5) tiene modo mecánico de respaldo y se muestra escapada y marcada "no verificado".
- **Ajustes** de 0.8: cada opción se conecta a su función real en la subparte que la crea; 9.2 verifica que no quede ninguna sin conectar.
- **Decisiones del Administrador (1.11), válidas para todos los chats:**
  - **Agregación de dominio (1.7):** la confianza **no pondera** el promedio por nivel o área; se muestra aparte (símbolo "poca evidencia"). Se revisa en M2 con datos reales.
  - **Foto diaria de dominio:** una por día local, guardada en `meta` con la clave `mastery_snap:<AAAA-MM-DD>` (solo temas con evidencia, 400 días como máximo, idempotente). La crea **2.1-T2** (`core/masterySnapshot.js`) y la leen `masteryTrend`, 2.8 y 3.6.
  - **Ítems `practice` y `error` no vencidos** son **repasos adelantados**: pasan por `srs.review` normal (FSRS los soporta); un acierto adelantado no alarga más de lo normal y un fallo reinicia.
  - **Ventanas:** toda consulta de actividad o errores de la interfaz usa una **ventana de 14 a 30 días**; no se añaden índices ni resúmenes por día (los costes con 50.000 eventos se miden en 9.4).
  - **Valores provisionales** (`grading.config.js`, umbral de pausa del cronómetro, XP y rangos, topes diarios de nuevas): se quedan como están hasta M1 y M2; nadie los toca salvo el tramo que lo diga.
  - **Enumerados confirmados:** `Topic.status` ∈ `draft | active | deprecated`; `LexEntry.pos` (12 valores), `band` ∈ `1K…20K | OFF`, el `id` de una palabra empieza por su `family`, las preguntas de una historia son solo de lectura o escucha, los tipos que se escriben exigen `accept`; distractores con `code` **obligatorio** en gramática, preposiciones y ortografía y **opcional** en vocabulario.
  - **Bandas de `lemmas.json`:** son **aproximadas** (no hay corpus con licencia); no se verifican contra uno. Se anotan como tales y se corrigen por uso real.
  - **`retentionReport`:** una tarjeta reaprendida tras un fallo cuenta como repaso; los eventos **no** guardan el estado de la tarjeta (8.6 no cambia). Se muestra como "estimada".
  - **Audio (`dictation` y afines):** escribir = `dictation`, `cloze_audio`, `spell_from_audio`, `what_did_they_say`; elegir = `minimal_pair_listen`, `connected_speech`, `listen_comprehension`, `follow_instruction`; `extensive_listening` no pide respuesta. Por defecto `speed: 1.0` (lento 0.8), `max_plays: 3`, `show_transcript: false` hasta responder.

---

## Parte 0 (intercalada)

### 0.9 Mapa del repositorio y arranque rápido (3 tramos)
- **0.9-T1 · Herramienta:** `tools/repo-map.mjs` con `npm run map` y `--check` (tree-hash, deriva), parser de exports (todas las formas), secciones automáticas y marcadores manuales, `tools/repo-map.config.json`; pruebas (determinismo, deriva, rutas raras).
- **0.9-T2 · Convención `@purpose`:** añadir el comentario `@purpose` a todos los archivos de código existentes (cambio solo de comentarios; la suite no debe cambiar), regla en `audit.mjs`, verificación de que ningún comportamiento cambió (suite igual antes y después).
- **0.9-T3 · Primer mapa completo y cierre:** la **única investigación completa del repositorio**: generar el mapa, escribir las secciones manuales (*Cómo encaja todo*, *Servicios cableados y pendientes*, *Convenciones y trampas* recogidas de `PROJECT_STATE.md`, `DECISIONS.md` y las bitácoras, *Comandos*, *Delta*), compactar `PROJECT_STATE.md` (≤ 250 líneas), integrar `--check` en `check-structure`, 10 preguntas de control respondidas solo con el mapa, CA 1–7; retoma después la subparte en curso. **Traspaso de 1.7 (v1.9):** al escribir el mapa, vuelca en sus secciones manuales y en `PROJECT_STATE.md` el estado de la 1.7 que hoy vive en 8.7 («Implementación congelada») y en el bloque 1.7 de esta sección 17 (archivos y exports de `core/mastery*.js`, contratos de señales, los 7 datos ya verificados de T3), para que el chat de 1.7-T3 arranque solo con el mapa.

## Parte 1 (restante)

### 1.7 Motor de dominio por tema (4 tramos)
**Estado a 2026-10-23 (verificado en el zip `sophia-ingles_1.7-T2_v0.14.0.zip`, descomprimido en limpio):** T1 y T2 HECHOS sin subir versión (0.14.0); suite completa 1661 pruebas (1660 pasan, 0 fallan, 1 omitida a propósito); `mastery.test.mjs` y `masterySignals.test.mjs` 53/53 también con `TZ=Pacific/Auckland`. Según los informes: `audit` 0 hallazgos (257 archivos), `check-structure` OK, build `sophia-shell-0.14.0-2526f602`. **Siguiente: la 0.9 como desvío (sección 10, fila 0*) y, al cerrarla, 1.7-T3.** Los informes de T1 y T2 se escribieron con el roadmap 1.7: su «Instrucción para el próximo chat» queda sustituida por la regla de la sección 0 y por la nota anterior; su bitácora no trae «Mapa del repo» ni «Delta» porque entonces no existían.

- **1.7-T1 · Núcleo de señales — HECHO (2026-10-23).** `core/mastery.config.js` (exporta `WEIGHTS`, `BANDS`, `CONFIDENCE`, `DROPS`, `SIGNAL_R`, `SIGNAL_P`, `SIGNAL_E`, `MS_PER_DAY`, `MASTERY_CONFIG`; todo congelado) y `core/masterySignals.js` (`signalR`, `signalP`, `signalE`, `isProduction`; puras). Sin U. 23 pruebas. Roturas: 51 probadas, 50 detectadas, 1 equivalente (la guarda `typeof exerciseType !== 'string'` de `isProduction`, porque `typeInfo` ya devuelve `null`).
  - Contratos: `signalR(cards, now, { retrievability, config? })` → `{ value, cards, ignored }`; `signalP(events, topicId, now, { config? })` → `{ value, attempts, ignored }`; `signalE(rows, { config? })` → `{ value, codes: [{ code, inWindow, contribution }] }`; `isProduction(exerciseType, config?)` → booleano. `null` = «sin evidencia» en R y P; E vale 0 sin reincidencia. Las entradas incorrectas lanzan `Error` en español; los elementos ilegibles dentro de las listas se ignoran y se cuentan en `ignored` (T4 puede usarlo para decir cuánta evidencia se descartó).
- **1.7-T2 · Combinación y bandas — HECHO (2026-10-23).** `core/mastery.js` (`createMastery`, `bandOf`, `bandIndex`, `combine`, `confidenceOf`, `masteryToSophiaVal`) y `tests/mastery.test.mjs` (30 pruebas). CA 1–5. Roturas: 69 probadas, 63 detectadas (91 %), 6 equivalentes (explicadas en `DECISIONS.md`). Reglas y forma del resultado: ver 8.7 («Implementación congelada»). `U` entra por el parámetro opcional `u`; mientras no se pase, es `null`.
- **1.7-T3 · Agregación y consultas — SIGUIENTE (después del desvío 0.9).** Por nivel y por área (media ponderada por ítems), `atRisk`, `toStudy`, caché invalidada por eventos, y **crea `tools/mutate.mjs`** (≤ 150 líneas, con su prueba; regla 4.R.6; anótalo en `PROJECT_STATE.md`).
  - **Datos ya verificados (no los vuelvas a investigar):**
    1. Nivel y área son **campos del propio tema** en `content/taxonomy/topics.json` (`{ schema, topics: [...] }`, 248 temas): `area` ∈ `gram` 190, `prep` 13, `phr` 11, `pron` 11, `verb` 8, `spell` 8, `vocab` 7; `level` ∈ `A1` 36, `A2` 83, `B1` 94, `B2` 33, `C1` 2. Otros campos: `id`, `title_es`, `title_en`, `prereq`, `priority`, `diagnosed_gap`, `min_items`, `tags`, `status`. **Hoy los 248 están en `status: 'draft'`**: no filtres solo por `active` o el resultado quedará vacío.
    2. `core/contentTaxonomy.js` exporta `validateTopics`, `topicInfo` (solo devuelve `{ status, min_items }`, **no** `area` ni `level`) y `topicIdSet`; `core/contentTopic.js` exporta `validateTopic`, `checkTopic`, `TOPIC_ID_RE` y `TOPIC_STATUSES` (`active | draft | deprecated`). Por tanto las funciones de T3 deben recibir la lista de temas como dato (puras, sin leer archivos), y quien las llame la carga de `topics.json`.
    3. `content/packs/` está **vacía**: no hay ítems instalados, así que «cantidad de ítems» no se puede contar de la base; inyéctala como dato por tema.
    4. `core/events.js` **no tiene suscripción ni notificación** (revisado: ni `subscribe`, ni `listener`, ni `emit`, ni `notify`). La invalidación de la caché la tiene que diseñar T3.
    5. `events.byTopic(topicId, opts)` sin `limit` devuelve **todos** los eventos del tema (el contrato lo dice: «por defecto sin tope»); ya vienen ordenados por `ts` y luego `id`. No hace falta reordenar.
    6. `srs.simple.retrievability` = `0,9^(días/stability)` (0,9 justo al cumplirse el intervalo; tarjeta nueva → 0), es decir, el mismo caso conocido que FSRS.
    7. Lectura de datos del tema: tarjetas con `db.query('cards', { index: 'topics', value: topicId })`; `STORES.cards` y `STORES.events` tienen índice multi `topics`. Un evento con varios `topics` cuenta en cada uno.
  - **Decisiones que tomas tú (con valor por defecto para no quedarte parado; anótalas en `DECISIONS.md` y en la ficha 1.7-T3 de `CONTRACTS.md`):**
    1. *Peso de la media:* `itemCount` inyectado por tema; si no viene, `min_items` del tema. Un tema con peso 0 no pesa.
    2. *Temas «Sin ver»:* entran con 0 % en la media del nivel o del área (la media mide cuánto del nivel se domina). Devuelve además cuántos temas hay y cuántos se han visto, para que 3.1 muestre ambos números. Es la decisión que más cambia lo que William ve en el mapa.
    3. *`atRisk(topics)`:* tema con respuestas y (retención `signals.R` bajo un umbral, o errores recurrentes `signals.E > 0`, o algún tope activo en `caps`). Umbral nuevo en `mastery.config.js` (propuesta: `AT_RISK = { retention: 0.7 }`; **cifra de diseño, no de una fuente**).
    4. *`toStudy(topics)`:* el roadmap no define el criterio. Defecto: temas «Sin ver» o en banda baja, ordenados por `priority` del tema y luego por dominio ascendente; 3.1 ofrece el filtro «A estudiar».
    5. *Caché:* la clave debe incluir lo que cambia el resultado. Ojo: **R depende de `now`** (decae con el tiempo) y las tarjetas cambian al repasar o suspender; no basta con mirar los eventos. Opciones: firma por tema (número de eventos `answer`, último `ts`, número de tarjetas y último `due`) más el día local de `now`; o `invalidate(topicId)` explícito que llama quien registra el evento. Elige una y pruébala con un evento nuevo que cambie el resultado. La caché también servirá para el CA 6 de T4.
  - **Pruebas:** agregaciones con pesos conocidos; caché (acierto, y fallo tras un evento nuevo); `atRisk` y `toStudy` con casos construidos; vacíos (nivel sin temas → estructura vacía, sin `NaN`). Roturas (4.R) sobre las funciones públicas nuevas (≈ 40 por función, ≈ 150 en total, ≤ 10 min).
  - **Cierre del tramo:** registrar los archivos nuevos en `tools/check-structure.mjs` (lista larga, junto a `'core/mastery.js'`), ficha 1.7-T3 en `docs/CONTRACTS.md`, `CHANGELOG.md`, `DECISIONS.md`, tabla de tramos de `PROJECT_STATE.md`, suite completa, `audit`, `check-structure`, `npm run build`, `npm run map` (ya existirá tras la 0.9). **Sin subir versión.**
- **1.7-T4 · Explicabilidad y cierre — PENDIENTE.** Desglose textual en español (para mostrar al tocar el porcentaje) construido sobre `signals`, `detail`, `caps` y `evidence` del resultado de `compute`; escenarios (estudiante nuevo, estudiante que falla, vuelve tras 3 semanas); rendimiento (100 temas × 5.000 eventos < 300 ms, CA 6); cierre de la subparte.
  - **Trampas ya conocidas:** (a) el desglose debe poder decir por qué un tema sin U nunca llega a confianza «Alta» (U aún no existe: llega con 5.10); (b) en «estudiante que falla», R seguirá alta justo después de repasar (ver 8.7, trampa conocida): asegura que P y los topes reflejan el fallo, y que el texto no diga «retención 95 %» como si fuera buena señal; (c) **rendimiento sin medir**: `compute` hace tres lecturas por tema (tarjetas por índice, `events.byTopic` completo, `errors.recurrent`) y de la 1.1 consta que, con 50.000 eventos, recorrer todo el historial en memoria ya tardó 237–616 ms en otra consulta (cuarto 3 de la 1.1, pregunta abierta de costes): **mide pronto** y, si no cumple, usa la caché de T3 y evita releer los mismos datos varias veces; (d) los eventos con `ignored` (ilegibles) pueden mencionarse en el desglose.
  - **Cierre de subparte (regla 17.4):** verifica **todos los CA (1–6)** con evidencia, 5 pasadas sobre el conjunto, **sube la versión MINOR a 0.15.0** (siguiente a 0.14.0), `npm run build`. Sin pantallas: sin guion manual (mismo criterio que la 1.6).
- **Quién consume el dominio después:** 1.8 (progresión reconocimiento → producción según dominio), 1.9 (estadísticas), 1.11 (lista blanca), 3.1 (mapa: % siempre junto a la confianza), 5.10 (conecta la señal U por el parámetro `u` de `createMastery`).

### 1.8 Armador de sesiones (5 tramos)
- **1.8-T1 · Candidatos y orden base:** `SessionPlan`, vencidos primero con modo rescate, exclusión de suspendidas/sanguijuelas/deprecated, plan vacío con razón. RNG semillado.
- **1.8-T2 · Nuevas, cupos y energía:** tarjetas nuevas con tope diario, máx. 2–3 temas nuevos activos por área, `energy` (sesión más corta y ligera), 20 ítems por defecto configurable.
- **1.8-T3 · Intercalado y variedad:** nunca > 2 seguidos del mismo tema o tipo, variedad de formato por tema; pruebas de propiedades.
- **1.8-T4 · Progresión y enfoques:** reconocimiento → producción según dominio, `topicFocus`, `errorFocus`, determinismo.
- **1.8-T5 · Escenarios y cierre:** los 12 escenarios (nuevo, atrasado, un solo tema, energía baja, sin contenido…), CA 1–6 y cierre.

### 1.9 Consultas de estadísticas (3 tramos)
- **1.9-T1 · Actividad y precisión:** minutos e ítems por día, precisión por tipo/tema/área, tiempo medio por tipo; vacíos devuelven estructuras vacías.
- **1.9-T2 · Tarjetas y pronósticos:** tarjetas por nivel 1–5, pronóstico de repasos a 14 días, retención real vs. objetivo, mapa de calor área × nivel, serie de tendencias de dominio.
- **1.9-T3 · Informativos y cierre:** horas planeadas vs. hechas, XP/rango opcional (`stats.config.js`, sin penalizaciones), rendimiento (< 200 ms con 50.000 eventos), cierre.

### 1.10 Cliente de IA (4 tramos)
- **1.10-T1 · Base y proveedores:** estructura `core/ai/`, fachada `complete`, proveedores `none` y `groq` (endpoint y modelo editables), `schema.js` (validación del JSON devuelto); pruebas con `fetch` simulado.
- **1.10-T2 · Cola y manejo de errores:** `queue.js` (concurrencia, reintentos con espera exponencial ante 429/5xx), timeout configurable (20 s), manejo de 401/429/red/vacío/no-JSON (reintento único).
- **1.10-T3 · Caché, disponibilidad y registro:** `cache.js` (hash tarea+entrada, guarda en `generated`), `ai.available()`, evento `ai_call` sin clave ni prompt, `prompts/system.base.js` (prompt base del tutor), todo texto de IA escapado.
- **1.10-T4 · Verificación y cierre:** verificar en documentación actual el modelo por defecto y los límites gratuitos de Groq (si el entorno no tiene red, queda como pendiente para William con pasos), CA 1–5 y cierre.

### 1.11 Validador de lista blanca (3 tramos)
- **1.11-T1 · Tokenizador:** contracciones, guiones, números, siglas (`don't`, `well-known`, `U.S.`, `3rd`), emoji y vacío.
- **1.11-T2 · Lematizador y conocidos:** cargador de `lemmas.json` (el real de C10), lematización, `knownLemmas(db)` (estado `known`/`learning` + temas con dominio ≥ umbral + lista base A1). **Formas ambiguas** (las ~55 como `left` o `found`): una forma cuenta como conocida si **cualquiera** de sus lemas lo es.
- **1.11-T3 · Chequeo y cierre:** `check(text, known) → {unknown[], pctKnown}`, `isWithinTarget`, utilidad para marcar palabras nuevas, 10 textos de control, cierre.

### 1.12 Núcleo de sincronización (4 tramos)
- **1.12-T1 · Respaldo:** `exportBackup`/`importBackup` con validación de versión, modos fusionar/reemplazar con vista previa del impacto, claves excluidas por defecto, round-trip sin pérdida. **Además:** añade `clear(store)` al motor de base de datos y úsalo en el modo reemplazar y en "Borrar todo" de Ajustes (hoy `clearAll()` tarda 6–8 s con 10.000 eventos en IndexedDB real); mide antes y después.
- **1.12-T2 · Bloques del chat:** `makeChatBlock` (`llevar_al_chat`, `errores`, `estado`, `bitacora`) y `parseChatBlock` tolerante (texto alrededor, comillas curvas, vallas markdown), mensajes en español.
- **1.12-T3 · Errores del chat y bitácora:** importación idempotente de errores del chat y generador de bitácora en texto plano.
- **1.12-T4 · Entradas hostiles y cierre del M0.5:** `__proto__`, tamaños enormes, JSON malformado; CA 1–4; comparar `docs/CONTRACTS.md` con la sección 8 y marcar "contratos v1 congelados"; **corrige `docs/DEPLOY.md`**: la dirección real es `autoroscuro.github.io/glossa/` (no `sophia-ingles`).

---

## Parte 2 — Sesión jugable

### 2.1 Ejecutor de sesión (4 tramos)
- **2.1-T1 · Cableado de servicios y máquina de estados:** `app/services.js` conecta `events`, `srs`, `errors`, `mastery` y el armador (con `db` posiblemente `null`); `core/sessionRunner.js` puro con la tabla de transiciones (`idle → presenting → answering → feedback → next → summary`).
- **2.1-T2 · Persistencia atómica:** tras cada respuesta, 1 evento + 1 actualización de tarjeta + registro de errores en una transacción; doble toque idempotente; restauración al cerrar y reabrir a mitad. **Además:** (a) los ítems `practice` y `error` no vencidos se tratan como **repasos adelantados** vía `srs.review`; (b) crea `core/masterySnapshot.js` (**foto diaria de dominio** en `meta`, clave `mastery_snap:<AAAA-MM-DD>`, una por día local, solo temas con evidencia, 400 días, idempotente) y la llama al cerrar sesión y en el primer arranque del día.
- **2.1-T3 · Vista de sesión:** `ui/views/session.js`: cabecera, barra X/20 con la mascota, salir a mitad con confirmación, cronómetro por ítem (pausa con pestaña oculta).
- **2.1-T4 · Registro de ejercicios y cierre:** `ui/exercises/index.js` (selección por `type`, pantalla amable de "tipo no soportado todavía"), integración con ítems de prueba, CA 1–6 y cierre.

### 2.2 Tarjeta `phrase_cloze` (4 tramos)
- **2.2-T1 · Render base:** frase/mini-diálogo ES con turnos A/B, palabra clave en verde en ES y EN, versión EN con hueco, cajas de gramática y de matiz (opcionales), etiqueta de situación.
- **2.2-T2 · Respuesta:** entrada por teclado (micrófono deshabilitado con aviso "disponible pronto"), Ver pista progresiva (primera letra, luego estructura), "No sé", corrección con `wordDiff`, `grade`.
- **2.2-T3 · Insignias y efectos:** `Nivel N (?)` con hoja explicativa, `New`, corazón (favorita → `fav`), `Repaso en …`; `almost` → aviso ortográfico y tarjeta `spell`.
- **2.2-T4 · Accesibilidad y cierre:** 360 px sin cortes, textos largos, lector de pantalla ("hueco"), escenarios, CA 1–6.

### 2.3 Familia de elección (3 tramos)
- **2.3-T1 · Componente base `choice`:** opciones barajadas con `rng` (la correcta no siempre en la misma posición), "No sé" siempre visible, selección múltiple opcional, objetivos táctiles ≥ 44 px.
- **2.3-T2 · Feedback y errores:** feedback que explica el distractor con `code` usando `pista_corta_es`, registro del error por distractor, evento `dont_know`.
- **2.3-T3 · Los 9 tipos y cierre:** envoltorios `choose_correct`, `ab_natural`, `mcq_en_es`, `mcq_es_en`, `pick_fits`, `odd_one_out`, `choose_tense`, `prep_pick`, `particle_pick`; prueba estadística de barajado; cierre.

### 2.4 Familia ordenar/emparejar/completar (4 tramos)
- **2.4-T1 · Ordenar:** `order_blocks` (varios órdenes válidos en `accept`), `order_dialogue`, interacción por toques, deshacer y reiniciar.
- **2.4-T2 · Emparejar y banco:** `match_pairs` (5–6 pares, feedback inmediato por par) y `cloze_bank`.
- **2.4-T3 · Construcción:** `unscramble_letters` y `build_from_keywords`, sin estados imposibles (doble toque en el mismo bloque).
- **2.4-T4 · Fuzz y cierre:** secuencias de toques aleatorias sin excepciones, 2 y 12 bloques, arrastre opcional solo si es sólido, CA 1–5.

### 2.5 Familia de producción corta (5 tramos)
- **2.5-T1 · Base de entrada de texto:** componente común con `compare`, variantes y contracciones, respuesta vacía no se envía, teclado móvil sin autocorrección ni mayúscula forzada, `almostAtWordEnd: true` donde aplique.
- **2.5-T2 · Palabra y colocación:** `fill_verb`, `translate_word`, `first_letter`, `collocation_fill`, `def_to_word`, `derive_form`.
- **2.5-T3 · Formas y traducción:** `three_forms` (tres campos, grading por faceta), `trap_translate`, `translate_bank`.
- **2.5-T4 · Transformación:** `fix_error`, `transform`, `keyword_transform`, `join_sentences`, `pronoun_placement`.
- **2.5-T5 · Detector y cierre:** pista específica con el detector mecánico (1.6), mapeo automático a `ErrorRecord`, tabla de ≥ 80 respuestas con las del diagnóstico, CA 1–6.

### 2.6 Retroalimentación, pistas y "No sé" (3 tramos)
- **2.6-T1 · Panel de feedback:** estados correcto/casi/incorrecto/no sé, respuesta correcta siempre visible, `explain_es`, `grammar_note_es`, `nuance_es`.
- **2.6-T2 · Pistas y notas:** "No sé" sin lenguaje de fallo, campo "¿por qué creías eso?" (evento `note`), "Marcar como difícil" / "No me convence esta frase" (reporte local).
- **2.6-T3 · Tono y cierre:** sonidos y vibración opcionales, reacción de la mascota, auditoría de cadenas sin culpa, el mismo panel en todos los tipos, cierre.

### 2.7 Barra de 4 acciones (4 tramos)
- **2.7-T1 · Barra y Otros ejemplos:** barra fija inferior, hojas que no pierden el ejercicio, "Otros ejemplos" mecánico (≥ 3 del paquete).
- **2.7-T2 · Correcciones:** hoja con los errores propios del ítem/tema, contador en la insignia.
- **2.7-T3 · Preguntas IA y Llevar al chat:** botón visible, sin IA muestra "Conecta tu clave en Ajustes" y ofrece "Llevar al chat" (bloque de 8.14, con alternativa si falla el portapapeles).
- **2.7-T4 · Diccionario y cierre:** búsqueda local tolerante a mayúsculas y acentos, "añadir" si no existe, CA 1–4.

### 2.8 Resumen de sesión (3 tramos)
- **2.8-T1 · Cálculo del resumen:** función pura desde eventos (ítems, aciertos, tiempo, mejoras de dominio con confianza, errores nuevos y recurrentes, próximos repasos), prueba cruzada con eventos, 0 respuestas sin NaN.
- **2.8-T2 · Pantalla:** resumen completo, abandono a mitad = resumen parcial, mensaje final cálido y honesto.
- **2.8-T3 · Acciones y cierre:** "Repetir los que fallé" (mini-sesión), "Llevar al chat", CA 1–4.

### 2.9 Paquete semilla S0 y recorrido completo (5 tramos)
- **2.9-T1 · Semilla, parte 1:** `pack_seed_v1`: temas 1–2 de prioridad 1 (≥ 24 ítems originales, ≥ 3 tipos por tema, reglas de calidad de 8.10), validados.
- **2.9-T2 · Semilla, parte 2:** temas 3–5 (≥ 36 ítems más, total ≥ 60), instalada con `npm run add-pack`.
- **2.9-T3 · Arranque con contenido:** `importPacksToDb` al primer arranque, precache de `content/index.json` y paquetes en `sw.js`, botón "Estudiar ahora" en Hoy que arma la sesión 1.8.
- **2.9-T4 · Simulación:** 5 días de uso con respuestas generadas verificando invariantes (sin tarjetas duplicadas, `due` coherente, eventos = respuestas, dominio sin bajar sin causa); errores del diagnóstico registrados con su código.
- **2.9-T5 · Guion y cierre del M1:** guion de 10 pasos para William, `tests/scenarios/HITO_M1.md`, CA 1–4, versión MINOR y build. **Además:** con los datos de la simulación (2.9-T4) fija la **política real de topes diarios** (nuevas y repasos; por defecto 10 y 100) y anótala en `DECISIONS.md`.

### 2.10 Rediseño de los temas Neo y Claro (2 tramos)
- **2.10-T1 · Referencia y Neo:** pide a William el proyecto de referencia y las capturas; extrae paleta, fondos, sombras y tipografía; rediseña **Neo** en `themes.css` sin cambiar nombres de variables; pruebas de contraste AA.
- **2.10-T2 · Claro y cierre:** rediseña **Claro**, repasa la galería y las 5 pestañas en los tres temas, CA 1–4, guion corto de comparación para el siguiente hito; versión PATCH.

---

## Parte 3 — Mapa, plan, estadísticas y errores

### 3.1 Vista de mapa (4 tramos)
- **3.1-T1 · Lista jerárquica:** áreas → niveles → temas con % de dominio, confianza y símbolo de banda (usa `mastery`).
- **3.1-T2 · Filtros y búsqueda:** "A estudiar" / "En riesgo" / "Diagnosticado como hueco", búsqueda; prerrequisitos solo sugeridos.
- **3.1-T3 · Mapa de calor y desglose:** mapa de calor y desglose explicado al tocar el porcentaje.
- **3.1-T4 · Rendimiento y cierre:** 250 temas fluidos (virtualizar o paginar), vacíos, CA 1–4.

### 3.2 Detalle de tema (3 tramos)
- **3.2-T1 · Ficha:** regla, forma, uso, ejemplos, errores típicos, contraste con el español; campos ausentes tolerados; estado y desglose.
- **3.2-T2 · Acciones:** "Llevar al chat" (ficha + errores propios), "Practicar este tema" (`topicFocus`), historial del tema.
- **3.2-T3 · Estados y cierre:** tema sin ítems con estado vacío útil, CA 1–4.

### 3.3 Exámenes de entrada y de salida (4 tramos)
- **3.3-T1 · Armador de exámenes:** selección sin repetir ítems de la práctica reciente, mínimo configurable (8), degradación con < 12 ítems.
- **3.3-T2 · Examen de entrada:** producción + pregunta de teoría, eventos `exam_entry`, paso a mantenimiento o "a estudiar con el chat".
- **3.3-T3 · Examen de salida:** ítems nuevos, eventos `exam_exit`, actualización de dominio y vuelta al repaso normal, sin bloqueo.
- **3.3-T4 · Formato limpio y cierre:** formato limpio para vocabulario (sin pistas, con "No sé"), vistas, CA 1–5.

### 3.4 Pantalla "Hoy" y plan (5 tramos)
- **3.4-T1 · `core/plan.js` base:** bloques según tiempo y energía (repasos primero, tema nuevo, lectura o escritura alternando, conversación, bloque externo, descansos).
- **3.4-T2 · Reglas y regreso:** máx. 2–3 temas nuevos activos por área, el plan se encoge solo, lógica de regreso tras pausa con modo rescate.
- **3.4-T3 · Vista Hoy:** sliders de tiempo y energía, bloques con tiempo estimado, botón "Empezar" siempre visible.
- **3.4-T4 · Reordenar y bienvenida:** reordenar y saltar sin culpa (se recuerda), bienvenida cálida al regresar, nunca "perdiste tu racha".
- **3.4-T5 · Informativos y cierre:** horas planeadas vs. hechas, tabla de planes por tiempo/energía/atraso, CA 1–4.

### 3.5 Vistas de semana y mes (3 tramos)
- **3.5-T1 · Temas semanales:** crea `content/taxonomy/weekly_themes.json` (≥ 12 temas, formato validado) y su cargador; tema sugerido y cambiable.
- **3.5-T2 · Semana:** mini-diagnóstico semanal y lista "Llevar al chat" de la semana.
- **3.5-T3 · Mes y cierre:** metas por área, hitos, sondas de techo sugeridas cada 4–6 semanas, reprogramación sin deuda visible, CA 1–4.

### 3.6 Estadísticas y progreso (4 tramos)
- **3.6-T1 · Gráficas propias:** componentes SVG/Canvas sin librerías (barras, líneas, mapa de calor) legibles a 360 px.
- **3.6-T2 · Actividad y precisión:** actividad por día, precisión por tipo/tema, tarjetas por nivel 1–5.
- **3.6-T3 · Pronóstico y tendencias:** pronóstico de repasos, retención real vs. objetivo (marcada "estimada"), tendencia de dominio por área **leyendo las fotos diarias** (`mastery_snap:*`; con pocos días muestra "aún no hay suficiente historia"), tiempos medios; consultas con ventana de 14–30 días.
- **3.6-T4 · Gamificación y cierre:** XP/rangos opcionales y desactivables (ocultos por completo), **apagados por defecto** (`enabled: false`; cambia la constante y su prueba) con interruptor en Ajustes; los valores y nombres provisionales de 1.9-T3 se quedan salvo que el uso real indique otra cosa; textos honestos ("poca evidencia todavía"), vacíos, CA 1–4.

### 3.7 Pantalla de errores (4 tramos)
- **3.7-T1 · Ranking y filtros:** errores top (frecuencia × impacto), filtros por código/tema/origen/período.
- **3.7-T2 · Ficha y práctica:** ficha de cada código con ejemplos propios y microexplicación, "Practicar este error" (`errorFocus`), "Llevar al chat".
- **3.7-T3 · Importar del chat:** importar bloque de errores del chat con vista previa, sin duplicar (`source:"chat"`).
- **3.7-T4 · Sanguijuelas y cierre:** lista de sanguijuelas con acción clara ("Explícamelo en el chat"), CA 1–4.

### 3.8 Test de nivelación y calibración (3 tramos)
- **3.8-T1 · Estado inicial:** importación idempotente del resultado del diagnóstico de William (7.10): huecos confirmados, dominio inicial con confianza baja.
- **3.8-T2 · Test corto adaptativo:** calibración por área; lo que dijo "no sé" no se repregunta.
- **3.8-T3 · Reinicio y cierre del M2:** todo editable y reiniciable, huecos fuera de los exámenes de entrada, CA 1–4, guion y `tests/scenarios/HITO_M2.md`.

---

## Parte 4 — Vocabulario, verbos, phrasal verbs, preposiciones y ortografía

### 4.1 Léxico, familias y ficha de palabra (4 tramos)
- **4.1-T1 · Almacén:** almacén `words`, carga de `LexEntry` desde paquetes, estados `desconocida / aprendiendo / conocida`.
- **4.1-T2 · Familias:** familias temáticas y lingüísticas con nivel y prioridad (esenciales primero).
- **4.1-T3 · Ficha de palabra:** lema, categoría, significado, ejemplos, audio (si existe), colocaciones, falso amigo, banda; cambiar estado crea o actualiza la tarjeta.
- **4.1-T4 · Búsqueda y cierre:** búsqueda con acentos y mayúsculas, vista de familias con dominio, 5.000 palabras fluidas, CA 1–4.

### 4.2 Ejercicios de vocabulario (3 tramos)
- **4.2-T1 · Categorizar y derivar:** `categorize`, `derive_form`.
- **4.2-T2 · Relámpago:** `lightning` (2 min, sin penalización), `own_sentence_word` (versión mecánica).
- **4.2-T3 · Progresión y cierre:** progresión reconocimiento → producción en el armador (extensión autorizada, documentada), ≥ 3 tipos por palabra, CA 1–3.

### 4.3 Examen de entrada "limpio" (3 tramos)
- **4.3-T1 · Formato de ítem:** oración neutra sin pistas + opciones en español + "No sé", y la comprobación de pistas en el validador.
- **4.3-T2 · Selección:** por banda de frecuencia (las bandas de `lemmas.json` son aproximadas; ver "Puntos de acople"), sin repetir palabras ya conocidas.
- **4.3-T3 · Resultado y cierre:** resultado por banda (1K/2K/3K), fallidas a estudio, "No sé" como dato válido, CA 1–4.

### 4.4 Verbos irregulares y regulares (4 tramos)
- **4.4-T1 · Facetas:** tres tarjetas por verbo (presente, pasado, participio) con vencimientos independientes.
- **4.4-T2 · Ejercicios:** `three_forms` y `group_irregulars` agrupados por patrón.
- **4.4-T3 · Lote y pronunciación:** lote diario configurable (5 por defecto, 3–10) por frecuencia, reglas de -ed (/t/, /d/, /ɪd/).
- **4.4-T4 · Errores y cierre:** clasificación `VRB.IRREG_REGULARIZE` y `VRB.DOUBLE_PAST`, fallo en una forma no penaliza las otras, CA 1–4.

### 4.5 Phrasal verbs (3 tramos)
- **4.5-T1 · Modelo:** separables/no separables, literal/figurado, significados múltiples como tarjetas distintas.
- **4.5-T2 · Ejercicios:** `pronoun_placement`, `particle_pick`, `phrasal_meaning`, `formal_synonym`.
- **4.5-T3 · Lote y cierre:** lote diario (3 por defecto, 1–6), CA 1–3.

### 4.6 Preposiciones dependientes y patrones verbales (3 tramos)
- **4.6-T1 · Familias y reglas:** familias `prep` y patrones fijos con validación (≥ 12 ítems de ≥ 3 tipos por patrón).
- **4.6-T2 · Fichas y distractores:** contraste con el español visible, distractores con `code` tomados de los errores reales de William (7.10), `explain_rule`.
- **4.6-T3 · Paquete de muestra y cierre:** paquete de muestra validado y CA 1–3.

### 4.7 Ortografía (4 tramos)
- **4.7-T1 · Tarjetas `spell` automáticas:** desde errores de ortografía y palabras recurrentes, sin duplicados, `almostAtWordEnd: true`.
- **4.7-T2 · Ejercicios de letras:** letras desordenadas, completar letras faltantes, letras mudas, `-y→-ies`.
- **4.7-T3 · Homófonos y audio:** homófonos con contexto, duplicación de consonantes, `spell_from_audio` con TTS del navegador.
- **4.7-T4 · Diccionario y cierre del M3:** vista Diccionario del usuario con filtros por estado, CA 1–3, guion y `tests/scenarios/HITO_M3.md`.

---

## Parte 5 — Inteligencia artificial

### 5.1 Configuración y estado de IA (3 tramos)
- **5.1-T1 · Pantalla IA:** proveedor, modelo editable, clave, indicador global "IA activa / modo mecánico", contador de llamadas del día.
- **5.1-T2 · Probar conexión:** diagnóstico claro (401, 429, red, éxito) con simulaciones.
- **5.1-T3 · Verificación y cierre:** verificar modelo y límites vigentes (o dejar pendiente con pasos), sin clave todo sigue mecánico, CA 1–3.

### 5.2 "Otros ejemplos" con IA (3 tramos)
- **5.2-T1 · Capas 1 y 2:** ejemplos del paquete y de fuentes abiertas con licencia verificada.
- **5.2-T2 · Capa 3:** prompt versionado, 3–5 frases dentro de lo dominado, esquema JSON, validación con `whitelist`.
- **5.2-T3 · Caché y cierre:** `generated`, reintento único, "no verificado" + "Reportar", caída al paquete sin IA, CA 1–4.

### 5.3 "Preguntas IA" contextuales (3 tramos)
- **5.3-T1 · Contexto:** construcción del contexto (ítem, respuesta, tema, errores recientes) sin datos innecesarios ni claves.
- **5.3-T2 · Mini-chat:** hoja inferior, respuestas cortas escapadas, límite de turnos, historial por ítem.
- **5.3-T3 · Respaldo y cierre:** "Esto no me quedó claro → Llevar al chat", mensajes amables ante fallos de red, CA 1–4.

### 5.4 Calificación de respuestas abiertas (4 tramos)
- **5.4-T1 · Rúbrica y esquema:** prompts y JSON `{verdict, score, errors[], praise_es}` con rúbrica fija.
- **5.4-T2 · Fusión:** unión con el comparador mecánico (exacto = sin IA, ambiguos por IA), sin IA → `needs_review`.
- **5.4-T3 · Mapeo de errores:** errores a códigos existentes, desconocidos a `unknown` con reporte.
- **5.4-T4 · Componentes y cierre:** `translate_free`, `own_sentence_*`, `explain_rule`, `summarize_one_line`, registro de lo que la IA "aprueba" frente a un rechazo mecánico, CA 1–4.

### 5.5 Clasificación de errores con IA (3 tramos)
- **5.5-T1 · Clasificador:** implementa el contrato de `core/errorHook.js` (kind, origin, impact, tema causante).
- **5.5-T2 · Reconciliación y lotes:** el mecánico explícito gana; lotes por llamada con tope.
- **5.5-T3 · Sin IA y cierre:** cae al detector mecánico sin regresión, CA 1–3.

### 5.6 Ciclo de feedback de escritura (5 tramos)
- **5.6-T1 · Consigna:** consignas con estructuras ocultas de la semana usando solo lo dominado.
- **5.6-T2 · Escritura:** pantalla de escritura y parser de `[corchetes]` (circunlocución fomentada; esas palabras pasan a estudio).
- **5.6-T3 · Feedback:** ≤ 5 errores priorizados por impacto y tema, 3 aciertos, versión corregida con explicación.
- **5.6-T4 · Reescritura:** reescritura y comparación 1ª vs. 2ª, métricas (palabras, cumplimiento de tarea).
- **5.6-T5 · Sin IA y cierre:** guarda el texto y genera "Llevar al chat" con instrucciones, errores al registro, CA 1–5.

### 5.7 Generador de frases con vocabulario dominado (3 tramos)
- **5.7-T1 · Generación:** solo lemas dominados (+ 5–10 % nuevo marcado).
- **5.7-T2 · Validación:** `whitelist.check`, reintento o descarte.
- **5.7-T3 · Frases propias y cierre:** guardar frases propias para repaso, CA 1–3.

### 5.8 Conversación y juegos de rol por texto (5 tramos)
- **5.8-T1 · Escenarios:** carga de situaciones (usa el contenido de C13) y objetivo oculto semanal.
- **5.8-T2 · Motor de turnos:** límites de turnos y duración, lenguaje dentro de la lista blanca, sin corregir a mitad.
- **5.8-T3 · Pantalla de chat:** interfaz de conversación y transcripción guardada.
- **5.8-T4 · Cierre de la conversación:** feedback final (errores por impacto + 3 frases para repetir), objetivo oculto evaluado.
- **5.8-T5 · Respaldo y cierre:** guiones fijos sin IA, evidencia `U` de dominio, CA 1–4.

### 5.9 Mediación y pragmática (3 tramos)
- **5.9-T1 · Rúbricas:** una por acto de habla y por tipo (`med_summarize`, `med_explain_layperson`, `med_register`, `med_speech_act`, `med_cross_language`).
- **5.9-T2 · Componentes:** los cinco tipos con feedback sobre registro.
- **5.9-T3 · Sin IA y cierre:** pendiente para el chat sin IA, CA 1–3.

### 5.10 Señal "U" y entrenador semanal (3 tramos)
- **5.10-T1 · Señal U:** conectar la evidencia de uso real a `mastery`.
- **5.10-T2 · Resumen semanal:** con IA y versión mecánica, validado contra los datos (no inventa).
- **5.10-T3 · Tono y cierre del M4:** tono honesto sin culpa, CA 1–3, guion y `tests/scenarios/HITO_M4.md`.

---

## Parte 6 — Lectura e historias

### 6.1 Lector con "tocar palabra" (5 tramos)
- **6.1-T1 · Tokenización táctil:** contracciones, guiones, puntuación; rendimiento base.
- **6.1-T2 · Vista del lector:** texto, tamaño ajustable, significado ES + lema + categoría al tocar.
- **6.1-T3 · Estados:** desconocida / aprendiendo / conocida con colores persistentes en todo el texto; al marcar se crea la tarjeta.
- **6.1-T4 · Frases y modos:** selección de varias palabras, modo intensivo (con ayudas) y extensivo (tiempo registrado).
- **6.1-T5 · Palabras sin entrada y cierre:** "añadir significado" (o IA), textos de 3.000 palabras fluidos, CA 1–4.

### 6.2 Comprensión lectora (4 tramos)
- **6.2-T1 · Preguntas básicas:** `read_local_q`, `read_global_q`, `read_tfng` (verdadero/falso/no lo dice).
- **6.2-T2 · Estructura del texto:** `read_reference`, `order_paragraphs`, `match_headings`, `gap_sentences`.
- **6.2-T3 · Inferencia y resumen:** `read_inference`, `summarize_one_line` (IA).
- **6.2-T4 · Autoevaluación y cierre:** lista de desconocidas autodeclarada y contraste con resultados sin juzgar, CA 1–3.

### 6.3 Biblioteca de historias y flujo RAIO (4 tramos)
- **6.3-T1 · Biblioteca:** historias por nivel CEFR, progreso por historia, objetivos visibles.
- **6.3-T2 · Pasos 1 y 2:** escuchar sin texto (TTS del navegador si no hay audio) y luego ver el texto.
- **6.3-T3 · Pasos 3 y 4:** repetir en voz alta (shadowing) y ejercicios analíticos.
- **6.3-T4 · Integración y cierre:** palabras nuevas a estudio, contador de repeticiones, continuidad entre segmentos, con y sin audio, CA 1–4.

### 6.4 Comprobador de comprensibilidad 90–95 % (3 tramos)
- **6.4-T1 · Cálculo y panel:** `pctKnown` por texto y marcado del 5–10 % nuevo.
- **6.4-T2 · Selector:** prioriza textos en rango configurable, advertencia amable fuera de rango.
- **6.4-T3 · CLI y cierre:** `tools/check-story-levels.mjs`, CA 1–3.

### 6.5 Sondas de techo (3 tramos)
- **6.5-T1 · Selección de la sonda:** texto o tarea por encima del nivel, fuera del plan diario.
- **6.5-T2 · Medición:** comprensión y palabras nuevas, actualización del techo estimado con confianza.
- **6.5-T3 · Mensaje y cierre:** resultado honesto sin culpa, CA 1–3.

### 6.6 Lectura extensiva (2 tramos)
- **6.6-T1 · Modo libre:** tiempo (excluye pestaña oculta) y palabras leídas.
- **6.6-T2 · Objetivos y cierre del M5:** objetivos blandos opcionales, estadísticas, CA 1–3, guion y `tests/scenarios/HITO_M5.md`.

---

## Parte 7 — Audio

### 7.1 Tubería de audio en el PC de William (4 tramos)
- **7.1-T1 · Extracción y manifiesto:** lectura de paquetes, textos con su `audio`, `audio/manifest.json` (id → archivo, duración, hash, voz); parte Node probada con textos de muestra.
- **7.1-T2 · Generación:** script de Kokoro (verificar instrucciones vigentes; si no hay red, declarar lo no verificado), MP3 mono por texto, voz por personaje A/B, `<id>.slow.mp3`, volumen normalizado.
- **7.1-T3 · Incremental y tamaños:** solo regenera lo cambiado, el manifest valida con el validador, tamaño total estimado reportado.
- **7.1-T4 · Guía y cierre:** `docs/AUDIO_GUIDE.md` paso a paso para William, CA 1–4.

### 7.2 Reproductor de audio (4 tramos)
- **7.2-T1 · Núcleo:** `core/speech/player.js`: reproducir por `id` con manifest, velocidad 0.7×–1.2×, repetir, siguiente.
- **7.2-T2 · Respaldos:** caída a `speechSynthesis`, política de autoplay de Android, sin superposición de audios.
- **7.2-T3 · Caché:** límite en el service worker, precarga del siguiente, reproducción sin conexión.
- **7.2-T4 · Controles y cierre:** controles Normal/Lento · Otra vez · Siguiente, CA 1–4, prueba manual de William.

### 7.3 Dictado y cloze auditivo (3 tramos)
- **7.3-T1 · `dictation`:** tolerancia ortográfica y marcado, velocidad y repeticiones; aplica la lista fija tipo → modo y los valores por defecto de los "Puntos de acople" (escribir/elegir, `speed`, `max_plays`, `show_transcript`).
- **7.3-T2 · `cloze_audio` y `spell_from_audio`.**
- **7.3-T3 · Progresión y cierre:** con transcripción y lento → sin transcripción y a velocidad real, el contador de repeticiones como pista, CA 1–3.

### 7.4 Habla conectada y pares mínimos (3 tramos)
- **7.4-T1 · `connected_speech`:** enlaces, elisiones, formas débiles.
- **7.4-T2 · `minimal_pair_listen`:** pares con audio de ambas palabras, distractores por fonema problemático.
- **7.4-T3 · `what_did_they_say` y cierre:** errores registrados con `PRON.*`, CA 1–3.

### 7.5 Comprensión auditiva y escucha extensiva (3 tramos)
- **7.5-T1 · `listen_comprehension`:** transcripción oculta hasta el final.
- **7.5-T2 · `follow_instruction` y `extensive_listening`:** tiempo de escucha registrado.
- **7.5-T3 · Fuentes y cierre:** verificación documentada de licencias (VOA, LibriVox; solo enlaces si no es claro), CA 1–3.

### 7.6 Shadowing diario (2 tramos)
- **7.6-T1 · Módulo:** escuchar → repetir → auto-evaluación (3 caritas) → siguiente, ≈ 5 min configurable, evento al evaluar.
- **7.6-T2 · Plan y cierre del M6:** integración al plan (3.4), CA 1–3, guion y `tests/scenarios/HITO_M6.md`.

---

## Parte 8 — Voz y pronunciación

### 8.1 Reconocimiento de voz (4 tramos)
- **8.1-T1 · `stt.js`:** `SpeechRecognition` en-US, permisos, estados (escuchando/procesando/error), fallbacks si no hay API.
- **8.1-T2 · Transcripción coloreada:** burbuja "esto entendí" con cada palabra verde/roja.
- **8.1-T3 · En `phrase_cloze`:** activar el micrófono con "Modo teclado" siempre disponible, sin guardar grabaciones.
- **8.1-T4 · Aviso y cierre:** información clara sobre el servicio externo de Android/Chrome, permiso denegado sin romper nada, CA 1–4, prueba manual.

### 8.2 Azure Pronunciation Assessment (5 tramos)
- **8.2-T1 · Guía y ajustes:** `docs/AZURE_GUIDE.md` (recurso F0 vía Azure for Students; verificar disponibilidad) y campos de clave/región.
- **8.2-T2 · Cliente:** `core/speech/azure.js` (SDK o REST, lo más ligero y vigente; sin dependencias nuevas sin permiso) con audio de ≈ 10 s.
- **8.2-T3 · Resultados:** parser de precisión, fluidez, completitud y prosodia a nivel palabra y fonema.
- **8.2-T4 · Errores y degradación:** 401/403/429, contador de uso, sin red, cero claves en logs, función oculta con explicación si no hay clave.
- **8.2-T5 · Cierre:** CA 1–5 y guion de prueba manual (crear el recurso y probar 5 frases).

### 8.3 Ejercicios de pronunciación (5 tramos)
- **8.3-T1 · Base:** mapeo fonema → pista en español, umbrales de color configurables.
- **8.3-T2 · Lectura y eco:** `read_aloud_score`, `echo_repeat`.
- **8.3-T3 · Pares y sonidos:** `minimal_pair_speak`, `sound_drill` (orden de 7.11).
- **8.3-T4 · Ritmo y acento:** `stress_mark`, `rhythm_sentence`, `describe_image_speak`.
- **8.3-T5 · Tarjetas y cierre:** cada sonido fallado crea 1 tarjeta `PRON.*` sin duplicados, clasificación fina construida por nosotros, degradación a STT, CA 1–4.

### 8.4 Conversación por voz (4 tramos)
- **8.4-T1 · Máquina de estados:** hablar → STT → IA → leer en voz alta, con simulaciones.
- **8.4-T2 · Modo manos libres:** ciclo completo sin tocar la pantalla, elección de tema y rol.
- **8.4-T3 · Robustez:** transcripción guardada ante cortes de red, límites de turnos/duración/cupo, guiones de respaldo.
- **8.4-T4 · Informe y cierre:** informe final con 3 frases para repetir, respeta la lista blanca, CA 1–4.

### 8.5 Alternativas locales (opcional, 2 tramos)
- **8.5-T1 · Plan de evaluación:** solo si Azure no es viable; qué medir (tamaño, tiempo, calidad) y cómo.
- **8.5-T2 · Mediciones e informe:** pruebas en el teléfono real de William con pasos claros; el chat recomienda y William decide.

### 8.6 Exportar grabaciones (2 tramos)
- **8.6-T1 · Guardado local:** opción desactivada por defecto "guardar las últimas N grabaciones" y borrar todas.
- **8.6-T2 · Exportar y cierre del M7:** exportación en Android, recordatorio suave cada 4–6 semanas, CA 1–3, guion y `tests/scenarios/HITO_M7.md`.

---

## Parte 9 — Cierre y endurecimiento

### 9.1 Recordatorios (2 tramos)
- **9.1-T1 · Viabilidad:** informe de qué es confiable en una PWA en Android (Notification Triggers, Periodic Background Sync, Web Push), basado en documentación vigente o declarado como no verificado.
- **9.1-T2 · Implementación mínima y cierre:** solo lo confiable (recordatorio suave al abrir, opción de crear alarma desde el chat), sin culpa ni insistencia.

### 9.2 Ajustes completos y pulido de UX (5 tramos)
- **9.2-T1 · Inventario:** lista de verificación por pantalla (estados vacío, carga y error).
- **9.2-T2 · Ajustes conectados:** toda opción de 0.8 conectada a su función real; ninguna queda decorativa.
- **9.2-T3 · Estados:** implementar los estados vacío/carga/error que falten, incluido el aviso "Borrando…" en operaciones largas de datos.
- **9.2-T4 · Textos y microinteracciones:** revisión de cadenas (cálidas, sin culpa), microinteracciones, háptica opcional.
- **9.2-T5 · Recorrido y cierre:** recorrido completo de cada pantalla con la lista, auditoría de cadenas.

### 9.3 Respaldo y restauración robustos (3 tramos)
- **9.3-T1 · Respaldo automático:** local rotativo (últimos 3) y recordatorio suave.
- **9.3-T2 · Restauración:** con vista previa, migración de versiones antiguas, manejo del borrado de datos por Chrome.
- **9.3-T3 · Pruebas y cierre:** round-trip con 10.000 eventos (igualdad profunda), prueba de restauración en dispositivo limpio.

### 9.4 Rendimiento y contenido masivo (4 tramos)
- **9.4-T1 · Banco de pruebas:** datos sintéticos (20.000 ítems, 200.000 eventos) y benchmarks.
- **9.4-T2 · Carga perezosa:** paquetes e índices.
- **9.4-T3 · Virtualización:** listas largas y arranque en frío.
- **9.4-T4 · Presupuesto y cierre:** presupuesto de rendimiento, tamaño de caché y de audio, medición de costes pendientes de 1.1 (`countByDay`/`recentErrorsByCode` con 50.000 eventos, `clear(store)`), CA 1–2.

### 9.5 Accesibilidad y cadenas de UI (4 tramos)
- **9.5-T1 · Módulo de cadenas:** `app/strings.es.js` y regla de `audit` contra cadenas sueltas.
- **9.5-T2 · Migración:** mover las cadenas de las pantallas de estudio y de ajustes.
- **9.5-T3 · Accesibilidad:** lector de pantalla, contraste, objetivos táctiles.
- **9.5-T4 · Movimiento y cierre:** reducción de movimiento, tamaño de fuente del sistema, lista de verificación, CA 1–2.

### 9.6 Auditoría de seguridad y privacidad (3 tramos)
- **9.6-T1 · Revisión estática:** CSP, todo `innerHTML`, manejo de claves, dependencias vendorizadas con licencia, ausencia de telemetría.
- **9.6-T2 · Casos hostiles:** contenido de IA no confiable, importación hostil, permisos de micrófono; pruebas automatizadas.
- **9.6-T3 · Informe y correcciones:** hallazgos y correcciones, cero críticos/altos abiertos.

### 9.7 Regresión total y recorrido completo (3 tramos)
- **9.7-T1 · Simulación:** 60 días de uso con datos sintéticos verificando invariantes.
- **9.7-T2 · Guion manual completo** para William (todas las pantallas).
- **9.7-T3 · Revisión de documentos y cierre:** suite completa y `docs/*` al día.

### 9.8 Documentación final y empaquetado (3 tramos)
- **9.8-T1 · Documentos principales:** `README`, `DEPLOY`, guías de audio y Azure, manual de usuario corto.
- **9.8-T2 · Mantenimiento:** guía de mantenimiento (regenerar audio, actualizar versión, respaldo; enlaza `docs/ADD_PACK.md` y comprueba que sigue vigente).
- **9.8-T3 · Empaquetado y cierre:** evaluación opcional de APK con Capacitor (solo si algo lo exige), CA, versión 1.0, `tests/scenarios/HITO_M8.md`.


---
- **1.11** — Decisiones del Administrador sobre las 20 preguntas acumuladas, colocadas **dentro de los tramos donde se aplican** y en los "Puntos de acople" (que ahora todo chat lee): agregación de dominio sin ponderar por confianza; foto diaria de dominio en `meta` (`mastery_snap:<día>`, creada en 2.1-T2); ítems `practice`/`error` como repasos adelantados; ventanas de 14–30 días; `clear(store)` en 1.12-T1 y aviso "Borrando…" en 9.2-T3; XP apagado por defecto (3.6-T4); lista fija audio tipo → modo (7.3-T1); política de topes en 2.9-T5; formas ambiguas de lemas (1.11-T2); C6 añade sus familias `vocab.*`; bandas de `lemmas.json` aproximadas; 0.9 no sube versión; corrección de `DEPLOY.md` en 1.12-T4; **nueva subparte 2.10** (rediseño de Neo y Claro con el proyecto de referencia); regla 4.R.9 para pruebas de rendimiento (mediana de 5 corridas).

*Fin del roadmap maestro.*
