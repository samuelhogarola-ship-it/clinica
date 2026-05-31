-- ─────────────────────────────────────────────────────────────────────────────
-- clinica · matching
-- Función para buscar perfiles por teléfono (Form 2).
-- Devuelve: match_found | possible_match | no_match
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.find_profile(
  p_phone text,
  p_email text default null,
  p_name  text default null
)
returns jsonb language plpgsql security definer as $$
declare
  exact_match   public.core_profiles%rowtype;
  partial_match public.core_profiles%rowtype;
begin

  -- 1. Coincidencia exacta por teléfono
  select * into exact_match
  from public.core_profiles
  where phone = p_phone
  limit 1;

  if found then
    return jsonb_build_object(
      'result',     'match_found',
      'profile_id', exact_match.id,
      'registry',   exact_match.registry_number,
      'name',       exact_match.name || ' ' || exact_match.surnames,
      'status',     exact_match.profile_status
    );
  end if;

  -- 2. Coincidencia por email (si se proporciona)
  if p_email is not null then
    select * into partial_match
    from public.core_profiles
    where email = p_email
    limit 1;

    if found then
      return jsonb_build_object(
        'result',     'possible_match',
        'profile_id', partial_match.id,
        'registry',   partial_match.registry_number,
        'name',       partial_match.name || ' ' || partial_match.surnames,
        'status',     partial_match.profile_status,
        'match_by',   'email'
      );
    end if;
  end if;

  -- 3. Sin coincidencia
  return jsonb_build_object(
    'result', 'no_match'
  );

end;
$$;

-- Permite llamar a la función desde el frontend (anon)
grant execute on function public.find_profile to anon, authenticated;
