# DESIGN — Sistema de diseño de Sophia Inglés

> Subparte **0.3** (v0.3.0). La biblioteca de componentes en JavaScript la amplía la **0.5**; la navegación inferior, la **0.4**.
> Para verlo: abre `ui/styles/demo.html` (galería). Para comprobarlo: `npm run check` y `npm run contrast`.

## 1. Principios

- **Móvil primero.** Se diseña y se prueba a **360 px** y **412 px** de ancho; en pantallas más anchas el contenido se centra en una columna de 40 rem (`.container`).
- **Tres temas, mismos nombres.** Aurora (por defecto), Neo y Claro definen exactamente las mismas variables; ningún CSS fuera de `themes.css` escribe un color a mano. Por eso el tema cambia en vivo, sin recargar.
- **Sin dependencias externas.** Fuentes del sistema (`system-ui`), cero fuentes remotas, cero librerías, funciona sin conexión.
- **Accesible por defecto.** Objetivos táctiles ≥ 44 px, contraste AA calculado por script, foco visible con teclado, zona segura (`env(safe-area-inset-*)`), movimiento reducido y letra grande del sistema respetados.
- **Sin culpa.** El rojo se reserva para errores de la interfaz y el botón de peligro. El estado "sin dominar" nunca se pinta de rojo (los colores de dominio llegan con 3.1).

## 2. Archivos y orden de carga

| Archivo | Qué contiene |
|---|---|
| `ui/styles/tokens.css` | Lo que **no** cambia con el tema: espaciado, radios, tipografía, capas (z-index), duraciones, zona segura |
| `ui/styles/themes.css` | Los colores de cada tema (`:root`/Aurora, `[data-theme="neo"]`, `[data-theme="claro"]`) |
| `ui/styles/base.css` | Reinicio, tipografía, `:focus-visible`, movimiento reducido, utilidades (`.stack`, `.row`, `.container`, `.sr-only`…) |
| `ui/styles/components.css` | Clases base: `.glass`, `.card`, `.btn`, `.chip`, `.badge`, `.progress`, `.callout`, `.input`, `.sheet`, `.toast` |
| `ui/styles/demo.html` (+ `demo.css`, `demo.js`) | Galería para inspección visual. **No** forma parte de la app |

Orden obligatorio en `index.html` (0.4): `tokens.css` → `themes.css` → `base.css` → `components.css`.

## 3. Temas

```html
<html lang="es" data-theme="aurora">   <!-- aurora | neo | claro; sin atributo = aurora -->
```

Cambiar en vivo (lo hará Ajustes, 0.8): `document.documentElement.setAttribute('data-theme', 'neo')`. Conviene actualizar también `<meta name="theme-color">` con el valor de `--bg` (la galería lo hace; ver `demo.js`).

| Tema | Aspecto | Fondo | Acento | Acento 2 |
|---|---|---|---|---|
| **Aurora** (defecto) | Oscuro, resplandores morado y azul | `#070a1d` | ámbar `#FFC107` | morado `#8B5CF6` |
| **Neo** | Oscuro casi negro, neón | `#05050a` | cian `#00E5FF` | magenta `#C740FF` |
| **Claro** | Claro, lavanda muy suave | `#F4F5FA` | índigo `#4F46E5` | violeta `#7C3AED` |

**`prefers-color-scheme` solo sugiere el tema inicial.** El CSS **no** cambia de tema por sí solo. La primera vez (sin elección guardada) el JS puede sugerir `claro` si el sistema está en modo claro y `aurora` si no; en cuanto la persona elige, manda su elección (0.8 la guardará en IndexedDB, no en `localStorage`). `demo.js` trae el ejemplo (`suggestedTheme()`) y además acepta `demo.html?tema=neo`.

### Variables de color (idénticas en los tres temas)

| Grupo | Variables | Uso |
|---|---|---|
| Fondo | `--bg`, `--bg-glow-1`, `--bg-glow-2`, `--bg-image` | Color base y resplandores del degradado (se dibuja en `body::before`) |
| Superficies | `--surface` (vidrio), `--surface-strong`, `--surface-solid` (opaca: hojas, avisos), `--track` | Paneles y pistas |
| Bordes | `--border`, `--border-strong`, `--border-input` | `--border-input` cumple 3:1 (campos) |
| Texto | `--text`, `--text-muted` | Texto normal y atenuado |
| Acento | `--accent`, `--on-accent`, `--accent-text` | Relleno / texto sobre el relleno / el color como texto |
| Acento 2 | `--accent-2`, `--on-accent-2`, `--accent-2-text` | Ídem |
| Estados | `--info`, `--success`, `--danger` (cada uno con `--on-…` y `--…-text`) | Avisos, insignias, botón de peligro |
| Aviso dorado | `--callout-bg`, `--callout-text`, `--callout-border` | Caja de gramática / matiz (7.7) |
| Otros | `--disabled-bg`, `--disabled-text`, `--focus`, `--overlay`, `--shadow-sm/md/lg` | |

Convención: `--X` = relleno · `--on-X` = texto sobre ese relleno · `--X-text` = ese color usado como texto sobre fondo o tarjeta (en los temas oscuros es más claro; en el Claro, más oscuro).

## 4. Tokens fijos (`tokens.css`)

| Familia | Variables |
|---|---|
| Espaciado (base 4 px, en rem) | `--space-1` … `--space-12` (0,25 · 0,5 · 0,75 · 1 · 1,25 · 1,5 · 2 · 2,5 · 3 rem) |
| Radios (de Sophia) | `--radius-xl` 30 px (hojas) · `--radius-lg` 24 px (tarjetas) · `--radius-md` 18 px (botones, campos) · `--radius-sm` 12 px · `--radius-pill` |
| Tipografía | `--font-sans` (system-ui…), `--font-mono`; `--text-xs` 12 px · `sm` 14 · `base` 16 · `lg` 18 · `xl` 20 · `2xl` 24 · `3xl` 30 · `4xl` 36; pesos 400/500/600/700; interlineado 1,2 / 1,35 / 1,5 |
| Táctil | `--touch-min: 44px` |
| Capas | `--z-base` 0 · `--z-raised` 10 · `--z-nav` 100 · `--z-backdrop` 190 · `--z-sheet` 200 · `--z-toast` 300 |
| Movimiento | `--dur-fast` 120 ms · `--dur-base` 200 ms · `--dur-slow` 320 ms · `--ease-out` · `--ease-in-out` |
| Maquetación | `--gutter` 1 rem · `--content-max` 40 rem · `--nav-h` 4 rem (alto de la navegación inferior, 0.4) · `--glass-blur` 18 px |
| Zona segura | `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left` |

La escala de texto usa `rem` y `html { font-size: 100% }`: respeta el tamaño de letra del sistema. Probado al 150 % y 200 % sin desbordes (a 200 %, una palabra larga de un título se parte antes de salirse de la pantalla).

## 5. Componentes (clases base)

**Vidrio y tarjeta.** `.glass` y `.card` = fondo translúcido + borde + sombra + `backdrop-filter: blur(18px)`. Si el navegador no soporta `backdrop-filter`, usan fondo sólido (`@supports`). `.card` añade relleno y radio 24 px; `.card__meta` para las insignias de arriba; `.card--flat` quita la sombra.

```html
<article class="card">
  <div class="card__meta"><span class="badge badge--level">Nivel 2</span> <span class="badge badge--new">New</span></div>
  <h3 class="card__title">I have lived here for two years.</h3>
  <div class="callout"><p>Usa <code>for</code> con una duración.</p></div>
</article>
```

**Botón.** `.btn` + variante: `.btn--primary` (acento), `.btn--secondary` (vidrio), `.btn--danger`, `.btn--ghost`. Tamaños: `.btn--lg` (56 px), `.btn--block` (ancho completo), `.btn--icon` (44 × 44, **siempre con `aria-label`**). Deshabilitado: atributo `disabled` o `aria-disabled="true"`. Los efectos `:hover` solo existen con puntero real (`@media (hover: hover)`): en el móvil no queda nada "pegado".

**Chip** (se puede tocar): `.chip`; seleccionado con `aria-pressed="true"` o `.is-selected`; se agrupan con `.chip-group`. Si solo es una etiqueta, usa `.badge`.

**Insignia** (solo informa): `.badge` + `--level` ("Nivel N"), `--new` ("New", roja), `--review` ("Repaso en…"), `--accent`, `--success`, `--info`. Texto de 12 px; no se toca (para el "?" de Nivel pon al lado un `.btn.btn--ghost.btn--icon`).

**Barra de progreso.**

```html
<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60" aria-label="Progreso de la sesión">
  <div class="progress__bar"></div>
</div>
```

El ancho sale de `--value` (0–100): `el.style.setProperty('--value', 60)`. Variantes: `--accent-2`, `--info`, `--success`, `--thin`. Los valores fuera de 0–100 se recortan.

**Aviso dorado** `.callout`: caja de gramática / matiz de uso. **Campo** `.input` (48 px; `aria-invalid="true"` lo marca).

**Hoja inferior** (`.sheet-backdrop` + `.sheet`): se abre añadiendo `.is-open` a ambos. Al abrir hay que enfocar la hoja, bloquear el fondo (`html.no-scroll`), cerrar con Escape o tocando el fondo, y devolver el foco al botón que la abrió (ejemplo completo en `demo.js`; la versión reutilizable es la 0.5). Respeta la zona segura inferior y se desplaza por dentro si es alta (máx. 85 % de la pantalla).

**Avisos temporales** (`.toast-stack` > `.toast`): `--success`, `--danger`; el significado va también en un icono (✓ i !), no solo en el color. Quedan sobre la navegación inferior (`--nav-h`). Usa `role="status"`, o `role="alert"` para errores.

**Utilidades:** `.stack` (columna; `--sm`, `--lg`) · `.row` (fila que envuelve; `--sm`) · `.container` · `.grow` · `.safe-top` / `.safe-bottom` · `.sr-only` · `.text-muted`, `.text-sm`, `.text-xs`, `.text-accent`, `.text-success`, `.text-danger`, `.text-strong`.

## 6. Reglas (obligatorias para 0.4 en adelante)

1. **Colores solo con `var(--…)`.** Ni `#fff` ni `rgba()` fuera de `themes.css` (lo comprueba `tests/design.test.mjs`).
2. **Nunca `style="…"`, `<style>` ni scripts en línea en el HTML**: la CSP de 8.16 (`default-src 'self'`) los bloquea. Los valores dinámicos se fijan desde JS con `elemento.style.setProperty('--variable', valor)`, que sí está permitido.
3. **Objetivos táctiles ≥ 44 px** (`min-height: var(--touch-min)`). Los iconos solos llevan `aria-label`.
4. **Tiempos y capas salen de los tokens** (`--dur-*`, `--z-*`). Con "reducir movimiento", `base.css` pone las duraciones en 0 ms.
5. **Sin `!important`**, con **una sola excepción documentada**: `[hidden] { display: none !important }` en `base.css`, para que el atributo `hidden` gane siempre a clases que fijan `display` (`.btn`, `.badge`…).
6. **Sin fuentes ni recursos remotos** (`@import`, `@font-face`, `http(s)://`).
7. `:hover` solo dentro de `@media (hover: hover)`.
8. **Zona segura:** el `body` ya deja los laterales; lo fijo arriba/abajo suma `var(--safe-top)` / `var(--safe-bottom)`. El `<meta name="viewport">` lleva `viewport-fit=cover` y **no** `maximum-scale` ni `user-scalable=no`.
9. **Espaciado:** `.stack` y `.row` ponen la separación con `gap` (y `.stack` anula los márgenes de sus hijos). Se cambian con modificadores, **no** con una variable, porque las variables CSS se heredan y se filtrarían a los `.stack` anidados.

## 7. Contraste (WCAG AA)

Calculado con `tools/contrast.mjs` leyendo `themes.css` (`npm run contrast`; esta tabla sale de `node tools/contrast.mjs --markdown`). Los colores translúcidos se componen sobre el fondo real **y** sobre los dos resplandores del degradado (el peor caso). Cada texto se prueba sobre 12 fondos posibles (fondo, resplandores, hoja, vidrio y vidrio fuerte sobre cada uno). Se muestra el **peor caso** de cada grupo:

| Comprobación | Exigido | Aurora (peor caso) | Neo (peor caso) | Claro (peor caso) |
|---|---|---|---|---|
| Texto --text | ≥ 4,50:1 | 9,02:1 | 10,65:1 | 13,67:1 |
| Texto --text-muted | ≥ 4,50:1 | 4,65:1 | 5,27:1 | 6,15:1 |
| Texto --accent-text | ≥ 4,50:1 | 6,01:1 | 7,47:1 | 6,21:1 |
| Texto --accent-2-text | ≥ 4,50:1 | 5,42:1 | 4,85:1 | 5,59:1 |
| Texto --info-text | ≥ 4,50:1 | 4,58:1 | 4,68:1 | 5,95:1 |
| Texto --success-text | ≥ 4,50:1 | 5,10:1 | 8,63:1 | 6,04:1 |
| Texto --danger-text | ≥ 4,50:1 | 4,81:1 | 4,62:1 | 6,30:1 |
| Texto --on-accent sobre relleno | ≥ 4,50:1 | 11,24:1 | 12,24:1 | 6,29:1 |
| Texto --on-accent-2 sobre relleno | ≥ 4,50:1 | 4,63:1 | 5,43:1 | 5,70:1 |
| Texto --on-info sobre relleno | ≥ 4,50:1 | 8,84:1 | 7,99:1 | 5,93:1 |
| Texto --on-success sobre relleno | ≥ 4,50:1 | 7,46:1 | 14,28:1 | 5,48:1 |
| Texto --on-danger sobre relleno | ≥ 4,50:1 | 6,08:1 | 6,10:1 | 6,29:1 |
| Texto --callout-text sobre relleno | ≥ 4,50:1 | 12,48:1 | 13,35:1 | 11,56:1 |
| Texto deshabilitado (legible, no exigido por AA) | ≥ 3,00:1 | 4,55:1 | 4,99:1 | 3,79:1 |
| Borde de campo (no texto) | ≥ 3,00:1 | 3,87:1 | 4,09:1 | 3,48:1 |
| Anillo de foco (no texto) | ≥ 3,00:1 | 8,42:1 | 12,79:1 | 5,27:1 |
| Barra de progreso (no texto) | ≥ 3,00:1 | 5,50:1 | 5,20:1 | 5,12:1 |
| Interruptor encendido (no texto) | ≥ 3,00:1 | 8,62:1 | 10,35:1 | 4,94:1 |

El texto normal exige 4,5:1; lo que no es texto (bordes de campo, anillo de foco, barras), 3:1. El texto deshabilitado no está obligado por AA; aun así se exige 3:1. `tests/design.test.mjs` falla si algún valor baja del mínimo.

## 8. Capturas descritas (360 px)

- **Aurora:** fondo azul noche con un resplandor morado arriba a la izquierda y azul abajo a la derecha. Botón primario ámbar con texto casi negro; tarjetas de vidrio con borde fino claro; insignia "New" rosa-roja; caja de gramática dorada con texto oscuro; barras ámbar, lila, celeste y verde.
- **Neo:** casi negro con resplandores magenta (arriba a la derecha) y cian (abajo a la izquierda). Primario cian; acento 2 magenta; verde neón para "éxito".
- **Claro:** lavanda muy clara con degradado suave; tarjetas blancas translúcidas; primario índigo con texto blanco; bordes de campo gris azulado bien visibles; caja dorada amarillo pálido.
- **Hoja inferior:** sube desde abajo con esquinas superiores de 30 px, una pequeña barra de arrastre, título, botón de cerrar (✕) y botón "Entendido" a todo el ancho; el fondo se oscurece.
- **Avisos:** tarjetas sólidas con una franja de color a la izquierda (azul, verde, rojo) y un icono (i, ✓, !), apiladas sobre la zona de la navegación inferior (máximo 3 en la galería).

## 9. Cómo se verificó (0.3)

- 28 pruebas en `tests/design.test.mjs` (tokens, temas, contraste, reglas de los CSS, galería). Se comprobó su sensibilidad con 12 defectos provocados a propósito (color a mano, variable con errata, `!important` extra, URL remota, `:hover` fuera de media, contraste malo, botón < 44 px, tema incompleto, `style=""`, clase inexistente, tiempo fijo, icono sin `aria-label`): los 12 hacen fallar la suite.
- Navegador headless (Chromium 141) con la CSP de 8.16 puesta: galería a 360 × 640 y 412 × 915 en los 3 temas, sin desbordes horizontales, ningún objetivo táctil < 44 px, sin errores de consola; hoja y avisos probados; cambio de tema en vivo, movimiento reducido, letra al 150 % y 200 %.
- Lo que solo confirma el teléfono real: ver `tests/scenarios/0.3.md`.

## 10. Lo que NO está aquí (llega después)

Navegación inferior (0.4) · componentes reutilizables en JS: modal, cola de avisos, hoja con foco atrapado… (0.5) · mascota original y fondo temático de la sesión (0.5/2.1) · colores del estado de dominio por rangos (3.1) · íconos de la app (0.6).

Verificación visual opcional y reutilizable: `python3 tools/visual-check.py [página]` (Chromium sin interfaz con la CSP puesta; no forma parte de `npm run check`).

## 11. Estructura de la app y navegación inferior (0.4)

- **`.app-shell` > `main.app-main#view` + `nav.bottom-nav`.** `.app-main` deja espacio abajo para la barra (`--nav-h` + zona segura) y arriba para la zona segura; la columna se centra a `--content-max`.
- **`.bottom-nav`** (fija, `--z-nav`, fondo **sólido** `--surface-solid` para legibilidad sobre cualquier contenido): 5 enlaces `.bottom-nav__item` de 64 px de alto, icono SVG (`aria-hidden`) + etiqueta de 12 px. La activa (`aria-current="page"`, `.is-active`) usa `--accent-text`, negrita y una barra superior: no depende solo del color. A letra del sistema muy grande (200 %) la etiqueta se acorta con "…" (el nombre accesible sigue completo).
- **Avisos** (`.toast-stack`) quedan justo encima de la barra. **Pantalla de error** (`.error-screen`) y **404** usan `.card` y `.btn`.

## 12. Biblioteca de componentes (0.5)

Todo se importa de `ui/components/index.js`. Contrato común: `createX({ …opciones, doc?, win?, timers?, now? }) → { el, …métodos, destroy() }`. Los textos entran **siempre como texto** (nunca HTML); `destroy()` es idempotente y no deja listeners; props inválidas lanzan `TypeError` en español. Estilos en `ui/styles/widgets.css`. Galería real: `demo.html` (sección "Biblioteca"; hay que servirla con `python3 -m http.server`).

| Componente | Uso mínimo | Notas |
|---|---|---|
| `createButton` | `createButton({ label: 'Comprobar', variant: 'primary', onClick })` | `variant`: primary·secondary·danger·ghost; `loading`, `lockMs` (anti doble toque), `busyWhilePending`; solo icono → `ariaLabel` + `icon` |
| `createChip` | `createChip({ label: 'A2', onChange })` | elegible (`aria-pressed`) o de acción (`selectable:false`, `onPress`); `truncate` |
| `createBadge` | `createBadge({ kind: 'level', level: 3, onHelp })` | level (1–5, "?" opcional) · new · review · success · info · accent |
| `createCard` | `createCard({ title, children, onPress })` | `onPress` → `role=button` + Enter/Espacio; `href` → `<a>`; `loading` (esqueleto), `setError` |
| `createSheet` | `const s = createSheet({ title, children }); s.open()` | arrastre desde el asa, Esc, fondo, botón; foco atrapado y devuelto; toque de fondo ignorado 300 ms tras abrir |
| `createModal` | `await createModal({ title, message }).open()` → boolean | `role=alertdialog`; `danger` enfoca "Cancelar" |
| `createConfirmDanger` | `await createConfirmDanger({ title, message }).open()` | exige escribir `BORRAR` (configurable); para 0.8 |
| `createProgressBar` | `createProgressBar({ label, current: 7, total: 20, showText: true, mascot })` | pasos o valor; `indeterminate`; ranura de mascota |
| `createMascot` | `createMascot({ state: 'happy', size: 'md' })` | "Chispa", SVG original; neutral·happy·thinking; quieta con `prefers-reduced-motion` |
| `createTabs` | `createTabs({ label, tabs: [{ id, label, panel }] })` | ARIA tablist, flechas/Inicio/Fin, paneles perezosos |
| `createSegmented` | `createSegmented({ label, options, value, onChange })` | radiogroup, salta opciones deshabilitadas |
| `createToggle` | `createToggle({ label, description, checked, onChange })` | `role=switch`; fila entera táctil |
| `createSlider` | `createSlider({ label, min, max, step, unit })` o `stops: [{ value, label }]` | `<input type=range>` nativo; `getValue()` real |
| `createTextInput` | `createTextInput({ label, mode: 'exercise', onSubmit })` | `exercise` apaga autocorrección/mayúsculas; error con `aria-describedby` |
| `createEmptyState` | `createEmptyState({ title, message, actionLabel, onAction })` | invitación a actuar, sin tono de error |
| `createSkeleton` | `createSkeleton({ variant: 'card', lines: 3 })` | `role=status`; se apaga con movimiento reducido |
| `createWordChip` | `createWordChip({ word: 'since', state: 'selected', onPress })` | ficha ≥ 44 px; estados default·selected·used·correct·wrong; `knowledge` unknown·learning·known |
| `createWordDiff` | `createWordDiff({ words: ['I', { text: 'leaved', status: 'wrong' }] })` | verde/ámbar/rojo/falta + subrayado distinto + texto para lector |

### Matriz de estados
Se cumple donde tiene sentido; lo que no aplica se dice aquí (no se inventa).

| Estado | Dónde |
|---|---|
| normal · foco · pulsado | todos los interactivos (`:focus-visible` de `base.css`; `:active` en CSS; `:hover` solo con puntero) |
| deshabilitado | button, chip, card, toggle, slider, segmented, textInput, wordChip (`used`) |
| cargando | button (`aria-busy`, ignora toques), card (esqueleto), toggle, textInput (solo lectura), progressBar (`indeterminate`) |
| error | textInput, slider, toggle, segmented, card, progressBar (mensaje o variante visible y anunciada). En button el "error" es la variante `danger` |

### Reglas para quien use la biblioteca
1. Respuestas de ejercicio → `createTextInput({ mode: 'exercise' })` (sin autocorrección).
2. Confirmar salir/borrar → `createModal` / `createConfirmDanger`; nunca `confirm()`.
3. El color nunca es la única señal (`wordDiff`, `wordChip` y `badge` añaden texto, forma o subrayado).
4. Un componente creado en una vista se destruye en `ctx.cleanup(() => c.destroy())` (0.4).
5. Los colores nuevos van en `themes.css` (3 temas) y en `tools/contrast.mjs`.

## 13. Cómo se verificó (0.5)
`tests/ui-components.test.mjs` (DOM falso: foco, teclado, Esc, listeners, textos largos y con `<img onerror>`), 16 mutaciones provocadas (15 detectadas; la restante es equivalente), `tools/visual-check.py` sobre la galería en 360 y 412 px × 3 temas (sin desbordes, objetivos ≥ 44 px, sin errores de consola bajo la CSP).

**Aviso de actualización (0.6B):** `createUpdateNotice({ container })` en `ui/components/updateNotice.js`. Usa `.toast.toast--info.update-notice`, `role="status"`, no se cierra solo y lleva botones reales ("Ahora no" ghost + "Actualizar" primary). Para avisos pasajeros sigue siendo `createToaster`.
