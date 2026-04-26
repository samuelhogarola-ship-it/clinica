import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Dirs
const DATA_DIR = path.join(__dirname, 'datos');
const SESIONES_DIR = path.join(DATA_DIR, 'sesiones');
const INDICE_PATH = path.join(DATA_DIR, 'indice', 'indice.json');

[DATA_DIR, SESIONES_DIR, path.join(DATA_DIR, 'indice')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

if (!fs.existsSync(INDICE_PATH)) fs.writeFileSync(INDICE_PATH, '{}', 'utf8');

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

app.use(cors());
app.use(express.json());

// ── Helpers ──────────────────────────────────────────────────────────────────
function leerIndice() {
  return JSON.parse(fs.readFileSync(INDICE_PATH, 'utf8'));
}
function guardarIndice(indice) {
  fs.writeFileSync(INDICE_PATH, JSON.stringify(indice, null, 2), 'utf8');
}
function fechaHoy() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
function sesionPath(id, fecha) {
  const dir = path.join(SESIONES_DIR, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${fecha}.json`);
}

// ── Pacientes: crear ──────────────────────────────────────────────────────────
app.post('/api/pacientes', (req, res) => {
  const { id, fechaNacimiento } = req.body;
  if (!id || !fechaNacimiento) return res.status(400).json({ error: 'Faltan campos' });
  const indice = leerIndice();
  if (indice[id]) return res.status(409).json({ error: 'ID ya existe' });
  indice[id] = { fechaNacimiento, creadoEn: new Date().toISOString(), sesiones: [] };
  guardarIndice(indice);
  res.json({ ok: true, id });
});

// ── Pacientes: buscar por fecha de nacimiento ──────────────────────────────
app.get('/api/pacientes/buscar', (req, res) => {
  const { fechaNacimiento } = req.query;
  if (!fechaNacimiento) return res.status(400).json({ error: 'Falta fechaNacimiento' });
  const indice = leerIndice();
  const resultados = Object.entries(indice)
    .filter(([, v]) => v.fechaNacimiento === fechaNacimiento)
    .map(([id, v]) => ({ id, sesiones: v.sesiones }));
  res.json(resultados);
});

// ── Sesiones: guardar/actualizar ──────────────────────────────────────────────
app.post('/api/sesiones/:id', (req, res) => {
  const { id } = req.params;
  const indice = leerIndice();
  if (!indice[id]) return res.status(404).json({ error: 'Paciente no encontrado' });

  const fecha = fechaHoy();
  const filePath = sesionPath(id, fecha);
  const datos = req.body; // { sintomas, diagnostico, tratamiento }

  fs.writeFileSync(filePath, JSON.stringify({ ...datos, id, fecha, actualizadoEn: new Date().toISOString() }, null, 2));

  if (!indice[id].sesiones.includes(fecha)) {
    indice[id].sesiones.push(fecha);
    guardarIndice(indice);
  }
  res.json({ ok: true, fecha });
});

// ── Sesiones: cargar ──────────────────────────────────────────────────────────
app.get('/api/sesiones/:id/:fecha', (req, res) => {
  const { id, fecha } = req.params;
  const filePath = path.join(SESIONES_DIR, id, `${fecha}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

// ── Sesiones: listar del paciente ─────────────────────────────────────────────
app.get('/api/sesiones/:id', (req, res) => {
  const { id } = req.params;
  const indice = leerIndice();
  if (!indice[id]) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json({ id, sesiones: indice[id].sesiones.sort().reverse() });
});

// ── PDF: generar y guardar ────────────────────────────────────────────────────
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

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill('#0F6E56');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('FisioApp', 60, 25);
  doc.fillColor('#9FE1CB').font('Helvetica').fontSize(11).text('Informe de revisión clínica', 60, 52);

  // ID + fecha — alineado a la derecha en el header
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

  // Footer
  doc.fontSize(9).fillColor('#888780')
    .text('Documento generado por FisioApp · Uso clínico interno · Datos anonimizados',
      60, doc.page.height - 40, { align: 'center' });

  doc.end();

  stream.on('finish', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_${fechaStr}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  });
});

// ── Whisper: transcribir audio ────────────────────────────────────────────────
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
  } catch (err) {
    console.error('Whisper error:', err);
    res.status(500).json({ error: 'Error al transcribir' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FisioApp backend corriendo en http://0.0.0.0:${PORT}`);
  console.log(`Datos en: ${DATA_DIR}`);
});
