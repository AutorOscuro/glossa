// @purpose: Textos por defecto en español de la biblioteca de componentes, reunidos en un solo lugar.
// Textos por defecto de la biblioteca de componentes (subparte 0.5), en un solo lugar.
// Cada componente acepta su propio texto por opciones; esto solo da valores de respaldo en español.
// La 9.5 moverá estas cadenas a app/strings.es.js sin tocar los componentes.
export const TEXT = Object.freeze({
  close: 'Cerrar',
  cancel: 'Cancelar',
  accept: 'Aceptar',
  loading: 'Cargando',
  optional: '(opcional)',
  levelPrefix: 'Nivel',
  levelHelp: '¿Qué significa este nivel?',
  newBadge: 'New',
  confirmPhrasePrompt: 'Para confirmar, escribe',
  wordStatus: Object.freeze({
    correct: 'correcta',
    almost: 'casi: error de ortografía',
    wrong: 'no coincide',
    missing: 'falta',
    extra: 'sobra',
  }),
  wordExpected: 'se esperaba',
  wordKnowledge: Object.freeze({
    unknown: 'desconocida',
    learning: 'aprendiendo',
    known: 'conocida',
  }),
  wordState: Object.freeze({ selected: 'seleccionada', used: 'ya usada', correct: 'correcta', wrong: 'no encaja' }),
  // Los 4 botones de recuerdo libre (1.5). Palabras neutras: «Otra vez» no es un castigo, es una fecha de repaso más cercana.
  rating: Object.freeze({ group: '¿Cómo te salió?', again: 'Otra vez', hard: 'Difícil', good: 'Bien', easy: 'Fácil' }),
  mascotLabel: 'Mascota',
  keyField: Object.freeze({
    show: 'Mostrar',
    hide: 'Ocultar',
    showAria: 'Mostrar la clave que escribiste',
    hideAria: 'Ocultar la clave que escribiste',
    save: 'Guardar clave',
    clear: 'Borrar clave',
    hint: 'Se guarda solo en este dispositivo.',
    statusSaved: 'Clave guardada en este dispositivo.',
    statusEmpty: 'Todavía no hay clave guardada.',
    statusCleared: 'Clave borrada.',
    errorEmpty: 'Escribe la clave antes de guardar.',
    errorSave: 'No se pudo guardar la clave. Inténtalo de nuevo.',
    errorClear: 'No se pudo borrar la clave. Inténtalo de nuevo.',
  }),
});
