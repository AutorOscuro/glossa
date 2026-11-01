// @purpose: Vista provisional de la pestaña Hoy (la sustituye la 3.4) con el botón «Estudiar ahora», que arma la sesión cuando el contenido está listo.
// Hoy (subparte 2.9-T3, punto 4). Hasta la 3.4 es un marcador con UN botón útil: «Estudiar ahora» → #/sesion/nueva (arma la sesión 1.8 con las tarjetas de la base).
//   · El botón espera a `services.contentReady` (la importación del paquete al arrancar) para no armar una sesión vacía en el primer arranque; mientras tanto dice «Preparando…».
//   · Si el contenido no se pudo preparar, el botón sigue disponible (la sesión explica con amabilidad qué falta) y debajo sale un aviso sin culpar a nadie.
import { h } from '../dom.js';
import { createView } from './_viewBase.js';
import { createButton } from '../components/index.js';

export const HOY_TEXT = {
  title: 'Hoy',
  lead: 'Aquí verás tu plan del día y tus repasos pendientes.',
  later: 'El plan completo llega en la subparte 3.4.',
  study: 'Estudiar ahora',
  preparing: 'Preparando…',
  failed: 'No pude preparar el contenido de estudio en este dispositivo. Puedes intentarlo igual; si no sale, cierra y abre la app.',
};

export default createView((ctx) => {
  const note = h('p', { class: 'text-sm text-muted', role: 'status' });
  const go = () => ctx.services.navigate?.('sesion', { id: 'nueva' });
  const btn = createButton({ label: HOY_TEXT.preparing, variant: 'primary', size: 'lg', block: true, onClick: go });
  btn.setDisabled(true);
  ctx.cleanup(() => btn.destroy());
  ctx.root.appendChild(
    h('section', { class: 'stack stack--lg view' },
      h('h1', { class: 'view__title' }, HOY_TEXT.title),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, HOY_TEXT.lead),
        h('p', { class: 'text-sm text-muted' }, HOY_TEXT.later),
      ),
      btn.el,
      note,
    ),
  );
  // La vista se monta al instante (sin esperar): el botón se activa cuando el contenido está listo, si la vista sigue viva.
  Promise.resolve(ctx.services.contentReady).catch(() => null).then((res) => {
    if (!ctx.alive()) return;
    btn.setLabel(HOY_TEXT.study);
    btn.setDisabled(false);
    if (res && res.ok === false) note.textContent = HOY_TEXT.failed;
  });
});
