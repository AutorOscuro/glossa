// @purpose: Registro del service worker: decide si corre según el entorno y muestra el aviso de actualización.
// Registro del service worker y aviso de actualización (subparte 0.6, mitad B).
//
//   swPolicy({ hostname, search }) → { enabled, cleanup, reason }       (pura)
//       Cuándo corre el SW. Desarrollo (localhost / 127.x / ::1 / *.localhost) → NO. "?sw=off" → NO en cualquier sitio.
//       "?sw=on" → SÍ aunque sea localhost (así se prueba). Al apagarlo se limpian registros y cachés "sophia-*" viejos.
//   registerServiceWorker({ win, notice, toast?, log?, timers?, now? }) → Promise<{ status, … , destroy() }>
//       status: 'unsupported' | 'disabled' | 'registered' | 'failed'
//   Reglas de actualización (roadmap 0.6): la versión nueva se instala en segundo plano y ESPERA. Se muestra un aviso
//   fijo "Hay una actualización — Actualizar". Solo al tocar "Actualizar" se manda SKIP_WAITING y, cuando el navegador
//   confirma el cambio (controllerchange), se recarga UNA vez. Nunca se recarga solo en mitad de una sesión de estudio.
//   Si otra ventana activó la versión nueva, no se recarga: se avisa y la persona decide.
import { updateKind } from './versionCompare.js';

export const CHECK_EVERY_MS = 30 * 60 * 1000; // al volver a la app, busca versión nueva si pasaron 30 min
const VERSION_TIMEOUT_MS = 1500; // cuánto esperar a que el SW diga su versión antes de avisar sin detalle
const SWITCH_TIMEOUT_MS = 5000; // cuánto esperar el cambio de versión tras tocar "Actualizar"
const SHELL_PREFIX = 'sophia-';

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function swPolicy({ hostname = '', search = '' } = {}) {
  let flag = null;
  try {
    flag = new URLSearchParams(String(search)).get('sw');
  } catch {
    flag = null;
  }
  const host = String(hostname).toLowerCase();
  const isDev = DEV_HOSTS.has(host) || host.endsWith('.localhost') || host.startsWith('127.');
  if (flag === 'off') return { enabled: false, cleanup: true, reason: 'param-off' };
  if (flag === 'on') return { enabled: true, cleanup: false, reason: 'param-on' };
  if (isDev) return { enabled: false, cleanup: true, reason: 'dev' };
  return { enabled: true, cleanup: false, reason: 'default' };
}

async function removeOldWorkers(win, log) {
  const sw = win.navigator?.serviceWorker;
  try {
    const regs = (await sw?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const names = (await win.caches?.keys?.()) ?? [];
    await Promise.all(names.filter((n) => n.startsWith(SHELL_PREFIX)).map((n) => win.caches.delete(n)));
  } catch (e) {
    log('No pude limpiar el service worker de desarrollo', e);
  }
}

export async function registerServiceWorker({ win, notice, toast, log = console.error, timers, now = () => Date.now() } = {}) {
  if (!win || !notice) throw new Error('registerServiceWorker: se necesitan win y notice');
  const setT = timers?.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = timers?.clearTimeout ?? ((id) => clearTimeout(id));
  const sw = win.navigator?.serviceWorker;
  const policy = swPolicy({ hostname: win.location?.hostname, search: win.location?.search });

  if (!sw) return { status: 'unsupported', reason: policy.reason, destroy() {} };
  if (!policy.enabled) {
    if (policy.cleanup) await removeOldWorkers(win, log);
    return { status: 'disabled', reason: policy.reason, destroy() {} };
  }

  let reg;
  try {
    reg = await sw.register('sw.js', { updateViaCache: 'none' });
  } catch (e) {
    log('No se pudo registrar el service worker', e);
    return { status: 'failed', error: e, destroy() {} };
  }

  let destroyed = false;
  let applying = false; // la persona tocó "Actualizar"
  let reloaded = false;
  let lastCheck = now();
  let dismissedFor = null; // worker al que se le dijo "Ahora no" (no se vuelve a ofrecer en esta carga)
  let offered = null;
  const hadController = Boolean(sw.controller);
  const timersLive = new Set();
  const later = (fn, ms) => {
    const id = setT(() => { timersLive.delete(id); fn(); }, ms);
    timersLive.add(id);
    return id;
  };
  const cancel = (id) => { clearT(id); timersLive.delete(id); };

  // Pregunta la versión a un worker; responde { cacheVersion } o null si no contesta a tiempo.
  function askVersion(worker) {
    return new Promise((resolve) => {
      let timer = null;
      const onMessage = (event) => {
        if (event?.source !== worker || event?.data?.type !== 'VERSION') return;
        finish(String(event.data.cacheVersion ?? ''));
      };
      function finish(value) {
        sw.removeEventListener('message', onMessage);
        if (timer !== null) cancel(timer);
        resolve(value);
      }
      sw.addEventListener('message', onMessage);
      timer = later(() => finish(null), VERSION_TIMEOUT_MS);
      try {
        worker.postMessage({ type: 'GET_VERSION' });
      } catch {
        finish(null);
      }
    });
  }

  function apply(worker) {
    applying = true;
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {
      applying = false;
      log('No pude pedir el cambio de versión', e);
      toast?.show('danger', 'No se pudo actualizar. Cierra la app y vuelve a abrirla.');
      return;
    }
    later(() => {
      if (reloaded || destroyed) return;
      applying = false;
      toast?.show('danger', 'No se pudo actualizar todavía. Cierra la app del todo y vuelve a abrirla.');
    }, SWITCH_TIMEOUT_MS);
  }

  async function offer(worker) {
    if (destroyed || worker === offered || worker === dismissedFor) return;
    offered = worker;
    const next = await askVersion(worker);
    if (destroyed || offered !== worker || reg.waiting !== worker) return;
    const current = sw.controller ? await askVersion(sw.controller) : null;
    if (destroyed || offered !== worker || reg.waiting !== worker) return;
    const kind = next && current ? updateKind(current, next) : 'unknown';
    if (kind === 'none') return; // mismo contenido: nada que ofrecer
    const base = { onAction: () => apply(worker), onDismiss: () => { dismissedFor = worker; offered = null; } };
    if (kind === 'downgrade') {
      notice.show({
        ...base,
        message: 'Se publicó una versión MÁS ANTIGUA de la app. Suele ser un error al subir archivos. Mejor no la instales.',
        actionLabel: 'Instalar de todos modos',
        dismissLabel: 'Ahora no',
      });
      return;
    }
    notice.show({
      ...base,
      message: 'Hay una actualización disponible.',
      actionLabel: 'Actualizar',
      dismissLabel: 'Ahora no',
    });
  }

  function watch(worker) {
    const onState = () => {
      if (worker.state === 'installed' && sw.controller) offer(reg.waiting ?? worker);
      if (worker.state === 'installed' || worker.state === 'redundant' || worker.state === 'activated') worker.removeEventListener('statechange', onState);
    };
    worker.addEventListener('statechange', onState);
    onState();
  }

  const onUpdateFound = () => { if (reg.installing) watch(reg.installing); };
  reg.addEventListener('updatefound', onUpdateFound);

  const onControllerChange = () => {
    if (destroyed || reloaded) return;
    if (!hadController) return; // primera instalación: el SW toma el control, no hay nada que recargar
    if (applying) {
      reloaded = true;
      win.location.reload();
      return;
    }
    // Otra ventana de la app activó la versión nueva: esta ventana sigue con el código viejo hasta que se recargue.
    notice.show({ message: 'La app se actualizó en otra ventana. Recarga cuando termines lo que haces.', actionLabel: 'Recargar', onAction: () => { reloaded = true; win.location.reload(); } });
  };
  sw.addEventListener('controllerchange', onControllerChange);

  const onVisible = () => {
    if (win.document?.visibilityState === 'hidden') return;
    const t = now();
    if (t - lastCheck < CHECK_EVERY_MS) return;
    lastCheck = t;
    reg.update().catch(() => {}); // sin conexión es normal que falle
  };
  win.document?.addEventListener?.('visibilitychange', onVisible);

  // Estado inicial: ya hay una versión esperando de una visita anterior, o se está instalando ahora mismo.
  if (reg.waiting && sw.controller) offer(reg.waiting);
  else if (reg.installing) watch(reg.installing);
  if (!hadController) {
    // Primera visita: avisa una sola vez que ya funciona sin conexión.
    sw.ready?.then?.(() => { if (!destroyed && toast) toast.show('success', 'Lista para usar sin conexión.'); }).catch?.(() => {});
  }

  return {
    status: 'registered',
    reason: policy.reason,
    registration: reg,
    checkNow: () => { lastCheck = now(); return reg.update(); },
    destroy() {
      destroyed = true;
      reg.removeEventListener('updatefound', onUpdateFound);
      sw.removeEventListener('controllerchange', onControllerChange);
      win.document?.removeEventListener?.('visibilitychange', onVisible);
      for (const id of [...timersLive]) cancel(id);
      notice.hide();
    },
  };
}
