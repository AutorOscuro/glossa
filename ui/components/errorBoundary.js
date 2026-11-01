// @purpose: Pantalla de error amable y texto de detalle copiable para reportes.
// Pantalla de error amable (subparte 0.4). Se usa cuando una vista falla o hay un error no capturado.
//
//   formatErrorDetail(error, { version, route, now }) → texto para pegar en un reporte (acepta Error, texto, null, objetos).
//   renderErrorScreen({ doc?, error, version, route, now, onRetry, clipboard?, log? }) → elemento
//        Botones: "Reintentar" (llama onRetry) y "Copiar detalle". Si no se puede copiar, el detalle queda en un
//        cuadro de texto de solo lectura para copiarlo a mano. Todo texto entra como texto, nunca como HTML.
import { h as domH } from '../dom.js';

const MAX_STACK = 1200;

export function formatErrorDetail(error, { version = '?', route = '?', now = new Date() } = {}) {
  let message;
  let stack = '';
  if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
    stack = String(error.stack ?? '');
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error) ?? String(error);
    } catch {
      message = String(error);
    }
  }
  const when = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : '?';
  const lines = [`Versión: ${version}`, `Ruta: ${route}`, `Fecha: ${when}`, `Error: ${message}`];
  if (stack) lines.push(`Detalle técnico:\n${stack.slice(0, MAX_STACK)}`);
  return lines.join('\n');
}

export function renderErrorScreen({ doc = globalThis.document, error, version, route, now, onRetry, clipboard, log = console.error } = {}) {
  const { h } = domH.with(doc);
  const detail = formatErrorDetail(error, { version, route, now });
  const status = h('p', { class: 'text-sm text-muted', role: 'status' });
  let fallbackBox = null;

  const showManualCopy = () => {
    if (fallbackBox) return;
    fallbackBox = h('textarea', { class: 'input error-screen__detail', readonly: true, rows: 6, 'aria-label': 'Detalle del error' });
    fallbackBox.value = detail;
    status.textContent = 'No se pudo copiar solo. Mantén pulsado el texto de abajo y elige "Copiar".';
    status.after(fallbackBox);
    if (typeof fallbackBox.select === 'function') fallbackBox.select();
  };

  const onCopy = async () => {
    try {
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Portapapeles no disponible');
      await clipboard.writeText(detail);
      status.textContent = 'Detalle copiado. Pégalo en el chat para reportarlo.';
    } catch (e) {
      log('No se pudo copiar el detalle del error', e);
      showManualCopy();
    }
  };

  const retryBtn = h('button', { type: 'button', class: 'btn btn--primary', onClick: () => { if (typeof onRetry === 'function') onRetry(); } }, 'Reintentar');
  const copyBtn = h('button', { type: 'button', class: 'btn btn--secondary', onClick: onCopy }, 'Copiar detalle');

  return h('section', { class: 'stack stack--lg view error-screen', role: 'alert' },
    h('h1', { class: 'view__title' }, 'Algo no salió bien'),
    h('div', { class: 'card stack' },
      h('p', { class: 'card__title' }, 'Esta pantalla tuvo un problema.'),
      h('p', { class: 'text-sm text-muted' }, 'Prueba con "Reintentar". Si se repite, toca "Copiar detalle" y pégalo en el chat.'),
      h('div', { class: 'row' }, retryBtn, copyBtn),
      status,
    ),
  );
}
