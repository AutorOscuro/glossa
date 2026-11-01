// @purpose: Configuración editable del armador de sesiones: tamaño por defecto, tope diario de repasos y umbral de sanguijuela (solo datos).
// Configuración del armador de sesiones (subparte 1.8, tramo 1). Roadmap 1.8 y 17. Solo datos, congelados.
// T1 fija el tamaño, el tope diario de repasos y el umbral de sanguijuela; T2 añade tarjetas nuevas, cupos y energía (aquí); T3 el intercalado; T4 la progresión.
import { DEFAULT_DAILY_REVIEW_CAP } from './srsRescue.js';
import { DEFAULT_LEECH_THRESHOLD } from './srsLeech.js';

export const SESSION_CONFIG = Object.freeze({
  size: 20, // ítems por sesión (roadmap 1.8: 20 por defecto, configurable)
  maxSize: 100, // tope duro del parámetro `size`
  reviewCap: DEFAULT_DAILY_REVIEW_CAP, // tope diario de repasos (100); el modo rescate cuelga de él
  leechThreshold: DEFAULT_LEECH_THRESHOLD, // fallos a partir de los cuales una tarjeta no se ofrece (8)
  newCap: 10, // tope diario de tarjetas nuevas (el mismo valor por defecto que el ajuste `dailyNewCap`)
  maxNewTopicsPerArea: 3, // máx. de temas «en curso» (empezados con nuevas pendientes) por área; abrir otro exige que haya hueco (roadmap 1.8: 2–3)
  itemsPerMinute: 2, // ritmo supuesto para convertir `minutes` en tamaño de sesión (≈ 30 s por ítem)
  maxMinutes: 600, // tope duro del parámetro `minutes`
  maxRun: 2, // máx. de ítems seguidos del mismo tema o del mismo tipo de ejercicio (roadmap 1.8 regla 3)
  interleaveWindows: [6, Infinity], // ventanas de búsqueda del intercalado: primero local (poca alteración de la urgencia), luego toda la sesión
  interleaveBudget: 50000, // nodos máximos del intercalado; si se agota se deja el orden de entrada
  defaultEnergy: 'mid', // un valor de energía fuera de low|mid|high se ignora y se usa este
});

// Energía (low | mid | high). `low` NO es un modo especial: solo acorta la sesión, baja el cupo de nuevas y aplaza los ejercicios largos.
export const ENERGY_LEVELS = Object.freeze({
  low: Object.freeze({ sizeFactor: 0.5, newFactor: 0.5, light: true }),
  mid: Object.freeze({ sizeFactor: 1, newFactor: 1, light: false }),
  high: Object.freeze({ sizeFactor: 1, newFactor: 1, light: false }),
});
// Familias de ejercicio que con energía baja se aplazan (no se pierden: siguen pendientes para otro día). Ver core/contentTypes.js.
export const HEAVY_FAMILIES = Object.freeze(['writing', 'mediation', 'open_ai', 'speak']);

// Progresión (T4, roadmap 1.8 regla 9): reconocimiento → producción según el dominio del tema. `shareByBand` = parte de las tarjetas NUEVAS de un
// tema que son de producción, según la banda de dominio (ids de mastery.config BANDS). 0 = la producción solo entra cuando se acabó el reconocimiento.
// «Producción» es la de 1.7 (SIGNAL_P.families + SIGNAL_P.extraTypes): una sola definición para las dos subpartes.
export const PROGRESSION = Object.freeze({
  shareByBand: Object.freeze({ unseen: 0, initial: 0, progress: 1 / 3, solid: 1 / 2, mastered: 2 / 3 }),
});

// Motivos de plan vacío (`plan.reason.code`). El texto es siempre neutro: sin culpa, sin rachas.
export const EMPTY_REASONS = Object.freeze({
  no_material: 'No hay material: carga un paquete.',
  only_excluded: 'Las tarjetas que hay ahora están pausadas o retiradas. Carga más contenido o revisa las pausadas.',
  daily_cap_reached: 'Ya hiciste los repasos de hoy. Lo que queda puede esperar a mañana.',
  nothing_due: 'No hay repasos pendientes en este momento.',
  new_cap_reached: 'Ya viste las tarjetas nuevas de hoy. Las siguientes pueden esperar a mañana.',
  energy_deferred: 'Lo pendiente son ejercicios largos. Pueden esperar a un día con más energía.',
  topic_empty: 'No hay ejercicios de ese tema por ahora. Elige otro tema o carga más contenido.',
  no_errors: 'Todavía no hay errores propios que practicar.',
  errors_no_cards: 'Aún no hay ejercicios para practicar lo que anotaste en tu diario. Aparecerán al estudiar más.',
});
