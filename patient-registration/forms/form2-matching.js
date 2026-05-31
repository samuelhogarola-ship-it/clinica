/**
 * clinica · Form 2 — Ficha clínica / Matching
 *
 * Flujo:
 *   1. Pregunta si el paciente ya ha venido antes
 *   2a. "Sí" → busca por phone → match_found → carga profile
 *   2b. "No" → busca por phone+email → possible_match o no_match
 *   3. Si no_match → crea profile con profile_status = pending_validation
 *
 * Resultados posibles:
 *   { result: "match_found",     profile_id, registry_number, name }
 *   { result: "possible_match",  profile_id, registry_number, name, match_by }
 *   { result: "no_match" }
 *   { result: "created",         profile_id, registry_number }
 */

/**
 * Busca un perfil por teléfono (y opcionalmente email).
 * Llama a la función RPC find_profile de Supabase.
 *
 * @param {object} config
 * @param {string} phone
 * @param {string} [email]
 * @param {string} [name]
 * @returns {Promise<object>}
 */
export async function findProfile(config, phone, email = null, name = null) {
  const { supabase_url, supabase_publishable_key } = config;

  const res = await fetch(`${supabase_url}/rest/v1/rpc/find_profile`, {
    method: "POST",
    headers: {
      "apikey":        supabase_publishable_key,
      "Authorization": `Bearer ${supabase_publishable_key}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ p_phone: phone, p_email: email, p_name: name }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.message || "Error en la búsqueda.");
  }

  return res.json(); // { result, profile_id?, registry_number?, name?, match_by? }
}

/**
 * Crea un perfil nuevo con status pending_validation.
 * Se usa cuando el matching no encuentra ninguna coincidencia.
 *
 * @param {object} config
 * @param {object} data — { name, surnames, phone, email }
 * @returns {Promise<{ok, profile_id?, registry_number?, error?}>}
 */
export async function createPendingProfile(config, data) {
  const { supabase_url, supabase_publishable_key } = config;

  const res = await fetch(`${supabase_url}/rest/v1/core_profiles`, {
    method: "POST",
    headers: {
      "apikey":        supabase_publishable_key,
      "Authorization": `Bearer ${supabase_publishable_key}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
    },
    body: JSON.stringify({
      name:           data.name.trim(),
      surnames:       data.surnames.trim(),
      phone:          data.phone.trim(),
      email:          data.email?.trim() || null,
      profile_status: "pending_validation",
      created_by:     "form",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { ok: false, error: err?.message || "Error al crear el perfil." };
  }

  const [profile] = await res.json();
  return {
    ok:              true,
    profile_id:      profile.id,
    registry_number: profile.registry_number,
    result:          "created",
  };
}

/**
 * Flujo completo del Form 2.
 * Llama a esto desde el UI pasando las respuestas del formulario.
 *
 * @param {object} config
 * @param {object} answers
 * @param {boolean} answers.been_before   — "¿Ya has venido antes?"
 * @param {string}  answers.phone
 * @param {string}  [answers.email]
 * @param {string}  [answers.name]
 * @param {string}  [answers.surnames]
 * @returns {Promise<object>}
 */
export async function runMatchingFlow(config, answers) {
  const { been_before, phone, email, name, surnames } = answers;

  // Paso 1: buscar por teléfono siempre
  const match = await findProfile(config, phone, email, name);

  if (match.result === "match_found") {
    return match; // UI carga el perfil directamente
  }

  if (match.result === "possible_match") {
    return match; // UI muestra "¿Es usted?" y espera confirmación del staff
  }

  // Sin coincidencia
  if (been_before) {
    // Paciente dice que ha venido antes pero no encontramos su registro
    // → devolvemos no_match para que el staff busque manualmente
    return { result: "no_match", been_before: true };
  }

  // Paciente nuevo → crear perfil pending_validation
  if (!name || !surnames) {
    return { result: "no_match", error: "Se necesita nombre y apellidos para crear el perfil." };
  }

  return createPendingProfile(config, { name, surnames, phone, email });
}
