-- Operational rollback enters READ-ONLY progress safety mode.
-- Keep owner reads and all revision/receipt history; never restore legacy DML.
begin;
-- Same control -> Stories -> progress lock order as cutover and mutation RPCs.
-- Drain accepted RPCs/legacy transactions before changing the write boundary.
select singleton from public.bg3_progress_protocol_control where singleton for update;
lock table public.stories in share row exclusive mode;
lock table public.story_progress in access exclusive mode;

revoke insert, update, delete, truncate, trigger on public.story_progress
  from public, anon, authenticated;
do $block$
declare
  v_role text;
begin
  if not exists (select 1 from public.bg3_progress_protocol_control where singleton) then
    raise exception 'Missing progress protocol control';
  end if;
  -- Match cutover's effective privilege checks, including inherited/column grants.
  -- Abort rather than advertise a read-only mode with a remaining legacy bypass.
  foreach v_role in array array['authenticated', 'anon'] loop
    if pg_catalog.has_table_privilege(v_role, 'public.story_progress',
         'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
       or pg_catalog.has_any_column_privilege(v_role, 'public.story_progress', 'INSERT,UPDATE') then
      raise exception 'Unversioned progress privileges remain for %', v_role;
    end if;
  end loop;
  -- Every mutation RPC (including receipt retries) checks this locked flag and
  -- rejects with 55000. Keeping EXECUTE does not permit cached calls to bypass it.
  update public.bg3_progress_protocol_control set enforced = false where singleton;
end;
$block$;
commit;
