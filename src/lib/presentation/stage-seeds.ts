/**
 * stage-seeds — los escenarios ficticios del piso Quick (PLAN §1.0).
 *
 * Cada semilla corre sobre el libro-escenario VACÍO y sellado (stage.ts), así
 * que siembra con creación llana, llamando a las mismas funciones de servidor
 * que usa la app (`fn({ data })`, validadores leídos en src/lib/server/lawn.ts):
 *  - createClient: clientInput { name, phone, address, kind, pricePerCut,
 *    cutsPerMonth (1=mes, 2=cada 2 semanas, 3=3/mes, 4=semana, 5=2/semana),
 *    weekday, startDate, paySameDay, openingBalance, … } → { id }.
 *  - completeJob: { id, settlement: "paid" | "owe" | "abono", abono? }.
 *  - addExtraJob: extraInput { clientId, title, amount, date, markDone? } —
 *    con fecha de hoy o pasada nace hecho; sin adelanto y sin «paga el mismo
 *    día», su monto suma al saldo en el acto.
 *  - listJobs: jobsInput { filter, range, q } — para encontrar los trabajos
 *    que la siembra de un cliente regular ya generó.
 *
 * Las fechas son relativas a hoy con los ayudantes de la casa
 * (src/lib/dates.ts), para que los trabajos caigan hoy / ayer / hace 2 días
 * en cualquier aparato y cualquier día. Los números son de lección, redondos:
 * el corte de Don Aurelio cuesta $40 (PLAN §1.0).
 *
 * stageCtx.aurelioId guarda el id (como texto) del cliente continuo, para que
 * los pasos `go` con `:aurelio` aterricen en su ficha.
 */
import { addDaysISO, todayISO, weekdayFromISO } from "@/lib/dates";
import { addExtraJob, completeJob, createClient, listJobs } from "@/lib/server/lawn";
import { SEEDS_W2_A } from "./seeds-w2-a.ts";
import { SEEDS_W2_B } from "./seeds-w2-b.ts";
import { SEEDS_W2_C } from "./seeds-w2-c.ts";
import { SEEDS_W2_D } from "./seeds-w2-d.ts";

export const stageCtx: { aurelioId?: string; [k: string]: unknown } = {};

type NewClient = {
  name: string;
  phone?: string;
  address?: string;
  pricePerCut: number;
  startDate: string;
  paySameDay?: boolean;
};

/** Alta llana de un cliente regular quincenal (cada 2 semanas) en el escenario. */
async function mkClient(c: NewClient): Promise<number> {
  const res = await createClient({
    data: {
      name: c.name,
      phone: c.phone ?? "",
      address: c.address ?? "",
      notes: "",
      kind: "regular",
      pricePerCut: c.pricePerCut,
      cutsPerMonth: 2,
      weekday: weekdayFromISO(c.startDate),
      startDate: c.startDate,
      paySameDay: c.paySameDay ?? false,
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

/**
 * ruta-base — Don Aurelio, corte de $40, frecuencia quincenal, primer corte
 * HOY (la siembra regular genera su visita de hoy). Nada más: el día mínimo
 * para mirar una tarjeta y para escribirle. Sirve a Q1 y Q5.
 */
async function rutaBase(): Promise<void> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(id);
}

/**
 * ruta-dia — un día de trabajo entero (Q3):
 *  - Don Aurelio: su corte de $40 es HOY.
 *  - Carmen Ruiz: primer corte hace 2 días, sin hacer → atrasada, y por eso
 *    fijada arriba en Hoy por la propia app (pin forzado, censo A-60).
 *  - Bruno Soto y Darío Paz: también cortan hoy (cuatro patios dan para
 *    cerrar uno cobrado, uno pendiente, uno abonado y posponer el cuarto).
 */
async function rutaDia(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, -2) });
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today });
  await mkClient({ name: "Darío Paz", phone: "305 555 0143", address: "221 Coral Way", pricePerCut: 60, startDate: today });
}

/**
 * ruta-dinero — Don Aurelio debe $120 (Q4): dos cortes hechos y no pagados
 * ($40 + $40) y un trabajo extra hecho ayer ($40). Su corte de hoy queda
 * pendiente en Hoy. La siembra regular desde hace 14 días genera sus cortes
 * pasados; los dos últimos pasados se cierran «pendiente» con completeJob.
 * Si la siembra no hubiera generado alguno (horizonte distinto), el faltante
 * se completa con extras pasados del mismo monto, para que el saldo de la
 * lección sea siempre exactamente $120.
 */
async function rutaDinero(): Promise<void> {
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
  // El extra de ayer: $40 hechos y a la cuenta (sin adelanto, no paga el mismo día).
  await addExtraJob({
    data: { clientId: id, title: "Poda de palmera", amount: 40, date: addDaysISO(today, -1), markDone: true },
  });
  owed += 40;
  // Red de la lección: si faltó un corte pasado, otro extra pasado lo completa.
  for (let missing = 3 - owed / 40; missing > 0; missing -= 1) {
    await addExtraJob({
      data: { clientId: id, title: "Limpieza de patio", amount: 40, date: addDaysISO(today, -3), markDone: true },
    });
  }
}

/**
 * vuelta-base — la vuelta completa (Q0): Don Aurelio, corte de $40,
 * frecuencia quincenal, primer corte HOY y nada debido todavía. La vuelta
 * monta sobre él (stageCtx.aurelioId): su Hecho pendiente nace la deuda de
 * $40 que el abono de $20 parte en dos. La segunda clienta (Carmen Ruiz)
 * no la siembra nadie: la da de alta el propio alumno en la escena.
 */
async function vueltaBase(): Promise<void> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(id);
}

/** Las siembras por nombre, tal como las citan los pasos `stage` de los guiones. */
export const STAGE_SEEDS: Record<string, () => Promise<void>> = {
  "ruta-base": rutaBase,
  "ruta-dia": rutaDia,
  "ruta-dinero": rutaDinero,
  ...SEEDS_W2_A,
  ...SEEDS_W2_B,
  ...SEEDS_W2_C,
  ...SEEDS_W2_D,
  "vuelta-base": vueltaBase,
};
