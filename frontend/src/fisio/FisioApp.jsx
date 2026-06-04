import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CampoFicha,
  FICHA_DEFAULTS,
  IconBack,
  IconCheck,
  IconPDF,
  IconPlus,
  IconSearch,
  SeccionDesplegable,
  apiFetch,
  clearStoredAuth,
  debounce,
  fechaHoy,
  formatFecha,
  getRuntimeConfig,
  getStoredToken,
  getStoredUser,
  hydrateFichaCampos,
  normalizeFechaNacimiento,
  pickPersonalFields,
  s,
  sesionEsEditablePorDefecto,
  storeAuth,
  VistaLogin,
} from '../internal/clinicShared.jsx';

const FISIO_API = '/api/fisio';
const FISIO_AUTH_SCOPE = 'fisio';

const DEMO_PATIENTS = [
  { id: 'CLI-1001', displayName: 'Pepito', fechaNacimiento: '1990-04-12', sesiones: ['2026-06-02', '2026-05-21', '2026-05-10'] },
  { id: 'CLI-1002', displayName: 'Fulanita', fechaNacimiento: '1988-09-03', sesiones: ['2026-05-30', '2026-05-16', '2026-05-02'] },
  { id: 'CLI-1003', displayName: 'Menganito', fechaNacimiento: '1995-01-24', sesiones: ['2026-06-01', '2026-05-20', '2026-05-08'] },
];

function VistaBuscador({ onSeleccionarPaciente, onNuevoPaciente, onSesionRapida, isDemo }) {
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
        const res = await apiFetch('/pacientes', {}, FISIO_API, FISIO_AUTH_SCOPE);
        const data = await res.json();
        if (!cancelled) {
          const real = Array.isArray(data) ? data : [];
          const ids = new Set(real.map((p) => p.id));
          const padded = [...real, ...DEMO_PATIENTS.filter((p) => !ids.has(p.id))];
          setPacientes(padded);
        }
      } catch {
        if (!cancelled) {
          setPacientes(DEMO_PATIENTS);
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
      const res = await apiFetch(`/pacientes/buscar?q=${encodeURIComponent(query)}`, {}, FISIO_API, FISIO_AUTH_SCOPE);
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
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 6 }}>App Fisio</h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>
          Trabajo clínico diario sobre pacientes, sesiones y PDFs.
        </p>
      </div>

      {isDemo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', marginBottom: 20, background: '#fff8ec', border: '1px solid #f0d080', borderRadius: 10 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontSize: 13, color: '#7a5a00' }}>
            Solo accesible para autorizados con inicio de sesión propio. Estás en modo demo.
          </span>
        </div>
      )}

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
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
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
              resultados.map((paciente) => (
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
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--teal-mid)' }}>ID: {paciente.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 3 }}>
                      {paciente.displayName || 'Sin nombre guardado'}
                      {paciente.fechaNacimiento ? ` · ${formatFecha(paciente.fechaNacimiento)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    {paciente.sesiones.length} {paciente.sesiones.length === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {!isDemo && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>¿Paciente nuevo?</p>
          <button style={s.btnPrimary} onClick={onNuevoPaciente}>
            <IconPlus size={15} />
            Crear paciente
          </button>
        </div>
      )}

      <div style={{ ...s.card, marginTop: 16, border: '1px dashed var(--border)', background: 'transparent' }}>
        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>
          ⚠️ <strong>No recomendado</strong> — para pacientes que acuden sin haber completado el registro previo.
          Se recomienda que el paciente complete el formulario de registro antes de la sesión.
        </div>
        <button
          style={{ ...s.btnSecondary, width: '100%', justifyContent: 'center' }}
          onClick={onSesionRapida}
        >
          Continuar con nuevo paciente sin registro
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

function VistaSesionRapida({ onVolver, isDemo }) {
  const [campos, setCampos] = useState(FICHA_DEFAULTS);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [infoPDF, setInfoPDF] = useState(null);
  const [errorPDF, setErrorPDF] = useState('');
  const [demoMsg, setDemoMsg] = useState('');

  const tempId = useMemo(() => `WALK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, []);

  const actualizarCampo = (campo, valor) => {
    if (isDemo) return;
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  };

  const generarPDF = async () => {
    if (isDemo) {
      setDemoMsg('Aquí se genera la ficha con tu formato elegido');
      return;
    }
    setGenerandoPDF(true);
    setErrorPDF('');
    setInfoPDF(null);
    try {
      const res = await apiFetch('/pdf/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, fecha: new Date().toISOString().slice(0, 10) }),
      }, FISIO_API, FISIO_AUTH_SCOPE);
      if (!res.ok) throw new Error('No se pudo generar el PDF');
      const blob = await res.blob();
      if (!blob.size) throw new Error('El PDF llegó vacío');
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${tempId}_sesion_rapida.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setInfoPDF({ downloaded: true });
    } catch {
      setErrorPDF('No se pudo generar el PDF.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button style={s.btnGhost} onClick={onVolver}><IconBack size={15} /></button>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Sesión sin registro</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', marginBottom: 20, background: '#fff8ec', border: '1px solid #f0d080', borderRadius: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: 13, color: '#7a5a00', lineHeight: 1.5 }}>
          <strong>No recomendado.</strong> Usa esta opción solo si el paciente acude sin haberse registrado previamente.
          Se recomienda pedirle que complete el formulario de registro antes o después de la sesión.
          Esta ficha no quedará vinculada a ningún expediente.
        </div>
      </div>

      {demoMsg && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', marginBottom: 16, background: '#f0f6ff', border: '1px solid #c8dcf8', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#2f5a9e' }}>💡 {demoMsg}</span>
          <button style={{ ...s.btnGhost, fontSize: 12 }} onClick={() => setDemoMsg('')}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button style={s.btnPrimary} onClick={generarPDF} disabled={generandoPDF}>
          <IconPDF size={15} />
          {generandoPDF ? 'Generando...' : 'Generar PDF'}
        </button>
      </div>

      {errorPDF && <p style={{ fontSize: 13, color: '#D85A30', marginBottom: 12 }}>{errorPDF}</p>}

      <div style={s.card}>
        <div style={s.cardHeader}><span style={s.cardTitle}>Registro de fisioterapia</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha label="Apellidos" value={campos.apellidos} onChange={(v) => actualizarCampo('apellidos', v)} placeholder="Apellidos del paciente" readOnly={isDemo} />
          <CampoFicha label="Nombre" value={campos.nombre} onChange={(v) => actualizarCampo('nombre', v)} placeholder="Nombre del paciente" readOnly={isDemo} />
          <CampoFicha label="Edad" value={campos.edad} onChange={(v) => actualizarCampo('edad', v)} placeholder="Edad" readOnly={isDemo} />
          <CampoFicha label="Sexo" value={campos.sexo} onChange={(v) => actualizarCampo('sexo', v)} placeholder="Sexo" readOnly={isDemo} />
          <CampoFicha label="Diagnóstico médico" value={campos.diagnosticoMedico} onChange={(v) => actualizarCampo('diagnosticoMedico', v)} placeholder="Diagnóstico médico" readOnly={isDemo} />
          <CampoFicha label="Profesión" value={campos.profesion} onChange={(v) => actualizarCampo('profesion', v)} placeholder="Profesión" readOnly={isDemo} />
        </div>
      </div>

      <SeccionDesplegable title="Historia clínica y exploración" subtitle="Bloque desplegable">
        <CampoFicha label="Historia clínica" value={campos.historiaClinica} onChange={(v) => actualizarCampo('historiaClinica', v)} placeholder="Historia clínica" multiline readOnly={isDemo} />
        <CampoFicha label="Anamnesis" value={campos.anamnesis} onChange={(v) => actualizarCampo('anamnesis', v)} placeholder="Anamnesis" multiline readOnly={isDemo} />
      </SeccionDesplegable>

      <SeccionDesplegable title="Problemas y tratamiento" subtitle="Bloque desplegable">
        <CampoFicha label="Diagnóstico fisioterápico" value={campos.problemasFisioterapeuticos} onChange={(v) => actualizarCampo('problemasFisioterapeuticos', v)} placeholder="Problemas" multiline readOnly={isDemo} />
        <CampoFicha label="Plan de tratamiento" value={campos.planTratamiento} onChange={(v) => actualizarCampo('planTratamiento', v)} placeholder="Plan de tratamiento" multiline readOnly={isDemo} />
        <CampoFicha label="Evolución y exploración" value={campos.evolucionExploracionTratamiento} onChange={(v) => actualizarCampo('evolucionExploracionTratamiento', v)} placeholder="Evolución" multiline readOnly={isDemo} />
      </SeccionDesplegable>
    </div>
  );
}

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
      }, FISIO_API, FISIO_AUTH_SCOPE);
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
            onChange={(e) => setId(e.target.value.toUpperCase())}
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
            onChange={(e) => setFecha(e.target.value)}
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

function VistaFicha({ pacienteId, onVolver, isDemo }) {
  const [sesiones, setSesiones] = useState([]);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [campos, setCampos] = useState(FICHA_DEFAULTS);
  const [camposOriginales, setCamposOriginales] = useState(FICHA_DEFAULTS);
  const [editable, setEditable] = useState(true);
  const [guardado, setGuardado] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [errorPDF, setErrorPDF] = useState('');
  const [infoPDF, setInfoPDF] = useState(null);
  const [ultimaSesionBase, setUltimaSesionBase] = useState(FICHA_DEFAULTS);
  const [demoMsg, setDemoMsg] = useState('');

  useEffect(() => {
    apiFetch(`/sesiones/${pacienteId}`, {}, FISIO_API, FISIO_AUTH_SCOPE)
      .then((r) => r.json())
      .then((d) => {
        setSesiones(d.sesiones || []);
        const hoy = fechaHoy();
        if ((d.sesiones || []).includes(hoy)) {
          cargarSesion(hoy);
        } else if ((d.sesiones || []).length > 0) {
          // For demo patients load the most recent session directly instead of opening a blank new one
          if (d.isDemo) {
            cargarSesion((d.sesiones || [])[0]);
          } else {
            cargarSesionBase((d.sesiones || [])[0]);
            abrirNuevaSesionDesdeBase((d.sesiones || [])[0]);
          }
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
    return apiFetch(`/sesiones/${pacienteId}/${fecha}`, {}, FISIO_API, FISIO_AUTH_SCOPE)
      .then((r) => r.json())
      .then((d) => {
        const hidratados = hydrateFichaCampos(d);
        setUltimaSesionBase(hidratados);
        return hidratados;
      })
      .catch(() => FICHA_DEFAULTS);
  };

  const cargarSesion = (fecha) => {
    apiFetch(`/sesiones/${pacienteId}/${fecha}`, {}, FISIO_API, FISIO_AUTH_SCOPE)
      .then((r) => r.json())
      .then((d) => {
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

  const guardarAhora = useCallback(async (data) => {
    await apiFetch(`/sesiones/${pacienteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        fecha: sesionActiva !== 'nueva' ? sesionActiva : fechaHoy(),
      }),
    }, FISIO_API, FISIO_AUTH_SCOPE);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    const res = await apiFetch(`/sesiones/${pacienteId}`, {}, FISIO_API, FISIO_AUTH_SCOPE);
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
    if (!editable || isDemo) return;
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
      }, FISIO_API, FISIO_AUTH_SCOPE);

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
    } catch (error) {
      console.error(error);
      setErrorPDF('No se pudo generar o descargar el PDF.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div>
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
            <button style={{ ...s.btnSecondary, ...(isDemo ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }} onClick={isDemo ? undefined : () => setEditable(true)} disabled={isDemo}>
              Editar
            </button>
          )}
          {editable && sesionActiva !== 'nueva' && !isDemo && (
            <>
              <button style={s.btnSecondary} onClick={cancelarEdicion}>Cancelar</button>
              <button style={s.btnPrimary} onClick={guardarSesionActual}>Guardar</button>
            </>
          )}
          <button
            style={s.btnPrimary}
            onClick={isDemo ? () => setDemoMsg('Aquí se genera la ficha con tu formato elegido') : generarPDF}
            disabled={generandoPDF}
          >
            <IconPDF size={15} />
            {generandoPDF ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
      </div>

      {demoMsg && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', marginBottom: 16, background: '#f0f6ff', border: '1px solid #c8dcf8', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#2f5a9e' }}>💡 {demoMsg}</span>
          <button style={{ ...s.btnGhost, fontSize: 12, color: '#7a99cc' }} onClick={() => setDemoMsg('')}>✕</button>
        </div>
      )}

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <span style={s.cardTitle}>Sesiones</span>
          <button
            onClick={isDemo ? () => setDemoMsg('Para crear nuevas sesiones necesitas iniciar sesión con tu cuenta') : nuevaSesion}
            style={{ ...s.btnPrimary, padding: '6px 14px', fontSize: 13 }}
          >
            <IconPlus size={12} /> Nueva sesión
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sesiones.map((fecha) => {
            const activa = sesionActiva === fecha;
            return (
              <button
                key={fecha}
                onClick={() => cargarSesion(fecha)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: `1px solid ${activa ? 'var(--teal-light)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', background: activa ? 'var(--teal-pale)' : 'var(--bg)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: activa ? 'var(--teal-mid)' : 'var(--gray-900)', fontWeight: activa ? 600 : 400 }}>
                  {formatFecha(fecha)}
                </span>
                {activa && <span style={{ fontSize: 11, color: 'var(--teal-mid)', fontWeight: 500 }}>activa</span>}
              </button>
            );
          })}
          {sesiones.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>No hay sesiones guardadas.</p>
          )}
        </div>
      </div>

      <SeccionDesplegable
        title="Registro de fisioterapia"
        subtitle={sesionActiva === 'nueva' ? formatFecha(fechaHoy()) : sesionActiva ? formatFecha(sesionActiva) : ''}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha label="Apellidos" value={campos.apellidos} onChange={(v) => actualizarCampo('apellidos', v)} placeholder="Apellidos del paciente" readOnly={!editable} />
          <CampoFicha label="Nombre" value={campos.nombre} onChange={(v) => actualizarCampo('nombre', v)} placeholder="Nombre del paciente" readOnly={!editable} />
          <CampoFicha label="Edad" value={campos.edad} onChange={(v) => actualizarCampo('edad', v)} placeholder="Edad" readOnly={!editable} />
          <CampoFicha label="Sexo" value={campos.sexo} onChange={(v) => actualizarCampo('sexo', v)} placeholder="Sexo" readOnly={!editable} />
          <CampoFicha label="Profesión" value={campos.profesion} onChange={(v) => actualizarCampo('profesion', v)} placeholder="Profesión" readOnly={!editable} />
          <CampoFicha label="Altura / Peso" value={campos.alturaPeso} onChange={(v) => actualizarCampo('alturaPeso', v)} placeholder="Altura y peso" readOnly={!editable} />
          <CampoFicha label="Diagnóstico médico" value={campos.diagnosticoMedico} onChange={(v) => actualizarCampo('diagnosticoMedico', v)} placeholder="Diagnóstico médico" readOnly={!editable} />
          <CampoFicha label="Fecha inicial de anomalía" value={campos.fechaInicialAnomalia} onChange={(v) => actualizarCampo('fechaInicialAnomalia', v)} placeholder="Fecha inicial" readOnly={!editable} />
          <CampoFicha label="Tratamientos afines" value={campos.tratamientosAfines} onChange={(v) => actualizarCampo('tratamientosAfines', v)} placeholder="Tratamientos afines" readOnly={!editable} />
          <CampoFicha label="Medicación anterior / actual" value={campos.medicacion} onChange={(v) => actualizarCampo('medicacion', v)} placeholder="Medicación" readOnly={!editable} />
          <CampoFicha label="Prueba de imagen" value={campos.pruebaImagen} onChange={(v) => actualizarCampo('pruebaImagen', v)} placeholder="Prueba de imagen" readOnly={!editable} />
        </div>
      </SeccionDesplegable>

      <SeccionDesplegable title="Historia clínica y exploración" subtitle="Bloque desplegable">
        <CampoFicha label="Historia clínica" value={campos.historiaClinica} onChange={(v) => actualizarCampo('historiaClinica', v)} placeholder="Historia clínica" multiline readOnly={!editable} />
        <CampoFicha label="Anamnesis" value={campos.anamnesis} onChange={(v) => actualizarCampo('anamnesis', v)} placeholder="Anamnesis" multiline readOnly={!editable} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha label="Antecedentes AL o AV" value={campos.antecedentesALAV} onChange={(v) => actualizarCampo('antecedentesALAV', v)} placeholder="Antecedentes AL o AV" readOnly={!editable} />
          <CampoFicha label="Antecedentes AQ" value={campos.antecedentesAQ} onChange={(v) => actualizarCampo('antecedentesAQ', v)} placeholder="Antecedentes AQ" readOnly={!editable} />
        </div>
        <CampoFicha label="Inspección / observación" value={campos.inspeccionObservacion} onChange={(v) => actualizarCampo('inspeccionObservacion', v)} placeholder="Inspección y observación" multiline readOnly={!editable} />
        <CampoFicha label="Palpación diagnóstica" value={campos.palpacionDiagnostica} onChange={(v) => actualizarCampo('palpacionDiagnostica', v)} placeholder="Palpación diagnóstica" multiline readOnly={!editable} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CampoFicha label="Sensibilidad en" value={campos.sensibilidad} onChange={(v) => actualizarCampo('sensibilidad', v)} placeholder="Sensibilidad" readOnly={!editable} />
          <CampoFicha label="PGS" value={campos.pgs} onChange={(v) => actualizarCampo('pgs', v)} placeholder="PGS" readOnly={!editable} />
        </div>
        <CampoFicha label="Balance muscular" value={campos.balanceMuscular} onChange={(v) => actualizarCampo('balanceMuscular', v)} placeholder="MMSS / MMII / Tronco" multiline readOnly={!editable} />
        <CampoFicha label="Balance articular / movilidad + disfunciones" value={campos.balanceArticular} onChange={(v) => actualizarCampo('balanceArticular', v)} placeholder="Balance articular y disfunciones" multiline readOnly={!editable} />
        <CampoFicha label="Datos de interés" value={campos.datosInteres} onChange={(v) => actualizarCampo('datosInteres', v)} placeholder="Datos de interés" multiline readOnly={!editable} />
        <CampoFicha label="Valoración funcional" value={campos.valoracionFuncional} onChange={(v) => actualizarCampo('valoracionFuncional', v)} placeholder="Valoración funcional" multiline readOnly={!editable} />
        <CampoFicha label="Pruebas específicas" value={campos.pruebasEspecificas} onChange={(v) => actualizarCampo('pruebasEspecificas', v)} placeholder="Pruebas específicas" multiline readOnly={!editable} />
      </SeccionDesplegable>

      <SeccionDesplegable title="Problemas y tratamiento" subtitle="Bloque desplegable">
        <CampoFicha label="Identificación de los problemas fisioterapéuticos" value={campos.problemasFisioterapeuticos} onChange={(v) => actualizarCampo('problemasFisioterapeuticos', v)} placeholder="Problemas fisioterapéuticos" multiline readOnly={!editable} />
        <CampoFicha label="Programa de fisioterapia" value={campos.programaFisioterapia} onChange={(v) => actualizarCampo('programaFisioterapia', v)} placeholder="Programa de fisioterapia" multiline readOnly={!editable} />
        <CampoFicha label="Plan de tratamiento" value={campos.planTratamiento} onChange={(v) => actualizarCampo('planTratamiento', v)} placeholder="Plan de tratamiento" multiline readOnly={!editable} />
        <CampoFicha label="Recomendaciones a la familia" value={campos.recomendacionesFamilia} onChange={(v) => actualizarCampo('recomendacionesFamilia', v)} placeholder="Recomendaciones a la familia" multiline readOnly={!editable} />
        <CampoFicha label="Objetivos fisioterapéuticos" value={campos.objetivosFisioterapeuticos} onChange={(v) => actualizarCampo('objetivosFisioterapeuticos', v)} placeholder="Objetivos fisioterapéuticos" multiline readOnly={!editable} />
        <CampoFicha label="Evolución, exploración y tratamiento" value={campos.evolucionExploracionTratamiento} onChange={(v) => actualizarCampo('evolucionExploracionTratamiento', v)} placeholder="Evolución, exploración y tratamiento" multiline readOnly={!editable} />
        {errorPDF && <p style={{ fontSize: 13, color: '#D85A30', marginTop: 4 }}>{errorPDF}</p>}
        {infoPDF && (
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8, lineHeight: 1.5 }}>
            <p>PDF guardado en servidor: <span style={{ fontFamily: 'var(--font-mono)' }}>{infoPDF.savedPath}</span></p>
            {infoPDF.blobUrl && (
              <p>PDF: <a href={infoPDF.blobUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-mid)' }}>abrir PDF</a></p>
            )}
            {infoPDF.savedDir && (
              <p>Carpeta: <a href={`file://${infoPDF.savedDir}`} style={{ color: 'var(--teal-mid)' }}>abrir carpeta</a></p>
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

export function FisioApp() {
  const [autenticado, setAutenticado] = useState(() => Boolean(getStoredToken(FISIO_AUTH_SCOPE)));
  const [currentUser, setCurrentUser] = useState(() => getStoredUser(FISIO_AUTH_SCOPE));
  const [bootstrapping, setBootstrapping] = useState(() => !getStoredToken(FISIO_AUTH_SCOPE));
  const [bootstrapError, setBootstrapError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const [vista, setVista] = useState('buscar');
  const [pacienteActivo, setPacienteActivo] = useState(null);

  useEffect(() => {
    if (autenticado) {
      setBootstrapping(false);
      setLoginRequired(false);
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      setBootstrapping(true);
      setBootstrapError('');
      setLoginRequired(false);

      try {
        const runtimeConfig = await getRuntimeConfig();

        if (!runtimeConfig.demoMode) {
          if (!cancelled) {
            setLoginRequired(true);
          }
          return;
        }

        const res = await fetch('/api/fisio/session', { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data.success || !data.token || !data.currentUser) {
          throw new Error(data.error || 'No se pudo abrir la app fisio.');
        }

        if (cancelled) return;
        storeAuth(data.token, data.currentUser, FISIO_AUTH_SCOPE);
        setCurrentUser(data.currentUser);
        setAutenticado(true);
      } catch (error) {
        if (cancelled) return;
        setBootstrapError(error.message || 'No se pudo abrir la app fisio.');
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [autenticado]);

  const abrirFicha = (id) => {
    setPacienteActivo(id);
    setVista('ficha');
  };

  const cerrarSesion = () => {
    clearStoredAuth(FISIO_AUTH_SCOPE);
    setAutenticado(false);
    setCurrentUser(null);
    setPacienteActivo(null);
    setVista('buscar');
  };

  if (!autenticado) {
    if (loginRequired && !bootstrapping && !bootstrapError) {
      return (
        <VistaLogin
          authScope={FISIO_AUTH_SCOPE}
          onLoginCorrecto={(user) => {
            setCurrentUser(user);
            setAutenticado(true);
          }}
          title="Abrir app fisio"
          text="Acceso real para sesiones, pacientes y trabajo clínico."
        />
      );
    }

    return (
      <div style={s.authShell}>
        <div style={s.authCard}>
          <div style={s.authLogo} />
          <h1 style={s.authTitle}>Abrir app fisio</h1>
          <p style={s.authText}>
            Acceso directo temporal a la aplicación clínica de sesiones y pacientes.
          </p>
          {bootstrapError ? (
            <>
              <p style={s.authError}>{bootstrapError}</p>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button style={s.btnPrimary} onClick={() => window.location.reload()}>
                  Reintentar
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>
              {bootstrapping ? 'Preparando acceso...' : 'Entrando a fisio...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <div style={s.logo}>
          <div style={s.logoDot} />
          <span style={s.logoText}>App Fisio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/admin" style={{ ...s.btnSecondary, textDecoration: 'none' }}>Ir a admin</a>
          <span style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)' }}>
            {currentUser?.displayName || 'acceso protegido'}
          </span>
          <button style={s.btnSecondary} onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={s.mainNarrow}>
        {vista === 'buscar' && (
          <VistaBuscador
            onSeleccionarPaciente={abrirFicha}
            onNuevoPaciente={() => setVista('crear')}
            onSesionRapida={() => setVista('sesion-rapida')}
            isDemo={Boolean(currentUser?.isDemo)}
          />
        )}
        {vista === 'crear' && !currentUser?.isDemo && (
          <VistaCrearPaciente
            onVolver={() => setVista('buscar')}
            onCreado={abrirFicha}
          />
        )}
        {vista === 'ficha' && (
          <VistaFicha
            pacienteId={pacienteActivo}
            onVolver={() => setVista('buscar')}
            isDemo={Boolean(currentUser?.isDemo)}
          />
        )}
        {vista === 'sesion-rapida' && (
          <VistaSesionRapida
            onVolver={() => setVista('buscar')}
            isDemo={Boolean(currentUser?.isDemo)}
          />
        )}
      </main>
    </div>
  );
}

export default FisioApp;
