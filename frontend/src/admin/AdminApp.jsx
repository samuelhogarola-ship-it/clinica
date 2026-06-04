import { useEffect, useMemo, useState } from 'react';
import {
  CampoFicha,
  FICHA_DEFAULTS,
  SeccionDesplegable,
  apiFetch,
  clearStoredAuth,
  formatFecha,
  formatFechaHora,
  getStoredToken,
  getStoredUser,
  getSubmissionDisplayName,
  hydrateFichaCampos,
  storeAuth,
  s,
} from '../internal/clinicShared.jsx';

const ADMIN_API = '/api/admin';
const ADMIN_AUTH_SCOPE = 'admin';
const ADMIN_TASKS_STORAGE_KEY = 'clinica-admin-tasks-v1';

const adminSectionButtonStyle = (active) => ({
  ...s.btnSecondary,
  background: active ? 'var(--teal-pale)' : 'transparent',
  borderColor: active ? 'var(--teal-light)' : 'var(--border)',
  color: active ? 'var(--teal-mid)' : 'var(--gray-600)',
});

const adminStatCardStyle = {
  ...s.card,
  marginBottom: 0,
  padding: '18px 20px',
};

const adminModuleCardStyle = (active) => ({
  ...s.card,
  marginBottom: 0,
  padding: '18px 20px',
  cursor: 'pointer',
  borderColor: active ? 'var(--teal-light)' : 'var(--border)',
  background: active ? 'var(--teal-pale)' : 'var(--surface)',
});

const adminShell = {
  page: {
    minHeight: '100vh',
    background: '#eef1f5',
    color: '#51606f',
  },
  topbar: {
    height: 54,
    background: '#4a86e8',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px 0 18px',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.06)',
  },
  topbarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  topbarMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '252px minmax(0, 1fr)',
    minHeight: 'calc(100vh - 54px)',
  },
  sidebar: {
    background: '#fff',
    borderRight: '1px solid #dfe5eb',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarBrand: {
    padding: '22px 18px 16px',
    borderBottom: '1px solid #dfe5eb',
  },
  sidebarBrandTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#4a86e8',
    letterSpacing: '-0.03em',
    marginBottom: 8,
  },
  sidebarBrandText: {
    fontSize: 13,
    color: '#7f8c99',
    lineHeight: 1.5,
  },
  sidebarNav: {
    padding: '14px 0',
    display: 'grid',
    gap: 4,
  },
  sidebarItem: (active) => ({
    border: 'none',
    borderLeft: active ? '4px solid #4a86e8' : '4px solid transparent',
    background: active ? '#4a86e8' : 'transparent',
    color: active ? '#fff' : '#5f6f80',
    textAlign: 'left',
    padding: '14px 18px',
    fontSize: 15,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  }),
  sidebarFooter: {
    marginTop: 'auto',
    padding: '16px 18px 20px',
    borderTop: '1px solid #dfe5eb',
    display: 'grid',
    gap: 10,
  },
  contentArea: {
    padding: '18px',
  },
  contentPanel: {
    background: '#fff',
    border: '1px solid #d6dde5',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    minHeight: 'calc(100vh - 90px)',
    overflow: 'hidden',
  },
  contentInner: {
    padding: '24px 22px 28px',
  },
  sectionHeader: {
    padding: '22px 22px 18px',
    borderBottom: '1px solid #e5eaef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4b5a68',
    letterSpacing: '-0.02em',
  },
  sectionText: {
    fontSize: 13,
    color: '#7a8795',
  },
  whiteCard: {
    background: '#fff',
    border: '1px solid #dfe5eb',
    borderRadius: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
};

function StatCard({ label, value, meta }) {
  return (
    <div style={adminStatCardStyle}>
      <div style={{ ...s.cardTitle, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.04em', marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{meta}</div>
    </div>
  );
}

function ModuleCard({ title, text, active, badge, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...adminModuleCardStyle(active), textAlign: 'left', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <strong style={{ fontSize: 16, fontWeight: 500 }}>{title}</strong>
        {badge ? <span style={{ ...s.idChip, fontSize: 11 }}>{badge}</span> : null}
      </div>
      <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.5 }}>{text}</p>
    </button>
  );
}

function AdminSectionNav({ currentSection, onChange }) {
  const items = [
    { id: 'overview', label: 'Resumen' },
    { id: 'patients', label: 'Pacientes' },
    { id: 'intake', label: 'Solicitudes' },
    { id: 'finance', label: 'Contabilidad' },
  ];

  return (
    <div style={adminShell.sidebarNav}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          style={adminShell.sidebarItem(currentSection === item.id)}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.badge ? (
            <span style={{
              minWidth: 24,
              padding: '2px 8px',
              borderRadius: 999,
              background: currentSection === item.id ? 'rgba(255,255,255,0.18)' : '#e8eff8',
              color: currentSection === item.id ? '#fff' : '#4a86e8',
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'center',
            }}
            >
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultAdminTasks() {
  return [
    { id: 'task-1', text: 'Revisar la agenda administrativa del día', done: false },
    { id: 'task-2', text: 'Comprobar facturas pendientes de emitir', done: false },
  ];
}

function loadAdminTasks() {
  if (typeof window === 'undefined') return getDefaultAdminTasks();

  try {
    const raw = window.localStorage.getItem(ADMIN_TASKS_STORAGE_KEY);
    if (!raw) return getDefaultAdminTasks();

    const parsed = JSON.parse(raw);
    if (parsed?.date !== getTodayKey() || !Array.isArray(parsed?.tasks)) {
      return getDefaultAdminTasks();
    }

    return parsed.tasks;
  } catch {
    return getDefaultAdminTasks();
  }
}

function saveAdminTasks(tasks) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_TASKS_STORAGE_KEY, JSON.stringify({
    date: getTodayKey(),
    tasks,
  }));
}

function VistaResumen({ currentUser }) {
  const [tasks, setTasks] = useState(() => loadAdminTasks());
  const [draftTask, setDraftTask] = useState('');

  useEffect(() => {
    saveAdminTasks(tasks);
  }, [tasks]);

  const firstName = (currentUser?.displayName || 'Susana').split(' ')[0];
  const todayLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const pendingTasks = tasks.filter((task) => !task.done);
  const calendarDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const addTask = () => {
    const nextText = draftTask.trim();
    if (!nextText) return;

    setTasks((current) => [
      ...current,
      { id: `task-${Date.now()}`, text: nextText, done: false },
    ]);
    setDraftTask('');
  };

  const toggleTask = (taskId) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, done: !task.done } : task
    )));
  };

  return (
    <div>
      <div style={adminShell.sectionHeader}>
        <div>
          <div style={adminShell.sectionTitle}>Hola {firstName}, esto es lo que te espera hoy.</div>
          <div style={adminShell.sectionText}>
            Resumen operativo sencillo para administración.
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#7f8c99' }}>
          {todayLabel}
        </div>
      </div>

      <div style={adminShell.contentInner}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16, marginBottom: 18 }}>
          <div style={adminShell.whiteCard}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>
              Calendario
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                {calendarDays.map((day) => (
                  <div key={day} style={{ fontSize: 12, color: '#7f8c99', textAlign: 'center', fontWeight: 700 }}>
                    {day}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
                {Array.from({ length: 35 }).map((_, index) => {
                  const isToday = index === 17;
                  return (
                    <div
                      key={index}
                      style={{
                        minHeight: 58,
                        borderRadius: 10,
                        border: '1px solid #e4e9ef',
                        background: isToday ? '#edf4ff' : '#fafbfd',
                        boxShadow: isToday ? 'inset 0 0 0 1px #4a86e8' : 'none',
                        padding: '8px 9px',
                        fontSize: 12,
                        color: isToday ? '#4a86e8' : '#8a96a3',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{index + 1 <= 30 ? index + 1 : ''}</span>
                      {isToday ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a86e8' }} /> : null}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, color: '#7f8c99', marginTop: 14 }}>
                Placeholder visual del calendario. Se puede conectar después si realmente lo necesitáis.
              </p>
            </div>
          </div>

          <div style={adminShell.whiteCard}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>
              Tareas pendientes de hoy
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input
                  style={{ ...s.input, background: '#fff' }}
                  type="text"
                  value={draftTask}
                  onChange={(event) => setDraftTask(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addTask()}
                  placeholder="Añadir tarea rápida"
                />
                <button style={s.btnPrimary} onClick={addTask}>
                  Añadir
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '11px 12px',
                      border: '1px solid #e4e9ef',
                      borderRadius: 10,
                      background: task.done ? '#f7faf8' : '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span style={{ fontSize: 14, color: task.done ? '#8a96a3' : '#4b5a68', textDecoration: task.done ? 'line-through' : 'none' }}>
                      {task.text}
                    </span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 14, fontSize: 13, color: '#7f8c99' }}>
                {pendingTasks.length} pendientes hoy. Estas tareas son solo para administradores.
              </div>
            </div>
          </div>
        </div>

        <div style={adminShell.whiteCard}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>
            Explicación
          </div>
          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            <div style={{ padding: '14px 16px', border: '1px solid #e4e9ef', borderRadius: 10, background: '#fafbfd' }}>
              <div style={{ ...s.cardTitle, marginBottom: 8 }}>Calendario</div>
              <div style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6 }}>
                Opcional. De momento sirve como referencia visual para el día y para reservar espacio a una agenda futura.
              </div>
            </div>
            <div style={{ padding: '14px 16px', border: '1px solid #e4e9ef', borderRadius: 10, background: '#fafbfd' }}>
              <div style={{ ...s.cardTitle, marginBottom: 8 }}>Tareas</div>
              <div style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6 }}>
                Lista rápida solo para los administradores. Está pensada para gestión diaria sencilla, no para seguimiento clínico.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VistaPacientes() {
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSessionDate, setSelectedSessionDate] = useState('');
  const [activityDetail, setActivityDetail] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [draftFilters, setDraftFilters] = useState({ name: '', code: '', birthDate: '' });
  const [appliedFilters, setAppliedFilters] = useState({ name: '', code: '', birthDate: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPatients = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await apiFetch('/pacientes', {}, ADMIN_API, ADMIN_AUTH_SCOPE);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar el directorio de pacientes');
        }

        if (cancelled) return;
        const nextPatients = Array.isArray(data) ? data : [];
        setPatients(nextPatients);
        setSelectedId((current) => (current && nextPatients.some((patient) => patient.id === current) ? current : nextPatients[0]?.id || ''));
      } catch (loadError) {
        if (cancelled) return;
        setPatients([]);
        setSelectedId('');
        setError(loadError.message || 'No se pudo cargar el directorio de pacientes');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPatients();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const needleName = appliedFilters.name.trim().toLowerCase();
    const needleCode = appliedFilters.code.trim().toLowerCase();
    const needleBirth = appliedFilters.birthDate.trim();

    if (!needleName && !needleCode && !needleBirth) return patients;

    return patients.filter((patient) => (
      (!needleCode || patient.id.toLowerCase().includes(needleCode))
      && (!needleName || (patient.displayName || '').toLowerCase().includes(needleName))
      && (!needleBirth || (patient.fechaNacimiento || '').includes(needleBirth))
    ));
  }, [appliedFilters, patients]);

  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedId)
    || patients.find((patient) => patient.id === selectedId)
    || filteredPatients[0]
    || null;

  const totalSessions = filteredPatients.reduce((sum, patient) => sum + (patient.sesiones?.length || 0), 0);
  const runPatientSearch = () => setAppliedFilters(draftFilters);

  useEffect(() => {
    const firstSession = selectedPatient?.sesiones?.[0] || '';
    setSelectedSessionDate(firstSession);
    setActivityDetail(null);
    setActivityError('');
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient?.id || !selectedSessionDate) {
      setActivityDetail(null);
      setActivityLoading(false);
      return;
    }

    let cancelled = false;
    setActivityLoading(true);
    setActivityError('');

    apiFetch(`/sesiones/${selectedPatient.id}/${selectedSessionDate}`, {}, ADMIN_API, ADMIN_AUTH_SCOPE)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          throw new Error(data.error || 'No se pudo abrir la actividad');
        }
        setActivityDetail(data);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setActivityDetail(null);
        setActivityError(loadError.message || 'No se pudo abrir la actividad');
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, selectedSessionDate]);

  return (
    <div>
      <div style={adminShell.sectionHeader}>
        <div>
          <div style={adminShell.sectionTitle}>{loading ? 'PACIENTES' : `${filteredPatients.length} PACIENTES`}</div>
          <div style={adminShell.sectionText}>
            Directorio administrativo para localizar pacientes, revisar su actividad y pasar al carril clínico.
          </div>
        </div>
      </div>

      <div style={adminShell.contentInner}>
        <div style={{ ...adminShell.whiteCard, marginBottom: 16 }}>
          <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #e6ebf0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.9fr auto', gap: 16, alignItems: 'end' }}>
              <div>
                <label style={s.label}>Nombre</label>
                <input
                  style={s.input}
                  type="text"
                  value={draftFilters.name}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nombre o alias"
                />
              </div>
              <div>
                <label style={s.label}>Número</label>
                <input
                  style={s.input}
                  type="text"
                  value={draftFilters.code}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="Código paciente"
                />
              </div>
              <div>
                <label style={s.label}>Fecha nac.</label>
                <input
                  style={s.input}
                  type="text"
                  value={draftFilters.birthDate}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, birthDate: event.target.value }))}
                  onKeyDown={(event) => event.key === 'Enter' && runPatientSearch()}
                  placeholder="AAAA-MM-DD"
                />
              </div>
              <button style={{ ...s.btnPrimary, height: 40 }} onClick={runPatientSearch}>
                Buscar
              </button>
            </div>
          </div>

          <div style={{ padding: '14px 20px 16px' }}>
            <div style={{ fontSize: 13, color: '#6f7f90', marginBottom: 12 }}>
              Pacientes encontrados: <strong style={{ color: '#4b5a68' }}>{filteredPatients.length}</strong>
            </div>
            {filteredPatients.some((patient) => patient.isDemo) && (
              <p style={{ fontSize: 12, color: '#7f8c99', marginBottom: 12 }}>
                Mostrando clientes demo porque todavía no hay directorio real cargado en este entorno.
              </p>
            )}
            {error && <p style={{ fontSize: 13, color: '#D85A30', marginBottom: 10 }}>{error}</p>}

            {loading ? (
              <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>Cargando pacientes...</p>
            ) : filteredPatients.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>No hay pacientes que coincidan con la búsqueda.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {filteredPatients.map((patient) => {
                  const active = selectedPatient?.id === patient.id;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedId(patient.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: '12px 14px',
                        border: '1px solid #e1e6ec',
                        borderRadius: 10,
                        background: active ? '#edf4ff' : '#fff',
                        boxShadow: active ? 'inset 0 0 0 1px #4a86e8' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#f7dcb3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b68033',
                        fontWeight: 700,
                      }}
                      >
                        {(patient.displayName || patient.id || 'P').slice(0, 1)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 16, color: active ? '#4a86e8' : '#4b5a68', fontWeight: 500 }}>
                            {patient.displayName || patient.id}
                          </div>
                          {patient.isDemo ? (
                            <span style={{ ...s.idChip, fontSize: 10, padding: '2px 7px' }}>demo</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: '#7f8c99', marginTop: 4 }}>
                          {patient.id} · {patient.sesiones?.length || 0} sesiones
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 16 }}>
          <div style={adminShell.whiteCard}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>
                {selectedPatient ? `PACIENTE Nº ${selectedPatient.id}` : 'Paciente'}
              </div>
              <div style={{ fontSize: 12, color: '#7f8c99' }}>
                Sesiones visibles: {totalSessions}
              </div>
            </div>

            {!selectedPatient ? (
              <div style={{ padding: 20, color: '#7f8c99', fontSize: 14 }}>
                Selecciona un paciente para ver su ficha administrativa.
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={s.label}>Nombre</label>
                    <div style={s.input}>{selectedPatient.displayName || 'Sin alias'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Código</label>
                    <div style={s.input}>{selectedPatient.id}</div>
                  </div>
                  <div>
                    <label style={s.label}>Fecha nac.</label>
                    <div style={s.input}>{selectedPatient.fechaNacimiento ? formatFecha(selectedPatient.fechaNacimiento) : 'Pendiente'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Visitas</label>
                    <div style={s.input}>{selectedPatient.sesiones?.length || 0}</div>
                  </div>
                  <div>
                    <label style={s.label}>Tipo</label>
                    <div style={s.input}>{selectedPatient.isDemo ? 'Cliente demo' : 'Cliente real'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / span 2' }}>
                    <label style={s.label}>Observaciones</label>
                    <div style={{ ...s.textarea, minHeight: 120, background: '#fff' }}>
                      {selectedPatient.isDemo
                        ? 'Registro de muestra para visualizar el panel mientras no haya pacientes reales cargados en este entorno.'
                        : 'Paciente sincronizado con la base clínica compartida.'} Alta en sistema: {selectedPatient.creadoEn ? formatFechaHora(selectedPatient.creadoEn) : 'sin fecha'}.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={adminShell.whiteCard}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>Actividad</div>
            </div>
            <div style={{ padding: 16 }}>
              {!selectedPatient?.sesiones?.length ? (
                <p style={{ fontSize: 14, color: '#7f8c99' }}>Todavía no hay sesiones guardadas para este paciente.</p>
              ) : (
                selectedPatient.sesiones.map((fecha) => (
                  <button
                    key={fecha}
                    type="button"
                    onClick={() => setSelectedSessionDate(fecha)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      borderBottom: '1px solid #edf1f5',
                      padding: '12px 0',
                      background: selectedSessionDate === fecha ? '#edf4ff' : 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: '#7fc96a',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                    >
                      +
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#4b5a68', fontWeight: 600 }}>{formatFecha(fecha)}</div>
                      <div style={{ fontSize: 12, color: '#7f8c99', marginTop: 4 }}>Abrir actividad administrativa compartida</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#7f8c99' }}>{selectedPatient.displayName || selectedPatient.id}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ ...adminShell.whiteCard, marginTop: 16 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #e6ebf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#4b5a68' }}>
              {selectedSessionDate ? `Actividad ${formatFecha(selectedSessionDate)}` : 'Detalle de actividad'}
            </div>
            {activityDetail?.isDemo ? (
              <span style={{ ...s.idChip, fontSize: 11 }}>demo</span>
            ) : null}
          </div>
          <div style={{ padding: 20 }}>
            {!selectedPatient?.sesiones?.length ? (
              <p style={{ fontSize: 14, color: '#7f8c99' }}>
                Cuando el paciente tenga actividad, podrás abrirla aquí mismo desde el panel admin.
              </p>
            ) : activityLoading ? (
              <p style={{ fontSize: 14, color: '#7f8c99' }}>Abriendo actividad...</p>
            ) : activityError ? (
              <p style={{ fontSize: 14, color: '#D85A30' }}>{activityError}</p>
            ) : activityDetail ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
                  <div>
                    <label style={s.label}>Fecha</label>
                    <div style={s.input}>{formatFecha(activityDetail.fecha)}</div>
                  </div>
                  <div>
                    <label style={s.label}>Creado</label>
                    <div style={s.input}>{activityDetail.creadoEn ? formatFechaHora(activityDetail.creadoEn) : '—'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Actualizado</label>
                    <div style={s.input}>{activityDetail.actualizadoEn ? formatFechaHora(activityDetail.actualizadoEn) : '—'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Origen</label>
                    <div style={s.input}>{activityDetail.isDemo ? 'Temporal admin' : 'Base clínica compartida'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <CampoFicha label="Diagnóstico médico" value={activityDetail.diagnosticoMedico || ''} onChange={() => {}} readOnly />
                  <CampoFicha label="Anamnesis" value={activityDetail.anamnesis || ''} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Historia clínica" value={activityDetail.historiaClinica || ''} onChange={() => {}} multiline readOnly />
                  <CampoFicha label="Plan de tratamiento" value={activityDetail.planTratamiento || ''} onChange={() => {}} multiline readOnly />
                </div>

                <CampoFicha
                  label="Evolución, exploración y tratamiento"
                  value={activityDetail.evolucionExploracionTratamiento || ''}
                  onChange={() => {}}
                  multiline
                  readOnly
                />
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#7f8c99' }}>
                Selecciona una actividad de la derecha para verla dentro del panel administrador.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VistaContabilidad({ overview }) {
  const [financeSection, setFinanceSection] = useState('overview');
  const paymentTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
  };
  const totalCollected = paymentTotals.cash + paymentTotals.card + paymentTotals.transfer;
  const paymentRows = [
    { key: 'cash', label: 'Efectivo', value: paymentTotals.cash, color: '#0F6E56' },
    { key: 'card', label: 'Tarjeta', value: paymentTotals.card, color: '#2F6FED' },
    { key: 'transfer', label: 'Transferencia', value: paymentTotals.transfer, color: '#9A6700' },
  ];
  const [mode, setMode] = useState('by-client');
  const [quickClients, setQuickClients] = useState([]);
  const [registryNumber, setRegistryNumber] = useState('');
  const [loadingClientRecords, setLoadingClientRecords] = useState(false);
  const [clientLookupError, setClientLookupError] = useState('');
  const [clientBillingData, setClientBillingData] = useState(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [invoiceConcept, setInvoiceConcept] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('card');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [manualInvoice, setManualInvoice] = useState({
    clientLabel: '',
    clientNumber: '',
    concept: '',
    amount: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [manualPreview, setManualPreview] = useState(null);

  const loadClientRecords = async (registryOverride = '') => {
    const nextRegistry = String(registryOverride || registryNumber).trim().toUpperCase();
    if (!nextRegistry) return;

    setLoadingClientRecords(true);
    setClientLookupError('');
    setClientBillingData(null);
    setSelectedRecordIds([]);
    setInvoicePreview(null);
    setRegistryNumber(nextRegistry);

    try {
      const res = await apiFetch(`/billing/profile-records?registry=${encodeURIComponent(nextRegistry)}`, {}, ADMIN_API, ADMIN_AUTH_SCOPE);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los registros del cliente');
      }

      setClientBillingData(data);
      setSelectedRecordIds((data.records || []).map((record) => record.id));
      setInvoiceConcept('');
    } catch (error) {
      setClientLookupError(error.message || 'No se pudieron cargar los registros del cliente');
    } finally {
      setLoadingClientRecords(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    apiFetch('/pacientes', {}, ADMIN_API, ADMIN_AUTH_SCOPE)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled || !ok || !Array.isArray(data)) return;
        setQuickClients(data.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) {
          setQuickClients([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'by-client') return;
    if (!quickClients.length) return;
    if (clientBillingData?.profile?.registry_number || registryNumber.trim()) return;

    loadClientRecords(quickClients[0].id);
  }, [mode, quickClients, clientBillingData?.profile?.registry_number, registryNumber]);

  const toggleRecord = (recordId) => {
    setSelectedRecordIds((current) => (
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    ));
  };

  const selectedRecords = (clientBillingData?.records || []).filter((record) => selectedRecordIds.includes(record.id));

  const emitClientInvoiceDraft = () => {
    if (!clientBillingData?.profile) return;

    setInvoicePreview({
      mode: 'client',
      profile: clientBillingData.profile,
      selectedCount: selectedRecords.length,
      records: selectedRecords,
      concept: invoiceConcept.trim(),
      amount: invoiceAmount.trim(),
      paymentMethod: invoicePaymentMethod,
      createdAt: new Date().toISOString(),
    });
  };

  const emitManualInvoiceDraft = () => {
    setManualPreview({
      ...manualInvoice,
      clientLabel: manualInvoice.clientLabel.trim(),
      clientNumber: manualInvoice.clientNumber.trim().toUpperCase(),
      concept: manualInvoice.concept.trim(),
      amount: manualInvoice.amount.trim(),
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <div style={adminShell.sectionHeader}>
        <div>
          <div style={adminShell.sectionTitle}>CONTABILIDAD</div>
          <div style={adminShell.sectionText}>
            Caja general, cobros y facturas dentro del mismo módulo administrativo.
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#7f8c99' }}>
          Sesiones este mes: {overview?.sessionsThisMonth ?? 0}
        </div>
      </div>

      <div style={adminShell.contentInner}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button style={adminSectionButtonStyle(financeSection === 'overview')} onClick={() => setFinanceSection('overview')}>
            Contabilidad general
          </button>
          <button style={adminSectionButtonStyle(financeSection === 'invoices')} onClick={() => setFinanceSection('invoices')}>
            Facturas
          </button>
        </div>

        {financeSection === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={s.cardHeader}>
                <span style={s.cardTitle}>Cobro total</span>
              </div>
              <div style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-0.05em', marginBottom: 8 }}>
                {totalCollected.toFixed(2)} €
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                {overview?.sessionsThisMonth ?? 0} sesiones este mes · pendiente de conectar cobros reales
              </div>
            </div>

            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={s.cardHeader}>
                <span style={s.cardTitle}>Métodos</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {paymentRows.map((row) => (
                  <div key={row.key} style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)' }}>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>{row.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 500 }}>{row.value.toFixed(2)} €</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardTitle}>Distribución visual</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {paymentRows.map((row) => {
                const ratio = totalCollected > 0 ? (row.value / totalCollected) * 100 : 0;
                return (
                  <div key={row.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                        {row.value.toFixed(2)} € · {ratio.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${ratio}%`,
                          minWidth: row.value > 0 ? 8 : 0,
                          background: row.color,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                En cuanto conectemos cobros reales, esta vista se llenará sin añadir más complejidad.
              </p>
            </div>
          </div>
          </>
        )}

        {financeSection === 'invoices' && (
          <div style={{ ...s.card, marginTop: 0 }}>
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>Emitir factura</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={adminSectionButtonStyle(mode === 'by-client')} onClick={() => setMode('by-client')}>
                Desde registros del paciente
              </button>
              <button style={adminSectionButtonStyle(mode === 'manual')} onClick={() => setMode('manual')}>
                Nueva factura
              </button>
            </div>
          </div>

          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 18 }}>
            Elige si quieres emitir una factura desde registros del paciente o crear una nueva manualmente.
          </p>

          {mode === 'by-client' ? (
            <div>
            {quickClients.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <label style={s.label}>Clientes cargados por defecto</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {quickClients.map((client) => {
                    const active = registryNumber.trim().toUpperCase() === client.id;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => loadClientRecords(client.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: active ? '1px solid #4a86e8' : '1px solid #dfe5eb',
                          background: active ? '#edf4ff' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 600, color: active ? '#356bc3' : '#4b5a68', marginBottom: 4 }}>
                          {client.displayName || client.id}
                        </div>
                        <div style={{ fontSize: 12, color: '#7f8c99' }}>{client.id}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Factura desde registros del paciente</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  type="text"
                  value={registryNumber}
                  onChange={(event) => setRegistryNumber(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === 'Enter' && loadClientRecords()}
                  placeholder="Ej: REG-100245"
                />
                <button style={s.btnPrimary} onClick={loadClientRecords} disabled={loadingClientRecords || !registryNumber.trim()}>
                  {loadingClientRecords ? 'Cargando...' : 'Cargar registros'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>
                Busca el cliente por `registry_number` y te cargamos sus registros para seleccionar qué facturar.
              </p>
              {clientLookupError && <p style={{ fontSize: 13, color: '#D85A30', marginTop: 10 }}>{clientLookupError}</p>}
            </div>

            {clientBillingData?.profile && (
              <>
                <div style={{ ...s.card, marginBottom: 16, padding: '18px 20px', background: 'var(--bg)' }}>
                  <div style={s.cardHeader}>
                    <span style={s.cardTitle}>Cliente cargado</span>
                    <span style={{ ...s.idChip, fontSize: 11 }}>{clientBillingData.profile.registry_number}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={s.label}>Nombre</label>
                      <div style={s.input}>{[clientBillingData.profile.name, clientBillingData.profile.surnames].filter(Boolean).join(' ') || 'Sin nombre'}</div>
                    </div>
                    <div>
                      <label style={s.label}>Estado</label>
                      <div style={s.input}>{clientBillingData.profile.profile_status || '—'}</div>
                    </div>
                    <div>
                      <label style={s.label}>Teléfono</label>
                      <div style={s.input}>{clientBillingData.profile.phone || '—'}</div>
                    </div>
                    <div>
                      <label style={s.label}>Email</label>
                      <div style={s.input}>{clientBillingData.profile.email || '—'}</div>
                    </div>
                  </div>
                  {clientBillingData.is_demo ? (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#7f8c99' }}>
                      Datos demo temporales para preview administrativa.
                    </div>
                  ) : null}
                </div>

                <SeccionDesplegable title={clientBillingData.is_demo ? 'Registros temporales' : 'Registros de Supabase'} subtitle={`${clientBillingData.records.length} disponibles`} defaultOpen>
                  {clientBillingData.records.length === 0 ? (
                    <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>
                      {clientBillingData.is_demo ? 'Este cliente demo no tiene más registros temporales.' : 'Este cliente no tiene `app_records` todavía.'}
                    </p>
                  ) : (
                    clientBillingData.records.map((record) => (
                      <label
                        key={record.id}
                        style={{
                          display: 'block',
                          padding: '12px 14px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 10,
                          background: selectedRecordIds.includes(record.id) ? 'var(--teal-pale)' : 'var(--bg)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.includes(record.id)}
                            onChange={() => toggleRecord(record.id)}
                            style={{ marginTop: 4 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                              <strong style={{ fontSize: 14 }}>
                                {record.concept || `${record.record_type} · ${record.app_id}`}
                              </strong>
                              <span style={{ ...s.idChip, fontSize: 11 }}>{record.record_type}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                              <div>{formatFechaHora(record.created_at)}</div>
                              <div>{record.app_id} · v{record.version}</div>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </SeccionDesplegable>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 14, marginTop: 16 }}>
                  <div>
                    <label style={s.label}>Concepto de factura</label>
                    <input
                      style={s.input}
                      type="text"
                      value={invoiceConcept}
                      onChange={(event) => setInvoiceConcept(event.target.value)}
                      placeholder="Ej: sesiones de fisioterapia / revisión clínica"
                    />
                  </div>
                  <div>
                    <label style={s.label}>Importe</label>
                    <input
                      style={s.input}
                      type="text"
                      value={invoiceAmount}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label style={s.label}>Cobro</label>
                    <select
                      style={s.select}
                      value={invoicePaymentMethod}
                      onChange={(event) => setInvoicePaymentMethod(event.target.value)}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                    {selectedRecords.length} registros seleccionados para facturar
                  </span>
                  <button
                    style={s.btnPrimary}
                    onClick={emitClientInvoiceDraft}
                    disabled={!selectedRecords.length || !invoiceAmount.trim()}
                  >
                    Emitir factura
                  </button>
                </div>

                {invoicePreview && (
                  <div style={{ ...s.card, marginTop: 16, background: 'var(--bg)' }}>
                    <div style={s.cardHeader}>
                      <span style={s.cardTitle}>Borrador de factura</span>
                      <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{formatFechaHora(invoicePreview.createdAt)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={s.label}>Cliente</label>
                        <div style={s.input}>{[invoicePreview.profile.name, invoicePreview.profile.surnames].filter(Boolean).join(' ')}</div>
                      </div>
                      <div>
                        <label style={s.label}>Número</label>
                        <div style={s.input}>{invoicePreview.profile.registry_number}</div>
                      </div>
                      <div>
                        <label style={s.label}>Concepto</label>
                        <div style={s.input}>{invoicePreview.concept || 'Sin concepto manual'}</div>
                      </div>
                      <div>
                        <label style={s.label}>Importe</label>
                        <div style={s.input}>{invoicePreview.amount} €</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                      Método de cobro: {invoicePreview.paymentMethod === 'cash' ? 'Efectivo' : invoicePreview.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          ) : (
            <div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14 }}>
              Nueva factura manual, sin depender de registros previos del paciente.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={s.label}>Cliente</label>
                <input
                  style={s.input}
                  type="text"
                  value={manualInvoice.clientLabel}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, clientLabel: event.target.value }))}
                  placeholder="Nombre o razón social"
                />
              </div>
              <div>
                <label style={s.label}>Número de cliente</label>
                <input
                  style={s.input}
                  type="text"
                  value={manualInvoice.clientNumber}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, clientNumber: event.target.value.toUpperCase() }))}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label style={s.label}>Concepto</label>
                <input
                  style={s.input}
                  type="text"
                  value={manualInvoice.concept}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, concept: event.target.value }))}
                  placeholder="Ej: factura manual de consulta"
                />
              </div>
              <div>
                <label style={s.label}>Importe</label>
                <input
                  style={s.input}
                  type="text"
                  value={manualInvoice.amount}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={s.label}>Cobro</label>
                <select
                  style={s.select}
                  value={manualInvoice.paymentMethod}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, paymentMethod: event.target.value }))}
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Notas</label>
                <input
                  style={s.input}
                  type="text"
                  value={manualInvoice.notes}
                  onChange={(event) => setManualInvoice((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={s.btnPrimary}
                onClick={emitManualInvoiceDraft}
                disabled={!manualInvoice.clientLabel.trim() || !manualInvoice.concept.trim() || !manualInvoice.amount.trim()}
              >
                Emitir factura manual
              </button>
            </div>

            {manualPreview && (
              <div style={{ ...s.card, marginTop: 16, background: 'var(--bg)' }}>
                <div style={s.cardHeader}>
                  <span style={s.cardTitle}>Borrador manual</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{formatFechaHora(manualPreview.createdAt)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={s.label}>Cliente</label>
                    <div style={s.input}>{manualPreview.clientLabel}</div>
                  </div>
                  <div>
                    <label style={s.label}>Número</label>
                    <div style={s.input}>{manualPreview.clientNumber || 'Manual sin número'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Concepto</label>
                    <div style={s.input}>{manualPreview.concept}</div>
                  </div>
                  <div>
                    <label style={s.label}>Importe</label>
                    <div style={s.input}>{manualPreview.amount} €</div>
                  </div>
                  <div>
                    <label style={s.label}>Cobro</label>
                    <div style={s.input}>{manualPreview.paymentMethod === 'cash' ? 'Efectivo' : manualPreview.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}</div>
                  </div>
                  <div>
                    <label style={s.label}>Notas</label>
                    <div style={s.input}>{manualPreview.notes || '—'}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

function VistaSubmissions({ currentUser }) {
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
      const res = await apiFetch('/intake/submissions?status=pending&limit=100', {}, ADMIN_API, ADMIN_AUTH_SCOPE);
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

    apiFetch(`/intake/profiles/${profileId}/documents?limit=20`, {}, ADMIN_API, ADMIN_AUTH_SCOPE)
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
      }, ADMIN_API, ADMIN_AUTH_SCOPE);
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
      }, ADMIN_API, ADMIN_AUTH_SCOPE);
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
      <div style={adminShell.sectionHeader}>
        <div>
          <div style={adminShell.sectionTitle}>INTAKE Y DOCUMENTOS</div>
          <div style={adminShell.sectionText}>
            Revisión administrativa de formularios públicos, validación clínica inicial y control documental.
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#7f8c99' }}>
          {loading ? 'Cargando bandeja…' : `${submissions.length} pendientes`}
        </div>
      </div>

      <div style={adminShell.contentInner}>
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
                    type="button"
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
    </div>
  );
}

export function AdminApp() {
  const [autenticado, setAutenticado] = useState(() => Boolean(getStoredToken(ADMIN_AUTH_SCOPE)));
  const [currentUser, setCurrentUser] = useState(() => getStoredUser(ADMIN_AUTH_SCOPE));
  const [bootstrapping, setBootstrapping] = useState(() => !getStoredToken(ADMIN_AUTH_SCOPE));
  const [bootstrapError, setBootstrapError] = useState('');
  const [section, setSection] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  useEffect(() => {
    if (autenticado) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      setBootstrapping(true);
      setBootstrapError('');

      try {
        const res = await fetch('/api/admin/session', { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data.success || !data.token || !data.currentUser) {
          throw new Error(data.error || 'No se pudo abrir el panel admin.');
        }

        if (cancelled) return;
        storeAuth(data.token, data.currentUser, ADMIN_AUTH_SCOPE);
        setCurrentUser(data.currentUser);
        setAutenticado(true);
      } catch (error) {
        if (cancelled) return;
        setBootstrapError(error.message || 'No se pudo abrir el panel admin.');
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

  useEffect(() => {
    if (!autenticado) return;

    let cancelled = false;

    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError('');

      try {
        const res = await apiFetch('/overview', {}, ADMIN_API, ADMIN_AUTH_SCOPE);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar el resumen administrativo');
        }

        if (!cancelled) {
          setOverview(data);
        }
      } catch (error) {
        if (!cancelled) {
          setOverview(null);
          setOverviewError(error.message || 'No se pudo cargar el resumen administrativo');
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [autenticado]);

  const cerrarSesion = () => {
    clearStoredAuth(ADMIN_AUTH_SCOPE);
    setAutenticado(false);
    setCurrentUser(null);
  };

  if (!autenticado) {
    return (
      <div style={s.authShell}>
        <div style={s.authCard}>
          <div style={s.authLogo} />
          <h1 style={s.authTitle}>Abriendo Panel Admin</h1>
          <p style={s.authText}>
            Acceso directo al panel administrador de clínica.
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
              {bootstrapping ? 'Preparando acceso...' : 'Entrando al panel...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={adminShell.page}>
      <header style={adminShell.topbar}>
        <div style={adminShell.topbarBrand}>
          <span>Clínica</span>
          <span style={adminShell.topbarMeta}>demo · administrador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/fisio" style={{ color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Ir a fisio
          </a>
          <span style={adminShell.topbarMeta}>{currentUser?.displayName || 'acceso directo'}</span>
        </div>
      </header>

      <div style={adminShell.body}>
        <aside style={adminShell.sidebar}>
          <div style={adminShell.sidebarBrand}>
            <div style={adminShell.sidebarBrandTitle}>Clínica</div>
            <div style={adminShell.sidebarBrandText}>
              Gestión interna centrada en pacientes y contabilidad.
            </div>
          </div>

          <AdminSectionNav currentSection={section} onChange={setSection} />

          <div style={adminShell.sidebarFooter}>
            <button style={{ ...s.btnSecondary, justifyContent: 'center' }} onClick={cerrarSesion}>
              Reiniciar acceso
            </button>
          </div>
        </aside>

        <main style={adminShell.contentArea}>
          <div style={adminShell.contentPanel}>
            {section === 'overview' && (
              <VistaResumen
                currentUser={currentUser}
              />
            )}
            {section === 'patients' && <VistaPacientes />}
            {section === 'intake' && <VistaSubmissions currentUser={currentUser} />}
            {section === 'finance' && <VistaContabilidad overview={overview} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminApp;
