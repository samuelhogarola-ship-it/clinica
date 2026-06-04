import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const FALLBACK_DIST_DIR = path.join(__dirname, 'frontend', 'dist');
const FRONTEND_DIR = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? PUBLIC_DIR : FALLBACK_DIST_DIR;
const FISIO_HTML_PATH = path.join(FRONTEND_DIR, 'fisio', 'index.html');
const ADMIN_HTML_PATH = path.join(FRONTEND_DIR, 'admin', 'index.html');
const LANDING_HTML_PATH = path.join(FRONTEND_DIR, 'index.html');
const REGISTRO_HTML_PATH = path.join(FRONTEND_DIR, 'registro.html');
const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'backend', 'datos'))
    ? path.join(__dirname, 'backend', 'datos')
    : path.join(__dirname, 'datos')
);
const USERS_PATH = fs.existsSync(path.join(__dirname, 'backend', 'usuarios.json'))
  ? path.join(__dirname, 'backend', 'usuarios.json')
  : path.join(__dirname, 'usuarios.json');
const INDICE_DIR = path.join(DATA_DIR, 'indice');
const SESIONES_DIR = path.join(DATA_DIR, 'sesiones');
const INDICE_PATH = path.join(INDICE_DIR, 'indice.json');
const PACIENTES_DIR = path.join(DATA_DIR, 'pacientes');
const SESSION_RECORDS_DIR = path.join(DATA_DIR, 'sesiones-registros');
const META_DIR = path.join(DATA_DIR, 'meta');
const PATIENT_CODE_INDEX_PATH = path.join(META_DIR, 'patient-code-index.json');
const PATIENT_SESSIONS_INDEX_PATH = path.join(META_DIR, 'patient-sessions-index.json');
const COUNTERS_PATH = path.join(META_DIR, 'counters.json');
const DEMO_SEED_PATH = path.join(__dirname, 'backend', 'demo-seed.json');
const authTokens = new Map();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureJsonFile(filePath, fallbackData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2), 'utf8');
  }
}

function ensureDataBootstrap() {
  [
    DATA_DIR,
    INDICE_DIR,
    SESIONES_DIR,
    PACIENTES_DIR,
    SESSION_RECORDS_DIR,
    META_DIR,
  ].forEach(ensureDir);

  ensureJsonFile(INDICE_PATH, {});
  ensureJsonFile(PATIENT_CODE_INDEX_PATH, {});
  ensureJsonFile(PATIENT_SESSIONS_INDEX_PATH, {});
  ensureJsonFile(COUNTERS_PATH, { patient: 0, session: 0 });
}

ensureDataBootstrap();


app.use(cors());
app.use(express.json());

function leerIndice() {
  return buildLegacyIndexFromPrimaryData();
}

function guardarIndice(indice) {
  fs.writeFileSync(INDICE_PATH, JSON.stringify(indice, null, 2), 'utf8');
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${path.basename(filePath)}:`, error);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getLegacyIndiceRaw() {
  return readJsonFile(INDICE_PATH, {});
}

function loadPatientCodeIndex() {
  return readJsonFile(PATIENT_CODE_INDEX_PATH, {});
}

function savePatientCodeIndex(index) {
  writeJsonFile(PATIENT_CODE_INDEX_PATH, index);
}

function loadPatientSessionsIndex() {
  return readJsonFile(PATIENT_SESSIONS_INDEX_PATH, {});
}

function savePatientSessionsIndex(index) {
  writeJsonFile(PATIENT_SESSIONS_INDEX_PATH, index);
}

function loadCounters() {
  return readJsonFile(COUNTERS_PATH, { patient: 0, session: 0 });
}

function saveCounters(counters) {
  writeJsonFile(COUNTERS_PATH, counters);
}

function nextStableId(kind) {
  const counters = loadCounters();
  const key = kind === 'pac' ? 'patient' : 'session';
  counters[key] = Number(counters[key] || 0) + 1;
  saveCounters(counters);
  return `${kind}_${String(counters[key]).padStart(6, '0')}`;
}

function patientFilePath(patientId) {
  return path.join(PACIENTES_DIR, `${patientId}.json`);
}

function sessionRecordPath(sessionId) {
  return path.join(SESSION_RECORDS_DIR, `${sessionId}.json`);
}

function legacySessionDir(codigoPaciente) {
  return path.join(SESIONES_DIR, codigoPaciente);
}

function legacySessionPath(codigoPaciente, fecha) {
  const dir = legacySessionDir(codigoPaciente);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${fecha}.json`);
}

function legacyPdfPath(codigoPaciente, fecha) {
  const dir = legacySessionDir(codigoPaciente);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${fecha}.pdf`);
}

function leerUsuarios() {
  if (!fs.existsSync(USERS_PATH)) {
    return [];
  }

  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('No se pudo leer usuarios.json:', error);
    return [];
  }
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function sesionPath(id, fecha) {
  return legacySessionPath(id, fecha);
}

function esFechaValida(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeFechaNacimiento(value) {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    return esFechaValida(y, m, d) ? `${year}-${month}-${day}` : '';
  }

  match = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    return esFechaValida(y, m, d) ? `${year}-${month}-${day}` : '';
  }

  return '';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function formatSubmissionActor(currentUser) {
  if (!currentUser) return 'staff';
  return currentUser.displayName
    ? `${currentUser.displayName} (${currentUser.id || currentUser.username || 'staff'})`
    : (currentUser.id || currentUser.username || 'staff');
}

function appendInternalNote(existingNotes, extraNote, currentUser) {
  const nextNote = String(extraNote || '').trim();
  if (!nextNote) {
    return existingNotes || null;
  }

  const actor = formatSubmissionActor(currentUser);
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${actor}: ${nextNote}`;
  return existingNotes ? `${existingNotes}\n${entry}` : entry;
}

async function supabaseRest(pathname, { method = 'GET', body, headers = {} } = {}) {
  if (!isSupabaseConfigured()) {
    const error = new Error('Supabase no configurado');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'Error en Supabase');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function encodeStoragePath(pathname) {
  return String(pathname || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function createSignedStorageUrl(bucket, storagePath, expiresIn = 60 * 30) {
  if (!bucket || !storagePath) {
    return '';
  }

  const encodedPath = encodeStoragePath(storagePath);
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'No se pudo firmar el documento');
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const signedPath = payload?.signedURL || payload?.signedUrl || '';

  if (!signedPath) {
    return '';
  }

  if (/^https?:\/\//.test(signedPath)) {
    return signedPath;
  }

  const normalizedPath = signedPath.startsWith('/') ? signedPath : `/${signedPath}`;
  return `${SUPABASE_URL}/storage/v1${normalizedPath}`;
}

async function uploadStorageObject(bucket, storagePath, buffer, contentType = 'application/pdf') {
  const encodedPath = encodeStoragePath(storagePath);
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'No se pudo subir el documento');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapSubmissionSummary(record) {
  const profile = Array.isArray(record.core_profiles)
    ? record.core_profiles[0] || null
    : record.core_profiles || null;
  const data = record.data && typeof record.data === 'object' ? record.data : {};

  return {
    id: record.id,
    created_at: record.created_at,
    profile_id: record.profile_id,
    app_id: record.app_id,
    form_version: record.form_version,
    status: record.status,
    submitted_by: record.submitted_by,
    notes: record.notes || '',
    reviewed_at: record.reviewed_at || '',
    reviewed_by: record.reviewed_by || '',
    archived_at: record.archived_at || '',
    archived_by: record.archived_by || '',
    data,
    profile: profile ? {
      id: profile.id,
      registry_number: profile.registry_number,
      name: profile.name,
      surnames: profile.surnames,
      phone: profile.phone,
      email: profile.email,
      birth_date: profile.birth_date,
      profile_status: profile.profile_status,
    } : null,
  };
}

function mapSubmissionDocument(record) {
  const data = record?.data && typeof record.data === 'object' ? record.data : {};
  const pdfPath = data.pdf_path || data.storage_path || '';
  const pdfBucket = data.pdf_bucket || 'clinical-documents';
  const patientName = [data.patient_name || data.nombre || '', data.patient_surnames || data.apellidos || '']
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    submission_id: record.id,
    profile_id: record.profile_id,
    created_at: record.created_at,
    app_id: record.app_id,
    status: record.status,
    pdf_bucket: pdfBucket,
    pdf_path: pdfPath,
    pdf_filename: data.pdf_filename || (pdfPath ? pdfPath.split('/').pop() : ''),
    submission_date: data.submission_date || '',
    patient_name: patientName,
  };
}

const PDF_SECTION_ROWS = [
  {
    title: 'Datos personales',
    rows: [
      ['Apellidos', 'apellidos'],
      ['Nombre', 'nombre'],
      ['Edad', 'edad'],
      ['Sexo', 'sexo'],
      ['Profesión', 'profesion'],
      ['Altura / Peso', 'alturaPeso'],
      ['Diagnóstico médico', 'diagnosticoMedico'],
      ['Fecha inicial de anomalía', 'fechaInicialAnomalia'],
      ['Tratamientos afines', 'tratamientosAfines'],
      ['Medicación anterior / actual', 'medicacion'],
      ['Prueba de imagen', 'pruebaImagen'],
    ],
  },
  {
    title: 'Historia clínica y exploración',
    rows: [
      ['Historia clínica', 'historiaClinica'],
      ['Anamnesis', 'anamnesis'],
      ['Antecedentes AL o AV', 'antecedentesALAV'],
      ['Antecedentes AQ', 'antecedentesAQ'],
      ['Inspección / observación', 'inspeccionObservacion'],
      ['Palpación diagnóstica', 'palpacionDiagnostica'],
      ['Sensibilidad en', 'sensibilidad'],
      ['PGS', 'pgs'],
      ['Balance muscular', 'balanceMuscular'],
      ['Balance articular / movilidad + disfunciones', 'balanceArticular'],
      ['Datos de interés', 'datosInteres'],
      ['Valoración funcional', 'valoracionFuncional'],
      ['Pruebas específicas', 'pruebasEspecificas'],
    ],
  },
  {
    title: 'Problemas y tratamiento',
    rows: [
      ['Problemas fisioterapéuticos', 'problemasFisioterapeuticos'],
      ['Programa de fisioterapia', 'programaFisioterapia'],
      ['Plan de tratamiento', 'planTratamiento'],
      ['Recomendaciones a la familia', 'recomendacionesFamilia'],
      ['Objetivos fisioterapéuticos', 'objetivosFisioterapeuticos'],
      ['Evolución, exploración y tratamiento', 'evolucionExploracionTratamiento'],
    ],
  },
];

function formatDisplayDate(value) {
  if (typeof value !== 'string' || !value) return '';
  const normalized = normalizeFechaNacimiento(value);
  const finalValue = normalized || value;
  const parts = finalValue.split('-');
  return parts.length === 3 ? parts.reverse().join('/') : finalValue;
}

async function buildClinicalPdfBuffer({ patientCode, submissionDate, ficha, subtitle = 'Informe de revisión clínica' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks = [];

    const drawHeader = (currentSubtitle) => {
      doc.rect(0, 0, doc.page.width, 80).fill('#0F6E56');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('FisioApp', 60, 25);
      doc.fillColor('#9FE1CB').font('Helvetica').fontSize(11).text(currentSubtitle, 60, 52);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
        .text(`ID Paciente: ${patientCode}`, 60, 25, { align: 'right' });
      doc.fillColor('#9FE1CB').fontSize(10)
        .text(`Fecha: ${formatDisplayDate(submissionDate)}`, 60, 40, { align: 'right' });
      doc.moveDown(4);
    };

    const drawSection = (title, rows) => {
      doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11)
        .text(title.toUpperCase(), { characterSpacing: 1 });
      doc.moveDown(0.3);
      doc.rect(60, doc.y, doc.page.width - 120, 0.5).fill('#9FE1CB');
      doc.moveDown(0.5);

      rows.forEach(([label, key]) => {
        doc.fillColor('#2C2C2A').font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
        doc.font('Helvetica').text(` ${ficha[key] || '—'}`, {
          lineGap: 4,
        });
        doc.moveDown(0.35);
      });

      doc.moveDown(1.5);
    };

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    drawHeader(subtitle);
    drawSection(PDF_SECTION_ROWS[0].title, PDF_SECTION_ROWS[0].rows);
    drawSection(PDF_SECTION_ROWS[1].title, PDF_SECTION_ROWS[1].rows);

    doc.addPage();
    drawHeader('Continuación del registro');
    drawSection(PDF_SECTION_ROWS[2].title, PDF_SECTION_ROWS[2].rows);

    doc.fontSize(9).fillColor('#888780')
      .text(
        'Documento generado por FisioApp · Uso clínico interno · Datos anonimizados',
        60,
        doc.page.height - 40,
        { align: 'center' }
      );

    doc.end();
  });
}

function getSafeUser(user = {}) {
  return {
    id: user.id || '',
    username: user.username || '',
    role: user.role || '',
    displayName: user.displayName || user.username || '',
  };
}

function getUserByUsername(username) {
  const normalizedUsername = normalizeText(username);
  if (!normalizedUsername) return null;

  return leerUsuarios().find((user) => normalizeText(user.username) === normalizedUsername) || null;
}

function getDefaultAdminUser() {
  return leerUsuarios().find((user) => normalizeText(user.role) === 'admin') || null;
}

function getDefaultFisioAccessUser() {
  return getUserByUsername('susana')
    || leerUsuarios().find((user) => normalizeText(user.role) === 'fisio')
    || getDefaultAdminUser();
}

function loadDemoSeed() {
  return readJsonFile(DEMO_SEED_PATH, { patients: [] });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getPacienteNombre(id, sesiones = []) {
  const orderedSessions = [...sesiones].sort().reverse();

  for (const fecha of orderedSessions) {
    const sessionData = readJsonIfExists(legacySessionPath(id, fecha));
    if (!sessionData) continue;

    const nombre = String(sessionData.nombre || '').trim();
    const apellidos = String(sessionData.apellidos || '').trim();
    const displayName = [nombre, apellidos].filter(Boolean).join(' ').trim();

    if (nombre || apellidos) {
      return { nombre, apellidos, displayName };
    }
  }

  return { nombre: '', apellidos: '', displayName: '' };
}

function getAnonDisplayName(nombre = '', apellidos = '') {
  const cleanNombre = String(nombre || '').trim();
  const cleanApellidos = String(apellidos || '').trim();
  const apellidoInicial = cleanApellidos ? `${cleanApellidos.charAt(0).toUpperCase()}.` : '';
  return [cleanNombre, apellidoInicial].filter(Boolean).join(' ').trim();
}

function buildPacienteSummary(id, value = {}) {
  const sesiones = Array.isArray(value.sesiones) ? value.sesiones : [];
  const nombres = getPacienteNombre(id, sesiones);

  return {
    id,
    fechaNacimiento: normalizeFechaNacimiento(value.fechaNacimiento),
    sesiones,
    creadoEn: value.creadoEn || '',
    createdBy: value.createdBy || '',
    updatedBy: value.updatedBy || '',
    nombre: nombres.nombre,
    apellidos: nombres.apellidos,
    displayName: getAnonDisplayName(nombres.nombre, nombres.apellidos),
  };
}

function buildDemoPacienteSummary({ id, nombre, fechaNacimiento, sesiones = [], creadoEn = '', createdBy = 'demo' }) {
  return {
    id,
    fechaNacimiento,
    sesiones,
    creadoEn,
    createdBy,
    updatedBy: createdBy,
    nombre,
    apellidos: '',
    displayName: nombre,
    isDemo: true,
  };
}

function getAdminDemoPacientes() {
  return [
    buildDemoPacienteSummary({
      id: 'CLI-1001',
      nombre: 'Pepito',
      fechaNacimiento: '1990-04-12',
      sesiones: ['2026-06-02', '2026-05-21'],
      creadoEn: '2026-06-03T08:30:00.000Z',
    }),
    buildDemoPacienteSummary({
      id: 'CLI-1002',
      nombre: 'Fulanita',
      fechaNacimiento: '1988-09-03',
      sesiones: ['2026-05-30'],
      creadoEn: '2026-06-02T18:00:00.000Z',
    }),
    buildDemoPacienteSummary({
      id: 'CLI-1003',
      nombre: 'Menganito',
      fechaNacimiento: '1995-01-24',
      sesiones: [],
      creadoEn: '2026-06-01T09:15:00.000Z',
    }),
  ];
}

function getAdminDemoBillingDirectory() {
  return [
    {
      profile: {
        id: 'demo-profile-1',
        registry_number: 'CLI-1001',
        name: 'Pepito',
        surnames: '',
        phone: '600111111',
        email: 'pepito.demo@clinica.local',
        birth_date: '1990-04-12',
        profile_status: 'active',
        created_at: '2026-06-03T08:30:00.000Z',
        updated_at: '2026-06-03T08:30:00.000Z',
      },
      records: [
        {
          id: 'demo-record-1',
          created_at: '2026-06-02T09:00:00.000Z',
          app_id: 'DEMO-FISIO',
          record_type: 'session',
          submission_id: '',
          created_by: 'demo-admin',
          version: 1,
          data: {
            planTratamiento: 'Sesion de fisioterapia general',
            source_form_version: 'demo',
          },
        },
        {
          id: 'demo-record-2',
          created_at: '2026-05-21T16:30:00.000Z',
          app_id: 'DEMO-FISIO',
          record_type: 'session',
          submission_id: '',
          created_by: 'demo-admin',
          version: 1,
          data: {
            planTratamiento: 'Revision de seguimiento',
            source_form_version: 'demo',
          },
        },
      ],
    },
    {
      profile: {
        id: 'demo-profile-2',
        registry_number: 'CLI-1002',
        name: 'Fulanita',
        surnames: '',
        phone: '600222222',
        email: 'fulanita.demo@clinica.local',
        birth_date: '1988-09-03',
        profile_status: 'active',
        created_at: '2026-06-02T18:00:00.000Z',
        updated_at: '2026-06-02T18:00:00.000Z',
      },
      records: [
        {
          id: 'demo-record-3',
          created_at: '2026-05-30T12:15:00.000Z',
          app_id: 'DEMO-FISIO',
          record_type: 'session',
          submission_id: '',
          created_by: 'demo-admin',
          version: 1,
          data: {
            planTratamiento: 'Primera valoracion y sesion inicial',
            source_form_version: 'demo',
          },
        },
      ],
    },
    {
      profile: {
        id: 'demo-profile-3',
        registry_number: 'CLI-1003',
        name: 'Menganito',
        surnames: '',
        phone: '600333333',
        email: 'menganito.demo@clinica.local',
        birth_date: '1995-01-24',
        profile_status: 'pending',
        created_at: '2026-06-01T09:15:00.000Z',
        updated_at: '2026-06-01T09:15:00.000Z',
      },
      records: [
        {
          id: 'demo-record-4',
          created_at: '2026-06-01T10:00:00.000Z',
          app_id: 'DEMO-ADMIN',
          record_type: 'assessment',
          submission_id: '',
          created_by: 'demo-admin',
          version: 1,
          data: {
            diagnosticoMedico: 'Valoracion pendiente de tratamiento',
            source_form_version: 'demo',
          },
        },
      ],
    },
  ];
}

function getAdminDemoBillingData(registry) {
  const entry = getAdminDemoBillingDirectory().find(
    ({ profile }) => profile.registry_number === String(registry || '').trim().toUpperCase(),
  );

  if (!entry) return null;

  return {
    profile: mapProfileSummary(entry.profile),
    records: entry.records.map(mapBillingRecordSummary),
    is_demo: true,
  };
}

function getAdminDemoSessionRecordByPatientCodeAndDate(codigoPaciente, fecha) {
  const codigo = String(codigoPaciente || '').trim().toUpperCase();
  const sessionMap = {
    'CLI-1001': {
      '2026-06-02': {
        nombre: 'Pepito',
        diagnosticoMedico: 'Sobrecarga lumbar leve',
        historiaClinica: 'Molestia tras varios dias de carga fisica.',
        anamnesis: 'Refiere dolor al final del dia y rigidez matinal ligera.',
        planTratamiento: 'Movilidad suave, descarga lumbar y pauta domiciliaria.',
        evolucionExploracionTratamiento: 'Mejora parcial tras la sesion. Sin signos de alarma.',
      },
      '2026-05-21': {
        nombre: 'Pepito',
        diagnosticoMedico: 'Revision de seguimiento lumbar',
        historiaClinica: 'Seguimiento de episodio mecanico lumbar.',
        anamnesis: 'Dolor mas controlado, persiste cansancio local.',
        planTratamiento: 'Sesion de seguimiento y refuerzo de ejercicios.',
        evolucionExploracionTratamiento: 'Buena respuesta. Se mantiene control semanal.',
      },
    },
    'CLI-1002': {
      '2026-05-30': {
        nombre: 'Fulanita',
        diagnosticoMedico: 'Valoracion inicial de hombro',
        historiaClinica: 'Primera consulta por limitacion funcional leve.',
        anamnesis: 'Molestia en elevacion y carga mantenida.',
        planTratamiento: 'Valoracion inicial, movilidad guiada y recomendacion basica.',
        evolucionExploracionTratamiento: 'Caso en observacion, pendiente de siguiente sesion.',
      },
    },
    'CLI-1003': {
      '2026-06-01': {
        nombre: 'Menganito',
        diagnosticoMedico: 'Revision administrativa inicial',
        historiaClinica: 'Perfil demo con valoracion pendiente.',
        anamnesis: 'Sin sintomas consolidados en este entorno de muestra.',
        planTratamiento: 'Sin tratamiento todavia. Registro administrativo.',
        evolucionExploracionTratamiento: 'Pendiente de alta clinica real.',
      },
    },
  };

  const sessionData = sessionMap[codigo]?.[fecha];
  if (!sessionData) return null;

  return {
    ...hydrateFichaCampos(sessionData),
    id: `demo-session-${codigo}-${fecha}`,
    paciente_id: `demo-patient-${codigo}`,
    paciente_codigo: codigo,
    fecha,
    createdAt: `${fecha}T09:00:00.000Z`,
    updatedAt: `${fecha}T10:00:00.000Z`,
    createdBy: 'demo-admin',
    updatedBy: 'demo-admin',
    pdfGeneratedBy: '',
    pdfGeneratedAt: '',
    isDemo: true,
  };
}

function sortPacienteSummaries(pacientes = []) {
  return [...pacientes].sort((a, b) => {
    if (a.creadoEn && b.creadoEn) {
      return b.creadoEn.localeCompare(a.creadoEn);
    }
    return a.id.localeCompare(b.id, 'es', { numeric: true });
  });
}

function getAdminPatientDirectory() {
  const indice = leerIndice();
  const pacientes = sortPacienteSummaries(
    Object.entries(indice).map(([id, value]) => buildPacienteSummary(id, value)),
  );

  return pacientes.length ? pacientes : getAdminDemoPacientes();
}

function buildAdminOverview() {
  const pacientes = getAdminPatientDirectory();
  const monthPrefix = fechaHoy().slice(0, 7);

  let lastSessionDate = '';
  let totalSessions = 0;
  let sessionsThisMonth = 0;

  pacientes.forEach((paciente) => {
    const sesiones = Array.isArray(paciente.sesiones) ? paciente.sesiones : [];
    totalSessions += sesiones.length;
    sessionsThisMonth += sesiones.filter((fecha) => typeof fecha === 'string' && fecha.startsWith(monthPrefix)).length;

    sesiones.forEach((fecha) => {
      if (typeof fecha === 'string' && (!lastSessionDate || fecha > lastSessionDate)) {
        lastSessionDate = fecha;
      }
    });
  });

  return {
    totalPatients: pacientes.length,
    activePatients: pacientes.filter((paciente) => (paciente.sesiones || []).length > 0).length,
    totalSessions,
    sessionsThisMonth,
    lastSessionDate,
    intakeConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
  };
}

function mapProfileSummary(record = {}) {
  return {
    id: record.id,
    registry_number: record.registry_number || '',
    name: record.name || '',
    surnames: record.surnames || '',
    phone: record.phone || '',
    email: record.email || '',
    birth_date: record.birth_date || '',
    profile_status: record.profile_status || '',
    created_at: record.created_at || '',
    updated_at: record.updated_at || '',
  };
}

function mapBillingRecordSummary(record = {}) {
  const data = record.data && typeof record.data === 'object' ? record.data : {};
  const mainConcept = data.planTratamiento
    || data.programaFisioterapia
    || data.diagnosticoMedico
    || data.historiaClinica
    || data.source_form_version
    || '';

  return {
    id: record.id,
    created_at: record.created_at || '',
    app_id: record.app_id || '',
    record_type: record.record_type || '',
    submission_id: record.submission_id || '',
    created_by: record.created_by || '',
    version: record.version || 1,
    concept: String(mainConcept || '').trim(),
    data,
  };
}

function getPatientByInternalId(patientId) {
  return readJsonFile(patientFilePath(patientId), null);
}

function getPatientByCode(codigoPaciente) {
  const codeIndex = loadPatientCodeIndex();
  const normalizedCode = String(codigoPaciente || '').trim().toUpperCase();
  const patientId = codeIndex[normalizedCode];
  if (!patientId) return null;

  const patient = getPatientByInternalId(patientId);
  if (!patient) return null;

  return patient;
}

function listSessionDatesForPatient(patientId) {
  const patientSessionsIndex = loadPatientSessionsIndex();
  return Object.keys(patientSessionsIndex[patientId] || {}).sort().reverse();
}

function getSessionIdForPatientDate(patientId, fecha) {
  const patientSessionsIndex = loadPatientSessionsIndex();
  return patientSessionsIndex[patientId]?.[fecha] || '';
}

function buildLegacyIndexFromPrimaryData() {
  const codeIndex = loadPatientCodeIndex();
  const legacyIndex = {};

  for (const [codigoPaciente, patientId] of Object.entries(codeIndex)) {
    const patient = getPatientByInternalId(patientId);
    if (!patient) continue;

    legacyIndex[codigoPaciente] = {
      fechaNacimiento: normalizeFechaNacimiento(patient.fechaNacimiento),
      creadoEn: patient.createdAt || '',
      updatedAt: patient.updatedAt || '',
      createdBy: patient.createdBy || '',
      updatedBy: patient.updatedBy || '',
      sesiones: listSessionDatesForPatient(patientId),
    };
  }

  return legacyIndex;
}

function writeLegacyIndexSnapshot() {
  guardarIndice(buildLegacyIndexFromPrimaryData());
}

function createPatientRecord({ codigoPaciente, fechaNacimiento, currentUser }) {
  const patientId = nextStableId('pac');
  const nowIso = new Date().toISOString();
  const normalizedFecha = normalizeFechaNacimiento(fechaNacimiento);
  const patientRecord = {
    id: patientId,
    codigo: codigoPaciente,
    fechaNacimiento: normalizedFecha,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: currentUser?.id || '',
    updatedBy: currentUser?.id || '',
  };

  writeJsonFile(patientFilePath(patientId), patientRecord);

  const codeIndex = loadPatientCodeIndex();
  codeIndex[codigoPaciente] = patientId;
  savePatientCodeIndex(codeIndex);

  const patientSessionsIndex = loadPatientSessionsIndex();
  patientSessionsIndex[patientId] = patientSessionsIndex[patientId] || {};
  savePatientSessionsIndex(patientSessionsIndex);
  writeLegacyIndexSnapshot();

  return patientRecord;
}

function updatePatientRecord(patientRecord) {
  writeJsonFile(patientFilePath(patientRecord.id), patientRecord);
  writeLegacyIndexSnapshot();
}

function persistSessionRecord({ patientRecord, fecha, data, currentUser }) {
  const patientSessionsIndex = loadPatientSessionsIndex();
  patientSessionsIndex[patientRecord.id] = patientSessionsIndex[patientRecord.id] || {};

  const existingSessionId = patientSessionsIndex[patientRecord.id][fecha];
  const existingSession = existingSessionId ? readJsonFile(sessionRecordPath(existingSessionId), null) : null;
  const sessionId = existingSessionId || nextStableId('ses');
  const nowIso = new Date().toISOString();
  const ficha = hydrateFichaCampos({ ...existingSession, ...data });

  const sessionRecord = {
    ...ficha,
    id: sessionId,
    paciente_id: patientRecord.id,
    paciente_codigo: patientRecord.codigo,
    fecha,
    createdAt: existingSession?.createdAt || nowIso,
    updatedAt: nowIso,
    createdBy: existingSession?.createdBy || currentUser?.id || '',
    updatedBy: currentUser?.id || existingSession?.updatedBy || '',
    pdfGeneratedBy: data.pdfGeneratedBy ?? existingSession?.pdfGeneratedBy ?? '',
    pdfGeneratedAt: data.pdfGeneratedAt ?? existingSession?.pdfGeneratedAt ?? '',
  };

  writeJsonFile(sessionRecordPath(sessionId), sessionRecord);
  patientSessionsIndex[patientRecord.id][fecha] = sessionId;
  savePatientSessionsIndex(patientSessionsIndex);

  const patientUpdated = {
    ...patientRecord,
    updatedAt: nowIso,
    updatedBy: currentUser?.id || patientRecord.updatedBy || '',
  };
  updatePatientRecord(patientUpdated);

  writeJsonFile(
    legacySessionPath(patientRecord.codigo, fecha),
    {
      ...ficha,
      id: patientRecord.codigo,
      fecha,
      sessionId,
      pacienteId: patientRecord.id,
      creadoEn: existingSession?.createdAt || nowIso,
      actualizadoEn: nowIso,
      createdBy: existingSession?.createdBy || currentUser?.id || '',
      updatedBy: currentUser?.id || existingSession?.updatedBy || '',
      pdfGeneratedBy: sessionRecord.pdfGeneratedBy || '',
      pdfGeneratedAt: sessionRecord.pdfGeneratedAt || '',
    }
  );

  return sessionRecord;
}

function getSessionRecordByPatientCodeAndDate(codigoPaciente, fecha) {
  const patient = getPatientByCode(codigoPaciente);
  if (!patient) return null;

  const sessionId = getSessionIdForPatientDate(patient.id, fecha);
  if (sessionId) {
    return readJsonFile(sessionRecordPath(sessionId), null);
  }

  const legacySession = readJsonIfExists(legacySessionPath(codigoPaciente, fecha));
  if (!legacySession) return null;

  return {
    ...hydrateFichaCampos(legacySession),
    id: legacySession.sessionId || '',
    paciente_id: patient.id,
    paciente_codigo: codigoPaciente,
    fecha,
    createdAt: legacySession.creadoEn || legacySession.actualizadoEn || '',
    updatedAt: legacySession.actualizadoEn || legacySession.creadoEn || '',
    createdBy: legacySession.createdBy || '',
    updatedBy: legacySession.updatedBy || '',
    pdfGeneratedBy: legacySession.pdfGeneratedBy || '',
    pdfGeneratedAt: legacySession.pdfGeneratedAt || '',
  };
}

function resetStructuredDataStore() {
  const clearDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  };

  clearDir(PACIENTES_DIR);
  clearDir(SESSION_RECORDS_DIR);
  clearDir(SESIONES_DIR);
  clearDir(INDICE_DIR);

  ensureDataBootstrap();
  writeLegacyIndexSnapshot();
}

function shouldReplacePlaceholderData() {
  const codeIndex = loadPatientCodeIndex();
  const codes = Object.keys(codeIndex);
  if (codes.length !== 1 || codes[0] !== 'AAAA') return false;

  const patient = getPatientByCode('AAAA');
  if (!patient) return false;

  const sessionDates = listSessionDatesForPatient(patient.id);
  return sessionDates.length === 0;
}

function seedSharedDemoDataIfNeeded() {
  const codeIndex = loadPatientCodeIndex();
  const needsSeed = Object.keys(codeIndex).length === 0 || shouldReplacePlaceholderData();
  if (!needsSeed) return;

  if (shouldReplacePlaceholderData()) {
    resetStructuredDataStore();
  }

  const seed = loadDemoSeed();
  const patients = Array.isArray(seed?.patients) ? seed.patients : [];
  if (patients.length === 0) return;

  const seedUser = getUserByUsername('susana') || getDefaultAdminUser() || { id: 'seed', username: 'seed', role: 'admin', displayName: 'Seed' };

  patients.forEach((patientSeed) => {
    const codigoPaciente = String(patientSeed.code || '').trim().toUpperCase();
    const fechaNacimiento = String(patientSeed.birthDate || '').trim();
    if (!codigoPaciente || !fechaNacimiento) return;

    let patientRecord = getPatientByCode(codigoPaciente);
    if (!patientRecord) {
      patientRecord = createPatientRecord({
        codigoPaciente,
        fechaNacimiento,
        currentUser: seedUser,
      });
    }

    const sessions = Array.isArray(patientSeed.sessions) ? patientSeed.sessions : [];
    sessions.forEach((sessionSeed) => {
      if (!sessionSeed?.date) return;
      persistSessionRecord({
        patientRecord,
        fecha: sessionSeed.date,
        data: sessionSeed.data || {},
        currentUser: seedUser,
      });
    });
  });
}

function migrateLegacyDataIfNeeded() {
  const legacyIndice = getLegacyIndiceRaw();
  if (!legacyIndice || Object.keys(legacyIndice).length === 0) {
    return;
  }

  const codeIndex = loadPatientCodeIndex();
  const patientSessionsIndex = loadPatientSessionsIndex();

  let changed = false;

  for (const [codigoPaciente, legacyPatient] of Object.entries(legacyIndice)) {
    let patientId = codeIndex[codigoPaciente];
    if (!patientId) {
      patientId = nextStableId('pac');
      codeIndex[codigoPaciente] = patientId;
      changed = true;
    }

    const patientPath = patientFilePath(patientId);
    const existingPatient = readJsonFile(patientPath, null);
    if (!existingPatient) {
      writeJsonFile(patientPath, {
        id: patientId,
        codigo: codigoPaciente,
        fechaNacimiento: normalizeFechaNacimiento(legacyPatient.fechaNacimiento),
        createdAt: legacyPatient.creadoEn || new Date().toISOString(),
        updatedAt: legacyPatient.updatedAt || legacyPatient.creadoEn || new Date().toISOString(),
        createdBy: legacyPatient.createdBy || '',
        updatedBy: legacyPatient.updatedBy || '',
      });
      changed = true;
    }

    patientSessionsIndex[patientId] = patientSessionsIndex[patientId] || {};
    const legacySessionDates = Array.isArray(legacyPatient.sesiones) ? legacyPatient.sesiones : [];

    for (const fecha of legacySessionDates) {
      if (patientSessionsIndex[patientId][fecha]) continue;

      const sessionId = nextStableId('ses');
      const legacySession = readJsonIfExists(legacySessionPath(codigoPaciente, fecha)) || {};
      const nowIso = new Date().toISOString();

      writeJsonFile(sessionRecordPath(sessionId), {
        ...hydrateFichaCampos(legacySession),
        id: sessionId,
        paciente_id: patientId,
        paciente_codigo: codigoPaciente,
        fecha,
        createdAt: legacySession.creadoEn || legacySession.actualizadoEn || legacyPatient.creadoEn || nowIso,
        updatedAt: legacySession.actualizadoEn || legacySession.creadoEn || legacyPatient.updatedAt || nowIso,
        createdBy: legacySession.createdBy || legacyPatient.createdBy || '',
        updatedBy: legacySession.updatedBy || legacyPatient.updatedBy || '',
        pdfGeneratedBy: legacySession.pdfGeneratedBy || '',
        pdfGeneratedAt: legacySession.pdfGeneratedAt || '',
      });
      patientSessionsIndex[patientId][fecha] = sessionId;
      changed = true;
    }
  }

  if (changed) {
    savePatientCodeIndex(codeIndex);
    savePatientSessionsIndex(patientSessionsIndex);
    writeLegacyIndexSnapshot();
  }
}

function hydrateFichaCampos(data = {}) {
  const campos = {
    apellidos: '',
    nombre: '',
    edad: '',
    sexo: '',
    profesion: '',
    alturaPeso: '',
    diagnosticoMedico: '',
    fechaInicialAnomalia: '',
    tratamientosAfines: '',
    medicacion: '',
    pruebaImagen: '',
    historiaClinica: '',
    anamnesis: '',
    antecedentesALAV: '',
    antecedentesAQ: '',
    inspeccionObservacion: '',
    palpacionDiagnostica: '',
    sensibilidad: '',
    pgs: '',
    balanceMuscular: '',
    balanceArticular: '',
    datosInteres: '',
    valoracionFuncional: '',
    pruebasEspecificas: '',
    problemasFisioterapeuticos: '',
    programaFisioterapia: '',
    planTratamiento: '',
    recomendacionesFamilia: '',
    objetivosFisioterapeuticos: '',
    evolucionExploracionTratamiento: '',
    ...data,
  };

  if (!campos.anamnesis && data.sintomas) campos.anamnesis = data.sintomas;
  if (!campos.diagnosticoMedico && data.diagnostico) campos.diagnosticoMedico = data.diagnostico;
  if (!campos.planTratamiento && data.tratamiento) campos.planTratamiento = data.tratamiento;

  return campos;
}

function requireAuth(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token || !authTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.currentUser = authTokens.get(token);
  next();
}

// Requires a real (non-demo) authenticated admin.
function requireAdmin(req, res, next) {
  if (!req.currentUser || normalizeText(req.currentUser.role) !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required.' });
    return;
  }
  if (req.currentUser.isDemo) {
    res.status(403).json({ error: 'Demo mode is read-only. Log in with a real account to make changes.' });
    return;
  }
  next();
}

// Requires a real (non-demo) user with admin or fisio role.
function requireFisioOrAdmin(req, res, next) {
  const role = normalizeText(req.currentUser?.role || '');
  if (role !== 'admin' && role !== 'fisio') {
    res.status(403).json({ error: 'Forbidden: admin or fisio role required.' });
    return;
  }
  if (req.currentUser.isDemo) {
    res.status(403).json({ error: 'Demo mode is read-only. Log in with a real account to make changes.' });
    return;
  }
  next();
}

// Blocks any write (non-GET/HEAD) request from a demo session.
function denyDemoWrites(req, res, next) {
  if (req.currentUser?.isDemo && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(403).json({ error: 'Demo mode is read-only. Log in with a real account to make changes.' });
    return;
  }
  next();
}

migrateLegacyDataIfNeeded();
seedSharedDemoDataIfNeeded();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = getUserByUsername(username);

  if (!APP_PASSWORD || password !== APP_PASSWORD || !user) {
    res.json({ success: false });
    return;
  }

  const token = crypto.randomUUID();
  const currentUser = getSafeUser(user);
  authTokens.set(token, currentUser);
  res.json({ success: true, token, currentUser });
});

// Auto-session minting — only available when DEMO_MODE=true (never in production)
app.post('/api/admin/session', (req, res) => {
  if (!DEMO_MODE) {
    res.status(403).json({ error: 'Auto-session not available in production.' });
    return;
  }

  const user = getDefaultAdminUser();

  if (!user) {
    res.status(500).json({ error: 'No hay ningun usuario admin configurado.' });
    return;
  }

  const token = crypto.randomUUID();
  const currentUser = { ...getSafeUser(user), isDemo: true };
  authTokens.set(token, currentUser);
  res.json({ success: true, token, currentUser });
});

app.post('/api/fisio/session', (req, res) => {
  if (!DEMO_MODE) {
    res.status(403).json({ error: 'Auto-session not available in production.' });
    return;
  }

  const user = getDefaultFisioAccessUser();

  if (!user) {
    res.status(500).json({ error: 'No hay ningun usuario interno configurado.' });
    return;
  }

  const token = crypto.randomUUID();
  const currentUser = { ...getSafeUser(user), isDemo: true };
  authTokens.set(token, currentUser);
  res.json({ success: true, token, currentUser });
});

app.use('/api', (req, res, next) => {
  // Auto-session paths are only reachable when DEMO_MODE is set; they 403 otherwise.
  if (req.path === '/login' || req.path === '/admin/session' || req.path === '/fisio/session') {
    next();
    return;
  }

  requireAuth(req, res, next);
});

// Demo users (tokens from auto-session) may read any route but cannot mutate data.
// This covers all /api/* paths uniformly; individual write routes also use requireAdmin
// where a real admin role is required regardless of demo status.
app.use('/api', denyDemoWrites);

app.get(['/api/intake/submissions', '/api/admin/intake/submissions'], async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status.trim()
      ? req.query.status.trim()
      : 'pending';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const query = new URLSearchParams({
      select: 'id,created_at,profile_id,app_id,form_version,status,submitted_by,notes,reviewed_at,reviewed_by,archived_at,archived_by,data,core_profiles(id,registry_number,name,surnames,phone,email,birth_date,profile_status)',
      order: 'created_at.desc',
      limit: String(limit),
    });

    if (status !== 'all') {
      query.set('status', `eq.${status}`);
    }

    const records = await supabaseRest(`/app_submissions?${query.toString()}`);
    res.json(Array.isArray(records) ? records.map(mapSubmissionSummary) : []);
  } catch (error) {
    console.error('No se pudieron listar app_submissions:', error);
    res.status(error.status || 500).json({
      error: isSupabaseConfigured()
        ? 'No se pudieron cargar los envíos pendientes'
        : 'Supabase no está configurado en este entorno',
    });
  }
});

app.get(['/api/intake/profiles/:profileId/documents', '/api/admin/intake/profiles/:profileId/documents'], async (req, res) => {
  const profileId = String(req.params.profileId || '').trim();

  if (!profileId) {
    res.status(400).json({ error: 'Falta el identificador del perfil' });
    return;
  }

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const query = new URLSearchParams({
      select: 'id,profile_id,created_at,app_id,status,data',
      profile_id: `eq.${profileId}`,
      order: 'created_at.desc',
      limit: String(limit),
    });
    const records = await supabaseRest(`/app_submissions?${query.toString()}`);
    const documents = [];

    for (const record of Array.isArray(records) ? records : []) {
      const document = mapSubmissionDocument(record);
      if (!document.pdf_path) {
        continue;
      }

      let signedUrl = '';
      try {
        signedUrl = await createSignedStorageUrl(document.pdf_bucket, document.pdf_path);
      } catch (signError) {
        console.error('No se pudo firmar documento clínico:', signError);
      }

      documents.push({
        ...document,
        signed_url: signedUrl,
      });
    }

    res.json(documents);
  } catch (error) {
    console.error('No se pudieron listar documentos clínicos:', error);
    res.status(error.status || 500).json({
      error: isSupabaseConfigured()
        ? 'No se pudieron cargar los documentos del paciente'
        : 'Supabase no está configurado en este entorno',
    });
  }
});

app.post(['/api/intake/submissions/:id/regenerate-pdf', '/api/admin/intake/submissions/:id/regenerate-pdf'], requireAdmin, async (req, res) => {
  const submissionId = String(req.params.id || '').trim();

  if (!submissionId) {
    res.status(400).json({ error: 'Falta el identificador del envío' });
    return;
  }

  try {
    const query = new URLSearchParams({
      select: 'id,created_at,profile_id,app_id,form_version,status,submitted_by,notes,data,core_profiles(id,registry_number,name,surnames)',
      id: `eq.${submissionId}`,
      limit: '1',
    });
    const records = await supabaseRest(`/app_submissions?${query.toString()}`);
    const submission = Array.isArray(records) ? records[0] : null;

    if (!submission) {
      res.status(404).json({ error: 'Envío no encontrado' });
      return;
    }

    const profile = Array.isArray(submission.core_profiles)
      ? submission.core_profiles[0] || null
      : submission.core_profiles || null;
    const data = submission.data && typeof submission.data === 'object' ? submission.data : {};
    const registryNumber = profile?.registry_number || 'REG-SIN-CODIGO';
    const ficha = hydrateFichaCampos(data);
    const submissionDate = data.submission_date || normalizeFechaNacimiento(data.fecha) || fechaHoy();
    const pdfPath = data.pdf_path || `${registryNumber}/${submission.id}/${submissionDate}.pdf`;
    const pdfBucket = data.pdf_bucket || 'clinical-documents';
    const actor = formatSubmissionActor(req.currentUser);
    const now = new Date().toISOString();

    const pdfBuffer = await buildClinicalPdfBuffer({
      patientCode: registryNumber,
      submissionDate,
      ficha,
      subtitle: 'Ficha fisioterapéutica regenerada desde datos guardados',
    });

    await uploadStorageObject(pdfBucket, pdfPath, pdfBuffer);
    const signedUrl = await createSignedStorageUrl(pdfBucket, pdfPath);
    const nextData = {
      ...data,
      pdf_bucket: pdfBucket,
      pdf_path: pdfPath,
      pdf_filename: data.pdf_filename || `${registryNumber}_${submissionDate}.pdf`,
      pdf_regenerated_at: now,
      pdf_regenerated_by: actor,
    };
    const nextNotes = appendInternalNote(
      submission.notes,
      'PDF regenerado desde los datos guardados del formulario estático',
      req.currentUser,
    );

    await supabaseRest(`/app_submissions?id=eq.${submissionId}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: {
        data: nextData,
        notes: nextNotes,
      },
    });

    res.json({
      ok: true,
      submission_id: submissionId,
      profile_id: submission.profile_id,
      pdf_bucket: pdfBucket,
      pdf_path: pdfPath,
      pdf_filename: nextData.pdf_filename,
      signed_url: signedUrl,
      regenerated_at: now,
      regenerated_by: actor,
    });
  } catch (error) {
    console.error('No se pudo regenerar el PDF del envío:', error);
    res.status(error.status || 500).json({
      error: isSupabaseConfigured()
        ? 'No se pudo regenerar el PDF del envío'
        : 'Supabase no está configurado en este entorno',
    });
  }
});

app.post(['/api/intake/submissions/:id/review', '/api/admin/intake/submissions/:id/review'], requireAdmin, async (req, res) => {
  const submissionId = String(req.params.id || '').trim();
  const action = req.body?.action === 'archive' ? 'archive' : 'review';
  const reviewerNotes = req.body?.reviewerNotes;

  if (!submissionId) {
    res.status(400).json({ error: 'Falta el identificador del envío' });
    return;
  }

  try {
    const submissionQuery = new URLSearchParams({
      select: 'id,created_at,profile_id,app_id,form_version,status,submitted_by,notes,reviewed_at,reviewed_by,archived_at,archived_by,data',
      id: `eq.${submissionId}`,
      limit: '1',
    });
    const [submission] = await supabaseRest(`/app_submissions?${submissionQuery.toString()}`);

    if (!submission) {
      res.status(404).json({ error: 'Envío no encontrado' });
      return;
    }

    const actor = formatSubmissionActor(req.currentUser);
    const now = new Date().toISOString();
    const nextNotes = appendInternalNote(submission.notes, reviewerNotes, req.currentUser);

    if (action === 'review') {
      const existingRecordQuery = new URLSearchParams({
        select: 'id',
        submission_id: `eq.${submissionId}`,
        record_type: 'eq.intake_submission',
        limit: '1',
      });
      const existingRecords = await supabaseRest(`/app_records?${existingRecordQuery.toString()}`);

      if (!Array.isArray(existingRecords) || existingRecords.length === 0) {
        await supabaseRest('/app_records', {
          method: 'POST',
          headers: {
            Prefer: 'return=minimal',
          },
          body: {
            profile_id: submission.profile_id,
            app_id: submission.app_id,
            record_type: 'intake_submission',
            submission_id: submission.id,
            created_by: actor,
            data: {
              ...(submission.data && typeof submission.data === 'object' ? submission.data : {}),
              source_submission_id: submission.id,
              source_form_version: submission.form_version || '',
              reviewed_at: now,
              reviewed_by: actor,
            },
          },
        });
      }

      await supabaseRest(`/core_profiles?id=eq.${submission.profile_id}`, {
        method: 'PATCH',
        headers: {
          Prefer: 'return=minimal',
        },
        body: {
          profile_status: 'active',
        },
      });
    }

    const patchBody = action === 'archive'
      ? {
          status: 'archived',
          archived_at: now,
          archived_by: actor,
          notes: nextNotes,
        }
      : {
          status: 'reviewed',
          reviewed_at: now,
          reviewed_by: actor,
          notes: nextNotes,
        };

    await supabaseRest(`/app_submissions?id=eq.${submissionId}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: patchBody,
    });

    res.json({
      ok: true,
      action,
      submissionId,
      reviewedBy: actor,
      reviewedAt: action === 'review' ? now : '',
      archivedAt: action === 'archive' ? now : '',
    });
  } catch (error) {
    console.error('No se pudo procesar app_submission:', error);
    res.status(error.status || 500).json({
      error: isSupabaseConfigured()
        ? 'No se pudo actualizar el envío'
        : 'Supabase no está configurado en este entorno',
    });
  }
});

app.post(['/api/pacientes', '/api/fisio/pacientes'], requireFisioOrAdmin, (req, res) => {
  const { id, fechaNacimiento } = req.body;
  if (!id || !fechaNacimiento) return res.status(400).json({ error: 'Faltan campos' });
  const codigoPaciente = String(id).trim().toUpperCase();
  if (getPatientByCode(codigoPaciente)) return res.status(409).json({ error: 'ID ya existe' });

  const patientRecord = createPatientRecord({
    codigoPaciente,
    fechaNacimiento,
    currentUser: req.currentUser,
  });

  res.json({ ok: true, id: codigoPaciente, pacienteId: patientRecord.id });
});

app.get(['/api/pacientes', '/api/fisio/pacientes', '/api/admin/pacientes'], (req, res) => {
  const indice = leerIndice();
  const pacientes = req.path.startsWith('/api/admin/')
    ? getAdminPatientDirectory()
    : sortPacienteSummaries(
        Object.entries(indice).map(([id, value]) => buildPacienteSummary(id, value)),
      );

  res.json(pacientes);
});

app.get(['/api/pacientes/buscar', '/api/fisio/pacientes/buscar', '/api/admin/pacientes/buscar'], (req, res) => {
  const indice = leerIndice();
  const isAdminRoute = req.path.startsWith('/api/admin/');
  const adminDirectory = isAdminRoute ? getAdminPatientDirectory() : null;
  const totalPacientes = isAdminRoute ? adminDirectory.length : Object.keys(indice).length;
  const queryRaw = typeof req.query.q === 'string'
    ? req.query.q
    : typeof req.query.fechaNacimiento === 'string'
      ? req.query.fechaNacimiento
      : typeof req.query.id === 'string'
        ? req.query.id
        : typeof req.query.nombre === 'string'
          ? req.query.nombre
          : '';
  const fechaNormalizada = normalizeFechaNacimiento(queryRaw);
  const queryNormalized = normalizeText(queryRaw);

  if (totalPacientes === 0) {
    console.log('[buscar pacientes] consulta recibida:', queryRaw);
    console.log('[buscar pacientes] fecha normalizada:', fechaNormalizada);
    console.log('[buscar pacientes] pacientes en indice:', totalPacientes);
    console.log('[buscar pacientes] resultados encontrados:', 0);
    res.json([]);
    return;
  }

  if (!queryNormalized && !fechaNormalizada) {
    console.log('[buscar pacientes] consulta recibida:', queryRaw);
    console.log('[buscar pacientes] fecha normalizada:', fechaNormalizada);
    console.log('[buscar pacientes] pacientes en indice:', totalPacientes);
    console.log('[buscar pacientes] resultados encontrados:', 0);
    res.json([]);
    return;
  }

  const resultados = Object.entries(indice)
    .map(([id, value]) => buildPacienteSummary(id, value))
    .filter((paciente) => {
      const matchesFecha = Boolean(fechaNormalizada) && paciente.fechaNacimiento === fechaNormalizada;
      const matchesId = Boolean(queryNormalized) && normalizeText(paciente.id).includes(queryNormalized);
      const matchesNombre = Boolean(queryNormalized) && (
        normalizeText(paciente.nombre).includes(queryNormalized) ||
        normalizeText(paciente.apellidos).includes(queryNormalized) ||
        normalizeText(paciente.displayName).includes(queryNormalized)
      );

      return matchesFecha || matchesId || matchesNombre;
    });

  console.log('[buscar pacientes] consulta recibida:', queryRaw);
  console.log('[buscar pacientes] fecha normalizada:', fechaNormalizada);
  console.log('[buscar pacientes] pacientes en indice:', totalPacientes);
  console.log('[buscar pacientes] resultados encontrados:', resultados.length);

  if (isAdminRoute) {
    const adminResultados = adminDirectory.filter((paciente) => {
      const matchesFecha = Boolean(fechaNormalizada) && paciente.fechaNacimiento === fechaNormalizada;
      const matchesId = Boolean(queryNormalized) && normalizeText(paciente.id).includes(queryNormalized);
      const matchesNombre = Boolean(queryNormalized) && (
        normalizeText(paciente.nombre).includes(queryNormalized) ||
        normalizeText(paciente.apellidos).includes(queryNormalized) ||
        normalizeText(paciente.displayName).includes(queryNormalized)
      );

      return matchesFecha || matchesId || matchesNombre;
    });

    res.json(adminResultados);
    return;
  }

  res.json(resultados);
});

app.get('/api/admin/overview', (req, res) => {
  res.json(buildAdminOverview());
});

app.get('/api/admin/billing/profile-records', async (req, res) => {
  const registry = String(req.query.registry || '').trim().toUpperCase();

  if (!registry) {
    res.status(400).json({ error: 'Falta el numero de cliente.' });
    return;
  }

  const demoBillingData = getAdminDemoBillingData(registry);
  if (demoBillingData) {
    res.json(demoBillingData);
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase no esta configurado en este entorno.' });
    return;
  }

  try {
    const profileQuery = new URLSearchParams({
      select: 'id,created_at,updated_at,registry_number,name,surnames,phone,email,birth_date,profile_status',
      registry_number: `eq.${registry}`,
      limit: '1',
    });
    const [profile] = await supabaseRest(`/core_profiles?${profileQuery.toString()}`);

    if (!profile) {
      res.status(404).json({ error: 'Cliente no encontrado en Supabase.' });
      return;
    }

    const recordsQuery = new URLSearchParams({
      select: 'id,created_at,profile_id,app_id,record_type,submission_id,data,created_by,version',
      profile_id: `eq.${profile.id}`,
      order: 'created_at.desc',
      limit: '100',
    });
    const records = await supabaseRest(`/app_records?${recordsQuery.toString()}`);

    res.json({
      profile: mapProfileSummary(profile),
      records: Array.isArray(records) ? records.map(mapBillingRecordSummary) : [],
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: isSupabaseConfigured()
        ? 'No se pudieron cargar los registros del cliente'
        : 'Supabase no esta configurado en este entorno',
    });
  }
});

app.post(['/api/sesiones/:id', '/api/fisio/sesiones/:id'], requireFisioOrAdmin, (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const patientRecord = getPatientByCode(id);
  if (!patientRecord) return res.status(404).json({ error: 'Paciente no encontrado' });

  const fechaSolicitada = normalizeFechaNacimiento(req.body?.fecha);
  const fecha = fechaSolicitada || fechaHoy();
  persistSessionRecord({
    patientRecord,
    fecha,
    data: req.body || {},
    currentUser: req.currentUser,
  });

  res.json({ ok: true, fecha });
});

app.get(['/api/sesiones/:id/:fecha', '/api/fisio/sesiones/:id/:fecha', '/api/admin/sesiones/:id/:fecha'], (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const { fecha } = req.params;
  const sessionRecord = getSessionRecordByPatientCodeAndDate(id, fecha)
    || getAdminDemoSessionRecordByPatientCodeAndDate(id, fecha);
  if (!sessionRecord) return res.status(404).json({ error: 'Sesión no encontrada' });

  res.json({
    ...hydrateFichaCampos(sessionRecord),
    id,
    sessionId: sessionRecord.id,
    pacienteId: sessionRecord.paciente_id,
    fecha,
    creadoEn: sessionRecord.createdAt || '',
    actualizadoEn: sessionRecord.updatedAt || '',
    createdBy: sessionRecord.createdBy || '',
    updatedBy: sessionRecord.updatedBy || '',
    pdfGeneratedBy: sessionRecord.pdfGeneratedBy || '',
    pdfGeneratedAt: sessionRecord.pdfGeneratedAt || '',
    isDemo: Boolean(sessionRecord.isDemo),
  });
});

app.get(['/api/sesiones/:id', '/api/fisio/sesiones/:id', '/api/admin/sesiones/:id'], (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const patientRecord = getPatientByCode(id);
  if (patientRecord) {
    res.json({ id, pacienteId: patientRecord.id, sesiones: listSessionDatesForPatient(patientRecord.id) });
    return;
  }

  const demoPatient = getAdminDemoPacientes().find((patient) => patient.id === id);
  if (demoPatient) {
    res.json({ id, pacienteId: `demo-patient-${id}`, sesiones: demoPatient.sesiones || [], isDemo: true });
    return;
  }

  return res.status(404).json({ error: 'Paciente no encontrado' });
});

app.get(['/api/pdf/:id/:fecha', '/api/fisio/pdf/:id/:fecha'], (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const { fecha } = req.params;
  const pdfPath = legacyPdfPath(id, fecha);

  if (!fs.existsSync(pdfPath)) {
    res.status(404).json({ error: 'PDF no encontrado' });
    return;
  }

  res.download(pdfPath, `${id}_${fecha}.pdf`);
});

// Walk-in PDF: generates a one-off PDF without requiring a patient record.
// The session data is NOT persisted. Requires authenticated (non-demo) user.
app.post(['/api/pdf/walk-in', '/api/fisio/pdf/walk-in'], requireFisioOrAdmin, (req, res) => {
  const fechaStr = String(req.body.fecha || fechaHoy()).trim();
  const ficha = hydrateFichaCampos(req.body);
  const tempId = `WALK-${fechaStr.replace(/-/g, '')}`;

  const doc = new PDFDocument({ margin: 60, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${tempId}_sesion_rapida.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 80).fill('#0F6E56');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('FisioApp', 60, 25);
  doc.fillColor('#9FE1CB').font('Helvetica').fontSize(11).text('Sesión sin registro previo', 60, 52);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text('Sin expediente asignado', 60, 25, { align: 'right' });
  doc.fillColor('#9FE1CB').fontSize(10)
    .text(`Fecha: ${fechaStr.split('-').reverse().join('/')}`, 60, 40, { align: 'right' });
  doc.moveDown(4);

  const seccion = (titulo, rows) => {
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11).text(titulo.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.3);
    doc.rect(60, doc.y, doc.page.width - 120, 0.5).fill('#9FE1CB');
    doc.moveDown(0.5);
    rows.forEach(({ label, value }) => {
      doc.fillColor('#2C2C2A').font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
      doc.font('Helvetica').text(` ${value || '—'}`, { lineGap: 4 });
      doc.moveDown(0.35);
    });
    doc.moveDown(1.5);
  };

  seccion('Datos personales', [
    { label: 'Apellidos', value: ficha.apellidos },
    { label: 'Nombre', value: ficha.nombre },
    { label: 'Edad', value: ficha.edad },
    { label: 'Sexo', value: ficha.sexo },
    { label: 'Profesión', value: ficha.profesion },
    { label: 'Diagnóstico médico', value: ficha.diagnosticoMedico },
  ]);
  seccion('Historia clínica y exploración', [
    { label: 'Historia clínica', value: ficha.historiaClinica },
    { label: 'Anamnesis', value: ficha.anamnesis },
  ]);
  seccion('Problemas y tratamiento', [
    { label: 'Diagnóstico fisioterápico', value: ficha.problemasFisioterapeuticos },
    { label: 'Plan de tratamiento', value: ficha.planTratamiento },
    { label: 'Evolución y exploración', value: ficha.evolucionExploracionTratamiento },
  ]);

  doc.end();
});

app.post(['/api/pdf/:id', '/api/fisio/pdf/:id'], requireFisioOrAdmin, (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const patientRecord = getPatientByCode(id);
  if (!patientRecord) {
    res.status(404).json({ error: 'Paciente no encontrado' });
    return;
  }

  const ficha = hydrateFichaCampos(req.body);
  const { fecha } = req.body;
  const fechaStr = fecha || fechaHoy();
  persistSessionRecord({
    patientRecord,
    fecha: fechaStr,
    data: {
      ...ficha,
      pdfGeneratedBy: req.currentUser?.id || '',
      pdfGeneratedAt: new Date().toISOString(),
    },
    currentUser: req.currentUser,
  });

  const pdfDir = legacySessionDir(id);
  const pdfPath = legacyPdfPath(id, fechaStr);

  const doc = new PDFDocument({ margin: 60, size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  doc.rect(0, 0, doc.page.width, 80).fill('#0F6E56');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('FisioApp', 60, 25);
  doc.fillColor('#9FE1CB').font('Helvetica').fontSize(11).text('Informe de revisión clínica', 60, 52);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text(`ID Paciente: ${id}`, 60, 25, { align: 'right' });
  doc.fillColor('#9FE1CB').fontSize(10)
    .text(`Fecha: ${fechaStr.split('-').reverse().join('/')}`, 60, 40, { align: 'right' });

  doc.moveDown(4);

  const seccion = (titulo, rows) => {
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11)
      .text(titulo.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.3);
    doc.rect(60, doc.y, doc.page.width - 120, 0.5).fill('#9FE1CB');
    doc.moveDown(0.5);

    rows.forEach(({ label, value }) => {
      doc.fillColor('#2C2C2A').font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
      doc.font('Helvetica').text(` ${value || '—'}`, {
        lineGap: 4,
      });
      doc.moveDown(0.35);
    });

    doc.moveDown(1.5);
  };

  seccion('Datos personales', [
    { label: 'Apellidos', value: ficha.apellidos },
    { label: 'Nombre', value: ficha.nombre },
    { label: 'Edad', value: ficha.edad },
    { label: 'Sexo', value: ficha.sexo },
    { label: 'Profesión', value: ficha.profesion },
    { label: 'Altura / Peso', value: ficha.alturaPeso },
    { label: 'Diagnóstico médico', value: ficha.diagnosticoMedico },
    { label: 'Fecha inicial de anomalía', value: ficha.fechaInicialAnomalia },
    { label: 'Tratamientos afines', value: ficha.tratamientosAfines },
    { label: 'Medicación anterior / actual', value: ficha.medicacion },
    { label: 'Prueba de imagen', value: ficha.pruebaImagen },
  ]);

  seccion('Historia clínica y exploración', [
    { label: 'Historia clínica', value: ficha.historiaClinica },
    { label: 'Anamnesis', value: ficha.anamnesis },
    { label: 'Antecedentes AL o AV', value: ficha.antecedentesALAV },
    { label: 'Antecedentes AQ', value: ficha.antecedentesAQ },
    { label: 'Inspección / observación', value: ficha.inspeccionObservacion },
    { label: 'Palpación diagnóstica', value: ficha.palpacionDiagnostica },
    { label: 'Sensibilidad en', value: ficha.sensibilidad },
    { label: 'PGS', value: ficha.pgs },
    { label: 'Balance muscular', value: ficha.balanceMuscular },
    { label: 'Balance articular / movilidad + disfunciones', value: ficha.balanceArticular },
    { label: 'Datos de interés', value: ficha.datosInteres },
    { label: 'Valoración funcional', value: ficha.valoracionFuncional },
    { label: 'Pruebas específicas', value: ficha.pruebasEspecificas },
  ]);

  doc.addPage();
  doc.rect(0, 0, doc.page.width, 80).fill('#0F6E56');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('FisioApp', 60, 25);
  doc.fillColor('#9FE1CB').font('Helvetica').fontSize(11).text('Continuación del registro', 60, 52);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text(`ID Paciente: ${id}`, 60, 25, { align: 'right' });
  doc.fillColor('#9FE1CB').fontSize(10)
    .text(`Fecha: ${fechaStr.split('-').reverse().join('/')}`, 60, 40, { align: 'right' });
  doc.moveDown(4);

  seccion('Problemas y tratamiento', [
    { label: 'Problemas fisioterapéuticos', value: ficha.problemasFisioterapeuticos },
    { label: 'Programa de fisioterapia', value: ficha.programaFisioterapia },
    { label: 'Plan de tratamiento', value: ficha.planTratamiento },
    { label: 'Recomendaciones a la familia', value: ficha.recomendacionesFamilia },
    { label: 'Objetivos fisioterapéuticos', value: ficha.objetivosFisioterapeuticos },
    { label: 'Evolución, exploración y tratamiento', value: ficha.evolucionExploracionTratamiento },
  ]);

  stream.on('finish', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_${fechaStr}.pdf"`);
    res.setHeader('X-Pdf-Saved-Path', pdfPath);
    res.setHeader('X-Pdf-Saved-Dir', pdfDir);
    fs.createReadStream(pdfPath).pipe(res);
  });

  stream.on('error', (error) => {
    console.error('Error al guardar PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo generar el PDF' });
    }
  });

  doc.fontSize(9).fillColor('#888780')
    .text(
      'Documento generado por FisioApp · Uso clínico interno · Datos anonimizados',
      60,
      doc.page.height - 40,
      { align: 'center' }
    );

  doc.end();
});


if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
  app.get('/', (req, res) => {
    res.redirect('/fisio');
  });

  app.get('/fisio', (req, res) => {
    res.sendFile(FISIO_HTML_PATH);
  });

  app.get('/admin', (req, res) => {
    res.sendFile(ADMIN_HTML_PATH);
  });

  app.use(express.static(FRONTEND_DIR));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    if (req.path === '/registro.html') {
      res.sendFile(REGISTRO_HTML_PATH);
      return;
    }

    if (req.path.startsWith('/fisio/')) {
      res.sendFile(FISIO_HTML_PATH);
      return;
    }

    if (req.path.startsWith('/admin/')) {
      res.sendFile(ADMIN_HTML_PATH);
      return;
    }

    res.sendFile(LANDING_HTML_PATH);
  });
}

app.listen(PORT, HOST, () => {
  console.log(`FisioApp corriendo en http://${HOST}:${PORT}`);
  console.log(`Frontend servido desde: ${FRONTEND_DIR}`);
  console.log(`Datos en: ${DATA_DIR}`);
});
