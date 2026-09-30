-- Phase D1 OPTIONAL LOCAL CUTOVER DRAFT. NOT compatible with the deployed client.
-- Do not apply remotely. A future versioned client rollout needs separate approval.
begin;
-- Same lock order as RPC/rollback: control first, then Stories, then progress.
select singleton from public.bg3_progress_protocol_control where singleton for update;
lock table public.stories in share row exclusive mode;
lock table public.story_progress in access exclusive mode;

-- Drain legacy DML before enabling the new protocol. RLS/SELECT remain intact.
revoke insert, update, delete, truncate, trigger on public.story_progress
  from public, anon, authenticated;
do $block$
declare
  v_role text;
begin
  if not exists (select 1 from public.bg3_progress_protocol_control where singleton) then
    raise exception 'Missing progress protocol control';
  end if;
  -- REVOKE table DML alone does not close inherited roles or explicit column grants.
  -- Abort the whole cutover rather than advertise a bypassable protocol as enforced.
  foreach v_role in array array['authenticated', 'anon'] loop
    if pg_catalog.has_table_privilege(v_role, 'public.story_progress',
         'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
       or pg_catalog.has_any_column_privilege(v_role, 'public.story_progress', 'INSERT,UPDATE') then
      raise exception 'Unversioned progress privileges remain for %', v_role;
    end if;
  end loop;
  if not (select enforced from public.bg3_progress_protocol_control where singleton) then
    -- Invalidate every old base, including implicit revision 0 for an existing Story.
    -- Also invalidate bases retained across a read-only operational rollback.
    insert into public.bg3_story_progress_versions (story_id, revision)
    select id, 1 from public.stories
    on conflict (story_id) do update
      set revision = public.bg3_story_progress_versions.revision + 1;
    update public.bg3_progress_protocol_control set enforced = true where singleton;
  end if;
end;
$block$;
commit;
