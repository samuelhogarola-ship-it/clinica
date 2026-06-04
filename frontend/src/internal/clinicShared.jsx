import { useState } from 'react';

function getTokenStorageKey(scope = 'internal') {
  return `clinica-${scope}-token`;
}

function getUserStorageKey(scope = 'internal') {
  return `clinica-${scope}-user`;
}

export function getStoredToken(scope = 'internal') {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(getTokenStorageKey(scope)) || '';
}

export function getStoredUser(scope = 'internal') {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getUserStorageKey(scope));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAuth(token, currentUser, scope = 'internal') {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTokenStorageKey(scope), token);
  window.localStorage.setItem(getUserStorageKey(scope), JSON.stringify(currentUser));
}

export function clearStoredAuth(scope = 'internal') {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getTokenStorageKey(scope));
  window.localStorage.removeItem(getUserStorageKey(scope));
}

export async function apiFetch(path, options = {}, apiBase = '/api', scope = 'internal') {
  const token = getStoredToken(scope);
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredAuth(scope);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return response;
}

export async function getRuntimeConfig() {
  const res = await fetch('/api/runtime-config');

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || 'No se pudo comprobar el modo de la app.');
  }

  return {
    demoMode: Boolean(data?.demoMode),
  };
}

export const fechaHoy = () => new Date().toISOString().split('T')[0];

export const formatFecha = (iso) => iso.split('-').reverse().join('/');

export const formatFechaHora = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export const esFechaValida = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const normalizeFechaNacimiento = (value) => {
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

export const pickPersonalFields = (data = {}) => PERSONAL_FIELDS.reduce((acc, field) => {
  acc[field] = data[field] || '';
  return acc;
}, {});

export const getSubmissionDisplayName = (submission) => {
  const name = submission?.profile?.name || submission?.data?.nombre || '';
  const surnames = submission?.profile?.surnames || submission?.data?.apellidos || '';
  return [name, surnames].filter(Boolean).join(' ') || 'Paciente sin nombre';
};

export const IconPDF = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);

export const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export const IconBack = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

export const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  topbar: {
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--teal-base)' },
  logoText: { fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em' },
  main: { flex: 1, padding: '32px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' },
  mainNarrow: { flex: 1, padding: '32px 24px', maxWidth: 680, margin: '0 auto', width: '100%' },
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

export const FICHA_DEFAULTS = {
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

export function hydrateFichaCampos(data = {}) {
  const merged = { ...FICHA_DEFAULTS, ...data };

  if (!merged.anamnesis && data.sintomas) merged.anamnesis = data.sintomas;
  if (!merged.diagnosticoMedico && data.diagnostico) merged.diagnosticoMedico = data.diagnostico;
  if (!merged.planTratamiento && data.tratamiento) merged.planTratamiento = data.tratamiento;

  return merged;
}

export function sesionEsEditablePorDefecto(fecha) {
  return fecha === 'nueva' || fecha === fechaHoy();
}

export function VistaLogin({ onLoginCorrecto, title, text, authScope = 'internal' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const acceder = async () => {
    if (!username || !password) return;
    setError('');
    setCargando(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success && data.token && data.currentUser) {
        storeAuth(data.token, data.currentUser, authScope);
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
        <h1 style={s.authTitle}>{title}</h1>
        <p style={s.authText}>{text}</p>

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

export function CampoFicha({ label, value, onChange, placeholder, multiline = false, readOnly = false }) {
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

export function SeccionDesplegable({ title, subtitle, children, defaultOpen = true }) {
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
