-- Phase D3A LOCAL DRAFT ONLY. Do not apply to a shared/production Supabase project.
-- Requires D1 001. Adds one RPC only: no table, policy, legacy-grant or cutover changes.
-- D1's existing enforcement flag controls both mutation endpoints.
begin;
-- Drain accepted RPCs before installing/replacing this version's definition.
-- Do not advance revisions, discard receipts or enable enforcement here.
select singleton from public.bg3_progress_protocol_control where singleton for update;

create or replace function public.bg3_bulk_progress_v1(
  p_story_id uuid, p_expected_revision bigint, p_operation_id uuid,
  p_mode text, p_records jsonb
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
  v_record jsonb;
  v_client_timestamp timestamptz;
  v_server_timestamp timestamptz := pg_catalog.statement_timestamp();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;

  -- Match D1 lock order: control first, then the explicitly owned parent Story.
  -- Cutover/read-only rollback take this control row FOR UPDATE and drain us.
  select c.enforced into v_enforced
  from public.bg3_progress_protocol_control c where c.singleton for share;
  if v_enforced is distinct from true then
    raise exception using errcode = '55000', message = 'Progress protocol is not enforced';
  end if;

  -- Ownership is checked before exposing any revision or operation receipt.
  -- The parent lock also serializes absent-row inserts through the D1 endpoint.
  perform s.id from public.stories s
  where s.id = p_story_id and s.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Authenticated Story owner required';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 or p_operation_id is null then
    raise exception using errcode = '22023', message = 'Expected revision and operation ID required';
  end if;
  if p_mode is null or p_mode not in ('reset', 'replace') then
    raise exception using errcode = '22023', message = 'Bulk mode must be reset or replace';
  end if;
  if p_records is null or pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Records must be an array';
  end if;
  -- Bounds apply to supplied input, never the number of authoritative stored rows.
  -- Empty reset/replacement is intentional and still advances the Story revision.
  if pg_catalog.jsonb_array_length(p_records) > 5000
     or pg_catalog.octet_length(p_records::text) > 1048576 then
    raise exception using errcode = '22023', message = 'Records exceed protocol bounds';
  end if;
  if p_mode = 'reset' and pg_catalog.jsonb_array_length(p_records) <> 0 then
    raise exception using errcode = '22023', message = 'Reset must have an empty records array';
  end if;

  -- Validate EVERY supplied row before clearing or writing any progress.
  -- Row shape and canonical-key/timestamp rules deliberately match D1.
  for v_record in select value from pg_catalog.jsonb_array_elements(p_records) loop
    if pg_catalog.jsonb_typeof(v_record) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Invalid progress row';
    end if;
    if pg_catalog.jsonb_typeof(v_record->'item_key') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_record->'status') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_record->'client_updated_at') is distinct from 'string'
       or exists (select 1 from pg_catalog.jsonb_object_keys(v_record) as fields(field_name)
                  where field_name not in ('item_key', 'status', 'client_updated_at')) then
      raise exception using errcode = '22023', message = 'Invalid progress row';
    end if;
    if pg_catalog.char_length(v_record->>'item_key') not between 1 and 512
       or v_record->>'item_key' <> pg_catalog.btrim(v_record->>'item_key')
       or v_record->>'item_key' <> pg_catalog.lower(v_record->>'item_key')
       or v_record->>'status' not in ('found', 'todo', 'skipped') then
      raise exception using errcode = '22023', message = 'Invalid item key or status';
    end if;
    begin
      v_client_timestamp := (v_record->>'client_updated_at')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'Invalid client timestamp';
    end;
    if not pg_catalog.isfinite(v_client_timestamp) then
      raise exception using errcode = '22023', message = 'Client timestamp must be finite';
    end if;
  end loop;
  if (select count(*) <> count(distinct value->>'item_key')
      from pg_catalog.jsonb_array_elements(p_records)) then
    raise exception using errcode = '22023', message = 'Duplicate item keys';
  end if;

  -- Share D1's Story/UUID namespace, but bind identity to RPC/version AND mode.
  -- Either endpoint rejects UUID reuse for a different request, including v1 D1
  -- requests lacking these discriminators. Existing receipts need no rewrite.
  v_request := pg_catalog.jsonb_build_object(
    'rpc', 'bg3_bulk_progress_v1', 'version', 1, 'mode', p_mode,
    'expected_revision', p_expected_revision::text, 'records', p_records
  );
  select r.* into v_receipt from public.bg3_story_progress_receipts r
  where r.story_id = p_story_id and r.operation_id = p_operation_id;
  if found then
    if v_receipt.user_id <> v_user_id or v_receipt.request <> v_request then
      raise exception using errcode = '22023', message = 'Operation ID already identifies another request';
    end if;
    -- Return the ORIGINAL acknowledgement, not today's snapshot; never replay DML.
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

  -- Derive clearing from the database under the Story lock, not a client catalogue
  -- or cache. Keep omitted/cloud-only/skipped rows as explicit todo tombstones.
  -- Reset's validated [] excludes no keys; replace excludes its supplied keys.
  update public.story_progress p
  set status = 'todo', client_updated_at = v_server_timestamp, updated_at = v_server_timestamp
  where p.story_id = p_story_id
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
      where incoming.value->>'item_key' = p.item_key
    );

  for v_record in select value from pg_catalog.jsonb_array_elements(p_records) loop
    insert into public.story_progress (story_id, item_key, status, client_updated_at, updated_at)
    values (p_story_id, v_record->>'item_key', v_record->>'status',
            (v_record->>'client_updated_at')::timestamptz, v_server_timestamp)
    on conflict (story_id, item_key) do update
      set status = excluded.status, client_updated_at = excluded.client_updated_at,
          updated_at = excluded.updated_at;
  end loop;

  -- Revision is the ONLY concurrency authority. Client clocks are metadata.
  -- This advances once even when there were zero stored/supplied records.
  update public.bg3_story_progress_versions set revision = revision + 1
  where story_id = p_story_id returning revision into v_revision;
  v_result := pg_catalog.jsonb_build_object(
    'outcome', 'applied', 'story_id', p_story_id,
    'operation_id', p_operation_id, 'revision', v_revision::text
  );
  insert into public.bg3_story_progress_receipts (story_id, operation_id, user_id, request, result)
  values (p_story_id, p_operation_id, v_user_id, v_request, v_result);
  -- No handler swallows mutation errors: tombstones, imports, revision and receipt
  -- commit together or all roll back, including on trigger/overflow failures.
  return v_result;
end;
$function$;

-- Use a trusted migration owner. Browser roles may execute, never own this definer.
-- Close default PUBLIC/default Supabase function grants before this transaction commits.
revoke all on function public.bg3_bulk_progress_v1(uuid, bigint, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.bg3_bulk_progress_v1(uuid, bigint, uuid, text, jsonb)
  to authenticated;
commit;
