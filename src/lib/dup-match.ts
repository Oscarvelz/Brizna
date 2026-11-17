/**
 * 1.5.02: who looks like the same client. Pure (used by the local server functions and by the batch screen).
 * Same or near-same name (accents, case, spacing, punctuation, word order, one typo), same phone
 * (last 10 digits, 7 or more), or same address (number + street words, common abbreviations folded).
 */

export type DupWhy = "name" | "near" | "phone" | "address";

export function foldText(s: string | null | undefined): string {
  // 1.6.04 (Prejuicio R2, R2F-1): la clase final conserva TODA letra y dígito
  // Unicode, no solo el latín. Antes un nombre en chino, árabe o cirílico se
  // plegaba a "" y su identidad desaparecía para cada consumidor de la clave
  // (la tanda lo fundía con otro, el servidor no lo fundía consigo mismo y la
  // revisión de duplicados ni lo miraba). El comportamiento latino no cambia:
  // NFD + quitar diacríticos ya resolvía acentos y ñ antes de esta clase.
  // 1.6.08 (Prejuicio R3, R3F-7): las marcas se quitan con \p{M} — TODAS las
  // marcas combinantes, no solo el rango latino U+0300–U+036F. El niqqud
  // hebreo, las harakat árabes y los signos vocálicos devanagari quedaban
  // fuera del rango y la clase final los volvía separadores: el mismo
  // nombre vocalizado y sin vocalizar partía su identidad en dos claves, y
  // dos nombres distintos se leían «near». Así este pliegue y el de fuzzy.ts
  // (que ya usaba \p{M}) pliegan igual.
  // 1.6.12 (Prejuicio R3, R4F-3): la tira se refina a Mn+Me. Los signos
  // vocálicos devanagari son Mc — letras plenas que siempre se escriben
  // (ि corta contra ी larga distinguen personas) — y \p{M} entero los
  // fundía: दिनेश y दीनेश salían la misma clave y la tanda fundía a la
  // segunda persona en silencio. El niqqud y las harakat son Mn (vocali-
  // zación opcional): siguen cayendo, y los dos pliegues siguen de acuerdo.
  // 1.6.14 (Prejuicio R4, R5F-1): la cura de arriba estaba ROTA — la clase
  // final [^\p{L}\p{N}]+ borraba las Mc que la tira acababa de salvar (una
  // Mc no es ni L ni N): दिनेश y दीनेश seguían saliendo la misma clave.
  // La clase final conserva ahora TODA marca que sobrevivió a la tira.
  // 1.6.14 (R5F-5): el nukta índico (Mn) SÍ distingue personas (क़ qa ≢ क
  // ka) — se protege de la tira con un marcador y se restaura tras ella.
  // 1.6.14 (R5F-4): el «am» tailandés/lao precompuesto (Lo) y su forma
  // descompuesta (Mn + vocal) se unifican a mano: NFD no lo descompone.
  // 1.6.14 (R5F-6): el tatweel árabe (ـ, Lm) es alargamiento puro, nunca
  // distingue a nadie: se quita entero.
  // 1.6.16 (Prejuicio R5, R6F-6): NFKC primero — las formas de
  // presentación árabes y el latín de ancho completo no se descomponen
  // con NFD y la identidad se partía al pegar desde un PDF o un IME.
  // 1.6.16 (R6F-2): las variantes de teclado árabe/persa se unifican
  // (yeh persa U+06CC a yeh U+064A; keheh U+06A9 a kaf U+0643; alef
  // maksura U+0649 a yeh): dos teclados para la misma lengua, y las
  // listas reales mezclan ambas formas. 1.6.16 (R6F-5): el chillu
  // malayalam y su forma consonante+virama+ZWJ se unifican ANTES de
  // quitar el ZWJ. 1.6.16 (R6F-10): el ZWNJ/ZWJ restante se quita —
  // invisible, y partía la clave de tanda en dos tokens. 1.6.16
  // (R6F-1): el virama a FINAL de palabra SÍ es identidad (en tamil el
  // pulli final es la ortografía normal de la consonante final): se
  // protege de la tira como el nukta; el virama interno (los
  // conjuntos) sigue cayendo. 1.6.16 (R6F-3): la sigma final griega
  // (U+03C2) se unifica con la sigma normal tras las minúsculas.
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/([കണനരലള])്‍/g, (m, c: string) => CHILLU[c] ?? m)
    .normalize("NFD")
    .replace(/\u0640/g, "")
    .replace(/\u0E33/g, "\u0E4D\u0E32")
    .replace(/\u0EB3/g, "\u0ECD\u0EB2")
    .replace(/[\u093C\u09BC\u0A3C\u0ABC\u0B3C\u0D3C]/g, (ch) => NUKTA_SLOTS[ch] ?? ch)
    .replace(/\u06CC/g, "ي")
    .replace(/\u06A9/g, "ك")
    .replace(/\u0649/g, "ي")
    .replace(/[‌‍]/g, "")
    .replace(/([्\u09cd\u0a4d\u0acd\u0b4d\u0bcd\u0c4d\u0ccd\u0d4d])(?=$|[^\p{L}\p{M}\p{N}])/gu, (ch) => VIRAMA_SLOTS[ch] ?? ch)
    .replace(/[\p{Mn}\p{Me}]/gu, "")
    .replace(/[\uE000-\uE005]/g, (ch) => NUKTA_BACK[ch] ?? ch)
    .replace(/[\uE010-\uE018]/g, (ch) => VIRAMA_BACK[ch] ?? ch)
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 1.6.14 (R5F-5): los nukta índicos — marcas Mn que distinguen personas.
// Se esconden tras marcadores de uso privado mientras la tira Mn+Me pasa.
const NUKTA_SLOTS: Record<string, string> = {
  "\u093C": "\uE000", "\u09BC": "\uE001", "\u0A3C": "\uE002",
  "\u0ABC": "\uE003", "\u0B3C": "\uE004", "\u0D3C": "\uE005",
};
const NUKTA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(NUKTA_SLOTS).map(([k, v]) => [v, k]),
);

// 1.6.16 (R6F-5): el chillu malayalam y su forma larga (consonante +
// virama + ZWJ) — el mapa de la unificación en foldText.
const CHILLU: Record<string, string> = {
  "\u0D15": "\u0D7F", "\u0D23": "\u0D7A", "\u0D28": "\u0D7B",
  "\u0D30": "\u0D7C", "\u0D32": "\u0D7D", "\u0D33": "\u0D7E",
};

// 1.6.16 (R6F-1): los viramas índicos — a final de palabra distinguen
// personas (Kumar con pulli final no es Kumara). Se esconden tras
// marcadores de uso privado mientras la tira Mn+Me pasa, como el nukta.
const VIRAMA_SLOTS: Record<string, string> = {
  "\u094D": "\uE010", "\u09CD": "\uE011", "\u0A4D": "\uE012",
  "\u0ACD": "\uE013", "\u0B4D": "\uE014", "\u0BCD": "\uE015",
  "\u0C4D": "\uE016", "\u0CCD": "\uE017", "\u0D4D": "\uE018",
};
const VIRAMA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(VIRAMA_SLOTS).map(([k, v]) => [v, k]),
);

export function nameKey(name: string): string {
  return foldText(name);
}

/** La identidad de un nombre dentro de una tanda (pegar varios, crear en
 *  lote): la clave plegada cuando el nombre tiene una; si no tiene ninguna
 *  (un nombre sin letras ni dígitos, p. ej. solo un símbolo), el nombre
 *  crudo normalizado — dos nombres DISTINTOS sin clave jamás se funden, y
 *  el mismo nombre sin clave sí se funde consigo mismo (BZ-53 en ambas
 *  capas, R2F-2/R2F-3). */
export function batchKeyOf(name: string): string {
  const key = nameKey(name);
  return key ? `k:${key}` : `r:${String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`;
}

function tokens(name: string): string[] {
  return nameKey(name).split(" ").filter(Boolean);
}

/** Levenshtein distance, capped (returns cap+1 once it is clearly over). */
function lev(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev2: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // 1.6.12 (Prejuicio R3, R4F-5): la transposición adyacente cuesta 1
      // (Damerau) — es EL typo de la mano («Jonh» por «John») y la distancia
      // clásica lo cobraba como 2, invisible bajo el tope de los nombres
      // medianos: la revisión perdía el duplicado más probable.
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** "same": identical once folded. "near": same words in another order, or one or two typos on a long name. */
export function nameMatch(a: string, b: string): "same" | "near" | null {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return "same";
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length > 1 && [...ta].sort().join(" ") === [...tb].sort().join(" ")) return "near";
  const compactA = ka.replace(/ /g, "");
  const compactB = kb.replace(/ /g, "");
  if (compactA === compactB) return "near";
  const len = Math.min(compactA.length, compactB.length);
  if (len >= 6) {
    const cap = len >= 12 ? 2 : 1;
    if (lev(compactA, compactB, cap) <= cap) return "near";
  }
  return null;
}

// 1.6.16 (Prejuicio R5, R6F-7): los dígitos decimales de cualquier
// escritura (arábigo-índicos, de ancho completo, devanagari…) valen
// como dígitos — \d solo conoce el ASCII y la identidad telefónica
// de esos números nacía muerta.
const ND_ZEROS = [0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10];

export function digitsOf(s: string | null | undefined): string {
  return String(s ?? "").replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0)!;
    for (const z of ND_ZEROS) if (cp >= z && cp <= z + 9) return String(cp - z);
    return ch;
  });
}

export function phoneTail(phone: string | null | undefined): string {
  const digits = digitsOf(phone).replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

const ABBR: Record<string, string> = {
  street: "st", str: "st", avenue: "ave", av: "ave", avenida: "ave", road: "rd", drive: "dr", court: "ct", place: "pl",
  lane: "ln", boulevard: "blvd", terrace: "ter", terr: "ter", circle: "cir", highway: "hwy", parkway: "pkwy",
  southwest: "sw", southeast: "se", northwest: "nw", northeast: "ne", north: "n", south: "s", east: "e", west: "w",
  apartment: "apt", calle: "st", trail: "trl", square: "sq",
};

const SUFFIX = new Set(["st", "ave", "rd", "dr", "ct", "pl", "ln", "blvd", "ter", "cir", "hwy", "pkwy", "way", "trl", "path", "loop", "sq"]);

/** House number + the street words up to the street type (St, Ave, Terr…), abbreviations folded, so the city or
 *  zip written or not does not matter; "" when there is no number to anchor it. */
export function addressKey(address: string | null | undefined): string {
  const words = foldText(address).split(" ").filter(Boolean).map((w) => ABBR[w] ?? w);
  const at = words.findIndex((w) => /^\d+$/.test(w));
  if (at < 0) return "";
  const rest = words.slice(at, at + 6);
  const end = rest.findIndex((w, i) => i > 0 && SUFFIX.has(w));
  const street = (end > 0 ? rest.slice(0, end + 1) : rest.slice(0, 4)).filter((w) => w !== "apt" && w !== "unit");
  return street.length >= 2 ? street.join(" ") : "";
}

export type DupCandidate = { id: number; name: string; phone: string | null; address: string | null };

export function whyMatch(row: { name: string; phone?: string | null; address?: string | null }, c: DupCandidate): DupWhy[] {
  const why: DupWhy[] = [];
  const nm = nameMatch(row.name, c.name);
  if (nm === "same") why.push("name");
  else if (nm === "near") why.push("near");
  const pa = phoneTail(row.phone);
  if (pa && pa === phoneTail(c.phone)) why.push("phone");
  const aa = addressKey(row.address);
  if (aa && aa === addressKey(c.address)) why.push("address");
  return why;
}

/** Existing clients that look like `row`, strongest first (name+phone beats a lone near name). */
export function findLike<T extends DupCandidate>(row: { name: string; phone?: string | null; address?: string | null }, list: T[], excludeId?: number) {
  const score = (why: DupWhy[]) => why.reduce((t, w) => t + (w === "name" ? 4 : w === "phone" ? 4 : w === "address" ? 3 : 2), 0);
  return list
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ c, why: whyMatch(row, c) }))
    .filter((x) => x.why.length > 0)
    .sort((a, b) => score(b.why) - score(a.why) || a.c.name.localeCompare(b.c.name))
    .slice(0, 5);
}

/** Groups of existing clients that look like each other (union of every matching pair). */
export function duplicateGroups<T extends DupCandidate>(list: T[]): { members: T[]; why: DupWhy[] }[] {
  const parent = new Map<number, number>(list.map((c) => [c.id, c.id]));
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const whyBy = new Map<number, Set<DupWhy>>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const why = whyMatch(list[i], list[j]);
      if (!why.length) continue;
      const a = find(list[i].id);
      const b = find(list[j].id);
      if (a !== b) parent.set(b, a);
      const root = find(list[i].id);
      const set = whyBy.get(root) ?? new Set<DupWhy>();
      why.forEach((w) => set.add(w));
      whyBy.set(root, set);
    }
  }
  const groups = new Map<number, T[]>();
  for (const c of list) {
    const r = find(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  const out: { members: T[]; why: DupWhy[] }[] = [];
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const why = new Set<DupWhy>();
    for (const [k, v] of whyBy) if (find(k) === root) v.forEach((w) => why.add(w));
    out.push({ members, why: [...why] });
  }
  return out;
}
