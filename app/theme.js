// @purpose: Temas visuales: lista de temas válidos, tema inicial (Aurora o ?tema=) y aplicación al documento.
// Tema de la app (subparte 0.4). La elección guardada llega con Ajustes (0.8). Desde 0.9.3 NO se sigue al sistema:
// el tema inicial es Aurora, o ?tema=<nombre> si es válido (útil para pruebas y capturas).
import { DEFAULT_THEME } from './config.js';

export const THEMES = ['aurora', 'neo', 'claro'];

export function isTheme(name) {
  return typeof name === 'string' && THEMES.includes(name);
}

export function initialTheme(win) {
  let wanted = null;
  try {
    wanted = new URLSearchParams(win.location.search).get('tema');
  } catch (e) {
    console.error('No se pudo leer ?tema=', e);
  }
  return isTheme(wanted) ? wanted : DEFAULT_THEME;
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
