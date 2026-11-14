/**
 * seeds-w2-b — los escenarios ficticios de la ola 2, mitad B (AD5–AD8).
 *
 * Cada semilla corre sobre el libro-escenario VACÍO y sellado (stage.ts), con
 * las mismas funciones de servidor que usa la app (stage-seeds.ts es la
 * referencia de la API: createClient / completeJob / addExtraJob / listJobs /
 * recordPayment / rescheduleJob / updateSettings / applyVacation /
 * setServicePaused). Las fechas son relativas a hoy (lib/dates.ts) y los
 * números, de lección y redondos: el corte de Don Aurelio cuesta $40 y su
 * deuda de lección es $120 (PLAN §1.0).
 *
 * stageCtx guarda los ids que los pasos `go` aterrizan con tokens:
 * :aurelio (el caso continuo), :lucia (temporada por cliente), :riesgo
 * (alto riesgo de AD7) y :unavez (el cliente de una vez de AD8).
 */
import { addDaysISO, todayISO, weekdayFromISO } from "@/lib/dates";
import {
  addExtraJob,
  applyVacation,
  completeJob,
  createClient,
  listJobs,
  recordPayment,
  rescheduleJob,
  setServicePaused,
  updateSettings,
} from "@/lib/server/lawn";
import { stageCtx } from "./stage-seeds.ts";

type NewClient = {
  name: string;
  phone?: string;
  address?: string;
  pricePerCut: number;
  startDate: string;
  cutsPerMonth?: number;
  paySameDay?: boolean;
  openingBalance?: number;
  seasonStart?: string;
  seasonEnd?: string;
  seasonEvery?: number;
};

/** Alta llana de un cliente regular en el escenario (quincenal por defecto). */
async function mkClient(c: NewClient): Promise<number> {
  const res = await createClient({
    data: {
      name: c.name,
      phone: c.phone ?? "",
      address: c.address ?? "",
      notes: "",
      kind: "regular",
      pricePerCut: c.pricePerCut,
      cutsPerMonth: c.cutsPerMonth ?? 2,
      weekday: weekdayFromISO(c.startDate),
      startDate: c.startDate,
      paySameDay: c.paySameDay ?? false,
      openingBalance: c.openingBalance ?? 0,
      seasonStart: c.seasonStart ?? "",
      seasonEnd: c.seasonEnd ?? "",
      seasonEvery: c.seasonEvery ?? null,
    },
  });
  return res.id;
}

const AURELIO = {
  name: "Don Aurelio",
  phone: "305 555 0140",
  address: "123 Palm Street",
  pricePerCut: 40,
};

/** Don Aurelio debiendo exactamente $120: dos cortes hechos a deber y un
 *  extra hecho de ayer (la misma construcción que ruta-dinero de Q4). */
async function aurelioDebe120(): Promise<number> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: addDaysISO(today, -14) });
  stageCtx.aurelioId = String(id);
  const jobs = await listJobs({ data: { filter: "all", range: "all", q: "Aurelio" } });
  const past = jobs
    .filter((j) => j.clientId === id && j.status === "pending" && j.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1));
  let owed = 0;
  for (const job of past.slice(0, 2)) {
    await completeJob({ data: { id: job.id, settlement: "owe" } });
    owed += 40;
  }
  await addExtraJob({
    data: { clientId: id, title: "Poda de palmera", amount: 40, date: addDaysISO(today, -1), markDone: true },
  });
  owed += 40;
  for (let missing = 3 - owed / 40; missing > 0; missing -= 1) {
    await addExtraJob({
      data: { clientId: id, title: "Limpieza de patio", amount: 40, date: addDaysISO(today, -3), markDone: true },
    });
  }
  return id;
}

/* ================================ AD5 ================================ */

/**
 * agenda-base — la Agenda entera en un libro (AD5):
 *  - Don Aurelio corta hoy y en el futuro (quincenal desde hoy).
 *  - Carmen Ruiz cortaba hace 2 días y no se hizo → Tarde (calculado).
 *  - Bruno Soto y Darío Paz también cortan hoy (día con varios patios:
 *    Mover el día entero y reordenar la ruta tienen materia).
 *  - Elena Vidal: su visita de dentro de 5 días se movió A MANO dos días
 *    más tarde con razón «Lluvia» (originDate ≠ scheduledDate: vive en la
 *    vista Pospuesto y la regeneración la respeta, C-51).
 *  - Félix Marín: un corte de hace 7 días ya hecho y cobrado (Realizado).
 */
async function agendaBase(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, -2) });
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today });
  await mkClient({ name: "Darío Paz", phone: "305 555 0143", address: "221 Coral Way", pricePerCut: 60, startDate: today });

  const elena = await mkClient({ name: "Elena Vidal", phone: "305 555 0154", address: "77 River Road", pricePerCut: 45, startDate: addDaysISO(today, 5) });
  const elenaJobs = await listJobs({ data: { filter: "all", range: "all", q: "Elena" } });
  const elenaJob = elenaJobs
    .filter((j) => j.clientId === elena && j.status === "pending")
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1))[0];
  if (elenaJob) {
    await rescheduleJob({ data: { id: elenaJob.id, date: addDaysISO(today, 7), reason: "Lluvia" } });
  }

  const felix = await mkClient({ name: "Félix Marín", phone: "305 555 0165", address: "310 Ocean Drive", pricePerCut: 40, startDate: addDaysISO(today, -7) });
  const felixJobs = await listJobs({ data: { filter: "all", range: "all", q: "Félix" } });
  const felixPast = felixJobs
    .filter((j) => j.clientId === felix && j.status === "pending" && j.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))[0];
  if (felixPast) await completeJob({ data: { id: felixPast.id, settlement: "paid" } });
}

/* ================================ AD6 ================================ */

const mmdd = (iso: string): string => iso.slice(5);

/**
 * temporada-global — Don Aurelio semanal, y la temporada de TODOS encendida
 * en el escenario: desde hoy hasta dentro de 40 días, un corte cada 10 días.
 * Guardarla por updateSettings regenera la Agenda en el acto (C-54).
 */
async function temporadaGlobal(): Promise<void> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: addDaysISO(today, -7), cutsPerMonth: 4 });
  stageCtx.aurelioId = String(id);
  await updateSettings({
    data: { seasonStart: mmdd(today), seasonEnd: mmdd(addDaysISO(today, 40)), seasonEvery: 10 },
  });
}

/**
 * temporada-cliente — Lucía Prado lleva SU temporada (cada 10 días, misma
 * ventana) sobre su ritmo semanal; Don Aurelio, sin temporada propia, sigue
 * la de todos — que aquí está apagada, así que manda su ritmo normal (C-55).
 */
async function temporadaCliente(): Promise<void> {
  const today = todayISO();
  const lucia = await mkClient({
    name: "Lucía Prado",
    phone: "305 555 0176",
    address: "15 Bay Street",
    pricePerCut: 40,
    startDate: addDaysISO(today, -7),
    cutsPerMonth: 4,
    seasonStart: mmdd(today),
    seasonEnd: mmdd(addDaysISO(today, 40)),
    seasonEvery: 10,
  });
  stageCtx.luciaId = String(lucia);
  const aurelio = await mkClient({ ...AURELIO, startDate: addDaysISO(today, -7), cutsPerMonth: 4 });
  stageCtx.aurelioId = String(aurelio);
}

/**
 * vacaciones-base — trabajo dentro del tramo del viaje y un atrasado:
 * Don Aurelio corta dentro de 3 días, Carmen Ruiz dentro de 5 y Bruno Soto
 * va tarde desde hace 2 días. Nadie ha aplicado vacaciones todavía: la
 * escena enseña la puerta de Ajustes tal como el alumno la encontrará.
 */
async function vacacionesBase(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: addDaysISO(today, 3) });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, 5) });
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: addDaysISO(today, -2) });
}

/**
 * vacaciones-activas — el mismo paisaje, pero con las vacaciones YA
 * aplicadas por la vía real (applyVacation): de dentro de 2 días a dentro
 * de 6. Los pendientes del tramo se corrieron lo que dura el viaje y el
 * atrasado pasó al día del regreso (C-57). Es el estado sobre el que AD6
 * enseña el aviso de Agenda y la puerta de Quitar (VERIFY V-4).
 */
async function vacacionesActivas(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: addDaysISO(today, 3) });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, 5) });
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: addDaysISO(today, -2) });
  await applyVacation({ data: { start: addDaysISO(today, 2), end: addDaysISO(today, 6) } });
}

/* ================================ AD7 ================================ */

/**
 * cobros-tablero — Cobros como tablero de riesgo (AD7), cada vista con su
 * caso:
 *  - Don Aurelio debe $80 tras abonar $40 de sus $120 (la nota «Abono» es
 *    lo que la vista Abonado lee, H-D3).
 *  - Carmen Ruiz: un corte hecho a deber hace 50 días, $40 → nivel Espera
 *    (≥45 días sin pagar, sin llegar a alto riesgo).
 *  - Rodrigo Paz debe $240 de saldo inicial → Alto riesgo por monto
 *    (≥$200, D-35) y su siembra futura nace congelada (C-52/D-37).
 *  - Marta León debe $60 y está EN PAUSA: su dinero espera en Por cobrar
 *    y su caso vive también en la vista En espera (H-D4).
 *  - Iván Serra debía $90 de saldo inicial: ese cubo propio de Estudio
 *    («Saldo inicial», D-49) no se disfraza de deuda vieja.
 *  - Julia Ortiz pagó hoy sus $100 enteros → vive en Cobrado.
 */
async function cobrosTablero(): Promise<void> {
  const today = todayISO();
  const aurelio = await aurelioDebe120();
  await recordPayment({ data: { clientId: aurelio, kind: "paid", amount: 40, note: "Abono" } });

  const carmen = await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 40, startDate: addDaysISO(today, -50), cutsPerMonth: 4 });
  const carmenJobs = await listJobs({ data: { filter: "all", range: "all", q: "Carmen" } });
  const carmenOld = carmenJobs
    .filter((j) => j.clientId === carmen && j.status === "pending" && j.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1))[0];
  if (carmenOld) await completeJob({ data: { id: carmenOld.id, settlement: "owe" } });

  const rodrigo = await mkClient({ name: "Rodrigo Paz", phone: "305 555 0187", address: "640 Hill Court", pricePerCut: 40, startDate: today, openingBalance: 240 });
  stageCtx.riesgoId = String(rodrigo);

  const marta = await mkClient({ name: "Marta León", phone: "305 555 0198", address: "28 Lake View", pricePerCut: 60, startDate: addDaysISO(today, -7) });
  await addExtraJob({
    data: { clientId: marta, title: "Retirada de ramas", amount: 60, date: addDaysISO(today, -1), markDone: true },
  });
  await setServicePaused({ data: { id: marta, paused: true } });

  await mkClient({ name: "Iván Serra", phone: "305 555 0209", address: "5 Cedar Point", pricePerCut: 40, startDate: today, openingBalance: 90 });

  const julia = await mkClient({ name: "Julia Ortiz", phone: "305 555 0210", address: "902 Palm Court", pricePerCut: 40, startDate: today, openingBalance: 100 });
  await recordPayment({ data: { clientId: julia, kind: "paid", amount: 100, note: "Pagado" } });
}

/* ================================ AD8 ================================ */

/** perdon-parcial — Don Aurelio debe $120, listo para perdonar $80 (R-2). */
async function perdonParcial(): Promise<void> {
  await aurelioDebe120();
}

/** perdon-total — Don Aurelio debe $120, listo para el perdón total y para
 *  declarar después el pago tardío por Adelanto (R-1, R-11). */
async function perdonTotal(): Promise<void> {
  await aurelioDebe120();
}

/**
 * perdon-grupo — tres saldos redondos esperando la elección en grupo
 * (R-3): $40, $50 y $60 de deuda anterior, sin cortes de por medio.
 */
async function perdonGrupo(): Promise<void> {
  const today = todayISO();
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 40, startDate: today, openingBalance: 40 });
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 40, startDate: today, openingBalance: 50 });
  await mkClient({ name: "Darío Paz", phone: "305 555 0143", address: "221 Coral Way", pricePerCut: 40, startDate: today, openingBalance: 60 });
}

/**
 * perdon-unavez — Nora Quintana, cliente de UNA VEZ: su único trabajo ya
 * se hizo y quedó a deber $40, sin pendientes. Un perdón total la dejaría
 * en cero y sin nada pendiente: candidata exacta al auto-archivo (R-8).
 */
async function perdonUnavez(): Promise<void> {
  const today = todayISO();
  const res = await createClient({
    data: {
      name: "Nora Quintana",
      phone: "305 555 0221",
      address: "411 Sunset Boulevard",
      notes: "",
      kind: "one_time",
      pricePerCut: 40,
      cutsPerMonth: 1,
      weekday: weekdayFromISO(addDaysISO(today, -1)),
      startDate: addDaysISO(today, -1),
      paySameDay: false,
      oneTimeDate: addDaysISO(today, -1),
      oneTimeTitle: "Limpieza única",
    },
  });
  stageCtx.unavezId = String(res.id);
  const jobs = await listJobs({ data: { filter: "all", range: "all", q: "Nora" } });
  const job = jobs.filter((j) => j.clientId === res.id && j.status === "pending")[0];
  if (job) await completeJob({ data: { id: job.id, settlement: "owe" } });
}

/** Las siembras de la mitad B de la ola 2, por nombre de paso `stage`. */
export const SEEDS_W2_B: Record<string, () => Promise<void>> = {
  "agenda-base": agendaBase,
  "temporada-global": temporadaGlobal,
  "temporada-cliente": temporadaCliente,
  "vacaciones-base": vacacionesBase,
  "vacaciones-activas": vacacionesActivas,
  "cobros-tablero": cobrosTablero,
  "perdon-parcial": perdonParcial,
  "perdon-total": perdonTotal,
  "perdon-grupo": perdonGrupo,
  "perdon-unavez": perdonUnavez,
};
