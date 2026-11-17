export function fold(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/([കണനരലള])്‍/g, (m, c: string) => FZ_CHILLU[c] ?? m)
    .normalize("NFD")
    // 1.6.14 (Prejuicio R4, R5F-4/R5F-5/R5F-6): los mismos pasos previos
    // que foldText (dup-match.ts) — tatweel fuera, «am» tailandés/lao
    // unificado, nukta índico protegido de la tira: los dos pliegues
    // pliegan igual, también fuera del latín.
    .replace(/ـ/g, "")
    .replace(/ำ/g, "ํา")
    .replace(/ຳ/g, "຅າ".replace("຅", "ໍ"))
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/ى/g, "ي")
    .replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, (ch) => FZ_HEBREW[ch] ?? ch)
    .replace(/[‌‍]/g, "")
    .replace(/[़়া\u09bc\u0a3c\u0abc\u0b3c\u0d3c\u0e4d\u0ecd\u1037]/g, (ch) => FZ_NUKTA[ch] ?? ch)
    // 1.6.12 (R4F-3): Mn+Me, como foldText — los signos Mc (las vocales
    // devanagari) son letras y se quedan; los dos pliegues siguen de acuerdo.
    .replace(/([\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u1039\u103A\u0DCA\u17CB])(?!\p{M}*[\p{L}\p{N}])/gu, (ch) => FZ_VIRAMA[ch] ?? ch)
    .replace(/[\p{Mn}\p{Me}]/gu, "")
    .replace(/[\ue000-\ue008]/g, (ch) => FZ_NUKTA_BACK[ch] ?? ch)
    .replace(/[\ue010-\ue01c]/g, (ch) => FZ_VIRAMA_BACK[ch] ?? ch)
    .toLowerCase()
    .replace(/ς/g, "σ");
}

// 1.6.14 (R5F-5): espejo de NUKTA_SLOTS en dup-match.ts — mantener en
// sincronía con aquel mapa.
const FZ_NUKTA: Record<string, string> = {
  "़": "\ue000", "়": "\ue001", "\u0a3c": "\ue002",
  "\u0abc": "\ue003", "\u0b3c": "\ue004", "\u0d3c": "\ue005",
  "\u0e4d": "\ue006", "\u0ecd": "\ue007",
  "\u1037": "\ue008",
};
// 1.6.19 (R7F-12): espejo de HEBREW_FINALS en dup-match.ts.
const FZ_HEBREW: Record<string, string> = {
  "\u05da": "\u05db", "\u05dd": "\u05de", "\u05df": "\u05e0",
  "\u05e3": "\u05e4", "\u05e5": "\u05e6",
};

const FZ_NUKTA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(FZ_NUKTA).map(([k, v]) => [v, k]),
);

// 1.6.16 (Prejuicio R5): espejos de CHILLU y VIRAMA_SLOTS en
// dup-match.ts — mantener en sincronía con aquellos mapas.
const FZ_CHILLU: Record<string, string> = {
  "\u0D15": "\u0D7F", "\u0D23": "\u0D7A", "\u0D28": "\u0D7B",
  "\u0D30": "\u0D7C", "\u0D32": "\u0D7D", "\u0D33": "\u0D7E",
};
const FZ_VIRAMA: Record<string, string> = {
  "\u094D": "\uE010", "\u09CD": "\uE011", "\u0A4D": "\uE012",
  "\u0ACD": "\uE013", "\u0B4D": "\uE014", "\u0BCD": "\uE015",
  "\u0C4D": "\uE016", "\u0CCD": "\uE017", "\u0D4D": "\uE018",
  "\u1039": "\uE019", "\u103A": "\uE01A", "\u0DCA": "\uE01B",
  "\u17CB": "\uE01C",
};
const FZ_VIRAMA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(FZ_VIRAMA).map(([k, v]) => [v, k]),
);

// 1.6.19 (Prejuicio R6, R7F-1): la distancia se mide en GRAFEMAS, no
// en unidades de código — un typo índico (una sílaba: consonante +
// signos) costaba 2-3 ediciones y la tolerancia de smartHit no
// llegaba nunca; en latín un grafema es una letra y nada cambia.
const SEG: Intl.Segmenter | null = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;
export function clustersOf(s: string): string[] {
  return SEG ? Array.from(SEG.segment(s), (x) => x.segment) : Array.from(s);
}

function distance(a: string, b: string): number {
  return distanceClusters(clustersOf(a), clustersOf(b));
}

function distanceClusters(a: string[], b: string[]): number {
  if (a.join("") === b.join("")) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // 1.6.16 (Prejuicio R5, R6F-8): Damerau, como el lev de dup-match —
  // la transposición adyacente («jhon») cuesta 1; la búsqueda era la
  // única hermana que nunca recibió la cura de R4F-5.
  let prev2: number[] | null = null;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      let v = Math.min(row[j] + 1, cur[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
    }
    prev2 = row;
    row = cur;
  }
  return row[b.length] ?? 0;
}

/** Match by meaning, not only the exact spelling. Short typos still hit. */
export function smartHit(query: string, text: string): boolean {
  const q = fold(query).trim();
  if (!q) return true;
  const t = fold(text);
  // 1.6.08 (Prejuicio R3, R3F-8): las reglas de subcadena tienen suelo de 2 —
  // con UNA letra, «a» casaba con 7 de 8 nombres y la búsqueda no buscaba.
  // La igualdad exacta sigue valiendo (un nombre de una letra se encuentra
  // por su letra), y el camino difuso ya tenía su suelo (≥4).
  if (t.trim() === q) return true;
  if (q.length >= 2 && t.includes(q)) return true;
  const words = t.split(/[^\p{L}\p{N}\p{M}]+/u).filter((word) => word.length > 1);
  const parts = q.split(/\s+/).filter(Boolean);
  return parts.every((part) =>
    words.some((word) => {
      // 1.6.12 (Prejuicio R3, R4F-4): una parte de UNA letra casa como
      // PREFIJO de palabra — la inicial («j perez», «perez j») es un
      // prefijo, no una subcadena cualquiera. El suelo de 2 de R3F-8 sigue
      // cerrando la subcadena libre (la «a» que casaba con todo), y la
      // inicial vuelve a buscar.
      // 1.6.14 (Prejuicio R4, R5F-3): un DÍGITO nunca es una inicial — con
      // la regla desnuda, «5» casaba con cada «555» del blob (teléfono y
      // dirección viajan en el mismo texto que busca smartHit) y «3» con
      // cada «305»: la enfermedad de R3F-8 por la puerta de los dígitos.
      // Y la inicial solo vale CON contexto (consulta de más de una
      // parte): sola, «m» casaba con el «miami» de cada dirección y el
      // filtro no filtraba — la letra sola vuelve a la ley de R3F-8.
      const pc = clustersOf(part);
      const wc = clustersOf(word);
      if (pc.length === 1 && parts.length > 1 && !/^[0-9]$/.test(part) && word.startsWith(part)) return true;
      if (part.length >= 2 && (word.includes(part) || part.includes(word))) return true;
      // El suelo se calibra en puntos de código (la calibración latina
      // de siempre: 4+ → 1 edición, 7+ → 2); la distancia se mide en
      // grafemas. Calibrar el suelo en grafemas dejaba un nombre
      // devanagari de 3 sílabas por debajo del suelo de su propio typo.
      const cps = Array.from(part).length;
      const limit = cps >= 7 ? 2 : cps >= 4 ? 1 : 0;
      return limit > 0 && Math.abs(wc.length - pc.length) <= limit && distanceClusters(pc, wc) <= limit;
    }),
  );
}
