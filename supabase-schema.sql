-- BG3 Gear Collector v7 CLOUD DEV
-- Run this in Supabase SQL Editor.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_progress (
  story_id uuid not null references public.stories(id) on delete cascade,
  item_key text not null,
  status text not null check (status in ('found','todo','skipped')),
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (story_id, item_key)
);

create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists story_progress_story_id_idx on public.story_progress(story_id);

alter table public.stories enable row level security;
alter table public.story_progress enable row level security;

-- Stories: users may only access their own playthroughs.
drop policy if exists stories_select_own on public.stories;
create policy stories_select_own on public.stories for select to authenticated using (user_id = auth.uid());
drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated with check (user_id = auth.uid());
drop policy if exists stories_update_own on public.stories;
create policy stories_update_own on public.stories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated using (user_id = auth.uid());

-- Progress: access is allowed only when the parent Story belongs to auth.uid().
drop policy if exists progress_select_own on public.story_progress;
create policy progress_select_own on public.story_progress for select to authenticated using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
drop policy if exists progress_insert_own on public.story_progress;
create policy progress_insert_own on public.story_progress for insert to authenticated with check (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
drop policy if exists progress_update_own on public.story_progress;
create policy progress_update_own on public.story_progress for update to authenticated using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())) with check (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
drop policy if exists progress_delete_own on public.story_progress;
create policy progress_delete_own on public.story_progress for delete to authenticated using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));

-- Least-privilege Data API grants. RLS still decides which rows are visible/writable.
grant select, insert, update, delete on public.stories to authenticated;
grant select, insert, update, delete on public.story_progress to authenticated;
revoke all on public.stories from anon;
revoke all on public.story_progress from anon;
