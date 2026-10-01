-- LOCAL DRAFT ONLY. Removing protocol state loses revision/receipt retry history.
-- Use rollback_002 for an operational rollback; never drop active protocol history.
begin;
select singleton from public.bg3_progress_protocol_control where singleton for update;
do $block$
begin
  if (select enforced from public.bg3_progress_protocol_control where singleton) then
    raise exception using errcode = '55000',
      message = 'Disable the protocol with rollback_002 before removing it';
  end if;
end;
$block$;
drop function public.bg3_mutate_progress_v1(uuid, bigint, uuid, jsonb);
drop function public.bg3_progress_snapshot_v1(uuid);
drop table public.bg3_story_progress_receipts;
drop table public.bg3_story_progress_versions;
drop table public.bg3_progress_protocol_control;
commit;
