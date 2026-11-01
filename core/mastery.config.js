// @purpose: Configuración editable del dominio por tema: pesos de las señales, bandas, confianza y topes (solo datos).
// Configuración editable del dominio por tema (subparte 1.7, tramo 1). Roadmap 7.5 y 8.7. Solo datos, congelados.
// Todo lo que el roadmap llama «pesos, cortes y topes» vive aquí: cambiar un valor no exige tocar la lógica.
// T1 fija pesos, bandas, topes y la configuración de las señales R, P y E; T2 los combina en `pct`, `band` y `confidence`; T3 añade las consultas (AT_RISK, TO_STUDY, LEVELS); T4 el umbral del desglose (EXPLAIN).

// pct = 100 · (R·0,35 + P·0,30 + U·0,20 + (1−E)·0,15). Suman 1. Si U es null, se reparten en proporción (T2).
export const WEIGHTS = Object.freeze({ R: 0.35, P: 0.30, U: 0.20, E: 0.15 });

// Bandas de 7.5. `min`/`max` son porcentajes enteros: 0 es «Sin ver» (sin evidencia) y 1–29 «Inicial». `cap` es el tope que
// aplica un descenso (8.7): el tema no muestra más que el máximo de la banda inferior a la actual.
export const BANDS = Object.freeze([
  Object.freeze({ id: 'unseen', label: 'Sin ver', symbol: '○', min: 0, max: 0 }),
  Object.freeze({ id: 'initial', label: 'Inicial', symbol: '◔', min: 1, max: 29 }),
  Object.freeze({ id: 'progress', label: 'En progreso', symbol: '◑', min: 30, max: 59 }),
  Object.freeze({ id: 'solid', label: 'Sólido', symbol: '◕', min: 60, max: 84 }),
  Object.freeze({ id: 'mastered', label: 'Dominado', symbol: '●', min: 85, max: 100 }),
]);

// Confianza (8.7). Se usa en T2.
export const CONFIDENCE = Object.freeze({
  mid: Object.freeze({ events: 8, sessions: 2 }),
  high: Object.freeze({ events: 20, sessions: 3, spanDays: 7, exerciseTypes: 2 }),
});

// Descensos (8.7). Se usan en T2: 2 fallos seguidos en repaso del mismo ítem, o el mismo error 3 veces en 14 días.
export const DROPS = Object.freeze({ consecutiveFails: 2, sameErrorTimes: 3, sameErrorDays: 14 });

const DAY_MS = 86400000;

// Señal R: retención media (retrievabilidad) de las tarjetas del tema con al menos `minReps` repasos.
//   zeroAfterFail (FIX 2.9-T4, decisión del Administrador): una tarjeta cuyo ÚLTIMO resultado calificado fue fallo (`wrong` o `dont_know`) aporta R = 0 hasta que acierte.
//   Sin esto, justo tras repasar la retrievabilidad vale 1 aunque el repaso fuera un fallo (8.7, trampa de R) y un solo fallo podía dar «Dominado».
export const SIGNAL_R = Object.freeze({ minReps: 1, zeroAfterFail: true });

// Tope por evidencia (FIX 2.9-T4, decisión del Administrador): con menos de `minAnswers` respuestas o menos de `minItems` ítems distintos en el tema,
//   el porcentaje no pasa del máximo de `maxBand` (59 con «En progreso») y la confianza queda baja. `lowEvidence` avisa a la interfaz («poca evidencia todavía»).
export const EVIDENCE_CAP = Object.freeze({ minAnswers: 5, minItems: 3, maxBand: 'progress' });

// Señal P: acierto en ejercicios de producción de los últimos `windowDays` días; cada evento pesa 0,5^(edad/halfLifeDays).
//   value: lo que vale cada resultado (`almost` se acepta como correcto, 8.5). `skipped` no es un intento: no entra.
//   Producción = escribir o hablar: las familias de abajo, más los tipos sueltos de `extraTypes` (cloze que se teclea).
export const SIGNAL_P = Object.freeze({
  windowDays: 30,
  halfLifeDays: 10,
  value: Object.freeze({ correct: 1, almost: 1, wrong: 0, dont_know: 0 }),
  families: Object.freeze(['text_input', 'transform', 'speak', 'writing', 'mediation', 'open_ai']),
  extraTypes: Object.freeze(['phrase_cloze']),
});

// Señal E: reincidencia por código. Cada código recurrente (≥ 3 veces en 14 días, la regla de la 1.6) aporta
//   min(1, (veces − 3 + 1) / stepsToFull); las aportaciones se unen como probabilidades: E = 1 − Π(1 − aporte).
export const SIGNAL_E = Object.freeze({ stepsToFull: 4 });

// Consultas de T3 (cifras de diseño, no de una fuente; se pueden cambiar sin tocar la lógica).
//   AT_RISK: un tema con respuestas está «en riesgo» si su retención R baja de `retention`, si tiene error recurrente (E > 0) o si tiene un tope activo.
//   TO_STUDY: «a estudiar» = sin ver o con banda hasta `maxBand` (incluida).
//   LEVELS: orden de los niveles al agrupar (un nivel desconocido va al final, en orden alfabético).
export const AT_RISK = Object.freeze({ retention: 0.7 });
export const TO_STUDY = Object.freeze({ maxBand: 'progress' });
export const LEVELS = Object.freeze(['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

// Desglose de T4 (cifras de diseño): el aviso «la retención sube justo después de repasar» sale cuando R ≥ `highRetention` y hay un tope activo o P < `lowProduction`.
export const EXPLAIN = Object.freeze({ highRetention: 0.8, lowProduction: 0.5 });

export const MS_PER_DAY = DAY_MS;

export const MASTERY_CONFIG = Object.freeze({
  weights: WEIGHTS, bands: BANDS, confidence: CONFIDENCE, drops: DROPS, R: SIGNAL_R, P: SIGNAL_P, E: SIGNAL_E,
  atRisk: AT_RISK, toStudy: TO_STUDY, levels: LEVELS, explain: EXPLAIN, evidence: EVIDENCE_CAP,
});
