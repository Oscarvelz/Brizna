alter table clients drop constraint if exists clients_cuts_per_month_check;
alter table clients add constraint clients_cuts_per_month_check
  check (cuts_per_month between 1 and 8);

alter table clients add column if not exists arrival_time text;
alter table clients add column if not exists start_date date;
alter table clients add column if not exists pay_same_day boolean not null default false;
alter table clients add column if not exists sort_order integer not null default 0;
alter table clients add column if not exists frequency_days integer;
alter table clients add column if not exists weekday_2 integer;
alter table clients add column if not exists contact_id text;

alter table jobs add column if not exists arrival_time text;
alter table jobs add column if not exists sort_order integer not null default 0;

create table if not exists app_settings (
  user_id text primary key,
  business_name text not null default 'Oscar''s Lawn Service',
  theme text not null default 'light' check (theme in ('light', 'amoled')),
  reminders_enabled boolean not null default false,
  reminder_minutes integer not null default 60,
  last_backup_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists backups (
  id serial primary key,
  user_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists backups_user_idx on backups (user_id, created_at desc);
