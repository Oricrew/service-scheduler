-- Enable RLS and least-privilege grants on public application tables.
-- Server-side flows use service_role (bypasses RLS). Authenticated dashboard
-- auth reads organization_members via the user session; all other app queries
-- use the admin client today. Policies below enforce org isolation for direct
-- PostgREST access (defense in depth).

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids recursive RLS on organization_members)
-- ---------------------------------------------------------------------------

create or replace function public.org_role_rank(role public.user_role)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case role
    when 'technician'::public.user_role then 1
    when 'supervisor'::public.user_role then 2
    when 'admin'::public.user_role then 3
  end;
$$;

alter function public.org_role_rank(public.user_role) owner to postgres;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
  );
$$;

alter function public.is_org_member(uuid) owner to postgres;

create or replace function public.has_minimum_org_role(
  p_organization_id uuid,
  p_required_role public.user_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and public.org_role_rank(om.role) >= public.org_role_rank(p_required_role)
  );
$$;

alter function public.has_minimum_org_role(uuid, public.user_role) owner to postgres;

create or replace function public.is_appointment_in_member_org(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    where a.id = p_appointment_id
      and public.is_org_member(a.organization_id)
  );
$$;

alter function public.is_appointment_in_member_org(uuid) owner to postgres;

create or replace function public.client_belongs_to_org(
  p_client_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.organization_id = p_organization_id
  );
$$;

alter function public.client_belongs_to_org(uuid, uuid) owner to postgres;

create or replace function public.service_belongs_to_org(
  p_service_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.services s
    where s.id = p_service_id
      and s.organization_id = p_organization_id
  );
$$;

alter function public.service_belongs_to_org(uuid, uuid) owner to postgres;

create or replace function public.technician_belongs_to_org(
  p_technician_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.technicians t
    where t.id = p_technician_id
      and t.organization_id = p_organization_id
  );
$$;

alter function public.technician_belongs_to_org(uuid, uuid) owner to postgres;

revoke all on function public.org_role_rank(public.user_role) from public;
revoke execute on function public.org_role_rank(public.user_role) from anon;
grant execute on function public.org_role_rank(public.user_role) to authenticated;

revoke all on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_member(uuid) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke all on function public.has_minimum_org_role(uuid, public.user_role) from public;
revoke execute on function public.has_minimum_org_role(uuid, public.user_role) from anon;
grant execute on function public.has_minimum_org_role(uuid, public.user_role) to authenticated;

revoke all on function public.is_appointment_in_member_org(uuid) from public;
revoke execute on function public.is_appointment_in_member_org(uuid) from anon;
grant execute on function public.is_appointment_in_member_org(uuid) to authenticated;

revoke all on function public.client_belongs_to_org(uuid, uuid) from public;
revoke execute on function public.client_belongs_to_org(uuid, uuid) from anon;
grant execute on function public.client_belongs_to_org(uuid, uuid) to authenticated;

revoke all on function public.service_belongs_to_org(uuid, uuid) from public;
revoke execute on function public.service_belongs_to_org(uuid, uuid) from anon;
grant execute on function public.service_belongs_to_org(uuid, uuid) to authenticated;

revoke all on function public.technician_belongs_to_org(uuid, uuid) from public;
revoke execute on function public.technician_belongs_to_org(uuid, uuid) from anon;
grant execute on function public.technician_belongs_to_org(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
  on public.organizations
  for update
  to authenticated
  using (public.has_minimum_org_role(id, 'admin'::public.user_role))
  with check (public.has_minimum_org_role(id, 'admin'::public.user_role));

revoke all on table public.organizations from public, anon, authenticated;
grant select on table public.organizations to authenticated;
grant update (name, timezone, default_locale) on table public.organizations to authenticated;
grant all on table public.organizations to service_role;

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------

alter table public.organization_members enable row level security;

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member
  on public.organization_members
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists organization_members_insert_admin on public.organization_members;
create policy organization_members_insert_admin
  on public.organization_members
  for insert
  to authenticated
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists organization_members_update_admin on public.organization_members;
create policy organization_members_update_admin
  on public.organization_members
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role))
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists organization_members_delete_admin on public.organization_members;
create policy organization_members_delete_admin
  on public.organization_members
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.organization_members from public, anon, authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant all on table public.organization_members to service_role;

-- ---------------------------------------------------------------------------
-- technicians
-- ---------------------------------------------------------------------------

alter table public.technicians enable row level security;

drop policy if exists technicians_select_member on public.technicians;
create policy technicians_select_member
  on public.technicians
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists technicians_insert_supervisor on public.technicians;
create policy technicians_insert_supervisor
  on public.technicians
  for insert
  to authenticated
  with check (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role));

drop policy if exists technicians_update_supervisor on public.technicians;
create policy technicians_update_supervisor
  on public.technicians
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role))
  with check (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role));

drop policy if exists technicians_delete_admin on public.technicians;
create policy technicians_delete_admin
  on public.technicians
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.technicians from public, anon, authenticated;
grant select, insert, update, delete on table public.technicians to authenticated;
grant all on table public.technicians to service_role;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;

drop policy if exists clients_select_member on public.clients;
create policy clients_select_member
  on public.clients
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists clients_insert_supervisor on public.clients;
create policy clients_insert_supervisor
  on public.clients
  for insert
  to authenticated
  with check (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role));

drop policy if exists clients_update_supervisor on public.clients;
create policy clients_update_supervisor
  on public.clients
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role))
  with check (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role));

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin
  on public.clients
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.clients from public, anon, authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant all on table public.clients to service_role;

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

alter table public.services enable row level security;

drop policy if exists services_select_member on public.services;
create policy services_select_member
  on public.services
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists services_insert_admin on public.services;
create policy services_insert_admin
  on public.services
  for insert
  to authenticated
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists services_update_admin on public.services;
create policy services_update_admin
  on public.services
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role))
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists services_delete_admin on public.services;
create policy services_delete_admin
  on public.services
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.services from public, anon, authenticated;
grant select, insert, update, delete on table public.services to authenticated;
grant all on table public.services to service_role;

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;

drop policy if exists appointments_select_member on public.appointments;
create policy appointments_select_member
  on public.appointments
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists appointments_insert_supervisor on public.appointments;
create policy appointments_insert_supervisor
  on public.appointments
  for insert
  to authenticated
  with check (
    public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role)
    and public.client_belongs_to_org(client_id, organization_id)
    and public.service_belongs_to_org(service_id, organization_id)
  );

drop policy if exists appointments_update_supervisor on public.appointments;
create policy appointments_update_supervisor
  on public.appointments
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role))
  with check (
    public.has_minimum_org_role(organization_id, 'supervisor'::public.user_role)
    and public.client_belongs_to_org(client_id, organization_id)
    and public.service_belongs_to_org(service_id, organization_id)
  );

drop policy if exists appointments_delete_admin on public.appointments;
create policy appointments_delete_admin
  on public.appointments
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.appointments from public, anon, authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;
revoke select (secure_token_hash) on table public.appointments from authenticated;
revoke update (secure_token_hash) on table public.appointments from authenticated;
grant all on table public.appointments to service_role;

-- ---------------------------------------------------------------------------
-- appointment_technicians
-- ---------------------------------------------------------------------------

alter table public.appointment_technicians enable row level security;

drop policy if exists appointment_technicians_select_member on public.appointment_technicians;
create policy appointment_technicians_select_member
  on public.appointment_technicians
  for select
  to authenticated
  using (public.is_appointment_in_member_org(appointment_id));

drop policy if exists appointment_technicians_insert_supervisor on public.appointment_technicians;
create policy appointment_technicians_insert_supervisor
  on public.appointment_technicians
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'supervisor'::public.user_role)
        and public.technician_belongs_to_org(technician_id, a.organization_id)
    )
  );

drop policy if exists appointment_technicians_update_supervisor on public.appointment_technicians;
create policy appointment_technicians_update_supervisor
  on public.appointment_technicians
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'supervisor'::public.user_role)
    )
  )
  with check (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'supervisor'::public.user_role)
        and public.technician_belongs_to_org(technician_id, a.organization_id)
    )
  );

drop policy if exists appointment_technicians_delete_supervisor on public.appointment_technicians;
create policy appointment_technicians_delete_supervisor
  on public.appointment_technicians
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'supervisor'::public.user_role)
    )
  );

revoke all on table public.appointment_technicians from public, anon, authenticated;
grant select, insert, update, delete on table public.appointment_technicians to authenticated;
grant all on table public.appointment_technicians to service_role;

-- ---------------------------------------------------------------------------
-- appointment_events
-- ---------------------------------------------------------------------------

alter table public.appointment_events enable row level security;

drop policy if exists appointment_events_select_member on public.appointment_events;
create policy appointment_events_select_member
  on public.appointment_events
  for select
  to authenticated
  using (public.is_appointment_in_member_org(appointment_id));

drop policy if exists appointment_events_insert_supervisor on public.appointment_events;
create policy appointment_events_insert_supervisor
  on public.appointment_events
  for insert
  to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'supervisor'::public.user_role)
    )
  );

drop policy if exists appointment_events_delete_admin on public.appointment_events;
create policy appointment_events_delete_admin
  on public.appointment_events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and public.has_minimum_org_role(a.organization_id, 'admin'::public.user_role)
    )
  );

revoke all on table public.appointment_events from public, anon, authenticated;
grant select, insert, delete on table public.appointment_events to authenticated;
grant all on table public.appointment_events to service_role;

-- ---------------------------------------------------------------------------
-- company_settings
-- ---------------------------------------------------------------------------

alter table public.company_settings enable row level security;

drop policy if exists company_settings_select_member on public.company_settings;
create policy company_settings_select_member
  on public.company_settings
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists company_settings_insert_admin on public.company_settings;
create policy company_settings_insert_admin
  on public.company_settings
  for insert
  to authenticated
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists company_settings_update_admin on public.company_settings;
create policy company_settings_update_admin
  on public.company_settings
  for update
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role))
  with check (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

drop policy if exists company_settings_delete_admin on public.company_settings;
create policy company_settings_delete_admin
  on public.company_settings
  for delete
  to authenticated
  using (public.has_minimum_org_role(organization_id, 'admin'::public.user_role));

revoke all on table public.company_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.company_settings to authenticated;
grant all on table public.company_settings to service_role;
