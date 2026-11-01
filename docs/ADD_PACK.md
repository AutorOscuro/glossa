# Agregar un paquete de contenido

Necesitas **Node 20 o más** instalado y el repo descomprimido. Es la única forma de meter contenido: nadie edita `content/index.json` a mano.

## Pasos

1. Descomprime el zip del chat de Contenido en una carpeta (por ejemplo `lote1`).
2. Prueba primero sin escribir nada: `npm run add-pack -- --dry-run lote1`
3. Si sale bien, instala de verdad: `npm run add-pack -- lote1`
4. Sube el número de versión en `core/version.js` (y en `package.json`) y ejecuta: `npm run build`
5. Sube los cambios a GitHub (guía: `docs/DEPLOY.md`). Abre la app: el contenido nuevo aparece al actualizar.
6. Para volver atrás, restaura el commit anterior (`git revert <commit>`) o borra el paquete con `git rm content/packs/<pack_id>.json` y vuelve a ejecutar `npm run build`.

El comando valida **todo** antes de escribir. Si hay un solo error, **no escribe nada**. Puedes repetirlo las veces que quieras: si nada cambió, dice que no había nada que hacer.

## Qué significan los mensajes

- `✔ sample_pack_v1 — nuevo (v1)` y `content/index.json: creado`: el paquete se instaló. Salida 0.
- `= sample_pack_v1 — sin cambios`: ya estaba instalado igual. No se tocó nada. Salida 0.
- `✔ sample_pack_v1 — reemplaza (v1 → v2; …)`: versión mayor; los ítems que ya no están quedarán retirados al importar, sin perder tu progreso. Salida 0.
- `⚠ … TOPIC_FEW_ITEMS`: **aviso**. El tema tiene pocos ítems; es normal en lotes parciales. No impide instalar.
- `✘ … items[0].accept: …`: **error** de contenido, con la ruta exacta (`items[0].accept`). No se escribió nada; corrige ese punto en el paquete (o pide al chat de Contenido que lo corrija) y repite. Salida 1.

## Los 5 errores más comunes

1. **`VERSION_SAME_DIFFERENT`** («ya está instalado … con contenido distinto»): cambiaste el paquete sin subir su `version`. Sube `version` en el archivo.
2. **`VERSION_LOWER`**: intentas instalar una versión más vieja que la instalada. Usa el archivo más nuevo.
3. **`DUPLICATE_INSTALLED`**: un id de ítem ya lo usa otro paquete instalado. Los ids no se reutilizan; usa ids nuevos.
4. **`UNKNOWN_TOPIC` / `UNKNOWN_CODE`**: el paquete usa un tema o un código de error que no está en `content/taxonomy/`. Revisa el nombre o pide añadirlo a la taxonomía.
5. **`JSON_INVALID`** o «No encontré ningún paquete»: el archivo está dañado, o la carpeta no tiene `.json` de paquete (los informes se ignoran avisando). Vuelve a descomprimir el zip.

Ayuda completa: `npm run add-pack -- --help`.
