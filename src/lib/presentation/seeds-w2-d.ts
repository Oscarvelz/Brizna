/**
 * seeds-w2-d — las siembras de la ola 2, grupo D (AD13–AD16).
 *
 * Mismo patrón que stage-seeds.ts: corren sobre el libro-escenario VACÍO y
 * sellado, con creación llana vía las funciones de servidor de la casa
 * (createClient; clientInput admite openingBalance — la deuda anterior que
 * entra directa en Por cobrar). Fechas relativas a hoy con los ayudantes de
 * la casa: la ficción cae hoy / hace 2 días / mañana en cualquier aparato.
 * Números de lección, redondos: Don Aurelio $40 el corte; las deudas del
 * teatro de widgets son $120, $80 y $40 (total $240 en Por cobrar).
 *
 * stageCtx.aurelioId guarda el id del cliente continuo para los pasos `go`
 * con `:aurelio`, igual que en el piso Quick.
 */
import { addDaysISO, todayISO, weekdayFromISO } from "@/lib/dates";
import { createClient } from "@/lib/server/lawn";
import { stageCtx } from "./stage-seeds.ts";

type NewClient = {
  name: string;
  phone?: string;
  address?: string;
  pricePerCut: number;
  startDate: string;
  openingBalance?: number;
};

/** Alta llana de un cliente regular quincenal en el escenario. */
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
      paySameDay: false,
      openingBalance: c.openingBalance ?? 0,
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
 * ruta-manos — el día de AD13: Don Aurelio y Bruno Soto cortan hoy (dos
 * patios pendientes dan asa verdadera a la ruta), y Carmen Ruiz lleva su
 * primer corte hace 2 días sin hacer → atrasada, fijada arriba por la
 * propia app, con sus puntos quietos (el asa que miente).
 */
async function rutaManos(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today });
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, -2) });
}

/**
 * ruta-ajustes — la ficción mínima de AD14: Don Aurelio corta hoy, para
 * que ninguna pantalla de Ajustes se enseñe sobre una app vacía. Los
 * pliegues no necesitan más datos que este.
 */
async function rutaAjustes(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
}

/**
 * ruta-datos — el libro de AD15: Don Aurelio debe $120 de antes (entra
 * como deuda anterior, directa en Por cobrar) y corta hoy; Bruno Soto
 * corta hoy también. Una copia de este libro se puede enseñar sin tocar
 * jamás el botón que la guarda de verdad.
 */
async function rutaDatos(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today, openingBalance: 120 });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today });
}

/**
 * ruta-widget — el día del teatro de AD16, pensado para la foto
 * (getNativePlan → buildWidget):
 *  - Hoy cortan Don Aurelio ($40), Bruno Soto ($30) y Darío Paz ($60):
 *    el widget Hoy enseña conteo, próximos y lista al estirarlo.
 *  - Carmen Ruiz empezó hace 2 días sin hacer su corte: atrasada — la
 *    línea de alerta de los tamaños grandes y del Panel tiene qué decir.
 *  - Las deudas anteriores ($120 Carmen, $80 Bruno, $40 Darío) llenan el
 *    bloque Por cobrar ($240) y la lista de deudores del Panel.
 *  - Elena Mar empieza mañana y Darío corta también en 3 días: la tira
 *    de Semana enseña días con y sin cortes.
 */
async function rutaWidget(): Promise<void> {
  const today = todayISO();
  const aurelio = await mkClient({ ...AURELIO, startDate: today });
  stageCtx.aurelioId = String(aurelio);
  await mkClient({ name: "Bruno Soto", phone: "305 555 0132", address: "9 Mango Lane", pricePerCut: 30, startDate: today, openingBalance: 80 });
  await mkClient({ name: "Carmen Ruiz", phone: "305 555 0121", address: "48 Garden Avenue", pricePerCut: 50, startDate: addDaysISO(today, -2), openingBalance: 120 });
  await mkClient({ name: "Darío Paz", phone: "305 555 0143", address: "221 Coral Way", pricePerCut: 60, startDate: today, openingBalance: 40 });
  await mkClient({ name: "Elena Mar", phone: "305 555 0154", address: "7 Ocean Drive", pricePerCut: 35, startDate: addDaysISO(today, 1) });
}

/** Las siembras del grupo D, tal como las citan los pasos `stage`. */
export const SEEDS_W2_D: Record<string, () => Promise<void>> = {
  "ruta-manos": rutaManos,
  "ruta-ajustes": rutaAjustes,
  "ruta-datos": rutaDatos,
  "ruta-widget": rutaWidget,
};
