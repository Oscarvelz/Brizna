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

export async function pickPhoneContacts(multiple = false): Promise<PickedContact[]> {
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
    throw err;
  }
}

function unfoldVcard(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function vcardValue(block: string, key: string): string {
  const re = new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, "im");
  const m = re.exec(block);
  if (!m) return "";
  return m[1]!.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

function parseAdr(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.replace(/\\,/g, ",").trim());
  const street = [parts[1], parts[2]].filter(Boolean).join(" ");
  const city = [parts[3], parts[4], parts[5]].filter(Boolean).join(", ");
  return [street, city].filter(Boolean).join(", ");
}

export function parseContactFile(text: string, fileName = ""): PickedContact[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || (!text.includes("BEGIN:VCARD") && text.includes(","))) {
    return parseCsv(text);
  }
  return parseVcard(text);
}

export function parseVcard(text: string): PickedContact[] {
  const unfolded = unfoldVcard(text);
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out: PickedContact[] = [];
  for (const block of blocks) {
    const fn = vcardValue(block, "FN") || vcardValue(block, "N").split(";").filter(Boolean).join(" ");
    const tel = vcardValue(block, "TEL");
    const adr = parseAdr(vcardValue(block, "ADR"));
    if (!fn.trim() && !tel.trim()) continue;
    out.push({ name: fn.trim() || tel.trim(), phone: tel.trim(), address: adr });
  }
  return out;
}

function parseCsv(text: string): PickedContact[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /name|nombre|phone|tel|address|direccion/.test(h));
  const rows = hasHeader ? lines.slice(1) : lines;
  const idx = {
    name: Math.max(0, header.findIndex((h) => /name|nombre/.test(h))),
    phone: Math.max(
      hasHeader ? header.findIndex((h) => /phone|tel|cel/.test(h)) : 1,
      hasHeader ? 0 : 1,
    ),
    address: hasHeader ? header.findIndex((h) => /address|direccion|dirección/.test(h)) : 2,
  };
  if (!hasHeader) {
    idx.name = 0;
    idx.phone = 1;
    idx.address = 2;
  }
  const out: PickedContact[] = [];
  for (const line of rows) {
    const cols = splitCsvLine(line);
    const name = (cols[idx.name] ?? "").trim();
    const phone = (cols[idx.phone] ?? "").trim();
    const address = (cols[idx.address] ?? "").trim();
    if (!name && !phone) continue;
    out.push({ name: name || phone, phone, address });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export async function pickContactsFromFile(file: File): Promise<PickedContact[]> {
  const text = await file.text();
  const parsed = parseContactFile(text, file.name);
  if (parsed.length === 0) throw new Error("contacts-empty");
  return parsed;
}
