# Patient Registration — Arquitectura

## Modelo de datos

```
core_profiles          — persona única, nunca se duplica
  ├── consents         — firmas RGPD (1+ por perfil)
  ├── app_submissions  — formularios enviados por app
  └── app_records      — historial clínico (solo staff)
```

## Estados de core_profiles.profile_status

| Estado              | Significado                                      |
|---------------------|--------------------------------------------------|
| `incomplete`        | Solo tiene consentimiento inicial (Form 1)       |
| `pending_validation`| Posible duplicado — staff debe revisar           |
| `active`            | Ficha completa y validada                        |

## Estados de app_submissions.status

| Estado     | Significado                      |
|------------|----------------------------------|
| `pending`  | Recién enviado, sin revisar      |
| `reviewed` | El profesional lo ha procesado   |
| `archived` | Archivado                        |

## registry_number

Formato: `REG-XXXXXX` (secuencial desde 100000).  
Generado automáticamente por la DB. Nunca se reutiliza.

## Flujo completo

```
FORM 1 — Consentimiento
  → crea core_profile (incomplete)
  → crea consent (consent_signed)
  → devuelve: profile_id, registry_number

FORM 2 — Matching
  → busca por phone
    ├── match_found      → carga profile existente
    ├── possible_match   → muestra "¿Es usted?" → staff confirma
    └── no_match         → crea profile (pending_validation)

FORM 3 — Intake por app
  → requiere profile_id
  → crea app_submission con data jsonb
  → el profesional lo revisa y crea app_record
```

## Apps disponibles

| app_id          | Especialidad       |
|-----------------|--------------------|
| `fisio`         | Fisioterapia       |
| `psico`         | Psicología         |
| `nutricion`     | Nutrición          |
| `entrenamiento` | Entrenamiento      |
| `logopedia`     | Logopedia          |

## Reglas RLS

| Tabla            | Anon          | Authenticated |
|------------------|---------------|---------------|
| core_profiles    | INSERT, SELECT| ALL           |
| consents         | INSERT        | ALL           |
| app_submissions  | INSERT        | ALL           |
| app_records      | —             | ALL           |

## Integración con core-general

- `core-general/src/intake/` → flujo genérico (cualquier sector)
- `clinica/patient-registration/` → implementación específica clínica
- El `profile_id` es el puente entre todas las apps del ecosistema
