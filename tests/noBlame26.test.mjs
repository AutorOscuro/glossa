// @purpose: Auditoría de cadenas sin culpa (2.6-T3): recorre los textos exportados y todos los literales de la interfaz y falla si aparece culpa o castigo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { blameHits, scanFile, stringLiterals } from './_blameScan.mjs';
import { SESSION_TEXT } from '../ui/views/sesion.js';

const root = new URL('../', import.meta.url).pathname;
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));

test('el detector: encuentra culpa y deja pasar los textos permitidos', () => {
  for (const bad of ['Incorrecto', 'Tu respuesta es incorrecta', 'Te equivocaste', 'Fallaste otra vez', 'Cometiste un error', 'Tu error fue este', 'Es error tuyo', 'Lo hiciste mal', 'Eres torpe', 'Tienes que repetirlo', 'Es tu culpa', 'Castigo', 'Eres inútil', 'Qué estúpido', 'Deberías saberlo', 'Penalización', 'INCORRECTO', 'Equivocación']) {
    assert.ok(blameHits(bad).length > 0, bad);
  }
  for (const ok of ['Todavía no.', 'No pasa nada:', '¡Bien!', 'Sin rachas, sin culpa', 'Casi: revisa la ortografía de la palabra marcada.', 'Tu elección', 'No encaja', 'Para repasar: 2.', 'Normal', 'Animal', 'Material']) {
    assert.deepEqual(blameHits(ok), [], ok);
  }
});

test('el extractor de literales ignora comentarios y toma comillas simples, dobles y plantillas', () => {
  const src = "// 'fallaste'\n/* \"incorrecto\" */ const a = 'uno'; const b = \"dos\"; const c = `tres ${x} cuatro`; const r = /mal/; const u = 'http://a';";
  assert.deepEqual(stringLiterals(src), ['uno', 'dos', 'tres   cuatro', 'http://a']);
});

test('se mantienen «Todavía no.» y «No pasa nada:» (decisión del Administrador) y no se marcan', async () => {
  const { FB_TEXT } = await import('../ui/feedbackPanel.js');
  assert.equal(FB_TEXT.wrong, 'Todavía no.');
  assert.equal(FB_TEXT.dont, 'No pasa nada:');
  assert.deepEqual(blameHits(FB_TEXT.wrong), []);
  assert.deepEqual(blameHits(FB_TEXT.dont), []);
});

const EXPORTED = [
  'ui/feedbackPanel.js', 'ui/reportMenu.js', 'ui/whyNote.js', 'ui/actionBar.js', 'ui/examplesSheet.js', 'ui/correctionsSheet.js', 'ui/aiSheet.js', 'ui/dictionarySheet.js', 'ui/summaryPanel.js', 'ui/components/_text.js', 'ui/exercises/cardBar.js', 'ui/exercises/choice.js',
  'ui/exercises/clozeBank.js', 'ui/exercises/buildPieces.js', 'ui/exercises/fixError.js', 'ui/exercises/matchPairs.js', 'ui/exercises/orderBlocks.js',
  'ui/exercises/phraseCloze.js', 'ui/exercises/textAnswer.js', 'ui/exercises/textTypes.js', 'ui/exercises/threeForms.js', 'ui/exercises/transformTypes.js',
  'ui/exercises/translateTypes.js', 'ui/views/hoy.js',
];

test('todo texto exportado (*_TEXT) de la interfaz pasa, también las funciones con argumentos de muestra', async () => {
  const seen = [];
  const check = (where, v) => {
    if (typeof v === 'string') { seen.push(v); assert.deepEqual(blameHits(v), [], `${where}: «${v}»`); return; }
    if (typeof v === 'function') {
      for (const args of [[1], [2, 3], ['go'], ['go', 'went'], [1, 'go', 'went'], [0, 5]]) { let r; try { r = v(...args); } catch (e) { continue; } if (typeof r === 'string') check(`${where}(${args.join(',')})`, r); }
      return;
    }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) check(`${where}.${k}`, x);
  };
  for (const f of EXPORTED) {
    const mod = await import(`../${f}`);
    const names = Object.keys(mod).filter((k) => /TEXT$/.test(k));
    assert.ok(names.length > 0, `${f} exporta un objeto de textos`);
    for (const k of names) check(`${f}:${k}`, mod[k]);
  }
  check('sesion.js:SESSION_TEXT', SESSION_TEXT);
  assert.ok(seen.includes(SESSION_TEXT.next) && seen.includes('Todavía no.'), 'se recorrieron los textos de la sesión y del panel');
  assert.ok(seen.length > 250, `se recorrieron ${seen.length} textos`);
});

test('ningún archivo de ui/ exporta un objeto de textos que esta auditoría no recorra (ni al revés)', () => {
  const known = [...EXPORTED, 'ui/views/sesion.js'].sort();
  const found = walk('ui').filter((f) => /export const [A-Z_]*TEXT\b/.test(fs.readFileSync(path.join(root, f), 'utf8'))).sort();
  assert.deepEqual(found, known);
});

const SCANNED = [...walk('ui'), 'core/textErrors.js', 'core/masteryExplain.js', 'core/session.config.js', 'core/errorDetect.js', 'core/sessionDriver.js', 'core/itemReport.js', 'core/whyNote.js', 'core/feedbackCues.js', 'core/summaryText.js', 'app/cardActions.js'];

test('la lista de archivos escaneados incluye las pantallas, los ejercicios y los textos de core/', () => {
  for (const f of ['ui/views/settings.js', 'ui/views/notFound.js', 'ui/views/sesion.js', 'ui/exercises/clozeBank.js', 'ui/components/_text.js', 'core/masteryExplain.js', 'core/session.config.js']) assert.ok(SCANNED.includes(f), f);
  assert.ok(SCANNED.length > 40, String(SCANNED.length));
});

test('ningún literal de texto de ui/ ni de los textos de core/ que ve la persona lleva culpa', () => {
  const hits = [];
  for (const f of SCANNED) { assert.ok(fs.existsSync(path.join(root, f)), f); hits.push(...scanFile(f)); }
  assert.deepEqual(hits, []);
});
