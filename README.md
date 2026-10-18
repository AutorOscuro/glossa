# Sophia Inglés (nombre de trabajo)

App personal para aprender inglés: PWA en JavaScript vainilla (módulos ES), sin bundler, que se publica como archivos estáticos en GitHub Pages. Repaso espaciado (FSRS), sesiones de práctica, mapa de temas, errores y estadísticas. **Sin rachas obligatorias y sin culpa.**

> El plan completo está en [`docs/ROADMAP.md`](docs/ROADMAP.md). El estado actual, en [`PROJECT_STATE.md`](PROJECT_STATE.md).

## Correr la app en local

Aún no hay pantallas (están en la subparte 0.4). Cuando existan, desde la raíz del repo:

```bash
python3 -m http.server 8080
# o bien
npx serve
```

y abre `http://localhost:8080` (la app; `?tema=neo` o `?tema=claro` para forzar un tema). (Los módulos ES no funcionan abriendo `index.html` con doble clic: hace falta un servidor.)

## Publicar y modo sin conexión

La guía paso a paso para publicar en GitHub Pages está en [`docs/DEPLOY.md`](docs/DEPLOY.md). En `localhost` el service worker está apagado a propósito (`?sw=on` lo enciende, `?sw=off` lo apaga). Tras tocar archivos de la app: `npm run build` y luego `npm run check`.

## Correr las pruebas y la auditoría

Requiere Node.js 20 o superior. No hay dependencias que instalar.

```bash
npm run check                    # estructura + auditoría + pruebas (el comando de siempre)

npm test                         # solo pruebas  (= node --test, descubre los *.test.mjs)
npm run audit                    # solo auditoría estática
npm run contrast                 # contraste WCAG de los 3 temas
node tools/check-structure.mjs   # solo estructura
```

Si no tienes `npm`, usa directamente `node tools/check-structure.mjs && node tools/audit.mjs && node --test`.

## Ver el sistema de diseño

Con el servidor local en marcha, abre `http://localhost:8080/ui/styles/demo.html` (galería de componentes; `?tema=neo` o `?tema=claro` para forzar un tema). Guía: `docs/DESIGN.md`.

## Mapa del repo

| Carpeta / archivo | Qué hay |
|---|---|
| `app/` | arranque, router, configuración (sin claves) |
| `core/` | lógica pura (sin DOM): SRS, calificación, dominio, sesiones, IA… |
| `ui/` | componentes, vistas, ejercicios y estilos |
| `content/` | taxonomía y paquetes de contenido |
| `audio/`, `vendor/`, `icons/` | audio pregenerado, librerías de terceros con su licencia, íconos |
| `tools/`, `tests/` | scripts de Node y pruebas |
| `docs/` | `ROADMAP.md`, `CONTRACTS.md`, `DESIGN.md`, `DEPLOY.md` (cómo publicar en GitHub Pages; luego `ADD_PACK.md`) |
| `PROJECT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md` | estado vivo del proyecto |

## Reglas que no se negocian

- Las claves de API **nunca** van en el código: se escriben en Ajustes y se guardan solo en el dispositivo.
- Todo el contenido es **original** (nada copiado de películas, series, canciones, libros ni cursos de pago).
- Los contratos de `docs/CONTRACTS.md` están congelados; solo el Administrador los cambia.
