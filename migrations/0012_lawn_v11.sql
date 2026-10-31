alter table app_settings add column if not exists locale text not null default 'es';
alter table app_settings add column if not exists palette text not null default 'jardin';
alter table app_settings add column if not exists work_start text not null default '08:00';
alter table app_settings add column if not exists work_end text not null default '17:30';

create table if not exists work_days (
  user_id text not null,
  work_date date not null,
  clock_in text,
  clock_out text,
  stopped_reason text,
  stopped_at timestamptz,
  confirmed boolean not null default false,
  auto boolean not null default true,
  primary key (user_id, work_date)
);

alter table pad_pages add column if not exists pinned boolean not null default false;
alter table pad_pages add column if not exists tags text not null default '';
alter table pad_pages add column if not exists due_date date;
alter table pad_pages add column if not exists due_time text;

create table if not exists pad_links (
  id serial primary key,
  user_id text not null,
  page_id integer not null references pad_pages (id) on delete cascade,
  client_id integer not null references clients (id) on delete cascade,
  unique (page_id, client_id)
);

create index if not exists pad_links_client_idx on pad_links (user_id, client_id);
