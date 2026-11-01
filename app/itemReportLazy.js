// @purpose: Arma el reporte local de ítems (core/itemReport.js) cuando los servicios de estudio ya existen; es lo que el registro de ejercicios entrega como ctx.report.
// lazyItemReport(getStudy) → función () => createItemReport | null. Sin `services.study` o sin base devuelve null (el feedback sale sin menú «⋯»). Reutiliza el mismo objeto mientras `study` no cambie.
import { createItemReport } from '../core/itemReport.js';

export function lazyItemReport(getStudy) {
  let made = null;
  let madeFor = null;
  return () => {
    const study = typeof getStudy === 'function' ? getStudy() : null;
    if (!study || !study.db) return null;
    if (madeFor !== study) {
      made = createItemReport({ db: study.db, clock: study.clock });
      madeFor = study;
    }
    return made;
  };
}
