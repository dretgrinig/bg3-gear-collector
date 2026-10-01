-- LOCAL D3A RPC removal only; not a whole-protocol operational rollback.
-- Use D1 rollback_002 for READ-ONLY safety mode across BOTH mutation endpoints.
-- Preserve progress, enforcement, revisions, all receipts and legacy grant revokes.
begin;
-- Drain active bulk/D1 mutation transactions before removing the bulk endpoint.
select singleton from public.bg3_progress_protocol_control where singleton for update;
drop function if exists public.bg3_bulk_progress_v1(uuid, bigint, uuid, text, jsonb);
-- Reinstalling the same 003 contract retains exact old-operation retry receipts.
-- Never reset history or restore direct INSERT/UPDATE/DELETE here.
commit;
