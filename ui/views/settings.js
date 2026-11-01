// @purpose: Pantalla de Ajustes (#/ajustes): compone controles sobre services.settings, con guardado inmediato.
// Pantalla de Ajustes (subparte 0.8, cuarto 2B). Ruta #/ajustes. Solo compone controles de la 0.5 sobre `services.settings` (core/settings.js).
//   · Cada control guarda al instante con settings.set; tema y tamaño de texto se ven en vivo porque app/appearance.js escucha a settings.
//   · Si guardar falla, el control vuelve al valor que de verdad tiene el ajuste y muestra el texto amable del error.
//   · La clave de IA solo pasa por createKeyField → settings.set('aiKey'); nunca se lee de vuelta ni se escribe en la consola.
//   · Respaldo, Claves y Zona de peligro vienen de settingsData.js (cuarto 3).
//   · "Repetir bienvenida" (cuarto 4B) lleva a #/bienvenida con services.navigate, que se lee al tocar el botón, no al montar.
import { h } from '../dom.js';
import { createView } from './_viewBase.js';
import { createCard, createButton, createSegmented, createSlider, createToggle, createTextInput, createKeyField } from '../components/index.js';
import { createSync } from '../../core/sync.js';
import { createDataTools } from '../../app/dataTools.js';
import { createFileIO } from '../../app/fileIO.js';
import { buildDataCards } from './settingsData.js';

const GENERIC_ERROR = 'No se pudo guardar el cambio. Inténtalo de nuevo.';
const pct = (v) => `${Math.round(v * 100)} %`;

export default createView(async (ctx) => {
  // app/main.js asigna los servicios justo después de arrancar el shell: se leen tras ceder un turno, no al montar.
  await Promise.resolve();
  if (!ctx.alive()) return undefined;
  const { version, storageReady, settingsReady } = ctx.services;
  const title = h('h1', { class: 'view__title' }, 'Ajustes');
  const body = h('div', { class: 'stack stack--lg' });
  ctx.root.appendChild(h('section', { class: 'stack stack--lg view' }, title, body));

  // Las vistas esperan a la base y a los ajustes (pueden estar solo en memoria si la base no abrió).
  let settings = ctx.services.settings ?? null;
  let db = ctx.services.db ?? null;
  try {
    db = (await storageReady)?.db ?? db;
    if (!settings) settings = (await settingsReady)?.settings ?? ctx.services.settings ?? null;
  } catch (e) {
    console.error('Ajustes: no se pudo esperar a que todo estuviera listo', e?.code);
  }
  if (!ctx.alive()) return undefined;
  if (!settings) {
    body.appendChild(createCard({ title: 'No se pudieron cargar los ajustes', children: [h('p', { class: 'text-sm text-muted' }, 'Cierra y vuelve a abrir la app. Si sigue pasando, avisa a quien la mantiene.')] }).el);
    return undefined;
  }

  const comps = [];
  const refreshers = [];
  const track = (c) => { comps.push(c); return c; };

  // Guarda un cambio; si falla, vuelve al valor real del ajuste y muestra el motivo en el propio control.
  async function save(key, value, control, revert) {
    try {
      await settings.set(key, value);
      if (ctx.alive()) control.setError(null);
    } catch (e) {
      console.error(`Ajustes: no se pudo guardar "${key}" (código: ${typeof e?.code === 'string' ? e.code : 'desconocido'})`);
      if (!ctx.alive()) return;
      revert();
      control.setError(typeof e?.friendly === 'string' && e.friendly ? e.friendly : GENERIC_ERROR);
    }
  }

  function segmented(key, label, options) {
    const c = track(createSegmented({ label, options, value: settings.get(key), onChange: (v) => save(key, v, c, () => c.setValue(settings.get(key))) }));
    refreshers.push(() => c.setValue(settings.get(key)));
    return c.el;
  }
  function toggle(key, label, description) {
    const c = track(createToggle({ label, description, checked: settings.get(key), onChange: (on) => save(key, on, c, () => c.setChecked(settings.get(key))) }));
    refreshers.push(() => c.setChecked(settings.get(key)));
    return c.el;
  }
  function slider(key, label, { min, max, step, hint, format }) {
    const c = track(createSlider({ label, min, max, step, hint, format, value: settings.get(key), onChange: (v) => save(key, v, c, () => c.setValue(settings.get(key))) }));
    refreshers.push(() => c.setValue(settings.get(key)));
    return c.el;
  }
  function textField(key, label, { hint, placeholder, disabled = false } = {}) {
    const commit = () => { const v = c.getValue().trim(); if (v !== settings.get(key)) save(key, v, c, () => c.setValue(settings.get(key))); };
    const c = track(createTextInput({ label, hint, placeholder, disabled, value: settings.get(key), onSubmit: commit }));
    ctx.on(c.input, 'change', commit);
    refreshers.push(() => { if (c.getValue().trim() !== settings.get(key)) c.setValue(settings.get(key)); });
    return c.el;
  }
  function keyField(key, label, { disabled = false } = {}) {
    const c = track(createKeyField({
      label, disabled, saved: settings.hasSecret(key),
      onSave: (v) => settings.set(key, v),
      onClear: () => settings.set(key, ''),
    }));
    refreshers.push(() => c.setSaved(settings.hasSecret(key)));
    return c.el;
  }
  const card = (heading, ...children) => createCard({ title: heading, headingLevel: 2, children }).el;
  const note = (text) => h('p', { class: 'text-sm text-muted' }, text);

  const data = buildDataCards({
    ctx, settings, db, track, refreshers, toast: ctx.services.toast,
    sync: ctx.services.sync ?? createSync({ db }),
    tools: ctx.services.dataTools ?? createDataTools({ db, settings, afterChange: () => ctx.services.reimportContent?.() }),
    io: ctx.services.fileIO ?? createFileIO(),
  });

  const welcomeBtn = track(createButton({
    label: 'Repetir bienvenida', variant: 'secondary', block: true,
    onClick: () => {
      try { ctx.services.navigate?.('onboarding'); } catch (e) { console.error('Ajustes: no se pudo abrir la bienvenida', e?.code); }
    },
  }));

  const cards = [
    card('Apariencia',
      segmented('theme', 'Tema', [{ value: 'aurora', label: 'Aurora' }, { value: 'neo', label: 'Neo' }, { value: 'claro', label: 'Claro' }]),
      segmented('textSize', 'Tamaño de texto', [{ value: 'small', label: 'Pequeño' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Grande' }, { value: 'xlarge', label: 'Muy grande' }]),
    ),
    card('Repaso',
      slider('retention', 'Retención objetivo', {
        min: 0.8, max: 0.95, step: 0.01, format: pct,
        hint: 'Es cuánto quieres recordar cuando toque repasar. Más alta: recuerdas más, pero te salen más repasos cada día. Más baja: menos repasos, pero olvidas un poco más. 90 % es un buen equilibrio.',
      }),
      slider('dailyReviewCap', 'Tope de repasos por día', { min: 10, max: 500, step: 10, hint: 'Máximo de tarjetas por repasar en un día. Lo que no quepa pasa al día siguiente, sin culpa.' }),
      slider('dailyNewCap', 'Tarjetas nuevas por día', { min: 0, max: 50, step: 1, hint: '0 = no añadir tarjetas nuevas.' }),
      slider('leechThreshold', 'Umbral de sanguijuela', { min: 3, max: 20, step: 1, hint: 'Una tarjeta que se te resiste tantas veces se marca como sanguijuela para tratarla distinto.' }),
      toggle('spellingTolerance', 'Tolerancia ortográfica', 'Una errata pequeña cuenta como "casi" y no como error.'),
      segmented('srsEngine', 'Motor de repaso', [{ value: 'fsrs', label: 'Normal' }, { value: 'simple', label: 'Simple (emergencia)' }]),
      note('Déjalo en Normal. El motor Simple es un respaldo por si algo falla en el repaso: usa intervalos fijos y no pierde tus tarjetas. Puedes volver a Normal cuando quieras.'),
    ),
    card('Sonido y vibración',
      toggle('sounds', 'Sonidos', 'Un tono suave al acertar y otro al terminar la sesión.'),
      toggle('vibration', 'Vibración', 'Una vibración muy corta al acertar (solo si tu teléfono lo permite).'),
    ),
    card('Inteligencia artificial',
      segmented('aiMode', 'Modo de IA', [{ value: 'auto', label: 'Automático' }, { value: 'mechanical', label: 'Siempre mecánico' }]),
      note('Siempre mecánico usa solo las reglas de la app, sin enviar nada a internet.'),
      h('p', { class: 'text-sm' }, 'Proveedor: Groq'),
      textField('aiModel', 'Modelo', { hint: 'Déjalo vacío para usar el recomendado cuando la IA se active.' }),
      keyField('aiKey', 'Clave de IA'),
      note('Tu clave se guarda solo en este dispositivo. No se envía a ningún sitio salvo al proveedor que elegiste, cuando uses la IA.'),
    ),
    card('Pronunciación (Azure)',
      note('Se activa en la Fase 8. Los campos ya están aquí, pero todavía no hacen nada.'),
      textField('azureRegion', 'Región de Azure', { disabled: true }),
      keyField('azureKey', 'Clave de Azure', { disabled: true }),
    ),
    data.backup,
    data.keys,
    card('Bienvenida',
      note('Vuelve a ver la bienvenida: puedes cambiar tu nombre o cómo está tu energía. No borra nada de tu progreso.'),
      welcomeBtn.el,
    ),
    card('Acerca de', note(`Glossa · versión ${version ?? '—'}`)),
    data.danger,
  ];
  for (const el of cards) body.appendChild(el);

  const off = settings.onAnyChange(() => { if (ctx.alive()) refreshers.forEach((r) => r()); });
  ctx.cleanup(() => {
    off();
    for (const c of comps) c.destroy();
  });
  return undefined;
});
