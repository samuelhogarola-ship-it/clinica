import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const FALLBACK_DIST_DIR = path.join(__dirname, 'frontend', 'dist');
const FRONTEND_DIR = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? PUBLIC_DIR : FALLBACK_DIST_DIR;
const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'backend', 'datos'))
    ? path.join(__dirname, 'backend', 'datos')
    : path.join(__dirname, 'datos')
);
const INDICE_DIR = path.join(DATA_DIR, 'indice');
const SESIONES_DIR = path.join(DATA_DIR, 'sesiones');
const INDICE_PATH = path.join(INDICE_DIR, 'indice.json');
const authTokens = new Set();

[DATA_DIR, INDICE_DIR, SESIONES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync(INDICE_PATH)) {
  fs.writeFileSync(INDICE_PATH, '{}', 'utf8');
}

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

app.use(cors());
app.use(express.json());

function leerIndice() {
  return JSON.parse(fs.readFileSync(INDICE_PATH, 'utf8'));
}

function guardarIndice(indice) {
  fs.writeFileSync(INDICE_PATH, JSON.stringify(indice, null, 2), 'utf8');
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function sesionPath(id, fecha) {
  const dir = path.join(SESIONES_DIR, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${fecha}.json`);
}

function requireAuth(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token || !authTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!APP_PASSWORD || password !== APP_PASSWORD) {
    res.json({ success: false });
    return;
  }

  const token = crypto.randomUUID();
  authTokens.add(token);
  res.json({ success: true, token });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/login') {
    next();
    return;
  }

  requireAuth(req, res, next);
});

app.post('/api/pacientes', (req, res) => {
  const { id, fechaNacimiento } = req.body;
  if (!id || !fechaNacimiento) return res.status(400).json({ error: 'Faltan campos' });
  const indice = leerIndice();
  if (indice[id]) return res.status(409).json({ error: 'ID ya existe' });
  indice[id] = { fechaNacimiento, creadoEn: new Date().toISOString(), sesiones: [] };
  guardarIndice(indice);
  res.json({ ok: true, id });
});

app.get('/api/pacientes/buscar', (req, res) => {
  const { fechaNacimiento } = req.query;
  if (!fechaNacimiento) return res.status(400).json({ error: 'Falta fechaNacimiento' });
  const indice = leerIndice();
  const resultados = Object.entries(indice)
    .filter(([, value]) => value.fechaNacimiento === fechaNacimiento)
    .map(([id, value]) => ({ id, sesiones: value.sesiones }));
  res.json(resultados);
});

app.post('/api/sesiones/:id', (req, res) => {
  const { id } = req.params;
  const indice = leerIndice();
  if (!indice[id]) return res.status(404).json({ error: 'Paciente no encontrado' });

  const fecha = fechaHoy();
  const filePath = sesionPath(id, fecha);
  const datos = req.body;

  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...datos, id, fecha, actualizadoEn: new Date().toISOString() }, null, 2)
  );

  if (!indice[id].sesiones.includes(fecha)) {
    indice[id].sesiones.push(fecha);
    guardarIndice(indice);
  }

  res.json({ ok: true, fecha });
});

app.get('/api/sesiones/:id/:fecha', (req, res) => {
  const { id, fecha } = req.params;
  const filePath = path.join(SESIONES_DIR, id, `${fecha}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

app.get('/api/sesiones/:id', (req, res) => {
  const { id } = req.params;
  const indice = leerIndice();
  if (!indice[id]) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json({ id, sesiones: indice[id].sesiones.sort().reverse() });
});

app.post('/api/pdf/:id', (req, res) => {
  const { id } = req.params;
  const { sintomas, diagnostico, tratamiento, fecha } = req.body;
  const fechaStr = fecha || fechaHoy();

  const pdfDir = path.join(SESIONES_DIR, id);
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  const pdfPath = path.join(pdfDir, `${fechaStr}.pdf`);

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

  const seccion = (titulo, contenido) => {
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11)
      .text(titulo.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.3);
    doc.rect(60, doc.y, doc.page.width - 120, 0.5).fill('#9FE1CB');
    doc.moveDown(0.5);
    doc.fillColor('#2C2C2A').font('Helvetica').fontSize(11).text(contenido || '—', {
      lineGap: 4,
      paragraphGap: 4
    });
    doc.moveDown(1.5);
  };

  seccion('Síntomas actuales', sintomas);
  seccion('Diagnóstico', diagnostico);
  seccion('Tratamiento', tratamiento);

  doc.fontSize(9).fillColor('#888780')
    .text(
      'Documento generado por FisioApp · Uso clínico interno · Datos anonimizados',
      60,
      doc.page.height - 40,
      { align: 'center' }
    );

  doc.end();

  stream.on('finish', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_${fechaStr}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  });
});

app.post('/api/transcribir', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió audio' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  try {
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const file = new File([blob], 'audio.webm', { type: req.file.mimetype });
    const transcripcion = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es',
    });
    res.json({ texto: transcripcion.text });
  } catch (error) {
    console.error('Whisper error:', error);
    res.status(500).json({ error: 'Error al transcribir' });
  }
});

if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
  app.use(express.static(FRONTEND_DIR));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`FisioApp corriendo en http://${HOST}:${PORT}`);
  console.log(`Frontend servido desde: ${FRONTEND_DIR}`);
  console.log(`Datos en: ${DATA_DIR}`);
});
