// @purpose: Ejecuta la suite de contrato de almacenamiento contra cada motor de base disponible en Node.
// Ejecuta la suite de contrato (tests/_dbContract.mjs) contra cada motor de almacenamiento (subparte 0.7).
import { test } from 'node:test';
import { runDbContract } from './_dbContract.mjs';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';

runDbContract({
  label: 'memoria',
  newDisk: () => createMemoryDisk(),
  create: (disk, opts = {}) => createMemoryDb({ disk, ...opts }),
  hooks: true,
  perfBudgetMs: 100,
});

// El motor de IndexedDB real (core/db.idb.js, mitad B1) corre esta MISMA suite en Chromium real con: python3 tools/idb-check.py
// Aquí se declara para que no parezca que "pasó" en Node: en Node está OMITIDO, no aprobado (Node no trae IndexedDB).
test('[indexeddb] suite de contrato — OMITIDA en Node: se corre en Chromium real con tools/idb-check.py', { skip: true }, () => {});
