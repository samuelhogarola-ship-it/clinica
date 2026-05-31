import { useMemo, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/submit-fisio-intake`
  : '';

const INPUT_FIELDS = [
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'apellidos', label: 'Apellidos', required: true },
  { key: 'phone', label: 'Teléfono', required: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' },
  { key: 'edad', label: 'Edad' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'profesion', label: 'Profesión' },
  { key: 'alturaPeso', label: 'Altura / Peso' },
  { key: 'diagnosticoMedico', label: 'Diagnóstico médico' },
  { key: 'fechaInicialAnomalia', label: 'Fecha inicial de anomalía', type: 'date' },
  { key: 'tratamientosAfines', label: 'Tratamientos afines' },
  { key: 'medicacion', label: 'Medicación anterior / actual' },
  { key: 'pruebaImagen', label: 'Prueba de imagen' },
];

const TEXTAREA_SECTIONS = [
  {
    title: 'Historia clínica y exploración',
    fields: [
      ['historiaClinica', 'Historia clínica'],
      ['anamnesis', 'Anamnesis'],
      ['antecedentesALAV', 'Antecedentes AL o AV'],
      ['antecedentesAQ', 'Antecedentes AQ'],
      ['inspeccionObservacion', 'Inspección / observación'],
      ['palpacionDiagnostica', 'Palpación diagnóstica'],
      ['sensibilidad', 'Sensibilidad en'],
      ['pgs', 'PGS'],
      ['balanceMuscular', 'Balance muscular'],
      ['balanceArticular', 'Balance articular / movilidad + disfunciones'],
      ['datosInteres', 'Datos de interés'],
      ['valoracionFuncional', 'Valoración funcional'],
      ['pruebasEspecificas', 'Pruebas específicas'],
    ],
  },
  {
    title: 'Problemas y tratamiento',
    fields: [
      ['problemasFisioterapeuticos', 'Problemas fisioterapéuticos'],
      ['programaFisioterapia', 'Programa de fisioterapia'],
      ['planTratamiento', 'Plan de tratamiento'],
      ['recomendacionesFamilia', 'Recomendaciones a la familia'],
      ['objetivosFisioterapeuticos', 'Objetivos fisioterapéuticos'],
      ['evolucionExploracionTratamiento', 'Evolución, exploración y tratamiento'],
    ],
  },
];

const initialFormState = {
  nombre: '',
  apellidos: '',
  phone: '',
  email: '',
  birth_date: '',
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
  rgpd: false,
  privacy_policy: false,
  fecha: new Date().toISOString().slice(0, 10),
};

const styles = {
  page: {
    minHeight: '100vh',
    padding: '40px 20px 72px',
    background:
      'radial-gradient(circle at top, rgba(159,225,203,0.3), transparent 40%), var(--bg)',
  },
  shell: {
    maxWidth: 940,
    margin: '0 auto',
  },
  hero: {
    marginBottom: 28,
    padding: '28px 32px',
    borderRadius: 24,
    background: 'linear-gradient(135deg, #0F6E56, #1D9E75)',
    color: '#fff',
    boxShadow: '0 24px 60px rgba(15,110,86,0.16)',
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 'clamp(32px, 5vw, 48px)',
    lineHeight: 1.02,
    letterSpacing: '-0.04em',
    marginBottom: 12,
  },
  heroText: {
    maxWidth: 620,
    color: 'rgba(255,255,255,0.86)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 18px 50px rgba(44,44,42,0.05)',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--gray-600)',
    marginBottom: 14,
  },
  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: 'var(--gray-600)',
  },
  input: {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '11px 12px',
    background: 'var(--bg)',
    color: 'var(--gray-900)',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    minHeight: 92,
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '11px 12px',
    background: 'var(--bg)',
    color: 'var(--gray-900)',
    outline: 'none',
    resize: 'vertical',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    color: 'var(--gray-900)',
  },
  submitRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 24,
  },
  primaryButton: {
    border: 'none',
    borderRadius: 999,
    padding: '14px 24px',
    background: 'var(--teal-base)',
    color: '#fff',
    fontWeight: 500,
  },
  summary: {
    padding: '16px 18px',
    borderRadius: 16,
    border: '1px solid var(--teal-light)',
    background: 'var(--teal-pale)',
    color: 'var(--teal-dark)',
    marginBottom: 20,
  },
  error: {
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #efc2b0',
    background: '#fff3ef',
    color: '#9b4526',
    marginBottom: 18,
  },
  helper: {
    color: 'var(--gray-600)',
    fontSize: 13,
  },
};

function TriggerDownload({ url }) {
  if (!url) return null;

  return (
    <a
      href={url}
      style={{ color: 'var(--teal-dark)', fontWeight: 500 }}
      target="_blank"
      rel="noreferrer"
    >
      Descargar PDF
    </a>
  );
}

export function StaticRegistrationApp() {
  const [formState, setFormState] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const disabled = useMemo(() => {
    return !formState.nombre || !formState.apellidos || !formState.phone || !formState.rgpd || !formState.privacy_policy;
  }, [formState]);

  const updateField = (key, value) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!FUNCTION_URL || !SUPABASE_ANON_KEY) {
      setError('Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(formState),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'No se pudo guardar la ficha.');
      }

      setResult(payload);

      if (payload.download_url) {
        const link = document.createElement('a');
        link.href = payload.download_url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setFormState({
        ...initialFormState,
        fecha: new Date().toISOString().slice(0, 10),
      });
    } catch (submitError) {
      setError(submitError.message || 'No se pudo enviar la ficha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <p style={styles.heroKicker}>Registro Clínico Estático</p>
          <h1 style={styles.heroTitle}>Ficha fisioterapéutica con PDF y guardado en Supabase.</h1>
          <p style={styles.heroText}>
            Este flujo funciona sin servidor Node propio: guarda la ficha en Supabase,
            genera el PDF en una Edge Function y devuelve la descarga al momento.
          </p>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}

        {result ? (
          <div style={styles.summary}>
            <p>
              Registro guardado con el código <strong>{result.registry_number}</strong>
              {result.matched_existing_profile ? ' reutilizando un perfil existente.' : ' creando un perfil nuevo.'}
            </p>
            <p style={{ marginTop: 6 }}>
              <TriggerDownload url={result.download_url} />
            </p>
          </div>
        ) : null}

        <form style={styles.card} onSubmit={submitForm}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Datos base</h2>
            <div style={styles.sectionGrid}>
              {INPUT_FIELDS.map((field) => (
                <label key={field.key} style={styles.field}>
                  <span style={styles.label}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  <input
                    type={field.type || 'text'}
                    value={formState[field.key]}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    required={field.required}
                    style={styles.input}
                  />
                </label>
              ))}
            </div>
          </section>

          {TEXTAREA_SECTIONS.map((section) => (
            <section key={section.title} style={styles.section}>
              <h2 style={styles.sectionTitle}>{section.title}</h2>
              <div style={styles.sectionGrid}>
                {section.fields.map(([key, label]) => (
                  <label key={key} style={{ ...styles.field, gridColumn: '1 / -1' }}>
                    <span style={styles.label}>{label}</span>
                    <textarea
                      value={formState[key]}
                      onChange={(event) => updateField(key, event.target.value)}
                      style={styles.textarea}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Consentimiento</h2>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={formState.rgpd}
                onChange={(event) => updateField('rgpd', event.target.checked)}
              />
              <span>Acepto el tratamiento de datos personales conforme al RGPD.</span>
            </label>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={formState.privacy_policy}
                onChange={(event) => updateField('privacy_policy', event.target.checked)}
              />
              <span>He leído y acepto la política de privacidad de la clínica.</span>
            </label>
          </section>

          <div style={styles.submitRow}>
            <p style={styles.helper}>
              El PDF se genera en Supabase y se devuelve como descarga firmada.
            </p>
            <button type="submit" disabled={disabled || submitting} style={styles.primaryButton}>
              {submitting ? 'Guardando y generando PDF...' : 'Guardar ficha y descargar PDF'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
