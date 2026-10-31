alter table clients add column if not exists credit numeric(10, 2) not null default 0;
alter table clients add column if not exists rich_notes text;

alter table payments drop constraint if exists payments_kind_check;
alter table payments add constraint payments_kind_check
  check (kind in ('paid', 'waived', 'prepaid'));

create table if not exists pad_notes (
  user_id text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_active_name_idx on clients (user_id, is_active, name);
create index if not exists jobs_user_client_date_idx on jobs (user_id, client_id, scheduled_date);
