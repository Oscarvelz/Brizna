alter table clients add column if not exists cue text;
alter table clients add column if not exists pinned boolean not null default false;
alter table clients add column if not exists blacklisted boolean not null default false;

alter table jobs add column if not exists pinned boolean not null default false;
alter table jobs add column if not exists postpone_reason text;

alter table pad_pages add column if not exists folder text not null default '';

alter table app_settings add column if not exists task_presets text;
alter table app_settings add column if not exists arrival_presets text;
alter table app_settings add column if not exists risk_days integer not null default 21;

create table if not exists week_off_dates (
  user_id text not null,
  off_date date not null,
  primary key (user_id, off_date)
);

create table if not exists day_notes (
  user_id text not null,
  note_date date not null,
  body text not null default '',
  primary key (user_id, note_date)
);
