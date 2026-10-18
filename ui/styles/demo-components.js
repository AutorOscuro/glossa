// Galería de la biblioteca de componentes (subparte 0.5). Solo inspección visual; no es parte de la app.
// Módulo ES (la CSP permite scripts del mismo origen); monta componentes REALES en #lib.
import { h } from '../dom.js';
import * as ui from '../components/index.js';

const lib = document.getElementById('lib');
const group = (title, ...nodes) => lib.appendChild(h('div', { class: 'stack stack--sm' }, h('h3', {}, title), ...nodes));
const toaster = ui.createToaster({ container: document.querySelector('.toast-stack') ?? lib });
const toast = (kind, text) => toaster.show(kind, text);

group('Botones y estados',
  h('div', { class: 'row row--sm' },
    ui.createButton({ label: 'Comprobar', variant: 'primary' }).el,
    ui.createButton({ label: 'Cargando', variant: 'primary', loading: true }).el,
    ui.createButton({ label: 'Borrar', variant: 'danger' }).el,
    ui.createButton({ label: 'No disponible', disabled: true }).el,
    ui.createButton({ ariaLabel: 'Ajustes', icon: '⚙', variant: 'ghost' }).el));

group('Chips, insignias y chips de palabra',
  h('div', { class: 'chip-group' }, ui.createChip({ label: 'A2', selected: true }).el, ui.createChip({ label: 'Gramática' }).el,
    ui.createChip({ label: 'Un texto bastante largo que se recorta con puntos suspensivos', truncate: true }).el),
  h('div', { class: 'row row--sm' }, ui.createBadge({ kind: 'level', level: 3, onHelp: () => toast('info', 'El nivel sale de la estabilidad del repaso.') }).el,
    ui.createBadge({ kind: 'new' }).el, ui.createBadge({ kind: 'review', text: 'Repaso en 4 sems' }).el),
  h('div', { class: 'row row--sm' }, ...['default', 'selected', 'used', 'correct', 'wrong'].map((st) => ui.createWordChip({ word: st === 'default' ? 'since' : st, state: st }).el),
    ui.createWordChip({ word: 'ceiling', knowledge: 'unknown' }).el, ui.createWordChip({ word: 'scarf', knowledge: 'learning' }).el));

const mascots = ['neutral', 'happy', 'thinking'].map((state) => ui.createMascot({ state, size: 'lg', label: `Chispa, ${state}` }));
const bar = ui.createProgressBar({ label: 'Progreso de la sesión', current: 7, total: 20, showText: true, mascot: ui.createMascot({ state: 'happy', size: 'sm' }).el });
group('Mascota y progreso', h('div', { class: 'row' }, ...mascots.map((m) => m.el)), bar.el,
  ui.createProgressBar({ label: 'Cargando datos', indeterminate: true, thin: true }).el);

group('Tarjeta, esqueleto y estado vacío',
  ui.createCard({ title: 'Present perfect con for y since', meta: 'Nivel A2', children: ['Toca para abrir el tema.'], onPress: () => toast('success', 'Tarjeta tocada') }).el,
  ui.createCard({ title: 'Cargando tarjeta', loading: true }).el,
  ui.createCard({ title: 'Con error', error: 'No se pudo cargar. Reintenta.', children: ['Contenido conservado.'] }).el,
  ui.createSkeleton({ variant: 'card', lines: 2 }).el,
  ui.createEmptyState({ icon: '🌱', title: 'Aún no hay temas', message: 'Carga un paquete de contenido para empezar.', actionLabel: 'Cargar paquete', onAction: () => toast('info', 'Pronto') }).el);

const tabs = ui.createTabs({ label: 'Secciones de ejemplo', tabs: [
  { id: 'a', label: 'Regla', panel: 'Have/has + participio.' }, { id: 'b', label: 'Ejemplos', panel: () => 'I have lived here for two years.' }, { id: 'c', label: 'Errores', panel: 'since two years → for two years' }] });
group('Pestañas, segmentado, interruptor y deslizador', tabs.el,
  ui.createSegmented({ label: 'Tema', value: 'aurora', options: [{ value: 'aurora', label: 'Aurora' }, { value: 'neo', label: 'Neo' }, { value: 'claro', label: 'Claro' }] }).el,
  ui.createToggle({ label: 'Sonidos', description: 'Efectos suaves al responder.', checked: true }).el,
  ui.createToggle({ label: 'Con error', error: 'No se pudo guardar.' }).el,
  ui.createSlider({ label: 'Tiempo disponible hoy', stops: [15, 30, 45, 60, 90, 120].map((v) => ({ value: v, label: `${v} min` })), value: 45 }).el,
  ui.createSlider({ label: 'Retención objetivo', min: 80, max: 95, value: 90, unit: ' %', hint: 'Más alto = más repasos.' }).el);

group('Campos de texto',
  ui.createTextInput({ label: 'Tu respuesta (teclado de ejercicio)', mode: 'exercise', placeholder: 'Escribe en inglés', hint: 'Sin autocorrección.' }).el,
  ui.createTextInput({ label: 'Con error', value: 'since two years', error: 'Revisa esta parte.' }).el,
  ui.createTextInput({ label: 'Nota', multiline: true, optional: true }).el);

group('Corrección palabra por palabra',
  ui.createWordDiff({ showLegend: true, words: ['I', { text: 'leaved', status: 'wrong' }, { text: 'home', status: 'almost' }, 'at', { text: 'eight', status: 'missing' }] }).el);

const sheet = ui.createSheet({ title: 'Hoja con arrastre', children: [h('p', {}, 'Arrastra el asa hacia abajo, toca fuera o pulsa Esc.'), ui.createButton({ label: 'Entendido', variant: 'primary', block: true, onClick: () => sheet.close() }).el] });
const confirm = ui.createModal({ title: '¿Salir de la sesión?', message: 'Lo respondido ya está guardado.', confirmLabel: 'Salir' });
const danger = ui.createConfirmDanger({ title: 'Borrar todo', message: 'Se eliminan tus datos de este dispositivo.' });
const ask = (m, label) => async () => toast('info', `${label}: ${(await m.open()) ? 'confirmado' : 'cancelado'}`);
group('Hoja y modales',
  h('div', { class: 'row row--sm' }, ui.createButton({ label: 'Abrir hoja', onClick: () => sheet.open() }).el,
    ui.createButton({ label: 'Confirmar', onClick: ask(confirm, 'Salir') }).el, ui.createButton({ label: 'Peligro', variant: 'danger', onClick: ask(danger, 'Borrar') }).el));
