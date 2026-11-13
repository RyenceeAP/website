-- Run once in the Supabase SQL Editor (Dashboard > SQL Editor > New query > Run).
-- Safe to run again: every statement is "if not exists" or drops and recreates its own policy.

-- 1. One row per account, holding that account's key for the private tools page.
create table if not exists public.tool_keys (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  private_key jsonb not null,
  public_key  jsonb not null,
  created_at  timestamptz not null default now()
);

-- 2. Row-Level Security: with it on and no policy, nobody can touch the table through the API.
alter table public.tool_keys enable row level security;
alter table public.tool_keys force row level security;

-- 3. Signed-out visitors (the "anon" role) get nothing at all. Signed-in users get read, insert and update, but no delete.
revoke all on public.tool_keys from anon;
revoke all on public.tool_keys from authenticated;
grant select, insert, update on public.tool_keys to authenticated;

-- 4. Policies: a signed-in user may only read, insert or update rows where auth.uid() = user_id.
drop policy if exists "tool_keys: read own row" on public.tool_keys;
create policy "tool_keys: read own row" on public.tool_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "tool_keys: insert own row" on public.tool_keys;
create policy "tool_keys: insert own row" on public.tool_keys
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "tool_keys: update own row" on public.tool_keys;
create policy "tool_keys: update own row" on public.tool_keys
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 5. Check: should list the three policies above and show rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'tool_keys';
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'tool_keys';
