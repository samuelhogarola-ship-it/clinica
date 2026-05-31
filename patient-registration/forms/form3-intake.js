/**
 * clinica · Form 3 — Intake por aplicación
 *
 * Requiere profile_id existente (del Form 1 o Form 2).
 * No crea usuarios ni consentimientos.
 * Solo crea un app_submission con los datos del formulario.
 *
 * app_id: "fisio" | "psico" | "nutricion" | "entrenamiento" | "logopedia" | …
 *
 * Cada app define su propio schema de campos en APP_SCHEMAS.
 * Los datos van al campo jsonb `data` de app_submissions.
 */

// ── Schemas por app ────────────────────────────────────────────────────────────
// Define qué campos muestra el formulario según la app.
// El UI usa esto para renderizar los campos dinámicamente.

export const APP_SCHEMAS = {
  fisio: {
    label: "Fisioterapia",
    fields: [
      { key: "motivo",        label: "Motivo de consulta",       type: "textarea", required: true },
      { key: "zona_afectada", label: "Zona afectada",            type: "text" },
      { key: "inicio_dolor",  label: "Inicio del dolor",         type: "date" },
      { key: "intensidad",    label: "Intensidad (1-10)",        type: "number", min: 1, max: 10 },
      { key: "cirugias",      label: "Cirugías previas",         type: "textarea" },
      { key: "medicacion",    label: "Medicación actual",        type: "textarea" },
    ],
  },
  psico: {
    label: "Psicología",
    fields: [
      { key: "motivo",        label: "Motivo de consulta",       type: "textarea", required: true },
      { key: "derivado_por",  label: "Derivado por",             type: "text" },
      { key: "tratamiento_previo", label: "Tratamiento previo",  type: "select",
        options: ["Nunca", "Sí, actualmente", "Sí, en el pasado"] },
      { key: "medicacion",    label: "Medicación actual",        type: "textarea" },
    ],
  },
  nutricion: {
    label: "Nutrición",
    fields: [
      { key: "objetivo",      label: "Objetivo principal",       type: "select",
        options: ["Pérdida de peso", "Ganancia muscular", "Salud general", "Patología específica"] },
      { key: "patologias",    label: "Patologías o alergias",    type: "textarea" },
      { key: "actividad",     label: "Actividad física",         type: "select",
        options: ["Sedentario", "Ligera", "Moderada", "Intensa"] },
      { key: "peso",          label: "Peso aproximado (kg)",     type: "number" },
      { key: "altura",        label: "Altura (cm)",              type: "number" },
    ],
  },
  entrenamiento: {
    label: "Entrenamiento",
    fields: [
      { key: "objetivo",      label: "Objetivo",                 type: "select",
        options: ["Fuerza", "Resistencia", "Pérdida de grasa", "Rehabilitación", "Otro"] },
      { key: "nivel",         label: "Nivel actual",             type: "select",
        options: ["Principiante", "Intermedio", "Avanzado"] },
      { key: "lesiones",      label: "Lesiones o limitaciones",  type: "textarea" },
      { key: "frecuencia",    label: "Días/semana disponibles",  type: "number", min: 1, max: 7 },
    ],
  },
  logopedia: {
    label: "Logopedia",
    fields: [
      { key: "motivo",        label: "Motivo de consulta",       type: "textarea", required: true },
      { key: "edad_inicio",   label: "Edad de inicio del problema", type: "text" },
      { key: "tratamiento_previo", label: "Tratamiento previo",  type: "select",
        options: ["No", "Sí"] },
      { key: "diagnostico",   label: "Diagnóstico previo",       type: "text" },
    ],
  },
};

/**
 * Envía un intake de app a Supabase.
 *
 * @param {object} config
 * @param {string} config.supabase_url
 * @param {string} config.supabase_publishable_key
 *
 * @param {object} submission
 * @param {string} submission.profile_id   — UUID del core_profile
 * @param {string} submission.app_id       — "fisio" | "psico" | …
 * @param {object} submission.data         — campos del formulario
 * @param {string} [submission.form_version]
 *
 * @returns {Promise<{ok, submission_id?, error?}>}
 */
export async function submitAppIntake(config, submission) {
  const { supabase_url, supabase_publishable_key } = config;
  const { profile_id, app_id, data, form_version } = submission;

  if (!profile_id) return { ok: false, error: "profile_id requerido." };
  if (!app_id)     return { ok: false, error: "app_id requerido." };
  if (!APP_SCHEMAS[app_id]) return { ok: false, error: `App desconocida: ${app_id}` };

  const res = await fetch(`${supabase_url}/rest/v1/app_submissions`, {
    method: "POST",
    headers: {
      "apikey":        supabase_publishable_key,
      "Authorization": `Bearer ${supabase_publishable_key}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
    },
    body: JSON.stringify({
      profile_id,
      app_id,
      data,
      form_version:  form_version || "1.0",
      status:        "pending",
      submitted_by:  "patient",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { ok: false, error: err?.message || "Error al enviar el formulario." };
  }

  const [record] = await res.json();
  return { ok: true, submission_id: record.id };
}

/**
 * Devuelve los campos a mostrar para una app concreta.
 * Útil para renderizar el formulario dinámicamente en el UI.
 *
 * @param {string} app_id
 * @returns {object|null}
 */
export function getAppSchema(app_id) {
  return APP_SCHEMAS[app_id] || null;
}
