create table if not exists clients (
  id serial primary key,
  user_id text not null,
  name text not null,
  phone text,
  address text,
  notes text,
  kind text not null default 'regular' check (kind in ('regular', 'one_time')),
  price_per_cut numeric(10, 2) not null default 0,
  cuts_per_month integer not null default 2 check (cuts_per_month in (1, 2, 3)),
  weekday integer not null default 1 check (weekday between 0 and 6),
  balance numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on clients (user_id);
create index if not exists clients_user_name_idx on clients (user_id, name);

create table if not exists jobs (
  id serial primary key,
  user_id text not null,
  client_id integer not null references clients (id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  kind text not null default 'cut' check (kind in ('cut', 'extra', 'one_time')),
  title text,
  amount numeric(10, 2) not null default 0,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists jobs_user_date_idx on jobs (user_id, scheduled_date);
create index if not exists jobs_client_idx on jobs (client_id);
create unique index if not exists jobs_cut_unique
  on jobs (user_id, client_id, scheduled_date)
  where kind = 'cut';

create table if not exists payments (
  id serial primary key,
  user_id text not null,
  client_id integer not null references clients (id) on delete cascade,
  amount numeric(10, 2) not null,
  kind text not null check (kind in ('paid', 'waived')),
  note text,
  paid_at timestamptz not null default now()
);

create index if not exists payments_user_idx on payments (user_id, paid_at);
