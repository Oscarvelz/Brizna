import { nativePickContacts } from "@/spa/native";

export type PickedContact = {
  name: string;
  phone: string;
  address: string;
};

type ContactAddress = {
  addressLine?: string[];
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

type NativeContact = {
  name?: string[];
  tel?: string[];
  address?: ContactAddress[];
};

type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<NativeContact[]>;
  getProperties?: () => Promise<string[]>;
};

function contactsApi(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts ?? null;
}

export function canPickContacts(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return typeof nav.contacts?.select === "function";
}

function formatAddress(addr?: ContactAddress): string {
  if (!addr) return "";
  const line = (addr.addressLine ?? []).filter(Boolean).join(", ");
  const rest = [addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ");
  return [line, rest].filter(Boolean).join(", ");
}

function mapContact(c: NativeContact): PickedContact | null {
  const name = (c.name ?? []).map((n) => n.trim()).find(Boolean) ?? "";
  const phone = (c.tel ?? []).map((t) => t.trim()).find(Boolean) ?? "";
  const address = formatAddress(c.address?.[0]);
  if (!name && !phone) return null;
  return { name: name || phone, phone, address };
}

/* Ola 5 (BZ-7): si la elección del selector llega tarde (su promesa ya no
 * vive), la cáscara la entrega igual y native.ts la reenvía por este canal;
 * el formulario la aplica como una elección a tiempo. Devuelve el desarmado. */
export function onLatePickedContacts(cb: (picked: PickedContact[]) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = (e: Event) => {
    const d = (e as CustomEvent<{ contacts?: NativeContact[] }>).detail;
    const picked = (d?.contacts ?? []).map(mapContact).filter((c): c is PickedContact => Boolean(c));
    if (picked.length) cb(picked);
  };
  window.addEventListener("briznanative-contacts-late", on);
  return () => window.removeEventListener("briznanative-contacts-late", on);
}

export async function pickPhoneContacts(multiple = false): Promise<PickedContact[]> {
  // android-11: inside the app, the shell picks the contact itself. The WebView's own
  // navigator.contacts exists but its picker fails on real phones — the promise rejected even
  // when the user had picked someone, and the form reported "No se eligió ningún contacto".
  const nativePick = nativePickContacts(multiple);
  if (nativePick) {
    const raw = await nativePick;
    return raw.map(mapContact).filter((c): c is PickedContact => Boolean(c));
  }
  const api = contactsApi();
  if (!api || typeof api.select !== "function") {
    throw new Error("contacts-unavailable");
  }
  const trySelect = async (props: string[]) => {
    const raw = await api.select(props.length ? props : ["name", "tel"], { multiple });
    return raw.map(mapContact).filter((c): c is PickedContact => Boolean(c));
  };
  let requested = ["name", "tel", "address"];
  try {
    if (typeof api.getProperties === "function") {
      const supported = await api.getProperties();
      const allow = new Set(supported.map((p) => p.toLowerCase()));
      requested = ["name", "tel", "address"].filter((p) => allow.has(p));
      if (!requested.includes("name") && !requested.includes("tel")) {
        requested = supported.slice(0, 3);
      }
    }
  } catch {
    requested = ["name", "tel"];
  }
  try {
    return await trySelect(requested);
  } catch (err) {
    if (requested.includes("address")) {
      try {
        return await trySelect(requested.filter((p) => p !== "address"));
      } catch {
        return await trySelect(["name", "tel"]);
      }
    }
    // Backing out of the picker is a choice, not a failure: the form stays silent about it.
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("contacts-cancelled");
    throw err;
  }
}

function unfoldVcard(raw: string): string {
  // 1.6.08 (Prejuicio R3, R3F-6): un corte suave QP («=\n») siempre coincide
  // con un pliegue de línea en vCard — se retira JUNTO con el pliegue, antes
  // de unir. Antes el desplegado pegaba el «=» contra la continuación y el
  // decodificador lo leía como escape («=Fe» → «þ») o lo dejaba colgando
  // («=Garcia») según las dos letras siguientes.
  return raw.replace(/\r\n/g, "\n").replace(/=\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** vCard 2.1 QUOTED-PRINTABLE: «Jos=C3=A9» es «José» (bytes UTF-8 en =XX,
 *  con cortes suaves «=\n» que no cortan nada). */
function decodeQuotedPrintable(value: string): string {
  // 1.6.04 (Prejuicio R2, R2F-12/R2F-13): dos trampas del texto real —
  // un «%» literal en el nombre se protege ANTES de decodificar (si no,
  // decodeURIComponent lanzaba y el camino byte a byte dejaba la UTF-8 como
  // mojibake Latin-1: «100% Andrés» → «100% AndrÃ©s»); y el «=» de un corte
  // suave que el desplegado de líneas pegó contra el primer escape de la
  // continuación («==C3=A9») se retira: en QP un «==» crudo nunca es dato,
  // el «=» literal viaja como =3D.
  const joined = value
    .replace(/=\r?\n/g, "")
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .replace(/=(?==[0-9A-Fa-f]{2})/g, "")
    // 1.6.08 (R3F-6): un «=» que no abre un escape no es dato en QP (el «=»
    // literal viaja como =3D): es resto de un corte suave — se retira.
    .replace(/=(?![0-9A-Fa-f]{2})/g, "");
  try {
    return decodeURIComponent(joined.replace(/=([0-9A-Fa-f]{2})/g, "%$1"));
  } catch {
    return joined.replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
}

/** 1.6.08 (Prejuicio R3, R3F-2): los exportadores de Apple agrupan las
 *  propiedades («item1.TEL», «item1.ADR») — el ancla admite el prefijo de
 *  grupo, o el teléfono y la dirección de esas tarjetas jamás se leían. */
const GROUP_PREFIX = "(?:[A-Za-z0-9-]+\\.)?";

function vcardValue(block: string, key: string): string {
  const re = new RegExp(`^${GROUP_PREFIX}${key}(;[^:]*)?:(.*)$`, "im");
  const m = re.exec(block);
  if (!m) return "";
  let v = m[2]!;
  if (/QUOTED-PRINTABLE/i.test(m[1] ?? "")) v = decodeQuotedPrintable(v);
  return v.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

/** El valor con los escapes INTACTOS (solo QP decodificado): ADR lo parte
 *  por sus «;» de verdad antes de desescapar cada componente. */
function vcardRawValue(block: string, key: string): string {
  const re = new RegExp(`^${GROUP_PREFIX}${key}(;[^:]*)?:(.*)$`, "im");
  const m = re.exec(block);
  if (!m) return "";
  let v = m[2]!;
  if (/QUOTED-PRINTABLE/i.test(m[1] ?? "")) v = decodeQuotedPrintable(v);
  return v.trim();
}

/** 1.6.04 (Prejuicio R2, R2F-10/R2F-11): el teléfono de la tarjeta es el
 *  primer TEL con un número de verdad — antes mandaba el primero aunque
 *  viniera vacío (un FAX vacío delante dejaba el móvil sin leer) — y un
 *  valor URI de vCard 4.0 («tel:+1-…») se guarda sin el prefijo. */
function vcardPhone(block: string): string {
  // 1.6.12 (Prejuicio R3, R4F-6): el TYPE de la tarjeta manda — un FAX con
  // número delante del móvil ganaba por orden, aunque la tarjeta declara
  // el bueno TYPE=CELL. Se prefiere el declarado celular; luego cualquiera
  // que no sea fax; el fax solo si no hay otra cosa con número.
  const entries: { v: string; fax: boolean; cell: boolean }[] = [];
  const re = new RegExp(`^${GROUP_PREFIX}TEL(;[^:]*)?:(.*)$`, "gim");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    let v = m[2]!;
    const params = (m[1] ?? "").toUpperCase();
    if (/QUOTED-PRINTABLE/i.test(params)) v = decodeQuotedPrintable(v);
    entries.push({
      v: v.replace(/^tel:/i, "").trim(),
      fax: /(^|[;:,"'])FAX([;:,"']|$)/.test(params),
      cell: /(^|[;:,"'])(CELL|MOBILE)([;:,"']|$)/.test(params),
    });
  }
  const real = entries.filter((e) => e.v.replace(/\D/g, "").length >= 7);
  const pick = real.find((e) => e.cell) ?? real.find((e) => !e.fax) ?? real[0];
  return pick?.v ?? entries.find((e) => e.v !== "")?.v ?? "";
}

/** Parte por «;» respetando los escapes: un «\;» dentro de la calle es un
 *  carácter, no un separador (R2F-14: desescapar ANTES de partir corría
 *  cada componente un hueco y el código postal se caía del final). */
function splitEscaped(raw: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (ch === "\\" && i + 1 < raw.length) {
      cur += ch + raw[i + 1];
      i += 1;
    } else if (ch === ";") {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function unescapeVcard(v: string): string {
  return v.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

function parseAdr(raw: string): string {
  if (!raw) return "";
  const parts = splitEscaped(raw).map(unescapeVcard);
  const street = [parts[1], parts[2]].filter(Boolean).join(" ");
  const city = [parts[3], parts[4], parts[5]].filter(Boolean).join(", ");
  return [street, city].filter(Boolean).join(", ");
}

export function parseContactFile(text: string, fileName = ""): PickedContact[] {
  // 1.6.00 (campaña Prejuicio, BZ-52): el enrutado es por CONTENIDO, no por
  // la extensión ni por «lleva comas»: vCard si trae tarjetas; JSON jamás es
  // una lista de contactos; el resto se intenta como CSV de verdad.
  void fileName;
  const t = text.trim();
  if (!t) return [];
  if (/BEGIN:VCARD/i.test(t)) return parseVcard(t);
  // 1.6.04 (Prejuicio R2, R2F-9): JSON se reconoce porque PARSEA como JSON,
  // no por el primer carácter — un CSV que abre con una línea entre
  // corchetes («[notas del dueño]») se descartaba entero como si fuera JSON.
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      JSON.parse(t);
      return [];
    } catch {
      /* no era JSON: sigue como CSV */
    }
  }
  return parseCsv(t);
}

export function parseVcard(text: string): PickedContact[] {
  const unfolded = unfoldVcard(text);
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out: PickedContact[] = [];
  for (const block of blocks) {
    const fn = vcardValue(block, "FN") || vcardValue(block, "N").split(";").filter(Boolean).join(" ");
    const tel = vcardPhone(block);
    const adr = parseAdr(vcardRawValue(block, "ADR"));
    // Cerca de cordura (BZ-52): sin FN y sin teléfono de ≥7 dígitos, la
    // tarjeta no nace.
    if (!fn.trim() && tel.replace(/\D/g, "").length < 7) continue;
    out.push({ name: fn.trim() || tel.trim(), phone: tel.trim(), address: adr });
  }
  return out;
}

/** Lector CSV sobre el texto entero: las comillas protegen comas, puntos y
 *  coma y SALTOS DE LÍNEA (una dirección entrecomillada con «\n» dentro es una
 *  sola celda, no un cliente inventado). */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  // 1.6.04 (Prejuicio R2, R2F-7): una comilla solo abre o cierra AL BORDE de
  // la celda (al empezar la celda, como manda CSV). Antes cualquier comilla
  // en cualquier sitio cambiaba el estado: un apodo con una sola comilla
  // («Ana "La Reina») dejaba el lector «dentro de comillas» hasta el fin del
  // archivo y la lista entera colapsaba a una celda — 0 contactos de 3.
  let fieldStart = true;
  const pushCell = () => {
    row.push(cur.trim());
    cur = "";
    fieldStart = true;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') q = false;
      else if (ch === "\r") {
        // R2F-16: dentro de una celda entrecomillada el salto se guarda como
        // «\n», la convención de la casa — nunca el «\r\n» crudo del archivo.
        cur += "\n";
        if (text[i + 1] === "\n") i += 1;
      } else cur += ch;
    } else if (ch === '"' && fieldStart) q = true;
    else if (ch === "," || ch === ";") pushCell();
    else if (ch === "\n") pushRow();
    else if (ch !== "\r") {
      cur += ch;
      fieldStart = false;
    }
  }
  pushRow();
  return rows;
}

/** El encabezado se reconoce por la fila COMPLETA: una celda ES una palabra
 *  de encabezado (plegada), no «la contiene» — una clienta llamada Telma no
 *  es un encabezado por llevar «tel» dentro. */
const HEADER_WORDS: Record<string, "name" | "phone" | "address" | "first" | "last"> = {};
// 1.6.04 (Prejuicio R2, R2F-6): el vocabulario crece con los encabezados que
// los exportadores reales usan — «Client Name» no estaba y la columna del
// nombre jamás se leía: cada contacto nacía nombrado por su teléfono.
for (const w of ["name", "nombre", "nombre completo", "full name", "contacto", "contact", "client name", "customer name", "contact name", "nombre y apellido", "nombre del cliente", "client", "customer"]) HEADER_WORDS[w] = "name";
for (const w of ["phone", "telefono", "tel", "celular", "movil", "mobile", "numero", "numero de telefono", "phone number", "telephone", "phone 1 value", "phone 2 value", "mobile phone", "cell phone", "telefono movil", "numero de celular"]) HEADER_WORDS[w] = "phone";
for (const w of ["address", "direccion", "domicilio", "addr"]) HEADER_WORDS[w] = "address";
// 1.6.08 (Prejuicio R3, R3F-3): el nombre partido en dos columnas (la forma
// de Outlook: «First Name,Last Name,Phone») — sin estas dos palabras el
// apellido jamás se leía y cada contacto nacía con medio nombre.
for (const w of ["first name", "nombre de pila", "given name"]) HEADER_WORDS[w] = "first";
for (const w of ["last name", "apellido", "apellidos", "family name", "surname"]) HEADER_WORDS[w] = "last";

function foldHead(cell: string): string {
  return cell
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // 1.6.12 (Prejuicio R3, R4F-2): la puntuación INTERIOR también se
    // normaliza a espacios — «Phone 1 - Value» (el export de Google
    // Contacts) pliega a «phone 1 value», palabra de vocabulario; antes
    // solo se limpiaban los bordes (R3F-5b) y ese encabezado no existía
    // para el lector.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseCsv(text: string): PickedContact[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0 || !rows.some((r) => r.length >= 2)) return [];
  // 1.6.04 (Prejuicio R2, R2F-8): el encabezado se busca en las primeras
  // filas, no solo en la primera — una línea de título delante («Exportado
  // de mi teléfono») nacía como cliente y la fila del encabezado real nacía
  // como una clienta llamada «Nombre». Una fila es encabezado cuando dos de
  // sus celdas son palabras de encabezado, o una lo es y la fila no trae
  // ningún número con pinta de teléfono que la delate como dato.
  let headAt = -1;
  // 1.6.08 (R3F-5a): la ventana de búsqueda sube a 10 filas — con cinco
  // líneas de título delante, el encabezado real caía fuera de la ventana
  // de 5 y nacía como un cliente llamado «Nombre».
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const cells = rows[i]!.map(foldHead);
    const known = cells.filter((c) => HEADER_WORDS[c]).length;
    const phoneLike = cells.some((c) => c.replace(/\D/g, "").length >= 7);
    if (known >= 2 || (known === 1 && !phoneLike)) {
      headAt = i;
      break;
    }
  }
  const head = headAt >= 0 ? rows[headAt]!.map(foldHead) : [];
  const colOf = (kind: "name" | "phone" | "address" | "first" | "last") => head.findIndex((h) => HEADER_WORDS[h] === kind);
  const nameCol = colOf("name");
  const firstCol = colOf("first");
  const lastCol = colOf("last");
  const phoneCol = colOf("phone");
  const addrCol = colOf("address");
  const hasHeader = headAt >= 0 && (nameCol >= 0 || phoneCol >= 0 || firstCol >= 0 || lastCol >= 0);
  const idx = {
    name: hasHeader && nameCol >= 0 ? nameCol : 0,
    // 1.6.12 (R4F-2): con encabezado reconocido y columna de teléfono NO
    // reconocida, el teléfono honesto es «ninguno» (phoneCol = −1 y la
    // lectura da "") — la caída posicional a la columna 1 FABRICABA un
    // teléfono con el nombre de pila en los exports cuyo encabezado de
    // teléfono el vocabulario no conocía. La posición solo vale sin
    // encabezado, donde es la única pista que hay.
    phone: hasHeader ? phoneCol : 1,
    address: hasHeader ? addrCol : 2,
  };
  const out: PickedContact[] = [];
  for (const cols of hasHeader ? rows.slice(headAt + 1) : rows) {
    // Una fila de una sola celda en un archivo de varias columnas es una
    // línea suelta (un título, una nota), no una persona: no nace.
    if (cols.length < 2) continue;
    // 1.6.08 (R3F-3): sin columna de nombre completo pero con nombre y
    // apellido partidos, el nombre nace entero de las dos columnas.
    const name = (
      hasHeader && nameCol < 0 && (firstCol >= 0 || lastCol >= 0)
        ? [firstCol >= 0 ? cols[firstCol] : "", lastCol >= 0 ? cols[lastCol] : ""].filter(Boolean).join(" ")
        : (cols[idx.name] ?? "")
    ).trim();
    const phone = (cols[idx.phone] ?? "").trim();
    const address = idx.address >= 0 ? (cols[idx.address] ?? "").trim() : "";
    // Cerca de cordura (BZ-52, endurecida en 1.6.04 por R2F-15): la fila
    // nace solo con un nombre que trae una letra DE VERDAD (cualquier
    // alfabeto, vía \p{L}) — una columna de puros números no es un nombre:
    // una lista de solo teléfonos ya no pare contactos llamados como un
    // número, y una fila sin nombre no se bautiza con su teléfono.
    if (!/\p{L}/u.test(name)) continue;
    out.push({ name, phone, address });
  }
  return out;
}

export async function pickContactsFromFile(file: File): Promise<PickedContact[]> {
  const text = await file.text();
  const parsed = parseContactFile(text, file.name);
  if (parsed.length === 0) throw new Error("contacts-empty");
  return parsed;
}
