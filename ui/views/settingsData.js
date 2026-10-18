// Tarjetas de datos de Ajustes (subparte 0.8, cuarto 3B): Respaldo, Claves y Zona de peligro. Las usa ui/views/settings.js.
//
//   buildDataCards({ ctx, settings, db, sync, tools, io, toast, track, refreshers }) → { backup, keys, danger }   (tres elementos)
//   · Exportar: baja el respaldo; las claves NO van en el archivo salvo que se marque la casilla (apagada al abrir).
//   · Importar: abre el selector, pide confirmación y REEMPLAZA los datos; las claves de este dispositivo se conservan.
//   · Borrar claves: confirmación simple. Borrar todo: confirmación fuerte (escribir BORRAR).
//   · Un solo trabajo a la vez (los botones se deshabilitan mientras corre). Si algo falla: aviso con el texto amable y nada queda a medias.
//   · Sin base (db null) Exportar e Importar quedan deshabilitados con un aviso. Nada de esto escribe la clave en la consola.
import { h } from '../dom.js';
import { createCard, createButton, createToggle, createModal, createConfirmDanger } from '../components/index.js';
import { BACKUP_ACCEPT } from '../../app/fileIO.js';

const GENERIC = 'Algo falló. No se cambió nada; inténtalo de nuevo.';
const PHRASE = 'BORRAR';

export function buildDataCards({ ctx, settings, db, sync, tools, io, toast, track, refreshers }) {
  const note = (text) => h('p', { class: 'text-sm text-muted' }, text);
  const cardEl = (heading, ...children) => createCard({ title: heading, headingLevel: 2, children }).el;
  const notify = (kind, message) => { try { toast?.show(kind, message); } catch { /* el aviso es un extra */ } };

  let busy = false;
  let includeKeys = false;
  let activeModal = null;
  const controls = []; // { button, off() → ¿debe estar deshabilitado aparte de "ocupado"? }
  const update = () => { for (const c of controls) c.button.setDisabled(busy || c.off()); };
  const button = (opts, off = () => false) => {
    const b = track(createButton(opts));
    controls.push({ button: b, off });
    b.setDisabled(off());
    return b.el;
  };
  refreshers.push(update);

  // Corre un trabajo exclusivo: bloquea los botones, avisa si falla y siempre los libera.
  async function job(name, fn) {
    if (busy) return;
    busy = true;
    update();
    try {
      await fn();
    } catch (e) {
      console.error(`Ajustes: no se pudo ${name} (código: ${typeof e?.code === 'string' ? e.code : 'desconocido'})`);
      notify('danger', typeof e?.friendly === 'string' && e.friendly ? e.friendly : GENERIC);
    } finally {
      busy = false;
      if (ctx.alive()) update();
    }
  }
  async function confirm(modalOpts) {
    const modal = createModal({ danger: true, ...modalOpts });
    activeModal = modal;
    try { return await modal.open(); } finally { modal.destroy(); if (activeModal === modal) activeModal = null; }
  }
  const total = (counts) => Object.values(counts).reduce((a, n) => a + n, 0);

  const noDb = () => db === null;
  const exportBtn = button({ label: 'Exportar respaldo', variant: 'secondary', block: true, onClick: () => job('exportar el respaldo', async () => {
    const { json, filename, counts } = await sync.exportBackup({ includeSecrets: includeKeys });
    io.download(filename, json);
    notify('success', includeKeys
      ? `Respaldo guardado (${total(counts)} datos), con tus claves. Guárdalo en un lugar seguro.`
      : `Respaldo guardado (${total(counts)} datos). No incluye tus claves.`);
  }) }, noDb);
  const importBtn = button({ label: 'Importar respaldo', variant: 'secondary', block: true, onClick: async () => {
    if (busy) return;
    const file = await io.pickFile({ accept: BACKUP_ACCEPT });
    if (!file || !ctx.alive()) return;
    await job('importar el respaldo', async () => {
      const ok = await confirm({
        title: '¿Reemplazar tu progreso?',
        message: `Se cambiará lo que tienes ahora por lo del archivo${file.name ? ` «${file.name}»` : ''}. Tus claves de este dispositivo se conservan. Si dudas, exporta un respaldo antes.`,
        confirmLabel: 'Reemplazar',
      });
      if (!ok) return;
      const res = await sync.importBackup(file.text);
      await tools.afterRestore();
      notify('success', `Respaldo restaurado (${res.total} datos).`);
    });
  } }, noDb);
  const keysToggle = track(createToggle({
    label: 'Incluir mis claves en el archivo', checked: false,
    description: 'Apagado es lo más seguro: quien tenga el archivo podría usar tus claves.',
    onChange: (on) => { includeKeys = on; },
  }));

  const backup = cardEl('Respaldo',
    note('Un respaldo guarda tu progreso y tus ajustes en un archivo, para que puedas pasarlo a otro dispositivo o recuperarlo si algo sale mal.'),
    keysToggle.el, exportBtn, importBtn,
    ...(db === null ? [note('Este navegador no deja guardar datos, así que ahora mismo no hay nada que respaldar.')] : []),
  );

  const clearBtn = button({ label: 'Borrar mis claves', variant: 'secondary', block: true, onClick: () => job('borrar las claves', async () => {
    const ok = await confirm({
      title: '¿Borrar tus claves?',
      message: 'Se borran la clave de IA y la de Azure de este dispositivo. Tendrás que volver a pegarlas para usar esas funciones.',
      confirmLabel: 'Borrar claves',
    });
    if (!ok) return;
    await tools.clearKeys();
    notify('success', 'Claves borradas de este dispositivo.');
  }) }, () => !(settings.hasSecret('aiKey') || settings.hasSecret('azureKey')));
  const keys = cardEl('Claves', note('Tus claves viven solo en este dispositivo y no van en el respaldo salvo que tú lo pidas.'), clearBtn);

  const wipeDialog = createConfirmDanger({
    title: '¿Borrar todo?',
    message: 'Se borran tu progreso, tus ajustes y tus claves de este dispositivo. No se puede deshacer. Si quieres conservar algo, exporta un respaldo antes.',
    phrase: PHRASE, confirmLabel: 'Borrar todo',
  });
  const wipeBtn = button({ label: 'Borrar todo', variant: 'danger', block: true, onClick: () => job('borrar todo', async () => {
    if (!(await wipeDialog.open())) return;
    await tools.wipeAll();
    notify('success', 'Todo borrado. La app quedó como recién instalada.');
  }) });
  const danger = cardEl('Zona de peligro', note('Estas acciones no se pueden deshacer.'), wipeBtn);

  ctx.cleanup(() => {
    io.destroy?.();
    activeModal?.destroy();
    wipeDialog.destroy();
  });
  return { backup, keys, danger };
}
