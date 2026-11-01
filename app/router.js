// @purpose: Router por hash: tabla de rutas, resolución de #/ruta, construcción de enlaces y escucha de cambios.
// Router por hash (subparte 0.4). Rutas: #/hoy #/mapa #/practicar #/errores #/mas #/sesion/:id #/tema/:id #/ajustes #/bienvenida #/404
//
//   ROUTES                         tabla de rutas { name, path, tab, title }
//   resolveHash(hash)              PURA. → { name, path, params, query, tab, title, requested?, redirect? }
//                                  Nunca lanza: hash raro, malformado o larguísimo → ruta '404' (con `requested`).
//                                  Hash vacío o '#/' → { redirect: '#/hoy', … }.
//   buildHref(name, params?)       '#/tema/gram.pp' (codifica los parámetros); lanza si falta un parámetro o la ruta no existe.
//   createRouter({ win, onChange, log? })  → { start(), stop(), navigate(name, params?, { replace }?), current() }
//                                  navigate con { replace: true } REEMPLAZA la entrada actual del historial (no deja una entrada atrás).
//                                  win se inyecta (window real o falso). El botón atrás/adelante funciona porque
//                                  se escucha 'hashchange'; no se vuelve a emitir si la ruta no cambió.

export const ROUTES = [
  { name: 'hoy', path: '/hoy', tab: 'hoy', title: 'Hoy' },
  { name: 'mapa', path: '/mapa', tab: 'mapa', title: 'Mapa' },
  { name: 'practicar', path: '/practicar', tab: 'practicar', title: 'Practicar' },
  { name: 'errores', path: '/errores', tab: 'errores', title: 'Errores' },
  { name: 'mas', path: '/mas', tab: 'mas', title: 'Más' },
  { name: 'sesion', path: '/sesion/:id', tab: 'practicar', title: 'Sesión' },
  { name: 'tema', path: '/tema/:id', tab: 'mapa', title: 'Tema' },
  { name: 'ajustes', path: '/ajustes', tab: 'mas', title: 'Ajustes' },
  { name: 'onboarding', path: '/bienvenida', tab: null, title: 'Bienvenida' },
  { name: '404', path: '/404', tab: null, title: 'No encontrada' },
];

const MAX_HASH_LENGTH = 2000;

function segmentsOf(path) {
  return path.split('/').filter((s) => s !== '');
}

const COMPILED = ROUTES.map((r) => ({ ...r, segments: segmentsOf(r.path) }));
const NOT_FOUND = COMPILED.find((r) => r.name === '404');

function notFound(requested) {
  return { name: '404', path: '/404', params: {}, query: {}, tab: null, title: NOT_FOUND.title, requested };
}

function parseQuery(search) {
  const query = {};
  try {
    for (const [k, v] of new URLSearchParams(search)) if (!(k in query)) query[k] = v;
  } catch (e) {
    console.error('Consulta del hash ilegible', e);
  }
  return query;
}

export function resolveHash(hash) {
  const raw = typeof hash === 'string' ? hash : '';
  if (raw.length > MAX_HASH_LENGTH) return notFound(raw.slice(0, 80));

  let rest = raw.replace(/^#/, '');
  const qIndex = rest.indexOf('?');
  const search = qIndex === -1 ? '' : rest.slice(qIndex + 1);
  if (qIndex !== -1) rest = rest.slice(0, qIndex);

  const parts = segmentsOf(rest);
  if (parts.length === 0) {
    return { name: 'hoy', path: '/hoy', params: {}, query: parseQuery(search), tab: 'hoy', title: 'Hoy', redirect: '#/hoy' };
  }

  for (const route of COMPILED) {
    if (route.segments.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length && ok; i += 1) {
      const want = route.segments[i];
      if (want.startsWith(':')) {
        try {
          params[want.slice(1)] = decodeURIComponent(parts[i]);
        } catch {
          ok = false; // %E0 y similares: texto mal codificado → 404
        }
      } else if (want !== parts[i].toLowerCase()) {
        ok = false;
      }
    }
    if (ok) return { name: route.name, path: route.path, params, query: parseQuery(search), tab: route.tab, title: route.title };
  }
  return notFound(`#/${parts.join('/')}`);
}

export function buildHref(name, params = {}) {
  const route = COMPILED.find((r) => r.name === name);
  if (!route) throw new Error(`buildHref: la ruta "${String(name)}" no existe`);
  const segs = route.segments.map((s) => {
    if (!s.startsWith(':')) return s;
    const v = params[s.slice(1)];
    if (v === undefined || v === null || String(v) === '') throw new Error(`buildHref: falta el parámetro "${s.slice(1)}" de "${name}"`);
    return encodeURIComponent(String(v));
  });
  return `#/${segs.join('/')}`;
}

function sameRoute(a, b) {
  return a && b && a.name === b.name && a.requested === b.requested && JSON.stringify(a.params) === JSON.stringify(b.params) && JSON.stringify(a.query) === JSON.stringify(b.query);
}

export function createRouter({ win, onChange, log = console.error } = {}) {
  if (!win || typeof onChange !== 'function') throw new Error('createRouter: se necesitan win y onChange');
  let current = null;
  let started = false;

  const emit = (match) => {
    if (sameRoute(current, match)) return;
    current = match;
    try {
      onChange(match);
    } catch (e) {
      log('El manejador del router falló', e); // una vista rota no debe dejar al router muerto
    }
  };

  const onHashChange = () => handle();

  function handle() {
    let match = resolveHash(win.location.hash);
    if (match.redirect) {
      win.history.replaceState(null, '', match.redirect);
      match = { ...match, redirect: undefined };
    }
    emit(match);
  }

  return {
    start() {
      if (started) return;
      started = true;
      win.addEventListener('hashchange', onHashChange);
      handle();
    },
    stop() {
      if (!started) return;
      started = false;
      win.removeEventListener('hashchange', onHashChange);
    },
    navigate(name, params, { replace = false } = {}) {
      const href = buildHref(name, params);
      if (win.location.hash === href) return;
      if (replace) {
        // replaceState no dispara 'hashchange': se resuelve a mano.
        win.history.replaceState(null, '', href);
        if (started) handle();
        return;
      }
      win.location.hash = href;
    },
    current: () => current,
  };
}
