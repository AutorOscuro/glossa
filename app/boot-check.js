// @purpose: Red de seguridad de arranque (script clásico): si main.js no llega a ejecutarse, a los 5 s muestra un aviso con botón para recargar.
// Red de seguridad de arranque (subparte 0.4). Script CLÁSICO (no módulo) y separado de main.js: si main.js no llega
// a ejecutarse (módulo roto, caché vieja a medias, JavaScript desactivado por error de carga), la persona no se queda
// mirando "Cargando…" para siempre: a los 5 s ve un mensaje con un botón para recargar.
(function () {
  'use strict';
  window.setTimeout(function () {
    if (document.documentElement.getAttribute('data-booted') === '1') return;
    var boot = document.getElementById('boot');
    if (!boot) return;
    boot.textContent = 'La app no terminó de cargar. ';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primary';
    btn.textContent = 'Recargar';
    btn.addEventListener('click', function () { window.location.reload(); });
    boot.appendChild(btn);
  }, 5000);
})();
