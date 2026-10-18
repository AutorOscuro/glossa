// Primer arranque (subparte 0.8, cuarto 4B): lleva a la bienvenida UNA sola vez al abrir la app si aún no se ha visto.
//
//   startFirstRun({ settingsReady, router, initialHash, log? }) → Promesa de un motivo (texto). NUNCA rechaza.
//     'redirected'        se llevó a #/bienvenida (reemplaza la entrada del historial: "atrás" no vuelve a la pantalla vacía de Hoy).
//     'skipped:done'      ya se vio la bienvenida (settings.onboardingDone).
//     'skipped:deep-link' la persona abrió a propósito otra pantalla (un enlace a #/ajustes, #/sesion/…): no se le quita.
//     'skipped:moved'     mientras cargaban los ajustes ya fue a otra pantalla: tampoco se le quita.
//     'skipped:no-settings' los ajustes no cargaron: no se adivina, no se redirige.
//     'skipped:again'     ya se llamó antes en esta carga (solo se decide una vez).
//   · "Puerta de entrada" = hash vacío, '#/' o '#/hoy' (también el inicio de la app instalada, start_url './').
//   · Se decide UNA vez al cargar: lo que pase después (p. ej. "Borrar todo" vuelve onboardingDone a falso) no redirige;
//     la bienvenida sale la próxima vez que se abra la app.
//   · Con ajustes solo en memoria (la base no abrió) también aplica: onboardingDone será falso en cada apertura.
import { resolveHash } from './router.js';

let called = false;

export function isFrontDoor(hash) {
  return resolveHash(typeof hash === 'string' ? hash : '').name === 'hoy';
}

export function resetFirstRunForTests() {
  called = false;
}

export async function startFirstRun({ settingsReady, router, initialHash = '', log = console.error } = {}) {
  if (called) return 'skipped:again';
  called = true;
  try {
    const settings = (await settingsReady)?.settings ?? null;
    if (!settings) return 'skipped:no-settings';
    if (settings.get('onboardingDone') === true) return 'skipped:done';
    if (!isFrontDoor(initialHash)) return 'skipped:deep-link';
    if (router.current()?.name !== 'hoy') return 'skipped:moved';
    router.navigate('onboarding', undefined, { replace: true });
    return 'redirected';
  } catch (e) {
    log('Primer arranque: no se pudo decidir si mostrar la bienvenida', e?.code ?? e);
    return 'skipped:no-settings';
  }
}
