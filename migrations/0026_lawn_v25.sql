-- Movimiento 3 (auditoría 2026-11-08), hallazgo 12: enlace pago↔trabajo.
-- payments.job_id apunta al trabajo que originó el pago cuando el pago nace DE un
-- trabajo (markJobDone y variantes, extra nacido-hecho). Nullable a propósito:
-- los pagos sueltos (recordPayment, grupo, saldo inicial, propinas) no nacen de
-- un trabajo, y todo el historial anterior a esta migración queda sin enlace —
-- reopenJob/undo solo usan la caza vieja por monto+nota para esos pagos legacy.
alter table payments add column if not exists job_id integer references jobs (id) on delete set null;

create index if not exists payments_job_idx on payments (job_id) where job_id is not null;
