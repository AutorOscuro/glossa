// @purpose: Arma la nota «¿por qué lo pensaste?» (core/whyNote.js) cuando los servicios de estudio ya existen; es lo que el registro entrega como ctx.why.
// lazyWhyNote(getStudy) → función () => createWhyNote | null. Sin `services.study` o sin registro de eventos devuelve null (el feedback sale sin ese botón). Reutiliza el objeto mientras `study` no cambie.
import { createWhyNote } from '../core/whyNote.js';

export function lazyWhyNote(getStudy) {
  let made = null;
  let madeFor = null;
  return () => {
    const study = typeof getStudy === 'function' ? getStudy() : null;
    if (!study || !study.events || typeof study.events.log !== 'function') return null;
    if (madeFor !== study) {
      made = createWhyNote({ events: study.events });
      madeFor = study;
    }
    return made;
  };
}
