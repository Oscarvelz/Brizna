create table if not exists day_marks (
  user_id text not null,
  mark_date date not null,
  reason text not null,
  detail text not null default '',
  kind text not null,
  primary key (user_id, mark_date, kind, reason)
);
