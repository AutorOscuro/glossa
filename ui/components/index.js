// Biblioteca de componentes UI (subparte 0.5). Un solo punto de importación:
//   import { createButton, createSheet, … } from '../components/index.js';
// Cada componente también se puede importar por separado (ui/components/<nombre>.js).
// Contrato común: createX({ …opciones, doc?, win?, timers?, now? }) → { el, …métodos, destroy() }.
// Props inválidas lanzan TypeError en español; destroy() es idempotente y no deja listeners ni temporizadores.
export { createButton } from './button.js';
export { createChip } from './chip.js';
export { createBadge } from './badge.js';
export { createCard } from './card.js';
export { createSheet, dragDecision, DRAG } from './sheet.js';
export { createModal } from './modal.js';
export { createConfirmDanger } from './confirmDanger.js';
export { createProgressBar } from './progressBar.js';
export { createMascot, MASCOT_STATES } from './mascot.js';
export { createTabs } from './tabs.js';
export { createSegmented } from './segmented.js';
export { createToggle } from './toggle.js';
export { createSlider, clampValue, snapValue } from './slider.js';
export { createTextInput } from './textInput.js';
export { createEmptyState } from './emptyState.js';
export { createSkeleton } from './skeleton.js';
export { createWordChip, WORD_STATES, WORD_KNOWLEDGE } from './wordChip.js';
export { createWordDiff, normalizeDiffWords, DIFF_STATUSES } from './wordDiff.js';
// Ya existentes de la 0.4 (firmas sin cambios):
export { createToaster } from './toast.js';
// Añadido en 0.6B:
export { createUpdateNotice } from './updateNotice.js';
// Añadido en 0.8 (cuarto 2):
export { createKeyField } from './keyField.js';
