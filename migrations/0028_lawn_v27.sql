-- Prejuicio R2, Ola 2 (1.6.02): la agenda recuerda el origen.
-- R2B-1/R2B-2: el sello de vacaciones guarda la fecha que el trabajo tenía
-- al ser recogido (vacation_from). Deshacer restaura ESA fecha exacta: ni
-- origin_date (que sella el primer pospone deliberado, y deshacer lo
-- revertía en silencio) ni la aritmética scheduled − días (que los choques
-- de moveJobToDate dejaban corrida un día por choque, para siempre).
alter table jobs add column if not exists vacation_from date;
