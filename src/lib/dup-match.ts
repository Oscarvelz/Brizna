/**
 * 1.5.02: who looks like the same client. Pure (used by the local server functions and by the batch screen).
 * Same or near-same name (accents, case, spacing, punctuation, word order, one typo), same phone
 * (last 10 digits, 7 or more), or same address (number + street words, common abbreviations folded).
 */

export type DupWhy = "name" | "near" | "phone" | "address";

export function foldText(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameKey(name: string): string {
  return foldText(name);
}

function tokens(name: string): string[] {
  return nameKey(name).split(" ").filter(Boolean);
}

/** Levenshtein distance, capped (returns cap+1 once it is clearly over). */
function lev(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
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

export function phoneTail(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
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
