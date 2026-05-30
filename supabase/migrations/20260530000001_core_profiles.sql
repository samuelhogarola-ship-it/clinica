-- ─────────────────────────────────────────────────────────────────────────────
-- clinica · patient-registration
-- Schema principal: core_profiles, consents, app_submissions, app_records
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ── SEQUENCE para registry_number ────────────────────────────────────────────
create sequence if not exists public.registry_seq start 100000;

create or replace function public.next_registry_number()
returns text language sql as $$
  select 'REG-' || lpad(nextval('public.registry_seq')::text, 6, '0');
$$;

-- ── CORE_PROFILES ─────────────────────────────────────────────────────────────
-- Un registro único por persona. Nunca se duplica.

create table if not exists public.core_profiles (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  registry_number  text unique not null default public.next_registry_number(),

  -- Datos personales
  name             text not null,
  surnames         text not null,
  phone            text not null,                -- clave de matching
  email            text,
  birth_date       date,

  -- Estado del perfil
  profile_status   text not null default 'incomplete',
  -- incomplete         → solo tiene consentimiento inicial
  -- pending_validation → posible duplicado, staff debe revisar
  -- active             → ficha clínica completa y validada

  -- Meta
  notes            text,
  created_by       text default 'form'           -- 'form' | 'staff' | 'import'
);

alter table public.core_profiles enable row level security;
revoke all on public.core_profiles from anon, authenticated;

-- Anon puede insertar y buscar por phone (para el matching del Form 2)
grant insert on public.core_profiles to anon;
grant select on public.core_profiles to anon;

-- Staff tiene acceso completo
grant all on public.core_profiles to authenticated;

create policy "anon_insert_profile"
  on public.core_profiles for insert to anon with check (true);

create policy "anon_select_for_matching"
  on public.core_profiles for select to anon
  using (true);  -- RLS más estricta en producción: filtrar por phone

create policy "authenticated_all"
  on public.core_profiles for all to authenticated using (true);

-- Índices de matching
create index if not exists idx_profiles_phone on public.core_profiles (phone);
create index if not exists idx_profiles_email on public.core_profiles (email);
create index if not exists idx_profiles_status on public.core_profiles (profile_status);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger core_profiles_updated_at
  before update on public.core_profiles
  for each row execute procedure public.set_updated_at();

-- ── CONSENTS ──────────────────────────────────────────────────────────────────
-- Firma RGPD y política de privacidad. Un perfil puede tener varios
-- (renovaciones, actualizaciones de política).

create table if not exists public.consents (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references public.core_profiles(id),

  -- Checkboxes legales
  rgpd             boolean not null default false,
  privacy_policy   boolean not null default false,

  -- Firma
  signature_url    text,        -- URL a imagen en Supabase Storage
  signature_data   text,        -- base64 opcional (firma tablet)
  signed_at        timestamptz not null default now(),

  -- Estado
  status           text not null default 'consent_signed',
  -- consent_signed | revoked | expired

  -- Meta
  ip_address       text,
  user_agent       text
);

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;

grant insert on public.consents to anon;
grant all on public.consents to authenticated;

create policy "anon_insert_consent"
  on public.consents for insert to anon with check (true);

create policy "authenticated_all_consents"
  on public.consents for all to authenticated using (true);

create index if not exists idx_consents_profile on public.consents (profile_id);

-- ── APP_SUBMISSIONS ───────────────────────────────────────────────────────────
-- Cada vez que un paciente envía un formulario de una app específica.
-- app_id: "fisio" | "psico" | "nutricion" | "entrenamiento" | "logopedia"

create table if not exists public.app_submissions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references public.core_profiles(id),

  app_id           text not null,   -- "fisio", "psico", "nutricion"…
  form_version     text,            -- versión del formulario usado
  status           text not null default 'pending',
  -- pending | reviewed | archived

  -- Datos del formulario (estructura libre por app)
  data             jsonb not null default '{}'::jsonb,

  -- Meta
  submitted_by     text default 'patient',  -- 'patient' | 'staff'
  notes            text
);

alter table public.app_submissions enable row level security;
revoke all on public.app_submissions from anon, authenticated;

grant insert on public.app_submissions to anon;
grant all on public.app_submissions to authenticated;

create policy "anon_insert_submission"
  on public.app_submissions for insert to anon with check (true);

create policy "authenticated_all_submissions"
  on public.app_submissions for all to authenticated using (true);

create index if not exists idx_submissions_profile on public.app_submissions (profile_id);
create index if not exists idx_submissions_app    on public.app_submissions (app_id);
create index if not exists idx_submissions_status on public.app_submissions (status);

-- ── APP_RECORDS ───────────────────────────────────────────────────────────────
-- Historial clínico u operativo. Solo staff puede crear registros aquí.

create table if not exists public.app_records (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references public.core_profiles(id),

  app_id           text not null,
  record_type      text not null,   -- "session", "diagnosis", "note", "prescription"…
  submission_id    uuid references public.app_submissions(id),

  data             jsonb not null default '{}'::jsonb,
  created_by       text not null,   -- email/id del profesional

  -- Control de versiones simple
  version          int not null default 1
);

alter table public.app_records enable row level security;
revoke all on public.app_records from anon, authenticated;

-- Solo authenticated (staff/profesionales) pueden crear y leer registros
grant all on public.app_records to authenticated;

create policy "authenticated_all_records"
  on public.app_records for all to authenticated using (true);

create index if not exists idx_records_profile on public.app_records (profile_id);
create index if not exists idx_records_app     on public.app_records (app_id);
