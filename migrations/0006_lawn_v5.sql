alter table clients add column if not exists pay_due_day integer;

create table if not exists day_goals (
  user_id text not null,
  goal_date date not null,
  goal integer not null check (goal >= 1 and goal <= 80),
  primary key (user_id, goal_date)
);

create index if not exists day_goals_user_date_idx on day_goals (user_id, goal_date);
