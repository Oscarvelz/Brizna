-- Brizna on the shared "faro" Supabase project. One compressed snapshot per account
-- (text only: no photos, no local backups). Each person sees only their own row.
create table if not exists public.brizna_books (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data_gz    text not null,
  revision   bigint not null default 1,
  updated_at timestamptz not null default now(),
  device_id  text not null default ''
);
alter table public.brizna_books enable row level security;
drop policy if exists "own books read" on public.brizna_books;
drop policy if exists "own books insert" on public.brizna_books;
drop policy if exists "own books update" on public.brizna_books;
drop policy if exists "own books delete" on public.brizna_books;
create policy "own books read" on public.brizna_books for select to authenticated using (user_id = auth.uid());
create policy "own books insert" on public.brizna_books for insert to authenticated with check (user_id = auth.uid());
create policy "own books update" on public.brizna_books for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own books delete" on public.brizna_books for delete to authenticated using (user_id = auth.uid());

create or replace function public.brizna_push(p_data text, p_revision bigint, p_updated timestamptz, p_device text)
returns table (revision bigint, updated_at timestamptz, device_id text, won boolean)
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); prev record; wins boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(p_data) > 3000000 then raise exception 'too large'; end if;
  select b.revision, b.updated_at into prev from brizna_books b where b.user_id = uid for update;
  wins := prev is null or p_revision > prev.revision or (p_revision = prev.revision and p_updated >= prev.updated_at);
  if wins then
    insert into brizna_books as b (user_id, data_gz, revision, updated_at, device_id)
    values (uid, p_data, p_revision, p_updated, left(p_device, 80))
    on conflict (user_id) do update set data_gz = excluded.data_gz, revision = excluded.revision,
      updated_at = excluded.updated_at, device_id = excluded.device_id;
  end if;
  return query select b.revision, b.updated_at, b.device_id, wins from brizna_books b where b.user_id = uid;
end $$;
revoke execute on function public.brizna_push(text, bigint, timestamptz, text) from anon, public;
grant execute on function public.brizna_push(text, bigint, timestamptz, text) to authenticated;
