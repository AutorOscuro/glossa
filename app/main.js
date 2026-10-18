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
  // Primer arranque (0.8): si aún no se vio la bienvenida y se abrió la puerta de entrada, se lleva a #/bienvenida (una sola vez).
  startFirstRun({ settingsReady: app.services.settingsReady, router: app.router, initialHash });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
} catch (e) {
  console.error('No se pudo iniciar la app', e);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'No se pudo iniciar la app. Recarga la página.';
}
