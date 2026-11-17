import { nativePickContacts } from "@/spa/native";
import { digitsOf, foldText } from "@/lib/dup-match";

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
  // 1.6.19 (Prejuicio R6, R7F-11): el dialecto SIN espacio de pliegue —
  // varios exportadores 2.1 parten la línea tras el «=» y continúan al
  // margen. La propiedad QP que acaba en «=» une la línea siguiente
  // ANTES de extraer valores; sin esto, el valor se truncaba en el
  // corte y lo que seguía se perdía («José García» nacía «JosÃ»).
  const physical = raw.replace(/\r\n/g, "\n").split("\n");
  const logical: string[] = [];
  for (const line of physical) {
    const prev = logical[logical.length - 1];
    const prevQp = prev !== undefined && /QUOTED-PRINTABLE/i.test(prev.split(":")[0] ?? "");
    // 1.6.19 (R7F-11, el otro dialecto): la línea que no tiene forma de
    // propiedad (no empieza por nombre[;params]:) y sigue a una
    // propiedad QP ES su continuación, acabe o no la anterior en «=».
    const looksProperty = /^[A-Za-z][A-Za-z0-9.-]*[;:]/.test(line);
    if (prev !== undefined && prevQp && !/^[ \t]/.test(line) && (prev.endsWith("=") || !looksProperty)) {
      logical[logical.length - 1] = (prev.endsWith("=") ? prev.slice(0, -1) : prev) + line;
    } else {
      logical.push(line);
    }
  }
  return logical.join("\n").replace(/=\n[ \t]/g, "").replace(/\n[ \t]/g, "");
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
  // 1.6.14 (Prejuicio R4, R5F-2): aquella cura estaba ROTA — las banderas
  // se buscaban con una clase delimitadora sin «=», y en la forma estándar
  // (TYPE=FAX, TYPE=CELL: Apple, Google, vCard 4.0) el token va pegado al
  // «=», así que ninguna bandera se leía nunca y el fax ganaba por orden.
  // Ahora los parámetros se trocean de verdad: cada segmento se lee por
  // su valor tras el «=» (o el token desnudo 2.1), partido por comas.
  const tokensOf = (params: string): string[] =>
    params
      .split(/[;:]/)
      .flatMap((p) => {
        const v = p.includes("=") ? p.slice(p.indexOf("=") + 1) : p;
        return v.split(",").map((t) => t.trim().replace(/^"|"$/g, ""));
      })
      .filter(Boolean);
  const entries: { v: string; fax: boolean; cell: boolean }[] = [];
  const re = new RegExp(`^${GROUP_PREFIX}TEL(;[^:]*)?:(.*)$`, "gim");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    let v = m[2]!;
    const params = (m[1] ?? "").toUpperCase();
    if (/QUOTED-PRINTABLE/i.test(params)) v = decodeQuotedPrintable(v);
    const tokens = tokensOf(params);
    entries.push({
      v: v.replace(/^tel:/i, "").trim(),
      fax: tokens.includes("FAX"),
      cell: tokens.some((t) => t === "CELL" || t === "MOBILE" || t === "CELLULAR"),
    });
  }
  const real = entries.filter((e) => digitsOf(e.v).replace(/\D/g, "").length >= 7);
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
    if (!fn.trim() && digitsOf(tel).replace(/\D/g, "").length < 7) continue;
    out.push({ name: fn.trim() || tel.trim(), phone: tel.trim(), address: adr });
  }
  return out;
}

/** Lector CSV sobre el texto entero: las comillas protegen comas, puntos y
 *  coma y SALTOS DE LÍNEA (una dirección entrecomillada con «\n» dentro es una
 *  sola celda, no un cliente inventado). */
function splitCsvRows(text: string): string[][] {
  // 1.6.22 (Prejuicio R7, R8F-5): los finales Mac clásicos (solo
  // «\r») colapsaban el archivo entero en un cliente basura cosido
  // con trozos de todos — el lector solo partía en «\n». Todo final
  // se normaliza a «\n» al entrar; dentro de una celda citada el
  // salto queda como «\n», la convención de la casa (R2F-16).
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 1.6.16 (Prejuicio R5, R6F-9): un export separado por TABULADORES
  // (Excel/CRM) importaba cero — el lector solo partía por coma o
  // punto y coma. El delimitador se huele en la primera línea: si
  // los tabuladores mandan, manda el tabulador en todo el archivo.
  const firstNl = text.indexOf("\n");
  const firstLine = firstNl < 0 ? text : text.slice(0, firstNl);
  void firstLine;
  // 1.6.19 (Prejuicio R6, R7F-5): la olida cuenta FUERA de las comillas —
  // una celda citada con tabuladores dentro («"Lista\tde\tclientes"»)
  // inclinaba la cuenta y un CSV de comas entero se partía por
  // tabulador e importaba cero.
  let bare = "";
  let inQ = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]!;
    if (inQ) {
      if (ch === '"') {
        if (firstLine[i + 1] === '"') i++;
        else inQ = false;
      }
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    bare += ch;
  }
  const tabs = (bare.match(/\t/g) ?? []).length;
  const commas = (bare.match(/,/g) ?? []).length + (bare.match(/;/g) ?? []).length;
  // 1.6.22 (Prejuicio R7, R8F-2/R8F-6): la olida de una sola línea
  // volvía a caer — un título SIN comillas con tabuladores dentro
  // (el tabulador no es especial en un CSV de comas y se exporta a
  // secas) inclinaba la cuenta y el archivo entero se partía por
  // tabulador. Ahora la olida mira las primeras ocho líneas y gana
  // el delimitador presente en MÁS líneas (el título es una; los
  // datos son las demás), y conoce la barra vertical «|», que
  // importaba cero en silencio.
  let delim = tabs > 0 && tabs >= commas ? "\t" : ",";
  {
    const bareLine = (line: string): string => {
      let out = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (q) {
          if (ch === '"') {
            if (line[i + 1] === '"') i++;
            else q = false;
          }
          continue;
        }
        if (ch === '"') { q = true; continue; }
        out += ch;
      }
      return out;
    };
    // 1.6.42 (Prejuicio R11, R12F-3/R12F-4): las tres ventanas
    // cuentan FILAS, como el lector — una celda citada multilínea
    // es una fila en varias líneas físicas, y contando líneas el
    // encabezado de la fila 40 caía en la línea 42, fuera de cuenta
    // y muestra. Y la ventana sube a 200 filas: el borde de 40 lo
    // llenaba cualquier preámbulo de informe entero. El borde
    // nuevo es 200, declarado como el anterior.
    const rowGroups = (t: string): string[] => {
      const groups: string[] = [];
      let cur = "";
      let curStart = 0;
      let q = false;
      let fieldStart = true;
      for (let i = 0; i < t.length; i += 1) {
        const ch = t[i]!;
        if (ch === "\n" && !q) { groups.push(cur); cur = ""; curStart = i + 1; fieldStart = true; continue; }
        cur += ch;
        if (q) {
          if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i += 1; } else q = false; }
        } else if (ch === '"' && fieldStart) q = true;
        else if (ch === "\t" || ch === "," || ch === ";" || ch === "|") fieldStart = true;
        else if (ch !== "\r") fieldStart = false;
      }
      // 1.6.46 (Prejuicio R12, R13F-8): si el texto termina con una
      // comilla aún abierta, la agrupación entera es sospechosa —
      // una comilla huérfana tras un delimitador ajeno («Nota|"sin
      // cerrar») cosía el archivo en un solo grupo y bareLine
      // descartaba todo lo «citado»: el archivo entero, y la cuenta
      // quedaba ciega. Una comilla que no cierra es entrada
      // malformada: se cae a las líneas físicas y el daño queda
      // confinado a su línea, como antes de contar por filas.
      // 1.6.48 (Prejuicio R13, R14F-6): la caída ya no vuelca el
      // archivo entero a líneas físicas — los grupos que SÍ
      // cerraron conservan su lectura citada, y solo la cola (el
      // grupo que nunca cerró, desde curStart) cae a líneas: el
      // daño queda confinado a su línea de verdad, y un archivo de
      // comas con celdas multilínea no pierde su delimitador por
      // una huérfana al final.
      if (q) return [...groups, ...t.slice(curStart).split("\n")];
      groups.push(cur);
      return groups;
    };
    const allGroups = rowGroups(text);
    let tabLines = 0, commaLines = 0, pipeLines = 0, tabTotal = 0, commaTotal = 0, pipeTotal = 0;
    // 1.6.32 (Prejuicio R10, R11F-1/R11F-5): la cuenta mira 40 líneas,
    // como los testigos y el lector — en 10, el empate de declarantes
    // se decidía sobre un mundo que nadie más veía, y un preámbulo de
    // 25 llenaba las tres ventanas a la vez. El borde nuevo es 40.
    // 1.6.42: la cuenta mira las primeras 200 FILAS (rowGroups).
    // 1.6.46 (Prejuicio R12, R13F-4): la ventana ya no existe — la
    // cuenta, la muestra y la corona leen el archivo ENTERO. El
    // borde de 200 se corrió como el de 40: declarado y mordiendo
    // igual a las 205 filas. Sin ventana no hay fila donde el
    // encabezado pueda esconderse; el coste es una pasada lineal
    // más sobre un texto que ya está en memoria.
    for (const line of allGroups) {
      const b = bareLine(line);
      const t = (b.match(/\t/g) ?? []).length;
      const c = (b.match(/[,;]/g) ?? []).length;
      const pp = (b.match(/\|/g) ?? []).length;
      if (t) tabLines++;
      if (c) commaLines++;
      if (pp) pipeLines++;
      tabTotal += t; commaTotal += c; pipeTotal += pp;
    }
    const score = (lines: number, total: number) => lines * 1000 + total;
    if (score(tabLines, tabTotal) > score(commaLines, commaTotal) && score(tabLines, tabTotal) >= score(pipeLines, pipeTotal)) delim = "\t";
    else if (score(pipeLines, pipeTotal) > score(commaLines, commaTotal)) delim = "|";
    else delim = ",";
    // 1.6.25 (Prejuicio R8, R9F-7/R9F-8): la cuenta ya no decide
    // sola — dos testigos la confirman o la corrigen, en orden.
    // (1) EL ENCABEZADO: si partir las primeras diez líneas con un
    // candidato deja ver la fila de encabezado que el lector va a
    // buscar (su misma regla), ese candidato es el delimitador:
    // un preámbulo de informe con tabuladores llenaba la ventana
    // y el archivo se partía por tabulador antes de que una línea
    // de datos votara; y un título con comas inclinaba el total
    // contra la barra, porque el total contaba también las comas
    // que viven DENTRO de las direcciones.
    // (2) EL TELÉFONO: sin encabezado a la vista, el delimitador
    // cuya segunda columna trae números con pinta de teléfono es
    // el bueno — es la lectura posicional que el importador hará.
    // Si ningún testigo habla, manda la cuenta de siempre.
    const scores: Record<string, number> = { "\t": score(tabLines, tabTotal), "|": score(pipeLines, pipeTotal), ",": score(commaLines, commaTotal) };
    // 1.6.28 (Prejuicio R9, R10F-1/R10F-2): la muestra de los testigos
    // sube a 25 líneas, la misma ventana que el lector da a su
    // búsqueda de encabezado — un preámbulo de diez ya no la llena.
    // 1.6.32 (Prejuicio R10, R11F-5): la muestra sube a 40, alineada
    // con la cuenta y con el lector.
    // 1.6.42: la muestra son las primeras 200 FILAS (rowGroups).
    // 1.6.46: la muestra es el archivo entero (R13F-4, arriba).
    const sample = allGroups;
    // 1.6.48 (Prejuicio R13, R14F-7): la olida leía el archivo
    // entero unas ocho-diez veces (cada candidato reparseaba cada
    // línea, y headerInfo construía dos parseos por candidato):
    // 16,5 s de hilo principal con 60 000 filas. El parteo de una
    // línea por delimitador se cachea — cada par (línea,
    // delimitador) se parte una sola vez en toda la olida.
    const splitCache = new Map<string, string[]>();
    const splitFor = (line: string, d: string): string[] => {
      const key = d + "\u0001" + line;
      const hit = splitCache.get(key);
      if (hit) return hit;
      const out = splitForRaw(line, d);
      splitCache.set(key, out);
      return out;
    };
    const splitForRaw = (line: string, d: string): string[] => {
      const cells: string[] = [];
      let cur = "";
      let q = false;
      let fieldStart = true;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!;
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"' && fieldStart) q = true;
        else if (ch === d || (d === "," && ch === ";")) { cells.push(cur); cur = ""; fieldStart = true; }
        else if (ch !== "\r") { cur += ch; fieldStart = false; }
      }
      cells.push(cur);
      return cells;
    };
    // 1.6.28 (Prejuicio R9, R10F-1/R10F-3): el testigo del encabezado
    // aplica LA REGLA DEL LECTOR, no una prima suya (≥2 conocidas, o
    // 1 sin teléfono a la vista — antes pedía 2 y la rendija entre
    // las dos reglas volvía a perder archivos), y exige DATOS debajo
    // de la fila declarada: una línea de portada que lista columnas
    // con barras («Telefono | Direccion») declara en el vacío —
    // ninguna fila posterior parte en ≥2 celdas con ese delimitador
    // — y ya no corona a nadie. Devuelve cuántas palabras conocidas
    // trae la fila declarada (−1: no declara): entre declarantes
    // manda el que más palabras ve, porque el preámbulo
    // «Origen⇥Telefono» declara con una y el encabezado real con
    // dos o tres.
    const allRows = allGroups;
    const headerInfo = (d: string): number => {
      const rowsD = sample.map((line) => splitFor(line, d));
      const fullD = allRows.map((line) => splitFor(line, d));
      for (let i = 0; i < rowsD.length; i += 1) {
        const cells = rowsD[i]!.map(foldHead);
        const known = cells.filter((c) => HEADER_WORDS[c]).length;
        if (known === 0) continue;
        const phoneLike = rowsD[i]!.some((c) => digitsOf(c).replace(/\D/g, "").length >= 7);
        if (!(known >= 2 || (known === 1 && !phoneLike))) continue;
        // 1.6.32 (Prejuicio R10, R11F-2/R11F-3/R11F-4): «datos debajo»
        // ya no es UNA fila cualquiera dentro de la muestra — es un
        // CUERPO: al menos dos filas que parten en ≥2 celdas, y la
        // mayoría (≥60%) de las filas no vacías que quedan en el
        // ARCHIVO ENTERO bajo la declarada. Un rótulo de preámbulo
        // con su eco en una dirección ya no sostiene una coronación;
        // una tabla verdadera sostiene la suya hasta el final.
        // 1.6.42 (Prejuicio R11, R12F-1/R12F-2): el cuerpo se juzga
        // fila a fila, no por el corte a secas. (a) Una fila cuyas
        // celdas llevan TABULADORES dentro no es de esta tabla —
        // es una fila de la tabla de tabuladores partida por la
        // puntuación de sus datos (los apellidos invertidos
        // «Torres, Ana»): para todo candidato que no sea el
        // tabulador, esas filas salen del cuerpo Y del denominador.
        // (b) Una fila de cuerpo tiene forma de PERSONA: trae un
        // número con pinta de teléfono, o un nombre de dos palabras,
        // o tres celdas con contenido. Las líneas etiqueta⇥valor de
        // un preámbulo («Clave5⇥Valor5») parten en dos y no son
        // ninguna de las tres cosas: el preámbulo ya no se da
        // cuerpo a sí mismo.
        const belowAll = fullD.slice(i + 1).filter((r) => r.some((c) => c.trim() !== ""));
        const below = d === "\t" ? belowAll : belowAll.filter((r) => !r.some((c) => c.includes("\t")));
        const personRow = (r: string[]): boolean => {
          const cells = r.filter((c) => c.trim() !== "");
          if (cells.length < 2) return false;
          if (r.some((c) => digitsOf(c).replace(/\D/g, "").length >= 7)) return true;
          const words = (c: string) => c.trim().split(/\s+/).filter(Boolean).length;
          const letterWords = (c: string) => c.trim().split(/\s+/).filter((w) => /[^\d]/.test(w)).length;
          // 1.6.46 (Prejuicio R12, R13F-2): la rama «tres celdas» ya
          // no basta por el conteo — una fila etiqueta,valor,nota
          // («Clave1,Valor1,Nota1») tiene tres celdas y ninguna es
          // una persona: hace falta una celda con dos palabras (la
          // dirección, el nombre completo) o el teléfono de arriba.
          // 1.6.48 (Prejuicio R13, R14F-1): las dos palabras testifican
          // solo en los asientos de una persona — el nombre (primera
          // celda) o la dirección (la segunda, o cualquier celda con
          // su número de casa). La nota vive al final y el valor en
          // medio de la fila etiqueta: «No llamar» y «Sin saldo»
          // volvían a dar cuerpo al preámbulo contando palabras en
          // cualquier celda. La dirección sin número en el segundo
          // asiento testifica solo si el primero es un nombre pelado
          // (sin dígito, sin vocabulario): «Clave1» es una etiqueta
          // con serie, no un nombre.
          if (cells.length >= 3) {
            if (words(cells[0]!) >= 2) return true;
            if (cells.some((c) => /\d/.test(c) && letterWords(c) >= 2)) return true;
            return words(cells[1]!) >= 2 && !/\d/.test(cells[0]!) && !HEADER_WORDS[foldHead(cells[0]!)];
          }
          // 1.6.46 (Prejuicio R12, R13F-1): la tabla de dos celdas
          // nombre+dirección con nombres de pila («Ana,Calle Sol 1»)
          // SÍ es un cuerpo: la segunda celda con dos palabras (la
          // dirección) la sostiene, siempre que la primera no sea
          // una palabra del vocabulario — el par etiqueta⇥valor
          // («Direccion,Calle Sol 1») sigue sin darse cuerpo.
          // 1.6.48 (Prejuicio R13, R14F-2): la rama lee las celdas
          // COMPACTADAS (cells), no las posiciones crudas — una
          // columna Id vacía delante o una celda vacía en medio
          // movía la dirección fuera de r[1] y la fila perdía su
          // forma de persona.
          if (words(cells[0]!) >= 2) return true;
          return !HEADER_WORDS[foldHead(cells[0]!)] && words(cells[1]!) >= 2;
        };
        const bodyRows = below.filter(personRow);
        if (!(bodyRows.length >= 2 && bodyRows.length * 5 >= below.length * 3)) continue;
        // 1.6.32 (Prejuicio R10, R11F-1): la promesa del teléfono —
        // si la fila declarada NOMBRA una columna de teléfonos, el
        // cuerpo debe traer al menos un número con pinta de teléfono
        // en esa columna. El preámbulo «Origen⇥Telefono» promete una
        // y su cuerpo trae «Valor1…Valor11»: promesa vacía, no
        // declara. Un encabezado que no nombra teléfonos no promete
        // nada y no se le exige.
        const phoneColsD = cells.map((c, j) => (HEADER_WORDS[c] === "phone" ? j : -1)).filter((j) => j >= 0);
        if (phoneColsD.length > 0 && !bodyRows.some((r) => phoneColsD.some((j) => digitsOf(r[j] ?? "").replace(/\D/g, "").length >= 7))) continue;
        return known;
      }
      return -1;
    };
    // 1.6.28 (Prejuicio R9, R10F-4): el testigo del teléfono exige una
    // columna CONSISTENTE de teléfonos de verdad — la misma posición
    // trae un teléfono (solo dígitos y su puntuación, 7–15) en al
    // menos dos filas. Un fragmento de dirección (« Apt 1234567»)
    // trae letras y ya no certifica al delimitador equivocado.
    const phoneColWith = (d: string): boolean => {
      const counts = new Map<number, number>();
      for (const line of sample) {
        // 1.6.42 (Prejuicio R11, R12F-1): una fila encabezada por
        // una palabra del vocabulario («Contacto⇥3055550199», la
        // línea del teléfono del dueño en el preámbulo) no es una
        // fila de la tabla y no certifica su columna: el preámbulo
        // ya no se certifica a sí mismo.
        const cells0 = splitFor(line, d);
        if (cells0.length > 0 && HEADER_WORDS[foldHead(cells0[0]!)]) continue;
        cells0.forEach((c, j) => {
          const t = c.trim();
          if (/^[+\d][\d\s().-]*$/.test(t)) {
            const n = t.replace(/\D/g, "").length;
            if (n >= 7 && n <= 15) counts.set(j, (counts.get(j) ?? 0) + 1);
          }
        });
      }
      return [...counts.values()].some((v) => v >= 2);
    };
    // 1.6.32 (Prejuicio R10, R11F-6): la certificación del teléfono
    // se anula cuando las celdas del candidato llevan TABULADORES
    // dentro en ≥2 filas — partir un archivo de tabuladores por
    // comas deja los tabuladores enteros dentro de las celdas, y un
    // número desnudo dentro de una dirección aprobaba el examen
    // estricto en la columna equivocada. (La inversa no corre: las
    // comas dentro de un archivo de tabuladores son prosa inocente.)
    const certified = (d: string): boolean => {
      if (!phoneColWith(d)) return false;
      if (d === "\t") return true;
      // Los tabuladores se cuentan en el CUERPO (bajo la fila que el
      // candidato declara, si declara): el preámbulo de tabuladores
      // sobre una tabla de comas no envenena a la coma — sus datos,
      // sí (R11F-6: allí ninguna fila declara y cuenta todo).
      let from = 0;
      const rowsD = sample.map((line) => splitFor(line, d));
      for (let i = 0; i < rowsD.length; i += 1) {
        const cells = rowsD[i]!.map(foldHead);
        const known = cells.filter((c) => HEADER_WORDS[c]).length;
        if (known === 0) continue;
        const phoneLike = rowsD[i]!.some((c) => digitsOf(c).replace(/\D/g, "").length >= 7);
        if (known >= 2 || (known === 1 && !phoneLike)) { from = i + 1; break; }
      }
      let tabbed = 0;
      for (const line of sample.slice(from)) if (splitFor(line, d).some((c) => c.includes("\t"))) tabbed += 1;
      return tabbed < 2;
    };
    const cands = ["\t", "|", ","] as const;
    const headInfo = new Map<string, number>(cands.map((d) => [d, headerInfo(d)]));
    const bestHead = Math.max(...cands.map((d) => headInfo.get(d) ?? -1));
    if (bestHead >= 0) {
      // 1.6.32 (Prejuicio R10, R11F-1): en el EMPATE de declarantes
      // manda el que además certifica una columna de teléfonos — un
      // preámbulo etiqueta⇥valor declara tan bonito como el
      // encabezado real, pero su «tabla» no trae un solo teléfono; si
      // ninguno o todos certifican, desempata la cuenta (ya en 40).
      let pool = cands.filter((d) => (headInfo.get(d) ?? -1) === bestHead);
      let withPhone = pool.filter((d) => certified(d));
      // 1.6.53 (Prejuicio R14, R15F-1/R15F-2): la preferencia del
      // teléfono ya no vive solo en el empate — si NINGÚN declarante
      // de la cima certifica una columna de teléfonos y otro
      // declarante sí, manda el que certifica, declare con las
      // palabras que declare. El preámbulo de etiquetas («Concepto,
      // Sin saldo, Nota…») certifica fila a fila por los asientos de
      // personRow y gana la cuenta de conocidas (3 contra 2), pero
      // su cuerpo no trae un solo teléfono; la tabla verdadera trae
      // diez. Cuando ningún candidato certifica, manda la cuenta,
      // como siempre.
      if (withPhone.length === 0) {
        const certBelow = cands.filter((d) => (headInfo.get(d) ?? -1) >= 0 && certified(d));
        if (certBelow.length > 0) { pool = certBelow; withPhone = certBelow; }
      }
      if (withPhone.length > 0) pool = withPhone;
      const chosen = pool.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0]!;
      if ((headInfo.get(delim) ?? -1) < bestHead || !(pool as readonly string[]).includes(delim)) delim = chosen;
      else if (chosen !== delim && withPhone.includes(chosen)) delim = chosen;
    } else if (bestHead < 0 && !certified(delim)) {
      const phoneCands = cands.filter((d) => certified(d));
      if (phoneCands.length === 1) delim = phoneCands[0]!;
    }
  }
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
    else if (ch === delim || (delim === "," && ch === ";")) pushCell();
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
for (const w of ["name", "nombre", "nombre completo", "full name", "contacto", "contact", "client name", "customer name", "contact name", "nombre y apellido", "nombre del cliente", "client", "customer", "naam", "nome", "cliente"]) HEADER_WORDS[w] = "name";
for (const w of ["phone", "telefono", "tel", "celular", "movil", "mobile", "numero", "numero de telefono", "phone number", "telephone", "phone 1 value", "phone 2 value", "mobile phone", "cell phone", "telefono movil", "numero de celular", "telefono 1 valor", "telefono 2 valor", "home phone", "work phone", "business phone", "primary phone", "telefono casa", "telefono trabajo", "telefono de casa", "telefon", "telefoon", "telefonnummer", "mobiltelefon", "rufnummer", "handynummer", "telefone", "telefone 1 valor", "telefone 2 valor", "telefon 1 wert", "telefon 2 wert", "telephone 1 valeur", "telephone 2 valeur", "telemovel", "telefono 1 valore", "telefoon 1 waarde"]) HEADER_WORDS[w] = "phone";
for (const w of ["address", "direccion", "domicilio", "addr", "address 1 formatted", "direccion 1 formateada", "address 1", "direccion 1", "adresse", "adres", "anschrift", "endereco", "morada", "endereco 1 formatado", "adresse 1 formatiert", "adresse 1 formatee", "indirizzo", "indirizzo 1 formattato", "adres 1 opgemaakt"]) HEADER_WORDS[w] = "address";
// 1.6.08 (Prejuicio R3, R3F-3): el nombre partido en dos columnas (la forma
// de Outlook: «First Name,Last Name,Phone») — sin estas dos palabras el
// apellido jamás se leía y cada contacto nacía con medio nombre.
for (const w of ["first name", "nombre de pila", "given name", "vorname", "voornaam", "prenom"]) HEADER_WORDS[w] = "first";
for (const w of ["last name", "apellido", "apellidos", "family name", "surname", "nachname", "achternaam", "nom", "nom de famille", "cognome", "sobrenome"]) HEADER_WORDS[w] = "last";

// 1.6.48 (Prejuicio R13, R14F-3): los tipos de vía con que abre
// una dirección cuyo número ES el nombre de la calle («Calle 8»,
// «Ruta 66», «Km 5») — en su forma plegada, como foldHead entrega.
const STREET_HEADS = new Set(["calle", "avenida", "av", "ruta", "km", "camino", "pasaje", "callejon", "carretera", "boulevard", "blvd", "street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "lane", "ln", "court", "ct", "rua", "estrada", "travessa", "alameda", "rodovia", "prolongacion"]);

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
  // 1.6.28 (Prejuicio R9, R10F-2): la ventana sube a 25 filas, la
  // misma que miran los testigos de la olida — alineadas otra vez,
  // y un preámbulo de informe ordinario ya no la llena.
  // 1.6.32 (Prejuicio R10, R11F-5/R11F-7): la ventana sube a 40,
  // alineada con la cuenta y los testigos; y una fila solo se corona
  // si la tabla aún no ha empezado — si una fila de datos de verdad
  // (≥2 celdas, una con pinta de teléfono) ya pasó por encima, la
  // candidata es un dato, no un encabezado: «Cliente,pendiente» en
  // mitad del archivo ya no se come a las personas de arriba ni deja
  // sin teléfono a las de abajo.
  let dataSeen = false;
  // 1.6.53 (Prejuicio R14, R15F-6): el dato DÉBIL — la fila que solo
  // enciende por addrDigit, sin teléfono — se cuenta aparte. UNA
  // fila débil es un membrete («Oscar Lawn,Calle 8», la dirección
  // del propio negocio sobre su export) y no puede matar la corona
  // de un encabezado verdadero; DOS o más son un bloque de datos
  // sin teléfono y la corona sigue muerta sobre ellos, como manda
  // la ley de R13F-3.
  let weakData = 0;
  // 1.6.42: la ventana de la corona sube a 200 filas, alineada con
  // la cuenta y la muestra (R12F-4).
  // 1.6.46: la corona también lee el archivo entero (R13F-4) — la
  // guarda dataSeen, no una ventana, es lo que impide que una fila
  // de encabezado tardía corone sobre datos ya vistos.
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i]!.map(foldHead);
    const known = cells.filter((c) => HEADER_WORDS[c]).length;
    const phoneLike = cells.some((c) => digitsOf(c).replace(/\D/g, "").length >= 7);
    if (!dataSeen && weakData < 2 && (known >= 2 || (known === 1 && !phoneLike))) {
      headAt = i;
      break;
    }
    // 1.6.42 (Prejuicio R11, R12F-5/R12F-6): «dato» es una fila de
    // PERSONA, traiga o no teléfono — «Ana Torres,Calle Sol 1»
    // enciende la guarda como manda (nombre y dirección bastan).
    // Y una fila cuya primera celda es una palabra del vocabulario
    // («Telefono,3055550199», la línea del negocio en el
    // preámbulo) NO es un dato aunque traiga el teléfono: es una
    // etiqueta, y ya no apaga la corona del encabezado verdadero.
    const firstVocab = cells.length > 0 && !!HEADER_WORDS[cells[0]!];
    // 1.6.46 (Prejuicio R12, R13F-3): la luz de «dato sin teléfono»
    // ya no se enciende con cualquier dígito — el título del
    // informe («Informe de clientes, 2026», «Pagina 1, de 3») la
    // encendía y apagaba la corona del encabezado verdadero. El
    // dígito debe vivir dentro de una celda con dos palabras más:
    // el número de la casa dentro de su dirección («Calle Sol 1»).
    // Un año suelto o una paginación no son un dato.
    // 1.6.48 (Prejuicio R13, R14F-3): la dirección cuyo único
    // nombre es el tipo de vía — «Calle 8», «Ruta 66», «Km 5», la
    // forma corriente de media América Latina — tiene UNA palabra
    // con letras y no encendía la luz: el bloque entero quedaba a
    // merced de la corona. Una celda que abre con un tipo de vía y
    // trae su número también es una dirección.
    const addrDigit = rows[i]!.some((c) => /\d/.test(c) && (c.split(/\s+/).filter((w) => /[^\d]/.test(w)).length >= 2 || STREET_HEADS.has(foldHead(c).split(" ")[0]!)));
    if (rows[i]!.length >= 2 && !firstVocab) {
      if (phoneLike) dataSeen = true;
      else if (known === 0 && addrDigit) weakData += 1;
    }
  }
  const head = headAt >= 0 ? rows[headAt]!.map(foldHead) : [];
  const colOf = (kind: "name" | "phone" | "address" | "first" | "last") => head.findIndex((h) => HEADER_WORDS[h] === kind);
  const nameCol = colOf("name");
  const firstCol = colOf("first");
  const lastCol = colOf("last");
  const phoneCol = colOf("phone");
  // 1.6.14 (Prejuicio R4, R5F-8): TODAS las columnas de teléfono conocidas,
  // en orden — por fila manda la primera que traiga número. Antes mandaba
  // la primera del vocabulario aunque viniera vacía («Mobile Phone» vacía
  // tapaba a «Phone 2 - Value» llena), y «Home Phone» ni existía.
  let phoneCols = head.map((h, i) => (HEADER_WORDS[h] === "phone" ? i : -1)).filter((i) => i >= 0);
  const addrCol = colOf("address");
  const hasHeader = headAt >= 0 && (nameCol >= 0 || phoneCol >= 0 || firstCol >= 0 || lastCol >= 0);
  // 1.6.53 (Prejuicio R14, R15F-4): una celda de encabezado VACÍA
  // en medio («Nombre,,Direccion») dejaba su columna sin nombre y
  // la ley de R4F-2 la juzgaba «no reconocida»: los teléfonos que
  // la columna trae delante se perdían enteros. Una columna sin
  // nombre cuyo cuerpo ES de teléfonos (≥2 con forma de teléfono
  // y la mayoría de sus valores no vacíos) se sienta como columna
  // de teléfonos — la forma del cuerpo la nombra; no se fabrica
  // nada. Una columna con nombre desconocido («Fax») sigue sin
  // sentarse, como manda R4F-2.
  if (hasHeader && phoneCols.length === 0) {
    for (let j = 0; j < head.length; j += 1) {
      if (head[j] !== "") continue;
      let shaped = 0;
      let filled = 0;
      for (const r of rows.slice(headAt + 1)) {
        const v = (r[j] ?? "").trim();
        if (v === "") continue;
        filled += 1;
        const n = digitsOf(v).replace(/\D/g, "").length;
        if (/^[+\d][\d\s().-]*$/.test(v) && n >= 7 && n <= 15) shaped += 1;
      }
      if (shaped >= 2 && shaped * 2 >= filled) { phoneCols = [j]; break; }
    }
  }
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
  // 1.6.16 (Prejuicio R5, R6F-4): la fila de encabezado detectada
  // (headAt) se salta SIEMPRE, aunque ninguna columna suya case con
  // el vocabulario — antes un archivo solo de direcciones la releía
  // como datos y nacía un cliente llamado «Dirección» con teléfono
  // «Ciudad», y cada fila real entraba girada. Sin columnas leídas,
  // las filas de datos se leen por posición, como sin encabezado.
  for (const rawCols of headAt >= 0 ? rows.slice(headAt + 1) : rows) {
    // Una fila de una sola celda en un archivo de varias columnas es una
    // línea suelta (un título, una nota), no una persona: no nace.
    if (rawCols.length < 2) continue;
    // 1.6.48 (Prejuicio R13, R14F-2, el asiento del lector): con
    // encabezado coronado, una fila MÁS ancha que el encabezado
    // cuyas celdas no vacías encajan EXACTAS en su ancho trae una
    // celda vacía de relleno («Ana,,Calle Sol 1» bajo
    // «Nombre,Direccion») — se lee compactada, como personRow ya
    // juzga. Una fila del ancho del encabezado se lee posicional
    // siempre: su vacío en medio es un valor vacío de verdad.
    const compacted = rawCols.filter((c) => c.trim() !== "");
    let cols = headAt >= 0 && head.length >= 2 && rawCols.length > head.length && compacted.length === head.length ? compacted : rawCols;
    // 1.6.53 (Prejuicio R14, R15F-3/R15F-5): la compactación asigna
    // por ORDEN, no por forma — cuando el vacío es la celda del
    // teléfono y el número vive más allá del encabezado, la lectura
    // compactada cruza los asientos (la dirección nace como
    // teléfono y el teléfono como dirección). Si el encabezado
    // coronado trae columna de teléfono y el valor que la lectura
    // compactada sienta en ella no tiene forma de teléfono, la
    // compactación miente: se vuelve a la lectura posicional, que
    // con el vacío en su sitio era estrictamente mejor.
    if (cols === compacted && hasHeader && phoneCols.length > 0) {
      const pv = phoneCols.map((c) => (cols[c] ?? "").trim()).find((v) => v !== "") ?? "";
      if (digitsOf(pv).replace(/\D/g, "").length < 7) cols = rawCols;
    }
    // 1.6.08 (R3F-3): sin columna de nombre completo pero con nombre y
    // apellido partidos, el nombre nace entero de las dos columnas.
    // 1.6.14 (Prejuicio R4, R5F-7): el export español de Google trae
    // «Nombre» (solo el nombre de pila) y «Apellidos» aparte — con la
    // columna de nombre presente, la composición de R3F-3 nunca corría y
    // el apellido quedaba huérfano. Ahora el apellido se añade siempre
    // que la columna exista y no esté ya dentro del nombre (sin doblar).
    const lastVal = hasHeader && lastCol >= 0 ? (cols[lastCol] ?? "").trim() : "";
    let name = (
      hasHeader && nameCol < 0 && (firstCol >= 0 || lastCol >= 0)
        ? [firstCol >= 0 ? cols[firstCol] : "", lastCol >= 0 ? cols[lastCol] : ""].filter(Boolean).join(" ")
        : (cols[idx.name] ?? "")
    ).trim();
    if (lastVal && name && !foldText(name).includes(foldText(lastVal))) name = `${name} ${lastVal}`;
    // 1.6.14 (R5F-8): entre las columnas de teléfono conocidas, la primera
    // con número de ESTA fila; sin encabezado, la posición de siempre.
    const phone = hasHeader
      ? (phoneCols.map((c) => (cols[c] ?? "").trim()).find((v) => v !== "") ?? "")
      : (cols[idx.phone] ?? "").trim();
    const address = idx.address >= 0 ? (cols[idx.address] ?? "").trim() : "";
    // Cerca de cordura (BZ-52, endurecida en 1.6.04 por R2F-15): la fila
    // nace solo con un nombre que trae una letra DE VERDAD (cualquier
    // alfabeto, vía \p{L}) — una columna de puros números no es un nombre:
    // una lista de solo teléfonos ya no pare contactos llamados como un
    // número, y una fila sin nombre no se bautiza con su teléfono.
    if (!/\p{L}/u.test(name)) continue;
    // 1.6.42 (Prejuicio R11, R12F-5): una fila cuyo «nombre» es una
    // palabra del vocabulario de encabezados («Cliente») y que no
    // trae ningún número con pinta de teléfono no es una persona —
    // es una fila de estado o un encabezado repetido («Cliente,
    // pendiente», «Nombre,Telefono» a mitad de archivo). Con un
    // teléfono de verdad sí nace: la duda se resuelve a favor de la
    // persona.
    if (HEADER_WORDS[foldHead(name)] && !cols.some((c) => digitsOf(c).replace(/\D/g, "").length >= 7)) continue;
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
