alter table public.app_submissions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;
