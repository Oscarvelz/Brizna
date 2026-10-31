alter table pad_pages add column if not exists created_at timestamptz;
update pad_pages set created_at = updated_at where created_at is null;
alter table pad_pages alter column created_at set default now();
