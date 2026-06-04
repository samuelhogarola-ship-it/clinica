/**
 * API-level permission and walk-in lifecycle tests.
 * Run: node testing/api/permissions.test.mjs
 *
 * Requires the server to be running locally:
 *   PORT=4184 APP_PASSWORD=testpass DATA_DIR=.tmp-test-api DEMO_MODE=true node server.js
 *
 * The test spins up the server itself using child_process so it is self-contained.
 */

import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 4184;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, '.tmp-api-test-data');

// ─── helpers ─────────────────────────────────────────────────────────────────

async function api(method, endpoint, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── server lifecycle ─────────────────────────────────────────────────────────

let serverProc;

function startServer() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });

  serverProc = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      APP_PASSWORD: 'testpass',
      DATA_DIR,
      DEMO_MODE: 'true',
    },
    stdio: 'pipe',
  });

  serverProc.stderr.on('data', () => {}); // silence
  serverProc.stdout.on('data', () => {});
}

async function waitForServer(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(`${BASE}/`);
      return;
    } catch {
      await sleep(300);
    }
  }
  throw new Error('Server did not start in time');
}

function stopServer() {
  if (serverProc) serverProc.kill();
  rmSync(DATA_DIR, { recursive: true, force: true });
}

// ─── test fixtures ────────────────────────────────────────────────────────────

async function getToken(username, password) {
  const { data } = await api('POST', '/api/login', { body: { username, password } });
  return data?.token || null;
}

async function getDemoAdminToken() {
  const { data } = await api('POST', '/api/admin/session');
  return data?.token || null;
}

async function getDemoFisioToken() {
  const { data } = await api('POST', '/api/fisio/session');
  return data?.token || null;
}

// ─── tests ────────────────────────────────────────────────────────────────────

console.log('\nStarting server...');
startServer();
await waitForServer();
console.log('Server ready.\n');

// --- Auth setup ---
// Discover first admin and fisio usernames from the server's login endpoint.
// All users share the single APP_PASSWORD ('testpass' in test env).
const CANDIDATE_ADMINS = ['susana', 'carolina', 'rocio', 'carlos', 'gloria', 'admin'];
const CANDIDATE_FISIO  = ['mario', 'fisio'];

async function findToken(candidates, password) {
  for (const u of candidates) {
    const t = await getToken(u, password);
    if (t) return t;
  }
  return null;
}

const adminToken = await findToken(CANDIDATE_ADMINS, 'testpass');
assert.ok(adminToken, 'admin login must succeed — check APP_PASSWORD=testpass and usuarios.json');

let fisioToken = await findToken(CANDIDATE_FISIO, 'testpass');
if (!fisioToken) {
  // Fall back to admin user which also passes requireFisioOrAdmin
  fisioToken = adminToken;
}

// Demo tokens (DEMO_MODE=true)
const demoAdminToken = await getDemoAdminToken();
const demoFisioToken = await getDemoFisioToken();

assert.ok(demoAdminToken, 'demo admin session must be available when DEMO_MODE=true');
assert.ok(demoFisioToken, 'demo fisio session must be available when DEMO_MODE=true');

// First create a real patient so session/pdf routes have something to work with
const CREATE_PATIENT = await api('POST', '/api/fisio/pacientes', {
  token: adminToken,
  body: { id: 'TEST-001', fechaNacimiento: '1990-01-01' },
});
assert.equal(CREATE_PATIENT.status, 200, 'admin can create patient');

// ─── 1. Demo write blocks ─────────────────────────────────────────────────────
console.log('1. Demo write protection');

await test('demo fisio: POST /api/fisio/sesiones → 403', async () => {
  const r = await api('POST', '/api/fisio/sesiones/TEST-001', {
    token: demoFisioToken,
    body: { diagnosticoMedico: 'test' },
  });
  assert.equal(r.status, 403);
});

await test('demo fisio: POST /api/fisio/pdf/walk-in → 403', async () => {
  const r = await api('POST', '/api/fisio/pdf/walk-in', {
    token: demoFisioToken,
    body: { nombre: 'Test', fecha: '2026-06-04' },
  });
  assert.equal(r.status, 403);
});

await test('demo fisio: POST /api/fisio/pacientes → 403', async () => {
  const r = await api('POST', '/api/fisio/pacientes', {
    token: demoFisioToken,
    body: { id: 'DEMO-NEW', fechaNacimiento: '1995-01-01' },
  });
  assert.equal(r.status, 403);
});

await test('demo admin: POST /api/fisio/sesiones → 403', async () => {
  const r = await api('POST', '/api/fisio/sesiones/TEST-001', {
    token: demoAdminToken,
    body: { diagnosticoMedico: 'test' },
  });
  assert.equal(r.status, 403);
});

await test('demo: GET /api/fisio/sesiones/:id → 200 (reads allowed)', async () => {
  const r = await api('GET', '/api/fisio/sesiones/TEST-001', { token: demoFisioToken });
  assert.equal(r.status, 200);
});

// ─── 2. Real fisio/admin writes allowed ──────────────────────────────────────
console.log('\n2. Real user write permissions');

await test('real admin: POST /api/fisio/sesiones → 200', async () => {
  const r = await api('POST', '/api/fisio/sesiones/TEST-001', {
    token: adminToken,
    body: { diagnosticoMedico: 'Prueba sesion', fecha: '2026-06-04' },
  });
  assert.equal(r.status, 200);
});

await test('real admin: POST /api/fisio/pdf/walk-in → returns PDF', async () => {
  const res = await fetch(`${BASE}/api/fisio/pdf/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nombre: 'Paciente', apellidos: 'Test', fecha: '2026-06-04', diagnosticoMedico: 'Dolor lumbar' }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('pdf'), 'should return PDF content-type');
});

// ─── 3. Walk-in record lifecycle ─────────────────────────────────────────────
console.log('\n3. Walk-in record lifecycle');

let walkinId;

await test('walk-in POST creates a pending_review record', async () => {
  // Trigger another walk-in so we have the tempId
  const res = await fetch(`${BASE}/api/fisio/pdf/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nombre: 'Temporal', apellidos: 'WalkIn', fecha: '2026-06-04', diagnosticoMedico: 'Valoracion inicial' }),
  });
  // Extract tempId from Content-Disposition header
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="(WALK-[^"]+)_sesion_rapida\.pdf"/);
  assert.ok(match, `Content-Disposition must include WALK-... filename, got: ${cd}`);
  walkinId = match[1];
  assert.ok(walkinId.startsWith('WALK-'), `tempId should start with WALK-, got: ${walkinId}`);
});

await test('admin can list walk-in records', async () => {
  const r = await api('GET', '/api/admin/walkin', { token: adminToken });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data), 'should return array');
  assert.ok(r.data.length > 0, 'should have at least one record');
  const rec = r.data.find((x) => x.id === walkinId);
  assert.ok(rec, 'our record must appear in the list');
  assert.equal(rec.status, 'pending_review');
});

await test('admin can fetch a single walk-in record', async () => {
  const r = await api('GET', `/api/admin/walkin/${walkinId}`, { token: adminToken });
  assert.equal(r.status, 200);
  assert.equal(r.data.id, walkinId);
  assert.equal(r.data.status, 'pending_review');
  assert.equal(r.data.expired, false);
});

await test('non-admin cannot list walk-in records', async () => {
  const r = await api('GET', '/api/admin/walkin', { token: demoFisioToken });
  assert.notEqual(r.status, 200);
});

await test('admin can convert walk-in to real patient', async () => {
  const r = await api('POST', `/api/admin/walkin/${walkinId}/convert`, {
    token: adminToken,
    body: { codigoPaciente: 'WALK-CONVERTED-001', fechaNacimiento: '1985-03-15' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.patientId, 'should return patientId');
  assert.equal(r.data.codigoPaciente, 'WALK-CONVERTED-001');
});

await test('converted record cannot be converted again', async () => {
  const r = await api('POST', `/api/admin/walkin/${walkinId}/convert`, {
    token: adminToken,
    body: { codigoPaciente: 'WALK-CONVERTED-002', fechaNacimiento: '1985-03-15' },
  });
  assert.equal(r.status, 409);
});

let walkinToDiscard;

await test('admin can discard a walk-in record', async () => {
  // Create a fresh walk-in to discard
  const res = await fetch(`${BASE}/api/fisio/pdf/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nombre: 'Para Descartar', fecha: '2026-06-04' }),
  });
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="(WALK-[^"]+)_sesion_rapida\.pdf"/);
  assert.ok(match, 'must get a WALK-... filename');
  walkinToDiscard = match[1];

  const r = await api('POST', `/api/admin/walkin/${walkinToDiscard}/discard`, { token: adminToken });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  const check = await api('GET', `/api/admin/walkin/${walkinToDiscard}`, { token: adminToken });
  assert.equal(check.data.status, 'discarded');
});

// ─── 4. Audit log ────────────────────────────────────────────────────────────
console.log('\n4. Audit log');

await test('admin can read audit log', async () => {
  const r = await api('GET', '/api/admin/audit', { token: adminToken });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data), 'audit log should be array');
  assert.ok(r.data.length > 0, 'audit log should have entries');
});

await test('audit log contains session_create entry', async () => {
  const r = await api('GET', '/api/admin/audit', { token: adminToken });
  const entry = r.data.find((e) => e.action === 'session_create');
  assert.ok(entry, 'session_create audit entry must exist');
  assert.ok(entry.patientId, 'entry must have patientId');
  assert.ok(entry.actorId, 'entry must have actorId');
  assert.ok(entry.timestamp, 'entry must have timestamp');
});

await test('audit log contains walkin_create entry', async () => {
  const r = await api('GET', '/api/admin/audit', { token: adminToken });
  const entry = r.data.find((e) => e.action === 'walkin_create');
  assert.ok(entry, 'walkin_create audit entry must exist');
});

await test('audit log contains walkin_convert entry', async () => {
  const r = await api('GET', '/api/admin/audit', { token: adminToken });
  const entry = r.data.find((e) => e.action === 'walkin_convert');
  assert.ok(entry, 'walkin_convert audit entry must exist');
});

await test('audit log contains walkin_discard entry', async () => {
  const r = await api('GET', '/api/admin/audit', { token: adminToken });
  const entry = r.data.find((e) => e.action === 'walkin_discard');
  assert.ok(entry, 'walkin_discard audit entry must exist');
});

await test('non-admin cannot read audit log', async () => {
  const r = await api('GET', '/api/admin/audit', { token: demoFisioToken });
  assert.notEqual(r.status, 200);
});

// ─── 5. DEMO_MODE=false blocks auto-session ──────────────────────────────────
// (Cannot test this within the same running server — documented as manual check)

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
stopServer();
process.exit(failed > 0 ? 1 : 0);
