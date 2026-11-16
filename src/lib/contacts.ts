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
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

/** vCard 2.1 QUOTED-PRINTABLE: «Jos=C3=A9» es «José» (bytes UTF-8 en =XX,
 *  con cortes suaves «=\n» que no cortan nada). */
function decodeQuotedPrintable(value: string): string {
  const joined = value.replace(/=\r?\n/g, "");
  try {
    return decodeURIComponent(joined.replace(/=([0-9A-Fa-f]{2})/g, "%$1"));
  } catch {
    return joined.replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
}

function vcardValue(block: string, key: string): string {
  const re = new RegExp(`^${key}(;[^:]*)?:(.*)$`, "im");
  const m = re.exec(block);
  if (!m) return "";
  let v = m[2]!;
  if (/QUOTED-PRINTABLE/i.test(m[1] ?? "")) v = decodeQuotedPrintable(v);
  return v.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

function parseAdr(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.replace(/\\,/g, ",").trim());
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
  if (t.startsWith("{") || t.startsWith("[")) return [];
  return parseCsv(t);
}

export function parseVcard(text: string): PickedContact[] {
  const unfolded = unfoldVcard(text);
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out: PickedContact[] = [];
  for (const block of blocks) {
    const fn = vcardValue(block, "FN") || vcardValue(block, "N").split(";").filter(Boolean).join(" ");
    const tel = vcardValue(block, "TEL");
    const adr = parseAdr(vcardValue(block, "ADR"));
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
  const pushCell = () => {
    row.push(cur.trim());
    cur = "";
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
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") pushCell();
    else if (ch === "\n") pushRow();
    else if (ch !== "\r") cur += ch;
  }
  pushRow();
  return rows;
}

/** El encabezado se reconoce por la fila COMPLETA: una celda ES una palabra
 *  de encabezado (plegada), no «la contiene» — una clienta llamada Telma no
 *  es un encabezado por llevar «tel» dentro. */
const HEADER_WORDS: Record<string, "name" | "phone" | "address"> = {};
for (const w of ["name", "nombre", "nombre completo", "full name", "contacto", "contact"]) HEADER_WORDS[w] = "name";
for (const w of ["phone", "telefono", "tel", "celular", "movil", "mobile", "numero", "numero de telefono", "phone number", "telephone"]) HEADER_WORDS[w] = "phone";
for (const w of ["address", "direccion", "domicilio", "addr"]) HEADER_WORDS[w] = "address";

function foldHead(cell: string): string {
  return cell
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text: string): PickedContact[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0 || !rows.some((r) => r.length >= 2)) return [];
  const head = rows[0]!.map(foldHead);
  const colOf = (kind: "name" | "phone" | "address") => head.findIndex((h) => HEADER_WORDS[h] === kind);
  const nameCol = colOf("name");
  const phoneCol = colOf("phone");
  const addrCol = colOf("address");
  const hasHeader = nameCol >= 0 || phoneCol >= 0;
  const idx = {
    name: hasHeader && nameCol >= 0 ? nameCol : 0,
    phone: hasHeader && phoneCol >= 0 ? phoneCol : 1,
    address: hasHeader ? addrCol : 2,
  };
  const out: PickedContact[] = [];
  for (const cols of hasHeader ? rows.slice(1) : rows) {
    const name = (cols[idx.name] ?? "").trim();
    const phone = (cols[idx.phone] ?? "").trim();
    const address = idx.address >= 0 ? (cols[idx.address] ?? "").trim() : "";
    // Cerca de cordura (BZ-52): sin teléfono de ≥7 dígitos y sin nombre con
    // letras, la fila no nace.
    if (phone.replace(/\D/g, "").length < 7 && !/[a-záéíóúñü]/i.test(name)) continue;
    out.push({ name: name || phone, phone, address });
  }
  return out;
}

export async function pickContactsFromFile(file: File): Promise<PickedContact[]> {
  const text = await file.text();
  const parsed = parseContactFile(text, file.name);
  if (parsed.length === 0) throw new Error("contacts-empty");
  return parsed;
}
