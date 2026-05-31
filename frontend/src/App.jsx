import { useState, useEffect, useCallback } from 'react';

const API = '/api';
const TOKEN_STORAGE_KEY = 'fisioapp-token';
const USER_STORAGE_KEY = 'fisioapp-user';

function getStoredToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeAuth(token, currentUser) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredAuth();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return response;
}

// ── Utilidades ────────────────────────────────────────────────────────────────
const fechaHoy = () => new Date().toISOString().split('T')[0];
const formatFecha = (iso) => iso.split('-').reverse().join('/');
const formatFechaHora = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const esFechaValida = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const normalizeFechaNacimiento = (value) => {
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
};

const PERSONAL_FIELDS = [
  'apellidos',
  'nombre',
  'edad',
  'sexo',
  'profesion',
  'alturaPeso',
  'diagnosticoMedico',
  'fechaInicialAnomalia',
  'tratamientosAfines',
  'medicacion',
  'pruebaImagen',
];

const pickPersonalFields = (data = {}) => PERSONAL_FIELDS.reduce((acc, field) => {
  acc[field] = data[field] || '';
  return acc;
}, {});

const getSubmissionDisplayName = (submission) => {
  const name = submission?.profile?.name || submission?.data?.nombre || '';
  const surnames = submission?.profile?.surnames || submission?.data?.apellidos || '';
  return [name, surnames].filter(Boolean).join(' ') || 'Paciente sin nombre';
};

// ── Iconos SVG inline ─────────────────────────────────────────────────────────
const IconPDF = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);
const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconBack = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Estilos compartidos ───────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  topbar: {
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--teal-base)' },
  logoText: { fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em' },
  main: { flex: 1, padding: '32px 24px', maxWidth: 680, margin: '0 auto', width: '100%' },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 16,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)',
  },
  cardTitle: { fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--gray-600)', textTransform: 'uppercase' },
  label: { fontSize: 12, color: 'var(--gray-600)', marginBottom: 5, display: 'block' },
  input: {
    width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--gray-900)',
    outline: 'none', transition: 'border-color 0.15s',
  },
  textarea: {
    width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--gray-900)',
    outline: 'none', transition: 'border-color 0.15s', lineHeight: 1.6,
    resize: 'vertical', minHeight: 90, fontFamily: 'var(--font-body)',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px',
    fontSize: 14, fontWeight: 500, background: 'var(--teal-base)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
    fontSize: 14, background: 'transparent', color: 'var(--gray-600)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    fontSize: 13, background: 'transparent', color: 'var(--gray-600)',
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  },
  idChip: {
    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '4px 10px',
    background: 'var(--teal-pale)', color: 'var(--teal-mid)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--teal-light)',
  },
  savePill: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, color: 'var(--teal-mid)', opacity: 0,
    transition: 'opacity 0.4s',
  },
  authShell: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  authCard: {
    width: '100%', maxWidth: 420, background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '28px 28px 24px',
    boxShadow: '0 18px 50px rgba(44, 44, 42, 0.06)',
  },
  authLogo: {
    width: 14, height: 14, borderRadius: '50%', background: 'var(--teal-base)',
    marginBottom: 18,
  },
  authTitle: { fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 8 },
  authText: { color: 'var(--gray-600)', fontSize: 14, marginBottom: 20 },
  authError: { fontSize: 13, color: '#A14B2E', marginTop: 12 },
  accordion: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', marginBottom: 16, overflow: 'hidden',
  },
  accordionSummary: {
    listStyle: 'none', cursor: 'pointer', padding: '18px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
  },
  select: {
    width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--gray-900)',
    outline: 'none',
  },
};

const FICHA_DEFAULTS = {
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
};

function hydrateFichaCampos(data = {}) {
  const merged = { ...FICHA_DEFAULTS, ...data };

  if (!merged.anamnesis && data.sintomas) merged.anamnesis = data.sintomas;
  if (!merged.diagnosticoMedico && data.diagnostico) merged.diagnosticoMedico = data.diagnostico;
  if (!merged.planTratamiento && data.tratamiento) merged.planTratamiento = data.tratamiento;

  return merged;
}

function sesionEsEditablePorDefecto(fecha) {
  return fecha === 'nueva' || fecha === fechaHoy();
}

function VistaLogin({ onLoginCorrecto }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const acceder = async () => {
    if (!username || !password) return;
    setError('');
    setCargando(true);

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success && data.token && data.currentUser) {
        storeAuth(data.token, data.currentUser);
        onLoginCorrecto(data.currentUser);
        return;
      }

      setError('Usuario o contraseña incorrectos.');
    } catch {
      setError('No se pudo verificar el acceso.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={s.authShell}>
      <div style={s.authCard}>
        <div style={s.authLogo} />
        <h1 style={s.authTitle}>Acceso protegido</h1>
        <p style={s.authText}>
          Introduce la contraseña de acceso para abrir la aplicación clínica.
        </p>

        <label style={s.label}>Usuario</label>
        <input
          style={{ ...s.input, marginBottom: 14 }}
          type="text"
          value={username}
          placeholder="Usuario"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && acceder()}
        />

        <label style={s.label}>Contraseña</label>
        <input
          style={s.input}
          type="password"
          value={password}
          placeholder="Contraseña"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && acceder()}
        />

        {error && <p style={s.authError}>{error}</p>}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={s.btnPrimary} onClick={acceder} disabled={cargando || !username || !password}>
            {cargando ? 'Verificando...' : 'Acceder'}
          </button>
        </div>
      </div>

      <style>{`
        input:focus, textarea:focus { border-color: var(--teal-light) !important; box-shadow: 0 0 0 3px var(--teal-pale); }
      `}</style>
    </div>
  );
}

function CampoFicha({ label, value, onChange, placeholder, multiline = false, readOnly = false }) {
  if (multiline) {
    return (
      <div style={{ marginBottom: 20 }}>
        <label style={s.label}>{label}</label>
        <textarea
          style={{ ...s.textarea, background: readOnly ? 'var(--surface)' : s.textarea.background }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      <input
        style={{ ...s.input, background: readOnly ? 'var(--surface)' : s.input.background }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}

function SeccionDesplegable({ title, subtitle, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} style={s.accordion}>
      <summary style={s.accordionSummary}>
        <span style={s.cardTitle}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{subtitle}</span>
      </summary>
      <div style={{ padding: '18px 24px 20px' }}>
        {children}
      </div>
    </details>
  );
}

function VistaSubmissions({ currentUser, onVolver }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [regeneratingDocumentId, setRegeneratingDocumentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  const selectedSubmission = submissions.find((submission) => submission.id === selectedId) || null;
  const selectedFicha = selectedSubmission ? hydrateFichaCampos(selectedSubmission.data || {}) : FICHA_DEFAULTS;

  const loadSubmissions = async ({ keepSelection = false } = {}) => {
    setError('');
    setSuccess('');
    if (!keepSelection) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await apiFetch('/intake/submissions?status=pending&limit=100');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los envíos');
      }

      const nextSubmissions = Array.isArray(data) ? data : [];
      setSubmissions(nextSubmissions);

      if (keepSelection && nextSubmissions.some((submission) => submission.id === selectedId)) {
        return;
      }

      setSelectedId(nextSubmissions[0]?.id || '');
    } catch (loadError) {
      setSubmissions([]);
      setSelectedId('');
      setError(loadError.message || 'No se pudieron cargar los envíos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    setReviewerNotes('');
    setSuccess('');
  }, [selectedId]);

  useEffect(() => {
    const profileId = selectedSubmission?.profile_id;

    if (!profileId) {
      setDocuments([]);
      return;
    }

    let cancelled = false;
    setLoadingDocuments(true);

    apiFetch(`/intake/profiles/${profileId}/documents?limit=20`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          throw new Error(data.error || 'No se pudieron cargar los documentos');
        }
        setDocuments(Array.isArray(data) ? data : []);
      })
      .catch((docsError) => {
        if (cancelled) return;
        setDocuments([]);
        setError((current) => current || docsError.message || 'No se pudieron cargar los documentos');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubmission?.profile_id]);

  const processSubmission = async (action) => {
    if (!selectedSubmission) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/intake/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewerNotes,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el envío');
      }

      setReviewerNotes('');
      setSuccess(
        action === 'archive'
          ? 'Envío archivado correctamente.'
          : 'Envío marcado como revisado y pasado a historial clínico.',
      );
      await loadSubmissions();
    } catch (saveError) {
      setError(saveError.message || 'No se pudo actualizar el envío');
    } finally {
      setSaving(false);
    }
  };

  const regenerateDocument = async (submissionId) => {
    if (!submissionId) return;

    setRegeneratingDocumentId(submissionId);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/intake/submissions/${submissionId}/regenerate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo regenerar el PDF');
      }

      setDocuments((current) => current.map((document) => (
        document.submission_id === submissionId
          ? {
              ...document,
              pdf_bucket: data.pdf_bucket,
              pdf_path: data.pdf_path,
              pdf_filename: data.pdf_filename,
              signed_url: data.signed_url,
            }
          : document
      )));
      setSuccess('PDF regenerado desde los datos guardados del formulario estático.');
    } catch (regenerateError) {
      setError(regenerateError.message || 'No se pudo regenerar el PDF');
    } finally {
      setRegeneratingDocumentId('');
    }
  };

  return (
    <div>
      <button style={{ ...s.btnGhost, marginBottom: 24 }} onClick={onVolver}>
        <IconBack size={15} /> Volver
      </button>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 6, letterSpacing: '-0.02em' }}>
          Revisión de envíos pendientes
        </h2>
        <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>
          Cola interna para validar formularios públicos y dejar trazabilidad de la revisión.
        </p>
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Bandeja de entrada</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
              {loading ? 'Cargando...' : `${submissions.length} pendientes`}
            </span>
            <button style={s.btnSecondary} onClick={() => loadSubmissions({ keepSelection: true })} disabled={refreshing || loading}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>Cargando envíos pendientes...</p>
        ) : submissions.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>
            No hay envíos pendientes ahora mismo.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)', gap: 18 }}>
            <div>
              {submissions.map((submission) => {
                const isActive = submission.id === selectedId;
                return (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedId(submission.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: isActive ? '1px solid var(--teal-base)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--teal-pale)' : 'var(--bg)',
                      cursor: 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{getSubmissionDisplayName(submission)}</strong>
                      <span style={{ ...s.idChip, fontSize: 11 }}>{submission.app_id}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6, lineHeight: 1.5 }}>
                      <div>{submission.profile?.registry_number || 'Sin registro'} · {submission.profile?.phone || submission.data?.phone || 'Sin teléfono'}</div>
                      <div>{formatFechaHora(submission.created_at)}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedSubmission && (
              <div>
                <div style={{ ...s.card, marginBottom: 16, padding: '18px 20px' }}>
                  <div style={s.cardHeader}>
                    <span style={s.cardTitle}>Resumen del envío</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      Revisa {currentUser?.displayName || 'staff'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div>
                      <label style={s.label}>Paciente</label>
                      <div style={s.input}>{getSubmissionDisplayName(selectedSubmission)}</div>
                    </div>
                    <div>
                      <label style={s.label}>Registro</label>
                      <div style={s.input}>{selectedSubmission.profile?.registry_number || 'Pendiente'}</div>
                    </div>
                    <div>
                      <label style={s.label}>Teléfono</label>
                      <div style={s.input}>{selectedSubmission.profile?.phone || selectedSubmission.data?.phone || '—'}</div>
                    </div>
                    <div>
                      <label style={s.label}>Email</label>
                      <div style={s.input}>{selectedSubmission.profile?.email || selectedSubmission.data?.email || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span style={s.idChip}>{selectedSubmission.app_id}</span>
                    {selectedSubmission.data?.pdf_signed_url && (
                      <a
                        href={selectedSubmission.data.pdf_signed_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...s.btnSecondary, textDecoration: 'none' }}
                      >
                        Ver PDF enviado
                      </a>
                    )}
                  </div>

                  <label style={s.label}>Notas internas de revisión</label>
                  <textarea
                    style={s.textarea}
                    value={reviewerNotes}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    placeholder="Ej: validado con paciente, pendiente adjuntar prueba, archivado por duplicado..."
                  />

                  {selectedSubmission.notes && (
                    <div style={{ marginTop: 12 }}>
                      <label style={s.label}>Histórico de notas</label>
                      <div style={{ ...s.textarea, background: 'var(--surface)', whiteSpace: 'pre-wrap' }}>
                        {selectedSubmission.notes}
                      </div>
                    </div>
                  )}

                  {error && <p style={{ fontSize: 13, color: '#D85A30', marginTop: 12 }}>{error}</p>}
                  {success && <p style={{ fontSize: 13, color: 'var(--teal-dark)', marginTop: 12 }}>{success}</p>}

                  <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                    <button style={s.btnPrimary} onClick={() => processSubmission('review')} disabled={saving}>
                      {saving ? 'Guardando...' : 'Marcar revisado'}
                    </button>
                    <button style={s.btnSecondary} onClick={() => processSubmission('archive')} disabled={saving}>
                      Archivar
                    </button>
                  </div>
                </div>

                <SeccionDesplegable title="Datos personales" subtitle={selectedSubmission.form_version || 'sin versión'}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <CampoFicha label="Apellidos" value={selectedFicha.apellidos} onChange={() => {}} readOnly />
                    <CampoFicha label="Nombre" value={selectedFicha.nombre} onChange={() => {}} readOnly />
                    <CampoFicha label="Edad" value={selectedFicha.edad} onChange={() => {}} readOnly />
                    <CampoFicha label="Sexo" value={selectedFicha.sexo} onChange={() => {}} readOnly />
                    <CampoFicha label="Profesión" value={selectedFicha.profesion} onChange={() => {}} readOnly />
                    <CampoFicha label="Altura / Peso" value={selectedFicha.alturaPeso} onChange={() => {}} readOnly />
                    <CampoFicha label="Diagnóstico médico" value={selectedFicha.diagnosticoMedico} onChange={() => {}} readOnly />
                    <CampoFicha label="Fecha inicial de anomalía" value={selectedFicha.fechaInicialAnomalia} onChange={() => {}} readOnly />
                    <CampoFicha label="Tratamientos afines" value={selectedFicha.tratamientosAfines} onChange={() => {}} readOnly />
                    <CampoFicha label="Medicación" value={selectedFicha.medicacion} onChange={() => {}} readOnly />
                    <CampoFicha label="Prueba de imagen" value={selectedFicha.pruebaImagen} onChange={() => {}} readOnly />
                  </div>
                </SeccionDesplegable>

                <SeccionDesplegable title="Documentos del paciente" subtitle="PDFs asociados" defaultOpen={false}>
                  {loadingDocuments ? (
                    <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>Cargando documentos...</p>
                  ) : documents.length === 0 ? (
                    <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>
                      Este perfil todavía no tiene PDFs indexados desde el flujo público.
                    </p>
                  ) : (
                    documents.map((document) => (
                      <div
                        key={`${document.submission_id}-${document.pdf_path}`}
                        style={{
                          padding: '12px 14px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 10,
                          background: 'var(--bg)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14 }}>{document.pdf_filename || 'Documento PDF'}</strong>
                          <span style={{ ...s.idChip, fontSize: 11 }}>{document.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6, lineHeight: 1.5 }}>
                          <div>{document.submission_date ? `Fecha clínica: ${formatFecha(document.submission_date)}` : `Envío: ${formatFechaHora(document.created_at)}`}</div>
                          <div style={{ fontFamily: 'var(--font-mono)' }}>{document.pdf_path}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                          {document.signed_url ? (
                            <a
                              href={document.signed_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ ...s.btnSecondary, textDecoration: 'none' }}
                            >
                              Abrir PDF
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: '#A14B2E' }}>
                              No se pudo firmar la descarga en este momento.
                            </span>
                          )}
                          <button
                            style={s.btnSecondary}
                            onClick={() => regenerateDocument(document.submission_id)}
                            disabled={regeneratingDocumentId === document.submission_id}
                          >
                            {regeneratingDocumentId === document.submission_id ? 'Regenerando...' : 'Regenerar PDF'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </SeccionDesplegable>

                <SeccionDesplegable title="Historia clínica y exploración" subtitle="solo lectura" defaultOpen={false}>
                  <CampoFicha label="Historia clínica" value={selectedFicha.historiaClinica} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Anamnesis" value={selectedFicha.anamnesis} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Antecedentes AL o AV" value={selectedFicha.antecedentesALAV} onChange={() => {}} readOnly />
                  <CampoFicha label="Antecedentes AQ" value={selectedFicha.antecedentesAQ} onChange={() => {}} readOnly />
                  <CampoFicha label="Inspección / observación" value={selectedFicha.inspeccionObservacion} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Palpación diagnóstica" value={selectedFicha.palpacionDiagnostica} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Sensibilidad en" value={selectedFicha.sensibilidad} onChange={() => {}} readOnly />
                  <CampoFicha label="PGS" value={selectedFicha.pgs} onChange={() => {}} readOnly />
                  <CampoFicha label="Balance muscular" value={selectedFicha.balanceMuscular} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Balance articular / movilidad + disfunciones" value={selectedFicha.balanceArticular} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Datos de interés" value={selectedFicha.datosInteres} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Valoración funcional" value={selectedFicha.valoracionFuncional} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Pruebas específicas" value={selectedFicha.pruebasEspecificas} onChange={() => {}} multiline readOnly />
                </SeccionDesplegable>

                <SeccionDesplegable title="Problemas y tratamiento" subtitle="solo lectura" defaultOpen={false}>
                  <CampoFicha label="Problemas fisioterapéuticos" value={selectedFicha.problemasFisioterapeuticos} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Programa de fisioterapia" value={selectedFicha.programaFisioterapia} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Plan de tratamiento" value={selectedFicha.planTratamiento} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Recomendaciones a la familia" value={selectedFicha.recomendacionesFamilia} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Objetivos fisioterapéuticos" value={selectedFicha.objetivosFisioterapeuticos} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Evolución, exploración y tratamiento" value={selectedFicha.evolucionExploracionTratamiento} onChange={() => {}} multiline readOnly />
                </SeccionDesplegable>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vista: Inicio / Buscador ──────────────────────────────────────────────────
function VistaBuscador({ onSeleccionarPaciente, onNuevoPaciente, onAbrirPendientes }) {
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [buscado, setBuscado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cargarPacientes = async () => {
      setCargandoPacientes(true);
      try {
        const res = await apiFetch('/pacientes');
        const data = await res.json();
        if (!cancelled) {
          setPacientes(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setPacientes([]);
        }
      } finally {
        if (!cancelled) {
          setCargandoPacientes(false);
        }
      }
    };

    cargarPacientes();

    return () => {
      cancelled = true;
    };
  }, []);

  const buscar = async () => {
    const query = consulta.trim();
    if (!query) {
      setResultados([]);
      setBuscado(false);
      return;
    }

    setCargando(true);
    setBuscado(false);

    try {
      const res = await apiFetch(`/pacientes/buscar?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResultados(data);
      setBuscado(true);
    } catch {
      setResultados([]);
      setBuscado(true);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 6 }}>FisioApp</h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Gestión de revisiones clínicas · Datos anonimizados</p>
      </div>

      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Buscar paciente</span>
        </div>
        <label style={s.label}>ID, nombre o fecha de nacimiento</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            type="text"
            placeholder="ej: 1, Mario o 24/09/1991"
            value={consulta}
            onChange={e => setConsulta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
          />
          <button style={s.btnPrimary} onClick={buscar} disabled={cargando}>
            <IconSearch size={15} />
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {buscado && (
          <div style={{ marginTop: 16 }}>
            {resultados.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--gray-600)', padding: '12px 0' }}>
                No se encontraron pacientes.
              </p>
            ) : (
              resultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSeleccionarPaciente(p.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 14px',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)', cursor: 'pointer', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--teal-mid)' }}>ID: {p.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 3 }}>
                      {p.displayName || 'Sin nombre guardado'}
                      {p.fechaNacimiento ? ` · ${formatFecha(p.fechaNacimiento)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    {p.sesiones.length} {p.sesiones.length === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>¿Paciente nuevo?</p>
        <button style={s.btnPrimary} onClick={onNuevoPaciente}>
          <IconPlus size={15} />
          Crear paciente
        </button>
      </div>

      <div style={{ ...s.card, marginTop: 24 }}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Operación clínica</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 14 }}>
          Revisa los formularios públicos pendientes y conviértelos en historial clínico interno.
        </p>
        <button style={s.btnPrimary} onClick={onAbrirPendientes}>
          Revisar envíos pendientes
        </button>
      </div>

      <div style={{ ...s.card, marginTop: 24 }}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Pacientes existentes</span>
        </div>

        {cargandoPacientes ? (
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>Cargando pacientes...</p>
        ) : pacientes.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>No hay pacientes guardados.</p>
        ) : (
          <>
            {pacientes.map((paciente) => (
              <button
                key={paciente.id}
                onClick={() => onSeleccionarPaciente(paciente.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg)', cursor: 'pointer', marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--teal-mid)' }}>
                    ID: {paciente.id}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 3 }}>
                    {paciente.displayName || 'Sin nombre guardado'}
                    {paciente.fechaNacimiento ? ` · ${formatFecha(paciente.fechaNacimiento)}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                  {paciente.sesiones.length} {paciente.sesiones.length === 1 ? 'sesión' : 'sesiones'}
                </span>
              </button>
            ))}
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 8 }}>
              Total de pacientes disponibles: {pacientes.length}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Vista: Crear paciente ─────────────────────────────────────────────────────
function VistaCrearPaciente({ onVolver, onCreado }) {
  const [id, setId] = useState('');
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const crear = async () => {
    setError('');
    if (!id.trim() || !fecha.trim()) { setError('Completa todos los campos.'); return; }
    const isoFecha = normalizeFechaNacimiento(fecha);
    if (!isoFecha) { setError('Formato de fecha inválido'); return; }
    setCargando(true);
    try {
      const res = await apiFetch('/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id.trim().toUpperCase(), fechaNacimiento: isoFecha }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al crear paciente'); return; }
      onCreado(data.id);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <button style={{ ...s.btnGhost, marginBottom: 24 }} onClick={onVolver}>
        <IconBack size={15} /> Volver
      </button>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 24, letterSpacing: '-0.02em' }}>Nuevo paciente</h2>

      <div style={s.card}>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Código / ID del paciente</label>
          <input
            style={{ ...s.input, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
            type="text"
            placeholder="ej: 4F92K"
            value={id}
            onChange={e => setId(e.target.value.toUpperCase())}
          />
          <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 5 }}>
            Usa un código que no revele la identidad del paciente.
          </p>
        </div>
        <div>
          <label style={s.label}>Fecha de nacimiento (DD/MM/AAAA)</label>
          <input
            style={s.input}
            type="text"
            placeholder="ej: 15/03/1985"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          />
        </div>
        {error && <p style={{ fontSize: 13, color: '#D85A30', marginTop: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={s.btnSecondary} onClick={onVolver}>Cancelar</button>
          <button style={s.btnPrimary} onClick={crear} disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear y abrir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista: Ficha de paciente ──────────────────────────────────────────────────
function VistaFicha({ pacienteId, onVolver }) {
  const [sesiones, setSesiones] = useState([]);
  const [sesionActiva, setSesionActiva] = useState(null); // fecha ISO o 'nueva'
  const [campos, setCampos] = useState(FICHA_DEFAULTS);
  const [camposOriginales, setCamposOriginales] = useState(FICHA_DEFAULTS);
  const [editable, setEditable] = useState(true);
  const [guardado, setGuardado] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [errorPDF, setErrorPDF] = useState('');
  const [infoPDF, setInfoPDF] = useState(null);
  const [ultimaSesionBase, setUltimaSesionBase] = useState(FICHA_DEFAULTS);

  // Cargar sesiones del paciente
  useEffect(() => {
    apiFetch(`/sesiones/${pacienteId}`)
      .then(r => r.json())
      .then(d => {
        setSesiones(d.sesiones || []);
        // Abrir sesión de hoy si existe, si no, nueva
        const hoy = fechaHoy();
        if ((d.sesiones || []).includes(hoy)) {
          cargarSesion(hoy);
        } else if ((d.sesiones || []).length > 0) {
          cargarSesionBase((d.sesiones || [])[0]);
          abrirNuevaSesionDesdeBase((d.sesiones || [])[0]);
        } else {
          setSesionActiva('nueva');
          setEditable(true);
        }
      })
      .catch(() => {
        setSesionActiva('nueva');
        setEditable(true);
      });
  }, [pacienteId]);

  const cargarSesionBase = (fecha) => {
    return apiFetch(`/sesiones/${pacienteId}/${fecha}`)
      .then(r => r.json())
      .then(d => {
        const hidratados = hydrateFichaCampos(d);
        setUltimaSesionBase(hidratados);
        return hidratados;
      })
      .catch(() => FICHA_DEFAULTS);
  };

  const cargarSesion = (fecha) => {
    apiFetch(`/sesiones/${pacienteId}/${fecha}`)
      .then(r => r.json())
      .then(d => {
        const hidratados = hydrateFichaCampos(d);
        setUltimaSesionBase(hidratados);
        setCampos(hidratados);
        setCamposOriginales(hidratados);
        setSesionActiva(fecha);
        setEditable(sesionEsEditablePorDefecto(fecha));
      });
  };

  const abrirNuevaSesionDesdeBase = async (fechaBase) => {
    const base = fechaBase ? await cargarSesionBase(fechaBase) : ultimaSesionBase;
    const nuevosCampos = {
      ...FICHA_DEFAULTS,
      ...pickPersonalFields(base),
    };

    setCampos(nuevosCampos);
    setCamposOriginales(nuevosCampos);
    setSesionActiva('nueva');
    setEditable(true);
    setErrorPDF('');
    setInfoPDF(null);
  };

  const nuevaSesion = () => {
    const fechaBase = sesiones[0] || null;
    abrirNuevaSesionDesdeBase(fechaBase);
  };

  // Autoguardado con debounce
  const guardarAhora = useCallback(async (data) => {
    await apiFetch(`/sesiones/${pacienteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        fecha: sesionActiva !== 'nueva' ? sesionActiva : fechaHoy(),
      }),
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    // Refrescar lista de sesiones
    const res = await apiFetch(`/sesiones/${pacienteId}`);
    const d = await res.json();
    setSesiones(d.sesiones || []);
    const fechaGuardada = sesionActiva !== 'nueva' ? sesionActiva : fechaHoy();
    setSesionActiva(fechaGuardada);
    setCamposOriginales(data);
    if (fechaGuardada !== fechaHoy()) {
      setEditable(false);
    }
  }, [pacienteId, sesionActiva]);

  const debouncedGuardar = useCallback(debounce(guardarAhora, 900), [guardarAhora]);

  const actualizarCampo = (campo, valor) => {
    if (!editable) return;
    const nuevoCampos = { ...campos, [campo]: valor };
    setCampos(nuevoCampos);

    if (sesionEsEditablePorDefecto(sesionActiva)) {
      debouncedGuardar(nuevoCampos);
    }
  };

  const guardarSesionActual = async () => {
    if (!editable) return;
    await guardarAhora(campos);
  };

  const cancelarEdicion = () => {
    setCampos(camposOriginales);
    setEditable(false);
    setGuardado(false);
  };

  const generarPDF = async () => {
    setGenerandoPDF(true);
    setErrorPDF('');
    if (infoPDF?.blobUrl) {
      URL.revokeObjectURL(infoPDF.blobUrl);
    }
    setInfoPDF(null);
    try {
      const res = await apiFetch(`/pdf/${pacienteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, fecha: sesionActiva !== 'nueva' ? sesionActiva : fechaHoy() }),
      });

      if (!res.ok) {
        throw new Error('No se pudo generar el PDF');
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error('El PDF llegó vacío');
      }

      const savedPath = res.headers.get('X-Pdf-Saved-Path') || '';
      const savedDir = res.headers.get('X-Pdf-Saved-Dir') || '';

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${pacienteId}_${sesionActiva !== 'nueva' ? sesionActiva : fechaHoy()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
        }, 150);
      }

      if (savedPath || savedDir) {
        setInfoPDF({ savedPath, savedDir, blobUrl });
      }
    } catch (e) {
      console.error(e);
      setErrorPDF('No se pudo generar o descargar el PDF.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={s.btnGhost} onClick={onVolver}><IconBack size={15} /></button>
          <span style={s.idChip}>{pacienteId}</span>
          <span style={{ ...s.savePill, opacity: guardado ? 1 : 0 }}>
            <IconCheck size={13} /> guardado
          </span>
          {!editable && sesionActiva !== 'nueva' && (
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>solo lectura</span>
          )}
          {editable && sesionActiva === 'nueva' && (
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>guardado automático</span>
          )}
          {editable && sesionActiva !== 'nueva' && (
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>cambios locales hasta guardar</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!editable && sesionActiva !== 'nueva' && (
            <button style={s.btnSecondary} onClick={() => setEditable(true)}>
              Editar
            </button>
          )}
          {editable && sesionActiva !== 'nueva' && (
            <>
              <button style={s.btnSecondary} onClick={cancelarEdicion}>
                Cancelar
              </button>
              <button style={s.btnPrimary} onClick={guardarSesionActual}>
                Guardar
              </button>
            </>
          )}
          <button style={s.btnPrimary} onClick={generarPDF} disabled={generandoPDF}>
            <IconPDF size={15} />
            {generandoPDF ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
      </div>

      {/* Historial + nueva sesión */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Sesiones</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={s.label}>Abrir sesión guardada</label>
            <select
              style={s.select}
              value={sesionActiva === 'nueva' ? '' : (sesionActiva || '')}
              onChange={(e) => {
                if (e.target.value) {
                  cargarSesion(e.target.value);
                }
              }}
            >
              <option value="">Selecciona una sesión</option>
              {sesiones.map((fecha) => (
                <option key={fecha} value={fecha}>
                  {formatFecha(fecha)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={nuevaSesion}
            style={{
              ...s.btnPrimary,
              whiteSpace: 'nowrap',
            }}
          >
            <IconPlus size={13} /> Nueva sesión
          </button>
        </div>
      </div>

      <SeccionDesplegable
        title="Registro de fisioterapia"
        subtitle={sesionActiva === 'nueva' ? formatFecha(fechaHoy()) : sesionActiva ? formatFecha(sesionActiva) : ''}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha
            label="Apellidos"
            value={campos.apellidos}
            onChange={(v) => actualizarCampo('apellidos', v)}
            placeholder="Apellidos del paciente"
            readOnly={!editable}
          />
          <CampoFicha
            label="Nombre"
            value={campos.nombre}
            onChange={(v) => actualizarCampo('nombre', v)}
            placeholder="Nombre del paciente"
            readOnly={!editable}
          />
          <CampoFicha
            label="Edad"
            value={campos.edad}
            onChange={(v) => actualizarCampo('edad', v)}
            placeholder="Edad"
            readOnly={!editable}
          />
          <CampoFicha
            label="Sexo"
            value={campos.sexo}
            onChange={(v) => actualizarCampo('sexo', v)}
            placeholder="Sexo"
            readOnly={!editable}
          />
          <CampoFicha
            label="Profesión"
            value={campos.profesion}
            onChange={(v) => actualizarCampo('profesion', v)}
            placeholder="Profesión"
            readOnly={!editable}
          />
          <CampoFicha
            label="Altura / Peso"
            value={campos.alturaPeso}
            onChange={(v) => actualizarCampo('alturaPeso', v)}
            placeholder="Altura y peso"
            readOnly={!editable}
          />
          <CampoFicha
            label="Diagnóstico médico"
            value={campos.diagnosticoMedico}
            onChange={(v) => actualizarCampo('diagnosticoMedico', v)}
            placeholder="Diagnóstico médico"
            readOnly={!editable}
          />
          <CampoFicha
            label="Fecha inicial de anomalía"
            value={campos.fechaInicialAnomalia}
            onChange={(v) => actualizarCampo('fechaInicialAnomalia', v)}
            placeholder="Fecha inicial"
            readOnly={!editable}
          />
          <CampoFicha
            label="Tratamientos afines"
            value={campos.tratamientosAfines}
            onChange={(v) => actualizarCampo('tratamientosAfines', v)}
            placeholder="Tratamientos afines"
            readOnly={!editable}
          />
          <CampoFicha
            label="Medicación anterior / actual"
            value={campos.medicacion}
            onChange={(v) => actualizarCampo('medicacion', v)}
            placeholder="Medicación"
            readOnly={!editable}
          />
          <CampoFicha
            label="Prueba de imagen"
            value={campos.pruebaImagen}
            onChange={(v) => actualizarCampo('pruebaImagen', v)}
            placeholder="Prueba de imagen"
            readOnly={!editable}
          />
        </div>
      </SeccionDesplegable>

      <SeccionDesplegable title="Historia clínica y exploración" subtitle="Bloque desplegable">
        <CampoFicha
          label="Historia clínica"
          value={campos.historiaClinica}
          onChange={(v) => actualizarCampo('historiaClinica', v)}
          placeholder="Historia clínica"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Anamnesis"
          value={campos.anamnesis}
          onChange={(v) => actualizarCampo('anamnesis', v)}
          placeholder="Anamnesis"
          multiline
          readOnly={!editable}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha
            label="Antecedentes AL o AV"
            value={campos.antecedentesALAV}
            onChange={(v) => actualizarCampo('antecedentesALAV', v)}
            placeholder="Antecedentes AL o AV"
            readOnly={!editable}
          />
          <CampoFicha
            label="Antecedentes AQ"
            value={campos.antecedentesAQ}
            onChange={(v) => actualizarCampo('antecedentesAQ', v)}
            placeholder="Antecedentes AQ"
            readOnly={!editable}
          />
        </div>
        <CampoFicha
          label="Inspección / observación"
          value={campos.inspeccionObservacion}
          onChange={(v) => actualizarCampo('inspeccionObservacion', v)}
          placeholder="Inspección y observación"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Palpación diagnóstica"
          value={campos.palpacionDiagnostica}
          onChange={(v) => actualizarCampo('palpacionDiagnostica', v)}
          placeholder="Palpación diagnóstica"
          multiline
          readOnly={!editable}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha
            label="Sensibilidad en"
            value={campos.sensibilidad}
            onChange={(v) => actualizarCampo('sensibilidad', v)}
            placeholder="Sensibilidad"
            readOnly={!editable}
          />
          <CampoFicha
            label="PGS"
            value={campos.pgs}
            onChange={(v) => actualizarCampo('pgs', v)}
            placeholder="PGS"
            readOnly={!editable}
          />
        </div>
        <CampoFicha
          label="Balance muscular"
          value={campos.balanceMuscular}
          onChange={(v) => actualizarCampo('balanceMuscular', v)}
          placeholder="MMSS / MMII / Tronco"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Balance articular / movilidad + disfunciones"
          value={campos.balanceArticular}
          onChange={(v) => actualizarCampo('balanceArticular', v)}
          placeholder="Balance articular y disfunciones"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Datos de interés"
          value={campos.datosInteres}
          onChange={(v) => actualizarCampo('datosInteres', v)}
          placeholder="Datos de interés"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Valoración funcional"
          value={campos.valoracionFuncional}
          onChange={(v) => actualizarCampo('valoracionFuncional', v)}
          placeholder="Valoración funcional"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Pruebas específicas"
          value={campos.pruebasEspecificas}
          onChange={(v) => actualizarCampo('pruebasEspecificas', v)}
          placeholder="Pruebas específicas"
          multiline
          readOnly={!editable}
        />
      </SeccionDesplegable>

      <SeccionDesplegable title="Problemas y tratamiento" subtitle="Bloque desplegable">
        <CampoFicha
          label="Identificación de los problemas fisioterapéuticos"
          value={campos.problemasFisioterapeuticos}
          onChange={(v) => actualizarCampo('problemasFisioterapeuticos', v)}
          placeholder="Problemas fisioterapéuticos"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Programa de fisioterapia"
          value={campos.programaFisioterapia}
          onChange={(v) => actualizarCampo('programaFisioterapia', v)}
          placeholder="Programa de fisioterapia"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Plan de tratamiento"
          value={campos.planTratamiento}
          onChange={(v) => actualizarCampo('planTratamiento', v)}
          placeholder="Plan de tratamiento"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Recomendaciones a la familia"
          value={campos.recomendacionesFamilia}
          onChange={(v) => actualizarCampo('recomendacionesFamilia', v)}
          placeholder="Recomendaciones a la familia"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Objetivos fisioterapéuticos"
          value={campos.objetivosFisioterapeuticos}
          onChange={(v) => actualizarCampo('objetivosFisioterapeuticos', v)}
          placeholder="Objetivos fisioterapéuticos"
          multiline
          readOnly={!editable}
        />
        <CampoFicha
          label="Evolución, exploración y tratamiento"
          value={campos.evolucionExploracionTratamiento}
          onChange={(v) => actualizarCampo('evolucionExploracionTratamiento', v)}
          placeholder="Evolución, exploración y tratamiento"
          multiline
          readOnly={!editable}
        />
        {errorPDF && <p style={{ fontSize: 13, color: '#D85A30', marginTop: 4 }}>{errorPDF}</p>}
        {infoPDF && (
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8, lineHeight: 1.5 }}>
            <p>PDF guardado en servidor: <span style={{ fontFamily: 'var(--font-mono)' }}>{infoPDF.savedPath}</span></p>
            {infoPDF.blobUrl && (
              <p>
                PDF:
                {' '}
                <a
                  href={infoPDF.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--teal-mid)' }}
                >
                  abrir PDF
                </a>
              </p>
            )}
            {infoPDF.savedDir && (
              <p>
                Carpeta:
                {' '}
                <a
                  href={`file://${infoPDF.savedDir}`}
                  style={{ color: 'var(--teal-mid)' }}
                >
                  abrir carpeta
                </a>
              </p>
            )}
          </div>
        )}
      </SeccionDesplegable>

      <style>{`
        textarea:focus, input:focus { border-color: var(--teal-light) !important; box-shadow: 0 0 0 3px var(--teal-pale); }
      `}</style>
    </div>
  );
}

// ── App principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [autenticado, setAutenticado] = useState(() => Boolean(getStoredToken()));
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [vista, setVista] = useState('buscar'); // 'buscar' | 'crear' | 'ficha' | 'submissions'
  const [pacienteActivo, setPacienteActivo] = useState(null);

  const abrirFicha = (id) => { setPacienteActivo(id); setVista('ficha'); };
  const cerrarSesion = () => {
    clearStoredAuth();
    setAutenticado(false);
    setCurrentUser(null);
    setPacienteActivo(null);
    setVista('buscar');
  };

  if (!autenticado) {
    return <VistaLogin onLoginCorrecto={(user) => {
      setCurrentUser(user);
      setAutenticado(true);
    }} />;
  }

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <div style={s.logo}>
          <div style={s.logoDot} />
          <span style={s.logoText}>FisioApp</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)' }}>
            {currentUser?.displayName || 'acceso protegido'}
          </span>
          <button style={s.btnSecondary} onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={s.main}>
        {vista === 'buscar' && (
          <VistaBuscador
            onSeleccionarPaciente={abrirFicha}
            onNuevoPaciente={() => setVista('crear')}
            onAbrirPendientes={() => setVista('submissions')}
          />
        )}
        {vista === 'crear' && (
          <VistaCrearPaciente
            onVolver={() => setVista('buscar')}
            onCreado={abrirFicha}
          />
        )}
        {vista === 'ficha' && (
          <VistaFicha
            pacienteId={pacienteActivo}
            onVolver={() => setVista('buscar')}
          />
        )}
        {vista === 'submissions' && (
          <VistaSubmissions
            currentUser={currentUser}
            onVolver={() => setVista('buscar')}
          />
        )}
      </main>
    </div>
  );
}
