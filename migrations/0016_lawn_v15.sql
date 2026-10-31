create table if not exists pad_photos (
  id serial primary key,
  user_id text not null,
  page_id integer not null references pad_pages (id) on delete cascade,
  data text not null,
  created_at timestamptz not null default now()
);

create index if not exists pad_photos_page_idx on pad_photos (user_id, page_id);
