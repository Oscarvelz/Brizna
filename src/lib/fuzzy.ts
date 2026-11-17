export function fold(value: string): string {
  return value
    .normalize("NFD")
    // 1.6.14 (Prejuicio R4, R5F-4/R5F-5/R5F-6): los mismos pasos previos
    // que foldText (dup-match.ts) — tatweel fuera, «am» tailandés/lao
    // unificado, nukta índico protegido de la tira: los dos pliegues
    // pliegan igual, también fuera del latín.
    .replace(/ـ/g, "")
    .replace(/ำ/g, "ํา")
    .replace(/ຳ/g, "຅າ".replace("຅", "ໍ"))
    .replace(/[़়া\u09bc\u0a3c\u0abc\u0b3c\u0d3c]/g, (ch) => FZ_NUKTA[ch] ?? ch)
    // 1.6.12 (R4F-3): Mn+Me, como foldText — los signos Mc (las vocales
    // devanagari) son letras y se quedan; los dos pliegues siguen de acuerdo.
    .replace(/[\p{Mn}\p{Me}]/gu, "")
    .replace(/[\ue000\ue001\ue002\ue003\ue004\ue005]/g, (ch) => FZ_NUKTA_BACK[ch] ?? ch)
    .toLowerCase();
}

// 1.6.14 (R5F-5): espejo de NUKTA_SLOTS en dup-match.ts — mantener en
// sincronía con aquel mapa.
const FZ_NUKTA: Record<string, string> = {
  "़": "\ue000", "়": "\ue001", "\u0a3c": "\ue002",
  "\u0abc": "\ue003", "\u0b3c": "\ue004", "\u0d3c": "\ue005",
};
const FZ_NUKTA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(FZ_NUKTA).map(([k, v]) => [v, k]),
);

function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1], row[j]) + 1;
      prev = row[j]!;
      row[j] = next;
    }
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
  const words = t.split(/[^a-z0-9]+/).filter((word) => word.length > 1);
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
      if (part.length === 1 && parts.length > 1 && !/^[0-9]$/.test(part) && word.startsWith(part)) return true;
      if (part.length >= 2 && (word.includes(part) || part.includes(word))) return true;
      const limit = part.length >= 7 ? 2 : part.length >= 4 ? 1 : 0;
      return limit > 0 && Math.abs(word.length - part.length) <= limit && distance(part, word) <= limit;
    }),
  );
}
