// Tema de la app (subparte 0.4). La elección guardada llega con Ajustes (0.8); hasta entonces solo se SUGIERE
// el tema inicial con prefers-color-scheme y se acepta ?tema=<nombre> (útil para pruebas y capturas).
import { DEFAULT_THEME } from './config.js';

export const THEMES = ['aurora', 'neo', 'claro'];

export function isTheme(name) {
  return typeof name === 'string' && THEMES.includes(name);
}

// matchMedia puede no existir o lanzar; en ese caso se usa el tema por defecto.
export function suggestedTheme(matchMedia) {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) return 'claro';
  } catch (e) {
    console.error('No se pudo leer prefers-color-scheme', e);
  }
  return DEFAULT_THEME;
}

export function initialTheme(win) {
  let wanted = null;
  try {
    wanted = new URLSearchParams(win.location.search).get('tema');
  } catch (e) {
    console.error('No se pudo leer ?tema=', e);
  }
  return isTheme(wanted) ? wanted : suggestedTheme(win.matchMedia ? win.matchMedia.bind(win) : null);
}

// Aplica el tema al documento y alinea el color de la barra del navegador (theme-color) con --bg.
export function applyTheme(doc, win, name) {
  if (!isTheme(name)) throw new Error(`Tema desconocido: ${String(name)}`);
  doc.documentElement.setAttribute('data-theme', name);
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = win.getComputedStyle(doc.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}
