-- Opening balance recorded when a client is added with debt from before the app.
alter table payments drop constraint if exists payments_kind_check;
alter table payments add constraint payments_kind_check
  check (kind in ('paid', 'waived', 'prepaid', 'opening'));
