-- Phase D1 LOCAL DRAFT. Do not apply to the shared/production Supabase project.
-- Additive preparation only: existing tables, policies and grants stay unchanged.
-- The mutation RPC is disabled until the separately reviewed 002 cutover.
begin;

create table if not exists public.bg3_progress_protocol_control (
  singleton boolean primary key default true check (singleton),
  enforced boolean not null default false
);
insert into public.bg3_progress_protocol_control (singleton, enforced)
values (true, false) on conflict (singleton) do nothing;

-- Separate state avoids exposing a new revision through existing Stories grants.
create table if not exists public.bg3_story_progress_versions (
  story_id uuid primary key references public.stories(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
create table if not exists public.bg3_story_progress_receipts (
  story_id uuid not null references public.stories(id) on delete cascade,
  operation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (story_id, operation_id)
);

alter table public.bg3_progress_protocol_control enable row level security;
alter table public.bg3_story_progress_versions enable row level security;
alter table public.bg3_story_progress_receipts enable row level security;
-- Explicit revokes also close any Supabase default table grants. No client policies.
revoke all on table public.bg3_progress_protocol_control,
  public.bg3_story_progress_versions, public.bg3_story_progress_receipts
  from public, anon, authenticated;

create or replace function public.bg3_progress_snapshot_v1(p_story_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;
  -- Ownership, version, capability and all rows share ONE MVCC statement snapshot.
  select pg_catalog.jsonb_build_object(
    'story_id', s.id,
    'revision', coalesce(v.revision, 0)::text,
    'protocol_enforced', c.enforced,
    'records', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'item_key', p.item_key, 'status', p.status,
        'client_updated_at', p.client_updated_at, 'updated_at', p.updated_at
      ) order by p.item_key)
      from public.story_progress p where p.story_id = s.id
    ), '[]'::jsonb)
  ) into v_snapshot
  from public.stories s
  cross join public.bg3_progress_protocol_control c
  left join public.bg3_story_progress_versions v on v.story_id = s.id
  where s.id = p_story_id and s.user_id = v_user_id and c.singleton;

  if v_snapshot is null then
    -- Same response for absent and foreign Stories; never disclose a foreign revision.
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;
  return v_snapshot;
end;
$function$;

create or replace function public.bg3_mutate_progress_v1(
  p_story_id uuid, p_expected_revision bigint, p_operation_id uuid, p_changes jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_enforced boolean;
  v_revision bigint;
  v_request jsonb;
  v_receipt public.bg3_story_progress_receipts%rowtype;
  v_change jsonb;
  v_client_timestamp timestamptz;
  v_server_timestamp timestamptz := pg_catalog.statement_timestamp();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;

  -- Cutover/rollback take this row FOR UPDATE and therefore drain every RPC first.
  select c.enforced into v_enforced
  from public.bg3_progress_protocol_control c where c.singleton for share;
  if v_enforced is distinct from true then
    raise exception using errcode = '55000', message = 'Progress protocol is not enforced';
  end if;

  -- One parent lock serializes both existing-row updates and absent-row inserts.
  -- Check ownership BEFORE revealing any receipt or expected-revision conflict.
  perform s.id from public.stories s
  where s.id = p_story_id and s.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 or p_operation_id is null then
    raise exception using errcode = '22023', message = 'Expected revision and operation ID required';
  end if;
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Changes must be an array';
  end if;
  if pg_catalog.jsonb_array_length(p_changes) not between 1 and 5000
     or pg_catalog.octet_length(p_changes::text) > 1048576 then
    raise exception using errcode = '22023', message = 'Changes exceed protocol bounds';
  end if;

  -- Validate the entire batch before touching progress. Unknown fields are rejected.
  for v_change in select value from pg_catalog.jsonb_array_elements(p_changes) loop
    if pg_catalog.jsonb_typeof(v_change) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Invalid progress row';
    end if;
    if pg_catalog.jsonb_typeof(v_change->'item_key') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_change->'status') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_change->'client_updated_at') is distinct from 'string'
       or exists (select 1 from pg_catalog.jsonb_object_keys(v_change) as fields(field_name)
                  where field_name not in ('item_key', 'status', 'client_updated_at')) then
      raise exception using errcode = '22023', message = 'Invalid progress row fields';
    end if;
    if pg_catalog.char_length(v_change->>'item_key') not between 1 and 512
       or v_change->>'item_key' <> pg_catalog.btrim(v_change->>'item_key')
       or v_change->>'item_key' <> pg_catalog.lower(v_change->>'item_key')
       or v_change->>'status' not in ('found', 'todo', 'skipped') then
      raise exception using errcode = '22023', message = 'Invalid item key or status';
    end if;
    begin
      v_client_timestamp := (v_change->>'client_updated_at')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'Invalid client timestamp';
    end;
    if not pg_catalog.isfinite(v_client_timestamp) then
      raise exception using errcode = '22023', message = 'Client timestamp must be finite';
    end if;
  end loop;
  if (select count(distinct value->>'item_key')
      from pg_catalog.jsonb_array_elements(p_changes)) <> pg_catalog.jsonb_array_length(p_changes) then
    raise exception using errcode = '22023', message = 'Duplicate item keys';
  end if;

  -- JSONB equality ignores object-key order; batch order remains part of the intent.
  v_request := pg_catalog.jsonb_build_object(
    'expected_revision', p_expected_revision::text, 'changes', p_changes
  );
  select r.* into v_receipt from public.bg3_story_progress_receipts r
  where r.story_id = p_story_id and r.operation_id = p_operation_id;
  if found then
    if v_receipt.user_id <> v_user_id or v_receipt.request <> v_request then
      raise exception using errcode = '22023', message = 'Operation ID already identifies another request';
    end if;
    -- Recheck after taking the parent lock; concurrent retries see the first receipt.
    -- Even after newer operations, return the ORIGINAL acknowledgement without DML.
    return v_receipt.result;
  end if;

  select v.revision into v_revision from public.bg3_story_progress_versions v
  where v.story_id = p_story_id;
  v_revision := coalesce(v_revision, 0);
  if p_expected_revision <> v_revision then
    return pg_catalog.jsonb_build_object(
      'outcome', 'conflict', 'story_id', p_story_id, 'revision', v_revision::text
    );
  end if;

  insert into public.bg3_story_progress_versions (story_id, revision)
  values (p_story_id, 0) on conflict (story_id) do nothing;
  for v_change in select value from pg_catalog.jsonb_array_elements(p_changes) loop
    insert into public.story_progress (story_id, item_key, status, client_updated_at, updated_at)
    values (p_story_id, v_change->>'item_key', v_change->>'status',
            (v_change->>'client_updated_at')::timestamptz, v_server_timestamp)
    on conflict (story_id, item_key) do update
    set status = excluded.status, client_updated_at = excluded.client_updated_at,
        updated_at = excluded.updated_at;
  end loop;
  update public.bg3_story_progress_versions set revision = revision + 1
  where story_id = p_story_id returning revision into v_revision;
  v_result := pg_catalog.jsonb_build_object(
    'outcome', 'applied', 'story_id', p_story_id,
    'operation_id', p_operation_id, 'revision', v_revision::text
  );
  insert into public.bg3_story_progress_receipts
    (story_id, operation_id, user_id, request, result)
  values (p_story_id, p_operation_id, v_user_id, v_request, v_result);
  -- No exception handler swallows failures: all rows, revision and receipt roll back.
  return v_result;
end;
$function$;

-- Definer functions must be owned by a trusted migration role, never a browser role.
-- Revoke default PUBLIC execution within the same transaction as function creation.
revoke all on function public.bg3_progress_snapshot_v1(uuid) from public, anon, authenticated;
revoke all on function public.bg3_mutate_progress_v1(uuid, bigint, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.bg3_progress_snapshot_v1(uuid) to authenticated;
grant execute on function public.bg3_mutate_progress_v1(uuid, bigint, uuid, jsonb) to authenticated;
commit;
