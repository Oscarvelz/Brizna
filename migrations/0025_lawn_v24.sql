-- Movimiento 1 (auditoría 2026-11-08), hallazgo 2: «seguir atendiendo» — el usuario
-- decide seguir generando visitas a un cliente en serio/alto riesgo pese a su deuda.
alter table clients add column if not exists keep_serving boolean not null default false;
