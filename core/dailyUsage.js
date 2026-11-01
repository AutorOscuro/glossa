// @purpose: Cuenta lo que ya se estudió hoy (tarjetas nuevas, repasos y práctica extra, por día local) desde los eventos, para descontarlo de los topes diarios del armador.
// Uso diario (subparte 2.1, tramo 2). Roadmap 2.1-T2 y 8.6. Puro salvo por las consultas de lectura a `events`; no escribe nada.
//
//   countToday({ events, now }) → Promesa { day, newToday, reviewsToday, practiceToday }
//     events  createEvents(...) o su versión envuelta (solo se usan `since` y `byCard`).   now  Date | ms | ISO.
//     Mira los eventos `answer` con `cardId` cuyo `day` (día LOCAL) es el de `now`. Cuenta TARJETAS distintas, no respuestas:
//       · newToday       tarjetas cuya PRIMERA respuesta de toda la historia fue hoy (se introdujeron hoy).
//       · reviewsToday   tarjetas ya conocidas (su primera respuesta fue antes de hoy) con AL MENOS una respuesta de hoy a tiempo (sin `early`).
//                        Es lo único que gasta el tope `dailyReviewCap`: protege de la sobrecarga de repasos vencidos.
//       · practiceToday  tarjetas ya conocidas cuyas respuestas de hoy fueron TODAS adelantadas (`early: true`, la tarjeta aún no vencía):
//                        práctica extra voluntaria. NO gasta el tope. Sigue siendo actividad del día para estadísticas y dominio,
//                        porque esos módulos leen los eventos y no este conteo.
//     Una tarjeta nueva respondida tres veces hoy cuenta 1 en newToday y 0 en las demás (aunque la repita y su repetición salga adelantada).
//     Una tarjeta conocida que se repasó a tiempo y luego se practicó otra vez hoy cuenta como repaso, no como práctica. Sin respuestas hoy: { 0, 0, 0 }.
//     Los eventos antiguos no traen `early`: cuentan como a tiempo (el conteo de antes no cambia).
//     Coste: una lectura por `since(medianoche local)` y una `byCard` por tarjeta distinta de hoy. Si la base falla, rechaza con su DbError.
import { toDate, localDay } from './clock.js';

export async function countToday({ events, now } = {}) {
  if (!events || typeof events.since !== 'function' || typeof events.byCard !== 'function') throw new Error('countToday: faltan events.since y events.byCard');
  const nowDate = toDate(now);
  const day = localDay(nowDate);
  const midnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const todays = (await events.since(midnight)).filter((e) => e.type === 'answer' && typeof e.cardId === 'string' && e.cardId !== '' && e.day === day);
  const onTime = new Map(); // cardId → true si alguna respuesta de hoy fue a tiempo
  for (const e of todays) onTime.set(e.cardId, onTime.get(e.cardId) === true || e.early !== true);
  let newToday = 0; let reviewsToday = 0; let practiceToday = 0;
  for (const [cardId, hadOnTime] of onTime) {
    const history = (await events.byCard(cardId)).filter((e) => e.type === 'answer');
    const firstDay = history.reduce((min, e) => (min === null || e.day < min ? e.day : min), null);
    if (firstDay === day) newToday += 1; else if (hadOnTime) reviewsToday += 1; else practiceToday += 1;
  }
  return { day, newToday, reviewsToday, practiceToday };
}
