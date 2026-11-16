-- Ola 3 de las curas Prejuicio (1.5.96): la agenda respeta el origen.
-- BZ-13: marca de corrimiento por vacaciones. applyVacation sella cada trabajo
-- que corre con los días corridos (vacation_shift); quitar las vacaciones (o
-- reaplicar otras) deshace SOLO las filas selladas, cada una por su propio
-- sello — antes el deshacer corría hacia atrás TODO lo pendiente desde el
-- inicio de las vacaciones hasta el fin del horizonte, un año entero.
alter table jobs add column if not exists vacation_shift integer not null default 0;

-- BZ-39: cancelar libera la fecha. El índice único de cortes deja de contar
-- las filas canceladas: una visita cancelada ya no quema su día para siempre
-- (las 'done' sí siguen ocupándolo). El índice viejo era más estricto, así
-- que ningún libro existente puede violar el nuevo al crearlo.
drop index if exists jobs_cut_unique;
create unique index if not exists jobs_cut_unique
  on jobs (user_id, client_id, scheduled_date)
  where kind = 'cut' and status <> 'cancelled';
