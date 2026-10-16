-- Post-migration privilege checks (run after supabase db reset in CI).
\set ON_ERROR_STOP on

do $$
begin
  if has_column_privilege('authenticated', 'public.appointments', 'secure_token_hash', 'SELECT') then
    raise exception 'authenticated must not have SELECT on appointments.secure_token_hash';
  end if;

  if has_column_privilege('authenticated', 'public.appointments', 'secure_token_hash', 'UPDATE') then
    raise exception 'authenticated must not have UPDATE on appointments.secure_token_hash';
  end if;

  if has_column_privilege('authenticated', 'public.appointments', 'id', 'SELECT') then
    raise notice 'authenticated has SELECT on appointments.id (expected)';
  else
    raise exception 'authenticated must have SELECT on appointments.id';
  end if;

  if has_table_privilege('authenticated', 'public.appointments', 'INSERT') then
    raise exception 'authenticated must not have INSERT on appointments (booking uses service_role)';
  end if;

  if has_table_privilege('authenticated', 'public.appointment_events', 'DELETE') then
    raise exception 'authenticated must not have DELETE on appointment_events (append-only)';
  end if;

  if has_table_privilege('authenticated', 'public.appointment_events', 'INSERT')
     and has_table_privilege('authenticated', 'public.appointment_events', 'SELECT') then
    raise notice 'appointment_events grants OK for authenticated';
  else
    raise exception 'authenticated needs SELECT and INSERT on appointment_events only';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'anon must not have USAGE on schema private';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'authenticated needs USAGE on schema private for policy helpers';
  end if;

  if has_function_privilege(
    'authenticated',
    'private.is_org_member(uuid)',
    'EXECUTE'
  ) then
    raise notice 'private helper execute grants OK';
  else
    raise exception 'authenticated must EXECUTE private.is_org_member';
  end if;
end
$$;
