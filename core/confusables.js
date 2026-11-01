// @purpose: Pares de palabras confundibles: consulta si dos palabras se confunden y cuáles son sus parejas.
// Pares de palabras confundibles (subparte 1.2, cuarto 2A). Datos: content/taxonomy/confusables.json. Contrato: docs/CONTRACTS.md 1.2-2A.
//
//   createConfusables(data) → { areConfusable(a, b), partners(word), size }
//     `data` = el JSON ya leído: { version: 1, pairs: [["bad","bed"], …] }. Si el formato está mal LANZA un Error en español con la
//     ruta exacta (`confusables › pairs[3]: …`): es un dato del repositorio, no una respuesta de la persona.
//     areConfusable(a, b): ¿son una pareja de la lista? Sin importar orden, mayúsculas ni `’`. Entradas que no son texto → false.
//     partners(word): las parejas de una palabra (arreglo nuevo, vacío si no hay).
//   `compare` (cuarto 2B) lo usa para no dar "casi" cuando el error crea otra palabra válida (8.5, regla 4).
//   Este módulo no lee archivos ni usa red: quien lo llame le pasa el JSON (el cargador de contenido de la 1.3 lo hará en la app).

const WORD = /^[a-z]+(?:'[a-z]+)?$/;

function clean(value) {
  return typeof value === 'string' ? value.replace(/[\u2019\u2018\u02BC\u00B4`\u2032]/g, "'").trim().toLowerCase() : '';
}

export function createConfusables(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('confusables: el archivo debe ser un objeto { version, pairs }');
  if (data.version !== 1) throw new Error(`confusables › version: se esperaba 1 y llegó ${JSON.stringify(data.version)}`);
  if (!Array.isArray(data.pairs)) throw new Error('confusables › pairs: debe ser una lista');
  const map = new Map();
  const seen = new Set();
  data.pairs.forEach((pair, i) => {
    const where = `confusables › pairs[${i}]`;
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`${where}: cada pareja debe ser una lista de 2 palabras`);
    const [a, b] = pair;
    for (const w of pair) {
      if (typeof w !== 'string' || w !== w.toLowerCase() || !WORD.test(w)) {
        throw new Error(`${where}: "${String(w)}" no es una palabra válida (minúsculas, solo letras a–z y un apóstrofo recto)`);
      }
    }
    if (a === b) throw new Error(`${where}: las dos palabras son iguales ("${a}")`);
    const key = [a, b].sort().join('|');
    if (seen.has(key)) throw new Error(`${where}: la pareja "${a}" / "${b}" está repetida`);
    seen.add(key);
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b);
    map.get(b).add(a);
  });
  return Object.freeze({
    size: seen.size,
    areConfusable(a, b) {
      const x = clean(a);
      const y = clean(b);
      return x !== '' && y !== '' && x !== y && map.has(x) && map.get(x).has(y);
    },
    partners(word) {
      const set = map.get(clean(word));
      return set ? [...set] : [];
    },
  });
}
