/* demo.js — comportamiento de la galería (demo.html). Solo para inspección visual; no es parte de la app.
   Script clásico (no módulo) para que también abra desde archivo local. Sin innerHTML ni estilos en línea:
   funciona bajo la CSP del roadmap (8.16). */
(function () {
  'use strict';

  var THEMES = ['aurora', 'neo', 'claro'];
  var root = document.documentElement;

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // ---------- Tema ----------
  // prefers-color-scheme solo SUGIERE el tema inicial; después manda lo que elija la persona.
  function suggestedTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'aurora';
    } catch (e) {
      console.error('No se pudo leer prefers-color-scheme', e);
      return 'aurora';
    }
  }

  function initialTheme() {
    var wanted = new URLSearchParams(window.location.search).get('tema');
    return THEMES.indexOf(wanted) !== -1 ? wanted : suggestedTheme();
  }

  function setTheme(name) {
    if (THEMES.indexOf(name) === -1) return;
    root.setAttribute('data-theme', name);
    qsa('[data-theme-btn]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme-btn') === name ? 'true' : 'false');
    });
    var meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    updateReadout();
  }

  function updateReadout() {
    var el = qs('#readout');
    if (!el) return;
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { console.error(e); }
    var base = getComputedStyle(root).fontSize;
    el.textContent = 'Tema: ' + root.getAttribute('data-theme') + ' · Pantalla: ' + window.innerWidth + ' × ' +
      window.innerHeight + ' px · Letra base: ' + base + (reduced ? ' · Movimiento reducido' : '');
  }

  // ---------- Chips con selección ----------
  qsa('#chips .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });

  // ---------- Progreso (el ancho se fija por CSSOM, permitido por la CSP) ----------
  function setProgress(el, value) {
    var v = Math.max(0, Math.min(100, Math.round(value)));
    el.style.setProperty('--value', String(v));
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('data-value', String(v));
  }
  qsa('.progress[data-value]').forEach(function (el) { setProgress(el, Number(el.getAttribute('data-value'))); });

  var more = qs('#progress-more');
  if (more) {
    more.addEventListener('click', function () {
      var first = qs('.progress[data-value]');
      var next = Number(first.getAttribute('data-value')) + 10;
      setProgress(first, next > 100 ? 0 : next);
      qs('#progress-text').textContent = first.getAttribute('data-value') + ' %';
    });
  }

  // ---------- Hoja inferior ----------
  var sheet = qs('#sheet');
  var backdrop = qs('#sheet-backdrop');
  var lastFocus = null;

  function openSheet() {
    lastFocus = document.activeElement;
    sheet.classList.add('is-open');
    backdrop.classList.add('is-open');
    root.classList.add('no-scroll');
    sheet.focus();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    root.classList.remove('no-scroll');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function trapTab(e) {
    var items = qsa('#sheet button, #sheet [href], #sheet input, #sheet [tabindex]:not([tabindex="-1"])');
    if (items.length === 0) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  qs('#open-sheet').addEventListener('click', openSheet);
  qs('#close-sheet').addEventListener('click', closeSheet);
  qs('#sheet-ok').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (!sheet.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') trapTab(e);
  });

  // ---------- Avisos ----------
  var ICONS = { info: 'i', success: '✓', danger: '!' };
  var TEXTS = {
    info: 'Tu repaso de mañana ya está listo.',
    success: 'Respuesta guardada.',
    danger: 'No se pudo guardar. Inténtalo de nuevo.',
  };
  var MAX_TOASTS = 3;

  function showToast(kind) {
    var stack = qs('#toasts');
    while (stack.children.length >= MAX_TOASTS) stack.removeChild(stack.firstElementChild);
    var el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
    var icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[kind];
    var text = document.createElement('span');
    text.className = 'grow';
    text.textContent = TEXTS[kind];
    el.appendChild(icon);
    el.appendChild(text);
    stack.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  qsa('[data-toast]').forEach(function (btn) {
    btn.addEventListener('click', function () { showToast(btn.getAttribute('data-toast')); });
  });

  // ---------- Arranque ----------
  qsa('[data-theme-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () { setTheme(btn.getAttribute('data-theme-btn')); });
  });
  window.addEventListener('resize', updateReadout);
  setTheme(initialTheme());
})();
