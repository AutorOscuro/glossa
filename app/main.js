// @purpose: Punto de entrada de la app: conecta el navegador con startApp, el almacenamiento, los ajustes, el primer arranque y el service worker.
// Arranque de la app (subparte 0.4). Toda la lógica está en shell.js; aquí solo se conecta con el navegador.
// Desde la 0.6 también registra el service worker (app/swRegister.js). Modo desarrollo: en localhost el SW NO corre;
// "?sw=off" lo apaga en cualquier sitio y "?sw=on" lo fuerza (ver docs/DEPLOY.md).
import { VERSION } from '../core/version.js';
import { startApp } from './shell.js';
import { registerServiceWorker } from './swRegister.js';
import { createUpdateNotice } from '../ui/components/updateNotice.js';
import { DB_NAME } from './config.js';
import { startStorage } from './storage.js';
import { startSettings } from './settingsBoot.js';
import { startFirstRun } from './firstRun.js';
import { startServices } from './services.js';
import { startContent } from './contentStartup.js';
import { createItemResolver } from './itemResolver.js';
import { createHelpServices } from './helpServices.js';
import { lazyCardActions } from './cardActions.js';
import { lazyItemReport } from './itemReportLazy.js';
import { lazyWhyNote } from './whyNoteLazy.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerExerciseTypes } from './exerciseTypes.js';

try {
  const initialHash = window.location.hash; // antes de que el router lo normalice: distingue "abrió la app" de "abrió un enlace"
  const app = startApp({ doc: document, win: window, version: VERSION });
  const start = () => {
    const notice = createUpdateNotice({ doc: document, container: app.toastStack });
    // El SW es un extra: si algo falla aquí, la app sigue funcionando sin conexión desactivada.
    registerServiceWorker({ win: window, notice, toast: app.toast }).catch((e) => console.error('No se pudo preparar el modo sin conexión', e));
  };
  // Almacenamiento (0.7): se abre en cuanto arranca la app. Las vistas esperan `services.storageReady`; `services.db` queda listo al terminar
  // (null si la base no se pudo abrir: en ese caso ya salió un aviso con el motivo).
  const storageNotice = createUpdateNotice({ doc: document, container: app.toastStack });
  app.services.storageReady = startStorage({ name: DB_NAME, notice: storageNotice, win: window }).then((storage) => {
    app.services.storage = storage;
    app.services.db = storage.db;
    return storage;
  });
  // Ajustes (0.8): se cargan cuando la base está lista y aplican tema y tamaño de texto en vivo. Las vistas esperan `services.settingsReady`.
  app.services.settingsReady = startSettings({ storageReady: app.services.storageReady, doc: document, win: window }).then((res) => {
    app.services.settings = res.settings;
    app.services.appearance = res.appearance;
    return res;
  });
  // Servicios de estudio (2.1-T1): eventos, repaso, errores, dominio y armador. Esperan la base y los ajustes; `services.study` queda listo al terminar
  // (con `db` null quedan solo los que no necesitan base). Las vistas esperan `services.studyReady` y leen `services.study` al usarlo.
  app.services.studyReady = startServices({ storageReady: app.services.storageReady, settingsReady: app.services.settingsReady, services: app.services });
  // Contenido (2.9-T3): al arrancar importa los paquetes a la base (tarjetas nuevas); no bloquea y nunca rechaza. `services.contentReady` guarda el resultado.
  app.services.contentReady = startContent({ storageReady: app.services.storageReady });
  // Tras «Borrar todo» o importar un respaldo la base puede quedar sin tarjetas: Ajustes llama a esto para volver a importar el paquete (idempotente).
  app.services.reimportContent = () => { app.services.contentReady = startContent({ storageReady: app.services.storageReady }); return app.services.contentReady; };
  // Registro de ejercicios (2.1-T4): los tipos (2.2 a 2.5) se registran abajo y los ítems los entrega el resolvedor de 2.9-T3; un tipo sin componente muestra «tipo no soportado todavía».
  // `cards` (2.2-T3): acciones de tarjeta para las insignias y la tarjeta de deletreo; se arman al montar cada ejercicio, cuando `services.study` ya existe.
  // Resolvedor de ítems (2.9-T3, punto 4): lee el índice y los paquetes (del precache, también sin conexión) y entrega el ítem por su id.
  app.services.itemResolver = createItemResolver({ log: console.error });
  app.services.exercises = createExerciseRegistry({ log: console.error, resolveItem: (id) => app.services.itemResolver.resolve(id), cards: lazyCardActions(() => app.services.study), report: lazyItemReport(() => app.services.study), why: lazyWhyNote(() => app.services.study) });
  // Todos los tipos de ejercicio (2.2 a 2.5) se registran en app/exerciseTypes.js: el catálogo de errores se lee al COMPROBAR la respuesta, porque `services.study` se completa tras el arranque.
  registerExerciseTypes(app.services.exercises, { catalog: () => app.services.study?.catalog ?? null, log: console.error });
  // Barra de ayudas de la sesión (2.9-T3, punto 5): Otros ejemplos, Correcciones, Preguntas IA y Diccionario. Son fachadas perezosas: leen `study`, `settings`, `db` y el resolvedor al USARLAS.
  // `ui/views/sesion.js` muestra cada botón solo si su servicio existe.
  const help = createHelpServices({ services: app.services, fetchFn: globalThis.fetch?.bind(globalThis), log: console.error });
  app.services.examples = help.examples;
  app.services.corrections = help.corrections;
  app.services.aiHelp = help.aiHelp;
  app.services.dictionary = help.dictionary;
  // Primer arranque (0.8): si aún no se vio la bienvenida y se abrió la puerta de entrada, se lleva a #/bienvenida (una sola vez).
  startFirstRun({ settingsReady: app.services.settingsReady, router: app.router, initialHash });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
} catch (e) {
  console.error('No se pudo iniciar la app', e);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'No se pudo iniciar la app. Recarga la página.';
}
