// @purpose: Bienvenida de 3 pantallas, saltable y repetible (nombre y chequeo de energía).
// Bienvenida (subparte 0.8, cuarto 4A). Vista independiente: la conecta al primer arranque y a Ajustes la mitad B.
//   · 3 pantallas, SALTABLE en cualquiera ("Saltar por ahora") y repetible: si ya hay nombre guardado, lo muestra.
//       1) bienvenida + nombre (opcional)  2) chequeo de energía (opcional)  3) "Sin rachas, sin culpa" + Empezar.
//   · Al terminar o saltar guarda de una vez { onboardingDone: true, userName } con settings.setMany (todo o nada) y va a "Hoy"
//     reemplazando la entrada del historial de la bienvenida ("Atrás" no regresa a una bienvenida ya hecha).
//     La energía, si se eligió, se guarda aparte en meta.energyCheck { key, value: 'low'|'mid'|'high', at }; si eso falla NO bloquea.
//   · Si guardar falla: se queda en la pantalla, muestra el texto amable en la tarjeta y deja los botones libres para reintentar.
//   · Nada de test inicial aquí (el test de entrada vive en la Fase 3). Los textos no presionan ni culpan.
import { h } from '../dom.js';
import { createView } from './_viewBase.js';
import { createButton, createCard, createMascot, createProgressBar, createSegmented, createTextInput } from '../components/index.js';

export const ONBOARDING_STEPS = 3;
export const ENERGY_KEY = 'energyCheck';
export const NAME_MAX = 40;

const GENERIC_ERROR = 'No se pudo guardar tu bienvenida. Inténtalo de nuevo.';
const ENERGY_OPTIONS = [{ value: 'low', label: 'Baja' }, { value: 'mid', label: 'Normal' }, { value: 'high', label: 'Alta' }];
const code = (e) => (typeof e?.code === 'string' ? e.code : 'desconocido');

export default createView(async (ctx) => {
  // app/main.js asigna los servicios justo después de arrancar el shell: se leen tras ceder un turno y, los que se usan más tarde
  // (navigate, clock), se leen en el momento de usarlos.
  await Promise.resolve();
  if (!ctx.alive()) return undefined;
  const page = h('section', { class: 'stack stack--lg view' });
  ctx.root.appendChild(page);
  const goHome = () => {
    // replace: la entrada de la bienvenida se sustituye por Hoy, así "Atrás" no vuelve a ella.
    try { ctx.services.navigate?.('hoy', undefined, { replace: true }); } catch (e) { console.error('Bienvenida: no se pudo ir a Hoy', e?.code); }
  };

  let settings = ctx.services.settings ?? null;
  let db = ctx.services.db ?? null;
  try {
    db = (await ctx.services.storageReady)?.db ?? db;
    if (!settings) settings = (await ctx.services.settingsReady)?.settings ?? ctx.services.settings ?? null;
  } catch (e) {
    console.error('Bienvenida: no se pudo esperar a que todo estuviera listo', code(e));
  }
  if (!ctx.alive()) return undefined;

  let comps = []; // componentes de la pantalla actual
  const own = (c) => { comps.push(c); return c; };
  const clearStep = () => { for (const c of comps) c.destroy(); comps = []; };
  ctx.cleanup(clearStep);

  if (!settings) {
    const go = own(createButton({ label: 'Ir a Hoy', variant: 'primary', block: true, onClick: goHome }));
    page.appendChild(h('h1', { class: 'view__title' }, 'Bienvenida'));
    page.appendChild(own(createCard({ title: 'No pudimos preparar la bienvenida', headingLevel: 2, children: [
      h('p', { class: 'text-sm text-muted' }, 'No pasa nada: puedes empezar igual y ver la bienvenida más tarde desde Ajustes.'), go.el,
    ] })).el);
    return undefined;
  }

  const state = { step: 1, name: settings.get('userName') ?? '', energy: null };
  let finishing = false;
  let nameField = null;
  let card = null;
  const box = h('div', { class: 'stack stack--lg' });
  page.appendChild(box);
  const setBusy = (b) => { for (const c of comps) c.setDisabled?.(b); };
  const nowIso = () => (ctx.services.clock ? ctx.services.clock.now() : new Date()).toISOString();

  async function finish() {
    if (finishing) return;
    finishing = true;
    setBusy(true);
    card?.setError(null);
    try {
      const name = state.name.trim();
      const patch = { onboardingDone: true };
      if (name.length <= NAME_MAX) patch.userName = name; // un nombre demasiado largo no se guarda, pero no impide terminar
      await settings.setMany(patch);
      if (state.energy && db) {
        try {
          await db.put('meta', { key: ENERGY_KEY, value: state.energy, at: nowIso() });
        } catch (e) {
          console.error(`Bienvenida: no se pudo guardar la energía (código: ${code(e)})`);
        }
      }
      if (ctx.alive()) goHome();
    } catch (e) {
      console.error(`Bienvenida: no se pudo guardar (código: ${code(e)})`);
      if (ctx.alive()) card?.setError(typeof e?.friendly === 'string' && e.friendly ? e.friendly : GENERIC_ERROR);
    } finally {
      finishing = false;
      if (ctx.alive()) setBusy(false);
    }
  }

  function next() {
    if (state.step === 1) {
      if (state.name.trim().length > NAME_MAX) { nameField?.setError(`Usa ${NAME_MAX} letras o menos.`); return; }
      render(2);
    } else if (state.step === 2) render(3);
    else finish();
  }
  const back = () => render(state.step - 1);

  function render(step) {
    clearStep();
    box.replaceChildren();
    state.step = step;
    nameField = null;
    const button = (label, variant, onClick) => own(createButton({ label, variant, block: true, onClick })).el;
    const buttons = [button(step === 3 ? 'Empezar' : 'Siguiente', 'primary', next)];
    if (step > 1) buttons.push(button('Atrás', 'secondary', back));
    if (step < 3) buttons.push(button('Saltar por ahora', 'ghost', finish));

    const mascot = own(createMascot({ state: step === 2 ? 'thinking' : 'happy', size: 'lg' }));
    const heading = h('h1', { class: 'view__title', tabindex: '-1' }, [
      '¡Hola! Me alegra que estés aquí', '¿Cómo está tu energía hoy?', 'Sin rachas, sin culpa',
    ][step - 1]);
    let content;
    if (step === 1) {
      nameField = own(createTextInput({
        label: '¿Cómo quieres que te llame?', hint: 'Es opcional y se queda solo en este dispositivo.', optional: true,
        value: state.name, maxLength: NAME_MAX, mode: 'text', lang: 'es',
        onInput: (v) => { state.name = v; nameField.setError(null); },
        onSubmit: next,
      }));
      content = [
        h('p', {}, 'Glossa te acompaña a aprender inglés a tu ritmo, con repasos cortos y sin presión.'),
        nameField.el,
      ];
    } else if (step === 2) {
      const seg = own(createSegmented({ label: 'Tu energía hoy', options: ENERGY_OPTIONS, value: state.energy ?? undefined, onChange: (v) => { state.energy = v; } }));
      content = [
        h('p', {}, 'Si hoy vas con poca energía, la app te propone menos cosas. Responder es opcional: puedes seguir sin elegir.'),
        seg.el,
        h('p', { class: 'text-sm text-muted' }, 'Lo puedes cambiar cuando quieras.'),
      ];
    } else {
      const name = state.name.trim();
      content = [
        h('p', {}, name ? `${name}, así funciona esto:` : 'Así funciona esto:'),
        h('ul', { class: 'stack' },
          h('li', {}, 'No hay rachas que perder: si un día no puedes, no pasa nada.'),
          h('li', {}, 'Lo que toque repasar se acomoda solo, a tu ritmo.'),
          h('li', {}, 'Puedes pausar, cambiar ajustes o repetir esta bienvenida cuando quieras.')),
      ];
    }
    card = own(createCard({ children: [...content, h('div', { class: 'stack' }, ...buttons)] }));
    const progress = own(createProgressBar({ label: 'Progreso de la bienvenida', current: step, total: ONBOARDING_STEPS, text: `Paso ${step} de ${ONBOARDING_STEPS}`, showText: true, thin: true }));
    box.appendChild(h('div', { class: 'stack stack--lg' }, progress.el, mascot.el, heading, card.el));
    if (step > 1) heading.focus?.();
  }

  render(1);
  return undefined;
});
