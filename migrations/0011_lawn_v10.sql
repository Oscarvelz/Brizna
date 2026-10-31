alter table payments add column if not exists method text;
alter table jobs add column if not exists photo text;

alter table clients add column if not exists standing_extras text;
alter table clients add column if not exists season_start text;
alter table clients add column if not exists season_end text;
alter table clients add column if not exists season_every integer;

alter table app_settings add column if not exists risk_amount numeric(10, 2) not null default 200;
alter table app_settings add column if not exists wait_days integer not null default 45;
alter table app_settings add column if not exists message_presets text;
alter table app_settings add column if not exists horizon_months integer not null default 12;
alter table app_settings add column if not exists season_start text;
alter table app_settings add column if not exists season_end text;
alter table app_settings add column if not exists season_every integer;

create table if not exists client_photos (
  id serial primary key,
  user_id text not null,
  client_id integer not null references clients (id) on delete cascade,
  data text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists client_photos_client_idx on client_photos (user_id, client_id);
