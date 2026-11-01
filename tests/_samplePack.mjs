// @purpose: Ayudantes de las pruebas de contenido: copia profunda del paquete de muestra de tests/fixtures; no es una prueba.
// Ayudantes de las pruebas de contenido (subparte 1.3, cuarto 3, mitad 3B). No es una prueba: el nombre empieza con "_".
//   loadSample()            copia profunda del paquete de muestra `tests/fixtures/sample_pack_v1.json` (19 ítems, 1 palabra, 1 historia; limpio)
//   loadTaxonomyFixtures()  { errorCodes, topics }: la taxonomía MÍNIMA de prueba (no la real: los lotes C1 y C2 pueden cambiar la real sin romper estas pruebas)
//   makeRepo()              repo temporal { root, packs, inbox, write(rel, objeto|texto), cleanup() } con esa taxonomía copiada a content/taxonomy/
//   bigPack(n)              paquete válido con n ítems (para medir rendimiento)
//   treeHash(dir)           huella de todo el árbol: sirve para comprobar que algo NO escribió en el disco
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const REPO = path.resolve(FIXTURES, '..', '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(FIXTURES, rel), 'utf8'));

export const loadSample = () => readJson('sample_pack_v1.json');
export const loadTaxonomyFixtures = () => ({ errorCodes: readJson('taxonomy/error_codes.json'), topics: readJson('taxonomy/topics.json') });

export function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glossa-vc-'));
  const packs = path.join(root, 'content', 'packs');
  const inbox = path.join(root, 'inbox'); // donde "llegan" los paquetes nuevos (la carpeta descomprimida del zip)
  fs.mkdirSync(path.join(root, 'content', 'taxonomy'), { recursive: true });
  fs.mkdirSync(packs, { recursive: true });
  fs.mkdirSync(inbox, { recursive: true });
  for (const f of ['error_codes.json', 'topics.json']) fs.copyFileSync(path.join(FIXTURES, 'taxonomy', f), path.join(root, 'content', 'taxonomy', f));
  return {
    root, packs, inbox,
    write(rel, content) {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, typeof content === 'string' || Buffer.isBuffer(content) ? content : `${JSON.stringify(content, null, 2)}\n`);
      return file;
    },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); },
  };
}

// n ítems válidos del tema `gram.present_perfect.for_since`, con ids únicos g.big.0001… y los tipos de la muestra repartidos.
export function bigPack(n, packId = 'big_pack_v1') {
  const sample = loadSample();
  const base = sample.items.filter((it) => it.topics.length === 1 && it.topics[0] === 'gram.present_perfect.for_since');
  const items = Array.from({ length: n }, (_, i) => ({ ...structuredClone(base[i % base.length]), id: `g.big.${String(i + 1).padStart(5, '0')}` }));
  return { ...sample, pack_id: packId, title_es: 'Paquete grande (rendimiento)', topics: ['gram.present_perfect.for_since'], items, lexicon: [], stories: [] };
}

export function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    for (const name of fs.readdirSync(d).sort()) {
      const full = path.join(d, name);
      const st = fs.lstatSync(full);
      h.update(`${path.relative(dir, full)}|${st.isDirectory() ? 'd' : st.size}\n`);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) h.update(fs.readFileSync(full));
    }
  })(dir);
  return h.digest('hex');
}
