// @purpose: Desglose en español del dominio de un tema (qué pesa cada señal, topes y confianza): función pura sobre el resultado de `compute`.
// Explicabilidad del dominio (subparte 1.7, tramo 4). Roadmap 7.5, 8.7 y 17. Sin lectura de datos: recibe el resultado de `mastery.compute`.
//   explain(result, { config?, codeLabels? }) → { topicId, summary, lines, text }   (objeto congelado)
//     summary  una frase: «Tu dominio es 54 % (En progreso), con confianza media: retención 70 %, producción 40 %, uso sin datos, errores repetidos ninguno.»
//     lines    el desglose para mostrar al tocar el porcentaje: una línea por señal, por tope, por confianza y por dato descartado
//     text     summary y lines unidos con saltos de línea
//     codeLabels  OPCIONAL { CÓDIGO: 'nombre en español' } para nombrar los códigos de error; sin él se muestra el código
// Reglas del texto: la retención se presenta como «lo que el calendario de repasos estima que recuerdas hoy», nunca como señal de dominio por sí sola
// (justo después de repasar, incluso con un fallo, vale casi 1); si falta la señal U se dice que la confianza no pasa de «Media».
import { MASTERY_CONFIG } from './mastery.config.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const pct = (v) => `${Math.round(v * 100)} %`;
const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const CONF = { low: 'baja', mid: 'media', high: 'alta' };

function weightsShown(signals, config) {
  const w = config.weights;
  const parts = [['R', w.R, signals.R], ['P', w.P, signals.P], ['U', w.U, signals.U], ['E', w.E, 0]].filter(([, , v]) => v !== null);
  const total = parts.reduce((s, [, wt]) => s + wt, 0);
  return Object.fromEntries(parts.map(([k, wt]) => [k, Math.round((100 * wt) / total)]));
}

function validate(result) {
  if (!isObj(result) || typeof result.topicId !== 'string' || result.topicId === '' || !isObj(result.signals) || !Number.isFinite(result.pct) || typeof result.label !== 'string') {
    throw new Error('explain: result debe ser el resultado de mastery.compute');
  }
}

export function explain(result, { config = MASTERY_CONFIG, codeLabels } = {}) {
  validate(result);
  const { topicId, signals, label } = result;
  const evidence = Number.isFinite(result.evidence) ? result.evidence : 0;
  const caps = Array.isArray(result.caps) ? result.caps : [];
  const detail = isObj(result.detail) ? result.detail : {};
  const nameOf = (code) => (isObj(codeLabels) && typeof codeLabels[code] === 'string' ? `${codeLabels[code]} (${code})` : code);

  if (evidence === 0) {
    const summary = 'Sin ver: todavía no has respondido nada de este tema, así que no hay porcentaje que explicar.';
    return Object.freeze({ topicId, summary, lines: Object.freeze([]), text: summary });
  }

  const wt = weightsShown(signals, config);
  const lines = [];
  const attempts = isObj(detail.P) && Number.isFinite(detail.P.attempts) ? detail.P.attempts : 0;
  const cards = isObj(detail.R) && Number.isFinite(detail.R.cards) ? detail.R.cards : 0;
  const codes = isObj(detail.E) && Array.isArray(detail.E.codes) ? detail.E.codes : [];

  // Retención
  if (signals.R === null) lines.push('Retención: sin datos todavía, porque ninguna tarjeta de este tema se ha repasado.');
  else lines.push(`Retención ${pct(signals.R)} (pesa ${wt.R} %): es lo que el calendario de repasos estima que recuerdas hoy, a partir de ${n(cards, 'tarjeta repasada', 'tarjetas repasadas')}.`);
  const failedCards = isObj(detail.R) && Number.isFinite(detail.R.failed) ? detail.R.failed : 0;
  if (signals.R !== null && failedCards > 0) lines.push(`${n(failedCards, 'tarjeta', 'tarjetas')} ${failedCards === 1 ? 'cuenta' : 'cuentan'} como 0 en la retención porque la última vez no te salió; vuelve${failedCards === 1 ? '' : 'n'} a sumar cuando aciertes.`);
  if (signals.R !== null && signals.R >= config.explain.highRetention && (caps.length > 0 || (signals.P !== null && signals.P < config.explain.lowProduction))) {
    lines.push('Ojo: la retención sube justo después de repasar, también si no te salió; por eso no basta por sí sola para saber si dominas el tema.');
  }

  // Producción
  if (signals.P === null) lines.push(`Producción: sin datos, porque no has escrito ni dicho respuestas de este tema en los últimos ${config.P.windowDays} días.`);
  else lines.push(`Producción ${pct(signals.P)} (pesa ${wt.P} %): acierto al escribir o hablar en ${n(attempts, 'intento', 'intentos')} de los últimos ${config.P.windowDays} días; los más recientes pesan más.`);

  // Uso
  if (signals.U === null) lines.push('Uso en tus propias frases: sin datos todavía (esa señal llega más adelante); por eso la confianza no pasa de «Media».');
  else lines.push(`Uso en tus propias frases ${pct(signals.U)} (pesa ${wt.U} %).`);

  // Errores
  if (codes.length === 0) lines.push(`Errores repetidos: ninguno en los últimos ${config.drops.sameErrorDays} días (pesa ${wt.E} %).`);
  else {
    const list = codes.map((c) => `${nameOf(c.code)}: ${n(c.inWindow, 'vez', 'veces')}`).join('; ');
    lines.push(`Errores repetidos ${pct(signals.E)} (pesa ${wt.E} %): ${list} en los últimos ${config.drops.sameErrorDays} días.`);
  }

  // Poca evidencia (FIX 2.9-T4)
  const lowEvidence = result.lowEvidence === true;
  if (lowEvidence) {
    const rule = config.evidence;
    lines.push(`Poca evidencia todavía: ${n(evidence, 'respuesta', 'respuestas')}; hacen falta al menos ${rule.minAnswers} respuestas y ${rule.minItems} ejercicios distintos para pasar de ${result.pct} %.`);
  }

  // Topes
  if (caps.length > 0) {
    for (const c of caps) {
      if (c.kind === 'consecutive_fails') lines.push(`Tope: no te salió ${config.drops.consecutiveFails} veces seguidas «${c.key}»; el tema no pasa del nivel inferior hasta que aciertes.`);
      else if (c.kind === 'recurrent_error') lines.push(`Tope: el error ${nameOf(c.code)} se repitió ${n(c.inWindow, 'vez', 'veces')} en ${config.drops.sameErrorDays} días; el tema no pasa del nivel inferior hasta que aciertes algo de este tema.`);
    }
    if (result.pct < result.rawPct) lines.push(`Sin los topes tu porcentaje sería ${result.rawPct} %; con ellos se queda en ${result.pct} %.`);
    else lines.push('Los topes no cambian el porcentaje, porque el tema ya está en una banda baja.');
  } else if (lowEvidence && result.pct < result.rawPct) {
    lines.push(`Con más práctica tu porcentaje podría ser ${result.rawPct} %; por ahora se queda en ${result.pct} %.`);
  }

  // Confianza
  const conf = CONF[result.confidence] ?? String(result.confidence);
  if (result.confidence === 'low') lines.push(`Confianza baja: ${n(evidence, 'respuesta', 'respuestas')} hasta ahora; practica en más días para afianzar el número.`);
  else if (result.confidence === 'mid') lines.push(`Confianza media: ${n(evidence, 'respuesta', 'respuestas')} repartidas en varios días${signals.U === null ? '; no sube a «Alta» hasta que haya datos de uso' : ''}.`);
  else lines.push(`Confianza ${conf}: ${n(evidence, 'respuesta', 'respuestas')} en varios días y tipos de ejercicio.`);

  // Datos descartados
  const ignored = [detail.R, detail.P].reduce((s, d) => s + (isObj(d) && Number.isFinite(d.ignored) ? d.ignored : 0), 0);
  if (ignored > 0) lines.push(`${ignored === 1 ? 'Se descartó' : 'Se descartaron'} ${n(ignored, 'dato ilegible', 'datos ilegibles')} al calcular.`);

  const part = (name, v) => (v === null ? `${name} sin datos` : `${name} ${pct(v)}`);
  const summary = `Tu dominio es ${result.pct} % (${label}), con confianza ${conf}${lowEvidence ? ' y poca evidencia todavía' : ''}: ${part('retención', signals.R)}, ${part('producción', signals.P)}, ${part('uso', signals.U)}, ${signals.E > 0 ? `errores repetidos ${pct(signals.E)}` : 'sin errores repetidos'}.`;
  return Object.freeze({ topicId, summary, lines: Object.freeze(lines), text: [summary, ...lines].join('\n') });
}
