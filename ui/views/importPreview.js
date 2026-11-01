// @purpose: Texto en español de la vista previa de importar un respaldo (fusionar o reemplazar), a partir de `sync.previewBackup`; sin DOM.
// Vista previa de importar un respaldo (subparte 2.9-T3, punto 3). Puro: recibe lo que devuelve `sync.previewBackup(text, { mode })` y devuelve frases.
//   importSummary(preview) → texto con lo que pasará (añadidos, actualizados y, al reemplazar, los que se pierden). Nunca lanza.
//   IMPORT_MODES → [{ value: 'merge', label: 'Fusionar' }, { value: 'replace', label: 'Reemplazar' }]
export const IMPORT_MODES = Object.freeze([
  Object.freeze({ value: 'merge', label: 'Fusionar' }),
  Object.freeze({ value: 'replace', label: 'Reemplazar' }),
]);

const count = (n) => `${n} ${n === 1 ? 'dato' : 'datos'}`;
const num = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

export function importSummary(preview) {
  const t = preview?.totals ?? {};
  const added = num(t.added); const changed = num(t.overwritten); const same = num(t.unchanged); const removed = num(t.removed);
  const parts = [];
  if (added) parts.push(`se añadirá${added === 1 ? '' : 'n'} ${count(added)} ${added === 1 ? 'nuevo' : 'nuevos'}`);
  if (changed) parts.push(`se actualizará${changed === 1 ? '' : 'n'} ${count(changed)}`);
  const head = parts.length ? `${parts.join(' y ')}.` : 'no hay nada nuevo que añadir ni actualizar.';
  const same2 = same ? ` ${same === 1 ? 'Ya tienes 1 dato idéntico' : `Ya tienes ${same} datos idénticos`}.` : '';
  const cap = head.charAt(0).toUpperCase() + head.slice(1);
  if (preview?.mode === 'replace') {
    const lost = removed ? ` Se perderán ${count(removed)} que el archivo no trae.` : ' No se pierde nada de lo que tienes.';
    return `${cap}${same2}${lost} Tus claves de este dispositivo se conservan.`;
  }
  return `${cap}${same2} No se quita nada de lo que tienes. Tus claves de este dispositivo se conservan.`;
}
