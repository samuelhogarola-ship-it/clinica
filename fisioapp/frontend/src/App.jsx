import { useState, useEffect, useRef, useCallback } from 'react';

const API = '/api';

// ── Utilidades ────────────────────────────────────────────────────────────────
const fechaHoy = () => new Date().toISOString().split('T')[0];
const formatFecha = (iso) => iso.split('-').reverse().join('/');
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ── Iconos SVG inline ─────────────────────────────────────────────────────────
const IconMic = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
);
const IconStop = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);
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
};

// ── Componente: Campo con grabación ───────────────────────────────────────────
function CampoGrabable({ label, value, onChange, placeholder }) {
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const iniciarGrabacion = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        try {
          const res = await fetch(`${API}/transcribir`, { method: 'POST', body: fd });
          const data = await res.json();
          if (data.texto) {
            // Acumular: añadir texto con espacio si ya hay contenido
            onChange(prev => {
              const base = prev.trim();
              return base ? `${base} ${data.texto.trim()}` : data.texto.trim();
            });
          } else {
            setError(data.error || 'Error al transcribir');
          }
        } catch {
          setError('No se pudo conectar con el servidor');
        }
      };
      mr.start();
      mediaRef.current = mr;
      setGrabando(true);
    } catch {
      setError('No se pudo acceder al micrófono');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    setGrabando(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={s.label}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {grabando && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#D85A30' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D85A30', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              grabando...
            </span>
          )}
          <button
            onClick={grabando ? detenerGrabacion : iniciarGrabacion}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              fontSize: 12, border: '1px solid', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', transition: 'all 0.15s',
              background: grabando ? 'var(--teal-pale)' : 'transparent',
              color: grabando ? 'var(--teal-mid)' : 'var(--gray-600)',
              borderColor: grabando ? 'var(--teal-light)' : 'var(--border)',
            }}
          >
            {grabando ? <IconStop size={13} /> : <IconMic size={13} />}
            {grabando ? 'Detener' : 'Grabar'}
          </button>
        </div>
      </div>
      <textarea
        style={s.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && <p style={{ fontSize: 12, color: '#D85A30', marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Vista: Inicio / Buscador ──────────────────────────────────────────────────
function VistaBuscador({ onSeleccionarPaciente, onNuevoPaciente }) {
  const [fecha, setFecha] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscado, setBuscado] = useState(false);
  const [cargando, setCargando] = useState(false);

  const buscar = async () => {
    if (!fecha) return;
    setCargando(true);
    setBuscado(false);
    // Convertir DD/MM/AAAA → YYYY-MM-DD para el backend
    const partes = fecha.split('/');
    const isoFecha = partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : fecha;
    try {
      const res = await fetch(`${API}/pacientes/buscar?fechaNacimiento=${encodeURIComponent(isoFecha)}`);
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
        <label style={s.label}>Fecha de nacimiento (DD/MM/AAAA)</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            type="text"
            placeholder="ej: 15/03/1985"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
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
                No se encontraron pacientes con esa fecha de nacimiento.
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--teal-mid)' }}>{p.id}</span>
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
    // Convertir DD/MM/AAAA → YYYY-MM-DD
    const partes = fecha.split('/');
    if (partes.length !== 3) { setError('Formato de fecha inválido (DD/MM/AAAA)'); return; }
    const isoFecha = `${partes[2]}-${partes[1]}-${partes[0]}`;
    setCargando(true);
    try {
      const res = await fetch(`${API}/pacientes`, {
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
  const [campos, setCampos] = useState({ sintomas: '', diagnostico: '', tratamiento: '' });
  const [guardado, setGuardado] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const autoguardadoRef = useRef(null);

  // Cargar sesiones del paciente
  useEffect(() => {
    fetch(`${API}/sesiones/${pacienteId}`)
      .then(r => r.json())
      .then(d => {
        setSesiones(d.sesiones || []);
        // Abrir sesión de hoy si existe, si no, nueva
        const hoy = fechaHoy();
        if ((d.sesiones || []).includes(hoy)) {
          cargarSesion(hoy);
        } else {
          setSesionActiva('nueva');
        }
      })
      .catch(() => setSesionActiva('nueva'));
  }, [pacienteId]);

  const cargarSesion = (fecha) => {
    fetch(`${API}/sesiones/${pacienteId}/${fecha}`)
      .then(r => r.json())
      .then(d => {
        setCampos({ sintomas: d.sintomas || '', diagnostico: d.diagnostico || '', tratamiento: d.tratamiento || '' });
        setSesionActiva(fecha);
      });
  };

  const nuevaSesion = () => {
    setCampos({ sintomas: '', diagnostico: '', tratamiento: '' });
    setSesionActiva('nueva');
  };

  // Autoguardado con debounce
  const guardarAhora = useCallback(async (data) => {
    await fetch(`${API}/sesiones/${pacienteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    // Refrescar lista de sesiones
    const res = await fetch(`${API}/sesiones/${pacienteId}`);
    const d = await res.json();
    setSesiones(d.sesiones || []);
    setSesionActiva(fechaHoy());
  }, [pacienteId]);

  const debouncedGuardar = useCallback(debounce(guardarAhora, 900), [guardarAhora]);

  const actualizarCampo = (campo, valor) => {
    // Si valor es función (de la grabación acumulativa)
    const nuevoValor = typeof valor === 'function' ? valor(campos[campo]) : valor;
    const nuevoCampos = { ...campos, [campo]: nuevoValor };
    setCampos(nuevoCampos);
    debouncedGuardar(nuevoCampos);
  };

  const generarPDF = async () => {
    setGenerandoPDF(true);
    try {
      const res = await fetch(`${API}/pdf/${pacienteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, fecha: sesionActiva !== 'nueva' ? sesionActiva : fechaHoy() }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pacienteId}_${sesionActiva !== 'nueva' ? sesionActiva : fechaHoy()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
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
        </div>
        <button style={s.btnPrimary} onClick={generarPDF} disabled={generandoPDF}>
          <IconPDF size={15} />
          {generandoPDF ? 'Generando...' : 'Generar PDF'}
        </button>
      </div>

      {/* Historial + nueva sesión */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={nuevaSesion}
          style={{
            padding: '5px 12px', fontSize: 13, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: '1px dashed var(--teal-light)', background: sesionActiva === 'nueva' ? 'var(--teal-pale)' : 'transparent',
            color: 'var(--teal-mid)', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <IconPlus size={13} /> Nueva sesión
        </button>
        {sesiones.map(f => (
          <button
            key={f}
            onClick={() => cargarSesion(f)}
            style={{
              padding: '5px 12px', fontSize: 13, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: '1px solid', fontFamily: 'var(--font-mono)',
              borderColor: sesionActiva === f ? 'var(--teal-base)' : 'var(--border)',
              background: sesionActiva === f ? 'var(--teal-pale)' : 'var(--surface)',
              color: sesionActiva === f ? 'var(--teal-mid)' : 'var(--gray-600)',
            }}
          >
            {formatFecha(f)}
          </button>
        ))}
      </div>

      {/* Plantilla: Revisión general */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Revisión general</span>
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
            {sesionActiva === 'nueva' ? formatFecha(fechaHoy()) : sesionActiva ? formatFecha(sesionActiva) : ''}
          </span>
        </div>

        <CampoGrabable
          label="Síntomas actuales"
          value={campos.sintomas}
          onChange={(v) => actualizarCampo('sintomas', v)}
          placeholder="Habla o escribe los síntomas del paciente..."
        />
        <CampoGrabable
          label="Diagnóstico"
          value={campos.diagnostico}
          onChange={(v) => actualizarCampo('diagnostico', v)}
          placeholder="Habla o escribe el diagnóstico..."
        />
        <CampoGrabable
          label="Tratamiento"
          value={campos.tratamiento}
          onChange={(v) => actualizarCampo('tratamiento', v)}
          placeholder="Habla o escribe el plan de tratamiento..."
        />
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        textarea:focus, input:focus { border-color: var(--teal-light) !important; box-shadow: 0 0 0 3px var(--teal-pale); }
      `}</style>
    </div>
  );
}

// ── App principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [vista, setVista] = useState('buscar'); // 'buscar' | 'crear' | 'ficha'
  const [pacienteActivo, setPacienteActivo] = useState(null);

  const abrirFicha = (id) => { setPacienteActivo(id); setVista('ficha'); };

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <div style={s.logo}>
          <div style={s.logoDot} />
          <span style={s.logoText}>FisioApp</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)' }}>
          local · red privada
        </span>
      </header>

      <main style={s.main}>
        {vista === 'buscar' && (
          <VistaBuscador
            onSeleccionarPaciente={abrirFicha}
            onNuevoPaciente={() => setVista('crear')}
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
      </main>
    </div>
  );
}
