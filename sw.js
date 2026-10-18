/* Service worker de Sophia Inglés (subparte 0.6). Script CLÁSICO (sin import).
   No edites a mano la línea CACHE_VERSION: la escribe tools/build-manifest.mjs (npm run build).

   Estrategias:
   · Shell (index.html, app/, core/, ui/, vendor/, icons/, content/taxonomy/): se PRECACHEA al instalar, leyendo
     asset-manifest.json, y se sirve primero desde la caché (funciona sin conexión tras la primera carga).
   · content/packs/*: stale-while-revalidate (responde rápido con lo guardado y se actualiza en segundo plano).
   · audio/*: primero caché, con tope de entradas (los más antiguos se descartan). Las peticiones con Range no se tocan.
   · Todo lo que no sea de este mismo origen (APIs de IA, Azure…) NO se intercepta ni se guarda jamás.
   · sw.js y asset-manifest.json nunca se cachean (así el navegador ve las versiones nuevas).
   Actualización: la versión nueva se instala en segundo plano y ESPERA. No se activa sola ni recarga la página: la app
   ofrece "Actualizar" y entonces manda { type: 'SKIP_WAITING' } (nunca se corta una sesión de estudio). */

const CACHE_VERSION = 'sophia-shell-0.9.0-fddcb403'; // build-manifest:cache-version
const SHELL_PREFIX = 'sophia-shell-';
const PACKS_CACHE = 'sophia-packs-v1';
const AUDIO_CACHE = 'sophia-audio-v1';
const AUDIO_MAX_ENTRIES = 60;
const MANIFEST_PATH = 'asset-manifest.json';
const SW_PATH = 'sw.js';

const BASE = new URL('./', self.location.href); // carpeta del sw.js = alcance (funciona en subcarpetas de GitHub Pages)
const abs = (path) => new URL(path, BASE).href;

async function precache() {
  const res = await fetch(new Request(abs(MANIFEST_PATH), { cache: 'no-store' }));
  if (!res.ok) throw new Error(`no pude leer ${MANIFEST_PATH} (${res.status})`);
  const manifest = await res.json();
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error(`${MANIFEST_PATH} no es válido`);
  // sw.js y asset-manifest.json salen del mismo build; si no coinciden hay una subida a medias: no instalar.
  if (manifest.cacheVersion !== CACHE_VERSION) throw new Error(`sw.js (${CACHE_VERSION}) y ${MANIFEST_PATH} (${manifest.cacheVersion}) no coinciden`);
  const cache = await caches.open(CACHE_VERSION);
  try {
    await Promise.all(manifest.files.map(async (file) => {
      // cache: 'reload' salta la caché HTTP (GitHub Pages guarda archivos unos minutos) para no mezclar versiones.
      const r = await fetch(new Request(abs(file.path), { cache: 'reload' }));
      if (!r.ok) throw new Error(`no pude descargar ${file.path} (${r.status})`);
      await cache.put(abs(file.path), r);
    }));
  } catch (error) {
    await caches.delete(CACHE_VERSION); // sin caché a medias
    throw error;
  }
}

self.addEventListener('install', (event) => {
  // Sin skipWaiting: la versión nueva espera a que la persona toque "Actualizar".
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(SHELL_PREFIX) && n !== CACHE_VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', cacheVersion: CACHE_VERSION });
});

// Qué hacer con una petición: 'ignore' (la resuelve el navegador) | 'navigate' | 'packs' | 'audio' | 'shell'.
function classify(request) {
  if (request.method !== 'GET') return 'ignore';
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return 'ignore';
  if (request.headers.get('range')) return 'ignore';
  const path = url.pathname.slice(BASE.pathname.length);
  if (path === SW_PATH || path === MANIFEST_PATH) return 'ignore';
  if (request.mode === 'navigate') return 'navigate';
  if (path.startsWith('content/packs/')) return 'packs';
  if (path.startsWith('audio/')) return 'audio';
  return 'shell';
}

const offline = () => new Response('Sin conexión y este archivo no está guardado.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

async function fromShell(request) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(request); // archivo fuera del shell: se pide a la red pero no se guarda
  } catch {
    return offline();
  }
}

async function fromNavigate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(abs('index.html'));
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch {
    return offline();
  }
}

async function packs(event) {
  const cache = await caches.open(PACKS_CACHE);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request).then(async (res) => {
    if (res.ok) await cache.put(event.request, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {})); // la actualización en segundo plano puede fallar sin molestar
    return cached;
  }
  return refresh; // sin copia guardada: si no hay red, el error llega a la app para que lo explique
}

async function audio(event) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  if (res.ok && res.status === 200) {
    await cache.put(event.request, res.clone());
    const keys = await cache.keys(); // orden de inserción: los primeros son los más antiguos
    for (const old of keys.slice(0, Math.max(0, keys.length - AUDIO_MAX_ENTRIES))) await cache.delete(old);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const kind = classify(event.request);
  if (kind === 'ignore') return;
  if (kind === 'navigate') event.respondWith(fromNavigate(event.request));
  else if (kind === 'packs') event.respondWith(packs(event));
  else if (kind === 'audio') event.respondWith(audio(event));
  else event.respondWith(fromShell(event.request));
});
