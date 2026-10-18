// Verifica que el repo tenga la estructura obligatoria (roadmap sección 6 y subparte 0.1).
// Uso:  node tools/check-structure.mjs [raíz]      → sale con código 1 si algo falta.
// Como módulo: import { checkStructure } from './check-structure.mjs'
//   checkStructure(root) → { ok: boolean, problems: string[] }
// Las subpartes futuras añaden aquí sus archivos cuando existan (ver DECISIONS.md, 0.1).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  'tests/_eventsContract.mjs', 'tests/events.contract.test.mjs', 'tests/browser/events-idb.entry.js', 'tests/browser/events-idb.html',
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

export function checkStructure(root) {
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
  }

  if (present.has('docs/CONTRACTS.md')) {
    const text = read(root, 'docs/CONTRACTS.md');
    for (let n = 1; n <= 16; n += 1) {
      if (!text.includes(`### 8.${n} `)) problems.push(`docs/CONTRACTS.md no tiene la sección 8.${n}`);
    }
  }

  return { ok: problems.length === 0, problems };
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
