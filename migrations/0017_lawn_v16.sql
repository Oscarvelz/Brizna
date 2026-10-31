alter table clients add column if not exists service_paused boolean not null default false;
