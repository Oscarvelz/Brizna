export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

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
  if (t.includes(q)) return true;
  const words = t.split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  return q.split(/\s+/).filter(Boolean).every((part) =>
    words.some((word) => {
      if (word.includes(part) || part.includes(word)) return true;
      const limit = part.length >= 7 ? 2 : part.length >= 4 ? 1 : 0;
      return limit > 0 && Math.abs(word.length - part.length) <= limit && distance(part, word) <= limit;
    }),
  );
}
