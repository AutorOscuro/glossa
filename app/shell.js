// Shell de la app (subparte 0.4): arma la pantalla, conecta router → vistas, navegación, avisos y errores.
// main.js solo llama a startApp(); todo lo demás vive aquí para poder probarlo con un DOM falso.
//
//   startApp({ doc, win, version, views?, routerLog?, log?, timers? }) → { router, toast, toastStack, services, show(match), showError(error), destroy() }
//   - Cada cambio de ruta: destruye la vista anterior (sin fugas), monta la nueva, marca la pestaña activa,
//     actualiza el título, recuerda y restaura el desplazamiento de cada pantalla y mueve el foco al contenido.
//   - Una vista que lanza al montar NO tumba la app: se muestra la pantalla de error (Reintentar / Copiar detalle) y la
//     navegación inferior sigue funcionando. Los errores no capturados (error / unhandledrejection) hacen lo mismo.
//   - Si se navega mientras una vista asíncrona aún se monta, el resultado viejo se descarta (sin "parpadeos").
import { APP_NAME } from './config.js';
import { createRouter } from './router.js';
import { applyTheme, initialTheme } from './theme.js';
import { h as domH } from '../ui/dom.js';
import { createBottomNav } from '../ui/components/bottomNav.js';
import { createToaster } from '../ui/components/toast.js';
import { renderErrorScreen } from '../ui/components/errorBoundary.js';
import hoy from '../ui/views/hoy.js';
import mapa from '../ui/views/mapa.js';
import practicar from '../ui/views/practicar.js';
import errores from '../ui/views/errores.js';
import mas from '../ui/views/mas.js';
import sesion from '../ui/views/sesion.js';
import tema from '../ui/views/tema.js';
import ajustes from '../ui/views/settings.js';
import onboarding from '../ui/views/onboarding.js';
import notFound from '../ui/views/notFound.js';

export const VIEWS = { hoy, mapa, practicar, errores, mas, sesion, tema, ajustes, onboarding, 404: notFound };

const IGNORED_MESSAGES = [/ResizeObserver loop/i];

function routeKey(match) {
  return `${match.name}:${JSON.stringify(match.params)}`;
}

export function startApp({ doc, win, version, views = VIEWS, log = console.error, timers } = {}) {
  if (!doc || !win) throw new Error('startApp: se necesitan doc y win');
  const mountPoint = doc.getElementById('app');
  if (!mountPoint) throw new Error('startApp: falta <div id="app"> en index.html');
  const { h } = domH.with(doc);

  applyTheme(doc, win, initialTheme(win));

  const main = h('main', { id: 'view', class: 'app-main', tabindex: '-1' });
  const nav = createBottomNav({ doc });
  const toastStack = h('div', { class: 'toast-stack', 'aria-live': 'polite' });
  const toast = createToaster({ doc, container: toastStack, timers });
  mountPoint.replaceChildren(h('div', { class: 'app-shell' }, main, nav.el), toastStack);

  let seq = 0;
  let currentView = null;
  let currentMatch = null;
  let errorShown = false;
  const scrollMemory = new Map();

  const services = { toast, version, navigate: (name, params, options) => router.navigate(name, params, options) };

  function teardown() {
    const view = currentView;
    currentView = null;
    if (!view) return;
    try {
      view.destroy();
    } catch (e) {
      log('Error al destruir la vista', e);
    }
  }

  function showError(error, match = currentMatch) {
    log('Error en la app', error);
    teardown();
    seq += 1; // invalida cualquier montaje asíncrono pendiente
    errorShown = true;
    main.replaceChildren(
      renderErrorScreen({
        doc, error, version, route: match ? `#${match.path}` : '?', now: new Date(),
        clipboard: win.navigator?.clipboard, log,
        onRetry: () => { if (match) show(match); else win.location.reload(); },
      }),
    );
  }

  async function show(match, { initial = false } = {}) {
    const token = (seq += 1);
    if (currentMatch && currentView) scrollMemory.set(routeKey(currentMatch), win.scrollY ?? 0);
    teardown();
    errorShown = false;
    currentMatch = match;
    nav.setActive(match.tab);
    doc.title = `${match.title} · ${APP_NAME}`;

    const factory = views[match.name] ?? views['404'];
    const params = match.name === '404' ? { ...match.params, requested: match.requested } : match.params;
    main.replaceChildren();
    const view = factory();
    currentView = view;
    try {
      // Una vista síncrona se muestra, se desplaza y toma el foco en el mismo instante (sin esperar un ciclo).
      const pending = view.mount(main, params, services);
      if (pending && typeof pending.then === 'function') await pending;
    } catch (e) {
      if (token === seq) showError(e, match);
      else log('Una vista obsoleta falló al montar', e);
      return;
    }
    if (token !== seq) return; // se navegó a otra pantalla mientras esta se montaba
    // 'instant' ignora el scroll-behavior: smooth de base.css: al volver a una pestaña no debe verse un "deslizamiento".
    if (typeof win.scrollTo === 'function') win.scrollTo({ top: scrollMemory.get(routeKey(match)) ?? 0, left: 0, behavior: 'instant' });
    if (!initial && typeof main.focus === 'function') main.focus({ preventScroll: true });
  }

  let first = true;
  const router = createRouter({
    win,
    log,
    onChange: (match) => {
      const initial = first;
      first = false;
      return show(match, { initial });
    },
  });

  const onWinError = (event) => {
    const message = String(event?.message ?? '');
    if (IGNORED_MESSAGES.some((re) => re.test(message))) return;
    if (errorShown) return;
    showError(event?.error ?? (message || 'Error desconocido'));
  };
  const onRejection = (event) => {
    if (errorShown) return;
    showError(event?.reason ?? 'Promesa rechazada sin motivo');
  };
  win.addEventListener('error', onWinError);
  win.addEventListener('unhandledrejection', onRejection);

  router.start();
  doc.documentElement.dataset.booted = '1';
  const boot = doc.getElementById('boot');
  if (boot) boot.remove();

  return {
    router,
    toast,
    toastStack, // contenedor de avisos (lo usa el aviso de actualización de la 0.6)
    services, // mismo objeto que reciben las vistas; main.js le añade `storage` y `db` cuando abre la base (0.7)
    show,
    showError,
    destroy() {
      router.stop();
      win.removeEventListener('error', onWinError);
      win.removeEventListener('unhandledrejection', onRejection);
      teardown();
      toast.destroy();
      nav.destroy();
      mountPoint.replaceChildren();
    },
  };
}
