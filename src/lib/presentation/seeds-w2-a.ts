/**
 * seeds-w2-a — los escenarios ficticios de la Ola 2, equipo A
 * (AD1, AD2, AD3; AD4 reutiliza «ruta-base», ya en STAGE_SEEDS).
 *
 * Como stage-seeds.ts: cada semilla corre sobre el libro-escenario
 * VACÍO y sellado (stage.ts) y siembra con las mismas funciones de
 * servidor que usa la app (src/lib/server/lawn.ts): createClient con
 * clientInput completo, completeJob para cerrar cortes pasados,
 * addExtraJob para extras hechos, setServicePaused y setBlacklist
 * para los estados de riesgo. Las fechas son relativas a hoy
 * (src/lib/dates.ts) y los números son de lección, redondos:
 * el corte cuesta $40, las deudas $40 / $80 / $120 / $240.
 *
 * stageCtx: el conductor sustituye en los pasos `go` el token
 * `:clave` por stageCtx[clave]; por eso cada cliente del escenario
 * guarda su id (como texto) bajo su clave corta — aurelio, vetado,
 * pausa, serio, unavez, dup, dup2 — y Don Aurelio además bajo
 * aurelioId, el alias `$id` de la casa.
 *
 * El integrador fusiona SEEDS_W2_A dentro de STAGE_SEEDS (o del mapa
 * que el conductor consulte): este archivo no toca stage-seeds.ts.
 */
import { addDaysISO, todayISO, weekdayFromISO } from "@/lib/dates";
import {
  addExtraJob,
  adjustJobAmount,
  completeJob,
  createClient,
  listJobs,
  recordPayment,
  setBlacklist,
  setServicePaused,
} from "@/lib/server/lawn";
import { stageCtx } from "./stage-seeds.ts";

type RegularOpts = {
  cue?: string;
  openingBalance?: number;
};

/** Alta llana de un cliente regular quincenal (cada 2 semanas). */
async function mkRegular(
  name: string,
  phone: string,
  address: string,
  pricePerCut: number,
  startDate: string,
  opts: RegularOpts = {},
): Promise<number> {
  const res = await createClient({
    data: {
      name,
      phone,
      address,
      notes: "",
      kind: "regular",
      pricePerCut,
      cutsPerMonth: 2,
      weekday: weekdayFromISO(startDate),
      startDate,
      paySameDay: false,
      cue: opts.cue ?? "",
      openingBalance: opts.openingBalance ?? 0,
    },
  });
  return res.id;
}

/** Cierra como «pendiente» (a deber) los `n` cortes pasados más recientes; devuelve cuántos cerró. */
async function owePastCuts(clientId: number, name: string, n: number): Promise<number> {
  const today = todayISO();
  const jobs = await listJobs({ data: { filter: "all", range: "all", q: name } });
  const past = jobs
    .filter((j) => j.clientId === clientId && j.status === "pending" && j.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1));
  const chosen = past.slice(0, n);
  for (const job of chosen) {
    await completeJob({ data: { id: job.id, settlement: "owe" } });
  }
  return chosen.length;
}

/** Extra ya hecho (fecha pasada): suma su monto al saldo en el acto. */
async function doneExtra(clientId: number, title: string, amount: number, daysAgo: number): Promise<void> {
  await addExtraJob({
    data: { clientId, title, amount, date: addDaysISO(todayISO(), -daysAgo), markDone: true },
  });
}

const AURELIO = {
  name: "Don Aurelio",
  phone: "305 555 0140",
  address: "123 Palm Street",
  pricePerCut: 40,
};

/** Don Aurelio debiendo $120: dos cortes hechos a deber ($40 + $40) y un extra hecho ayer ($40). */
async function aurelio120(): Promise<number> {
  const today = todayISO();
  const id = await mkRegular(AURELIO.name, AURELIO.phone, AURELIO.address, AURELIO.pricePerCut, addDaysISO(today, -14), { cue: "Casa azul" });
  stageCtx.aurelioId = String(id);
  stageCtx.aurelio = String(id);
  let owed = (await owePastCuts(id, "Aurelio", 2)) * 40;
  await doneExtra(id, "Poda de palmera", 40, 1);
  owed += 40;
  // Red de la lección (la misma de ruta-dinero): si la siembra generó
  // menos cortes pasados, un extra pasado completa los $120 exactos.
  for (let missing = 3 - owed / 40; missing > 0; missing -= 1) {
    await doneExtra(id, "Limpieza de patio", 40, 3);
  }
  return id;
}

/** Hugo Prado: debe $80 de deuda anterior y está en lista negra (su ficha lo enseña; ningún total lo suma). */
async function hugoVetado(): Promise<void> {
  const today = todayISO();
  const id = await mkRegular("Hugo Prado", "305 555 0151", "310 Oak Avenue", 40, today, { openingBalance: 80 });
  stageCtx.vetado = String(id);
  await setBlacklist({ data: { id, blacklisted: true } });
}

/**
 * viaje-dinero (AD1) — el dólar que viaja: Aurelio debe $120 y tiene
 * su corte de $40 hoy; Hugo, vetado, debe $80 fuera de los totales.
 */
async function viajeDinero(): Promise<void> {
  await aurelio120();
  await hugoVetado();
}

/**
 * ficha-completa (AD2) — el expediente y los tres mecanismos:
 * Aurelio ($120, el expediente), Nuria Solís (una vez, trabajo hoy),
 * Lucía Prado (en pausa, debe $80), Omar Reyes (debe $240: serio por
 * monto, sobre el límite de $200) y Hugo Prado (vetado, debe $80).
 */
async function fichaCompleta(): Promise<void> {
  const today = todayISO();
  await aurelio120();

  const nuria = await createClient({
    data: {
      name: "Nuria Solís",
      phone: "305 555 0162",
      address: "15 River Road",
      notes: "",
      kind: "one_time",
      pricePerCut: 60,
      cutsPerMonth: 1,
      weekday: weekdayFromISO(today),
      startDate: today,
      paySameDay: false,
      oneTimeDate: today,
      oneTimeTitle: "Limpieza de patio",
    },
  });
  stageCtx.unavez = String(nuria.id);

  const lucia = await mkRegular("Lucía Prado", "305 555 0173", "72 Sunset Drive", 40, addDaysISO(today, -14), { openingBalance: 80 });
  stageCtx.pausa = String(lucia);
  await setServicePaused({ data: { id: lucia, paused: true } });

  const omar = await mkRegular("Omar Reyes", "305 555 0184", "501 Cedar Court", 40, today, { openingBalance: 240 });
  stageCtx.serio = String(omar);

  await hugoVetado();
}

/**
 * repetidos-par (AD3) — dos casi iguales, mismo teléfono y dirección:
 * Luis Vega debe $40 (un corte hecho a deber) y Luis Vegas debe $80
 * (un corte hecho a deber + un extra hecho). Ambos cortaron el mismo
 * día hace 14 días: ese corte de Vegas es el que no pasará al unir.
 */
async function repetidosPar(): Promise<void> {
  const today = todayISO();
  const start = addDaysISO(today, -14);

  const vega = await mkRegular("Luis Vega", "305 555 0160", "77 Palm Street", 40, start);
  stageCtx.dup = String(vega);
  await owePastCuts(vega, "Luis Vega", 1);

  const vegas = await mkRegular("Luis Vegas", "305 555 0160", "77 Palm Street", 40, start);
  stageCtx.dup2 = String(vegas);
  await owePastCuts(vegas, "Luis Vegas", 1);
  await doneExtra(vegas, "Poda de palmera", 40, 3);
}

/**
 * salida-doble (AD2, capítulo «salir») — las dos puertas de salida,
 * caminadas: la lista se ordena por defecto Nombre A–Z (clientes.index
 * nace con sort «name»; sortClients ordena por nombre), así que Abel y
 * Beto Prueba quedan PRIMERO y SEGUNDO, por delante de Don Aurelio y
 * del resto del escenario «ficha-completa», y el ancla de la tarjeta
 * deslizable — que se resuelve a la primera tarjeta — cae siempre en
 * la víctima de cada paseo.
 *  - Abel Prueba: regular de $40 con deuda anterior de $80, un extra
 *    PENDIENTE dentro de 7 días («Recorte de setos», $40) y sus cortes
 *    futuros sembrados: al archivarlo, los cortes generados se borran
 *    y el extra queda cancelado en su Historial («Cliente archivado»).
 *  - Beto Prueba: de una vez ($60, dentro de 7 días). Su desglose de
 *    borrado, exacto y redondo: Debe $40 · Tiene $20 a favor · 2 pagos
 *    y 3 visitas. Se construye así: dos extras hechos de $40 (deuda
 *    $80, visitas 2 y 3); un pago de $100 que salda los $80 (pago 1) y
 *    deja $20 de adelanto (pago 2); y el precio del segundo extra se
 *    corrige de $40 a $80 en el Historial — el ajuste suma $40 al
 *    saldo sin tocar el adelanto (adjustJobAmount sobre un trabajo
 *    «a deber», sin pago enlazado). Saldo y adelanto conviven.
 *  - Zoe Prueba: regular llana, la superviviente — la lista nunca
 *    queda vacía tras los dos paseos.
 */
async function salidaDoble(): Promise<void> {
  const today = todayISO();

  const abel = await mkRegular("Abel Prueba", "305 555 0111", "10 Test Street", 40, addDaysISO(today, -14), { openingBalance: 80 });
  stageCtx.abel = String(abel);
  await addExtraJob({
    data: { clientId: abel, title: "Recorte de setos", amount: 40, date: addDaysISO(today, 7), markDone: false },
  });

  const beto = await createClient({
    data: {
      name: "Beto Prueba",
      phone: "305 555 0122",
      address: "20 Test Street",
      notes: "",
      kind: "one_time",
      pricePerCut: 60,
      cutsPerMonth: 1,
      weekday: weekdayFromISO(addDaysISO(today, 7)),
      startDate: addDaysISO(today, 7),
      paySameDay: false,
      oneTimeDate: addDaysISO(today, 7),
      oneTimeTitle: "Limpieza de patio",
    },
  });
  stageCtx.beto = String(beto.id);
  await doneExtra(beto.id, "Poda de palmera", 40, 3);
  const segundo = await addExtraJob({
    data: { clientId: beto.id, title: "Recorte de setos", amount: 40, date: addDaysISO(today, -1), markDone: true },
  });
  await recordPayment({ data: { clientId: beto.id, kind: "paid", amount: 100 } });
  await adjustJobAmount({ data: { id: segundo.id, amount: 80 } });

  const zoe = await mkRegular("Zoe Prueba", "305 555 0133", "30 Test Street", 40, today);
  stageCtx.zoe = String(zoe);
}

/** Las siembras de la Ola 2 (equipo A), por el nombre que citan los pasos `stage`. */
export const SEEDS_W2_A: Record<string, () => Promise<void>> = {
  "viaje-dinero": viajeDinero,
  "ficha-completa": fichaCompleta,
  "repetidos-par": repetidosPar,
  "salida-doble": salidaDoble,
};
