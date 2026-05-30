/**
 * clinica · Form 1 — Consentimiento inicial
 *
 * Crea un core_profile mínimo + registro de consent.
 * status:         consent_signed
 * profile_status: incomplete
 * registry_number: REG-XXXXXX (generado por DB)
 *
 * Uso:
 *   import { submitConsent } from './form1-consent.js';
 *   const result = await submitConsent(config, formData);
 */

/**
 * @param {object} config
 * @param {string} config.supabase_url
 * @param {string} config.supabase_publishable_key
 *
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.surnames
 * @param {string} data.phone
 * @param {string} [data.email]
 * @param {string} [data.birth_date]   — "YYYY-MM-DD"
 * @param {boolean} data.rgpd          — checkbox RGPD
 * @param {boolean} data.privacy_policy — checkbox política
 * @param {string}  [data.signature]   — base64 de la firma
 *
 * @returns {Promise<{ok: boolean, profile_id?: string, registry_number?: string, error?: string}>}
 */
export async function submitConsent(config, data) {
  const { supabase_url, supabase_publishable_key } = config;
  const headers = {
    "apikey":        supabase_publishable_key,
    "Authorization": `Bearer ${supabase_publishable_key}`,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  };

  // Validación mínima
  if (!data.rgpd || !data.privacy_policy) {
    return { ok: false, error: "Debes aceptar el RGPD y la política de privacidad." };
  }

  try {
    // 1. Crear core_profile
    const profileRes = await fetch(`${supabase_url}/rest/v1/core_profiles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name:           data.name.trim(),
        surnames:       data.surnames.trim(),
        phone:          data.phone.trim(),
        email:          data.email?.trim() || null,
        birth_date:     data.birth_date || null,
        profile_status: "incomplete",
        created_by:     "form",
      }),
    });

    if (!profileRes.ok) {
      const err = await profileRes.json();
      return { ok: false, error: err?.message || "Error al crear el perfil." };
    }

    const [profile] = await profileRes.json();

    // 2. Crear consent
    const consentRes = await fetch(`${supabase_url}/rest/v1/consents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        profile_id:      profile.id,
        rgpd:            data.rgpd,
        privacy_policy:  data.privacy_policy,
        signature_data:  data.signature || null,
        status:          "consent_signed",
        user_agent:      navigator?.userAgent || null,
      }),
    });

    if (!consentRes.ok) {
      const err = await consentRes.json();
      return { ok: false, error: err?.message || "Error al guardar el consentimiento." };
    }

    return {
      ok:              true,
      profile_id:      profile.id,
      registry_number: profile.registry_number,
    };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}
