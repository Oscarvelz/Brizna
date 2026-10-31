alter table app_settings add column if not exists week_goals text;
alter table app_settings add column if not exists abono_presets text;
alter table app_settings add column if not exists vacation_start date;
alter table app_settings add column if not exists vacation_end date;
alter table app_settings add column if not exists vacation_shift integer not null default 0;
alter table app_settings add column if not exists excluded_weekdays text;

create table if not exists pad_pages (
  id serial primary key,
  user_id text not null,
  title text not null default 'Nota',
  body text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists pad_pages_user_idx on pad_pages (user_id, sort_order, id);

insert into pad_pages (user_id, title, body, sort_order)
select user_id, 'General', body, 0 from pad_notes
where not exists (select 1 from pad_pages p where p.user_id = pad_notes.user_id);

create table if not exists client_changes (
  id serial primary key,
  user_id text not null,
  client_id integer not null references clients(id) on delete cascade,
  summary text not null,
  snapshot text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists client_changes_idx on client_changes (user_id, client_id, created_at desc);
