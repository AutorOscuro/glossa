# Cómo publicar Glossa (guía para William)

Esta guía no necesita conocimientos previos. Tiempo: unos 30 minutos la primera vez. Después, actualizar tarda 5 minutos.

**Qué vas a lograr:** que la app tenga una dirección web (`https://TU-USUARIO.github.io/glossa/`; la de William es `https://autoroscuro.github.io/glossa/`), que la abras en el Chrome de tu Android y la instales como una app más, y que funcione sin conexión.

> Todo lo que subes es gratis. Tus respuestas y tu progreso **NO** se suben a ningún sitio: se guardan solo en tu teléfono.

---

## Parte 1 — Primera publicación

### 1. Crea tu cuenta y el repositorio
1. Entra a <https://github.com> y crea una cuenta (si ya tienes, inicia sesión).
2. Arriba a la derecha toca **+** → **New repository**.
3. En **Repository name** escribe `glossa` (en minúsculas, sin espacios).
4. Deja marcado **Public** (GitHub Pages gratis lo necesita).
5. **No** marques "Add a README". Toca **Create repository**.

### 2. Prepara los archivos en tu PC
1. Descomprime el zip que te dio el chat (por ejemplo `sophia-ingles_0.6_….zip`). Te queda una carpeta `sophia-ingles` (es el nombre de trabajo del proyecto, solo por dentro del zip; la app se llama Glossa y tu repositorio se llama `glossa`).
2. **Importante:** sube el **contenido** de esa carpeta (`index.html`, `sw.js`, `app/`, `ui/`…), no el zip ni una carpeta extra por fuera. `index.html` debe quedar en la raíz del repositorio.
3. Si usas Windows y no ves el archivo `.nojekyll`, activa en el Explorador **Ver → Mostrar → Elementos ocultos**. Ese archivo es obligatorio (más abajo, "Si algo falla").

### 3. Sube los archivos (elige UNA forma)

**Forma A — GitHub Desktop (recomendada, sin límite de archivos):**
1. Instala GitHub Desktop desde <https://desktop.github.com> e inicia sesión.
2. **File → Clone repository** → elige `glossa` → elige una carpeta de tu PC.
3. Copia dentro de esa carpeta **todo el contenido** de la carpeta descomprimida (incluidos los archivos ocultos como `.nojekyll`).
4. En GitHub Desktop verás la lista de cambios. Abajo escribe `Primera publicación` y toca **Commit to main**.
5. Toca **Push origin**.

**Forma B — Desde el navegador (hay un límite de 100 archivos por vez):** el proyecto tiene más de 100 archivos, así que hazlo en tandas.
1. En tu repositorio toca **uploading an existing file** (o **Add file → Upload files**).
2. Arrastra primero **solo estas carpetas y archivos**: `app`, `core`, `ui`, `icons`, `content`, `audio`, `vendor`, `index.html`, `sw.js`, `manifest.webmanifest`, `asset-manifest.json`, `.nojekyll`. Espera a que termine de cargar y toca **Commit changes**.
3. Repite con el resto: `docs`, `tests`, `tools` y los archivos sueltos (`README.md`, `package.json`…). Si una tanda pasa de 100 archivos, divídela (por ejemplo, `tests` aparte).
4. Comprueba al final que en la lista del repositorio ves todas las carpetas y que `index.html` está arriba, no dentro de otra carpeta.

### 4. Activa GitHub Pages
1. En tu repositorio toca **Settings** (Configuración).
2. En el menú de la izquierda toca **Pages**.
3. En **Source** elige **Deploy from a branch**.
4. En **Branch** elige `main` y la carpeta `/ (root)`. Toca **Save**.
5. Espera 1 o 2 minutos y recarga esa página: arriba aparecerá "Your site is live at …". Esa es tu dirección.

### 5. Ábrela en tu Android e instálala
1. En el Chrome del teléfono abre tu dirección. La primera vez debes tener internet.
2. Debes ver "Cargando…" y enseguida la pantalla **Hoy** con las 5 pestañas de abajo. Unos segundos después puede salir el aviso **"Lista para usar sin conexión."**
3. Toca los tres puntos de Chrome (⋮) → **Instalar app** (o **Añadir a pantalla de inicio**). Confirma.
4. Busca el icono de Glossa (la mascota Chispa) en tu pantalla de inicio y ábrelo desde ahí: se abre a pantalla completa, como una app.

### 6. Prueba el modo sin conexión
1. Con la app ya abierta una vez, activa el **modo avión**.
2. Cierra la app del todo y ábrela otra vez desde el icono.
3. Debe abrir y dejarte moverte por las pestañas. Si es así, ¡listo!

---

## Parte 2 — Cómo actualizar la app

Cada vez que el chat te dé un zip nuevo:
1. Descomprímelo y **sustituye** los archivos en tu repositorio (GitHub Desktop: copia encima y haz Commit + Push; navegador: sube los archivos y confirma). Sube **todo lo que cambió**, y en particular `asset-manifest.json` y `sw.js` **juntos**: si subes uno sin el otro, la actualización se rechaza a propósito y sigues con la versión buena.
2. Espera 1 o 2 minutos a que GitHub publique.
3. Abre la app en el teléfono **con internet**. En segundo plano descarga la versión nueva.
4. Cuando termine verás un aviso: **"Hay una actualización disponible."** Toca **Actualizar**. La app se recarga una vez y ya tienes la versión nueva.
5. Si **no** quieres actualizar en ese momento (estás en medio de una práctica), toca **Ahora no**: la app **nunca** se recarga sola. El aviso vuelve a salir la próxima vez que la abras.
6. Si el aviso dice que se publicó una versión **más antigua**, casi seguro subiste archivos viejos por error. Toca **Ahora no** y vuelve a subir los archivos correctos.

Para comprobar qué versión tienes, mira "Acerca de" en Ajustes (tarjeta cerca del final de la pantalla) o pregúntale al chat.

---

## Si algo falla (en este orden)

1. **Pantalla en blanco o "No se pudo iniciar la app" y todo lo demás bien subido:** casi siempre falta el archivo `.nojekyll` en la raíz. Créalo: **Add file → Create new file**, escribe `.nojekyll` como nombre, escribe cualquier línea de texto y toca **Commit changes**. Espera 2 minutos y recarga.
2. **La dirección da "404":** revisa que `index.html` esté en la raíz del repositorio y que en Settings → Pages la rama sea `main` y la carpeta `/ (root)`.
3. **Subí una versión nueva y sigo viendo la vieja:**
   1. Cierra la app del todo (sácala de las apps recientes) y ábrela con internet. Espera 1 minuto.
   2. Si no sale el aviso, abre la dirección en una pestaña normal de Chrome (no la app instalada), espera unos segundos y recarga dos veces.
   3. Comprueba en GitHub que los archivos nuevos se ven (entra a `sw.js` y mira que la fecha es reciente) y que `sw.js` y `asset-manifest.json` se subieron juntos.
4. **Último recurso: borrar los datos del sitio** (Chrome → ⋮ → Configuración → Configuración de sitios → Todos los sitios → tu dirección → **Borrar datos**).
   > ⚠️ **Esto BORRA todo tu progreso** (repasos, errores, ajustes y claves guardadas). **Antes, exporta un respaldo** desde Ajustes → Exportar respaldo (disponible cuando el chat construya esa función) y guárdalo fuera del teléfono. Si todavía no existe, no lo hagas sin hablar antes con el chat.
5. Si nada funciona, dile al chat: qué paso hiciste, qué viste en pantalla y adjunta una captura.

---

## Para quien prueba en el PC (desarrollo)

- Servir en local: `python3 -m http.server 8080` y abrir `http://localhost:8080`.
- En `localhost` el modo sin conexión está **apagado** a propósito, y si quedó algo viejo registrado, se limpia solo al abrir. Así los cambios se ven al recargar.
- `?sw=off` lo apaga en cualquier dirección (útil para comprobar un problema) y `?sw=on` lo fuerza en `localhost` (para probar el modo sin conexión). Ejemplo: `http://localhost:8080/?sw=on`. Después de cambiar el parámetro, recarga la página una vez más.
- Después de tocar cualquier archivo de la app, ejecuta `npm run build` (regenera `asset-manifest.json` y el nombre de la caché en `sw.js`) y luego `npm run check`.
- Comprobación opcional en Chromium real: `python3 tools/pwa-check.py` (necesita Playwright).
