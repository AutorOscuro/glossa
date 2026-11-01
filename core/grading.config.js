// @purpose: Valores numéricos de la calificación por acierto y tiempo (umbrales y tiempos base por tipo); solo datos.
// Valores de la calificación por acierto + tiempo (subparte 1.5, cuarto 1). Roadmap 1.5. Solo datos: sin lógica.
// Todo número que decide un rating vive AQUÍ y en ningún otro archivo. Son valores INICIALES (roadmap: "valores iniciales
// en grading.config.js"): se ajustan con datos reales de William, cambiando solo este archivo.

export const GRADING = Object.freeze({
  slowFactor: 1.8, // correcto y tardó MÁS de 1,8 × su mediana → Hard
  fastFactor: 0.6, // correcto, sin pista y MENOS de 0,6 × su mediana → Easy
  ignoreFactor: 5, // MÁS de 5 × su mediana: distracción; el tiempo se ignora (no baja ni sube el rating)
  minSamples: 8, // eventos correctos mínimos para usar la mediana personal (cuarto 2)
  window: 30, // últimos N eventos correctos por tipo que entran a la mediana (cuarto 2)
  fallbackBaselineMs: 12000, // tipo de ejercicio desconocido
  lookbackDays: 120, // cuánto historial lee el cargador de medianas (cuarto 2); más viejo no cuenta
  interruptAfterHiddenMs: 3000, // pestaña oculta MÁS de 3 s durante una respuesta → `interrupted` (cuarto 3): el tiempo se ignora
});

// Mediana esperada (ms) antes de tener ≥ minSamples datos propios. Por familia de 8.9 (core/contentTypes.js);
// TYPE_BASELINE_MS tiene prioridad sobre la familia para un tipo concreto.
export const FAMILY_BASELINE_MS = Object.freeze({
  choice: 6000,
  text_input: 12000,
  ordering: 15000,
  matching: 20000,
  cloze: 10000,
  transform: 20000,
  audio: 15000,
  speak: 15000,
  reading: 30000,
  writing: 90000,
  mediation: 60000,
  open_ai: 45000,
});

export const TYPE_BASELINE_MS = Object.freeze({
  lightning: 3000, // "relámpago": respuesta rápida por diseño
});
