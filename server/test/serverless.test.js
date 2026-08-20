import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from '../app.js';

const postgresStores = () => Object.fromEntries([
  'authStore', 'patientStore', 'clinicalStore', 'sessionStore', 'documentStore', 'financeStore', 'payablesStore',
  'receiptStore', 'invoiceStore', 'agendaStore', 'adminStore', 'engagementStore', 'operationsStore', 'analyticsStore'
].map(store => [store, { kind: 'postgres' }]));

async function call(handler, path) {
  const req = Object.assign(Readable.from([]), { method: 'GET', url: path, headers: {}, socket: { remoteAddress: '' } });
  let status = 0, body = '';
  const res = {
    setHeader() { return res; },
    writeHead(code) { status = code; return res; },
    end(chunk) { body = chunk || ''; return res; }
  };
  await handler(req, res);
  return { status, data: body ? JSON.parse(body) : null };
}

test('com os 14 módulos em PostgreSQL nenhum arquivo SQLite é aberto', async () => {
  const previous = process.env.PSYCHE_DB_PATH;
  // Caminho impossível de criar: abrir o SQLite legado faria a chamada falhar.
  process.env.PSYCHE_DB_PATH = '/proc/psyche-inexistente/psyche.sqlite';
  try {
    const stores = postgresStores();
    stores.authStore = { kind: 'postgres', async health() { return true; } };
    const { handler } = createApp(stores);
    const { status, data } = await call(handler, '/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.equal(data.database, 'postgresql');
  } finally {
    if (previous === undefined) delete process.env.PSYCHE_DB_PATH; else process.env.PSYCHE_DB_PATH = previous;
  }
});

test('um módulo ainda em SQLite mantém o runtime no banco legado', async () => {
  const legacy = { prepare: () => ({ get: () => ({ connected: 1 }) }), close() {} };
  const { handler } = createApp({ ...postgresStores(), analyticsStore: null, database: legacy });
  const { status, data } = await call(handler, '/api/health');
  assert.equal(status, 200);
  assert.equal(data.database, 'sqlite');
});

test('a prova de vida não depende do banco', async () => {
  const stores = postgresStores();
  stores.authStore = { kind: 'postgres', async health() { throw new Error('conexão recusada'); } };
  const { handler } = createApp(stores);
  assert.deepEqual((await call(handler, '/api/health/live')).data, { status: 'ok' });
  // Readiness precisa reprovar quando o PostgreSQL não responde.
  assert.equal((await call(handler, '/api/health/ready')).status, 503);
});
