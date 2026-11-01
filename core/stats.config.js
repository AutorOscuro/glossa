// @purpose: Configuración editable de XP y rangos opcionales de las estadísticas (solo datos congelados, sin penalizaciones).
// Configuración de la gamificación opcional (subparte 1.9, tramo 3). Roadmap 1.9, 7.3 y 3.6-T4: XP y rangos son OPCIONALES, desactivables y SIN penalizaciones.
// Todos los valores son PROVISIONALES (los fija quien diseñe la pantalla 3.6; ver DECISIONS.md, 1.9-T3). Solo datos, congelados.
//   enabled   si se calcula XP/rango (el ajuste de la pantalla 3.6 lo sobrescribe con `enabled` en la llamada). Desactivado = `xpSummary` devuelve null y no calcula nada.
//   perResult XP que da UN intento según su resultado. Nunca negativo: fallar o decir «No sé» no resta (decisión 7.3). «No sé» vale lo mismo que fallar:
//             es un dato honorable y no debe salir más caro que adivinar. `skipped` no es un intento y no da XP.
//   ranks     peldaños en orden ascendente de `min` (XP acumulado). El primero tiene min 0. Los nombres son neutros: no hablan de constancia ni de rachas.
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

export const STATS_CONFIG = deepFreeze({
  xp: {
    enabled: true,
    perResult: { correct: 10, almost: 7, wrong: 3, dont_know: 3 },
    ranks: [
      { id: 'seed', label: 'Semilla', min: 0 },
      { id: 'sprout', label: 'Brote', min: 100 },
      { id: 'stem', label: 'Tallo', min: 300 },
      { id: 'leaf', label: 'Hoja', min: 700 },
      { id: 'branch', label: 'Rama', min: 1500 },
      { id: 'flower', label: 'Flor', min: 3000 },
      { id: 'fruit', label: 'Fruto', min: 6000 },
      { id: 'forest', label: 'Bosque', min: 12000 },
    ],
  },
});
