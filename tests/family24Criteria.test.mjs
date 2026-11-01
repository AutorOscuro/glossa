// @purpose: Evidencia de los criterios CA 1 a 5 de la subparte 2.4 (2.4-T4, punto 3c): prueba que no hay arrastre y ata cada criterio a pruebas que existen.
// CA 1 (sin arrastre obligatorio) no tenía prueba propia: aquí se comprueba de dos maneras (el código de los 6 tipos no usa APIs de arrastre y los 6 montados solo escuchan «click»).
// La matriz EVIDENCIA ata cada criterio a pruebas por su título: si alguien renombra o borra una prueba citada, esta prueba falla y obliga a actualizar la evidencia (no se pudre en silencio).
// Dónde NO aplica la letra del criterio (y por qué) está en `LIMITES_DEL_CRITERIO` y en DECISIONS.md (2.4-T4, punto 3c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRng } from '../core/rng.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerOrderTypes } from '../ui/exercises/orderTypes.js';
import { registerBuildTypes } from '../ui/exercises/buildTypes.js';
import { createMatchPairs } from '../ui/exercises/matchPairs.js';
import { createClozeBank } from '../ui/exercises/clozeBank.js';
import { makeEnv } from './_fakeDom.mjs';

const TIPOS = ['order_blocks', 'order_dialogue', 'match_pairs', 'cloze_bank', 'unscramble_letters', 'build_from_keywords'];

// Archivos que construyen la pantalla de los 6 tipos (más el botón común y la ficha de palabra).
const FUENTES = [
  'ui/exercises/orderBlocks.js', 'ui/exercises/orderTypes.js', 'ui/exercises/matchPairs.js', 'ui/exercises/clozeBank.js',
  'ui/exercises/buildPieces.js', 'ui/exercises/buildTypes.js', 'ui/components/button.js', 'ui/components/wordChip.js',
];

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------- CA 1: sin arrastre obligatorio

// Nombres de APIs de arrastre y de gestos continuos. Si alguno aparece en el código de un tipo, el ejercicio podría exigir arrastrar.
const ARRASTRE = /\b(on)?(draggable|dragstart|dragend|dragover|dragenter|dragleave|drop|pointerdown|pointermove|pointerup|touchstart|touchmove|touchend|mousedown|mousemove|mouseup)\b|\bondrag\b|['"`]drop['"`]/;

test('CA 1 de 2.4: el código de los 6 tipos no usa APIs de arrastre ni de gestos continuos', () => {
  for (const ruta of FUENTES) {
    const texto = leer(ruta);
    const m = texto.match(ARRASTRE);
    assert.equal(m, null, `${ruta}: usa «${m?.[0]}»; el arrastre solo puede ser opcional y hoy se decidió no implementarlo`);
  }
});

test('CA 1 de 2.4: la regla de arrastre sí detecta lo que busca (la prueba no es vacía)', () => {
  for (const mala of ['el.draggable = true', "addEventListener('dragstart', f)", "listen(b, 'pointermove', f)", 'ontouchmove', "c.listen(b, 'drop', f)"]) {
    assert.ok(ARRASTRE.test(mala), `no detecta: ${mala}`);
  }
  for (const buena of ["c.listen(b, 'click', f)", 'dropdown-menu', 'const drops = 1']) {
    assert.ok(!ARRASTRE.test(buena), `marca de más: ${buena}`);
  }
});

const range = (n) => Array.from({ length: n }, (_, i) => i);
const ITEMS = {
  order_blocks: { type: 'order_blocks', prompt_es: 'Ordena la frase.', data: { blocks: ['a b', 'c d', 'e f'] } },
  order_dialogue: { type: 'order_dialogue', prompt_es: 'Ordena el diálogo.', data: { lines: [{ speaker: 'Ana', text: 'one' }, { speaker: 'Ben', text: 'two' }, { speaker: 'Ana', text: 'three' }] } },
  match_pairs: { type: 'match_pairs', prompt_es: 'Une cada palabra.', data: { pairs: range(3).map((i) => ({ left: `l${i}`, right: `r${i}` })), extra_right: ['sobra'] } },
  cloze_bank: { type: 'cloze_bank', prompt_es: 'Completa la frase.', data: { text: 'I ___ to ___ home.', answers: [['want'], ['go']], bank: ['want', 'go', 'goes'] } },
  unscramble_letters: { type: 'unscramble_letters', prompt_es: 'Forma la palabra.', data: { pieces: ['c', 'a', 't'], extra_pieces: ['z'] } },
  build_from_keywords: { type: 'build_from_keywords', prompt_es: 'Construye la frase.', data: { pieces: ['I', 'like', 'tea'], extra_pieces: ['is'] } },
};

// Envuelve addEventListener del prototipo del DOM falso para anotar qué tipos de evento se escuchan (documento, ventana y elementos comparten la clase).
function espiarEscuchas(env) {
  const vistos = new Map();
  let proto = Object.getPrototypeOf(env.doc.createElement('div'));
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'addEventListener')) proto = Object.getPrototypeOf(proto);
  assert.ok(proto, 'no se encontró addEventListener en el DOM falso');
  const original = proto.addEventListener;
  proto.addEventListener = function espiado(type, fn, ...resto) {
    if (typeof fn === 'function') vistos.set(type, (vistos.get(type) ?? 0) + 1);
    return original.call(this, type, fn, ...resto);
  };
  return vistos;
}

for (const type of TIPOS) {
  test(`CA 1 de 2.4: ${type} montado solo escucha «click» (todo se hace con toques)`, async () => {
    const env = makeEnv();
    const vistos = espiarEscuchas(env);
    const slot = env.doc.createElement('div');
    env.doc.body.appendChild(slot);
    slot.ownerDocument = env.doc;
    const rng = createRng(7);
    const reg = createExerciseRegistry({ resolveItem: async () => ({ id: `ca1.${type}`, ...ITEMS[type] }), log: () => {} });
    registerOrderTypes(reg, { rng, log: () => {} });
    reg.register('match_pairs', createMatchPairs({ rng, log: () => {} }));
    reg.register('cloze_bank', createClozeBank({ rng, log: () => {} }));
    registerBuildTypes(reg, { rng, log: () => {} });
    const handle = await reg.mount(slot, { itemId: `ca1.${type}`, exerciseType: type }, { index: 0, total: 1, submit: async () => ({ status: 'saved' }) });
    assert.ok(handle, `${type}: debe montar`);
    // Algunos componentes añaden escuchas al pintar lo puesto (piezas o huecos llenos): se toca todo lo tocable antes de contar.
    for (let ronda = 0; ronda < 2; ronda += 1) {
      for (const el of slot.querySelectorAll('button')) {
        if (el.hasAttribute('data-index') && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') el.dispatchEvent({ type: 'click', preventDefault() {} });
      }
    }
    assert.ok((vistos.get('click') ?? 0) >= 4, `${type}: debería haber al menos 4 escuchas de click (piezas y botones); hay ${vistos.get('click') ?? 0}`);
    assert.deepEqual([...vistos.keys()].sort(), ['click'], `${type}: escucha otros eventos además de click: ${[...vistos.keys()].join(', ')}`);
    handle.destroy();
  });
}

// ---------------------------------------------------------------- Matriz de evidencia CA 1 a 5

// Cada entrada: el archivo de prueba y un fragmento ESTÁTICO del título (los títulos con `${…}` se citan por su parte fija).
const EVIDENCIA = {
  1: {
    texto: 'sin arrastre obligatorio',
    tipos: TIPOS,
    pruebas: [
      ['family24Criteria', 'CA 1 de 2.4: el código de los 6 tipos no usa APIs de arrastre ni de gestos continuos'],
      ['family24Criteria', 'montado solo escucha «click» (todo se hace con toques)'],
      ['family24ScreenFuzz', 'fuzz de pantalla: '],
      ['orderBlocksView', 'orden correcto: envía correct con la frase y pinta «¡Bien!»'],
      ['orderTypes', 'order_dialogue: en el orden correcto se envía correct y responseRaw lleva solo el texto, sin hablante'],
      ['matchPairsView', 'al resolver la última pareja se envía solo, correct y sin fallos'],
      ['clozeBankView', 'comprobar bien envía correct con la frase armada y felicita'],
      ['buildPiecesView', 'palabra correcta: envía un solo `correct` con la palabra y quita las acciones'],
      ['buildTypes', 'unscramble_letters: las letras se unen SIN espacio y el envío lleva el tipo de respuesta correcto'],
    ],
  },
  2: {
    texto: 'varios órdenes válidos aceptados',
    tipos: ['order_blocks', 'order_dialogue', 'cloze_bank', 'unscramble_letters', 'build_from_keywords'],
    pruebas: [
      ['orderBlocks', 'accept añade otros órdenes válidos: la solución va primero y no se repite'],
      ['orderBlocks', 'gradeOrder: un orden alternativo de accept también es correct y no marca posiciones'],
      ['orderBlocks', 'gradeOrder: con bloques repetidos cualquier reparto de los iguales vale'],
      ['orderBlocksView', 'otro orden válido de accept también cuenta como correcto'],
      ['orderDialogue', 'accept se escribe con el texto de las líneas, sin hablante, y vale como orden alternativo'],
      ['orderTypes', 'order_dialogue: un orden alternativo de accept (escrito sin hablante) es correcto'],
      ['clozeBank', 'varias respuestas por hueco: cualquiera vale; el distractor «goes» no'],
      ['buildPieces', 'varios órdenes válidos en accept (frases)'],
      ['buildPiecesView', 'frase: se une con espacios; un orden válido de accept es correcto'],
    ],
  },
  3: {
    texto: 'deshacer funciona en todos los pasos',
    tipos: ['order_blocks', 'order_dialogue', 'cloze_bank', 'unscramble_letters', 'build_from_keywords'],
    pruebas: [
      ['orderBlocks', 'undoLast: deshace colocar y quitar; quitar devuelve el bloque a su posición anterior'],
      ['orderBlocks', 'undoLast: deshacer todo vuelve exactamente al estado inicial'],
      ['orderBlocksView', 'deshacer quita lo último que se hizo y reiniciar vacía la frase'],
      ['clozeBank', 'deshacer: vuelve paso a paso, también tras quitar (CA 3 de 2.4)'],
      ['clozeBankView', 'deshacer vuelve un paso (también tras quitar) y empezar de nuevo vacía los huecos'],
      ['buildState', 'deshacer paso a paso vuelve al principio (CA 3 de 2.4)'],
      ['buildPiecesView', 'deshacer y empezar de nuevo'],
      ['family24Fuzz', 'fuzz de toques ('],
      ['family24Fuzz', 'historial lleno (200): se conservan las acciones más recientes y se puede deshacer hasta vaciarlo, en ordenar y en banco'],
    ],
  },
  4: {
    texto: 'no hay estados imposibles (doble toque en el mismo bloque)',
    tipos: TIPOS,
    pruebas: [
      ['orderBlocks', 'placeBlock: doble toque en el mismo bloque o bloque fuera de rango no hace nada (devuelve el mismo estado)'],
      ['orderBlocks', 'fuzz: 3000 acciones aleatorias en 2, 5 y 12 bloques mantienen los invariantes y nunca lanza'],
      ['orderBlocksView', 'un bloque ya colocado no se puede colocar dos veces desde la bandeja'],
      ['matchPairsState', 'doble toque sobre una pareja resuelta no cambia nada (mismo objeto)'],
      ['matchPairsState', 'fuzz: 3000 secuencias de toques al azar nunca lanzan y mantienen los invariantes'],
      ['matchPairsView', 'doble toque sobre una pareja resuelta no hace nada'],
      ['clozeBank', 'CA 4 de 2.4: secuencias de toques al azar nunca dejan un estado imposible ni lanzan'],
      ['clozeBankView', 'una palabra ya puesta no se pone dos veces y con todos los huecos llenos no se pone ninguna'],
      ['buildState', 'doble toque en la misma pieza: el mismo estado, sin duplicar ni tocar el historial'],
      ['buildPiecesView', 'doble toque en la misma pieza no la duplica'],
      ['family24Fuzz', 'argumentos hostiles: ningún estado cambia ni lanza (ordenar, construir, banco y emparejar)'],
      ['family24Fuzz', 'fuzz de toques ('],
      ['family24ScreenFuzz', 'fuzz de pantalla: '],
    ],
  },
  5: {
    texto: 'correcto con 2 y con 12 bloques (donde el contrato permite 12)',
    tipos: TIPOS,
    pruebas: [
      ['orderBlocks', 'límites: 2 a 12 bloques (CA 5 de 2.4)'],
      ['orderBlocks', 'gradeOrder: 2 y 12 bloques'],
      ['orderBlocksView', 'con 2 y con 12 bloques funciona (CA 5 de 2.4)'],
      ['orderDialogue', 'el estado de toques funciona con 2 y con 8 líneas (mismo estado que order_blocks)'],
      ['orderTypes', 'order_dialogue con 2 y con 8 líneas funciona'],
      ['matchPairs', 'bordes de las parejas: 2 y 10 valen; 1 y 11 no'],
      ['matchPairsView', '2 y 10 parejas (con 4 distractores) funcionan de punta a punta'],
      ['clozeBank', 'CA 5: funciona con 1 hueco y con 6 huecos y 20 fichas'],
      ['clozeBankView', '1 hueco y 6 huecos con 20 palabras funcionan'],
      ['buildPieces', 'con 12 y con 2 piezas califica'],
      ['buildPiecesView', '2 piezas y 16 (12 + 4 de más) montan y se pueden colocar todas'],
      ['family24Fuzz', 'CA 5 de 2.4: los topes de tamaño del estado son 2 a 12 bloques y 16 piezas (12 + 4 de más)'],
      ['family24ScreenFuzz', 'fuzz de pantalla: '],
    ],
  },
};

// Donde la letra del criterio no se cumple tal cual, y por qué (cada límite se cita también en DECISIONS.md).
const LIMITES_DEL_CRITERIO = {
  3: { match_pairs: 'emparejar no tiene «deshacer»: el feedback es inmediato por pareja (decisión provisional, ficha «2.4-T2» de docs/CONTRACTS.md)' },
  5: {
    order_dialogue: 'el contrato limita el diálogo a 8 líneas: se prueba 2 y 8',
    match_pairs: 'el contrato limita a 10 parejas (más hasta 4 distractores): se prueba 2 y 10',
    cloze_bank: 'el contrato limita a 6 huecos (banco de hasta 20): se prueba 1 y 6',
  },
};

const cacheTextos = new Map();
const textoDePrueba = (nombre) => {
  if (!cacheTextos.has(nombre)) cacheTextos.set(nombre, leer(`tests/${nombre}.test.mjs`));
  return cacheTextos.get(nombre);
};

for (const [ca, def] of Object.entries(EVIDENCIA)) {
  test(`CA ${ca} de 2.4 (${def.texto}): cada prueba citada como evidencia existe`, () => {
    assert.ok(def.pruebas.length >= 2, `CA ${ca}: la evidencia es demasiado corta`);
    for (const [archivo, titulo] of def.pruebas) {
      const texto = textoDePrueba(archivo);
      assert.ok(texto.includes(titulo), `CA ${ca}: en tests/${archivo}.test.mjs ya no existe la prueba «${titulo}»; actualiza la evidencia de family24Criteria`);
    }
    const unicas = new Set(def.pruebas.map((p) => p.join('|')));
    assert.equal(unicas.size, def.pruebas.length, `CA ${ca}: hay evidencia repetida`);
  });
}

test('la evidencia cubre los 6 tipos en cada criterio, salvo los límites escritos', () => {
  for (const [ca, def] of Object.entries(EVIDENCIA)) {
    const excepciones = Object.keys(LIMITES_DEL_CRITERIO[ca] ?? {});
    for (const type of TIPOS) {
      const cubierto = def.tipos.includes(type);
      if (!cubierto) {
        assert.ok(excepciones.includes(type) || type === 'match_pairs' && ca === '2', `CA ${ca}: ${type} no tiene evidencia ni límite escrito`);
      }
    }
    for (const type of excepciones) assert.ok(TIPOS.includes(type), `CA ${ca}: límite para un tipo desconocido ${type}`);
  }
  assert.ok(!EVIDENCIA[3].tipos.includes('match_pairs'), 'CA 3: emparejar no entra como cubierto: su límite está escrito');
  assert.ok(Object.hasOwn(LIMITES_DEL_CRITERIO[3], 'match_pairs'), 'CA 3: falta el límite de emparejar');
  assert.ok(!EVIDENCIA[2].tipos.includes('match_pairs'), 'CA 2: emparejar tiene una sola solución, no entra');
});

test('el límite «sin deshacer en emparejar» sigue escrito en la ficha 2.4-T2 de docs/CONTRACTS.md', () => {
  const t = leer('docs/CONTRACTS.md');
  assert.ok(/en emparejar no hay «deshacer»/.test(t), 'la ficha 2.4-T2 ya no dice que emparejar no tiene deshacer; si cambió, actualiza el límite del CA 3');
});

test('los 5 criterios están en la matriz y no hay otros', () => {
  assert.deepEqual(Object.keys(EVIDENCIA), ['1', '2', '3', '4', '5']);
});
