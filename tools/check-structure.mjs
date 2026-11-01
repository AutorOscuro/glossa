// @purpose: Comprueba la estructura obligatoria del repo (carpetas, archivos, versión, estado y mapa al día); sale con 1 si falta algo.
// Verifica que el repo tenga la estructura obligatoria (roadmap sección 6 y subparte 0.1).
// Uso:  node tools/check-structure.mjs [raíz]      → sale con código 1 si algo falta.
// Como módulo: import { checkStructure } from './check-structure.mjs'
//   checkStructure(root, { map = true }) → { ok: boolean, problems: string[] }
//   Con map (por defecto) exige docs/REPO_MAP.md y que `repo-map --check` pase: un mapa desactualizado falla (0.9-T3).
// Las subpartes futuras añaden aquí sus archivos cuando existan (ver DECISIONS.md, 0.1).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkMap } from './repo-map.mjs';

// Carpetas del árbol de la sección 6 (cada una debe existir y tener contenido, p. ej. .gitkeep).
export const REQUIRED_DIRS = [
  'icons', 'app', 'core', 'core/ai', 'core/speech',
  'ui', 'ui/components', 'ui/views', 'ui/exercises', 'ui/styles',
  'content', 'content/taxonomy', 'content/packs',
  'audio', 'vendor', 'tools', 'tests', 'tests/scenarios', 'docs',
];

// Archivos que debe tener el repo a partir de 0.1 (no pueden estar vacíos).
export const REQUIRED_FILES = [
  'README.md', 'PROJECT_STATE.md', 'DECISIONS.md', 'CHANGELOG.md', '.gitignore',
  'docs/ROADMAP.md', 'docs/CONTRACTS.md', 'docs/DESIGN.md',
  'core/version.js', 'app/config.js', 'tools/check-structure.mjs',
  // 0.2
  'package.json', 'tools/audit.mjs', 'tests/_helpers.mjs',
  // 0.3
  'ui/styles/tokens.css', 'ui/styles/themes.css', 'ui/styles/base.css', 'ui/styles/components.css',
  'ui/styles/demo.html', 'ui/styles/demo.css', 'ui/styles/demo.js',
  'tools/contrast.mjs', 'tools/css-lite.mjs', 'tests/design.test.mjs',
  // 0.4
  'index.html', 'app/main.js', 'app/shell.js', 'app/router.js', 'app/theme.js', 'app/boot-check.js',
  'ui/dom.js', 'ui/views/_viewBase.js', 'ui/components/bottomNav.js', 'ui/components/toast.js', 'ui/components/errorBoundary.js',
  'tests/_fakeDom.mjs', 'tests/shell.test.mjs',
  // 0.5
  'ui/components/index.js', 'ui/components/_shared.js', 'ui/components/_overlay.js', 'ui/styles/widgets.css', 'tests/ui-components.test.mjs',
  // 0.6 (mitad A: manifest, iconos, caché y service worker)
  'manifest.webmanifest', 'sw.js', 'asset-manifest.json', 'app/versionCompare.js', 'tools/build-manifest.mjs', 'tools/make-icons.py', 'tools/pwa-check.py',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon.svg', 'icons/icon-maskable.svg',
  'tests/sw.test.mjs', 'tests/build-manifest.test.mjs', 'tests/pwa.test.mjs', 'tests/versionCompare.test.mjs',
  // 0.6 (mitad B: registro del SW, aviso de actualización y guía de despliegue)
  'app/swRegister.js', 'ui/components/updateNotice.js', 'docs/DEPLOY.md', 'tests/swRegister.test.mjs', 'tests/scenarios/0.6.md', '.nojekyll',
  // 0.7 (mitad A: contrato, motor en memoria, migraciones, reloj, azar y store; el motor de IndexedDB llega en la mitad B)
  'core/db.js', 'core/dbErrors.js', 'core/db.memory.js', 'core/db.idb.js', 'core/settings.js', 'tests/settings.test.mjs', 'core/dbOpen.js', 'core/persist.js', 'app/storage.js', 'tests/storage.test.mjs', 'tests/dbOpen.test.mjs', 'tests/scenarios/0.7.md', 'tools/idb-check.py', 'core/migrations.js', 'core/clock.js', 'core/rng.js', 'core/store.js',
  'tests/_dbContract.mjs', 'tests/db.contract.test.mjs', 'tests/clock-rng.test.mjs', 'tests/store.test.mjs', 'tests/migrations.test.mjs',
  // 0.8 (ajustes, bóveda de claves y bienvenida)
  'ui/components/keyField.js', 'app/appearance.js', 'app/settingsBoot.js', 'ui/views/settings.js', 'ui/views/settingsData.js', 'core/sync.js', 'app/dataTools.js', 'app/fileIO.js',
  'ui/views/onboarding.js', 'app/firstRun.js', 'tests/onboarding.test.mjs', 'tests/firstRun.test.mjs', 'tests/main.test.mjs', 'tests/settingsView.test.mjs', 'tests/settingsData.test.mjs', 'tests/scenarios/0.8.md', 'tests/scenarios/HITO_M0.md',
  // 1.1 (registro de eventos; cuarto 1: esquema y validación)
  'core/eventSchema.js', 'tests/eventSchema.test.mjs',
  // 1.1 (cuarto 2, mitad A: log atómico)
  'core/events.js', 'tests/events.test.mjs',
  // 1.1 (cuarto 2, mitad B: contrato de log sobre memoria e IndexedDB real)
  'tests/_eventsContract.mjs', 'tests/events.contract.test.mjs', 'tests/browser/events-idb.entry.js', 'tests/browser/events-idb.html', 'tests/browser/errors-idb.entry.js', 'tests/browser/errors-idb.html',
  // 1.3 (cuarto 1, mitad A: reglas comunes de contenido y Topic)
  'core/contentRules.js', 'core/contentTopic.js', 'tests/contentRules.test.mjs', 'tests/contentTopic.test.mjs',
  // 1.3 (cuarto 1, mitad B: registro de tipos, Item común, Pack, LexEntry y Story)
  'core/contentTypes.js', 'core/contentCommon.js', 'core/contentItem.js', 'core/contentLex.js', 'core/contentStory.js', 'core/contentPack.js',
  'tests/contentTypes.test.mjs', 'tests/contentItem.test.mjs', 'tests/contentLexStory.test.mjs', 'tests/contentPack.test.mjs',
  // 1.3 (cuarto 2, mitad A: `data` de las familias autocalificables)
  'core/contentData.js', 'tests/contentData.test.mjs',
  // 1.3 (cuarto 3, mitad 3A, parte 1: catálogo de códigos de error)
  'core/grading.config.js', 'core/grading.js', 'tests/grading.test.mjs', 'core/gradingBaseline.js', 'tests/gradingBaseline.test.mjs', 'core/answerTimer.js', 'app/visibility.js', 'tests/answerTimer.test.mjs', 'core/gradeAnswer.js', 'tests/gradeAnswer.test.mjs', 'tests/grading.ca.test.mjs', 'tests/grading.adversarial.test.mjs', 'core/errorCatalog.js', 'core/errors.js', 'core/errorHook.js', 'tests/errorCatalog.test.mjs', 'tests/errors.test.mjs', 'tests/errors.recurrence.test.mjs', 'tests/errors.top.test.mjs', 'tests/errorHook.test.mjs', 'core/errorDetect.js', 'tests/errorDetect.test.mjs', 'tests/errorDetect.table.test.mjs', 'tests/errorDetect.lists.test.mjs', 'tests/errorDetect.edges.test.mjs', 'tests/_errorTable.mjs', 'tests/errors.ca.test.mjs', 'core/mastery.config.js', 'core/masterySignals.js', 'tests/masterySignals.test.mjs', 'core/mastery.js', 'tests/mastery.test.mjs', 'core/masteryAgg.js', 'core/masteryBoard.js', 'core/masteryExplain.js', 'tests/masteryExplain.test.mjs', 'core/session.config.js', 'core/session.js', 'tests/session.test.mjs', 'core/sessionInterleave.js', 'tests/sessionInterleave.test.mjs', 'core/sessionProgression.js', 'core/sessionFocus.js', 'tests/sessionFocus.test.mjs', 'tests/session.ca.test.mjs', 'tests/session.integration.test.mjs', 'core/stats.js', 'core/stats.config.js', 'core/ai/index.js', 'core/ai/schema.js', 'core/ai/providers/none.js', 'core/ai/providers/groq.js', 'tests/aiBase.test.mjs', 'core/ai/queue.js', 'core/ai/messages.js', 'tests/aiQueue.test.mjs', 'tests/aiClient.test.mjs', 'tests/_aiTime.mjs', 'core/ai/cache.js', 'core/ai/escape.js', 'core/ai/prompts/system.base.js', 'tests/aiCache.test.mjs', 'tests/aiRecord.test.mjs',
  // 2.1-T3: conductor y vista de sesión (sessionRunner y sessionStore, de T1 y T2, faltaban en la lista)
  'core/sessionRunner.js', 'core/sessionStore.js', 'core/sessionDriver.js', 'tests/sessionDriver.test.mjs', 'tests/sesionView.test.mjs', 'tests/_sesionHarness.mjs', 'tests/sesionView.adversarial.test.mjs',
  // 2.1-T4: registro de ejercicios, aceptación de 2.1 y guion
  'ui/exercises/index.js', 'ui/exercises/phraseCloze.js', 'ui/exercises/cardBar.js', 'core/cardBadges.js', 'core/spellCard.js', 'app/cardActions.js', 'tests/phraseClozeBadges.test.mjs', 'core/phraseCloze.js', 'tests/phraseClozeRender.test.mjs', 'core/phraseCloze.js', 'tests/phraseClozeAnswer.test.mjs', 'tests/phraseClozeAnswer.test.mjs', 'tests/exerciseRegistry.test.mjs', 'tests/sesion.ca.test.mjs', 'tests/scenarios/2.1.md',
 'tests/ai.ca.test.mjs', 'core/tokenize.js', 'tests/tokenize.test.mjs', 'core/lemmas.js', 'core/whitelist.config.js', 'core/whitelistKnown.js', 'tests/whitelistKnown.test.mjs', 'core/whitelist.js', 'tests/whitelist.test.mjs', 'tests/whitelist.ca.test.mjs', 'tests/stats.test.mjs', 'tests/statsCards.test.mjs', 'tests/statsInfo.test.mjs', 'tests/statsPerf.test.mjs', 'tests/masteryAgg.test.mjs', 'tests/masteryBoard.test.mjs', 'tools/mutate.mjs', 'tests/mutate.test.mjs', 'ui/components/ratingButtons.js', 'tests/ratingButtons.test.mjs', 'core/srs.js', 'core/srsValid.js', 'core/srs.simple.js', 'core/srsEngine.js', 'tests/srs.simple.test.mjs', 'tests/srsEngine.test.mjs', 'tests/srs.scenario.test.mjs', 'tests/scenarios/1.4.md', 'tests/srs.test.mjs', 'core/srsLeech.js', 'core/srsRescue.js', 'tests/srs.care.test.mjs', 'tests/srs.fsrs.test.mjs', 'vendor/ts-fsrs/index.mjs', 'vendor/ts-fsrs/LICENSE', 'vendor/ts-fsrs/VERSION.txt', 'core/contentCodes.js', 'tests/contentCodes.test.mjs', 'content/taxonomy/error_codes.json',
  // 1.3 (cuarto 3, mitad 3A, parte 2: temas, ids únicos globales y avisos por tema)
  'core/contentTaxonomy.js', 'core/contentInstalled.js', 'content/taxonomy/topics.json', 'tests/contentTaxonomy.test.mjs', 'tests/contentPack.global.test.mjs',
  // 1.3 (cuarto 3, mitad 3B: validador de línea de comandos, paquete de muestra y los paquetes inválidos)
  'tools/validate-content.mjs', 'tools/contentFs.mjs', 'tests/validate-content.test.mjs', 'tests/validate-content.invalid.test.mjs', 'tests/_samplePack.mjs',
  'tests/fixtures/sample_pack_v1.json', 'tests/fixtures/taxonomy/topics.json', 'tests/fixtures/taxonomy/error_codes.json',
  // 1.3 (cuarto 4, mitad 4A, parte 1: índice y carga de paquetes)
  'core/content.js', 'tests/content.test.mjs',
  // 1.3 (cuarto 4, mitad 4A parte 2: importación a la base)
  'core/contentImport.js', 'tests/contentImport.test.mjs',
  // 1.3 (cuarto 4, mitad 4B: comando add-pack y su guía)
  'tools/add-pack.mjs', 'docs/ADD_PACK.md', 'tests/add-pack.test.mjs',
  // 0.9-T1 (herramienta del mapa del repositorio) y 0.9-T3 (el mapa y su huella; la comprobación `repo-map --check` va en checkStructure)
  'tools/repoMapParse.mjs', 'tools/repoMapTree.mjs', 'tools/repo-map.mjs', 'tools/repo-map.config.json',
  'tests/repoMap.parse.test.mjs', 'tests/repoMap.tree.test.mjs', 'tests/repoMap.map.test.mjs', 'tests/repoMap.real.test.mjs',
  'docs/REPO_MAP.md', 'docs/REPO_MAP.hashes',
];

// Secciones obligatorias de PROJECT_STATE.md (subparte 0.1).
export const STATE_SECTIONS = [
  'Tablero de subpartes', 'Siguiente subparte', 'Bugs conocidos',
  'Pendiente de verificación por William', 'Preguntas abiertas para el Administrador',
  'Contratos modificados', 'Cola de pruebas manuales',
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

export function checkStructure(root, { map = true } = {}) {
  const problems = [];
  if (typeof root !== 'string' || root === '' || !fs.existsSync(root)) {
    return { ok: false, problems: [`La carpeta raíz no existe: ${String(root)}`] };
  }

  for (const d of REQUIRED_DIRS) {
    const p = path.join(root, d);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
      problems.push(`Falta la carpeta: ${d}/`);
    } else if (fs.readdirSync(p).length === 0) {
      problems.push(`La carpeta está vacía (falta .gitkeep): ${d}/`);
    }
  }

  const present = new Set();
  for (const f of REQUIRED_FILES) {
    const p = path.join(root, f);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      problems.push(`Falta el archivo: ${f}`);
    } else if (fs.statSync(p).size === 0) {
      problems.push(`El archivo está vacío: ${f}`);
    } else {
      present.add(f);
    }
  }

  if (present.has('core/version.js')) {
    const m = read(root, 'core/version.js').match(/export const VERSION = '(\d+\.\d+\.\d+)';/);
    if (!m) problems.push("core/version.js debe contener: export const VERSION = 'X.Y.Z';");
  }

  if (present.has('package.json')) {
    let pkg = null;
    try { pkg = JSON.parse(read(root, 'package.json')); } catch { problems.push('package.json no es JSON válido'); }
    if (pkg) {
      for (const s of ['test', 'audit', 'check']) {
        if (typeof pkg.scripts?.[s] !== 'string') problems.push(`package.json no define el script: ${s}`);
      }
      if (pkg.dependencies || pkg.devDependencies) problems.push('package.json no debe tener dependencias (roadmap 0.2)');
      if (pkg.type !== 'module') problems.push('package.json debe declarar "type": "module"');
      const v = present.has('core/version.js') ? read(root, 'core/version.js').match(/VERSION = '(\d+\.\d+\.\d+)'/) : null;
      if (v && pkg.version !== v[1]) problems.push(`package.json (${pkg.version}) y core/version.js (${v[1]}) tienen versiones distintas`);
    }
  }

  if (present.has('PROJECT_STATE.md')) {
    const text = read(root, 'PROJECT_STATE.md');
    for (const s of STATE_SECTIONS) {
      if (!text.includes(s)) problems.push(`PROJECT_STATE.md no tiene la sección: ${s}`);
    }
    if (!/\|\s*0\.1\s*\|/.test(text)) problems.push('PROJECT_STATE.md: el tablero no incluye la subparte 0.1');
    if (!/\|\s*9\.8\s*\|/.test(text)) problems.push('PROJECT_STATE.md: el tablero no incluye la subparte 9.8');
    if (!/\|\s*C13\s*\|/.test(text)) problems.push('PROJECT_STATE.md: el tablero no incluye el lote C13');
    if (!/^## \d+\. Contenido\b/m.test(text)) problems.push('PROJECT_STATE.md no tiene la sección: Contenido');
    // Roadmap sección 0: la versión y el sha256 anotados deben ser los del docs/ROADMAP.md del repo.
    const line = text.match(/^.*Versión del roadmap: (\S+) \(sha256 (\S+)\)/m);
    if (!line || !/^[0-9a-f]{64}$/.test(line[2])) {
      problems.push('PROJECT_STATE.md debe tener la línea: Versión del roadmap: x.y (sha256 <64 hex>)');
    } else if (present.has('docs/ROADMAP.md')) {
      const road = fs.readFileSync(path.join(root, 'docs/ROADMAP.md'));
      const head = road.toString('utf8').match(/\*\*Versión del roadmap:\*\*\s*(\d+\.\d+)/);
      if (!head) problems.push('docs/ROADMAP.md no trae la cabecera "Versión del roadmap"');
      else if (head[1] !== line[1]) problems.push(`PROJECT_STATE.md anota la versión del roadmap ${line[1]} pero docs/ROADMAP.md es ${head[1]}`);
      const sha = crypto.createHash('sha256').update(road).digest('hex');
      if (sha !== line[2]) problems.push(`PROJECT_STATE.md anota un sha256 del roadmap distinto del de docs/ROADMAP.md (${sha})`);
    }
  }

  if (present.has('docs/CONTRACTS.md')) {
    const text = read(root, 'docs/CONTRACTS.md');
    for (let n = 1; n <= 16; n += 1) {
      if (!text.includes(`### 8.${n} `)) problems.push(`docs/CONTRACTS.md no tiene la sección 8.${n}`);
    }
  }

  if (map && present.has('docs/REPO_MAP.md') && present.has('docs/REPO_MAP.hashes')) problems.push(...mapProblems(root));

  return { ok: problems.length === 0, problems };
}

// Comprobación mecánica del mapa (roadmap 0.9): el tree-hash guardado debe ser el del árbol actual.
function mapProblems(root) {
  let r;
  try { r = checkMap({ root }); } catch (e) { return [`No se pudo comprobar el mapa del repositorio: ${e?.message ?? e}`]; }
  if (r.ok) return [];
  if (r.problem) return [`Mapa del repositorio: ${r.problem}`];
  const { created, modified, deleted } = r.diff;
  const list = (mark, a) => a.slice(0, 5).map((f) => `${mark} ${f}`).join(', ') + (a.length > 5 ? ` … (+${a.length - 5})` : '');
  const parts = [['+', created], ['~', modified], ['-', deleted]].filter(([, a]) => a.length > 0).map(([m, a]) => list(m, a));
  return [`El mapa del repositorio está desactualizado (ejecuta npm run map): ${parts.join(' | ')}`];
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(process.argv[2] ?? path.join(here, '..'));
  const { ok, problems } = checkStructure(root);
  if (ok) {
    process.stdout.write('✔ Estructura del repo completa.\n');
    return 0;
  }
  process.stderr.write(`✘ La estructura del repo tiene ${problems.length} problema(s):\n`);
  for (const p of problems) process.stderr.write(`  - ${p}\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
