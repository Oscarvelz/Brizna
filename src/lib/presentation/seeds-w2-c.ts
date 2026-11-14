/**
 * seeds-w2-c — escenarios de la Ola 2, grupo C (AD9–AD12).
 *
 * Como stage-seeds.ts: cada semilla corre sobre el libro-escenario VACÍO y
 * sellado y siembra con creación llana, llamando a las mismas funciones de
 * servidor que usa la app. Fechas relativas a hoy (lib/dates.ts) y números
 * de lección, redondos: el corte de Don Aurelio cuesta $40 (PLAN §1.0).
 * stageCtx.aurelioId (de stage-seeds.ts, el objeto compartido) guarda el id
 * del cliente continuo para los pasos `go` con `:aurelio`.
 *
 *  - "estudio-cifras"    AD9: Aurelio debe $120 (como ruta-dinero), Carmen
 *                        Ruiz debe $100 de cortes viejos (deuda con
 *                        antigüedad para los cubos y para el Asesor) y
 *                        Bruno Soto paga: historial cobrado. El Asesor
 *                        tiene base (hasData: clientes activos + Hechos).
 *  - "comunicacion-ruta" AD10: Don Aurelio corta hoy, con teléfono y
 *                        dirección (la ruta-base de Q5, reconstruida aquí).
 *  - "bloc-notas"        AD11: Aurelio + una nota guardada que lo menciona
 *                        (queda enlazada a su ficha), fijada, en la carpeta
 *                        «Trabajo por hacer»; una nota guardada SIN fijar en
 *                        «Materiales» (la inquilina suelta: la tira de
 *                        fijadas nace con una sola y el paseo de fijar se
 *                        hace sobre la nota que el alumno escribe, guarda
 *                        y reabre desde la ficha), y una en la papelera.
 *  - "clima-dia"         AD12: el día de Q3 (cuatro patios hoy, una
 *                        atrasada) para que el Plan de hoy tenga patios
 *                        que contar; el clima en sí es lectura viva y
 *                        ninguna semilla lo fabrica.
 */
import { addDaysISO, todayISO, weekdayFromISO } from "@/lib/dates";
import {
  completeJob,
  createClient,
  createPadPage,
  listJobs,
  savePad,
} from "@/lib/server/lawn";
import { addExtraJob } from "@/lib/server/lawn";
import { stageCtx } from "./stage-seeds.ts";

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

/** Cierra como «pendiente» (owe) o «cobrado» (paid) los cortes pasados de un cliente. */
async function settlePast(id: number, name: string, settlement: "owe" | "paid", count: number): Promise<void> {
  const today = todayISO();
  const jobs = await listJobs({ data: { filter: "all", range: "all", q: name } });
  const past = jobs
    .filter((j) => j.clientId === id && j.status === "pending" && j.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1));
  for (const job of past.slice(0, count)) {
    await completeJob({ data: { id: job.id, settlement } });
  }
}

/** AD9 — cifras con deuda, antigüedad e historial cobrado (ver cabecera). */
async function estudioCifras(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: addDaysISO(today, -14) });
  stageCtx.aurelioId = String(aurelio);
  await settlePast(aurelio, "Aurelio", "owe", 2);
  await addExtraJob({
    data: { clientId: aurelio, title: "Poda de palmera", amount: 40, date: addDaysISO(today, -1), markDone: true },
  });

  const carmen = await mkClient({
    name: "Carmen Ruiz",
    phone: "305 555 0121",
    address: "48 Garden Avenue",
    pricePerCut: 50,
    startDate: addDaysISO(today, -28),
  });
  await settlePast(carmen, "Carmen", "owe", 2);

  const bruno = await mkClient({
    name: "Bruno Soto",
    phone: "305 555 0132",
    address: "9 Mango Lane",
    pricePerCut: 30,
    startDate: addDaysISO(today, -14),
  });
  await settlePast(bruno, "Bruno", "paid", 2);
}

/** AD10 — Don Aurelio corta hoy, con teléfono y dirección. */
async function comunicacionRuta(): Promise<void> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(id);
}

/** AD11 — una nota fijada y enlazada a Aurelio, una suelta sin fijar, y una en la papelera. */
async function blocNotas(): Promise<void> {
  const today = todayISO();
  const id = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(id);

  const page = await createPadPage({ data: { title: "Poda y materiales", folder: "Trabajo por hacer" } });
  await savePad({
    data: {
      pageId: page.id,
      html: "<p>@Don Aurelio: podar la palmera el sábado. Traer la sierra grande.</p>",
      title: "Poda y materiales",
      folder: "Trabajo por hacer",
      pinned: true,
      clientIds: [id],
    },
  });

  const suelta = await createPadPage({ data: { title: "Materiales del mes", folder: "Materiales" } });
  await savePad({
    data: {
      pageId: suelta.id,
      html: "<p>Cinta, guantes y dos sacos de mantillo.</p>",
      title: "Materiales del mes",
      folder: "Materiales",
      pinned: false,
    },
  });

  const trash = await createPadPage({ data: { title: "Lista vieja", folder: "Materiales" } });
  await savePad({
    data: { pageId: trash.id, html: "<p>Lista de materiales de la temporada pasada.</p>", trashed: true },
  });
}

/** AD12 — un día con cuatro patios (el clima lo pone la lectura viva). */
async function climaDia(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, -2) });
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today });
  await mkClient({ name: "Darío Paz", phone: "305 555 0143", address: "221 Coral Way", pricePerCut: 60, startDate: today });
}

/** Las siembras del grupo C, tal como las citan los pasos `stage` de AD9–AD12. */
export const SEEDS_W2_C: Record<string, () => Promise<void>> = {
  "estudio-cifras": estudioCifras,
  "comunicacion-ruta": comunicacionRuta,
  "bloc-notas": blocNotas,
  "clima-dia": climaDia,
};
