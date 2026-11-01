// @purpose: Corre el contrato de events.log() contra el motor de base en memoria.
// Corre el contrato de events.log() (tests/_eventsContract.mjs) contra el motor en memoria. El mismo contrato corre contra IndexedDB real con tools/idb-check.py.
import { runEventsContract } from './_eventsContract.mjs';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';

runEventsContract({ label: 'memoria', newDisk: () => createMemoryDisk(), create: (disk) => createMemoryDb({ disk }), volume: 10000, queryVolume: 50000, perfBudgetMs: 200 });
